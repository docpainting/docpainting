exports.handler = async (event, context) => {
  try {
    // Show actual Neo4j environment values (safely)
    const neo4jEnv = {
      NEO4J_URI: process.env.NEO4J_URI || 'MISSING',
      NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'MISSING', 
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ? `${process.env.NEO4J_PASSWORD.substring(0, 8)}...${process.env.NEO4J_PASSWORD.slice(-8)}` : 'MISSING',
      NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'MISSING'
    };
    
    // Test Neo4j connection directly
    const neo4j = require('neo4j-driver');
    let connectionTest = 'NOT_TESTED';
    
    try {
      const driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
      );
      
      const session = driver.session({ database: process.env.NEO4J_DATABASE });
      const result = await session.run('RETURN 1 as test');
      await session.close();
      await driver.close();
      
      connectionTest = 'SUCCESS';
    } catch (error) {
      connectionTest = `FAILED: ${error.message}`;
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'Neo4j auth diagnostic',
        environment: neo4jEnv,
        connectionTest: connectionTest,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'Neo4j auth diagnostic failed',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
