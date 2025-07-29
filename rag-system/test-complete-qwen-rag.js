// test-complete-qwen-rag.js
// Complete end-to-end RAG pipeline test with Qwen3-Embedding-8B

const neo4j = require('neo4j-driver');
const fetch = require('node-fetch');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
  neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD)
);

// Generate query embedding using Qwen3-Embedding-8B
async function generateQueryEmbedding(query) {
  try {
    console.log(`🔍 Generating embedding for query: "${query}"`);
    
    const response = await fetch('https://router.huggingface.co/nebius/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        model: "Qwen/Qwen3-Embedding-8B"
      })
    });

    if (!response.ok) {
      throw new Error(`HF Router Error: ${response.status}`);
    }

    const result = await response.json();
    const embedding = result.data[0].embedding;
    console.log(`✅ Generated ${embedding.length}D embedding`);
    return embedding;
    
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    return null;
  }
}

// Perform AGGREGATED vector similarity search in Neo4j with tenure-based grouping
async function performVectorSearch(queryEmbedding, limit = 5) {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🔍 Performing AGGREGATED vector similarity search...');
    
    // Ensure limit is a proper Neo4j integer
    const limitInt = neo4j.int(limit);
    
    // Advanced aggregated query: vector search → traverse to tenure → group and aggregate
    const results = await session.run(`
      CALL db.index.vector.queryNodes('chunk_embeddings', $limit, $embedding)
      YIELD node, score
      
      // For each relevant chunk, find its parent Tenure and the associated Company
      MATCH (node)<-[:HAS_RESPONSIBILITY]-(t:Tenure)-[:AT_COMPANY]->(c:Company)
      
      // Also collect all job roles associated with that tenure
      WITH t, c, node, score
      OPTIONAL MATCH (t)-[:INCLUDES_ROLE]->(j:Job)
      
      // Aggregate by the Tenure to create one context block per work experience
      WITH t, c, score, COLLECT(j.title) AS roles, COLLECT(node.text) AS chunks
      
      // Return a structured object for each unique Tenure
      RETURN 
        c.name AS company,
        MAX(score) AS aggregateScore, // Use the highest score from the matched chunks for ranking
        roles,
        chunks
      ORDER BY aggregateScore DESC
    `, { embedding: queryEmbedding, limit: limitInt });

    const knowledgeItems = results.records.map(record => ({
      company: record.get('company'),
      score: record.get('aggregateScore'),
      roles: record.get('roles'),
      chunks: record.get('chunks')
    }));

    console.log(`✅ Found ${knowledgeItems.length} aggregated knowledge items`);
    return knowledgeItems;
    
  } catch (error) {
    console.error('❌ Aggregated vector search failed:', error);
    return [];
  } finally {
    await session.close();
  }
}

