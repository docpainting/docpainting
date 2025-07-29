// simple-wipe.js
// Simple database wipe for Neo4j Aura

const neo4j = require('neo4j-driver');
require('dotenv').config();

async function wipeDatabase() {
  console.log('🧹 SIMPLE DATABASE WIPE...');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
    neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD || 'XoGzplIp-V7_VmtNQhfeCB6qSwplcqbBsdKGzfsldyY'),
    { connectionTimeout: 10000, maxConnectionLifetime: 10000 }
  );
  
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🔍 Connecting to Neo4j...');
    
    // Check current state
    const countResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
    const nodeCount = countResult.records[0].get('nodeCount').toNumber();
    console.log(`📊 Current nodes: ${nodeCount}`);
    
    if (nodeCount === 0) {
      console.log('✅ Database is already empty!');
      return;
    }
    
    // Simple delete all
    console.log('🗑️  Deleting all nodes and relationships...');
    await session.run('MATCH (n) DETACH DELETE n');
    
    // Verify deletion
    const verifyResult = await session.run('MATCH (n) RETURN count(n) as finalCount');
    const finalCount = verifyResult.records[0].get('finalCount').toNumber();
    
    console.log(`✅ Deletion complete! Remaining nodes: ${finalCount}`);
    
    if (finalCount === 0) {
      console.log('🎉 DATABASE IS COMPLETELY CLEAN!');
      console.log('🚀 Ready for fresh data with 1024D embeddings!');
    } else {
      console.log(`⚠️  ${finalCount} nodes still remain`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

wipeDatabase().catch(console.error);
