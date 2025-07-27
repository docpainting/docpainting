// Simple embedding test for production debugging
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  console.log('🔍 Testing embedding generation in production...');
  
  try {
    // Test 1: Check environment variables
    const envCheck = {
      HF_TOKEN: process.env.HF_TOKEN ? 'SET ✅' : 'MISSING ❌',
      NEO4J_URI: process.env.NEO4J_URI ? 'SET ✅' : 'MISSING ❌',
      NEO4J_USERNAME: process.env.NEO4J_USERNAME ? 'SET ✅' : 'MISSING ❌',
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ? 'SET ✅' : 'MISSING ❌'
    };
    
    console.log('Environment check:', envCheck);
    
    // Test 2: Try embedding generation
    let embeddingTest = { status: 'FAILED', error: 'Unknown' };
    
    if (process.env.HF_TOKEN) {
      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HF_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: ['test query about Marianne skills'] })
        });
        
        if (response.ok) {
          const result = await response.json();
          const embedding = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
          
          embeddingTest = {
            status: 'SUCCESS ✅',
            embedding_length: Array.isArray(embedding) ? embedding.length : 'Invalid format',
            sample: Array.isArray(embedding) ? embedding.slice(0, 3) : 'No array'
          };
        } else {
          const errorText = await response.text();
          embeddingTest = {
            status: 'FAILED ❌',
            error: `HTTP ${response.status}: ${errorText}`
          };
        }
      } catch (embeddingError) {
        embeddingTest = {
          status: 'FAILED ❌',
          error: embeddingError.message
        };
      }
    } else {
      embeddingTest = {
        status: 'FAILED ❌',
        error: 'HF_TOKEN not set'
      };
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      environment: envCheck,
      embedding_test: embeddingTest,
      conclusion: embeddingTest.status === 'SUCCESS ✅' ? 
        'Embedding generation WORKS - issue is elsewhere' : 
        'Embedding generation FAILED - this is the root cause'
    };
    
    console.log('🎯 Embedding test result:', JSON.stringify(result, null, 2));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result, null, 2)
    };
    
  } catch (error) {
    console.error('❌ Embedding test failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Embedding test failed',
        message: error.message,
        stack: error.stack
      }, null, 2)
    };
  }
};