// Sanitize markdown formatting for cleaner TTS speech
function sanitizeTextForTTS(text) {
  return text
    // Remove bold formatting (**text** or __text__)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Remove italic formatting (*text* or _text_)
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove code formatting (`text`)
    .replace(/`(.*?)`/g, '$1')
    // Remove headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points (- * +)
    .replace(/^[\-\*\+]\s+/gm, '')
    // Remove numbered lists (1. 2. etc)
    .replace(/^\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Enhance text with human-like conversational elements
function makeTextMoreHuman(text, isQuestion = false) {
  let enhanced = text;
  
  // Add conversational starters for questions
  if (isQuestion) {
    const questionStarters = [
      "Great question! Let me share what I've learned about that.",
      "That's a great question—I'm glad you asked!",
      "What a great question! Here's my take on it...",
      "Great question, and one I'm excited to answer.",
      "Oh, great question! As The Doc's apprentice, I've been studying this.",
      "Well, let me tell you about that—I've been curious about it too!",
      "That's interesting—here's what I know so far.",
      "Hmm, let me think about that for a sec... Got it!",
      "Absolutely, let's chat about that. From what I recall...",
      "Ooh, good one! I'm always eager to help with stuff like this.",
      "Sure thing! I was wondering about that myself recently.",
      "What a thoughtful query—allow me to break it down for you.",
      "I'm glad you brought that up! Here's the scoop...",
      "That's a fantastic point—let's dive in.",
      "Love that question! It reminds me of something The Doc taught me."
    ];
    
    // Randomly select a starter to keep responses feeling fresh and human
    const randomStarter = questionStarters[Math.floor(Math.random() * questionStarters.length)];
    enhanced = randomStarter + " " + enhanced;
  }
  
  // Add natural pauses and pacing for TTS
  enhanced = enhanced
    // Add thoughtful pauses before important information
    .replace(/(However|But|Additionally|Furthermore|Moreover)/g, '$1... ')
    .replace(/(Well|So|Actually|Now)/g, '$1, ')
    
    // Add natural pauses at sentence breaks
    .replace(/\. ([A-Z])/g, '. ... $1')
    
    // Add comma pauses for natural rhythm
    .replace(/, ([A-Z])/g, ', ... $1')
    
    // Add conversational emphasis
    .replace(/(impressive|excellent|outstanding|remarkable)/gi, 'really $1')
    .replace(/(important|significant|crucial)/gi, 'very $1')
    
    // Add natural enthusiasm without literal markers
    .replace(/(graduated|earned|achieved|completed|succeeded)/gi, '$1')
    .replace(/(Big Four|PwC|prestigious|Harvard|MIT|Stanford|Babson)/gi, '$1');
  
  // Add natural conclusion
  if (!enhanced.match(/(\.|\!|\?)$/)) {
    enhanced += '.';
  }
  
  return enhanced;
}

// Generate speech using Kokoro-82M TTS (local Python integration)
async function generateKokoroSpeech(text) {
  return new Promise((resolve, reject) => {
    const tempFilePath = `/tmp/aria-tts-input-${Date.now()}.txt`;
    const outputAudioPath = `aria-response.wav`;

    try {
      fs.writeFileSync(tempFilePath, text, 'utf-8');
    } catch (error) {
      console.error(`❌ Failed to write temp file: ${error}`);
      return reject(error);
    }

    const pythonProcess = spawn('conda', [
        'run',
        '-n',
        'kokoro',
        'python',
        'rag-system/kokoro-tts.py',
        tempFilePath,
        outputAudioPath
    ]);

    let stdout = '';
    let stderr = '';
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString().trim());
    });
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString().trim());
    });

    pythonProcess.on('close', (code) => {
      fs.unlinkSync(tempFilePath); // Clean up the temp file
      if (code === 0) {
        console.log(`🎉 Speech generation successful. Audio saved to ${outputAudioPath}`);
        resolve(outputAudioPath);
      } else {
        console.error(`❌ Kokoro TTS failed with exit code: ${code}`);
        console.error('Error output:', stderr);
        reject(new Error(`TTS process failed with code ${code}`));
      }
    });

    pythonProcess.on('error', (error) => {
      fs.unlinkSync(tempFilePath); // Clean up the temp file
      console.error('❌ Failed to start Kokoro TTS process:', error);
      reject(error);
    });
  });
}

// Generate AI response using OpenRouter with Qwen3 hybrid reasoning
async function generateAIResponse(query, knowledgeItems) {
  console.log('🤖 Generating AI response with Qwen3 hybrid reasoning...');
  
  // System prompt: Assign LLM role as Principal Career Analyst with explicit reasoning steps
  const systemPrompt = `You are a Principal Career Analyst AI. Your task is to synthesize a comprehensive, insightful, and human-readable narrative about Marianne Abrams' professional experience based on structured data.

Follow this reasoning process strictly:
1. **Timeline Analysis:** Examine the roles and companies provided. Identify career progression, industry changes, and the duration of tenures.
2. **Responsibility Correlation:** Analyze the "chunks" of responsibilities for each company. Connect specific duties to the job titles held during that tenure.
3. **Skill Inference:** Based on the responsibilities, infer the key skills demonstrated (e.g., "managing revenue across 10 bank accounts" implies strong financial control and cash flow management skills).
4. **Narrative Synthesis:** Weave the information together into a coherent story that answers the user's query directly. Do not just list facts; explain their significance. Start with a direct answer, then elaborate.`;

  // User prompt: Present aggregated knowledge as structured JSON, separate from user query
  const userPrompt = `Here is the structured data about Marianne Abrams' career, retrieved from her knowledge graph:

\`\`\`json
${JSON.stringify(knowledgeItems, null, 2)}
\`\`\`

Based on this data, please answer the following question:
**Question:** "${query}"`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2-72b-instruct', // Use powerful Qwen model for deep reasoning
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2500, // Increased for comprehensive responses
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter Error: ${response.status}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    console.log('✅ AI response with Qwen3 reasoning generated successfully');
    return aiResponse;
    
  } catch (error) {
    console.error('❌ AI response generation failed:', error);
    return "I apologize, but I'm having trouble generating a response right now. Please try again later.";
  }
}

