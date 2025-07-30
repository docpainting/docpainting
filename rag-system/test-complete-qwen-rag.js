// test-complete-qwen-rag.js
// Complete end-to-end RAG pipeline test with Qwen3-Embedding-8B

const neo4j = require('neo4j-driver');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
require('dotenv').config();

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
  neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD)
);

// Ensure the insight vector index exists
async function ensureInsightIndex(driver) {
  const session = driver.session();
  try {
    await session.run(`
      CREATE VECTOR INDEX \`insight_embeddings\` IF NOT EXISTS
      FOR (i:Insight) ON (i.embedding)
      OPTIONS { indexConfig: {
        \`vector.dimensions\`: 4096,
        \`vector.similarity_function\`: 'cosine'
      }}
    `);
    console.log('✅ Insight vector index ready');
  } catch (error) {
    console.log('⚠️ Insight index may already exist:', error.message);
  } finally {
    await session.close();
  }
}

// Generate query embedding using an OpenAI-compatible endpoint
async function generateQueryEmbedding(query) {
  try {
    console.log(`🔍 Generating embedding for query: "${query}"`);

    // The error log confirms the API requires this specific OpenAI format.
    const payload = {
      input: [query], // 'input' must be an array of strings.
      model: process.env.HF_EMBEDDING_MODEL // 'model' is required.
    };
    
    const response = await fetch(process.env.HF_EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`, // NOTE: Some OpenAI-compatible endpoints use 'OPENROUTER_API_KEY'
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error: ${response.status}. Body: ${errorBody}`);
    }

    const result = await response.json();
    
    // This API returns data in an OpenAI structure: { data: [{ embedding: [...] }] }
    const embedding = result.data[0].embedding;

    if (!Array.isArray(embedding)) {
      console.error("API response is not in the expected OpenAI format:", result);
      throw new Error("Failed to parse embedding from API response.");
    }
    
    console.log(`✅ Generated ${embedding.length}D embedding`);
    return embedding;
    
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    return null;
  }
}

// LOGIC-SAFE semantic search with validation and graceful degradation
async function performSemanticSearch(driver, queryEmbedding, limit = 8) {
  const session = driver.session();
  try {
    console.log('🧐 Performing LOGIC-SAFE semantic search over reasoning memory...');
    
    // VALIDATION: Check if insight_embeddings index exists
    try {
      await session.run(`CALL db.index.vector.queryNodes('insight_embeddings', 1, $embedding) YIELD node WITH * LIMIT 1 RETURN node`, 
        { embedding: queryEmbedding });
      console.log('✅ insight_embeddings index confirmed');
    } catch (indexError) {
      console.log('⚠️ insight_embeddings index not found, no cached insights available');
      return [];
    }
    
    // IMPROVED: Direct query without redundant MATCH (vector query already returns Insight nodes)
    const result = await session.run(`
      CALL db.index.vector.queryNodes('insight_embeddings', $limit, $embedding)
      YIELD node, score
      
      // SAFE: Add validation that node is actually an Insight (defensive programming)
      WHERE node:Insight
      
      // Extract insight data with safe property access
      RETURN 
        COALESCE(node.insightText, node.text, 'No insight text') as text, 
        COALESCE(node.sourceQuery, 'Unknown query') as sourceQuery,
        COALESCE(node.topics, []) as topics,
        COALESCE(node.primaryTopic, node.topic, 'general') as topic,
        score,
        node.createdAt as createdAt
      ORDER BY score DESC
    `, { embedding: queryEmbedding, limit: neo4j.int(limit) });

    const insights = result.records.map(record => ({
      text: record.get('text'),
      sourceQuery: record.get('sourceQuery'),
      topics: record.get('topics'),
      topic: record.get('topic'),
      score: record.get('score'),
      createdAt: record.get('createdAt')
    }));

    console.log(`🧐 Found ${insights.length} logic-safe semantic insights`);
    if (insights.length > 0) {
      console.log(`   Most relevant: "${insights[0].text.substring(0, 80)}..." (score: ${insights[0].score?.toFixed(3)})`);
    }
    
    return insights;
    
  } catch (error) {
    console.error('❌ Semantic search failed:', error);
    console.log('🔄 Graceful degradation: returning empty insights array');
    // Return empty array instead of crashing the pipeline
    return [];
  } finally {
    await session.close();
  }
}

