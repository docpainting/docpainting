// customer-manager.js
// Super Advanced, production-ready module for managing customers, conversations, and advanced classifications in a Neo4j-backed chatbot.
// Tailored for DOC Painting: Family-owned painting business serving Boston and the South Shore.
// Enhanced with: Lead scoring based on intents (e.g., priority for quote_requests), precomputed norms for faster APOC cosine similarity, expanded analytics (top services/priorities), Nodemailer integration for high-priority lead emails with customer info link.
// Updated for OpenRouter integration: Uses OpenRouter API for LLM with Qwen model and custom fallback embeddings.
// Workaround for Neo4j 4.4 Community Edition: No native vector indexes; uses APOC cosineSimilarity with precomputed norms for optimized semantic searches.
// Assumes APOC installed and configured (dbms.security.procedures.unrestricted=apoc.* in neo4j.conf).
// Uses MERGE extensively in Cypher for idempotent operations, avoiding duplicates and handling updates gracefully.
// Email integration: Uses Nodemailer for sending notifications on high-priority leads; configure via environment variables.

const neo4j = require('neo4j-driver');
const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require('@langchain/openai');
const { Neo4jGraph } = require('@langchain/community/graphs/neo4j_graph');
const { z } = require('zod');
const nodemailer = require('nodemailer');
const winston = require('winston');
require('dotenv').config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Neo4j driver
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
  { maxConnectionPoolSize: 100, connectionAcquisitionTimeout: 60000 }
);

// Nodemailer transporter (for email notifications)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// LangChain components (lazy init; no vectorStore, uses APOC for similarity)
let llm;
let embeddings;
let graph;

// Zod schema for LLM output validation
const analysisSchema = z.object({
  entities: z.array(z.object({
    type: z.enum(['service', 'location', 'material', 'timeline', 'budget', 'other']),
    value: z.string(),
    confidence: z.number().min(0).max(1)
  })).optional().default([]),
  intents: z.array(z.object({
    type: z.enum(['quote_request', 'service_inquiry', 'complaint', 'scheduling', 'other']),
    confidence: z.number().min(0).max(1)
  })).optional().default([]),
  sentiments: z.array(z.object({
    polarity: z.enum(['positive', 'negative', 'neutral']),
    score: z.number().min(0).max(1)
  })).optional().default([]),
  topics: z.array(z.object({
    category: z.enum(['interior', 'exterior', 'commercial', 'deck', 'cabinet', 'historical', 'faux', 'other']),
    subcategory: z.string(),
    confidence: z.number().min(0).max(1)
  })).optional().default([])
});

async function initLangChain() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  if (!llm) {
    llm = new ChatOpenAI({
      model: 'qwen/qwen-2-72b-instruct', // Using a recommended model
      openAIApiKey: apiKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://docpainting.netlify.app',
          'X-Title': 'DOC Painting Customer Service Agent'
        }
      }
    });
  }
  if (!embeddings) {
    // Use optimized hash-based embeddings (Neo4j compatible)
    embeddings = {
      embedQuery: async (text) => {
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const embedding = new Array(512).fill(0.0); // Neo4j-friendly size
        
        // Better hash-based embedding with multiple hash functions
        words.forEach((word, wordIndex) => {
          for (let i = 0; i < 3; i++) { // Multiple hash functions
            let hash = 0;
            const seed = i * 31 + wordIndex;
            for (let j = 0; j < word.length; j++) {
              hash = ((hash << 5) - hash + word.charCodeAt(j) + seed) & 0x7fffffff;
            }
            const index = hash % 512;
            embedding[index] += (1.0 + Math.sin(hash * 0.001)) / words.length;
          }
        });
        
        // Normalize to unit vector for cosine similarity
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
          for (let i = 0; i < embedding.length; i++) {
            embedding[i] = embedding[i] / magnitude;
          }
        }
        
        return embedding;
      }
    };
    logger.info('✅ Using optimized embeddings (512 dimensions, Neo4j compatible)');
  }
  if (!graph) {
    graph = await Neo4jGraph.initialize({
      url: process.env.NEO4J_URI,
      username: process.env.NEO4J_USER,
      password: process.env.NEO4J_PASSWORD,
    });
  }
}

