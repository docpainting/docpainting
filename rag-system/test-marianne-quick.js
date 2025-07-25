// Quick test for Marianne knowledge retrieval
const CustomerManager = require('./customer-manager');

async function testMarianneQuery() {
  console.log('🧪 Testing Marianne knowledge retrieval...');
  
  try {
    const manager = new CustomerManager();
    
    // Create test customer and conversation
    const customer = await manager.createOrGetCustomer('test@example.com', 'Test User');
    const conversation = await manager.startConversation(customer.uuid);
    
    // Test Marianne query
    const query = "Tell me about Marianne Abrams' work experience";
    console.log(`Query: ${query}`);
    
    const result = await manager.handleQuery(conversation.id, query);
    
    console.log(`\n✅ Response: ${result.response.substring(0, 200)}...`);
    console.log(`📊 Knowledge items found: ${result.knowledgeItemsFound}`);
    console.log(`🔍 Source: ${result.source}`);
    
    await manager.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMarianneQuery();
