// populate-education-test.js
// Test educational relationship extraction following existing Neo4j schema conventions

const neo4j = require('neo4j-driver');
const fetch = require('node-fetch');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

async function generateQwenEmbedding(text) {
  try {
    console.log(`🔄 Embedding: "${text.substring(0, 50)}..."`);
    const response = await fetch('https://router.huggingface.co/nebius/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model: "Qwen/Qwen3-Embedding-8B" })
    });
    if (!response.ok) throw new Error(`HF Router Error: ${await response.text()}`);
    const result = await response.json();
    if (result.data && result.data[0]?.embedding) {
      console.log(`✅ Generated ${result.data[0].embedding.length}D embedding.`);
      return result.data[0].embedding;
    }
    throw new Error(`Invalid embedding response format.`);
  } catch (error) {
    console.error('❌ Qwen embedding generation failed:', error);
    return null;
  }
}

// Educational data extracted from the HTML resume following schema conventions
const educationalData = {
  institutions: [
    {
      name: "Babson College",
      type: "College",
      degree: "Bachelor of Science",
      field: "Business Management", 
      concentration: "Finance",
      description: "Marianne Abrams studied at Babson College, earning a Bachelor of Science in Business Management with a concentration in Finance. This foundational education provided her with strong financial and business analytical skills that have been evident throughout her career progression from accounts payable specialist to senior financial roles."
    },
    {
      name: "University of Paris, Sorbonne",
      type: "University",
      program: "Study Abroad",
      description: "Marianne Abrams studied abroad at the University of Paris, Sorbonne, gaining international perspective and cultural awareness that enhanced her global business acumen and language skills, including conversational French."
    }
  ]
};

async function populateEducationalData() {
  console.log('🎓 Populating educational data following existing Neo4j schema conventions...');
  
  try {
    const session = driver.session();
    
    // First ensure the Person node exists (following existing pattern)
    console.log('👤 Ensuring Person node exists...');
    await session.run(`
      MERGE (p:Person {name: "Marianne Abrams"})
    `);
    
    // Process each institution using existing schema pattern
    for (const edu of educationalData.institutions) {
      console.log(`🏫 Processing ${edu.name}...`);
      
      // Generate embedding for the educational description
      const embedding = await generateQwenEmbedding(edu.description);
      if (!embedding) {
        console.log(`⚠️ Skipping ${edu.name} due to embedding failure`);
        continue;
      }
      
      // MERGE Institution node and STUDIED_AT relationship to prevent duplicates
      await session.run(`
        MATCH (p:Person {name: "Marianne Abrams"})
        MERGE (i:Institution {name: $institutionName})
        ON CREATE SET i.type = $type,
                      i.degree = $degree,
                      i.field = $field,
                      i.concentration = $concentration,
                      i.program = $program,
                      i.description = $description,
                      i.embedding = $embedding
        ON MATCH SET i.type = COALESCE($type, i.type),
                     i.degree = COALESCE($degree, i.degree),
                     i.field = COALESCE($field, i.field),
                     i.concentration = COALESCE($concentration, i.concentration),
                     i.program = COALESCE($program, i.program),
                     i.description = COALESCE($description, i.description),
                     i.embedding = COALESCE($embedding, i.embedding)
        MERGE (p)-[:STUDIED_AT]->(i)
      `, {
        institutionName: edu.name,
        type: edu.type,
        degree: edu.degree || null,
        field: edu.field || null,
        concentration: edu.concentration || null,
        program: edu.program || null,
        description: edu.description,
        embedding: embedding
      });
      
      console.log(`✅ Created/updated Institution: ${edu.name} with STUDIED_AT relationship`);
    }
    
    await session.close();
    
    console.log('🎯 Educational data population complete!');
    console.log('\n📊 SCHEMA SUMMARY:');
    console.log('   Node Labels: Person (PascalCase), Institution (PascalCase)');
    console.log('   Relationships: STUDIED_AT (SCREAMING_SNAKE_CASE)');
    console.log('   Properties: name, type, degree, field, concentration, program, description, embedding (camelCase)');
    
    return true;
    
  } catch (error) {
    console.error('❌ Educational data population failed:', error);
    return false;
  }
}

// Verification function to test the stored educational data
async function verifyEducationalData() {
  console.log('\n🔍 VERIFYING EDUCATIONAL DATA STORAGE...');
  
  try {
    const session = driver.session();
    
    const result = await session.run(`
      MATCH (p:Person {name: "Marianne Abrams"})-[:STUDIED_AT]->(i:Institution)
      RETURN p.name AS person, i.name AS institution, i.type AS type, 
             i.degree AS degree, i.field AS field, i.concentration AS concentration,
             i.program AS program, i.description AS description
      ORDER BY i.name
    `);
    
    console.log('\n📚 STORED EDUCATIONAL RELATIONSHIPS:');
    result.records.forEach((record, idx) => {
      console.log(`\n${idx + 1}. ${record.get('person')} STUDIED_AT ${record.get('institution')}`);
      console.log(`   Type: ${record.get('type')}`);
      if (record.get('degree')) console.log(`   Degree: ${record.get('degree')}`);
      if (record.get('field')) console.log(`   Field: ${record.get('field')}`);
      if (record.get('concentration')) console.log(`   Concentration: ${record.get('concentration')}`);
      if (record.get('program')) console.log(`   Program: ${record.get('program')}`);
      console.log(`   Description: ${record.get('description').substring(0, 100)}...`);
    });
    
    await session.close();
    
    return true;
    
  } catch (error) {
    console.error('❌ Educational data verification failed:', error);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 EDUCATIONAL DATA TEST FOR HYBRID RAG SYSTEM');
  console.log('================================================');
  
  try {
    // Populate educational data
    const populated = await populateEducationalData();
    if (!populated) {
      console.log('❌ Population failed, exiting...');
      process.exit(1);
    }
    
    // Verify the stored data
    const verified = await verifyEducationalData();
    if (!verified) {
      console.log('❌ Verification failed, exiting...');
      process.exit(1);
    }
    
    console.log('\n✅ EDUCATIONAL DATA TEST COMPLETE!');
    console.log('🎯 Ready to test hybrid RAG with educational relationships:');
    console.log('   - "Tell me about Marianne\'s educational background"');
    console.log('   - "How did her studies at Babson prepare her for finance roles?"');
    console.log('   - "What international experience does she have from Sorbonne?"');
    
  } finally {
    await driver.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { populateEducationalData, verifyEducationalData };
