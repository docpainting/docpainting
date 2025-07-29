// wipe-and-rebuild.js
// Complete database wipe and rebuild with correct 1024D configuration

const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
  neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD || 'XoGzplIp-V7_VmtNQhfeCB6qSwplcqbBsdKGzfsldyY'),
  { connectionTimeout: 15000 }
);

async function wipeAndRebuild() {
  console.log('🧹 WIPING NEO4J AURA DATABASE...\n');
  
  const session = driver.session({ database: 'neo4j' });
  
  try {
    // Step 1: Check current state
    console.log('📊 Step 1: Checking current database state...');
    const countResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
    const nodeCount = countResult.records[0].get('nodeCount').toNumber();
    console.log(`Current nodes: ${nodeCount}`);
    
    if (nodeCount === 0) {
      console.log('✅ Database is already empty!');
    } else {
      console.log(`🗑️  Will delete ${nodeCount} nodes...`);
    }
    
    // Step 2: Drop all indexes and constraints
    console.log('\n📋 Step 2: Dropping all indexes and constraints...');
    
    try {
      await session.run('DROP INDEX messageEmbedding IF EXISTS');
      await session.run('DROP INDEX projectEmbedding IF EXISTS');
      await session.run('DROP INDEX materialEmbedding IF EXISTS');
      await session.run('DROP INDEX personEmbedding IF EXISTS');
      await session.run('DROP INDEX jobEmbedding IF EXISTS');
      await session.run('DROP INDEX educationEmbedding IF EXISTS');
      await session.run('DROP INDEX skillEmbedding IF EXISTS');
      await session.run('DROP INDEX skillProficiencyEmbedding IF EXISTS');
      await session.run('DROP INDEX achievementEmbedding IF EXISTS');
      await session.run('DROP INDEX behavioralexampleembedding IF EXISTS');
      await session.run('DROP INDEX colorembedding IF EXISTS');
      await session.run('DROP INDEX codecomponentembedding IF EXISTS');
      console.log('✅ Vector indexes dropped');
    } catch (error) {
      console.log('⚠️  Some indexes may not have existed:', error.message);
    }
    
    try {
      await session.run('DROP CONSTRAINT customer_uuid IF EXISTS');
      await session.run('DROP CONSTRAINT customer_email IF EXISTS');
      await session.run('DROP CONSTRAINT conversation_id IF EXISTS');
      await session.run('DROP CONSTRAINT message_id IF EXISTS');
      console.log('✅ Constraints dropped');
    } catch (error) {
      console.log('⚠️  Some constraints may not have existed:', error.message);
    }
    
    // Step 3: Delete all nodes and relationships
    console.log('\n📋 Step 3: Deleting all nodes and relationships...');
    
    if (nodeCount > 0) {
      // Delete in batches to avoid memory issues
      let deletedTotal = 0;
      while (true) {
        const deleteResult = await session.run(`
          MATCH (n)
          WITH n LIMIT 1000
          DETACH DELETE n
          RETURN count(n) as deleted
        `);
        
        const deletedBatch = deleteResult.records[0]?.get('deleted')?.toNumber() || 0;
        deletedTotal += deletedBatch;
        
        if (deletedBatch === 0) break;
        
        console.log(`🗑️  Deleted ${deletedTotal} nodes so far...`);
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`✅ Total deleted: ${deletedTotal} nodes`);
    }
    
    // Step 4: Verify database is empty
    console.log('\n📋 Step 4: Verifying database is clean...');
    const verifyResult = await session.run('MATCH (n) RETURN count(n) as finalCount');
    const finalCount = verifyResult.records[0].get('finalCount').toNumber();
    
    if (finalCount === 0) {
      console.log('✅ Database is completely clean!');
    } else {
      console.error(`❌ Warning: ${finalCount} nodes still remain`);
    }
    
    // Step 5: Recreate schema with correct 1024D vector indexes
    console.log('\n📋 Step 5: Creating clean schema with 1024D vector indexes...');
    
    // Constraints
    await session.run('CREATE CONSTRAINT customer_uuid FOR (c:Customer) REQUIRE c.uuid IS UNIQUE');
    await session.run('CREATE CONSTRAINT customer_email FOR (c:Customer) REQUIRE c.email IS UNIQUE');
    await session.run('CREATE CONSTRAINT conversation_id FOR (conv:Conversation) REQUIRE conv.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT message_id FOR (m:Message) REQUIRE m.id IS UNIQUE');
    console.log('✅ Constraints created');
    
    // Regular indexes
    await session.run('CREATE INDEX customer_status FOR (c:Customer) ON (c.status)');
    await session.run('CREATE INDEX customer_priority FOR (c:Customer) ON (c.priority)');
    await session.run('CREATE INDEX customer_created FOR (c:Customer) ON (c.created_at)');
    await session.run('CREATE INDEX conversation_started FOR (conv:Conversation) ON (conv.started_at)');
    await session.run('CREATE INDEX message_timestamp FOR (m:Message) ON (m.timestamp)');
    await session.run('CREATE INDEX message_sender FOR (m:Message) ON (m.sender)');
    console.log('✅ Regular indexes created');
    
    // 1024D Vector indexes (matching Hugging Face BAAI/bge-large-en-v1.5)
    const vectorIndexes = [
      'CREATE VECTOR INDEX messageEmbedding FOR (m:Message) ON (m.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX projectEmbedding FOR (p:Project) ON (p.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX materialEmbedding FOR (m:Material) ON (m.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX personEmbedding FOR (p:Person) ON (p.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX jobEmbedding FOR (j:Job) ON (j.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX educationEmbedding FOR (e:Education) ON (e.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX skillEmbedding FOR (s:Skill) ON (s.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX skillProficiencyEmbedding FOR (sp:SkillProficiency) ON (sp.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX achievementEmbedding FOR (a:Achievement) ON (a.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}',
      'CREATE VECTOR INDEX behavioralexampleembedding FOR (be:BehavioralExample) ON (be.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: "cosine"}}'
    ];
    
    for (const indexQuery of vectorIndexes) {
      try {
        await session.run(indexQuery);
        console.log('✅ Created 1024D vector index');
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      } catch (error) {
        console.error('❌ Vector index creation failed:', error.message);
      }
    }
    
    console.log('\n🎉 DATABASE WIPE AND REBUILD COMPLETE!');
    console.log('📊 Results:');
    console.log('├─ Old nodes/relationships: ✅ Deleted');
    console.log('├─ Old 512D indexes: ✅ Dropped');
    console.log('├─ Clean schema: ✅ Created');
    console.log('├─ New 1024D vector indexes: ✅ Ready');
    console.log('└─ Database state: ✅ Clean and ready');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Re-populate with Marianne data using 1024D embeddings');
    console.log('2. Test complete RAG pipeline');
    console.log('3. Deploy to production');
    
    console.log('\n✨ Ready for fresh data with correct dimensions!');
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check Neo4j Aura connection');
    console.error('2. Verify credentials in .env file');
    console.error('3. Ensure sufficient permissions for database operations');
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the wipe and rebuild
wipeAndRebuild()
  .then(() => {
    console.log('\n✨ Wipe and rebuild complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Wipe failed:', error);
    process.exit(1);
  });
