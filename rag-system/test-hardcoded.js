const neo4j = require('neo4j-driver');

(async () => {
  console.log('🔗 Testing with hardcoded credentials...');
  
  // Hardcoded credentials to eliminate env variable issues
  const URI = 'neo4j+s://256fce48.databases.neo4j.io';
  const USER = 'neo4j';
  const PASSWORD = 'XoGzplIp-V7_VmtNQhfeCB6qSwplcqbBsdKGzfsldyY';
  
  let driver;

  try {
    console.log('📡 Creating driver with hardcoded credentials...');
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    
    console.log('🔍 Verifying connectivity...');
    await driver.verifyConnectivity();
    
    console.log('✅ Connection verified!');
    
    // Test query
    let result = await driver.executeQuery(
      'RETURN "Hello from Aura!" as message',
      {},
      { database: 'neo4j' }
    );
    
    console.log('✅ Query result:', result.records[0].get('message'));
    
    // Check node count
    result = await driver.executeQuery(
      'MATCH (n) RETURN count(n) as total',
      {},
      { database: 'neo4j' }
    );
    
    const count = result.records[0].get('total').toNumber();
    console.log(`📊 Database has ${count} nodes`);
    
  } catch(err) {
    console.log(`❌ Connection error: ${err.message}`);
    console.log('Error code:', err.code);
    
    // More detailed error info
    if (err.code) {
      console.log('\n🔍 Error analysis:');
      if (err.code.includes('Security.Unauthorized')) {
        console.log('- This is definitely an authentication issue');
        console.log('- Credentials might be wrong or database might have restrictions');
      }
      if (err.code.includes('ServiceUnavailable')) {
        console.log('- Database might be down or unreachable');
      }
    }
  } finally {
    if (driver) {
      await driver.close();
      console.log('🔒 Connection closed');
    }
  }
})();
