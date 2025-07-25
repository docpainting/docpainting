// Test the updated AI system with Marianne Abrams questions
const { CustomerManager } = require('./customer-manager');

async function testMarianneQuestions() {
  const cm = new CustomerManager();
  
  // Create a customer and conversation for testing
  const customer = await cm.createOrGetCustomer('test@example.com');
  const conversationId = await cm.startConversation(customer.uuid);
  
  console.log('🧠 Testing Enhanced AI System with Marianne Questions...\n');
  
  const testQuestions = [
    "hi tell me where marianne abrams went to school",
    "What companies has Marianne worked for?",
    "What are Marianne's technical skills?",
    "What languages does Marianne speak?",
    "Tell me about Marianne's experience at PwC",
    "What education does Marianne have?",
    "What are Marianne's career objectives?",
    "What paint colors do you have for deck staining?" // Should still work for painting
  ];
  
  for (const question of testQuestions) {
    console.log(`❓ Question: "${question}"`);
    try {
      const response = await cm.handleQuery(conversationId, question);
      console.log(`🤖 Response: ${response.response}\n`);
      console.log(`📊 Knowledge items found: ${response.knowledge_items_found || 0}\n`);
      console.log('─'.repeat(80) + '\n');
    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('✅ Testing complete!');
}

testMarianneQuestions().catch(console.error);
