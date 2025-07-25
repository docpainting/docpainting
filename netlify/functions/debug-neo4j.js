// Debug Neo4j connection for Netlify
const neo4j = require('neo4j-driver');

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
    // Get environment variables
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;
    const database = process.env.NEO4J_DATABASE;

    if (!uri || !user || !password) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Missing Neo4j environment variables',
          uri: uri ? '✅ Set' : '❌ Missing',
          user: user ? '✅ Set' : '❌ Missing',
          password: password ? '✅ Set' : '❌ Missing',
          database: database ? '✅ Set' : '❌ Missing'
        })
      };
    }

    // Test Neo4j connection
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const session = driver.session({ database });

    // Test basic query
    const result = await session.run('RETURN "Neo4j connection successful!" as message');
    const message = result.records[0].get('message');

    // Test Marianne data
    const marianneTest = await session.run('MATCH (p:Person {name: "Marianne Abrams"}) RETURN count(p) as count');
    const marianneCount = marianneTest.records[0].get('count').toNumber();

    // Test relationships
    const relTest = await session.run(`
      MATCH (p:Person {name: "Marianne Abrams"})
      OPTIONAL MATCH (p)-[r]->()
      RETURN count(r) as relationships
    `);
    const relationshipCount = relTest.records[0].get('relationships').toNumber();

    await session.close();
    await driver.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        connection: message,
        environment: {
          uri: uri,
          user: user,
          database: database
        },
        data: {
          mariannePersonNodes: marianneCount,
          relationships: relationshipCount
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
