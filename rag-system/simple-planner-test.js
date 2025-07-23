const neo4j = require('neo4j-driver');
const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

async function testPlannerDirect() {
  console.log('🔍 Direct Planner Agent Test...\n');

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

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

  const session = driver.session();

  try {
    // Just get all nodes and their labels - no string operations
    console.log('🔍 Getting all nodes with their labels...');
    const result = await session.run(`
      MATCH (n)
      RETURN labels(n) as labels, keys(n) as props
      LIMIT 20
    `);

    console.log(`✅ Found ${result.records.length} nodes in database:`);
    
    let plannerNodes = [];
    result.records.forEach((record, i) => {
      const labels = record.get('labels');
      const props = record.get('props');
      
      console.log(`   ${i+1}. Labels: ${labels.join(':')} | Properties: ${props.join(', ')}`);
      
      // Look for planner/agent related labels or properties
      const hasPlanner = labels.some(l => l.toLowerCase().includes('planner') || l.toLowerCase().includes('agent')) ||
                         props.some(p => p.toLowerCase().includes('planner') || p.toLowerCase().includes('agent'));
      
      if (hasPlanner) {
        plannerNodes.push({ labels, props });
      }
    });

    if (plannerNodes.length > 0) {
      console.log(`\n🎯 Found ${plannerNodes.length} planner/agent related nodes!`);
      
      // Create a simple context for the LLM
      const context = `Found planner/agent related nodes in DOC Painting database:\n${plannerNodes.map(n => 
        `- ${n.labels.join(':')} with properties: ${n.props.join(', ')}`
      ).join('\n')}`;

      console.log('\n🤖 Asking Qwen about the planner agent...');
      
      const prompt = `You are a knowledgeable representative of DOC Painting, a family-owned painting business.

Based on this information from our knowledge base:
${context}

Customer question: Tell me about the planner agent

Respond professionally as DOC Painting. Explain what you know about the planner agent based on the available information.`;

      const response = await llm.invoke(prompt);
      
      console.log('\n🎨 QWEN RESPONSE:');
      console.log('============================================================');
      console.log(response.content);
      console.log('============================================================');
      
    } else {
      console.log('\n❌ No planner/agent nodes found in the visible results');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testPlannerDirect();
