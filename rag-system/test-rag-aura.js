// Test RAG system with Aura
const { CustomerManager } = require('./customer-manager');

async function testRAGWithAura() {
  console.log('🧪 Testing RAG system with Neo4j Aura...');
  
  const manager = new CustomerManager();
  
  try {
    console.log('🎨 Testing color query...');
    const response = await manager.handleQuery(
      'test-conversation-123',
      'What colors do you recommend for a living room?'
    );
    
    console.log('🎯 AI Response Source:', response.source);
    console.log('💬 Response Preview:', response.response.substring(0, 200) + '...');
    console.log('📊 Knowledge Items Found:', response.knowledgeItems?.length || 0);
    
    if (response.knowledgeItems && response.knowledgeItems.length > 0) {
      console.log('🔍 Sample Knowledge Items:');
      response.knowledgeItems.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i+1}. ${item.nodeType}: ${item.node.name || item.node.title || 'Unnamed'}`);
      });
    }
    
    console.log('✅ RAG system working with Aura!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testRAGWithAura();
