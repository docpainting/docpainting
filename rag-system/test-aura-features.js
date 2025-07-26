// Test specific GDS and APOC functions in Neo4j Aura
require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD
  ),
  {
    connectionAcquisitionTimeout: 30 * 1000,
    disableLosslessIntegers: true,
    connectionTimeout: 20 * 1000,
    maxTransactionRetryTime: 15 * 1000
  }
);

async function testAuraFeatures() {
  console.log('🧪 Testing GDS and APOC features in Neo4j Aura Professional...\n');
  
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🔧 === Testing APOC Core Functions ===');
    
    // Test APOC UUID
    try {
      const result = await session.run('RETURN apoc.create.uuid() as uuid');
      console.log(`✅ APOC UUID: ${result.records[0].get('uuid')}`);
    } catch (error) {
      console.log('❌ APOC UUID failed:', error.message);
    }
    
    // Test APOC JSON conversion
    try {
      const result = await session.run('RETURN apoc.convert.toJson({name: "test", value: 123}) as json');
      console.log(`✅ APOC JSON: ${result.records[0].get('json')}`);
    } catch (error) {
      console.log('❌ APOC JSON failed:', error.message);
    }
    
    // Test APOC text functions
    try {
      const result = await session.run('RETURN apoc.text.slug("Hello World!") as slug');
      console.log(`✅ APOC Text: ${result.records[0].get('slug')}`);
    } catch (error) {
      console.log('❌ APOC Text failed:', error.message);
    }
    
    console.log('\n📊 === Testing GDS Functions ===');
    
    // Test GDS version
    try {
      const result = await session.run('RETURN gds.version() as version');
      console.log(`✅ GDS Version: ${result.records[0].get('version')}`);
    } catch (error) {
      console.log('❌ GDS Version failed:', error.message);
    }
    
    // Test GDS list functions
    try {
      const result = await session.run('CALL gds.list() YIELD algorithmName RETURN algorithmName LIMIT 5');
      console.log(`✅ GDS Algorithms available: ${result.records.length} found`);
      result.records.forEach(record => {
        console.log(`  • ${record.get('algorithmName')}`);
      });
    } catch (error) {
      console.log('❌ GDS List failed:', error.message);
    }
    
    console.log('\n🎯 === Testing Vector Functions ===');
    
    // Test vector similarity (useful for your embeddings!)
    try {
      const result = await session.run(`
        RETURN gds.similarity.cosine([0.1, 0.2, 0.3], [0.2, 0.3, 0.4]) as similarity
      `);
      console.log(`✅ GDS Cosine Similarity: ${result.records[0].get('similarity')}`);
    } catch (error) {
      console.log('❌ GDS Cosine Similarity failed:', error.message);
    }
    
    console.log('\n🔍 === Knowledge Graph Analytics Test ===');
    
    // Test graph analytics on your actual data
    try {
      const result = await session.run(`
        MATCH (n) 
        RETURN labels(n)[0] as nodeType, count(n) as count 
        ORDER BY count DESC 
        LIMIT 5
      `);
      console.log('✅ Your knowledge graph composition:');
      result.records.forEach(record => {
        console.log(`  • ${record.get('nodeType')}: ${record.get('count')} nodes`);
      });
    } catch (error) {
      console.log('❌ Graph analytics failed:', error.message);
    }
    
    console.log('\n🎉 Feature test complete!');
    console.log('\n💡 Recommendations for your DOC Painting RAG system:');
    console.log('  • Use GDS similarity functions for embedding comparisons');
    console.log('  • Use APOC for data transformation and JSON handling');
    console.log('  • Consider GDS community detection for grouping related knowledge');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

testAuraFeatures().catch(console.error);
