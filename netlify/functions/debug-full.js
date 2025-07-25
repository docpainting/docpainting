// Complete debug function for both Neo4j and OpenRouter on Netlify
const neo4j = require('neo4j-driver');
const { ChatOpenAI } = require('@langchain/openai');

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
    const results = {
      timestamp: new Date().toISOString(),
      neo4j: {},
      openrouter: {},
      environment: {}
    };

    // Check environment variables
    const neo4jUri = process.env.NEO4J_URI;
    const neo4jUser = process.env.NEO4J_USER;
    const neo4jPassword = process.env.NEO4J_PASSWORD;
    const neo4jDatabase = process.env.NEO4J_DATABASE;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.APP_BASE_URL;

    results.environment = {
      neo4jUri: neo4jUri ? '✅ Set' : '❌ Missing',
      neo4jUser: neo4jUser || 'Missing',
      neo4jPassword: neo4jPassword ? '✅ Set' : '❌ Missing', 
      neo4jDatabase: neo4jDatabase || 'Missing',
      openrouterKey: openrouterKey ? `✅ Set (${openrouterKey.length} chars)` : '❌ Missing',
      baseUrl: baseUrl || 'Missing'
    };

    // Test Neo4j
    if (neo4jUri && neo4jUser && neo4jPassword) {
      try {
        const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
        const session = driver.session({ database: neo4jDatabase });

        // Test basic connection
        const basicTest = await session.run('RETURN "Neo4j works!" as message');
        results.neo4j.connection = basicTest.records[0].get('message');

        // Test Marianne data
        const marianneTest = await session.run('MATCH (p:Person {name: "Marianne Abrams"}) RETURN count(p) as count');
        results.neo4j.marianneCount = marianneTest.records[0].get('count').toNumber();

        // Test relationships
        const relTest = await session.run('MATCH (p:Person {name: "Marianne Abrams"})-[r]->() RETURN count(r) as relationships');
        results.neo4j.relationships = relTest.records[0].get('relationships').toNumber();

        // Test actual search query
        const searchTest = await session.run(`
          MATCH (p:Person {name: 'Marianne Abrams'})-[r]->(related)
          WHERE toLower($query) CONTAINS 'marianne' OR toLower($query) CONTAINS 'skill'
          RETURN count(related) as searchResults
        `, { query: "What technical skills does Marianne have?" });
        results.neo4j.searchResults = searchTest.records[0].get('searchResults').toNumber();

        await session.close();
        await driver.close();
        results.neo4j.status = '✅ Working';
      } catch (error) {
        results.neo4j.status = '❌ Failed';
        results.neo4j.error = error.message;
      }
    } else {
      results.neo4j.status = '❌ Missing credentials';
    }

    // Test OpenRouter
    if (openrouterKey) {
      try {
        const llm = new ChatOpenAI({
          model: 'qwen/qwen3-235b-a22b-2507:free',
          apiKey: openrouterKey,
          configuration: {
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
              'HTTP-Referer': baseUrl || 'https://docpainting.netlify.app',
              'X-Title': 'DOC Painting Debug'
            }
          }
        });

        const response = await llm.invoke([
          { role: 'user', content: 'Just say: OpenRouter working on Netlify!' }
        ]);

        results.openrouter.status = '✅ Working';
        results.openrouter.response = response.content;
        results.openrouter.model = 'qwen/qwen3-235b-a22b-2507:free';
      } catch (error) {
        results.openrouter.status = '❌ Failed';
        results.openrouter.error = error.message;
      }
    } else {
      results.openrouter.status = '❌ Missing API key';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};
