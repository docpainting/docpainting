const neo4j = require('neo4j-driver');
require('dotenv').config();

async function verifySchema() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();
  
  try {
    console.log('🔍 Verifying Neo4j Schema...\n');
    
    // Check constraints
    console.log('📋 CONSTRAINTS:');
    const constraints = await session.run('SHOW CONSTRAINTS');
    if (constraints.records.length === 0) {
      console.log('❌ No constraints found!');
    } else {
      constraints.records.forEach(record => {
        const name = record.get('name');
        const type = record.get('type');
        const entityType = record.get('entityType');
        const labelsOrTypes = record.get('labelsOrTypes');
        const properties = record.get('properties');
        console.log(`✅ ${name}: ${type} on ${entityType} ${labelsOrTypes} (${properties})`);
      });
    }
    
    console.log('\n📊 INDEXES:');
    const indexes = await session.run('SHOW INDEXES');
    if (indexes.records.length === 0) {
      console.log('❌ No indexes found!');
    } else {
      indexes.records.forEach(record => {
        const name = record.get('name');
        const type = record.get('type');
        const labelsOrTypes = record.get('labelsOrTypes');
        const properties = record.get('properties');
        console.log(`✅ ${name}: ${type} on ${labelsOrTypes} (${properties})`);
      });
    }
    
    console.log('\n🏷️ LABELS (Node Types):');
    const labels = await session.run('CALL db.labels()');
    if (labels.records.length === 0) {
      console.log('❌ No labels found!');
    } else {
      labels.records.forEach(record => {
        console.log(`✅ ${record.get('label')}`);
      });
    }
    
    console.log('\n🔗 RELATIONSHIP TYPES:');
    const relationships = await session.run('CALL db.relationshipTypes()');
    if (relationships.records.length === 0) {
      console.log('❌ No relationship types found!');
    } else {
      relationships.records.forEach(record => {
        console.log(`✅ ${record.get('relationshipType')}`);
      });
    }
    
    console.log('\n📈 DATA COUNTS:');
    const customerCount = await session.run('MATCH (c:Customer) RETURN count(c) as count');
    const conversationCount = await session.run('MATCH (conv:Conversation) RETURN count(conv) as count');
    const messageCount = await session.run('MATCH (m:Message) RETURN count(m) as count');
    
    console.log(`👥 Customers: ${customerCount.records[0]?.get('count') || 0}`);
    console.log(`💬 Conversations: ${conversationCount.records[0]?.get('count') || 0}`);
    console.log(`📝 Messages: ${messageCount.records[0]?.get('count') || 0}`);
    
    // Check if our test data exists
    console.log('\n🧪 TEST DATA:');
    const testCustomer = await session.run('MATCH (c:Customer {email: "john@example.com"}) RETURN c.uuid, c.email');
    if (testCustomer.records.length > 0) {
      const customer = testCustomer.records[0];
      console.log(`✅ Test customer found: ${customer.get('c.uuid')} (${customer.get('c.email')})`);
    } else {
      console.log('❌ No test customer found');
    }
    
  } catch (error) {
    console.error('❌ Schema verification failed:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

verifySchema();
