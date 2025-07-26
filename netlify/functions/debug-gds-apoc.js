// Production diagnostic function for GDS/APOC integration
const neo4j = require('neo4j-driver');

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
  neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD),
  {
    maxTransactionRetryTime: 30000,
    connectionAcquisitionTimeout: 30 * 1000,
    disableLosslessIntegers: true,
    connectionTimeout: 20 * 1000
  }
);

exports.handler = async (event, context) => {
  console.log('🔍 Starting GDS/APOC diagnostic in production...');
  
  try {
    const session = driver.session({ database: 'neo4j' });
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        NEO4J_URI: process.env.NEO4J_URI ? 'SET' : 'MISSING',
        NEO4J_USERNAME: process.env.NEO4J_USERNAME ? 'SET' : 'MISSING',
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ? 'SET' : 'MISSING',
        HF_TOKEN: process.env.HF_TOKEN ? 'SET' : 'MISSING',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'MISSING'
      },
      tests: {}
    };
    
    try {
      // Test 1: Basic Neo4j connection
      console.log('Test 1: Basic Neo4j connection...');
      const connResult = await session.run('RETURN 1 as test');
      diagnostics.tests.neo4j_connection = {
        status: 'SUCCESS',
        result: connResult.records[0].get('test')
      };
      
      // Test 2: APOC functions
      console.log('Test 2: APOC functions...');
      try {
        const apocResult = await session.run(`
          RETURN apoc.create.uuid() as uuid,
                 apoc.convert.toJson({test: 'value'}) as json,
                 apoc.text.slug('Hello World') as slug
        `);
        diagnostics.tests.apoc_functions = {
          status: 'SUCCESS',
          uuid: apocResult.records[0].get('uuid'),
          json: apocResult.records[0].get('json'),
          slug: apocResult.records[0].get('slug')
        };
      } catch (apocError) {
        diagnostics.tests.apoc_functions = {
          status: 'FAILED',
          error: apocError.message
        };
      }
      
      // Test 3: GDS similarity function
      console.log('Test 3: GDS similarity function...');
      try {
        const testVector1 = [0.1, 0.2, 0.3, 0.4, 0.5];
        const testVector2 = [0.1, 0.2, 0.3, 0.4, 0.5];
        
        const gdsResult = await session.run(`
          RETURN gds.similarity.cosine($vector1, $vector2) as similarity
        `, { vector1: testVector1, vector2: testVector2 });
        
        diagnostics.tests.gds_similarity = {
          status: 'SUCCESS',
          similarity: gdsResult.records[0].get('similarity')
        };
      } catch (gdsError) {
        diagnostics.tests.gds_similarity = {
          status: 'FAILED',
          error: gdsError.message
        };
      }
      
      // Test 4: Check knowledge base nodes
      console.log('Test 4: Knowledge base nodes...');
      const nodeCountResult = await session.run(`
        MATCH (n) 
        WHERE n.embedding IS NOT NULL
        RETURN labels(n)[0] as nodeType, count(n) as count
        ORDER BY count DESC
        LIMIT 10
      `);
      
      diagnostics.tests.knowledge_nodes = {
        status: 'SUCCESS',
        nodes: nodeCountResult.records.map(r => ({
          type: r.get('nodeType'),
          count: r.get('count').toNumber()
        }))
      };
      
      // Test 5: Test Hugging Face embedding
      console.log('Test 5: Hugging Face embedding...');
      try {
        const fetch = require('node-fetch');
        const response = await fetch(`https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HF_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: ['test embedding'] })
        });
        
        if (response.ok) {
          const result = await response.json();
          diagnostics.tests.hugging_face_embedding = {
            status: 'SUCCESS',
            embedding_length: Array.isArray(result) && Array.isArray(result[0]) ? result[0].length : 'Unknown'
          };
        } else {
          diagnostics.tests.hugging_face_embedding = {
            status: 'FAILED',
            error: `HTTP ${response.status}: ${await response.text()}`
          };
        }
      } catch (hfError) {
        diagnostics.tests.hugging_face_embedding = {
          status: 'FAILED',
          error: hfError.message
        };
      }
      
    } finally {
      await session.close();
    }
    
    console.log('🎉 GDS/APOC diagnostic complete:', JSON.stringify(diagnostics, null, 2));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(diagnostics, null, 2)
    };
    
  } catch (error) {
    console.error('❌ GDS/APOC diagnostic failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'GDS/APOC diagnostic failed',
        message: error.message,
        stack: error.stack
      }, null, 2)
    };
  }
};
