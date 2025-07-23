const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Neo4j driver
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'DOC Painting RAG API',
    model: 'qwen/qwen3-235b-a22b-07-25:free',
    colors_available: '173 SuperDeck colors',
    timestamp: new Date().toISOString()
  });
});

// Main chat endpoint for curl testing
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        example: 'curl -X POST http://localhost:3001/api/chat -H "Content-Type: application/json" -d \'{"message":"Is Seashell available in solid stain?"}\''
      });
    }

    console.log(`🎨 Customer query: "${message}"`);

    // Search Neo4j for ANY relevant information (colors, services, agents, etc.)
    const session = driver.session();
    const searchTerm = extractKeywordsFromMessage(message);
    
    // Search across all node types - handle both colors and code components
    let searchResult;
    
    // First try to search for colors (simple case)
    const colorResult = await session.run(`
      MATCH (c:Color)
      WHERE c.name CONTAINS $searchTerm OR c.category CONTAINS $searchTerm
      RETURN 'Color' as nodeType, labels(c) as nodeLabels, c as node
      LIMIT 10
    `, { searchTerm });
    
    // Then search for code components by name (avoiding array issues)
    const codeResult = await session.run(`
      MATCH (c:CodeComponent)
      WHERE c.name IS NOT NULL AND toLower(c.name) CONTAINS toLower($searchTerm)
      RETURN 'CodeComponent' as nodeType, labels(c) as nodeLabels, c as node
      LIMIT 10
    `, { searchTerm });
    
    // Combine results
    const allRecords = [...colorResult.records, ...codeResult.records];
    searchResult = { records: allRecords };

    const foundData = searchResult.records.map(record => {
      const nodeType = record.get('nodeType');
      const labels = record.get('nodeLabels');
      const node = record.get('node').properties;
      return {
        type: nodeType,
        labels: labels,
        properties: node
      };
    });

    await session.close();

    // Create context from found data
    let knowledgeContext = '';
    if (foundData.length > 0) {
      knowledgeContext = `\nRelevant information from DOC Painting knowledge base:\n${foundData.map(item => {
        const labels = item.labels.join(':');
        
        if (item.type === 'Color') {
          // Handle color data
          const props = Object.entries(item.properties)
            .filter(([key, value]) => value && key !== 'created_at' && key !== 'updated_at')
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          return `- ${labels}: ${props}`;
        } else if (item.type === 'CodeComponent') {
          // Handle code component data (avoid arrays)
          const name = item.properties.name || 'Unknown';
          const type = item.properties.component_type || 'Unknown';
          const path = item.properties.file_path || 'Unknown path';
          return `- ${labels}: ${name} (${type}) at ${path}`;
        } else {
          // Fallback for other types
          const props = Object.entries(item.properties)
            .filter(([key, value]) => value && key !== 'created_at' && key !== 'updated_at' && !Array.isArray(value))
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          return `- ${labels}: ${props}`;
        }
      }).join('\n')}`;
    }

    // Create enhanced prompt with Neo4j data
    const enhancedPrompt = `You are a knowledgeable representative of DOC Painting, a family-owned painting business serving Boston and the South Shore.

Company specialties:
- Interior & Exterior Painting
- Historical Restoration (Victorian homes)
- High-end Faux Finishes with Fine Paints of Europe
- Deck Restoration with Brazilian Rosewood & Penofin
- Cabinet Refinishing
- Commercial Painting

Contact: (978) 408-5183 or thedoc@docpainting.com
Color Reference: https://www.sherwin-williams.com/en-us/color

${knowledgeContext}

Customer question: ${message}

Respond professionally as DOC Painting. Use the knowledge base information to provide accurate, detailed answers. Include specific details when relevant. If you need more information for a quote, ask for project details and offer to connect them with our team.`;

    // Get AI response
    const response = await llm.invoke(enhancedPrompt);

    // Return structured response
    res.json({
      success: true,
      query: message,
      knowledge_items_found: foundData.length,
      response: response.content,
      timestamp: new Date().toISOString(),
      model: 'qwen/qwen3-235b-a22b-07-25:free'
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Please try again or contact DOC Painting directly at (978) 408-5183'
    });
  }
});

// Helper function to extract keywords from messages
function extractKeywordsFromMessage(message) {
  const keywords = ['planner', 'agent', 'seashell', 'brown', 'gray', 'blue', 'green', 'red', 'white', 'black', 'tan', 'cedar', 'service', 'paint', 'stain', 'deck', 'color'];
  const lowerMessage = message.toLowerCase();
  
  for (const keyword of keywords) {
    if (lowerMessage.includes(keyword)) {
      return keyword;
    }
  }
  
  // Extract first meaningful word if no keywords found
  const words = message.toLowerCase().split(' ').filter(word => word.length > 3);
  return words[0] || 'paint';
}

// Start server
app.listen(PORT, () => {
  console.log(`🎨 DOC Painting RAG API Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`\n🧪 Test with curl:`);
  console.log(`curl -X POST http://localhost:${PORT}/api/chat -H "Content-Type: application/json" -d '{"message":"Is Seashell available in solid stain?"}'`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await driver.close();
  process.exit(0);
});
