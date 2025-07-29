#!/usr/bin/env node

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

async function generateEmbedding(text) {
  const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: text })
  });
  
  const data = await response.json();
  return data;
}

async function fixEmbeddings() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  
  try {
    console.log('🚀 GENERATING MISSING EMBEDDINGS...');
    
    // Get all Skill nodes without embeddings
    const result = await session.run(`
      MATCH (n:Skill)
      WHERE n.embedding IS NULL
      RETURN n.name as name, n.description as description, n.level as level
      LIMIT 39
    `);
    
    console.log(`Found ${result.records.length} Skill nodes to process...`);
    
    for (let i = 0; i < result.records.length; i++) {
      const record = result.records[i];
      const name = record.get('name');
      const description = record.get('description') || '';
      const level = record.get('level') || '';
      
      console.log(`Processing ${i+1}/${result.records.length}: ${name}`);
      
      // Create embedding text
      const embeddingText = `${name} ${description} ${level}`.trim();
      
      try {
        // Generate embedding
        const embedding = await generateEmbedding(embeddingText);
        
        // Store embedding
        await session.run(`
          MATCH (n:Skill {name: $name})
          SET n.embedding = $embedding
        `, { name, embedding });
        
        console.log(`✅ Generated embedding for: ${name}`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to generate embedding for ${name}:`, error.message);
      }
    }
    
    // Create vector index for Skills
    console.log('\n📊 Creating Skill vector index...');
    try {
      await session.run(`
        CREATE VECTOR INDEX skillEmbedding IF NOT EXISTS
        FOR (n:Skill)
        ON (n.embedding)
        OPTIONS {indexConfig: {
          \`vector.dimensions\`: 1024,
          \`vector.similarity_function\`: 'cosine'
        }}
      `);
      console.log('✅ Created skillEmbedding index');
    } catch (e) {
      console.log(`⚠️ Index creation: ${e.message}`);
    }
    
    console.log('\n🎉 DONE! Production should now work!');
    console.log('\n🧪 Test with: curl -X POST "https://docpainting.netlify.app/.netlify/functions/chat" -H "Content-Type: application/json" -d \'{"message": "What technical skills does Marianne Abrams have?"}\'');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

fixEmbeddings().catch(console.error);
