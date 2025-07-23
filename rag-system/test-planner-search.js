const neo4j = require('neo4j-driver');
require('dotenv').config();

async function testPlannerSearch() {
  console.log('🔍 Testing Planner Agent Search in Neo4j...\n');

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();

  try {
    // Simple search for nodes containing "planner" in any string property
    console.log('🔍 Searching for "planner" in node properties...');
    const result = await session.run(`
      MATCH (n)
      WHERE any(prop IN keys(n) WHERE 
        n[prop] IS NOT NULL AND 
        (toString(n[prop]) CONTAINS 'planner' OR toString(n[prop]) CONTAINS 'agent')
      )
      RETURN labels(n) as labels, keys(n) as properties, n.name as name, n.description as description
      LIMIT 10
    `);

    console.log(`✅ Found ${result.records.length} nodes with planner/agent references:`);
    
    result.records.forEach((record, i) => {
      const labels = record.get('labels');
      const properties = record.get('properties');
      const name = record.get('name');
      const description = record.get('description');
      
      console.log(`\n   ${i+1}. ${labels.join(':')} Node`);
      console.log(`      Properties: ${properties.join(', ')}`);
      if (name) console.log(`      Name: ${name}`);
      if (description) console.log(`      Description: ${description}`);
    });

    // Also search by node labels
    console.log('\n🔍 Searching for nodes with "Agent" or "Planner" labels...');
    const labelResult = await session.run(`
      MATCH (n)
      WHERE any(label IN labels(n) WHERE label CONTAINS 'Agent' OR label CONTAINS 'Planner')
      RETURN labels(n) as labels, n
      LIMIT 5
    `);

    if (labelResult.records.length > 0) {
      console.log(`✅ Found ${labelResult.records.length} nodes with Agent/Planner labels:`);
      labelResult.records.forEach((record, i) => {
        const labels = record.get('labels');
        const node = record.get('n').properties;
        console.log(`   ${i+1}. ${labels.join(':')} - ${JSON.stringify(node, null, 2)}`);
      });
    } else {
      console.log('   No nodes found with Agent/Planner labels');
    }

  } catch (error) {
    console.error('❌ Search error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testPlannerSearch();
