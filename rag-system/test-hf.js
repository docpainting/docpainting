// Test Hugging Face Feature Extraction API (Pro Account)
require('dotenv').config();
const { HfInference } = require('@huggingface/inference');

async function testHuggingFace() {
  console.log('🔧 Testing Hugging Face Feature Extraction API...');
  console.log('HF_TOKEN:', process.env.HF_TOKEN ? 'SET ✅' : 'NOT SET ❌');
  
  if (!process.env.HF_TOKEN) {
    console.log('❌ HF_TOKEN not found in environment');
    return;
  }
  
  try {
    const hfClient = new HfInference(process.env.HF_TOKEN);
    console.log('🚀 Testing with PRO account - sentence-transformers/all-MiniLM-L6-v2...');
    
    const testText = "Tell me about Marianne Abrams work experience";
    console.log(`📝 Test query: "${testText}"`);
    
    const startTime = Date.now();
    // Test with Pro account - should work now!
    const response = await hfClient.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: testText,
    });
    const endTime = Date.now();
    
    const embedding = Array.isArray(response) ? response : response.data || response;
    
    console.log('✅ SUCCESS!');
    console.log(`📊 Embedding dimensions: ${embedding.length}`);
    console.log(`⏱️  Generation time: ${endTime - startTime}ms`);
    console.log(`🎯 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    
    // all-MiniLM-L6-v2 outputs 384 dimensions
    console.log('🎉 PRO ACCOUNT SUCCESS!');
    console.log(`📊 Embedding dimensions: ${embedding.length}`);
    if (embedding.length === 384) {
      console.log('✅ Perfect! Expected 384D for all-MiniLM-L6-v2');
    } else {
      console.log(`ℹ️  Got ${embedding.length}D - different model or version`);
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    console.log('Full error:', error);
  }
}

testHuggingFace().catch(console.error);
