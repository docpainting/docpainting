// Test Hugging Face Router embedding endpoint
require('dotenv').config();
const fetch = require('node-fetch');

async function query(data) {
    try {
        console.log('📡 Making request to HF Router...');
        const response = await fetch(
            "https://router.huggingface.co/nebius/v1/embeddings",
            {
                headers: {
                    Authorization: `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify(data),
            }
        );
        
        console.log(`📊 Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        throw error;
    }
}

async function testEmbedding() {
    console.log('🧪 Testing HF Router embedding endpoint...');
    
    try {
        const testTexts = [
            "Marianne Abrams - Senior Financial Analyst",
            "Financial analysis and accounts payable management",
            "Oracle and QuickBooks expertise"
        ];
        
        for (const text of testTexts) {
            console.log(`\n📝 Testing: "${text}"`);
            
            const response = await query({ 
                input: text,
                model: process.env.HF_EMBEDDING_MODEL // Use .env model
            });
            
            console.log('Response structure:', Object.keys(response));
            
            if (response.data && Array.isArray(response.data)) {
                const embedding = response.data[0]?.embedding;
                if (embedding) {
                    console.log(`✅ Embedding dimensions: ${embedding.length}`);
                    console.log(`🎯 First 5 values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
                } else {
                    console.log('❌ No embedding found in response.data[0]');
                }
            } else if (Array.isArray(response)) {
                // Direct array response
                console.log(`✅ Direct array embedding dimensions: ${response.length}`);
                console.log(`🎯 First 5 values: [${response.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
            } else {
                console.log('❓ Unexpected response format:', response);
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing embedding:', error);
    }
}

testEmbedding();
