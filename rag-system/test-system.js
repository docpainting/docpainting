const { CustomerManager } = require('./customer-manager');

async function testDOCPaintingRAG() {
  console.log('🎨 Testing DOC Painting RAG System...\n');
  
  try {
    const manager = new CustomerManager();
    
    // Test 1: Create a customer
    console.log('1. Creating customer...');
    const customer = await manager.createOrGetCustomer('john@example.com', {
      name: 'John Smith',
      phone: '617-555-0123'
    });
    console.log(`✅ Customer created: ${customer.uuid}\n`);
    
    // Test 2: Start conversation
    console.log('2. Starting conversation...');
    const conversationId = await manager.startConversation(
      customer.uuid, 
      "Hi, I need help painting my Victorian house exterior in Boston"
    );
    console.log(`✅ Conversation started: ${conversationId}\n`);
    
    // Test 3: Handle customer query
    console.log('3. Processing customer query...');
    const response = await manager.handleQuery(
      conversationId,
      "What would be the cost for a 2000 sq ft Victorian house exterior?"
    );
    console.log(`✅ AI Response: ${response.response}\n`);
    
    // Test 4: Get conversation history
    console.log('4. Retrieving conversation history...');
    const history = await manager.getConversationHistory(conversationId);
    console.log(`✅ Found ${history.length} messages in conversation\n`);
    
    // Test 5: Get customer analytics
    console.log('5. Getting customer analytics...');
    const analytics = await manager.getCustomerAnalytics('7 days');
    if (analytics) {
      console.log(`✅ Analytics: ${analytics.get('total_customers')} customers, ${analytics.get('total_conversations')} conversations\n`);
    }
    
    console.log('🎉 All tests passed! DOC Painting RAG system is ready!\n');
    
    console.log('📋 System Features:');
    console.log('- ✅ Customer tracking with UUID');
    console.log('- ✅ Conversation management');
    console.log('- ✅ AI-powered responses');
    console.log('- ✅ Message classification');
    console.log('- ✅ Analytics and reporting');
    console.log('- ✅ OpenRouter integration');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testDOCPaintingRAG();
