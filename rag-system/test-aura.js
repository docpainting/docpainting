// Quick test script for Neo4j Aura
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function testAura() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  try {
    const session = driver.session();
    
    console.log('🔗 Testing Neo4j Aura...');
    
    // Test basic query
    const result = await session.run('RETURN "Hello Aura!" as message');
    console.log('✅ Connection:', result.records[0].get('message'));
    
    // Check current node count
    const countResult = await session.run('MATCH (n) RETURN count(n) as total');
    const count = countResult.records[0].get('total').toNumber();
    console.log('📊 Current nodes in Aura:', count);
    
    await session.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await driver.close();
  }
}

testAura();
