// netlify/functions/chat.js
// Netlify Function wrapper for DOC Painting RAG system
// Handles customer chat requests via serverless function

const { CustomerManager } = require('./customer-manager');

// Initialize customer manager
let customerManager;

const initManager = async () => {
  if (!customerManager) {
    customerManager = new CustomerManager();
    // Give it a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return customerManager;
};

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { message, email, conversationId } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Initialize manager
    const manager = await initManager();

    // Create or get customer
    const customerEmail = email || `anonymous_${Date.now()}@temp.com`;
    const customer = await manager.createOrGetCustomer(customerEmail, {
      source: 'website_chat',
      ip_address: event.headers['x-forwarded-for'] || 'unknown'
    });

    // Start or continue conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await manager.startConversation(customer.uuid, message);
    } else {
      // Add customer message to existing conversation
      await manager.addMessage(currentConversationId, 'customer', message);
    }

    // Handle the query and get AI response
    const result = await manager.handleQuery(currentConversationId, message);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        response: result.response,
        conversationId: currentConversationId,
        customerUuid: customer.uuid,
        knowledgeItemsFound: result.knowledge_items_found || 0,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Chat function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: 'Sorry, I encountered an issue. Please try again or call us at (978) 408-5183.'
      })
    };
  }
};