// LOGIC-SAFE structural search with improved aggregation and validation
async function performStructuralSearch(driver, queryEmbedding, limit = 20) {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🔍 Performing LOGIC-SAFE aggregated vector similarity search...');
    
    // ENSURE EMBEDDING IS F64 COMPATIBLE FOR NEO4J
    const f64Embedding = queryEmbedding.map(val => Number(val));
    
    // VALIDATION: Check if chunk_embeddings index exists
    try {
      console.log('🔍 DEBUG: Testing chunk_embeddings index with embedding:', {
        embeddingLength: f64Embedding.length,
        embeddingType: typeof f64Embedding[0],
        firstValues: f64Embedding.slice(0, 3)
      });
      
      const validationResult = await session.run(`CALL db.index.vector.queryNodes('chunk_embeddings', 1, $embedding) YIELD node WITH * LIMIT 1 RETURN node`, 
        { embedding: f64Embedding });
        
      console.log('✅ chunk_embeddings index confirmed - validation query returned:', validationResult.records.length, 'records');
    } catch (indexError) {
      console.log('❌ DEBUG: chunk_embeddings validation failed with error:');
      console.log('   Error type:', indexError.constructor.name);
      console.log('   Error message:', indexError.message);
      console.log(`⚠️ chunk_embeddings index not found or query failed, falling back to empty results`);
      return [];
    }
    
    // Ensure limit is a proper Neo4j integer
    const limitInt = neo4j.int(limit);
    
    // ENHANCED: Proper aggregation query that groups chunks by company for meaningful insights
    const results = await session.run(`
      // 1. Find the top N most relevant chunks using the vector index
      CALL db.index.vector.queryNodes('chunk_embeddings', $limit, $embedding)
      YIELD node AS chunk, score
      
      // 2. For each chunk, optionally find its associated company and roles
      OPTIONAL MATCH (chunk)<-[:HAS_RESPONSIBILITY]-(t:Tenure)-[:AT_COMPANY]->(c:Company)
      OPTIONAL MATCH (t)-[:INCLUDES_ROLE]->(j:Job)
      
      // 3. Aggregate by company to group related chunks together
      WITH COALESCE(c.name, 'Uncategorized Experience') AS company,
           COLLECT({text: chunk.text, score: score}) AS chunkDetails,
           COLLECT(DISTINCT j.title) AS roles
      
      // 4. Calculate final aggregated metrics for each company group
      WITH company,
           roles,
           chunkDetails,
           size(chunkDetails) AS chunkCount,
           // Safely calculate avg and max scores from the collected details
           REDUCE(s = 0.0, d IN chunkDetails | s + d.score) / size(chunkDetails) AS avgScore,
           REDUCE(s = 0.0, d IN chunkDetails | CASE WHEN d.score > s THEN d.score ELSE s END) AS maxScore
      
      // 5. Calculate a final weighted score and return the structured object
      RETURN
          company,
          (maxScore * 0.7) + (avgScore * 0.3) AS aggregateScore, // Weighted score for better ranking
          roles,
          [d IN chunkDetails | d.text] AS chunks, // Extract just the text for the final chunks array
          chunkCount,
          avgScore,
          maxScore
      ORDER BY aggregateScore DESC
    `, { embedding: f64Embedding, limit: limitInt });

    const knowledgeItems = results.records.map(record => ({
      company: record.get('company'),
      aggregateScore: record.get('aggregateScore'),
      roles: record.get('roles'),
      chunks: record.get('chunks'),
      chunkCount: record.get('chunkCount'),
      avgScore: record.get('avgScore'),
      maxScore: record.get('maxScore')
    }));

    console.log(`🏢 Found ${knowledgeItems.length} logic-safe structural knowledge items`);
    knowledgeItems.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.company}: ${item.chunkCount} chunks, avg=${item.avgScore?.toFixed(3)}, max=${item.maxScore?.toFixed(3)}, final=${item.aggregateScore?.toFixed(3)}`);
    });
    
    return knowledgeItems;
    
  } catch (error) {
    console.error('❌ Structural search failed:', error);
    console.log('🔄 Attempting graceful degradation...');
    // Return empty array instead of crashing the entire pipeline
    return [];
  } finally {
    await session.close();
  }
}

// LEGACY: Keep for backward compatibility (will be removed after hybrid implementation)
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
      // FIX: Simplify aggregation to avoid complex grouping issues
      WITH c.name AS company, 
           MAX(score) AS aggregateScore,
           COLLECT(DISTINCT j.title) AS roles, 
           COLLECT(node.text) AS chunks,
           COUNT(node) AS chunkCount,
           AVG(score) AS avgScore
      
      // Return a structured object for each company/tenure
      RETURN 
        company,
        aggregateScore,
        roles,
        chunks,
        chunkCount,
        avgScore,
        aggregateScore AS maxScore
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
  }
}

// ROBUST hybrid retrieval with graceful degradation and correct signature
// FIX: The function now accepts `query` and `queryEmbedding` as arguments
async function performHybridRetrieval(driver, query, queryEmbedding) {
  console.log('🔄 Performing ROBUST hybrid retrieval (semantic + structural)...');
  
  try {
    // FIX: REMOVE the redundant call to generateQueryEmbedding. We already have it.
    // const queryEmbedding = await generateQueryEmbedding(query); 
    
    if (!queryEmbedding) {
      console.log('⚠️ Invalid query embedding provided, using empty context');
      return { semanticInsights: [], graphFacts: [], fallbackUsed: true };
    }
    
    // ROBUST: Run searches with individual error handling (no all-or-nothing failure)
    let semanticInsights = [];
    let graphFacts = [];
    
    // Semantic search with individual error handling
    try {
      console.log('🧐 Attempting semantic search...');
      semanticInsights = await performSemanticSearch(driver, queryEmbedding, 8);
      console.log(`✅ Semantic search: ${semanticInsights.length} insights retrieved`);
    } catch (semanticError) {
      console.log(`⚠️ Semantic search failed, continuing with structural only: ${semanticError.message}`);
      semanticInsights = [];
    }
    
    // Structural search with individual error handling  
    try {
      console.log('🏢 Attempting structural search...');
      graphFacts = await performStructuralSearch(driver, queryEmbedding, 20);
      console.log(`✅ Structural search: ${graphFacts.length} graph facts retrieved`);
    } catch (structuralError) {
      console.log(`⚠️ Structural search failed, continuing with semantic only: ${structuralError.message}`);
      graphFacts = [];
    }
    
    // VALIDATION: Ensure we have at least some data
    const totalResults = semanticInsights.length + graphFacts.length;
    if (totalResults === 0) {
      console.log('⚠️ No results from either search, using fallback context');
      return {
        semanticInsights: [],
        graphFacts: [],
        fallbackUsed: true,
        query: query
      };
    }
    
    const hybridContext = {
      semanticInsights,
      graphFacts,
      hasInsights: semanticInsights.length > 0,
      hasFacts: graphFacts.length > 0,
      totalResults: totalResults,
      contextBalance: {
        semanticRatio: totalResults > 0 ? semanticInsights.length / totalResults : 0,
        structuralRatio: totalResults > 0 ? graphFacts.length / totalResults : 0
      }
    };
    
    // Enhanced dynamic prompting based on context balance
    console.log(`🧠 Robust hybrid context created:`);
    console.log(`   🧐 Semantic insights: ${semanticInsights.length}`);
    console.log(`   🏢 Graph facts: ${graphFacts.length}`);
    console.log(`   📊 Context balance: ${(hybridContext.contextBalance.semanticRatio * 100).toFixed(1)}% insights, ${(hybridContext.contextBalance.structuralRatio * 100).toFixed(1)}% facts`);
    
    if (semanticInsights.length > graphFacts.length) {
      console.log('📚 Insight-heavy context: Focus on synthesis and validation');
    } else if (graphFacts.length > semanticInsights.length) {
      console.log('📊 Fact-heavy context: Focus on analysis and insight generation');
    } else {
      console.log('⚖️ Balanced context: Full hybrid reasoning available');
    }
    
    return hybridContext;
    
  } catch (error) {
    console.error('❌ Hybrid retrieval completely failed:', error);
    console.log('🔄 Using emergency fallback context');
    // Return minimal context instead of crashing the entire pipeline
    return {
      semanticInsights: [],
      graphFacts: [],
      emergencyFallback: true,
      error: error.message,
      query: query
    };
  }
}

// Extract only the Narrative Synthesis section for TTS - ENHANCED for guided reasoning responses
function extractNarrativeSynthesis(fullResponse) {
  console.log(`📝 DEBUG: Full response length: ${fullResponse.length} chars`);
  console.log(`📝 DEBUG: Response preview: ${fullResponse.substring(0, 200)}...`);
  
  // PATTERN 1: Look for "## Narrative Synthesis" section (guided reasoning format)
  let narrativeMatch = fullResponse.match(/##\s*Narrative Synthesis[^\n]*\n([\s\S]*?)(?=\n##|\n---\n|$)/i);
  
  if (narrativeMatch && narrativeMatch[1] && narrativeMatch[1].trim().length > 100) {
    let narrative = narrativeMatch[1].trim();
    
    // Clean up validation indicators and score markers
    narrative = narrative.replace(/^[✅⚠️❌\s]*\(Score:[^\)]+\)[\s\n]*/i, '').trim();
    narrative = narrative.replace(/^\*Issues:[^\n]*\n/gmi, '').trim();
    
    console.log(`📝 DEBUG: Found Narrative Synthesis section (${narrative.length} chars): ${narrative.substring(0, 100)}...`);
    return narrative;
  }
  
  // PATTERN 2: Look for the last section/step in guided reasoning (often contains the answer)
  const stepSections = fullResponse.split(/##\s*(?:Timeline|Responsibility|Skill|Narrative)/i);
  if (stepSections.length > 1) {
    const lastSection = stepSections[stepSections.length - 1];
    if (lastSection && lastSection.trim().length > 100) {
      let cleanedSection = lastSection
        .replace(/^[\s\n]*[✅⚠️❌]*\s*\(Score:[^\)]+\)[\s\n]*/i, '')
        .replace(/^\*Issues:[^\n]*\n/gmi, '')
        .trim();
      
      console.log(`📝 DEBUG: Using last reasoning section (${cleanedSection.length} chars): ${cleanedSection.substring(0, 100)}...`);
      return cleanedSection;
    }
  }
  
  // PATTERN 3: Find substantial paragraphs with actual content (not headers)
  // Use the longest meaningful paragraph as it likely contains the most complete answer
  const meaningfulParagraphs = fullResponse
    .split('\n\n')
    .filter(p => {
      const clean = p.trim();
      return clean.length > 100 && 
             !clean.startsWith('##') && 
             !clean.startsWith('#') &&
             !clean.match(/^[\s]*(?:Timeline|Responsibility|Skill|Narrative)/i) &&
             !clean.match(/^[\s]*\*\*(?:Step|Query|DEBUG)/i);
    });
  
  if (meaningfulParagraphs.length > 0) {
    const longestParagraph = meaningfulParagraphs.reduce((a, b) => a.length > b.length ? a : b);
    console.log(`📝 DEBUG: Using longest meaningful paragraph (${longestParagraph.length} chars): ${longestParagraph.substring(0, 100)}...`);
    return longestParagraph;
  }
  
  // PATTERN 4: Final fallback - use the latter half of the response (skip headers/metadata)
  const responseLength = fullResponse.length;
  if (responseLength > 400) {
    const latterHalf = fullResponse.substring(Math.floor(responseLength * 0.4)); // Skip first 40%
    console.log(`📝 DEBUG: Using latter half fallback (${latterHalf.length} chars): ${latterHalf.substring(0, 100)}...`);
    return latterHalf;
  }
  
  console.log('⚠️ DEBUG: No substantial narrative found, using full response');
  return fullResponse;
}

// Sanitize markdown and formatting for TTS
function sanitizeTextForTTS(text) {
  return text
    // AGGRESSIVE: Remove ALL hash symbols and markdown headers
    .replace(/#+\s*/g, '')  // Remove any # symbols with optional spaces
    .replace(/^#{1,6}\s+/gm, '')  // Remove markdown headers at line start
    .replace(/##\s*Narrative Synthesis[^\n]*/gi, '')  // Remove specific header
    .replace(/##\s*Timeline Analysis[^\n]*/gi, '')
    .replace(/##\s*Responsibility Correlation[^\n]*/gi, '')
    .replace(/##\s*Skill Inference[^\n]*/gi, '')
    
    // Remove markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    
    // Remove horizontal rules and formatting
    .replace(/^---+$/gm, '')
    .replace(/\*\*+/g, '')
    .replace(/\*+(?!\w)/g, '')
    
    // Remove bullet points and list markers
    .replace(/^\s*[•\-\*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    
    // Remove validation indicators and scores
    .replace(/✅|⚠️|❌/g, '')
    .replace(/\(Score:[^\)]+\)/g, '')
    .replace(/\*Issues:[^\n]*/gi, '')
    
    // Clean up remaining formatting artifacts
    .replace(/##+/g, '')  // Remove any remaining hashes
    .replace(/---+/g, '')
    .replace(/\\n/g, ' ')  // Convert escaped newlines to spaces
    
    // Remove extra whitespace and clean up
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')  // Multiple spaces to single space
    .replace(/^\s+|\s+$/g, '')
    .trim();
}

// Generate speech using Kokoro-82M TTS (local Python integration)
async function generateKokoroSpeech(text) {
  return new Promise((resolve, reject) => {
    // Clean the text before TTS
    const cleanText = sanitizeTextForTTS(text);
    console.log(`🧹 DEBUG: Text sanitized from ${text.length} to ${cleanText.length} characters`);
    
    const tempFilePath = `/tmp/aria-tts-input-${Date.now()}.txt`;
    const outputAudioPath = `aria-response.wav`;

    try {
      fs.writeFileSync(tempFilePath, cleanText, 'utf-8');
    } catch (error) {
      console.error(`❌ Failed to write temp file: ${error}`);
      return reject(error);
    }

    const pythonScriptPath = path.join(__dirname, 'kokoro-tts.py');
    console.log(`🐍 DEBUG: Python script path: ${pythonScriptPath}`);
    
    // Use the kokoro conda environment
    const pythonProcess = spawn('conda', [
        'run',
        '-n',
        'kokoro',
        'python',
        pythonScriptPath,
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

// === INSIGHT PROCESSING UTILITIES ===

// Extract condensed insight from full AI response
function extractKeyInsight(fullResponse) {
  // OPTION 1: Try to extract from Narrative Synthesis section first (most refined insight)
  const narrative = extractNarrativeSynthesis(fullResponse);
  if (narrative && narrative !== fullResponse && narrative.length > 50) {
    // Clean and truncate narrative to create a focused insight
    let cleanNarrative = narrative.replace(/^[\s\n]+|[\s\n]+$/g, ''); // Trim whitespace
    
    // Extract first 2-3 sentences from narrative as the key insight
    const narrativeSentences = cleanNarrative.match(/[^.!?]+[.!?]+/g) || [];
    const keyInsight = narrativeSentences.slice(0, 2).join(' ').trim();
    
    if (keyInsight.length > 30) {
      console.log('📝 DEBUG: Extracted insight from Narrative Synthesis section');
      return keyInsight;
    }
  }
  
  // FALLBACK: Use original logic for non-structured responses
  console.log('📝 DEBUG: Falling back to sentence-based insight extraction');
  
  // Remove conversational starters added by makeTextMoreHuman
  let cleanResponse = fullResponse;
  
  // Remove common conversational starters
  const starterPatterns = [
    /^(Great question[^.!?]*[.!?]\s*)+/i,
    /^(That's a [^.!?]*[.!?]\s*)+/i,
    /^(What a [^.!?]*[.!?]\s*)+/i,
    /^(Oh, [^.!?]*[.!?]\s*)+/i,
    /^(Well, [^.!?]*[.!?]\s*)+/i,
    /^(Hmm, [^.!?]*[.!?]\s*)+/i
  ];
  
  starterPatterns.forEach(pattern => {
    cleanResponse = cleanResponse.replace(pattern, '');
  });
  
  // Extract first 2-3 meaningful sentences as condensed insight
  const sentences = cleanResponse.match(/[^.!?]+[.!?]+/g) || [];
  const meaningfulSentences = sentences.filter(s => 
    s.trim().length > 20 && // Filter out very short sentences
    !s.match(/^(Let me|Here's|I'll|Allow me)/i) // Filter out transition phrases
  );
  
  // Return first 2 sentences as condensed insight
  const insight = meaningfulSentences.slice(0, 2).join(' ').trim();
  return insight || fullResponse.substring(0, 200) + '...'; // Fallback to truncation
}

// Extract semantic topics from query and response
function extractSemanticTopics(query, response) {
  const lowerQuery = query.toLowerCase();
  const lowerResponse = response.toLowerCase();
  
  // OPTION 2: Enhanced topic mappings with both career-specific and generic categories
  const topicMappings = {
    // Career-specific topics (original)
    'career_progression': {
      keywords: ['career', 'progression', 'growth', 'advancement', 'evolution', 'development', 'promotion'],
      priority: 1
    },
    'leadership_skills': {
      keywords: ['leadership', 'lead', 'manage', 'team', 'supervisor', 'director', 'vp', 'management'],
      priority: 1
    },
    'education_background': {
      keywords: ['education', 'school', 'college', 'university', 'degree', 'academic', 'studied', 'graduated'],
      priority: 2
    },
    'technical_expertise': {
      keywords: ['technical', 'technology', 'skill', 'expertise', 'programming', 'systems', 'software', 'tools'],
      priority: 2
    },
    'business_acumen': {
      keywords: ['business', 'strategy', 'consulting', 'analysis', 'finance', 'economics', 'revenue', 'profit'],
      priority: 2
    },
    'teaching_experience': {
      keywords: ['teaching', 'professor', 'instructor', 'education', 'academic', 'curriculum', 'students'],
      priority: 3
    },
    
    // Generic topics (new for broader insights)
    'general_knowledge': {
      keywords: ['information', 'data', 'facts', 'details', 'overview', 'summary', 'background'],
      priority: 4
    },
    'comparative_analysis': {
      keywords: ['compare', 'comparison', 'versus', 'vs', 'difference', 'similarities', 'contrast'],
      priority: 3
    },
    'problem_solving': {
      keywords: ['problem', 'solution', 'solve', 'challenge', 'issue', 'resolution', 'approach'],
      priority: 3
    },
    'timeline_analysis': {
      keywords: ['timeline', 'chronology', 'sequence', 'progression', 'history', 'dates', 'years'],
      priority: 3
    },
    'skills_assessment': {
      keywords: ['skills', 'abilities', 'competencies', 'proficiency', 'expertise', 'knowledge', 'capabilities'],
      priority: 2
    },
    'project_experience': {
      keywords: ['project', 'projects', 'initiative', 'work', 'assignment', 'task', 'responsibility'],
      priority: 3
    },
    'industry_knowledge': {
      keywords: ['industry', 'sector', 'field', 'domain', 'market', 'business', 'commercial'],
      priority: 3
    },
    'personal_attributes': {
      keywords: ['personality', 'character', 'traits', 'qualities', 'strengths', 'values', 'attributes'],
      priority: 4
    }
  };
  
  // Score topics based on keyword matches
  const topicScores = {};
  Object.entries(topicMappings).forEach(([topic, config]) => {
    let score = 0;
    config.keywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) score += 2; // Query matches are more important
      if (lowerResponse.includes(keyword)) score += 1;
    });
    if (score > 0) {
      topicScores[topic] = score * (4 - config.priority); // Priority weighting
    }
  });
  
  // Return top 2 topics sorted by score
  const sortedTopics = Object.entries(topicScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([topic]) => topic);
    
  return sortedTopics.length > 0 ? sortedTopics : ['general'];
}

// Create semantic mapping between storage concepts and reasoning concepts
function createSemanticMapping() {
  return {
    // Node label mappings
    'Institution': {
      reasoningConcepts: ['school', 'college', 'university', 'educational institution', 'academic institution'],
      contextualHints: ['academic', 'educational', 'learning', 'study']
    },
    'Company': {
      reasoningConcepts: ['employer', 'organization', 'firm', 'business', 'corporation', 'company'],
      contextualHints: ['work', 'career', 'professional', 'employment']
    },
    'Job': {
      reasoningConcepts: ['role', 'position', 'title', 'responsibility', 'job', 'career role'],
      contextualHints: ['responsibilities', 'duties', 'tasks', 'work']
    },
    'Tenure': {
      reasoningConcepts: ['work experience', 'employment period', 'career stage', 'professional experience'],
      contextualHints: ['during', 'while working', 'experience at']
    },
    'Skill': {
      reasoningConcepts: ['ability', 'expertise', 'competency', 'proficiency', 'capability'],
      contextualHints: ['skilled in', 'expert at', 'proficient in']
    }
  };
}

// Extract source node information for evidence linking
function extractSourceNodeInfo(hybridContext) {
  const sourceInfo = {
    chunkIds: [],
    tenureIds: [],
    companyNames: [],
    institutionNames: [],
    personName: 'Marianne Abrams' // Static for now, could be dynamic
  };
  
  // Extract from graph facts (structural search results)
  if (hybridContext.graphFacts) {
    hybridContext.graphFacts.forEach(fact => {
      if (fact.company) sourceInfo.companyNames.push(fact.company);
      // Note: We'll need to enhance this to capture actual node IDs
      // For now, we work with available data structure
    });
  }
  
  // Remove duplicates
  sourceInfo.companyNames = [...new Set(sourceInfo.companyNames)];
  
  return sourceInfo;
}

// ENHANCED: Mode-specific configuration with Qwen3 model update
const MODE_CONFIGURATIONS = {
  SYNTHESIS: {
    temperature: 0.4,      // Lower for consistency
    max_tokens: 2000,      // Shorter for focused synthesis
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-235b-a22b-07-25:free', // Use .env model
    description: 'Validate and expand on previous insights using fresh evidence',
    validationWeight: 0.9   // High validation for consistency
  },
  
  ANALYSIS: {
    temperature: 0.7,      // Higher for creative insights
    max_tokens: 2500,      // Longer for exploration
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-235b-a22b-07-25:free', // Use .env model
    description: 'Generate fresh insights from new data',
    validationWeight: 0.8
  },
  
  INSIGHT_HEAVY: {
    temperature: 0.3,      // Very focused
    max_tokens: 1800,      // Concise synthesis
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-235b-a22b-07-25:free', // Use .env model
    description: 'Build upon and validate previous analysis',
    validationWeight: 0.95  // Highest validation
  },
  
  GENERAL: {
    temperature: 0.6,
    max_tokens: 2200,
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-235b-a22b-07-25:free', // Use .env model
    description: 'Provide comprehensive analysis',
    validationWeight: 0.7
  }
};

function getModeConfiguration(reasoningMode, hybridContext) {
  console.log(`⚙️ Getting configuration for ${reasoningMode} mode...`);
  
  const config = MODE_CONFIGURATIONS[reasoningMode] || MODE_CONFIGURATIONS.GENERAL;
  
  // Calculate data complexity based on available data
  const factsCount = hybridContext.graphFacts?.length || 0;
  const insightsCount = hybridContext.semanticInsights?.length || 0;
  const dataComplexity = Math.min(1.0, (factsCount + insightsCount) / 20); // Normalize to 0-1
  
  // Adjust for data complexity
  const adjustedConfig = {
    ...config,
    max_tokens: dataComplexity > 0.8 ? Math.min(config.max_tokens + 500, 3000) : config.max_tokens,
    temperature: dataComplexity > 0.8 ? Math.max(config.temperature - 0.1, 0.1) : config.temperature,
    dataComplexity: dataComplexity
  };
  
  console.log(`📋 Mode configuration:`, {
    mode: reasoningMode,
    model: adjustedConfig.model,
    temperature: adjustedConfig.temperature,
    max_tokens: adjustedConfig.max_tokens,
    dataComplexity: dataComplexity.toFixed(2)
  });
  
  return adjustedConfig;
}

// Query type detection for response mode selection
function detectQueryType(query) {
  const lowerQuery = query.toLowerCase();
  
  // Simple factual question patterns
  const factualPatterns = [
    /^(where|when|what|who|which|how many|how much)\s+(did|does|is|are|was|were|has|have)\s+/,
    /^(what's|where's|when's|who's)/,
    /(study|studied|education|school|college|university)/,
    /(work|worked|job|position|role|company)/,
    /(live|lives|lived|location|address)/,
    /^(tell me about|what about)\s+\w+\s+(education|job|work|school)/
  ];
  
  // Complex analytical patterns  
  const analyticalPatterns = [
    /(how did|why did|what led to|what caused)/,
    /(analyze|analysis|compare|comparison|evaluate)/,
    /(skills|capabilities|strengths|expertise|progression|development)/,
    /(career path|professional journey|growth|evolution)/,
    /(strategy|approach|methodology|framework)/
  ];
  
  const isFactual = factualPatterns.some(pattern => pattern.test(lowerQuery));
  const isAnalytical = analyticalPatterns.some(pattern => pattern.test(lowerQuery));
  
  // Default to analytical for ambiguous cases
  return isFactual && !isAnalytical ? 'FACTUAL' : 'ANALYTICAL';
}

// Generate AI response using OpenRouter with Qwen3 hybrid reasoning
async function generateAIResponse(query, hybridContext) {
  console.log('🤖 Generating AI response with Qwen3 hybrid reasoning...');
  
  // DEBUG: Log the hybrid context to see what's being passed
  console.log('🔍 DEBUG: Hybrid context received:', {
    hasSemanticInsights: hybridContext.semanticInsights?.length || 0,
    hasGraphFacts: hybridContext.graphFacts?.length || 0,
    graphFactsSample: hybridContext.graphFacts?.slice(0, 2),
    contextKeys: Object.keys(hybridContext)
  });
  
  // Detect query type for response mode
  const queryType = detectQueryType(query);
  console.log('🎯 DEBUG: Query type detected:', queryType);
  
  // Determine context type for dynamic prompting
  const hasInsights = hybridContext.semanticInsights && hybridContext.semanticInsights.length > 0;
  const hasFacts = hybridContext.graphFacts && hybridContext.graphFacts.length > 0;
  
  console.log('🔍 DEBUG: Context flags:', { hasInsights, hasFacts });
  
  // DEBUG: Determine reasoning mode with explicit logging
  let reasoningMode = 'GENERAL';
  
  if (hasInsights && hasFacts) {
    reasoningMode = 'SYNTHESIS';
  } else if (hasInsights && !hasFacts) {
    reasoningMode = 'INSIGHT_HEAVY';
  } else if (!hasInsights && hasFacts) {
    reasoningMode = 'ANALYSIS';
  }
  
  console.log('🎯 DEBUG: Reasoning mode selected:', reasoningMode);
  
  // ENHANCED: Mode-specific configuration
  const modeConfig = getModeConfiguration(reasoningMode, hybridContext);
  
  // Dynamic system prompt based on query type
  const systemPrompt = queryType === 'FACTUAL' ? 
    `You are Aria, a knowledgeable assistant specializing in Marianne Abrams' professional background.

