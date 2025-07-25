// Debug Marianne search query
require('dotenv').config();
const neo4j = require('neo4j-driver');

async function debugMarianneSearch() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  
  try {
    const query = "What are Marianne Abrams technical skills?";
    console.log(`🔍 Testing query: "${query}"`);
    
    // Test the exact query from customer-manager.js
    const result = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})
      OPTIONAL MATCH (p)-[:WORKED_AT]->(j:Job)
      OPTIONAL MATCH (p)-[:STUDIED_AT]->(e:Education)
      OPTIONAL MATCH (p)-[:HAS_SKILL]->(s:Skill)
      OPTIONAL MATCH (p)-[:HAS_PROFICIENCY]->(sp:SkillProficiency)
      OPTIONAL MATCH (p)-[:ACHIEVED]->(a:Achievement)
      OPTIONAL MATCH (p)-[:HAS_EXAMPLE]->(be:BehavioralExample)
      OPTIONAL MATCH (p)-[:HAS_OBJECTIVES]->(co:CareerObjectives)
      WHERE toLower($query) CONTAINS 'marianne' OR toLower($query) CONTAINS 'abrams' OR
            toLower($query) CONTAINS 'school' OR toLower($query) CONTAINS 'college' OR
            toLower($query) CONTAINS 'education' OR toLower($query) CONTAINS 'work' OR
            toLower($query) CONTAINS 'job' OR toLower($query) CONTAINS 'experience' OR
            toLower($query) CONTAINS 'skill' OR toLower($query) CONTAINS 'resume'
      RETURN 
        CASE 
          WHEN j IS NOT NULL THEN 'Job'
          WHEN e IS NOT NULL THEN 'Education'
          WHEN s IS NOT NULL THEN 'Skill'
          WHEN sp IS NOT NULL THEN 'SkillProficiency'
          WHEN a IS NOT NULL THEN 'Achievement'
          WHEN be IS NOT NULL THEN 'BehavioralExample'
          WHEN co IS NOT NULL THEN 'CareerObjectives'
          ELSE 'Unknown'
        END as type,
        CASE 
          WHEN j IS NOT NULL THEN j
          WHEN e IS NOT NULL THEN e
          WHEN s IS NOT NULL THEN s
          WHEN sp IS NOT NULL THEN sp
          WHEN a IS NOT NULL THEN a
          WHEN be IS NOT NULL THEN be
          WHEN co IS NOT NULL THEN co
          ELSE null
        END as content
    `, { query });

    console.log(`📊 Results found: ${result.records.length}`);
    
    result.records.forEach((record, i) => {
      console.log(`${i + 1}. Type: ${record.get('type')}`);
      console.log(`   Content:`, record.get('content'));
      console.log('---');
    });

    // Also test simple count
    const countResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})
      OPTIONAL MATCH (p)-[r]->()
      RETURN count(r) as relationships
    `);
    
    console.log(`🔗 Total relationships: ${countResult.records[0].get('relationships').toNumber()}`);

    // Test just skills
    const skillsResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})-[:HAS_SKILL]->(s:Skill)
      RETURN s.name as skill, s.experience as experience
      LIMIT 10
    `);
    
    console.log(`🎯 Skills found: ${skillsResult.records.length}`);
    skillsResult.records.forEach(record => {
      console.log(`- ${record.get('skill')} (${record.get('experience')})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

debugMarianneSearch();
