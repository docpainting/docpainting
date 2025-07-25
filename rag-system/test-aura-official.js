require('dotenv').config({ path: '../.env' });
var neo4j = require('neo4j-driver');

(async () => {
  console.log('🔗 Testing Neo4j Aura with official docs format...');
  
  // Try both variable names
  const URI = process.env.NEO4J_URI;
  const USER = process.env.NEO4J_USER || process.env.NEO4J_USERNAME;
  const PASSWORD = process.env.NEO4J_PASSWORD;
  
  console.log('URI:', URI ? 'SET' : 'NOT SET');
  console.log('USER:', USER ? 'SET' : 'NOT SET'); 
  console.log('PASSWORD:', PASSWORD ? 'SET' : 'NOT SET');
  
  let driver;

  try {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    
    console.log('📡 Getting server info...');
    const serverInfo = await driver.getServerInfo();
    
    console.log('✅ Connection established');
    console.log('Server info:', serverInfo);
    
    // Test a simple query using executeQuery (official docs method)
    let { records, summary } = await driver.executeQuery(
      'RETURN "Hello from Aura!" as message',
      {},
      { database: 'neo4j' }
    );
    console.log('✅ Query result:', records[0].get('message'));
    
    // Check node count
    let countResult = await driver.executeQuery(
      'MATCH (n) RETURN count(n) as total',
      {},
      { database: 'neo4j' }
    );
    const count = countResult.records[0].get('total').toNumber();
    console.log('📊 Total nodes:', count);
    
  } catch(err) {
    console.log(`❌ Connection error\n${err}\nCause: ${err.cause}`);
    
    if (err.message.includes('authentication')) {
      console.log('\n🔍 Authentication failure suggests:');
      console.log('1. IP not whitelisted in Aura console');
      console.log('2. Database credentials incorrect');
      console.log('3. Database might be paused');
    }
  } finally {
    if (driver) {
      await driver.close();
    }
  }
})();
