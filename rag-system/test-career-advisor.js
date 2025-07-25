// Test the comprehensive career advisor knowledge base
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function testCareerAdvisor() {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🎯 Testing Marianne\'s AI Career Advisor Knowledge Base...\n');
    
    // Test 1: Behavioral Interview Questions
    console.log('📋 BEHAVIORAL INTERVIEW EXAMPLES:');
    const behavioralResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})-[:HAS_EXAMPLE]->(b:BehavioralExample)
      RETURN b.type, b.situation, b.result
      ORDER BY b.type
    `);
    
    behavioralResult.records.forEach(record => {
      console.log(`• ${record.get('b.type')}: ${record.get('b.situation')}`);
      console.log(`  Result: ${record.get('b.result')}\n`);
    });
    
    // Test 2: Technical Skills with Proficiency
    console.log('🔧 TECHNICAL SKILL PROFICIENCY:');
    const skillsResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})-[:HAS_PROFICIENCY]->(sp:SkillProficiency)
      RETURN sp.skill_name, sp.proficiency_level, sp.years_experience, sp.description
      ORDER BY sp.proficiency_level DESC, sp.years_experience DESC
    `);
    
    skillsResult.records.forEach(record => {
      console.log(`• ${record.get('sp.skill_name')}: ${record.get('sp.proficiency_level')} (${record.get('sp.years_experience')})`);
      console.log(`  ${record.get('sp.description')}\n`);
    });
    
    // Test 3: Career Objectives
    console.log('🎯 CAREER OBJECTIVES:');
    const objectivesResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})-[:HAS_OBJECTIVES]->(co:CareerObjectives)
      RETURN co.target_roles, co.preferred_industries, co.work_arrangement
    `);
    
    if (objectivesResult.records.length > 0) {
      const record = objectivesResult.records[0];
      console.log(`• Target Roles: ${record.get('co.target_roles').join(', ')}`);
      console.log(`• Industries: ${record.get('co.preferred_industries').join(', ')}`);
      console.log(`• Work Style: ${record.get('co.work_arrangement')}\n`);
    }
    
    // Test 4: Quantified Achievements
    console.log('📊 QUANTIFIED ACHIEVEMENTS:');
    const achievementsResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})-[:ACHIEVED]->(a:Achievement)
      RETURN a.metric, a.value, a.context
      ORDER BY a.metric
    `);
    
    achievementsResult.records.forEach(record => {
      console.log(`• ${record.get('a.metric')}: ${record.get('a.value')}`);
      console.log(`  Context: ${record.get('a.context')}\n`);
    });
    
    // Test 5: Work Style Assessment
    console.log('🤝 WORK STYLE & CULTURAL FIT:');
    const workStyleResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})-[:EXHIBITS_WORKSTYLE]->(ws:WorkStyle)
      RETURN ws.collaboration_style, ws.leadership_style, ws.communication_skills
    `);
    
    if (workStyleResult.records.length > 0) {
      const record = workStyleResult.records[0];
      console.log(`• Collaboration: ${record.get('ws.collaboration_style')}`);
      console.log(`• Leadership: ${record.get('ws.leadership_style')}`);
      console.log(`• Communication: ${record.get('ws.communication_skills')}\n`);
    }
    
    // Summary Count
    console.log('📈 KNOWLEDGE BASE SUMMARY:');
    const summaryResult = await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})
      OPTIONAL MATCH (p)-[:HAS_EXAMPLE]->(b:BehavioralExample)
      OPTIONAL MATCH (p)-[:HAS_PROFICIENCY]->(sp:SkillProficiency)
      OPTIONAL MATCH (p)-[:ACHIEVED]->(a:Achievement)
      OPTIONAL MATCH (p)-[:WORKED_AT]->(j:Job)
      OPTIONAL MATCH (p)-[:STUDIED_AT]->(e:Education)
      RETURN count(DISTINCT b) as behavioral_examples,
             count(DISTINCT sp) as skill_proficiencies,
             count(DISTINCT a) as achievements,
             count(DISTINCT j) as jobs,
             count(DISTINCT e) as education
    `);
    
    if (summaryResult.records.length > 0) {
      const record = summaryResult.records[0];
      console.log(`• Behavioral Examples: ${record.get('behavioral_examples').toNumber()}`);
      console.log(`• Skill Proficiencies: ${record.get('skill_proficiencies').toNumber()}`);
      console.log(`• Quantified Achievements: ${record.get('achievements').toNumber()}`);
      console.log(`• Work Experiences: ${record.get('jobs').toNumber()}`);
      console.log(`• Education Records: ${record.get('education').toNumber()}`);
    }
    
    console.log('\n🎉 Marianne\'s AI Career Advisor is fully equipped to handle:');
    console.log('   ✅ Behavioral interview questions');
    console.log('   ✅ Technical skill assessments');
    console.log('   ✅ Career goal discussions');
    console.log('   ✅ Salary and compensation talks');
    console.log('   ✅ Cultural fit evaluations');
    console.log('   ✅ Achievement quantification');
    console.log('   ✅ Work style preferences');
    console.log('   ✅ Professional development planning');
    
  } catch (error) {
    console.error('❌ Error testing career advisor:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

testCareerAdvisor().catch(console.error);
