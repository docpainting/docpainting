// test-hf-api.js
// Simple test for Hugging Face embedding API

require('dotenv').config();
const fetch = require('node-fetch');

async function testHuggingFaceAPI() {
  console.log('🧪 Testing Hugging Face API...\n');
  
  const testTexts = [
    "Tell me about Marianne's education background",
    "What painting services does DOC Painting offer?",
    "JavaScript programming skills"
  ];
  
  console.log('🔑 HF_TOKEN present:', process.env.HF_TOKEN ? 'Yes ✅' : 'No ❌');
  
  for (let i = 0; i < testTexts.length; i++) {
    const text = testTexts[i];
    console.log(`\n📝 Test ${i + 1}: "${text}"`);
    
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: [text] })
      });
      
      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText}`);
        continue;
      }
      
      const result = await response.json();
      
      // Handle different response formats
      const embedding = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
      
      if (Array.isArray(embedding) && embedding.length > 0) {
        console.log(`✅ Success! Generated ${embedding.length}D embedding`);
        console.log(`📈 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      } else {
        console.log(`❌ Invalid embedding format:`, typeof result, Array.isArray(result));
      }
      
    } catch (error) {
      console.log(`❌ Request failed:`, error.message);
    }
  }
  
  console.log('\n🎯 HF API Test Complete!');
}

testHuggingFaceAPI().catch(console.error);
