// Check available GDS and APOC procedures in Neo4j Aura
require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD
  ),
  {
    // Remove encrypted/trust config since URI already specifies neo4j+s:// (encrypted)
    connectionAcquisitionTimeout: 30 * 1000,
    disableLosslessIntegers: true,
    connectionTimeout: 20 * 1000,
    maxTransactionRetryTime: 15 * 1000
  }
);

async function checkAuraPlugins() {
  console.log('🔍 Checking available procedures in Neo4j Aura...\n');
  
  const session = driver.session({ database: 'neo4j' });
  
  try {
    // Check GDS procedures
    console.log('📊 === GDS (Graph Data Science) Procedures ===');
    const gdsResult = await session.run(`
      CALL dbms.procedures() 
      YIELD name, description 
      WHERE name STARTS WITH 'gds.' 
      RETURN name, description 
      ORDER BY name 
      LIMIT 10
    `);
    
    if (gdsResult.records.length === 0) {
      console.log('❌ No GDS procedures found - might need Aura Professional');
    } else {
      console.log(`✅ Found ${gdsResult.records.length} GDS procedures:`);
      gdsResult.records.forEach(record => {
        console.log(`  • ${record.get('name')}`);
      });
    }
    
    console.log('\n🔧 === APOC Procedures ===');
    const apocResult = await session.run(`
      CALL dbms.procedures() 
      YIELD name, description 
      WHERE name STARTS WITH 'apoc.' 
      RETURN name, description 
      ORDER BY name 
      LIMIT 15
    `);
    
    if (apocResult.records.length === 0) {
      console.log('❌ No APOC procedures found');
    } else {
      console.log(`✅ Found ${apocResult.records.length}+ APOC procedures:`);
      apocResult.records.forEach(record => {
        console.log(`  • ${record.get('name')}`);
      });
    }
    
    console.log('\n🔍 === Checking Vector Index Support ===');
    const vectorResult = await session.run(`
      CALL dbms.procedures() 
      YIELD name 
      WHERE name CONTAINS 'vector' 
      RETURN name 
      ORDER BY name
    `);
    
    console.log(`✅ Found ${vectorResult.records.length} vector-related procedures:`);
    vectorResult.records.forEach(record => {
      console.log(`  • ${record.get('name')}`);
    });
    
    console.log('\n🎯 === Testing Key Functions ===');
    
    // Test APOC
    try {
      const uuidResult = await session.run('RETURN apoc.create.uuid() as uuid');
      console.log(`✅ APOC UUID: ${uuidResult.records[0].get('uuid')}`);
    } catch (error) {
      console.log('❌ APOC UUID failed:', error.message);
    }
    
    // Test GDS version
    try {
      const gdsVersionResult = await session.run('RETURN gds.version() as version');
      console.log(`✅ GDS Version: ${gdsVersionResult.records[0].get('version')}`);
    } catch (error) {
      console.log('❌ GDS not available:', error.message);
    }
    
    console.log('\n🎉 Plugin check complete!');
    
  } catch (error) {
    console.error('❌ Error checking plugins:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkAuraPlugins().catch(console.error);
