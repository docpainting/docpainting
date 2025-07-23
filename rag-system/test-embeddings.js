// test-embeddings.js
// Test embedding model compatibility with Neo4j

const { CustomerManager } = require('./customer-manager');
require('dotenv').config();

async function testEmbeddingCompatibility() {
  console.log('🧠 Testing Embedding Model Compatibility\n');
  
  const manager = new CustomerManager();
  
  try {
    // Test different text inputs
    const testTexts = [
      'seashell brown deck stain',
      'interior painting service',
      'exterior house painting quote',
      'historical restoration Victorian home'
    ];
    
    console.log('Testing embedding generation...\n');
    
    for (const text of testTexts) {
      console.log(`📝 Text: "${text}"`);
      
      // This will use the embedding model configured in customer-manager
      const customer = await manager.createOrGetCustomer('test@embeddings.com');
      const convId = await manager.startConversation(customer.uuid);
      const msgId = await manager.addMessage(convId, 'customer', text);
      
      // Check if embedding was added
      const result = await manager._runInTx(`
        MATCH (m:Message {id: $msgId})
        RETURN m.embedding_dims as dims, size(m.embedding) as actual_size, 
               m.embedding[0..3] as sample
      `, { msgId }, 'READ');
      
      if (result.records.length > 0) {
        const record = result.records[0];
        const dims = record.get('dims');
        const actualSize = record.get('actual_size');
        const sample = record.get('sample');
        
        console.log(`✅ Embedding: ${dims} dimensions, actual size: ${actualSize}`);
        console.log(`   Sample values: [${sample.map(v => v.toFixed(4)).join(', ')}...]`);
        console.log(`   Neo4j storage: ${typeof sample[0]} (${sample[0].constructor.name})\n`);
      } else {
        console.log('❌ No embedding found\n');
      }
    }
    
    console.log('🎯 Testing semantic search...');
    const convId = await manager.startConversation(
      (await manager.createOrGetCustomer('semantic@test.com')).uuid
    );
    
    const response = await manager.handleQuery(convId, 'What colors do you have for deck staining?');
    console.log(`\n📋 Response: ${response.response.substring(0, 200)}...`);
    console.log(`🔍 Knowledge items found: ${response.knowledge_items_found || 0}`);
    console.log(`📊 Confidence: ${response.confidence}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testEmbeddingCompatibility();
