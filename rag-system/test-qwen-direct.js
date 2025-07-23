const { ChatOpenAI } = require('@langchain/openai');
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function testQwenWithSeashell() {
  console.log('🎨 Testing Qwen LLM with Seashell query...\n');

  // Initialize Qwen LLM
  const llm = new ChatOpenAI({
    model: 'qwen/qwen3-235b-a22b-07-25:free',
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://docpainting.netlify.app',
        'X-Title': 'DOC Painting Customer Service'
      }
    }
  });

  // Initialize Neo4j
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  try {
    // Step 1: Search Neo4j for Seashell
    console.log('🔍 Searching Neo4j for Seashell...');
    const session = driver.session();
    
    const result = await session.run(`
      MATCH (c:Color)
      WHERE c.name CONTAINS 'Seashell'
      RETURN c.code, c.name, c.category, c.type, c.product_line, c.brand
    `);
    
    const colors = result.records.map(record => ({
      code: record.get('c.code'),
      name: record.get('c.name'),
      category: record.get('c.category'),
      type: record.get('c.type'),
      productLine: record.get('c.product_line'),
      brand: record.get('c.brand')
    }));
    
    await session.close();
    
    console.log(`✅ Found ${colors.length} Seashell colors:`);
    colors.forEach(color => {
      console.log(`   - ${color.code} ${color.name} (${color.category}) - ${color.type} by ${color.brand}`);
    });
    
    // Step 2: Create context for LLM
    const context = colors.length > 0 
      ? `AVAILABLE SEASHELL COLOR:\n- ${colors[0].code} ${colors[0].name} (${colors[0].category}) - ${colors[0].type} finish by ${colors[0].brand}\n\n`
      : 'No Seashell color found in database.\n\n';
    
    // Step 3: Create enhanced prompt
    const prompt = `You are a knowledgeable representative of DOC Painting, a family-owned painting business.

SUPERDECK COLOR DATABASE RESULTS:
${context}

CUSTOMER QUESTION: "Is Seashell available in solid stain? I'm looking for that specific color."

Instructions:
- Use the database results to provide accurate information about Seashell availability
- If Seashell is only available in semi-transparent (not solid), explain the difference clearly
- Mention that semi-transparent stains enhance wood grain visibility while solid stains provide full coverage
- Be helpful and offer alternatives or contact information
- Include contact: (978) 408-5183 or thedoc@docpainting.com

Respond professionally as DOC Painting:`;

    // Step 4: Get Qwen response
    console.log('\n🤖 Querying Qwen LLM...');
    const response = await llm.invoke(prompt);
    
    console.log('\n🎨 QWEN RESPONSE:');
    console.log('=' .repeat(60));
    console.log(response.content);
    console.log('=' .repeat(60));
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await driver.close();
  }
}

// Run the test
testQwenWithSeashell();
