const neo4j = require('neo4j-driver');
const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

async function searchCodeComponents() {
  console.log('🔍 Searching CodeComponent nodes for planner/agent...\n');

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
    // Search CodeComponent nodes by name
    console.log('🔍 Searching CodeComponent names for planner/agent...');
    const nameResult = await session.run(`
      MATCH (c:CodeComponent)
      WHERE c.name IS NOT NULL
      RETURN c.name as name, c.component_type as type, c.file_path as path
      ORDER BY c.name
      LIMIT 50
    `);

    console.log(`✅ Found ${nameResult.records.length} CodeComponents:`);
    
    let plannerComponents = [];
    nameResult.records.forEach((record, i) => {
      const name = record.get('name');
      const type = record.get('type');
      const path = record.get('path');
      
      console.log(`   ${i+1}. ${name} (${type}) - ${path}`);
      
      // Look for planner/agent in names
      if (name && (name.toLowerCase().includes('planner') || name.toLowerCase().includes('agent'))) {
        plannerComponents.push({ name, type, path });
      }
    });

    if (plannerComponents.length > 0) {
      console.log(`\n🎯 Found ${plannerComponents.length} planner/agent components!`);
      
      // Get detailed info about the planner components
      for (const comp of plannerComponents) {
        console.log(`\n📋 Getting details for: ${comp.name}`);
        const detailResult = await session.run(`
          MATCH (c:CodeComponent {name: $name})
          RETURN c.source_code as code, c.dependencies as deps, c.component_type as type
          LIMIT 1
        `, { name: comp.name });

        if (detailResult.records.length > 0) {
          const record = detailResult.records[0];
          const code = record.get('code');
          const deps = record.get('deps');
          const type = record.get('type');
          
          console.log(`   Type: ${type}`);
          console.log(`   Dependencies: ${deps ? deps.slice(0, 5).join(', ') : 'None'}`);
          console.log(`   Code snippet: ${code ? code.substring(0, 200) + '...' : 'No code'}`);
        }
      }
      
      // Ask Qwen about the planner agent
      console.log('\n🤖 Asking Qwen about the planner agent...');
      
      const context = `Found planner/agent components in DOC Painting codebase:\n${plannerComponents.map(c => 
        `- ${c.name} (${c.type}) at ${c.path}`
      ).join('\n')}`;

      const prompt = `You are a knowledgeable representative of DOC Painting, a family-owned painting business.

Based on this information from our code analysis system:
${context}

Customer question: Tell me about the planner agent

Respond professionally as DOC Painting. Explain what you know about the planner agent based on the available technical information, but translate it into customer-friendly language.`;

      const response = await llm.invoke(prompt);
      
      console.log('\n🎨 QWEN RESPONSE:');
      console.log('============================================================');
      console.log(response.content);
      console.log('============================================================');
      
    } else {
      console.log('\n❌ No planner/agent components found by name');
      
      // Let's try a broader search
      console.log('\n🔍 Trying broader search in component types...');
      const typeResult = await session.run(`
        MATCH (c:CodeComponent)
        WHERE c.component_type IS NOT NULL
        RETURN DISTINCT c.component_type as type, count(*) as count
        ORDER BY type
      `);

      console.log('📊 Component types in database:');
      typeResult.records.forEach(record => {
        const type = record.get('type');
        const count = record.get('count').toNumber();
        console.log(`   - ${type}: ${count} components`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

searchCodeComponents();