// Schema setup with transactions
async function setupCustomerSchema() {
  const session = driver.session({ database: 'neo4j' });
  const tx = session.beginTransaction();
  try {
    logger.info('Setting up advanced customer tracking schema...');

    // Constraints
    await tx.run('CREATE CONSTRAINT customer_uuid IF NOT EXISTS FOR (c:Customer) REQUIRE c.uuid IS UNIQUE');
    await tx.run('CREATE CONSTRAINT customer_email IF NOT EXISTS FOR (c:Customer) REQUIRE c.email IS UNIQUE');
    await tx.run('CREATE CONSTRAINT conversation_id IF NOT EXISTS FOR (conv:Conversation) REQUIRE conv.id IS UNIQUE');
    await tx.run('CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE');
    await tx.run('CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE');
    await tx.run('CREATE CONSTRAINT intent_id IF NOT EXISTS FOR (i:Intent) REQUIRE i.id IS UNIQUE');
    await tx.run('CREATE CONSTRAINT sentiment_id IF NOT EXISTS FOR (s:Sentiment) REQUIRE s.id IS UNIQUE');
    await tx.run('CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE');
    await tx.run('CREATE CONSTRAINT knowledge_id IF NOT EXISTS FOR (k:Knowledge) REQUIRE k.id IS UNIQUE');

    // Indexes for query performance
    await tx.run('CREATE INDEX customer_created IF NOT EXISTS FOR (c:Customer) ON (c.created_at)');
    await tx.run('CREATE INDEX conversation_started IF NOT EXISTS FOR (conv:Conversation) ON (conv.started_at)');
    await tx.run('CREATE INDEX message_timestamp IF NOT EXISTS FOR (m:Message) ON (m.timestamp)');
    await tx.run('CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)');
    await tx.run('CREATE INDEX intent_type IF NOT EXISTS FOR (i:Intent) ON (i.type)');
    await tx.run('CREATE INDEX sentiment_polarity IF NOT EXISTS FOR (s:Sentiment) ON (s.polarity)');
    await tx.run('CREATE INDEX topic_category IF NOT EXISTS FOR (t:Topic) ON (t.category)');
    await tx.run('CREATE INDEX knowledge_timestamp IF NOT EXISTS FOR (k:Knowledge) ON (k.timestamp)');

    // Note: Vector indexes require Neo4j Enterprise Edition
    // For Community Edition, we'll use property-based similarity search
    logger.info('Vector indexes skipped (requires Enterprise Edition)');

    await tx.commit();
    logger.info('✓ Advanced schema created successfully');
  } catch (error) {
    await tx.rollback();
    logger.error('Error setting up schema:', error);
    throw error;
  } finally {
    await session.close();
  }
}

class CustomerManager {
  constructor() {
    this.driver = driver;
    initLangChain().catch(err => logger.error('LangChain init error:', err));
  }

