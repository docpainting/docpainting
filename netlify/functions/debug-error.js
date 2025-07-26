exports.handler = async (event, context) => {
  try {
    const CustomerManager = require('../../rag-system/customer-manager');
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