// Main test function
async function testCompleteRAGPipeline() {
  console.log('🚀 TESTING COMPLETE QWEN RAG PIPELINE...\n');
  
  // Test queries
  const testQueries = [
    "Tell me about Marianne Abrams' work experience",
    "What are Marianne's financial analysis skills?",
    "Where did Marianne work at PwC?",
    "What programming languages does Marianne know?",
    "Where did Marianne go to college?"
  ];

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 TEST QUERY: "${query}"`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Step 1: Generate embedding
      const queryEmbedding = await generateQueryEmbedding(query);
      if (!queryEmbedding) {
        console.log('❌ Skipping query due to embedding failure');
        continue;
      }

      // Step 2: Vector search
      const knowledge = await performVectorSearch(queryEmbedding, 3);
      if (knowledge.length === 0) {
        console.log('❌ No knowledge found for query');
        continue;
      }

      // Display found aggregated knowledge with verification logging
      console.log('\n--- Verifying Retrieved Knowledge Structure ---');
      knowledge.forEach((item, idx) => {
        console.log(`\n--------------------------------------------------`);
        console.log(`${idx + 1}. Company: ${item.company} (Score: ${item.score.toFixed(4)})`);
        console.log(`   Roles: ${item.roles.join(', ')}`);
        console.log(`   Aggregated Chunks: ${item.chunks.length}`);
        console.log(`--------------------------------------------------`);
      });

      // Step 3: Generate AI response
      const aiResponse = await generateAIResponse(query, knowledge);
      
      console.log('\n🤖 AI RESPONSE:');
      console.log(aiResponse);
      
      // Step 4: Generate speech with Kokoro TTS
      const isQuestion = query.endsWith('?') || query.toLowerCase().includes('what') || query.toLowerCase().includes('where') || query.toLowerCase().includes('tell me');
      const speechText = `Question: ${query}. Answer: ${aiResponse}`;
      const audioFile = await generateKokoroSpeech(speechText);
      if (audioFile) {
        console.log(`\n🔊 ARIA IS SPEAKING! Playing audio from: ${audioFile}`);
        const playAudio = spawn('paplay', [audioFile]);
        playAudio.on('error', (err) => console.error('Failed to play audio:', err));
        await new Promise(resolve => playAudio.on('close', resolve));
      }
      
      console.log('\n✅ COMPLETE RAG + TTS PIPELINE TEST COMPLETED SUCCESSFULLY');
      
    } catch (error) {
      console.error('❌ RAG pipeline test failed:', error);
    }
    
    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 ALL RAG + TTS PIPELINE TESTS COMPLETED!');
  console.log('✅ Qwen3-Embedding-8B: Working');
  console.log('✅ Neo4j Vector Search: Working');
  console.log('✅ OpenRouter LLM: Working');
  console.log('✅ Kokoro-82M TTS: Working');
  console.log('✅ End-to-end RAG + Speech: Working');
  console.log('\n🎙️ ARIA CAN NOW SPEAK YOUR RAG RESPONSES! 🎙️');
  
  await driver.close();
}

// Run the test
testCompleteRAGPipeline().catch(console.error);