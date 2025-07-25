require('dotenv').config({ path: '../.env' });
const neo4j = require('neo4j-driver');

(async () => {
  console.log('🔗 Testing with Neo4j official full example...');
  
  const URI = process.env.NEO4J_URI;
  const USER = process.env.NEO4J_USER;
  const PASSWORD = process.env.NEO4J_PASSWORD;
  let driver, result;

  console.log('URI:', URI ? 'SET' : 'NOT SET');
  console.log('USER:', USER ? 'SET' : 'NOT SET');
  console.log('PASSWORD:', PASSWORD ? 'SET' : 'NOT SET');

  // Connect to database
  try {
    console.log('📡 Creating driver...');
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    
    console.log('🔍 Verifying connectivity...');
    await driver.verifyConnectivity();
    
    console.log('✅ Connection verified!');
    
  } catch(err) {
    console.log(`❌ Connection error\n${err}\nCause: ${err.cause}`);
    if (driver) await driver.close();
    return;
  }

  // Test a simple query to check if database has data
  try {
    console.log('📊 Checking database contents...');
    result = await driver.executeQuery(
      'MATCH (n) RETURN count(n) as total',
      {},
      { database: 'neo4j' }
    );
    
    const count = result.records[0].get('total').toNumber();
    console.log(`✅ Database has ${count} nodes`);
    
    // Test a specific query for DOC Painting data
    result = await driver.executeQuery(
      'MATCH (n:Color) RETURN n.name as colorName LIMIT 5',
      {},
      { database: 'neo4j' }
    );
    
    console.log('🎨 Sample colors in database:');
    for(let record of result.records) {
      console.log(`  - ${record.get('colorName')}`);
    }
    
  } catch(err) {
    console.log(`❌ Query error: ${err.message}`);
  }

  await driver.close();
  console.log('🔒 Connection closed');
})();
