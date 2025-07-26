exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      neo4j_uri: process.env.NEO4J_URI ? 'SET' : 'NOT SET',
      neo4j_username: process.env.NEO4J_USERNAME ? 'SET' : 'NOT SET', 
      neo4j_password: process.env.NEO4J_PASSWORD ? 'SET' : 'NOT SET',
      neo4j_database: process.env.NEO4J_DATABASE ? 'SET' : 'NOT SET',
      openrouter_key: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET',
      email_host: process.env.EMAIL_HOST ? 'SET' : 'NOT SET',
      email_user: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
      email_pass: process.env.EMAIL_PASS ? 'SET' : 'NOT SET',
      timestamp: new Date().toISOString()
    })
  };
};
