// chat-with-aria.js
//
// #################################################################################################
// ## Unified & Super-Advanced Neo4j Aura Response System v12 - Complete Application            ##
// #################################################################################################
//
// This is the complete, standalone, and runnable application for the "Resident Doc - Aria" chatbot.
// It combines a client-side command-line interface with the complete, production-hardened
// backend logic module.
//
// This script contains the full orchestration:
//
// 1.  **Client Application:** A command-line interface using `readline` to chat with Aria.
// 2.  **Text-to-Speech:** Integration with the Kokoro TTS engine to have Aria speak her responses.
// 3.  **Backend Engine:** The complete `CustomerManager` class, which handles all advanced logic:
//     - Secure, dynamic knowledge graph updates using APOC.
//     - A persistent conversational memory stored in Neo4j.
//     - Intent-driven, prioritized knowledge retrieval.
//     - A confidence-aware persona for more intelligent and nuanced responses.
//
// To Run This Script:
// 1. Ensure you have a `.env` file with all the necessary API keys and credentials.
// 2. Run `npm install` to get the required packages.
// 3. Execute `node chat-with-aria.js` from your terminal.
//
// #################################################################################################

const neo4j = require('neo4j-driver');
const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require('@langchain/openai');
const { z } = require('zod');
const nodemailer = require('nodemailer');
const winston = require('winston');
const fetch = require('node-fetch');
const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');


// Only load dotenv in local development
if (process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  require('dotenv').config();
}

// --- 1. CONFIGURATION & INITIALIZATION ---

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  {
    maxConnectionLifetime: 3 * 60 * 60 * 1000,
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000,
    disableLosslessIntegers: true,
    connectionTimeout: 30 * 1000,
    maxTransactionRetryTime: 30 * 1000,
    logging: neo4j.logging.console('debug')
  }
);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

let llm;
let embeddings;

const analysisSchema = z.object({
  summary: z.string().optional().describe("A one-sentence summary of the user's core request."),
  primary_subject: z.string().optional().describe("The main entity of the query, e.g., 'Person:Marianne Abrams' or 'Company:PwC'"),
  entities: z.array(z.object({
    type: z.enum(['SERVICE', 'LOCATION', 'MATERIAL', 'PERSON', 'COMPANY', 'PRODUCT', 'OTHER']),
    value: z.string().describe("The normalized value of the entity, e.g., 'Interior Painting'"),
    confidence: z.number().min(0).max(1)
  })).optional().default([]),
  intents: z.array(z.object({
    type: z.enum(['QUOTE_REQUEST', 'SERVICE_INQUIRY', 'COMPLAINT', 'SCHEDULING', 'CAREER_INQUIRY', 'GENERAL_QUESTION', 'OTHER']),
    confidence: z.number().min(0).max(1)
  })).optional().default([]),
  sentiment: z.object({
    polarity: z.enum(['positive', 'negative', 'neutral']),
    score: z.number().min(-1).max(1)
  }).optional(),
});


// --- 2. ADVANCED NEO4J SCHEMA SETUP ---

async function setupAdvancedSchema() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
  try {
    logger.info('Setting up UNIFIED knowledge graph schema with 4096D vector indexes...');
    const embeddingDimensions = parseInt(process.env.HF_EMBEDDING_DIMENSIONS, 10);

    const constraints = [
      'CREATE CONSTRAINT IF NOT EXISTS FOR (c:Customer) REQUIRE c.uuid IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (i:Institution) REQUIRE i.name IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE',
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.category)',
      'CREATE INDEX IF NOT EXISTS FOR (j:Job) ON (j.title)',
    ];
    
    const vectorNodeTypes = ['Person', 'Company', 'Institution', 'Job', 'Skill', 'Service', 'Message'];
    for(const nodeType of vectorNodeTypes) {
        const indexName = `qwen_vector_${nodeType.toLowerCase()}`;
        const query = `CREATE VECTOR INDEX ${indexName} IF NOT EXISTS FOR (n:${nodeType}) ON (n.embedding) OPTIONS {indexConfig: { \`vector.dimensions\`: ${embeddingDimensions}, \`vector.similarity_function\`: "cosine" }}`;
        indexes.push(query);
    }

    for (const query of constraints) { await session.run(query); }
    logger.info('✓ Constraints ensured.');
    for (const query of indexes) { await session.run(query); }
    logger.info(`✓ Indexes and ${embeddingDimensions}D vector indexes created.`);

    logger.info('✓ Unified schema setup complete for Neo4j 5+.');
  } catch (error) {
    logger.error('Fatal error during schema setup:', { message: error.message, stack: error.stack });
    throw error;
  } finally {
    await session.close();
  }
}


