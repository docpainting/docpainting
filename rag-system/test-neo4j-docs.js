require('dotenv').config({ path: '../.env' });
const neo4j = require('neo4j-driver');

async function testConnection() {
  console.log('🔗 Testing Neo4j Aura connection using official docs format...');
  
  // Use exact format from Neo4j documentation
  const URI = process.env.NEO4J_URI;
  const AUTH = neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD);
  
  console.log('URI:', URI ? 'SET' : 'NOT SET');
  console.log('User:', process.env.NEO4J_USER ? 'SET' : 'NOT SET');
  console.log('Password:', process.env.NEO4J_PASSWORD ? 'SET' : 'NOT SET');
  
  let driver;
  try {
    driver = neo4j.driver(URI, AUTH);
    
    // Use verify_connectivity like in docs
    await driver.verifyConnectivity();
    console.log('✅ Connection verified successfully!');
    
    // Test basic query
    const result = await driver.executeQuery(
      'RETURN "Hello from Aura!" as message',
      {},
      { database: 'neo4j' }
    );
    
    console.log('✅ Query result:', result.records[0].get('message'));
    
    // Check node count
    const countResult = await driver.executeQuery(
      'MATCH (n) RETURN count(n) as total',
      {},
      { database: 'neo4j' }
    );
    
    const count = countResult.records[0].get('total').toNumber();
    console.log('📊 Total nodes in database:', count);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    
    if (error.message.includes('authentication')) {
      console.log('\n🔍 Authentication failure suggests:');
      console.log('1. Database might be PAUSED in Aura console');
      console.log('2. Credentials might be incorrect');
      console.log('3. IP might not be whitelisted');
    }
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

testConnection();