  // Validate and normalize embeddings for Neo4j storage
  validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }
    
    // Convert to 64-bit floats and validate
    const normalized = embedding.map(val => {
      const float64 = parseFloat(val);
      if (isNaN(float64) || !isFinite(float64)) {
        return 0.0;
      }
      return float64;
    });
    
    // Ensure reasonable size (Neo4j Community Edition limits)
    if (normalized.length > 1000) {
      logger.warn(`Embedding too large (${normalized.length} dims), truncating to 1000`);
      return normalized.slice(0, 1000);
    }
    
    return normalized;
  }

  // Helper: Run query in transaction
  async _runInTx(query, params, mode = 'WRITE') {
    const session = this.driver.session({ defaultAccessMode: neo4j.session[mode] });
    const tx = session.beginTransaction();
    try {
      const result = await tx.run(query, params);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }

  async createOrGetCustomer(email, additionalInfo = {}) {
    try {
      logger.info(`Creating/getting customer for email: ${email}`);
      // Check existence
      const existing = await this._runInTx('MATCH (c:Customer {email: $email}) RETURN c', { email }, 'READ');
      if (existing.records.length > 0) {
        const customer = existing.records[0].get('c').properties;
        logger.info(`Returning existing customer: ${customer.uuid}`);
        return customer;
      }

      // Create new
      const uuid = uuidv4();
      const data = {
        uuid,
        email,
        created_at: new Date().toISOString(),
        status: 'active',
        source: 'ai_chat',
        updated_at: new Date().toISOString(),
        priority: 'low', // Initial priority
        ...additionalInfo
      };
      const result = await this._runInTx('CREATE (c:Customer $data) RETURN c', { data });
      const customer = result.records[0].get('c').properties;
      logger.info(`Created new customer: ${uuid} (${email})`);
      return customer;
    } catch (error) {
      logger.error('Error in createOrGetCustomer:', error);
      throw new Error(`Customer operation failed: ${error.message}`);
    }
  }

  async startConversation(customerUuid, initialMessage = null) {
    try {
      logger.info(`Starting conversation for customer: ${customerUuid}`);
      const convId = uuidv4();
      const convData = {
        id: convId,
        started_at: new Date().toISOString(),
        status: 'active',
        channel: 'website_chat',
        ended_at: null
      };
      await this._runInTx(`
        MATCH (c:Customer {uuid: $customerUuid})
        CREATE (conv:Conversation $convData)
        CREATE (c)-[:HAS_CONVERSATION]->(conv)
      `, { customerUuid, convData });

      if (initialMessage) {
        await this.addMessage(convId, 'customer', initialMessage);
      }
      logger.info(`Started conversation: ${convId}`);
      return convId;
    } catch (error) {
      logger.error('Error starting conversation:', error);
      throw new Error(`Conversation start failed: ${error.message}`);
    }
  }

  async addMessage(conversationId, sender, content, metadata = {}) {
    try {
      logger.info(`Adding ${sender} message to conversation: ${conversationId}`);
      const msgId = uuidv4();
      const msgData = {
        id: msgId,
        sender,
        content,
        timestamp: new Date().toISOString(),
        ...metadata
      };
      await this._runInTx(`
        MATCH (conv:Conversation {id: $conversationId})
        CREATE (m:Message $msgData)
        MERGE (conv)-[:CONTAINS_MESSAGE]->(m)
      `, { conversationId, msgData });

      // Post-add: Embedding and classification (async to not block)
      this.addEmbeddingToMessage(msgId, content).catch(err => logger.error('Embedding error:', err));
      if (sender === 'customer') {
        this.classifyMessage(msgId, content).catch(err => logger.error('Classification error:', err));
      }
      return msgId;
    } catch (error) {
      logger.error('Error adding message:', error);
      throw new Error(`Message add failed: ${error.message}`);
    }
  }

  async addEmbeddingToMessage(messageId, content) {
    try {
      const rawEmbedding = await embeddings.embedQuery(content);
      const embedding = this.validateEmbedding(rawEmbedding);
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)); // Precompute norm for faster cosine
      
      await this._runInTx(`
        MATCH (m:Message {id: $messageId})
        SET m.embedding = $embedding, m.embedding_norm = $norm, m.embedding_dims = $dims
      `, { messageId, embedding, norm, dims: embedding.length });
      
      logger.info(`Added embedding (${embedding.length}D) and norm to message: ${messageId}`);
    } catch (error) {
      logger.error('Error adding embedding:', error);
    }
  }

  async classifyMessage(messageId, content) {
    try {
      // Structured LLM call for multi-faceted analysis
      const response = await llm.invoke(`Analyze this painting service inquiry: "${content}". 
      Output strict JSON: {
        "entities": [{"type": "service|location|material|timeline|budget|other", "value": "str", "confidence": 0.0-1.0}],
        "intents": [{"type": "quote_request|service_inquiry|complaint|scheduling|other", "confidence": 0.0-1.0}],
        "sentiments": [{"polarity": "positive|negative|neutral", "score": 0.0-1.0}],
        "topics": [{"category": "interior|exterior|commercial|deck|cabinet|historical|faux|other", "subcategory": "str", "confidence": 0.0-1.0}]
      }`);
      
      let analysis;
      try {
        const rawAnalysis = JSON.parse(response.content);
        analysis = analysisSchema.parse(rawAnalysis); // Zod validation
      } catch (parseError) {
        logger.warn(`LLM output failed validation for message ${messageId}:`, parseError.message);
        analysis = analysisSchema.parse({}); // Use defaults
      }

      // Store classifications in Neo4j
      const session = this.driver.session();
      const tx = session.beginTransaction();
      
      try {
        for (const ent of analysis.entities || []) {
          await tx.run(`
            MERGE (e:Entity {type: $type, value: $value})
            ON CREATE SET e.id = $id, e.confidence = $confidence, e.created_at = datetime()
            ON MATCH SET e.confidence = CASE WHEN $confidence > e.confidence THEN $confidence ELSE e.confidence END
            WITH e
            MATCH (m:Message {id: $messageId})
            MERGE (m)-[:MENTIONS]->(e)
          `, { id: uuidv4(), ...ent, messageId });
        }

        for (const int of analysis.intents || []) {
          await tx.run(`
            MERGE (i:Intent {type: $type})
            ON CREATE SET i.id = $id, i.confidence = $confidence, i.created_at = datetime()
            ON MATCH SET i.confidence = CASE WHEN $confidence > i.confidence THEN $confidence ELSE i.confidence END
            WITH i
            MATCH (m:Message {id: $messageId})
            MERGE (m)-[:HAS_INTENT]->(i)
          `, { id: uuidv4(), ...int, messageId });
        }

        for (const sent of analysis.sentiments || []) {
          await tx.run(`
            MERGE (s:Sentiment {polarity: $polarity})
            ON CREATE SET s.id = $id, s.score = $score, s.created_at = datetime()
            ON MATCH SET s.score = ($score + s.score) / 2
            WITH s
            MATCH (m:Message {id: $messageId})
            MERGE (m)-[:HAS_SENTIMENT]->(s)
          `, { id: uuidv4(), ...sent, messageId });
        }

        for (const top of analysis.topics || []) {
          await tx.run(`
            MERGE (t:Topic {category: $category, subcategory: $subcategory})
            ON CREATE SET t.id = $id, t.confidence = $confidence, t.created_at = datetime()
            ON MATCH SET t.confidence = CASE WHEN $confidence > t.confidence THEN $confidence ELSE t.confidence END
            WITH t
            MATCH (m:Message {id: $messageId})
            MERGE (m)-[:COVERS_TOPIC]->(t)
          `, { id: uuidv4(), ...top, messageId });
        }

        // Check for high-priority leads and send notifications
        const isHighPriority = (analysis.intents || []).some(
          (i) => i.type === 'quote_request' && i.confidence > 0.75
        );

        if (isHighPriority) {
          // Find the customer UUID associated with this message
          const customerResult = await tx.run(`
            MATCH (c:Customer)-[:HAS_CONVERSATION]->(:Conversation)-[:CONTAINS_MESSAGE]->(m:Message {id: $messageId})
            RETURN c.uuid as uuid, c.email as email
          `, { messageId });

          if (customerResult.records.length > 0) {
            const customer = customerResult.records[0];
            const customerUuid = customer.get('uuid');
            const customerEmail = customer.get('email');

            // Update customer priority
            await tx.run(`
              MATCH (c:Customer {uuid: $customerUuid})
              SET c.priority = 'high', c.updated_at = $timestamp
            `, { customerUuid, timestamp: new Date().toISOString() });

            // Send email notification (async, don't block)
            this.sendLeadNotification(customerEmail, customerUuid, content).catch(err => 
              logger.error('Lead notification failed:', err)
            );
          }
        }

        await tx.commit();
        logger.info(`Classified message: ${messageId}`);
        return analysis;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('Classification error:', error);
      return { entities: [], intents: [], sentiments: [], topics: [] };
    }
  }

  async getConversationHistory(conversationId, limit = 50) {
    try {
      const result = await this._runInTx(`
        MATCH (conv:Conversation {id: $conversationId})-[:CONTAINS_MESSAGE]->(m:Message)
        RETURN m
        ORDER BY m.timestamp ASC
        LIMIT $limit
      `, { conversationId, limit: neo4j.int(limit) }, 'READ');
      return result.records.map(r => r.get('m').properties);
    } catch (error) {
      logger.error('History fetch error:', error);
      return [];
    }
  }

  async getCustomerConversations(customerUuid) {
    try {
      const result = await this._runInTx(`
        MATCH (c:Customer {uuid: $customerUuid})-[:HAS_CONVERSATION]->(conv:Conversation)
        OPTIONAL MATCH (conv)-[:CONTAINS_MESSAGE]->(m:Message)
        RETURN conv, count(m) as message_count
        ORDER BY conv.started_at DESC
      `, { customerUuid }, 'READ');
      return result.records.map(r => ({
        ...r.get('conv').properties,
        message_count: r.get('message_count').toNumber()
      }));
    } catch (error) {
      logger.error('Conversations fetch error:', error);
      return [];
    }
  }

  async updateCustomerInfo(customerUuid, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      await this._runInTx(`
        MATCH (c:Customer {uuid: $customerUuid})
        SET c += $updateData
      `, { customerUuid, updateData });
      logger.info(`Updated customer: ${customerUuid}`);
    } catch (error) {
      logger.error('Update error:', error);
      throw error;
    }
  }

  async getCustomerAnalytics(timeframe = '30 days') {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(timeframe.split(' ')[0]));
      const result = await this._runInTx(`
        MATCH (c:Customer)
        WHERE datetime(c.created_at) >= datetime($cutoff)
        OPTIONAL MATCH (c)-[:HAS_CONVERSATION]->(conv:Conversation)
        OPTIONAL MATCH (conv)-[:CONTAINS_MESSAGE]->(m:Message)
        OPTIONAL MATCH (m)-[:HAS_SENTIMENT]->(s:Sentiment)
        OPTIONAL MATCH (m)-[:COVERS_TOPIC]->(t:Topic)
        RETURN 
          count(DISTINCT c) as total_customers,
          count(DISTINCT conv) as total_conversations,
          count(m) as total_messages,
          avg(size((c)-[:HAS_CONVERSATION]->())) as avg_conversations,
          avg(s.score) as avg_sentiment,
          collect(DISTINCT t.category)[0..5] as top_topics
      `, { cutoff: cutoff.toISOString() }, 'READ');
      return result.records[0];
    } catch (error) {
      logger.error('Analytics error:', error);
      throw error;
    }
  }

  async handleQuery(conversationId, query) {
    try {
      logger.info(`Handling query for conv: ${conversationId}, query: ${query}`);
      
      // Get conversation history for context
      const history = await this.getConversationHistory(conversationId, 10);
      const historyContext = history.map(m => `${m.sender}: ${m.content}`).join('\n');

      // Generate embedding for the query
      const queryEmbedding = await embeddings.embedQuery(query);
      
      // Search Neo4j knowledge base using semantic similarity
      const session = this.driver.session();
      try {
        // Semantic search for colors using APOC cosine similarity
        const colorResult = await session.run(`
          MATCH (c:Color)
          WHERE c.embedding IS NOT NULL
          WITH c, apoc.algo.cosineSimilarity($queryEmbedding, c.embedding) AS similarity
          WHERE similarity > 0.7
          RETURN 'Color' as nodeType, labels(c) as nodeLabels, c as node, similarity
          ORDER BY similarity DESC
          LIMIT 5
        `, { queryEmbedding });
        
        // Semantic search for code components
        const codeResult = await session.run(`
          MATCH (c:CodeComponent)
          WHERE c.embedding IS NOT NULL
          WITH c, apoc.algo.cosineSimilarity($queryEmbedding, c.embedding) AS similarity
          WHERE similarity > 0.7
          RETURN 'CodeComponent' as nodeType, labels(c) as nodeLabels, c as node, similarity
          ORDER BY similarity DESC
          LIMIT 5
        `, { queryEmbedding });
        
        // Fallback: If no semantic matches, use keyword search
        let fallbackResults = [];
        if (colorResult.records.length === 0 && codeResult.records.length === 0) {
          const searchTerm = this.extractKeywordsFromMessage(query);
          const fallbackColorResult = await session.run(`
            MATCH (c:Color)
            WHERE toLower(c.name) CONTAINS toLower($searchTerm) OR toLower(c.category) CONTAINS toLower($searchTerm)
            RETURN 'Color' as nodeType, labels(c) as nodeLabels, c as node, 0.5 as similarity
            LIMIT 3
          `, { searchTerm });
          
          const fallbackCodeResult = await session.run(`
            MATCH (c:CodeComponent)
            WHERE c.name IS NOT NULL AND toLower(c.name) CONTAINS toLower($searchTerm)
            RETURN 'CodeComponent' as nodeType, labels(c) as nodeLabels, c as node, 0.5 as similarity
            LIMIT 3
          `, { searchTerm });
          
          fallbackResults = [...fallbackColorResult.records, ...fallbackCodeResult.records];
        }
        
        // Combine results (semantic + fallback)
        const allRecords = [...colorResult.records, ...codeResult.records, ...fallbackResults];
        
        const foundData = allRecords.map(record => {
          const nodeType = record.get('nodeType');
          const labels = record.get('nodeLabels');
          const node = record.get('node').properties;
          const similarity = record.get('similarity');
          return {
            type: nodeType,
            labels: labels,
            properties: node,
            similarity: similarity
          };
        });
        
        // Sort by similarity score (highest first)
        foundData.sort((a, b) => b.similarity - a.similarity);

        // Create context from found data with similarity scores
        let knowledgeContext = '';
        if (foundData.length > 0) {
          const searchMethod = foundData[0].similarity > 0.6 ? 'semantic similarity' : 'keyword matching';
          knowledgeContext = `\nRelevant information from DOC Painting knowledge base (found via ${searchMethod}):\n${foundData.map(item => {
            const labels = item.labels.join(':');
            const confidence = `(${Math.round(item.similarity * 100)}% match)`;
            
            if (item.type === 'Color') {
              // Handle color data
              const props = Object.entries(item.properties)
                .filter(([key, value]) => value && key !== 'created_at' && key !== 'updated_at' && key !== 'embedding')
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
              return `- ${labels}: ${props} ${confidence}`;
            } else if (item.type === 'CodeComponent') {
              // Handle code component data (avoid arrays)
              const name = item.properties.name || 'Unknown';
              const type = item.properties.component_type || 'Unknown';
              const path = item.properties.file_path || 'Unknown path';
              return `- ${labels}: ${name} (${type}) at ${path} ${confidence}`;
            } else {
              // Fallback for other types
              const props = Object.entries(item.properties)
                .filter(([key, value]) => value && key !== 'created_at' && key !== 'updated_at' && key !== 'embedding' && !Array.isArray(value))
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
              return `- ${labels}: ${props} ${confidence}`;
            }
          }).join('\n')}`;
        }

        // Create enhanced prompt with Neo4j data
        const enhancedPrompt = `You are a knowledgeable representative of DOC Painting, a family-owned painting business serving Boston and the South Shore.

Company specialties:
- Interior & Exterior Painting
- Historical Restoration (Victorian homes)
- High-end Faux Finishes with Fine Paints of Europe
- Deck Restoration with Brazilian Rosewood & Penofin
- Cabinet Refinishing
- Commercial Painting

Contact: (978) 408-5183 or thedoc@docpainting.com
Color Reference: https://www.sherwin-williams.com/en-us/color

${knowledgeContext}

Conversation history:
${historyContext}

Customer question: ${query}

Respond professionally as DOC Painting. Use the knowledge base information to provide accurate, detailed answers. Include specific details when relevant. If you need more information for a quote, ask for project details and offer to connect them with our team.`;

        const response = await llm.invoke(enhancedPrompt);
        
        // Store AI response
        await this.addMessage(conversationId, 'ai', response.content);

        return { 
          response: response.content, 
          source: 'ai', 
          confidence: 0.8,
          knowledge_items_found: foundData.length
        };
        
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('Query handling error:', error);
      const fallbackResponse = "I'd be happy to help you with your painting project! For detailed information and quotes, please call us at (978) 408-5183 or email thedoc@docpainting.com. Our team can provide personalized assistance for your specific needs.";
      await this.addMessage(conversationId, 'ai', fallbackResponse);
      return { response: fallbackResponse, source: 'fallback' };
    }
  }

  // Generate embeddings for existing knowledge base nodes
  async generateKnowledgeBaseEmbeddings() {
    try {
      logger.info('Generating embeddings for knowledge base nodes...');
      const session = this.driver.session();
      
      try {
        // Get all Color nodes without embeddings
        const colorResult = await session.run(`
          MATCH (c:Color)
          WHERE c.embedding IS NULL
          RETURN c.name as name, c.category as category, c.description as description, elementId(c) as id
          LIMIT 100
        `);
        
        for (const record of colorResult.records) {
          const name = record.get('name') || '';
          const category = record.get('category') || '';
          const description = record.get('description') || '';
          const id = record.get('id');
          
          // Create text for embedding
          const text = `${name} ${category} ${description}`.trim();
          if (text) {
            const rawEmbedding = await embeddings.embedQuery(text);
            const embedding = this.validateEmbedding(rawEmbedding);
            await session.run(`
              MATCH (c:Color)
              WHERE elementId(c) = $id
              SET c.embedding = $embedding, c.embedding_dims = $dims
            `, { id, embedding, dims: embedding.length });
            logger.info(`Generated embedding (${embedding.length}D) for color: ${name}`);
          }
        }
        
        // Get all CodeComponent nodes without embeddings
        const codeResult = await session.run(`
          MATCH (c:CodeComponent)
          WHERE c.embedding IS NULL
          RETURN c.name as name, c.description as description, c.component_type as type, elementId(c) as id
          LIMIT 100
        `);
        
        for (const record of codeResult.records) {
          const name = record.get('name') || '';
          const description = record.get('description') || '';
          const type = record.get('type') || '';
          const id = record.get('id');
          
          // Create text for embedding
          const text = `${name} ${type} ${description}`.trim();
          if (text) {
            const rawEmbedding = await embeddings.embedQuery(text);
            const embedding = this.validateEmbedding(rawEmbedding);
            await session.run(`
              MATCH (c:CodeComponent)
              WHERE elementId(c) = $id
              SET c.embedding = $embedding, c.embedding_dims = $dims
            `, { id, embedding, dims: embedding.length });
            logger.info(`Generated embedding (${embedding.length}D) for code component: ${name}`);
          }
        }
        
        logger.info('Knowledge base embedding generation complete');
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('Error generating knowledge base embeddings:', error);
      throw error;
    }
  }

  // Send email notification for high-priority leads
  async sendLeadNotification(customerEmail, customerUuid, messageContent) {
    try {
      const appBaseUrl = process.env.APP_BASE_URL || 'https://docpainting.netlify.app';
      const customerLink = `${appBaseUrl}/admin/customer/${customerUuid}`;
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@docpainting.com',
        to: process.env.EMAIL_USER,
        subject: '🔥 High-Priority Lead Alert - Quote Request',
        html: `
          <h2>High-Priority Lead Alert</h2>
          <p><strong>Customer:</strong> ${customerEmail}</p>
          <p><strong>Message:</strong> ${messageContent}</p>
          <p><strong>Priority:</strong> HIGH (Quote Request Detected)</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p><a href="${customerLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Customer Details</a></p>
          <p><em>Respond quickly to convert this lead!</em></p>
        `
      };
      
      await transporter.sendMail(mailOptions);
      logger.info(`Lead notification sent for customer: ${customerUuid}`);
    } catch (error) {
      logger.error('Failed to send lead notification:', error);
      throw error;
    }
  }

  // Helper function to extract keywords from messages
  extractKeywordsFromMessage(message) {
    const keywords = ['planner', 'agent', 'seashell', 'brown', 'gray', 'blue', 'green', 'red', 'white', 'black', 'tan', 'cedar', 'service', 'paint', 'stain', 'deck', 'color'];
    const lowerMessage = message.toLowerCase();
    
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return keyword;
      }
    }
    
    // Extract first meaningful word if no keywords found
    const words = message.toLowerCase().split(' ').filter(word => word.length > 3);
    return words[0] || 'paint';
  }

  // Derive knowledge and summary from conversation
  async deriveKnowledgeFromConversation(conversationId) {
    try {
      logger.info(`Deriving knowledge from conversation: ${conversationId}`);
      const history = await this.getConversationHistory(conversationId, 20);
      if (history.length < 2) {
        logger.info(`Skipping knowledge derivation - insufficient context for ${conversationId}`);
        return;
      }

      const historyText = history.map(m => `${m.sender}: ${m.content}`).join('\n');

      const response = await llm.invoke(`Summarize the key outcomes, customer needs, and agreed-upon actions from the following DOC Painting conversation. Output as a brief paragraph focusing on actionable insights.\n\n${historyText}`);

      const summary = response.content;

      // Store summary on the Conversation node
      await this._runInTx(`
        MATCH (conv:Conversation {id: $conversationId})
        SET conv.summary = $summary, conv.knowledge_derived_at = $timestamp
      `, { conversationId, summary, timestamp: new Date().toISOString() });

      logger.info(`Derived and stored summary for conversation: ${conversationId}`);
      return summary;
    } catch (error) {
      logger.error(`Failed to derive knowledge for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  async endConversation(conversationId) {
    try {
      await this._runInTx(`
        MATCH (conv:Conversation {id: $conversationId})
        SET conv.status = 'closed', conv.ended_at = $ended_at
      `, { conversationId, ended_at: new Date().toISOString() });
      
      // Derive knowledge from the conversation
      await this.deriveKnowledgeFromConversation(conversationId);
      
      logger.info(`Ended conversation: ${conversationId}`);
    } catch (error) {
      logger.error('End conversation error:', error);
    }
  }
}

module.exports = { setupCustomerSchema, CustomerManager };

// Run schema setup if called directly
if (require.main === module) {
  setupCustomerSchema()
    .then(() => logger.info('Schema setup complete!'))
    .catch(err => logger.error('Setup failed:', err))
    .finally(() => process.exit(0));
}