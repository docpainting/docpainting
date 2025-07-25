const neo4j = require('neo4j-driver');

async function testDirect() {
  const driver = neo4j.driver(
    'neo4j+s://c148cb1a.databases.neo4j.io',
    neo4j.auth.basic('doconnell797@gmail.com', 'jBgAtldPuNYSLzZ7RquO8gvaqB9xpLPItpbLVOsXgwI')
  );

  try {
    const session = driver.session();
    console.log('🔗 Testing with direct credentials...');
    
    const result = await session.run('RETURN "Hello!" as message');
    console.log('✅ Success:', result.records[0].get('message'));
    
    const countResult = await session.run('MATCH (n) RETURN count(n) as total');
    const count = countResult.records[0].get('total').toNumber();
    console.log('📊 Nodes:', count);
    
    await session.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await driver.close();
  }
}

testDirect();