**RESPONSE MODE: CONCISE FACTUAL**

For the question: "${query}"

Provide a direct, concise answer in 1-3 sentences. Focus on the specific facts requested:
- Give the direct answer first
- Add brief context if helpful
- Keep total response under 100 words
- Be conversational and natural

**Examples:**
- "Where did she study?" → "Marianne studied at Babson College (BS in Business Management with Finance concentration, 3.5 GPA, Suma Cum Laude) and did study abroad at University of Paris Sorbonne."
- "Where does she work now?" → "She currently owns DOC Painting, serving the Boston and South Shore areas."
- "When was she at PwC?" → "She worked at PricewaterhouseCoopers as a Financial Analyst from 2015 to 2018."

**Current Context:** Use the provided data to give accurate, specific facts about Marianne's career, education, or experience.`
    :
    `You are a Principal Career Analyst AI specializing in Marianne Abrams' professional experience.

**RESPONSE MODE: ANALYTICAL REASONING**

**Your response MUST follow this 4-section format:**

## Timeline Analysis
[Examine roles, companies, career progression, industry changes, tenure durations]

## Responsibility Correlation  
[Connect specific duties to job titles, analyze responsibility evolution]

## Skill Inference
[Infer demonstrated skills from responsibilities with specific examples]

## Narrative Synthesis
[Weave information into coherent story answering the query directly]

**REASONING MODE: ${hasInsights && hasFacts ? 'SYNTHESIS' : hasInsights ? 'INSIGHT-HEAVY' : hasFacts ? 'ANALYSIS' : 'GENERAL'}**

**Requirements:**
- Each section addresses: "${query}"
- Use specific examples from provided data
- Minimum 50 words per section
- Start with direct answer, then elaborate

**Data Types:**
- :Institution = schools, colleges, universities  
- :Company = employers, firms, organizations
- :Job = roles, positions, responsibilities
- :Tenure = work experiences, employment periods`;

  // User prompt: Present aggregated knowledge as structured JSON,  // Enhanced user prompt: Provide both semantic insights and graph facts
  let userPrompt = '';
  
  if (hasInsights) {
    userPrompt += `**SEMANTIC INSIGHTS (Previous Analysis):**\n\n`;
    hybridContext.semanticInsights.forEach((insight, idx) => {
      userPrompt += `${idx + 1}. Topic: ${insight.topics ? insight.topics.join(', ') : insight.topic || 'general'}\n`;
      userPrompt += `   Source Query: "${insight.sourceQuery}"\n`;
      userPrompt += `   Insight: ${insight.text || insight.insightText}\n\n`;
    });
  }
  
  if (hasFacts) {
    userPrompt += `**GRAPH FACTS (Current Data):**\n\n\`\`\`json\n${JSON.stringify(hybridContext.graphFacts, null, 2)}\n\`\`\`\n\n`;
  }
  
  if (!hasInsights && !hasFacts) {
    userPrompt += `**NOTE:** No previous insights or current facts available for this query.\n\n`;
  }
  
  userPrompt += `**Current Query:** "${query}"\n\n`;
  userPrompt += `Please synthesize ${hasInsights && hasFacts ? 'both the semantic insights and graph facts' : hasInsights ? 'the available insights' : hasFacts ? 'the graph facts' : 'any available information'} to provide a comprehensive, narrative response.`;

  try {
    // ENHANCED: Reasoning process enforcement with guided steps (no redundant API call)
    console.log('🧠 Generating AI response using step-by-step reasoning process...');
    const enforcedResponse = await enforceReasoningProcessWithGuidance(query, hybridContext, modeConfig);
    
    console.log('✅ AI response with enforced reasoning structure generated successfully');
    return enforcedResponse;
    
  } catch (error) {
    console.error('❌ AI response generation failed:', error);
    return "I apologize, but I'm having trouble generating a response right now. Please try again later.";
  }
}

