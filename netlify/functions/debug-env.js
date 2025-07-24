exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const envVars = {
      NEO4J_URI: process.env.NEO4J_URI || 'NOT_SET',
      NEO4J_USER: process.env.NEO4J_USER || 'NOT_SET', 
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ? 'SET_BUT_HIDDEN' : 'NOT_SET',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET_BUT_HIDDEN' : 'NOT_SET',
      APP_BASE_URL: process.env.APP_BASE_URL || 'NOT_SET',
      EMAIL_HOST: process.env.EMAIL_HOST || 'NOT_SET'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Environment Variables Check',
        environment: envVars,
        timestamp: new Date().toISOString()
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Debug function error',
        message: error.message
      })
    };
  }
};
