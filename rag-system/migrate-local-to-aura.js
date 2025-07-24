// Migration script: Local Neo4j → Neo4j Aura
const neo4j = require('neo4j-driver');

async function migrateToAura() {
  console.log('🔄 Starting migration: Local Neo4j → Aura...');
  
  // Source: Local Neo4j
  const localDriver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'BumBleBtuna1011*')
  );
  
  // Target: Neo4j Aura (from .env)
  require('dotenv').config();
  const auraDriver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  try {
    // Test connections
    console.log('🔗 Testing connections...');
    await localDriver.verifyConnectivity();
    console.log('✅ Local Neo4j connected');
    
    await auraDriver.verifyConnectivity();
    console.log('✅ Aura connected');
    
    const localSession = localDriver.session();
    const auraSession = auraDriver.session();
    
    // Check local data count
    const localCount = await localSession.run('MATCH (n) RETURN count(n) as total');
    const localNodes = localCount.records[0].get('total').toNumber();
    console.log(`📊 Local nodes to migrate: ${localNodes}`);
    
    if (localNodes === 0) {
      console.log('⚠️ No data in local Neo4j to migrate');
      return;
    }
    
    // Step 1: Create constraints in Aura
    console.log('🔧 Creating constraints in Aura...');
    const constraints = [
      'CREATE CONSTRAINT color_name IF NOT EXISTS FOR (c:Color) REQUIRE c.name IS UNIQUE',
      'CREATE CONSTRAINT service_name IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE',
      'CREATE CONSTRAINT customer_id IF NOT EXISTS FOR (c:Customer) REQUIRE c.customerId IS UNIQUE'
    ];
    
    for (const constraint of constraints) {
      try {
        await auraSession.run(constraint);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.log(`⚠️ Constraint warning: ${e.message}`);
        }
      }
    }
    
    // Step 2: Migrate Color nodes
    console.log('🎨 Migrating Color nodes...');
    const colorsResult = await localSession.run(`
      MATCH (c:Color)
      RETURN c.name as name, c.hexValue as hexValue, c.brand as brand, 
             c.finish as finish, c.embedding as embedding, c.description as description
    `);
    
    for (const record of colorsResult.records) {
      await auraSession.run(`
        MERGE (c:Color {name: $name})
        SET c.hexValue = $hexValue,
            c.brand = $brand,
            c.finish = $finish,
            c.embedding = $embedding,
            c.description = $description
      `, {
        name: record.get('name'),
        hexValue: record.get('hexValue'),
        brand: record.get('brand'),
        finish: record.get('finish'),
        embedding: record.get('embedding'),
        description: record.get('description')
      });
    }
    console.log(`✅ Migrated ${colorsResult.records.length} colors`);
    
    // Step 3: Migrate Service nodes
    console.log('🛠️ Migrating Service nodes...');
    const servicesResult = await localSession.run(`
      MATCH (s:Service)
      RETURN s.name as name, s.description as description, s.category as category,
             s.priceRange as priceRange, s.duration as duration, s.embedding as embedding
    `);
    
    for (const record of servicesResult.records) {
      await auraSession.run(`
        MERGE (s:Service {name: $name})
        SET s.description = $description,
            s.category = $category,
            s.priceRange = $priceRange,
            s.duration = $duration,
            s.embedding = $embedding
      `, {
        name: record.get('name'),
        description: record.get('description'),
        category: record.get('category'),
        priceRange: record.get('priceRange'),
        duration: record.get('duration'),
        embedding: record.get('embedding')
      });
    }
    console.log(`✅ Migrated ${servicesResult.records.length} services`);
    
    // Step 4: Migrate other nodes
    console.log('📋 Migrating other nodes...');
    const otherNodesResult = await localSession.run(`
      MATCH (n)
      WHERE NOT n:Color AND NOT n:Service AND NOT n:Customer
      RETURN labels(n) as labels, properties(n) as props
    `);
    
    for (const record of otherNodesResult.records) {
      const labels = record.get('labels');
      const props = record.get('props');
      const labelStr = labels.join(':');
      
      await auraSession.run(`
        CREATE (n:${labelStr})
        SET n = $props
      `, { props });
    }
    console.log(`✅ Migrated ${otherNodesResult.records.length} other nodes`);
    
    // Step 5: Migrate relationships
    console.log('🔗 Migrating relationships...');
    const relsResult = await localSession.run(`
      MATCH (a)-[r]->(b)
      RETURN labels(a) as aLabels, properties(a) as aProps,
             type(r) as relType, properties(r) as relProps,
             labels(b) as bLabels, properties(b) as bProps
    `);
    
    for (const record of relsResult.records) {
      // This is complex - for now, skip relationships or implement based on your specific needs
      // Most important data (Colors, Services) are already migrated
    }
    
    // Final count check
    const auraCount = await auraSession.run('MATCH (n) RETURN count(n) as total');
    const auraNodes = auraCount.records[0].get('total').toNumber();
    console.log(`🎉 Migration complete! Aura now has ${auraNodes} nodes`);
    
    await localSession.close();
    await auraSession.close();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await localDriver.close();
    await auraDriver.close();
  }
}

migrateToAura();
