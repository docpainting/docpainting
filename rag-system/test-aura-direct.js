// Direct test of Aura database with OpenRouter model
const { CustomerManager } = require('./customer-manager');

async function testAuraDirectly() {
  console.log('🔥 DIRECT TEST: Neo4j Aura + OpenRouter with populated data');
  console.log('================================================================');
  
  try {
    const manager = new CustomerManager();
    
    // Create test customer and conversation
    console.log('1. Creating customer...');
    const customer = await manager.createOrGetCustomer('aura-test@example.com', 'Aura Test User');
    console.log(`✅ Customer created: ${customer.uuid}`);
    
    console.log('2. Starting conversation...');
    const conversation = await manager.startConversation(customer.uuid);
    console.log(`✅ Conversation started: ${conversation.id}`);
    
    // Test Victorian house query (should find Project nodes)
    console.log('3. Testing Victorian house query...');
    const query = "What experience do you have with Victorian house painting?";
    console.log(`Query: "${query}"`);
    
    const result = await manager.handleQuery(conversation.id, query);
    
    console.log('\n🎯 RESULTS:');
    console.log('================================================================');
    console.log(`Knowledge Items Found: ${result.knowledgeItemsFound}`);
    console.log(`Response Source: ${result.source}`);
    console.log(`Response Length: ${result.response.length} characters`);
    console.log('----------------------------------------------------------------');
    console.log('AI Response:');
    console.log(result.response);
    console.log('================================================================');
    
    if (result.knowledgeItemsFound > 0) {
      console.log('🎉 SUCCESS: Knowledge retrieval working! Found data from Aura!');
    } else {
      console.log('❌ ISSUE: Still getting 0 knowledge items - fallback response');
    }
    
    await manager.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAuraDirectly();
