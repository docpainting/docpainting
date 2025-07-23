const { CustomerManager } = require('./customer-manager');
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function testNeo4jRAG() {
  console.log('🎨 Testing DOC Painting Neo4j RAG System with Qwen...\n');
  
  const manager = new CustomerManager();
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  try {
    // Step 1: Add some DOC Painting knowledge to Neo4j
    console.log('1. Adding DOC Painting knowledge to Neo4j...');
    await addDOCPaintingKnowledge(driver);
    console.log('✅ Knowledge added to database\n');

    // Step 2: Create customer and start conversation
    console.log('2. Creating customer and conversation...');
    const customer = await manager.createOrGetCustomer('sarah@example.com', {
      name: 'Sarah Johnson',
      phone: '617-555-0199'
    });
    
    const conversationId = await manager.startConversation(
      customer.uuid, 
      "I need exterior painting for my Victorian house in Boston"
    );
    console.log(`✅ Customer: ${customer.uuid}, Conversation: ${conversationId}\n`);

    // Step 3: Test RAG query searching for specific SuperDeck color
    console.log('3. Testing SuperDeck color search in Neo4j...');
    const colorResponse = await handleRAGQuery(manager, driver, conversationId, 
      "Is Seashell available in solid stain? I'm looking for that specific color."
    );
    
    console.log('🤖 AI Response about Seashell color:');
    console.log(colorResponse.response);
    console.log(`\n📊 Colors found: ${colorResponse.colorsFound}, Sources: ${colorResponse.sources.join(', ')}\n`);

    // Step 4: Test another color query
    console.log('4. Testing another color query...');
    const priceResponse = await handleRAGQuery(manager, driver, conversationId,
      "What other gray colors do you have available in SuperDeck stains?"
    );
    
    console.log('🤖 AI Pricing Response:');
    console.log(priceResponse.response);
    console.log(`\n📊 Sources: ${priceResponse.sources.join(', ')}\n`);

    console.log('🎉 Neo4j RAG test completed successfully!');
    
  } catch (error) {
    console.error('❌ RAG test failed:', error.message);
  } finally {
    await driver.close();
  }
}

async function addDOCPaintingKnowledge(driver) {
  const session = driver.session();
  const tx = session.beginTransaction();
  
  try {
    // Add DOC Painting specific knowledge
    const knowledge = [
      {
        id: 'victorian-expertise',
        title: 'Victorian House Restoration',
        content: 'DOC Painting specializes in Victorian house exterior restoration in Boston and South Shore. We have completed over 50 Victorian homes using period-appropriate techniques and Fine Paints of Europe premium materials.',
        category: 'expertise',
        tags: ['victorian', 'restoration', 'boston', 'exterior']
      },
      {
        id: 'materials-premium',
        title: 'Premium Materials Used',
        content: 'DOC Painting uses Fine Paints of Europe for high-end finishes, Penofin for deck restoration, and Brazilian Rosewood treatments. All materials are selected for durability in New England weather.',
        category: 'materials',
        tags: ['fine-paints-europe', 'penofin', 'brazilian-rosewood', 'premium']
      },
      {
        id: 'pricing-exterior',
        title: 'Exterior Painting Pricing',
        content: 'Typical exterior painting ranges: Small homes (1000-1500 sq ft) $8,000-$12,000, Medium homes (1500-2500 sq ft) $12,000-$18,000, Large Victorian homes (2500+ sq ft) $18,000-$30,000. Includes preparation, premium materials, and 5-year warranty.',
        category: 'pricing',
        tags: ['exterior', 'pricing', 'victorian', 'warranty']
      },
      {
        id: 'services-offered',
        title: 'Services Offered',
        content: 'DOC Painting offers: Interior & Exterior Painting, Historical Restoration, Faux Finishes, Deck Restoration, Cabinet Refinishing, Commercial Painting. Serving Boston, South Shore, and surrounding areas.',
        category: 'services',
        tags: ['interior', 'exterior', 'restoration', 'commercial', 'boston']
      }
    ];

    for (const item of knowledge) {
      await tx.run(`
        MERGE (k:Knowledge {id: $id})
        SET k.title = $title,
            k.content = $content,
            k.category = $category,
            k.tags = $tags,
            k.created_at = datetime(),
            k.updated_at = datetime()
      `, item);
    }

    await tx.commit();
    console.log(`Added ${knowledge.length} knowledge items to Neo4j`);
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await session.close();
  }
}

async function handleRAGQuery(manager, driver, conversationId, query) {
  const session = driver.session();
  
  try {
    // Step 1: Search Neo4j for SuperDeck colors
    console.log(`🔍 Searching Neo4j for: "${query}"`);
    
    // Search for specific colors mentioned in query
    const queryLower = query.toLowerCase();
    let colorSearchQuery = `
      MATCH (c:Color)
      WHERE `;
    
    if (queryLower.includes('seashell')) {
      colorSearchQuery += `c.name CONTAINS 'Seashell'`;
    } else if (queryLower.includes('gray')) {
      colorSearchQuery += `c.category CONTAINS 'Gray' OR c.name CONTAINS 'Gray'`;
    } else {
      colorSearchQuery += `c.product_line = 'SuperDeck'`;
    }
    
    colorSearchQuery += `
      RETURN c.code, c.name, c.category, c.type, c.product_line, c.brand
      LIMIT 10`;
    
    const colorResult = await session.run(colorSearchQuery);
    
    const colors = colorResult.records.map(record => ({
      code: record.get('c.code'),
      name: record.get('c.name'),
      category: record.get('c.category'),
      type: record.get('c.type'),
      productLine: record.get('c.product_line'),
      brand: record.get('c.brand')
    }));
    
    console.log(`🎨 Found ${colors.length} matching colors`);
    
    // Step 2: Create context from Neo4j color data
    let context = '';
    if (colors.length > 0) {
      context += 'AVAILABLE SUPERDECK COLORS:\n';
      colors.forEach(color => {
        context += `- ${color.code} ${color.name} (${color.category}) - ${color.type} finish\n`;
      });
      context += '\n';
    } else {
      context += 'No exact color matches found in database.\n\n';
    }
    
    // Step 3: Get conversation history
    const history = await manager.getConversationHistory(conversationId, 5);
    const historyContext = history.map(m => `${m.sender}: ${m.content}`).join('\n');
    
    // Step 4: Create enhanced prompt with Neo4j data
    const enhancedPrompt = `You are a knowledgeable representative of DOC Painting, a family-owned painting business.

COMPANY KNOWLEDGE FROM DATABASE:
${context}

CONVERSATION HISTORY:
${historyContext}

CUSTOMER QUESTION: ${query}

Instructions:
- Use the company knowledge from the database to provide accurate, specific answers
- Mention specific materials, pricing ranges, and expertise when relevant
- Always include contact information: (978) 408-5183 or thedoc@docpainting.com
- Be professional and helpful

Respond as DOC Painting:`;

    // Step 5: Get AI response using Qwen
    console.log('🤖 Querying Qwen with Neo4j context...');
    
    // Import and initialize LLM directly
    const { ChatOpenAI } = require('@langchain/openai');
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
    
    const response = await llm.invoke(enhancedPrompt);
    
    // Step 6: Store the AI response
    await manager.addMessage(conversationId, 'ai', response.content);
    
    return {
      response: response.content,
      sources: colors.length > 0 ? ['SuperDeck Color Database'] : ['General Knowledge'],
      colorsFound: colors.length,
      colors: colors
    };
    
  } catch (error) {
    console.error('RAG query error:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Run the test
testNeo4jRAG();
