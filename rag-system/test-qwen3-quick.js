const neo4j = require('neo4j-driver');
require('dotenv').config();

// Quick test of Qwen3-Embedding-8B with Neo4j retrieval
async function testQwen3EmbeddingWithNeo4j() {
    console.log('🧪 Testing Qwen3-Embedding-8B with Neo4j Retrieval');
    console.log('================================================');
    
    let driver;
    
    try {
        // Test 1: Generate embedding with Qwen3
        console.log('\n📦 Step 1: Testing Qwen3-Embedding-8B generation...');
        console.log(`Model: ${process.env.HF_EMBEDDING_MODEL}`);
        console.log(`Endpoint: ${process.env.HF_EMBEDDING_ENDPOINT}`);
        console.log(`Dimensions: ${process.env.HF_EMBEDDING_DIMENSIONS}`);
        
        const testText = "What are Marianne's skills in accounting and finance?";
        console.log(`Test Query: "${testText}"`);
        
        const response = await fetch(process.env.HF_EMBEDDING_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: testText,
                model: process.env.HF_EMBEDDING_MODEL
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📊 Raw API Response preview:', JSON.stringify(result).substring(0, 200) + '...');
        
        let embedding;
        if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
            embedding = result[0];
        } else if (result.data && Array.isArray(result.data) && result.data.length > 0) {
            embedding = result.data[0].embedding || result.data[0];
        } else {
            throw new Error(`Unexpected embedding response format: ${JSON.stringify(result)}`);
        }
        
        console.log(`✅ Embedding generated successfully!`);
        console.log(`📏 Dimensions: ${embedding.length}`);
        console.log(`🔢 First 5 values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
        
        if (embedding.length !== parseInt(process.env.HF_EMBEDDING_DIMENSIONS)) {
            console.log(`⚠️  Warning: Expected ${process.env.HF_EMBEDDING_DIMENSIONS}D, got ${embedding.length}D`);
        }
        
        // Test 2: Connect to Neo4j
        console.log('\n🔗 Step 2: Connecting to Neo4j...');
        driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
        await driver.verifyConnectivity();
        console.log('✅ Neo4j connection successful!');
        
        // Test 3: Check vector indexes
        console.log('\n📊 Step 3: Checking available vector indexes...');
        const session = driver.session({ database: process.env.NEO4J_DATABASE });
        
        const indexResult = await session.run('SHOW INDEXES YIELD name, type WHERE type = "VECTOR" RETURN name ORDER BY name');
        const vectorIndexes = indexResult.records.map(record => record.get('name'));
        
        console.log(`📋 Found ${vectorIndexes.length} vector indexes:`);
        vectorIndexes.forEach(index => console.log(`  - ${index}`));
        
        if (vectorIndexes.length === 0) {
            throw new Error('No vector indexes found in Neo4j database');
        }
        
        // Test 4: Perform vector search on first available index
        console.log('\n🔍 Step 4: Testing vector search...');
        const testIndex = vectorIndexes[0];
        console.log(`Using index: ${testIndex}`);
        
        const searchResult = await session.run(
            `CALL db.index.vector.queryNodes($indexName, $k, $queryEmbedding) 
             YIELD node, score 
             RETURN node, score 
             ORDER BY score DESC 
             LIMIT 3`,
            {
                indexName: testIndex,
                k: 3,
                queryEmbedding: embedding
            }
        );
        
        console.log(`🎯 Search Results (${searchResult.records.length} found):`);
        searchResult.records.forEach((record, i) => {
            const node = record.get('node');
            const score = record.get('score').toFixed(4);
            const nodeType = node.labels ? node.labels[0] : 'Unknown';
            const nodeName = node.properties.name || node.properties.title || node.properties.text?.substring(0, 50) || 'Unnamed';
            console.log(`  ${i + 1}. [${nodeType}] "${nodeName}" (score: ${score})`);
        });
        
        await session.close();
        
        console.log('\n🎉 SUCCESS: Qwen3-Embedding-8B + Neo4j retrieval working perfectly!');
        console.log('================================================');
        
        return {
            success: true,
            embeddingDimensions: embedding.length,
            vectorIndexes: vectorIndexes.length,
            searchResults: searchResult.records.length
        };
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        return { success: false, error: error.message };
    } finally {
        if (driver) {
            await driver.close();
        }
    }
}

// Run the test
if (require.main === module) {
    testQwen3EmbeddingWithNeo4j()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Test completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Test failed!');
                process.exit(1);
            }
        });
}

module.exports = { testQwen3EmbeddingWithNeo4j };
