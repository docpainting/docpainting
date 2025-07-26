// Test Hugging Face API in Netlify Functions environment
exports.handler = async (event, context) => {
  console.log('🔧 Testing Hugging Face API in Netlify Functions...');
  
  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'HF_TOKEN not found in environment variables',
        success: false
      })
    };
  }
  
  try {
    const testText = "Tell me about Marianne Abrams work experience";
    console.log(`📝 Test query: "${testText}"`);
    
    // Direct HTTP call to Hugging Face Inference API - same as local test
    const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [testText], // Array format for feature extraction
        options: {
          wait_for_model: true
        }
      })
    });

    console.log(`🌐 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Error: ${response.status} - ${errorText}`);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: `Hugging Face API Error: ${response.status} - ${errorText}`,
          success: false
        })
      };
    }

    const result = await response.json();
    
    if (Array.isArray(result) && Array.isArray(result[0])) {
      const embedding = result[0]; // First (and only) embedding
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: `✅ SUCCESS! Hugging Face embeddings working in production!`,
          dimensions: embedding.length,
          model: 'BAAI/bge-large-en-v1.5',
          preview: embedding.slice(0, 5).map(v => parseFloat(v.toFixed(4))),
          testQuery: testText,
          timestamp: new Date().toISOString()
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Unexpected response format from Hugging Face API',
          response: result,
          success: false
        })
      };
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        success: false
      })
    };
  }
};