// ENHANCED: Reasoning process enforcement with guided steps
async function enforceReasoningProcessWithGuidance(query, hybridContext, modeConfig) {
  console.log('🧠 DEBUG: Enforcing reasoning process with step-by-step guidance...');
  
  const reasoningSteps = [
    {
      name: 'Timeline Analysis',
      instruction: 'Extract and analyze career progression systematically',
      process: buildTimelineAnalysisProcess(hybridContext, query),
      validation: validateTimelineReasoning
    },
    {
      name: 'Responsibility Correlation',
      instruction: 'Connect duties to roles with evidence-based analysis',
      process: buildResponsibilityCorrelationProcess(hybridContext, query),
      validation: validateResponsibilityReasoning
    },
    {
      name: 'Skill Inference', 
      instruction: 'Infer skills from concrete examples and evidence',
      process: buildSkillInferenceProcess(hybridContext, query),
      validation: validateSkillReasoning
    },
    {
      name: 'Narrative Synthesis',
      instruction: 'Synthesize insights into coherent answer',
      process: buildNarrativeSynthesisProcess(hybridContext, query),
      validation: validateNarrativeReasoning
    }
  ];
  
  // OPTIMIZATION: Parallelize reasoning steps for 2-4x speedup
  console.log(`🚀 DEBUG: Executing ${reasoningSteps.length} reasoning steps in parallel...`);
  
  const stepPromises = reasoningSteps.map(async (step) => {
    console.log(`🔄 DEBUG: Starting parallel reasoning step: ${step.name}...`);
    
    try {
      const stepResult = await executeGuidedReasoningStep(step, hybridContext, modeConfig, query);
      const validation = step.validation(stepResult, hybridContext, query);
      
      console.log(`📊 DEBUG: Step ${step.name} validation:`, {
        passed: validation.passed,
        score: validation.score,
        issues: validation.issues
      });
      
      return {
        ...step,
        result: stepResult,
        validation: validation,
        success: true
      };
    } catch (error) {
      console.error(`❌ ERROR: Step ${step.name} failed:`, error.message);
      return {
        ...step,
        result: `Error: ${error.message}`,
        validation: { passed: false, score: 0, issues: [`Step failed: ${error.message}`] },
        success: false,
        error: error.message
      };
    }
  });
  
  // Wait for all reasoning steps to complete in parallel
  const stepResults = await Promise.all(stepPromises);
  
  // Log parallel execution results
  const successfulSteps = stepResults.filter(r => r.success).length;
  console.log(`✅ DEBUG: Parallel execution complete: ${successfulSteps}/${stepResults.length} steps successful`);
  
  // If any critical steps failed, log warnings but continue
  const failedSteps = stepResults.filter(r => !r.success);
  if (failedSteps.length > 0) {
    console.warn(`⚠️ WARNING: ${failedSteps.length} reasoning steps failed:`, failedSteps.map(s => s.name));
  }
  
  // Synthesize final response from guided reasoning steps
  return synthesizeGuidedResponse(stepResults, query, hybridContext);
}