// --- 3. CORE BACKEND LOGIC: CustomerManager Class ---

class CustomerManager {
  constructor() {
    this.driver = driver;
    initLangChain().catch(err => logger.error('LangChain initialization failed:', err));
  }

  async _runInTx(query, params, mode = 'WRITE') {
    const session = this.driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
    try {
      const result = mode === 'WRITE'
        ? await session.executeWrite(tx => tx.run(query, params))
        : await session.executeRead(tx => tx.run(query, params));
      return result;
    } catch (error) {
      logger.error('Neo4j transaction error:', { query, params, message: error.message });
      throw new Error(`Database operation failed: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async createOrGetCustomer(email, additionalInfo = {}) {
    const query = `
      MERGE (c:Customer {email: $email})
      ON CREATE SET c.uuid = $uuid, c.created_at = datetime(), c.status = 'active', c.source = 'ai_chat', c.priority = 'low'
      ON MATCH SET c.updated_at = datetime()
      SET c += $additionalInfo
      RETURN c`;
    const params = { email, uuid: uuidv4(), additionalInfo };
    const result = await this._runInTx(query, params);
    return result.records[0]?.get('c').properties;
  }

  async startConversation(customerUuid) {
    const convId = uuidv4();
    const query = `
      MATCH (c:Customer {uuid: $customerUuid})
      CREATE (conv:Conversation {id: $convId, started_at: datetime(), status: 'active', channel: 'website_chat'})
      CREATE (c)-[:HAS_CONVERSATION]->(conv)
      RETURN conv.id AS conversationId`;
    const result = await this._runInTx(query, { customerUuid, convId });
    return result.records[0]?.get('conversationId');
  }

  async addMessage(conversationId, sender, content) {
    const msgId = uuidv4();
    const query = `
      MATCH (conv:Conversation {id: $conversationId})
      CREATE (m:Message {id: $msgId, sender: $sender, content: $content, timestamp: datetime()})
      CREATE (conv)-[:CONTAINS_MESSAGE]->(m)
      RETURN m.id AS messageId`;
    const result = await this._runInTx(query, { conversationId, msgId, sender, content });
    if (sender === 'customer') {
      this.classifyAndEnrichMessage(msgId, content)
        .catch(err => logger.error(`Failed to enrich message ${msgId}:`, err));
    }
    return result.records[0]?.get('messageId');
  }

  async classifyAndEnrichMessage(messageId, content) {
    logger.info(`Enriching message ${messageId}...`);
    await initLangChain();

    const embedding = await embeddings.embedQuery(content);
    if (!embedding) {
        logger.error(`Could not generate embedding for message ${messageId}. Aborting enrichment.`);
        return;
    }

    const prompt = `Analyze this customer inquiry. Extract a summary, the primary subject (as 'Type:Value'), entities, all applicable intents, and sentiment.
Respond with STRICT JSON.

Example:
User Inquiry: "Tell me more about Marianne's time at PwC"
Your JSON Response:
{
  "summary": "User wants to know about Marianne Abrams' work experience at PwC.",
  "primary_subject": "Person:Marianne Abrams",
  "entities": [
    {"type": "PERSON", "value": "Marianne Abrams", "confidence": 0.9},
    {"type": "COMPANY", "value": "PwC", "confidence": 0.9}
  ],
  "intents": [{"type": "CAREER_INQUIRY", "confidence": 0.95}],
  "sentiment": {"polarity": "neutral", "score": 0.0}
}

---
Actual User Inquiry: "${content}"`;

    const response = await llm.invoke(prompt);
    let analysis;
    try {
      analysis = analysisSchema.parse(JSON.parse(response.content));
    } catch (parseError) {
      logger.warn(`LLM output validation failed for message ${messageId}:`, parseError.message);
      return;
    }

    const session = this.driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
    try {
      await session.executeWrite(async tx => {
        await tx.run(`
          MATCH (m:Message {id: $messageId})
          SET m.embedding = $embedding, m.summary = $summary, m.sentiment_polarity = $polarity, m.sentiment_score = $score
        `, { messageId, embedding, summary: analysis.summary, polarity: analysis.sentiment?.polarity, score: analysis.sentiment?.score });

        for (const intent of analysis.intents) {
          await tx.run(`MATCH (m:Message {id: $messageId}) MERGE (i:Intent {type: $type}) CREATE (m)-[:HAS_INTENT {confidence: $confidence}]->(i)`, { messageId, ...intent });
        }
        
        for (const ent of analysis.entities) {
            const labels = [ent.type];
            await tx.run(`
                CALL apoc.merge.node($labels, {name: $name}) YIELD node
                WITH node
                MATCH (m:Message {id: $messageId})
                MERGE (m)-[:MENTIONS {confidence: $confidence}]->(node)
            `, { labels, name: ent.value, messageId, confidence: ent.confidence });
        }
        
        if (analysis.primary_subject) {
            await tx.run(`
                MATCH (conv:Conversation)-[:CONTAINS_MESSAGE]->(:Message {id: $messageId})
                SET conv.currentState = $state
            `, { messageId, state: analysis.primary_subject });
        }

        if (analysis.intents.some(i => i.type === 'QUOTE_REQUEST' && i.confidence > 0.7)) {
          const result = await tx.run(`MATCH (c:Customer)-[:HAS_CONVERSATION]->()-[:CONTAINS_MESSAGE]->(m:Message {id: $messageId}) SET c.priority = 'high', c.updated_at = datetime() RETURN c.email AS email, c.uuid AS uuid`, { messageId });
          if (result.records.length > 0) {
            this.sendLeadNotification(result.records[0].get('email'), result.records[0].get('uuid'), content).catch(err => logger.error('Lead notification failed:', err));
          }
        }
      });
      logger.info(`Successfully enriched message ${messageId} and updated conversation state.`);
    } catch (error) {
      logger.error(`Transaction failed during message enrichment for ${messageId}:`, error);
    } finally {
      await session.close();
    }
  }

  async handleQuery(conversationId, queryText) {
    logger.info(`Handling query for conv ${conversationId}: "${queryText}"`);
    await initLangChain();

    const convStateResult = await this._runInTx(`
        MATCH (conv:Conversation {id: $conversationId})
        OPTIONAL MATCH (conv)-[:CONTAINS_MESSAGE]->(m:Message {sender: 'customer'})
        WITH conv, m ORDER BY m.timestamp DESC
        WITH conv, head(collect(m)) as lastCustomerMessage
        OPTIONAL MATCH (lastCustomerMessage)-[:HAS_INTENT]->(i:Intent)
        RETURN conv.currentState AS currentState,
               i.type AS lastIntent
    `, { conversationId }, 'READ');
    
    const currentState = convStateResult.records[0]?.get('currentState');
    const lastIntent = convStateResult.records[0]?.get('lastIntent');

    let searchText = queryText;
    if (currentState && (queryText.trim().toLowerCase() === 'tell me more' || queryText.trim().split(' ').length < 3)) {
        logger.info(`Vague query detected. Using conversation state to add context: ${currentState}`);
        searchText = `${currentState.split(':')[1]} ${queryText}`;
    }

    const queryEmbedding = await embeddings.embedQuery(searchText);
    if (!queryEmbedding) return { response: "I'm sorry, I'm having trouble understanding that. Could you rephrase?", source: 'error' };

    let nodeTypesToSearch = [];
    switch(lastIntent) {
        case 'CAREER_INQUIRY':
            nodeTypesToSearch = ['Person', 'Job', 'Company', 'Skill', 'Institution', 'Service', 'Message'];
            break;
        case 'SERVICE_INQUIRY':
            nodeTypesToSearch = ['Service', 'Person', 'Job', 'Message', 'Company', 'Skill', 'Institution'];
            break;
        default:
            nodeTypesToSearch = ['Person', 'Job', 'Institution', 'Skill', 'Company', 'Message', 'Service'];
    }

    let allResults = [];
    for (const nodeType of nodeTypesToSearch) {
        const indexName = `qwen_vector_${nodeType.toLowerCase()}`;
        try {
            const result = await this._runInTx(`
                CALL db.index.vector.queryNodes($indexName, 5, $queryEmbedding)
                YIELD node, score
                RETURN node, score, $nodeType as type
            `, { indexName, queryEmbedding, nodeType }, 'READ');
            
            const records = result.records.map(record => ({
                node: record.get('node'),
                score: record.get('score'),
                type: record.get('type')
            }));
            allResults = allResults.concat(records);
        } catch (e) {
            logger.warn(`⚠️  Could not query index ${indexName}. It might not exist or be populated yet.`);
        }
    }
    
    const knowledgeMap = new Map();
    allResults.forEach(item => {
        if (!knowledgeMap.has(item.node.elementId) || knowledgeMap.get(item.node.elementId).score < item.score) {
            knowledgeMap.set(item.node.elementId, item);
        }
    });
    const knowledgeItems = Array.from(knowledgeMap.values()).sort((a, b) => b.score - a.score).slice(0, 7);

    const historyForPrompt = await this._runInTx(`MATCH (:Conversation {id: $conversationId})-[:CONTAINS_MESSAGE]->(m:Message) RETURN m.sender AS sender, m.content AS content ORDER BY m.timestamp DESC LIMIT 10`, { conversationId }, 'READ');
    const historyContext = historyForPrompt.records.reverse().map(r => `${r.get('sender')}: ${r.get('content')}`).join('\n');
    const aiResponseContent = await generateAIResponse(queryText, historyContext, knowledgeItems);
    
    await this.addMessage(conversationId, 'ai', aiResponseContent);

    return {
        response: aiResponseContent,
        source: knowledgeItems.length > 0 ? 'graph_rag' : 'general',
        knowledge_items_found: knowledgeItems.length
    };
  }
}


// --- 4. UTILITY & HELPER FUNCTIONS ---

async function generateAIResponse(query, historyContext, knowledgeItems) {
  let confidenceInstruction = "If the knowledge graph is empty or doesn't contain the right information, state that you are still learning and offer to connect the customer with a human expert (like The Doc).";
  const highConfidenceItems = knowledgeItems.filter(item => item.score > 0.85);
  const mediumConfidenceItems = knowledgeItems.filter(item => item.score <= 0.85);

  if (highConfidenceItems.length > 0) {
      confidenceInstruction = "You are highly confident in the information from the 'High Confidence Semantic Matches'. Present these as facts.";
  } else if (mediumConfidenceItems.length > 0) {
      confidenceInstruction = "The information seems relevant but isn't a perfect match. Present it cautiously, perhaps by saying 'My records suggest that...' or 'What I can tell you is...'.";
  }

  const formatContext = (items) => {
      if (items.length === 0) return "N/A";
      return items.map(item => {
          const props = item.node.properties;
          const type = item.type;
          const score = (item.score * 100).toFixed(1);
          let contextualInfo = `[Found a ${type} node with relevance: ${score}%]\n`;
          Object.entries(props).forEach(([key, value]) => {
              if (key !== 'embedding' && value && typeof value !== 'object' && value.toString().length > 0) {
                  contextualInfo += `  - ${key}: ${value}\n`;
              } else if (key !== 'embedding' && Array.isArray(value)) {
                  contextualInfo += `  - ${key}: ${value.join(', ')}\n`;
              }
          });
          return contextualInfo;
      }).join('\n---\n');
  };

  const finalPrompt = `You are "Resident Doc - Aria," an AI apprentice for DOC Painting.
Your persona: You are Aria, a sharp and helpful assistant with blonde hair in a french braid and an hourglass figure. Your tone is professional, but with a friendly and engaging flair. You're eager to help and learn.

Use the following structured context to synthesize an answer.

**Knowledge Graph Context (Your study material):**
{
  "high_confidence_semantic_matches": """
  ${formatContext(highConfidenceItems)}
  """,
  "related_contextual_matches": """
  ${formatContext(mediumConfidenceItems)}
  """
}

**Conversation History:**
${historyContext}

**Customer's question:** "${query}"

**INSTRUCTIONS:**
- ${confidenceInstruction}
- Synthesize the knowledge naturally into a conversational, helpful response.
- Feel free to make connections between the different pieces of information.
- Respond as yourself (Aria) speaking naturally.
- NEVER make up information.`;
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL, 
      messages: [{ role: 'user', content: finalPrompt }],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`❌ OpenRouter API Error: ${response.status} ${response.statusText}`);
    logger.error(`➡️  Error Body: ${errorBody}`);
    throw new Error('OpenRouter API request failed.');
  }
  
  const result = await response.json();
  if (!result.choices || result.choices.length === 0 || !result.choices[0].message?.content) {
      logger.error('❌ OpenRouter API returned no choices or content.');
      logger.error('➡️  Full Response:', JSON.stringify(result, null, 2));
      throw new Error('API returned an empty or invalid response.');
  }
  
  return result.choices[0].message.content;
}

async function generateHuggingFaceEmbedding(text) {
  try {
    const embeddingDimensions = parseInt(process.env.HF_EMBEDDING_DIMENSIONS, 10);
    const response = await fetch(process.env.HF_EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
          input: text, 
          model: process.env.HF_EMBEDDING_MODEL
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Hugging Face API Error: ${response.status} ${response.statusText}`);
      logger.error(`➡️  Error Body: ${errorText}`);
      throw new Error('Hugging Face API request failed.');
    }

    const result = await response.json();
    
    let embedding;
    if (Array.isArray(result) && result.length > 0 && result[0].data) {
      embedding = result[0].data[0].embedding;
    } else if (result.data && Array.isArray(result.data)) {
      embedding = result.data[0].embedding;
    } else if (Array.isArray(result) && Array.isArray(result[0])) {
      embedding = result[0];
    } else {
      logger.error('❌ Unexpected embedding response format:', JSON.stringify(result, null, 2));
      throw new Error('Unexpected embedding response format');
    }
  
    if (!Array.isArray(embedding) || embedding.length !== embeddingDimensions) {
      throw new Error(`Invalid embedding received: expected ${embeddingDimensions}D, got ${embedding?.length || 'invalid format'}`);
    }
    
    return embedding;
  } catch (error) {
    logger.error('Embedding generation failed:', error);
    return null;
  }
}

