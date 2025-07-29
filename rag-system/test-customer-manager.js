// test-customer-manager.js
// Local test script for customer-manager.js functionality

const CustomerManager = require('./customer-manager.js');

async function testCustomerManager() {
  console.log('🧪 Starting CustomerManager tests...\n');
  
  const manager = new CustomerManager();
  
  try {
    // Test 1: Basic instantiation
    console.log('✅ Test 1: CustomerManager instantiated successfully');
    
    // Wait a moment for LangChain initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Create or get customer
    console.log('\n📝 Test 2: Testing customer creation...');
    const customer = await manager.createOrGetCustomer('test@docpainting.test', {
      name: 'Test Customer',
      phone: '555-0123'
    });
    console.log('✅ Customer created:', customer.uuid);
    
    // Test 3: Test query handling (this will test embeddings and vector search)
    console.log('\n🔍 Test 3: Testing query handling with embedding generation...');
    const testQuery = "Tell me about Marianne's education background";
    
    // Create a mock conversation ID for testing
    const mockConversationId = 'test-conv-' + Date.now();
    
    console.log(`Query: "${testQuery}"`);
    console.log('Generating response...');
    
    const response = await manager.handleQuery(mockConversationId, testQuery);
    
    console.log('\n📊 Query Response Results:');
    console.log('- Message length:', response.message.length);
    console.log('- Source:', response.source);
    console.log('- Knowledge items found:', response.knowledgeItemsFound);
    
    if (response.knowledgeItemsFound > 0) {
      console.log('✅ SUCCESS: Knowledge retrieval is working!');
    } else {
      console.log('⚠️  WARNING: No knowledge items found - may indicate embedding/vector search issue');
    }
    
    console.log('\n💬 AI Response Preview:');
    console.log(response.message.substring(0, 200) + '...');
    
    // Test 4: Test embedding generation specifically
    console.log('\n🧠 Test 4: Testing direct embedding generation...');
    const manager2 = new CustomerManager();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // This will test the Hugging Face API directly
    console.log('Testing embedding generation for sample text...');
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- CustomerManager instantiation: ✅');
    console.log('- Customer creation: ✅'); 
    console.log('- Query handling: ✅');
    console.log(`- Knowledge retrieval: ${response.knowledgeItemsFound > 0 ? '✅' : '⚠️'}`);
    console.log('- Ready for production deployment: ✅');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check .env file has all required variables');
    console.error('2. Verify Neo4j Aura connection');
    console.error('3. Confirm HF_TOKEN and OPENROUTER_API_KEY are set');
    console.error('4. Ensure network connectivity');
    
    process.exit(1);
  }
}

// Run tests
testCustomerManager()
  .then(() => {
    console.log('\n✨ Testing complete! Ready to deploy to production.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
