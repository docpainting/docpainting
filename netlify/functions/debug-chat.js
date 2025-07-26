exports.handler = async (event, context) => {
  try {
    // Import CustomerManager (now working)
    const CustomerManager = require('../../rag-system/customer-manager');
    
    // Test CustomerManager instantiation
    const customerManager = new CustomerManager();
    
    // Test basic functionality step by step
    const testResults = {
      customerManagerLoaded: true,
      environmentVariables: {
        NEO4J_URI: !!process.env.NEO4J_URI,
        NEO4J_USERNAME: !!process.env.NEO4J_USERNAME,
        NEO4J_PASSWORD: !!process.env.NEO4J_PASSWORD,
        NEO4J_DATABASE: !!process.env.NEO4J_DATABASE,
        OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        EMAIL_HOST: !!process.env.EMAIL_HOST,
        EMAIL_USER: !!process.env.EMAIL_USER,
        EMAIL_PASS: !!process.env.EMAIL_PASS
      }
    };
    
    // Test customer creation
    try {
      const testCustomer = await customerManager.createCustomer('test@example.com', 'Test User');
      testResults.customerCreation = 'SUCCESS';
      testResults.customerId = testCustomer.id;
    } catch (error) {
      testResults.customerCreation = 'FAILED';
      testResults.customerError = error.message;
    }
    
    // Test a simple query
    try {
      const testQuery = 'Hello';
      const response = await customerManager.handleQuery(testCustomer.id, testQuery);
      testResults.queryHandling = 'SUCCESS';
      testResults.queryResponse = response ? 'Got response' : 'No response';
    } catch (error) {
      testResults.queryHandling = 'FAILED';
      testResults.queryError = error.message;
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'Chat diagnostic completed',
        results: testResults,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'Chat diagnostic failed',
        error: error.message,
        stack: error.stack.split('\n').slice(0, 10),
        timestamp: new Date().toISOString()
      })
    };
  }
};
