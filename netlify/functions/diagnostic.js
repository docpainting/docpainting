// Step-by-step diagnostic for chat function issues
exports.handler = async (event, context) => {
  const steps = [];
  
  try {
    steps.push("✅ Function started");
    
    // Test 1: Environment variables
    const hasNeo4j = !!process.env.NEO4J_URI;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    steps.push(`✅ Environment check: Neo4j=${hasNeo4j}, OpenRouter=${hasOpenRouter}`);
    
    // Test 2: Try to import neo4j-driver
    const neo4j = require('neo4j-driver');
    steps.push("✅ neo4j-driver imported");
    
    // Test 3: Try to create driver (don't connect yet)
    const driver = neo4j.driver(
      process.env.NEO4J_URI, 
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );
    steps.push("✅ Neo4j driver created");
    
    // Test 4: Test simple connection (5 second timeout)
    const session = driver.session();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );
    
    const result = await Promise.race([
      session.run('RETURN 1 as test'),
      timeoutPromise
    ]);
    
    await session.close();
    await driver.close();
    steps.push("✅ Neo4j connection successful");
    
    // Test 5: Try importing customer manager
    try {
      const { CustomerManager } = require('../../rag-system/customer-manager');
      steps.push("✅ CustomerManager imported");
    } catch (importError) {
      steps.push(`❌ CustomerManager import failed: ${importError.message}`);
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        steps: steps,
        environment: {
          neo4j_uri: process.env.NEO4J_URI?.substring(0, 20) + '...',
          remaining_time: context.getRemainingTimeInMillis?.() || 'unknown'
        }
      })
    };
    
  } catch (error) {
    steps.push(`❌ Error at step ${steps.length + 1}: ${error.message}`);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        steps: steps,
        error: error.message,
        stack: error.stack
      })
    };
  }
};