// REASONING PROCESS BUILDERS: Build step-specific reasoning instructions
function buildTimelineAnalysisProcess(hybridContext, query) {
  const facts = hybridContext.graphFacts || [];
  const insights = hybridContext.semanticInsights || [];
  
  return `**TIMELINE ANALYSIS REASONING PROCESS:**

**Step 1: Extract Temporal Data**
From the provided data, identify:
- All company names and employment periods
- Educational institutions and graduation dates
- Role progressions and tenure durations

**Step 2: Chronological Ordering**
Arrange all experiences in chronological order:
- Start dates and end dates for each position
- Gaps or overlaps in employment
- Career transitions and timing

**Step 3: Progression Pattern Analysis**
Analyze the career progression:
- Identify upward movement (promotions, title changes)
- Note industry or function changes
- Assess tenure lengths and stability patterns

**Step 4: Query-Specific Timeline Focus**
For the query "${query}", focus on timeline elements that directly relate to the question.

**Your task:** Follow these 4 steps systematically using the data provided. Show your reasoning for each step.`;
}

function buildResponsibilityCorrelationProcess(hybridContext, query) {
  const facts = hybridContext.graphFacts || [];
  
  return `**RESPONSIBILITY CORRELATION REASONING PROCESS:**

**Step 1: Responsibility Extraction**
From the data, extract specific responsibilities and duties for each role:
- Day-to-day activities mentioned
- Project leadership or participation
- Team management or individual contributor work

**Step 2: Role-Responsibility Mapping**
Connect responsibilities to specific job titles and companies:
- Which duties were performed in which roles?
- How did responsibilities expand or change between positions?
- What new responsibilities were added with promotions?

**Step 3: Evolution Analysis**
Trace how responsibilities evolved:
- Increasing complexity or scope
- New domains of responsibility
- Leadership vs. individual contributor responsibilities

**Step 4: Query-Specific Correlation**
For "${query}", identify which responsibility patterns are most relevant.

**Your task:** Systematically work through each step, providing evidence-based connections between roles and responsibilities.`;
}

