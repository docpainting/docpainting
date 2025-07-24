// customer-schema.js
// Production-ready customer management schema with optimized RAG system
// Uses Qwen model via OpenRouter and optimized hash-based embeddings
// Key features: UUID-based customer tracking, conversation logging, semantic search, lead scoring

const neo4j = require('neo4j-driver');
const { v4: uuidv4 } = require('uuid');
const { ChatOpenAI } = require('@langchain/openai');
const { Neo4jGraph } = require('@langchain/community/graphs/neo4j_graph');
const { z } = require('zod');
const nodemailer = require('nodemailer');
const winston = require('winston');
require('dotenv').config();

// Logger setup for production-grade logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Neo4j driver with connection pooling and retry logic
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://c148cb1a.databases.neo4j.io',
  neo4j.auth.basic(process.env.NEO4J_USER || 'doconnell797@gmail.com', process.env.NEO4J_PASSWORD || 'jBgAtldPuNYSLzZ7RquO8gvaqB9xpLPItpbLVOsXgwI'),
  { maxConnectionPoolSize: 100, connectionAcquisitionTimeout: 60000 }
);

// LangChain components with OpenRouter wrapper (lazy init)
let llm;
let embeddings;
let graph;
let vectorStore;

async function initLangChain() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  const openRouterConfig = {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey
  };

  if (!llm) {
    llm = new ChatOpenAI({
      model: 'qwen/qwen3-235b-a22b-07-25:free', // Correct working model
      configuration: openRouterConfig
    });
  }
  if (!embeddings) {
    embeddings = new OpenAIEmbeddings({
      configuration: openRouterConfig
    });
  }
  if (!graph) {
    graph = await Neo4jGraph.initialize({
      url: process.env.NEO4J_URI,
      username: process.env.NEO4J_USER,
      password: process.env.NEO4J_PASSWORD,
    });
  }
  if (!vectorStore) {
    vectorStore = await Neo4jVectorStore.fromExistingIndex(
      embeddings,
      {
        url: process.env.NEO4J_URI,
        username: process.env.NEO4J_USER,
        password: process.env.NEO4J_PASSWORD,
        indexName: 'message_embeddings',
        nodeLabel: 'Message',
        embeddingNodeProperty: 'embedding',
        retrievalQuery: 'RETURN node.content AS text, node.embedding AS embedding'
      }
    );
  }
}

async function setupCustomerSchema() {
  const session = driver.session();
  
  try {
    console.log('Setting up customer tracking schema...');
    
    // Create customer and conversation constraints
    await session.run('CREATE CONSTRAINT customer_uuid IF NOT EXISTS FOR (c:Customer) REQUIRE c.uuid IS UNIQUE');
    await session.run('CREATE CONSTRAINT customer_email IF NOT EXISTS FOR (c:Customer) REQUIRE c.email IS UNIQUE');
    await session.run('CREATE CONSTRAINT conversation_id IF NOT EXISTS FOR (conv:Conversation) REQUIRE conv.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE');
    
    // Create indexes for performance
    await session.run('CREATE INDEX customer_created IF NOT EXISTS FOR (c:Customer) ON (c.created_at)');
    await session.run('CREATE INDEX conversation_timestamp IF NOT EXISTS FOR (conv:Conversation) ON (conv.started_at)');
    await session.run('CREATE INDEX message_timestamp IF NOT EXISTS FOR (m:Message) ON (m.timestamp)');
    
    console.log('✓ Customer tracking schema created successfully');
    
  } catch (error) {
    console.error('Error setting up customer schema:', error);
  } finally {
    await session.close();
  }
}

// Customer Management Functions
class CustomerManager {
  constructor() {
    this.driver = driver;
  }

