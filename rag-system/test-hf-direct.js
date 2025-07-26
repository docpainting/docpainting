// Direct HTTP test to Hugging Face API (bypass library issues)
require('dotenv').config();

async function testHuggingFaceDirect() {
  console.log('🔧 Testing Hugging Face API via Direct HTTP...');
  
  if (!process.env.HF_TOKEN) {
    console.log('❌ HF_TOKEN not found in environment variables');
    return;
  }
  
  console.log('HF_TOKEN: SET ✅');
  
  try {
    const testText = "Tell me about Marianne Abrams work experience";
    console.log(`📝 Test query: "${testText}"`);
    
    // Direct HTTP call to Hugging Face Inference API - Feature Extraction
    const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
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
    console.log(`🌐 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Error: ${response.status} - ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log('🎯 Raw API response:', typeof result, Array.isArray(result));
    
    if (Array.isArray(result) && Array.isArray(result[0])) {
      const embedding = result[0]; // First (and only) embedding
      console.log(`✅ SUCCESS! Embedding dimensions: ${embedding.length}`);
      console.log(`🎯 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      
      if (embedding.length === 1024) {
        console.log('🎉 Perfect! Expected 1024D for bge-large-en-v1.5');
      } else {
        console.log(`ℹ️  Got ${embedding.length}D - checking model specs`);
      }
      
      return embedding;
    } else {
      console.log('❌ Unexpected response format:', result);
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log('Full error:', error);
  }
}

// Run the test
testHuggingFaceDirect().then(() => {
  console.log('🏁 Direct HTTP test complete');
}).catch(console.error);
