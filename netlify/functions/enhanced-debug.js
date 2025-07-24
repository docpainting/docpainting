const neo4j = require('neo4j-driver');

// Enhanced connection with retry logic for Lambda/ngrok issues
async function connectWithRetry(uri, user, password, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Connection attempt ${attempt}/${maxRetries} to ${uri}`);
      
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        // Lambda-optimized settings
        connectionTimeout: 20000,  // 20 seconds
        maxConnectionLifetime: 60000, // 1 minute
        connectionAcquisitionTimeout: 15000, // 15 seconds
        maxConnectionPoolSize: 10,
        disableLosslessIntegers: true,
        // Additional debugging
        logging: {
          level: 'info',
          logger: (level, message) => console.log(`Neo4j ${level}: ${message}`)
        }
      });

      const session = driver.session();
      const result = await session.run('RETURN "Hello from Netlify!" as message, timestamp() as time');
      const record = result.records[0];
      
      await session.close();
      await driver.close();
      
      return {
        success: true,
        message: record.get('message'),
        timestamp: record.get('time').toString(),
        attempt: attempt,
        uri: uri
      };
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Enhanced Netlify → ngrok → Neo4j connection test');
    console.log('Environment variables:');
    console.log('- NEO4J_URI:', process.env.NEO4J_URI);
    console.log('- NEO4J_USER:', process.env.NEO4J_USER);
    console.log('- Function timeout:', context.getRemainingTimeInMillis?.() || 'unknown');
    
    const result = await connectWithRetry(
      process.env.NEO4J_URI,
      process.env.NEO4J_USER,
      process.env.NEO4J_PASSWORD
    );
    
    const duration = Date.now() - startTime;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ...result,
        duration: `${duration}ms`,
        lambda_region: process.env.AWS_REGION || 'unknown',
        function_name: context.functionName || 'unknown'
      })
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('💥 All connection attempts failed:', error.message);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        error_code: error.code,
        duration: `${duration}ms`,
        lambda_region: process.env.AWS_REGION || 'unknown',
        function_name: context.functionName || 'unknown',
        uri: process.env.NEO4J_URI,
        troubleshooting: {
          common_issues: [
            'AWS Lambda network restrictions',
            'ngrok tunnel instability',  
            'DNS resolution failures',
            'Connection timeout (30s Lambda limit)'
          ],
          recommendations: [
            'Try Railway.app or Render.com',
            'Use Neo4j Aura cloud service',
            'Enable ngrok paid plan for stability'
          ]
        }
      })
    };
  }
};