async function initLangChain() {
  if (llm && embeddings) return;
  
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set.');
  if (!process.env.HF_TOKEN) throw new Error('HF_TOKEN for Hugging Face is not set.');
  if (!process.env.HF_EMBEDDING_ENDPOINT) throw new Error('HF_EMBEDDING_ENDPOINT is not set.');
  if (!process.env.HF_EMBEDDING_MODEL) throw new Error('HF_EMBEDDING_MODEL is not set.');
  if (!process.env.HF_EMBEDDING_DIMENSIONS) throw new Error('HF_EMBEDDING_DIMENSIONS is not set.');

  logger.info('Initializing LangChain and Embedding components...');
  
  llm = new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL,
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': process.env.APP_BASE_URL, 'X-Title': 'Resident Doc - Aria' } }
  });

  embeddings = {
      embedQuery: (text) => generateHuggingFaceEmbedding(text),
      embedDocuments: (texts) => Promise.all(texts.map(text => generateHuggingFaceEmbedding(text)))
  };

  logger.info('✅ LLM and Hugging Face Embeddings initialized.');
}

// --- 5. CLIENT-SIDE APPLICATION LOGIC ---

function sanitizeForTTS(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n\n+/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

function addHumanLikeEnhancements(text) {
  const conversationalStarters = [
    "Well, from what I know about Marianne,", "Oh! I can tell you about that -",
    "That's a great question! Let me share what I know -", "Absolutely! Here's what I can tell you about Marianne -",
    "From my knowledge of Marianne's background,", "I'd be happy to share what I know -",
  ];
  let enhanced = text;
  if (Math.random() > 0.7) {
    enhanced = conversationalStarters[Math.floor(Math.random() * conversationalStarters.length)] + " " + enhanced;
  }
  enhanced = enhanced
    .replace(/(However|But|Additionally|Furthermore|Moreover)/g, '$1... ')
    .replace(/\. ([A-Z])/g, '. ... $1');
  if (!enhanced.match(/(\.|\!|\?)$/)) {
    enhanced += '.';
  }
  return enhanced;
}

async function generateKokoroSpeech(text) {
  try {
    const enhancedText = addHumanLikeEnhancements(sanitizeForTTS(text));
    logger.info(`🎤 Aria is preparing to speak: "${enhancedText.substring(0, 100)}..."`);
    const truncatedText = enhancedText.length > 500 ? enhancedText.substring(0, 500) + '...' : enhancedText;
    const pythonScript = path.join(__dirname, 'kokoro-tts.py');
    const audioFile = `/tmp/aria_response_${Date.now()}.wav`;
    
    const pythonProcess = spawn('conda', ['run', '-n', 'kokoro', 'python', pythonScript, truncatedText, audioFile], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ Audio generated successfully');
          const playProcess = spawn('paplay', [audioFile]);
          playProcess.on('close', () => {
            logger.info('🔊 Aria finished speaking');
            resolve();
          });
          playProcess.on('error', () => {
            logger.warn('⚠️  Audio playback failed, but continuing...');
            resolve();
          });
        } else {
          logger.error('❌ TTS generation failed.');
          reject(new Error(`TTS failed.`));
        }
      });
      pythonProcess.on('error', (error) => {
        logger.error('❌ Python process error:', error.message);
        reject(error);
      });
    });
  } catch (error) {
    logger.error('❌ TTS Error:', error.message);
    throw error;
  }
}

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const manager = new CustomerManager();

    // For a CLI app, we can simulate a single customer and conversation
    const customer = await manager.createOrGetCustomer('cli.user@example.com', { name: 'CLI User' });
    const conversationId = await manager.startConversation(customer.uuid);

    console.log('\n🎭 ================================');
    console.log('🎤 CHAT WITH ARIA - The Doc\'s Apprentice');
    console.log('🎭 ================================\n');
    console.log(`💬 A new conversation has started (ID: ${conversationId}).`);
    console.log('💡 Ask me anything about Marianne Abrams or DOC Painting!');
    console.log('💡 Type "quit" or "exit" to end the chat\n');

    const askQuestion = () => {
        rl.question('🤔 You: ', async (userQuestion) => {
            if (userQuestion.toLowerCase() === 'quit' || userQuestion.toLowerCase() === 'exit') {
                console.log('\n👋 Aria: Thanks for chatting! Goodbye!\n');
                rl.close();
                await driver.close();
                return;
            }
            if (!userQuestion.trim()) {
                console.log('🤖 Aria: Please ask me a question!\n');
                askQuestion();
                return;
            }
            try {
                // Add user message to conversation history
                await manager.addMessage(conversationId, 'customer', userQuestion);
                
                // Handle the query using the manager's advanced logic
                const { response } = await manager.handleQuery(conversationId, userQuestion);
                
                console.log(`\n🤖 Aria: ${response}`);
                
                // Let Aria speak naturally
                try {
                    await generateKokoroSpeech(response);
                } catch (ttsError) {
                    console.log('⚠️  TTS not available, but text response provided above');
                }
            } catch (error) {
                console.error('❌ Error processing question:', error.message);
                console.log('\n🤖 Aria: Sorry, I had trouble with that question. Please try again!\n');
            } finally {
                console.log('\n' + '='.repeat(60) + '\n');
                askQuestion();
            }
        });
    };
    askQuestion();
}

// If this file is run directly, set up the schema and start the chat.
if (require.main === module) {
  (async () => {
    try {
      await setupAdvancedSchema();
      main();
    } catch (err) {
      logger.error('FATAL: Failed to initialize the application.', err);
      process.exit(1);
    }
  })();
}
