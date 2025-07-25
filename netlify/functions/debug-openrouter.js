// Debug OpenRouter connection for Netlify
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
    // Check environment variables
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.APP_BASE_URL;

    if (!openrouterKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Missing OpenRouter API key',
          openrouterKey: openrouterKey ? '✅ Set' : '❌ Missing',
          baseUrl: baseUrl ? '✅ Set' : '❌ Missing'
        })
      };
    }

    // Test OpenRouter connection
    const llm = new ChatOpenAI({
      model: 'qwen/qwen3-235b-07-25:free',
      apiKey: openrouterKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': baseUrl || 'https://docpainting.netlify.app',
          'X-Title': 'DOC Painting Customer Service Agent'
        }
      }
    });

    // Test simple LLM call
    const response = await llm.invoke([
      { role: 'user', content: 'Hello! Just reply with "OpenRouter connection successful!"' }
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        openrouterConnection: 'Working',
        testResponse: response.content,
        environment: {
          hasOpenrouterKey: !!openrouterKey,
          hasBaseUrl: !!baseUrl,
          keyLength: openrouterKey ? openrouterKey.length : 0
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
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};