function buildSkillInferenceProcess(hybridContext, query) {
  return `**SKILL INFERENCE REASONING PROCESS:**

**Step 1: Explicit Skill Identification**
Identify skills directly mentioned in the data:
- Technical skills (software, tools, methodologies)
- Soft skills (leadership, communication, analysis)
- Domain expertise (financial, operations, etc.)

**Step 2: Responsibility-Based Skill Inference**
Infer skills from described responsibilities:
- What skills were required to perform specific duties?
- What competencies are implied by successful role performance?
- What skills developed through experience progression?

**Step 3: Evidence-Based Skill Validation**
For each inferred skill, provide concrete evidence:
- Specific examples of skill application
- Results or outcomes that demonstrate competency
- Context showing skill development or mastery

**Step 4: Query-Relevant Skill Focus**
For "${query}", prioritize skills that directly address the question.

**Your task:** Methodically infer skills with concrete evidence, avoiding assumptions without supporting data.`;
}

function buildNarrativeSynthesisProcess(hybridContext, query) {
  return `**NARRATIVE SYNTHESIS REASONING PROCESS:**

**Step 1: Key Insight Integration**
Integrate the insights from previous analysis steps:
- Timeline patterns and career progression
- Responsibility evolution and scope expansion
- Demonstrated skills and competencies

**Step 2: Coherent Story Construction**
Weave insights into a logical narrative:
- How do the timeline, responsibilities, and skills connect?
- What themes emerge across the career progression?
- What story does the data tell about professional development?

**Step 3: Query-Specific Answer Formation**
Direct the narrative to answer "${query}" specifically:
- Which elements of the story directly address the question?
- What evidence supports the answer?
- How do multiple data points reinforce the conclusion?

**Step 4: Confidence Assessment**
Evaluate the strength of the narrative:
- What aspects are strongly supported by data?
- Where are there gaps or uncertainties?
- How confident can we be in the conclusions?

**Your task:** Create a coherent, evidence-based narrative that directly answers the query while acknowledging data limitations.`;
}

// REASONING STEP EXECUTION: Execute individual reasoning steps with guidance
async function executeGuidedReasoningStep(step, hybridContext, modeConfig, query) {
  console.log(`🔍 DEBUG: Executing guided reasoning step: ${step.name}...`);
  
  const stepPrompt = `You are performing **${step.name}** for Marianne Abrams career analysis.

**ORIGINAL QUERY TO ANSWER: "${query}"**

${step.process}

**DATA PROVIDED:**
${hybridContext.graphFacts ? `**Graph Facts:**\n${JSON.stringify(hybridContext.graphFacts.slice(0, 8), null, 2)}\n` : ''}
${hybridContext.semanticInsights ? `**Previous Insights:**\n${JSON.stringify(hybridContext.semanticInsights.slice(0, 3), null, 2)}\n` : ''}

**CRITICAL:** Follow the reasoning process systematically. Show your work for each step. Your analysis must directly relate to answering: "${query}"`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modeConfig.model,
      messages: [
        { role: 'system', content: `You are a systematic career analyst. Follow reasoning processes step-by-step.` },
        { role: 'user', content: stepPrompt }
      ],
      max_tokens: Math.min(1500, modeConfig.max_tokens), // Shorter for individual steps
      temperature: Math.max(modeConfig.temperature - 0.1, 0.2) // More focused for reasoning
    })
  });

  if (!response.ok) {
    throw new Error(`Step execution failed: ${response.status}`);
  }

  const result = await response.json();
  const stepResult = result.choices[0].message.content;
  
  console.log(`📝 DEBUG: ${step.name} result length: ${stepResult.length} characters`);
  return stepResult;
}

// REASONING VALIDATION: Validate that reasoning steps were properly executed
function validateTimelineReasoning(stepResult, hybridContext, query) {
  console.log('🔍 DEBUG: Validating timeline reasoning...');
  
  const validation = {
    passed: true,
    score: 0,
    issues: []
  };
  
  // Check for temporal analysis
  const hasTimelineElements = /\b(\d{4}|years?|from|to|during|progression|career|timeline)\b/gi.test(stepResult);
  if (!hasTimelineElements) {
    validation.issues.push('Missing temporal analysis elements');
    validation.passed = false;
  }
  
  // Check for systematic approach
  const hasSystematicApproach = /\b(step|first|second|then|next|analysis|identify|extract)\b/gi.test(stepResult);
  if (!hasSystematicApproach) {
    validation.issues.push('Does not show systematic reasoning approach');
    validation.passed = false;
  }
  
  // Check query relevance
  const queryKeywords = query.toLowerCase().split(/\s+/);
  const relevantKeywords = queryKeywords.filter(keyword => 
    stepResult.toLowerCase().includes(keyword)
  ).length;
  const relevanceScore = relevantKeywords / queryKeywords.length;
  
  if (relevanceScore < 0.3) {
    validation.issues.push(`Low query relevance: ${(relevanceScore * 100).toFixed(1)}%`);
    validation.passed = false;
  }
  
  validation.score = Math.max(0, 1 - (validation.issues.length * 0.25));
  
  console.log(`📊 DEBUG: Timeline validation score: ${validation.score.toFixed(2)}`);
  return validation;
}

function validateResponsibilityReasoning(stepResult, hybridContext, query) {
  console.log('🔍 DEBUG: Validating responsibility reasoning...');
  
  const validation = {
    passed: true,
    score: 0,
    issues: []
  };
  
  // Check for responsibility analysis
  const hasResponsibilityElements = /\b(responsibilities?|duties|tasks|role|manage|lead|perform|execute)\b/gi.test(stepResult);
  if (!hasResponsibilityElements) {
    validation.issues.push('Missing responsibility analysis');
    validation.passed = false;
  }
  
  // Check for role-responsibility connections
  const hasConnections = /\b(connect|link|correlat|relationship|between|within|across)\b/gi.test(stepResult);
  if (!hasConnections) {
    validation.issues.push('Missing role-responsibility connections');
    validation.passed = false;
  }
  
  // Check for evidence-based reasoning
  const hasEvidence = stepResult.length > 200 && /\b(evidence|example|specific|demonstrat|show)\b/gi.test(stepResult);
  if (!hasEvidence) {
    validation.issues.push('Insufficient evidence-based reasoning');
    validation.passed = false;
  }
  
  validation.score = Math.max(0, 1 - (validation.issues.length * 0.25));
  
  console.log(`📊 DEBUG: Responsibility validation score: ${validation.score.toFixed(2)}`);
  return validation;
}

function validateSkillReasoning(stepResult, hybridContext, query) {
  console.log('🔍 DEBUG: Validating skill reasoning...');
  
  const validation = {
    passed: true,
    score: 0,
    issues: []
  };
  
  // Check for skill identification
  const hasSkillElements = /\b(skills?|competenc|abilit|expertise|proficienc|knowledge)\b/gi.test(stepResult);
  if (!hasSkillElements) {
    validation.issues.push('Missing skill identification');
    validation.passed = false;
  }
  
  // Check for inference reasoning
  const hasInferenceReasoning = /\b(infer|deduce|conclude|suggest|indicat|demonstrat|implies?)\b/gi.test(stepResult);
  if (!hasInferenceReasoning) {
    validation.issues.push('Missing skill inference reasoning');
    validation.passed = false;
  }
  
  // Check for concrete examples
  const hasConcreteExamples = /\b(example|instance|case|specific|evidence|through|by)\b/gi.test(stepResult);
  if (!hasConcreteExamples) {
    validation.issues.push('Missing concrete skill examples');
    validation.passed = false;
  }
  
  validation.score = Math.max(0, 1 - (validation.issues.length * 0.25));
  
  console.log(`📊 DEBUG: Skill validation score: ${validation.score.toFixed(2)}`);
  return validation;
}