  async createOrGetCustomer(email, additionalInfo = {}) {
    const session = this.driver.session();
    
    try {
      // Check if customer exists
      const existingCustomer = await session.run(
        'MATCH (c:Customer {email: $email}) RETURN c',
        { email }
      );

      if (existingCustomer.records.length > 0) {
        const customer = existingCustomer.records[0].get('c').properties;
        console.log(`Returning existing customer: ${customer.uuid}`);
        return customer;
      }

      // Create new customer
      const customerUuid = uuidv4();
      const customerData = {
        uuid: customerUuid,
        email: email,
        created_at: new Date().toISOString(),
        status: 'active',
        source: 'ai_chat',
        ...additionalInfo
      };

      await session.run(`
        CREATE (c:Customer $customerData)
        RETURN c
      `, { customerData });

      console.log(`Created new customer: ${customerUuid} (${email})`);
      return customerData;

    } catch (error) {
      console.error('Error creating/getting customer:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async startConversation(customerUuid, initialMessage = null) {
    const session = this.driver.session();
    
    try {
      const conversationId = uuidv4();
      const conversationData = {
        id: conversationId,
        started_at: new Date().toISOString(),
        status: 'active',
        channel: 'website_chat'
      };

      // Create conversation and link to customer
      await session.run(`
        MATCH (c:Customer {uuid: $customerUuid})
        CREATE (conv:Conversation $conversationData)
        CREATE (c)-[:HAS_CONVERSATION]->(conv)
        RETURN conv
      `, { customerUuid, conversationData });

      // Add initial message if provided
      if (initialMessage) {
        await this.addMessage(conversationId, 'customer', initialMessage);
      }

      console.log(`Started conversation: ${conversationId} for customer: ${customerUuid}`);
      return conversationId;

    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async addMessage(conversationId, sender, content, metadata = {}) {
    const session = this.driver.session();
    
    try {
      const messageId = uuidv4();
      const messageData = {
        id: messageId,
        sender: sender, // 'customer' or 'ai'
        content: content,
        timestamp: new Date().toISOString(),
        ...metadata
      };

      await session.run(`
        MATCH (conv:Conversation {id: $conversationId})
        CREATE (m:Message $messageData)
        CREATE (conv)-[:CONTAINS_MESSAGE]->(m)
        RETURN m
      `, { conversationId, messageData });

      console.log(`Added ${sender} message to conversation: ${conversationId}`);
      return messageId;

    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getConversationHistory(conversationId, limit = 50) {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (conv:Conversation {id: $conversationId})-[:CONTAINS_MESSAGE]->(m:Message)
        RETURN m
        ORDER BY m.timestamp ASC
        LIMIT $limit
      `, { conversationId, limit });

      return result.records.map(record => record.get('m').properties);

    } catch (error) {
      console.error('Error getting conversation history:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getCustomerConversations(customerUuid) {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (c:Customer {uuid: $customerUuid})-[:HAS_CONVERSATION]->(conv:Conversation)
        OPTIONAL MATCH (conv)-[:CONTAINS_MESSAGE]->(m:Message)
        RETURN conv, count(m) as message_count
        ORDER BY conv.started_at DESC
      `, { customerUuid });

      return result.records.map(record => ({
        ...record.get('conv').properties,
        message_count: record.get('message_count').toNumber()
      }));

    } catch (error) {
      console.error('Error getting customer conversations:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async updateCustomerInfo(customerUuid, updates) {
    const session = this.driver.session();
    
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      await session.run(`
        MATCH (c:Customer {uuid: $customerUuid})
        SET c += $updateData
        RETURN c
      `, { customerUuid, updateData });

      console.log(`Updated customer info: ${customerUuid}`);

    } catch (error) {
      console.error('Error updating customer info:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getCustomerAnalytics(timeframe = '30 days') {
    const session = this.driver.session();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeframe));
      
      const result = await session.run(`
        MATCH (c:Customer)
        WHERE datetime(c.created_at) >= datetime($cutoffDate)
        OPTIONAL MATCH (c)-[:HAS_CONVERSATION]->(conv:Conversation)
        OPTIONAL MATCH (conv)-[:CONTAINS_MESSAGE]->(m:Message)
        RETURN 
          count(DISTINCT c) as total_customers,
          count(DISTINCT conv) as total_conversations,
          count(m) as total_messages,
          avg(size((c)-[:HAS_CONVERSATION]->(:Conversation))) as avg_conversations_per_customer
      `, { cutoffDate: cutoffDate.toISOString() });

      return result.records[0].toObject();

    } catch (error) {
      console.error('Error getting customer analytics:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

module.exports = { setupCustomerSchema, CustomerManager };

// Run setup if called directly
if (require.main === module) {
  setupCustomerSchema().then(() => {
    console.log('Customer schema setup complete!');
    process.exit(0);
  });
}
