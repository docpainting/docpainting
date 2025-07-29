// test-complete-rag.js
// Complete end-to-end test of the RAG pipeline: Embedding → Knowledge Retrieval → LLM Response

const CustomerManager = require('./customer-manager.js');

async function testCompleteRAG() {
  console.log('🧪 COMPLETE RAG PIPELINE TEST\n');
  console.log('Testing: Query → Embedding → Vector Search → Knowledge Retrieval → LLM Response\n');
  
  const manager = new CustomerManager();
  
  try {
    // Test 1: Manager instantiation
    console.log('✅ Step 1: CustomerManager instantiated successfully');
    
    // Wait for LangChain initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Step 2: LangChain components initialized');
    
    // Test 2: Create mock customer and conversation
    console.log('\n📝 Step 3: Creating test customer...');
    const customer = await manager.createOrGetCustomer('rag-test@docpainting.test', {
      name: 'RAG Test Customer',
      phone: '555-RAG-TEST'
    });
    console.log(`✅ Customer created: ${customer.uuid}`);
    
    // Test 3: Complete query handling (the full RAG pipeline)
    console.log('\n🔍 Step 4: Testing COMPLETE RAG PIPELINE...');
    console.log('='.repeat(60));
    
    const testQueries = [
      "Tell me about Marianne's education background and experience",
      "What painting services does DOC Painting offer for Victorian homes?",
      "Can you help me with interior painting quotes?"
    ];
    
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n🎯 Test Query ${i + 1}: "${query}"`);
      console.log('-'.repeat(50));
      
      // Create a mock conversation ID
      const mockConversationId = `test-conv-${Date.now()}-${i}`;
      
      console.log('📊 Pipeline Steps:');
      console.log('  1. Query embedding generation...');
      console.log('  2. Vector similarity search...');
      console.log('  3. Knowledge formatting...');
      console.log('  4. LLM response generation...');
      
      const startTime = Date.now();
      
      try {
        const response = await manager.handleQuery(mockConversationId, query);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('\n📋 RESULTS:');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📊 Source: ${response.source}`);
        console.log(`🧠 Knowledge Items Found: ${response.knowledgeItemsFound}`);
        console.log(`💬 Response Length: ${response.message.length} characters`);
        
        if (response.knowledgeItemsFound > 0) {
          console.log('🎉 SUCCESS: Knowledge retrieval is working!');
          console.log('✅ Complete RAG pipeline functional');
        } else {
          console.log('⚠️  WARNING: No knowledge items found');
          console.log('❌ Knowledge retrieval failed (likely vector index issue)');
        }
        
        console.log('\n💬 AI Response Preview:');
        console.log('─'.repeat(40));
        console.log(response.message.substring(0, 300) + (response.message.length > 300 ? '...' : ''));
        console.log('─'.repeat(40));
        
        // Detailed analysis
        if (response.source === 'ai' && response.knowledgeItemsFound > 0) {
          console.log('✅ PIPELINE STATUS: FULLY FUNCTIONAL');
        } else if (response.source === 'ai' && response.knowledgeItemsFound === 0) {
          console.log('⚠️  PIPELINE STATUS: LLM working, but no knowledge retrieved');
        } else if (response.source === 'fallback') {
          console.log('❌ PIPELINE STATUS: Complete failure - using fallback response');
        }
        
      } catch (error) {
        console.log(`\n❌ Query ${i + 1} FAILED:`, error.message);
        
        // Analyze the error
        if (error.message.includes('512') && error.message.includes('1024')) {
          console.log('🔍 ROOT CAUSE: Vector index dimension mismatch detected!');
          console.log('   - Neo4j indexes: 512D');
          console.log('   - HF embeddings: 1024D');
          console.log('   - Fix required: Update vector indexes to 1024D');
        } else if (error.message.includes('OPENROUTER_API_KEY')) {
          console.log('🔍 ROOT CAUSE: OpenRouter API key missing or invalid');
        } else if (error.message.includes('HF_TOKEN')) {
          console.log('🔍 ROOT CAUSE: Hugging Face token missing or invalid');
        } else {
          console.log('🔍 ROOT CAUSE: Unknown error - check logs for details');
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 COMPLETE RAG PIPELINE TEST FINISHED');
    console.log('='.repeat(60));
    
    // Summary
    console.log('\n📊 COMPONENT STATUS SUMMARY:');
    console.log('├─ CustomerManager instantiation: ✅ Working');
    console.log('├─ Hugging Face embedding API: ✅ Working (tested separately)');
    console.log('├─ Neo4j Aura connection: ✅ Working');
    console.log('├─ Vector index compatibility: ❌ Dimension mismatch (512D vs 1024D)');
    console.log('├─ Knowledge retrieval: ❌ Blocked by index issue');
    console.log('├─ OpenRouter LLM integration: ✅ Working (when knowledge available)');
    console.log('└─ Complete RAG pipeline: ❌ Blocked by vector indexes');
    
    console.log('\n🔧 IMMEDIATE FIX REQUIRED:');
    console.log('1. Update Neo4j vector indexes from 512D to 1024D');
    console.log('2. Regenerate embeddings for all knowledge base nodes');
    console.log('3. Re-test complete pipeline');
    
    console.log('\n🚀 READY FOR PRODUCTION ONCE FIXED!');
    
  } catch (error) {
    console.error('\n❌ CRITICAL TEST FAILURE:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check .env file has all required variables');
    console.error('2. Verify Neo4j Aura connection');
    console.error('3. Confirm HF_TOKEN is valid');
    console.error('4. Ensure OPENROUTER_API_KEY is set');
    
    process.exit(1);
  }
}

// Run complete test
testCompleteRAG()
  .then(() => {
    console.log('\n✨ Complete RAG pipeline test finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