function validateNarrativeReasoning(stepResult, hybridContext, query) {
  console.log('🔍 DEBUG: Validating narrative reasoning...');
  
  const validation = {
    passed: true,
    score: 0,
    issues: []
  };
  
  // Check for synthesis elements
  const hasSynthesis = /\b(synthesis|integrat|combin|weav|connect|overall|conclusion)\b/gi.test(stepResult);
  if (!hasSynthesis) {
    validation.issues.push('Missing synthesis elements');
    validation.passed = false;
  }
  
  // Check for direct query answer
  const directlyAnswersQuery = stepResult.toLowerCase().includes(query.toLowerCase().split(' ')[0]);
  if (!directlyAnswersQuery) {
    validation.issues.push('Does not directly answer the query');
    validation.passed = false;
  }
  
  // Check for coherent narrative
  const hasNarrativeStructure = stepResult.length > 300 && /\b(story|narrative|development|progression|journey)\b/gi.test(stepResult);
  if (!hasNarrativeStructure) {
    validation.issues.push('Missing coherent narrative structure');
    validation.passed = false;
  }
  
  validation.score = Math.max(0, 1 - (validation.issues.length * 0.25));
  
  console.log(`📊 DEBUG: Narrative validation score: ${validation.score.toFixed(2)}`);
  return validation;
}

// RESPONSE SYNTHESIS: Combine validated reasoning steps into final response
function synthesizeGuidedResponse(stepResults, query, hybridContext) {
  console.log('🔄 DEBUG: Synthesizing final response from guided reasoning steps...');
  
  let finalResponse = `# Career Analysis Response for: "${query}"\n\n`;
  
  stepResults.forEach((stepResult, index) => {
    const sectionHeader = `## ${stepResult.name}`;
    let content = stepResult.result || 'Analysis not completed';
    
    // Add validation indicators
    const validationIcon = stepResult.validation.passed ? '✅' : '⚠️';
    const scoreIndicator = `(Score: ${stepResult.validation.score.toFixed(2)})`;
    
    finalResponse += `${sectionHeader} ${validationIcon} ${scoreIndicator}\n`;
    
    if (stepResult.validation.issues.length > 0) {
      finalResponse += `*Issues: ${stepResult.validation.issues.join(', ')}*\n\n`;
    }
    
    finalResponse += `${content}\n\n`;
  });
  
  // Add overall quality assessment
  const overallScore = stepResults.reduce((sum, step) => sum + step.validation.score, 0) / stepResults.length;
  const passedSteps = stepResults.filter(step => step.validation.passed).length;
  
  finalResponse += `---\n**Response Quality Assessment:**\n`;
  finalResponse += `- Overall Score: ${overallScore.toFixed(2)}/1.0\n`;
  finalResponse += `- Steps Passed: ${passedSteps}/${stepResults.length}\n`;
  
  if (overallScore < 0.7) {
    finalResponse += `\n*Note: This response may be incomplete due to reasoning validation issues. Consider refining the query or data.*`;
  }
  
  console.log(`📊 DEBUG: Final response quality - Score: ${overallScore.toFixed(2)}, Passed: ${passedSteps}/${stepResults.length}`);
  
  return finalResponse;
}

// CORRUPTION-SAFE enhanced insight storage with proper MERGE patterns
async function storeInsightEnhanced(driver, query, fullResponse, hybridContext) {
  console.log('💾 Storing enhanced insight to reasoning memory (corruption-safe)...');
  
  try {
    // Extract condensed insight using new utilities
    const condensedInsight = extractKeyInsight(fullResponse);
    const semanticTopics = extractSemanticTopics(query, fullResponse);
    const sourceInfo = extractSourceNodeInfo(hybridContext);
    
    // Generate embedding for the condensed insight (not full response)
    const insightEmbedding = await generateQueryEmbedding(condensedInsight);
    
    console.log(`📝 Condensed insight: ${condensedInsight.substring(0, 100)}...`);
    console.log(`🏷️ Semantic topics: ${semanticTopics.join(', ')}`);
    console.log(`🔗 Source companies: ${sourceInfo.companyNames.join(', ')}`);
    
    const session = driver.session();
    try {
      // STEP 1: MERGE the insight node to avoid duplicates (safe single operation)
      const createResult = await session.run(`
        MERGE (i:Insight {
          sourceQuery: $query,
          insightText: $condensedInsight
        })
        ON CREATE SET 
          i.fullResponse = $fullResponse,
          i.embedding = $embedding,
          i.topics = $topics,
          i.primaryTopic = $primaryTopic,
          i.confidence = 0.85,
          i.wordCount = $wordCount,
          i.createdAt = datetime()
        ON MATCH SET
          i.fullResponse = $fullResponse,
          i.embedding = $embedding,
          i.confidence = 0.85,
          i.updatedAt = datetime()
        RETURN id(i) AS insightId
      `, {
        condensedInsight,
        fullResponse,
        embedding: insightEmbedding,
        query,
        topics: semanticTopics,
        primaryTopic: semanticTopics[0] || 'general',
        wordCount: condensedInsight.split(' ').length
      });
      
      const insightId = createResult.records[0]?.get('insightId');
      if (!insightId) throw new Error('Failed to create insight node');
      
      // Convert BigInt to Number to avoid mixing BigInt and other types
      const numericInsightId = Number(insightId);
      
      // STEP 2: Link to Person (separate transaction for safety)
      await session.run(`
        MATCH (i:Insight) WHERE id(i) = $insightId
        MATCH (p:Person {name: $personName})
        MERGE (i)-[:ABOUT]->(p)
      `, { insightId: numericInsightId, personName: sourceInfo.personName });
      
      // STEP 3: Link to Companies (separate transaction)
      let companiesLinked = 0;
      for (const companyName of (sourceInfo.companyNames || [])) {
        const companyResult = await session.run(`
          MATCH (i:Insight) WHERE id(i) = $insightId
          MATCH (c:Company {name: $companyName})
          MERGE (i)-[:DERIVED_FROM_COMPANY]->(c)
          RETURN count(*) AS linked
        `, { insightId: numericInsightId, companyName });
        companiesLinked += companyResult.records[0]?.get('linked') || 0;
      }
      
      // STEP 4: Link to Institutions (separate transaction)
      let institutionsLinked = 0;
      for (const institutionName of (sourceInfo.institutionNames || [])) {
        const instResult = await session.run(`
          MATCH (i:Insight) WHERE id(i) = $insightId
          MATCH (inst:Institution {name: $institutionName})
          MERGE (i)-[:RELATES_TO_INSTITUTION]->(inst)
          RETURN count(*) AS linked
        `, { insightId: numericInsightId, institutionName });
        institutionsLinked += instResult.records[0]?.get('linked') || 0;
      }
      
      // STEP 5: Link to Source Chunks (separate transaction for evidence trail)
      const sourceChunks = hybridContext.graphFacts?.flatMap(item => item.chunks || []) || [];
      let chunksLinked = 0;
      for (const chunkText of sourceChunks) {
        const chunkResult = await session.run(`
          MATCH (i:Insight) WHERE id(i) = $insightId
          MATCH (chunk:Chunk {text: $chunkText})
          MERGE (i)-[:BASED_ON_CHUNK]->(chunk)
          RETURN count(*) AS linked
        `, { insightId: numericInsightId, chunkText });
        chunksLinked += chunkResult.records[0]?.get('linked') || 0;
      }
      
      // STEP 6: Link to Source Tenures (separate transaction, no dependency issues)
      const tenureResult = await session.run(`
        MATCH (i:Insight) WHERE id(i) = $insightId
        MATCH (i)-[:BASED_ON_CHUNK]->(chunk:Chunk)<-[:HAS_RESPONSIBILITY]-(t:Tenure)
        MERGE (i)-[:SYNTHESIZED_FROM_TENURE]->(t)
        RETURN count(DISTINCT t) AS tenuresLinked
      `, { insightId: numericInsightId });
      
      const tenuresLinked = tenureResult.records[0]?.get('tenuresLinked') || 0;
      
      console.log(`✅ Stored 1 logic-safe insight to reasoning memory`);
      console.log(`   📋 Topics: ${semanticTopics.join(', ')}`);
      console.log(`   🔗 Linked to: ${companiesLinked} companies, ${institutionsLinked} institutions`);
      console.log(`   📊 Evidence trail: ${chunksLinked} chunks, ${tenuresLinked} tenures`);
      
    } finally {
      await session.close();
    }
  } catch (error) {
    console.log('⚠️ Failed to store enhanced insight:', error.message);
    console.error('Error details:', error);
    // Don't throw - log and continue to prevent pipeline failure
  }
}

