const neo4j = require('neo4j-driver');

exports.handler = async (event, context) => {
  let driver;
  try {
    // Connect to Neo4j using environment variables
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
    );
    
    const session = driver.session({ database: process.env.NEO4J_DATABASE });
    
    // Get all node labels in the database
    const labelsResult = await session.run('CALL db.labels()');
    const nodeLabels = labelsResult.records.map(record => record.get(0));
    
    // Get node count for each label
    const nodeCounts = {};
    for (const label of nodeLabels) {
      const countResult = await session.run(`MATCH (n:${label}) RETURN count(n) as count`);
      nodeCounts[label] = countResult.records[0].get('count').toNumber();
    }
    
    // Check for Marianne specifically
    const marianneResult = await session.run(`
      MATCH (n) 
      WHERE toLower(toString(n.name)) CONTAINS 'marianne' 
         OR toLower(toString(n.title)) CONTAINS 'marianne'
         OR toLower(toString(n.content)) CONTAINS 'marianne'
      RETURN labels(n) as nodeLabels, n as node 
      LIMIT 10
    `);
    
    const marianneNodes = marianneResult.records.map(record => ({
      labels: record.get('nodeLabels'),
      properties: record.get('node').properties
    }));
    
    // Sample a few nodes from each label to see structure
    const sampleNodes = {};
    for (const label of nodeLabels.slice(0, 5)) { // Only first 5 labels to avoid too much output
      const sampleResult = await session.run(`MATCH (n:${label}) RETURN n LIMIT 2`);
      sampleNodes[label] = sampleResult.records.map(record => record.get('n').properties);
    }
    
    await session.close();
    await driver.close();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: "Database structure diagnostic",
        nodeLabels: nodeLabels,
        nodeCounts: nodeCounts,
        marianneNodes: marianneNodes,
        sampleNodes: sampleNodes,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    if (driver) {
      await driver.close();
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: "Database diagnostic failed",
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
