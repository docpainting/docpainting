// Migration script from local Neo4j to Neo4j Aura
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function migrateToAura() {
  console.log('🔄 Starting migration from local Neo4j to Aura...');
  
  // Source: Local Neo4j (via ngrok)
  const sourceDriver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  // Target: Neo4j Aura (you'll need to update these after creating Aura instance)
  const targetDriver = neo4j.driver(
    process.env.AURA_URI, // e.g., bolt://xxxxx.databases.neo4j.io:7687
    neo4j.auth.basic(process.env.AURA_USER, process.env.AURA_PASSWORD)
  );
  
  try {
    console.log('📊 Exporting data from local Neo4j...');
    
    // Export all nodes and relationships
    const sourceSession = sourceDriver.session();
    
    // Get all Color nodes with embeddings
    const colorsResult = await sourceSession.run(`
      MATCH (c:Color)
      RETURN c
      ORDER BY c.name
    `);
    console.log(`Found ${colorsResult.records.length} Color nodes`);
    
    // Get all Service nodes
    const servicesResult = await sourceSession.run(`
      MATCH (s:Service)
      RETURN s
      ORDER BY s.name
    `);
    console.log(`Found ${servicesResult.records.length} Service nodes`);
    
    // Get all CodeComponent nodes (if any)
    const codeResult = await sourceSession.run(`
      MATCH (cc:CodeComponent)
      RETURN cc
      LIMIT 100
    `);
    console.log(`Found ${codeResult.records.length} CodeComponent nodes`);
    
    await sourceSession.close();
    
    console.log('📥 Importing data to Neo4j Aura...');
    
    // Import to Aura
    const targetSession = targetDriver.session();
    
    // Create constraints first
    await targetSession.run('CREATE CONSTRAINT color_name IF NOT EXISTS FOR (c:Color) REQUIRE c.name IS UNIQUE');
    await targetSession.run('CREATE CONSTRAINT service_name IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE');
    
    // Import Color nodes
    let imported = 0;
    for (const record of colorsResult.records) {
      const color = record.get('c').properties;
      await targetSession.run(`
        CREATE (c:Color $props)
      `, { props: color });
      imported++;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} colors...`);
      }
    }
    
    // Import Service nodes
    for (const record of servicesResult.records) {
      const service = record.get('s').properties;
      await targetSession.run(`
        CREATE (s:Service $props)
      `, { props: service });
    }
    
    await targetSession.close();
    
    console.log('✅ Migration completed successfully!');
    console.log(`Migrated ${colorsResult.records.length} colors and ${servicesResult.records.length} services`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await sourceDriver.close();
    await targetDriver.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToAura()
    .then(() => console.log('🎉 Migration complete!'))
    .catch(err => console.error('💥 Migration failed:', err))
    .finally(() => process.exit(0));
}

module.exports = { migrateToAura };