// Legacy function for backward compatibility
async function storeInsight(driver, query, responseText, sourceChunks = []) {
  console.log('💾 Storing insight to reasoning memory (legacy mode)...');
  
  try {
    // Generate embedding for the AI response
    const insightEmbedding = await generateQueryEmbedding(responseText);
    
    // Extract key topic from query for categorization
    const topic = extractTopicFromQuery(query);
    
    const session = driver.session();
    try {
      const result = await session.run(`
        // Create the insight node with rich metadata
        CREATE (i:Insight {
          text: $responseText,
          embedding: $embedding,
          sourceQuery: $query,
          topic: $topic,
          confidence: 0.85,
          createdAt: datetime()
        })
        
        // Link to Marianne Abrams (the person this insight is about)
        WITH i
        MATCH (p:Person {name: "Marianne Abrams"})
        CREATE (i)-[:ABOUT]->(p)
        
        // Link to source companies if available (only if companies exist)
        WITH i
        OPTIONAL MATCH (c:Company)
        WHERE c.name IN $companyNames AND size($companyNames) > 0
        FOREACH (ignored IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
          CREATE (i)-[:ANALYZES]->(c)
        )
        
        RETURN count(i) AS insightsCreated
      `, {
        responseText,
        embedding: insightEmbedding,
        query,
        topic,
        companyNames: sourceChunks.map(chunk => extractCompanyFromChunk(chunk)).filter(Boolean)
      });

      const insightsCreated = result.records[0]?.get('insightsCreated') || 0;
      console.log(`✅ Stored ${insightsCreated} insight to reasoning memory (topic: ${topic})`);
    } finally {
      await session.close();
    }
  } catch (error) {
    console.log('⚠️ Failed to store insight:', error.message);
  }
}

// Extract topic from query for insight categorization
function extractTopicFromQuery(query) {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('experience') || lowerQuery.includes('work') || lowerQuery.includes('career')) {
    return 'career_experience';
  } else if (lowerQuery.includes('skill') || lowerQuery.includes('technical') || lowerQuery.includes('expertise')) {
    return 'skills_expertise';
  } else if (lowerQuery.includes('education') || lowerQuery.includes('school') || lowerQuery.includes('degree')) {
    return 'education';
  } else if (lowerQuery.includes('leadership') || lowerQuery.includes('management') || lowerQuery.includes('lead')) {
    return 'leadership';
  } else {
    return 'general';
  }
}

// Extract company name from chunk for relationship linking
function extractCompanyFromChunk(chunk) {
  // Simple extraction - in production, this could be more sophisticated
  const companyPatterns = ['PwC', 'Harvard', 'Babson', 'Price Waterhouse', 'Coopers'];
  for (const company of companyPatterns) {
    if (chunk.includes(company)) {
      return company;
    }
  }
  return null;
}

// Interactive CLI function
async function startInteractiveQwenRAG() {
  console.log('🎭 ========================================');
  console.log('🧠 INTERACTIVE QWEN RAG - Advanced Pipeline');
  console.log('🎭 ========================================\n');
  console.log('🎯 Features: Hybrid Retrieval + 4-Step Reasoning + TTS');
  console.log('📊 System: Qwen3 + Neo4j + Chronological Data');
  console.log('💡 Ask anything about Marianne Abrams\' career!');
  console.log('💡 Type "quit", "exit", or "q" to end\n');
  
  // Ensure insight index is ready
  await ensureInsightIndex(driver);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  let questionCount = 0;
  const sessionStartTime = Date.now();
  
  const askQuestion = () => {
    rl.question('🤔 You: ', async (userQuestion) => {
      const trimmed = userQuestion.trim();
      
      // Handle exit commands
      if (['quit', 'exit', 'q', ''].includes(trimmed.toLowerCase())) {
        console.log('\n👋 Shutting down Qwen RAG CLI...');
        const runtime = Math.round((Date.now() - sessionStartTime) / 1000);
        const minutes = Math.floor(runtime / 60);
        const seconds = runtime % 60;
        console.log(`📈 Session Stats: ${questionCount} questions, ${minutes}m ${seconds}s runtime`);
        console.log('\n✨ Thanks for using the Advanced Qwen RAG Pipeline!\n');
        rl.close();
        await driver.close();
        return;
      }
      
      try {
        questionCount++;
        console.log(`\n🔍 Processing question ${questionCount}...`);
        await processQuery(trimmed);
      } catch (error) {
        console.error('\n❌ Error processing question:', error.message);
        console.log('\n🤖 Aria: Sorry, I had trouble with that question. Please try again!\n');
      } finally {
        console.log('\n' + '='.repeat(60) + '\n');
        askQuestion();
      }
    });
  };
  
  askQuestion();
}

// Process a single query (extracted from the original loop)
async function processQuery(query) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 QUERY: "${query}"`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Step 1: Generate embedding
    const queryEmbedding = await generateQueryEmbedding(query);
    if (!queryEmbedding) {
      console.log('❌ Failed to generate embedding - aborting query');
      return;
    }

    // Step 2: Hybrid retrieval (semantic insights + structural facts)
    const hybridContext = await performHybridRetrieval(driver, query, queryEmbedding);
    
    if ((hybridContext.semanticInsights.length + hybridContext.graphFacts.length) === 0) { 
      console.log('❌ No knowledge found for this query');
      return;
    }

    // Display hybrid context with verification logging
    console.log('\n--- Verifying Hybrid Retrieval Results ---');
    
    // Show semantic insights (reasoning memory)
    if (hybridContext.semanticInsights.length > 0) {
      console.log('\n🧠 SEMANTIC INSIGHTS (Reasoning Memory):');
      hybridContext.semanticInsights.forEach((insight, idx) => {
        console.log(`${idx + 1}. Topic: ${insight.topic || 'general'} (Score: ${insight.score?.toFixed(4) || 'N/A'})`);
        console.log(`   Source Query: "${insight.sourceQuery}"`);
        console.log(`   Insight: ${insight.text?.substring(0, 100)}...`);
      });
    }
    
    // Show structural facts (fresh graph data)
    if (hybridContext.graphFacts.length > 0) {
      console.log('\n🏢 STRUCTURAL FACTS (Fresh Graph Data):');
      hybridContext.graphFacts.forEach((item, idx) => {
        console.log(`${idx + 1}. Company: ${item.company} (Score: ${item.aggregateScore?.toFixed(4) || 'N/A'})`);
        console.log(`   Roles: ${item.roles.join(', ')}`);
        console.log(`   Aggregated Chunks: ${item.chunks.length}`);
      });
    }
    
    console.log(`\n--- Context Balance: ${hybridContext.semanticInsights.length} insights + ${hybridContext.graphFacts.length} facts ---`);
    console.log('--------------------------------------------------');

    // Step 3: Generate AI response with hybrid context
    const aiResponse = await generateAIResponse(query, hybridContext);
    
    console.log('\n🤖 Aria:');
    console.log('─'.repeat(50));
    console.log(aiResponse);
    console.log('─'.repeat(50));
    
    // Step 4: Generate speech with Kokoro TTS - only the Narrative Synthesis section
    console.log(`\n🎵 Generating speech...`);
    try {
      const narrativeOnly = extractNarrativeSynthesis(aiResponse);
      const speechText = `Question: ${query}. Answer: ${narrativeOnly}`;
      const audioFile = await generateKokoroSpeech(speechText);
      if (audioFile) {
        console.log(`🔊 Playing audio...`);
        const playAudio = spawn('paplay', [audioFile]);
        playAudio.on('error', (err) => console.warn('⚠️ Audio playback failed, continuing...'));
        await new Promise(resolve => playAudio.on('close', resolve));
        console.log('✅ Speech synthesis completed');
      }
    } catch (ttsError) {
      console.log('⚠️ TTS not available, but text response provided above');
    }
    
    // Step 5: Store enhanced AI insight back to the graph (reasoning memory)
    await storeInsightEnhanced(driver, query, aiResponse, hybridContext);
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Query processed successfully in ${processingTime}s`);
    
  } catch (error) {
    console.error('❌ Error processing query:', error.message);
    throw error;
  }
}

// Start the interactive CLI
startInteractiveQwenRAG().catch(console.error);