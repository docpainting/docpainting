// Debug script to check Marianne Abrams tenure chronological ordering
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function debugTenureChronology() {
  console.log('🔍 DEBUGGING: Neo4j Tenure Chronological Data\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
    neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Query 1: Get all tenures with chronological data
    console.log('📊 TENURE DATA ANALYSIS:');
    const result = await session.run(`
      MATCH (p:Person {name: "Marianne Abrams"})-[:HAS_TENURE]->(t:Tenure)-[:AT_COMPANY]->(c:Company)
      OPTIONAL MATCH (t)-[:INCLUDES_ROLE]->(j:Job)
      RETURN 
        c.name AS company,
        t.startDate AS startDate,
        t.endDate AS endDate,
        t.duration AS duration,
        t.description AS description,
        COLLECT(DISTINCT j.title) AS roles,
        t.startYear AS startYear,
        t.endYear AS endYear
      ORDER BY t.startDate ASC
    `);
    
    console.log(`Found ${result.records.length} tenure records:\n`);
    
    result.records.forEach((record, idx) => {
      const company = record.get('company');
      const startDate = record.get('startDate');
      const endDate = record.get('endDate');
      const duration = record.get('duration');
      const description = record.get('description');
      const roles = record.get('roles');
      const startYear = record.get('startYear');
      const endYear = record.get('endYear');
      
      console.log(`${idx + 1}. ${company}`);
      console.log(`   📅 Start: ${startDate || startYear || 'N/A'}`);
      console.log(`   📅 End: ${endDate || endYear || 'N/A'}`);
      console.log(`   ⏱️ Duration: ${duration || 'N/A'}`);
      console.log(`   👤 Roles: ${roles.join(', ')}`);
      if (description) {
        console.log(`   📝 Description: ${description.substring(0, 100)}...`);
      }
      console.log('');
    });
    
    // Query 2: Check raw tenure properties
    console.log('\n🔍 RAW TENURE PROPERTIES:');
    const rawResult = await session.run(`
      MATCH (t:Tenure)
      RETURN t
      ORDER BY t.startDate, t.startYear
    `);
    
    rawResult.records.forEach((record, idx) => {
      const tenure = record.get('t').properties;
      console.log(`${idx + 1}. Tenure properties:`, tenure);
    });
    
    // Query 3: Check what the vector search might be returning
    console.log('\n🔍 CHECKING VECTOR SEARCH ORDER:');
    const vectorTest = await session.run(`
      MATCH (c:Chunk)<-[:HAS_RESPONSIBILITY]-(t:Tenure)-[:AT_COMPANY]->(comp:Company)
      RETURN 
        comp.name AS company,
        t.startDate AS startDate,
        COUNT(c) AS chunkCount,
        COLLECT(c.text)[0..2] AS sampleChunks
      ORDER BY chunkCount DESC
    `);
    
    console.log('Companies by chunk count (what vector search sees):');
    vectorTest.records.forEach((record, idx) => {
      const company = record.get('company');
      const startDate = record.get('startDate');
      const chunkCount = record.get('chunkCount');
      const sampleChunks = record.get('sampleChunks');
      
      console.log(`${idx + 1}. ${company} (${chunkCount} chunks, start: ${startDate})`);
      sampleChunks.forEach((chunk, i) => {
        console.log(`   Sample ${i + 1}: ${chunk.substring(0, 80)}...`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

debugTenureChronology().catch(console.error);
