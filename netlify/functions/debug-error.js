exports.handler = async (event, context) => {
  try {
    // Import CustomerManager with explicit destructuring
    const { CustomerManager } = require('../../rag-system/customer-manager');
    
    // Validate CustomerManager is properly imported
    if (typeof CustomerManager !== 'function') {
      throw new Error(`CustomerManager import failed. Type: ${typeof CustomerManager}`);
    }
    
    const manager = new CustomerManager();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'CustomerManager loaded successfully',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: 'ERROR',
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5),
        timestamp: new Date().toISOString()
      })
    };
  }
};
