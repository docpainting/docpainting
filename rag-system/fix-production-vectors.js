#!/usr/bin/env node

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

async function fixVectors() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  
  try {
    console.log('🔧 FIXING PRODUCTION VECTORS...');
    
    // 1. Create missing vector indexes
    console.log('Step 1: Creating vector indexes...');
    
    const indexes = [
      'skillEmbedding',
      'skillProficiencyEmbedding', 
      'jobEmbedding',
      'educationEmbedding',
      'achievementEmbedding',
      'behavioralExampleEmbedding'
    ];
    
    for (const indexName of indexes) {
      try {
        await session.run(`
          CREATE VECTOR INDEX ${indexName} IF NOT EXISTS
          FOR (n:Skill|SkillProficiency|Job|Education|Achievement|BehavioralExample)
          ON (n.embedding)
          OPTIONS {indexConfig: {
            \`vector.dimensions\`: 1024,
            \`vector.similarity_function\`: 'cosine'
          }}
        `);
        console.log(`✅ Created index: ${indexName}`);
      } catch (e) {
        console.log(`⚠️ Index ${indexName}: ${e.message}`);
      }
    }
    
    // 2. Check which nodes are missing embeddings
    console.log('\nStep 2: Checking nodes without embeddings...');
    
    const nodeTypes = ['Skill', 'SkillProficiency', 'Job', 'Education', 'Achievement', 'BehavioralExample'];
    
    for (const nodeType of nodeTypes) {
      const result = await session.run(`
        MATCH (n:${nodeType})
        WHERE n.embedding IS NULL
        RETURN count(n) as missingCount, count(*) as totalCount
      `);
      
      const record = result.records[0];
      const missing = record.get('missingCount').toNumber();
      const total = record.get('totalCount').toNumber();
      
      console.log(`${nodeType}: ${missing}/${total} missing embeddings`);
      
      if (missing > 0) {
        console.log(`⚠️ ${nodeType} nodes need embeddings generated!`);
      }
    }
    
    console.log('\n🎯 IMMEDIATE TEST: Try production chat now!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

fixVectors().catch(console.error);
