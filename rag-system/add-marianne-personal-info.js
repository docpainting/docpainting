const neo4j = require('neo4j-driver');
const fetch = require('node-fetch');
require('dotenv').config();

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

// Generate 4096D Qwen embedding
async function generateQwenEmbedding(text) {
  try {
    const response = await fetch('https://router.huggingface.co/nebius/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: "Qwen/Qwen3-Embedding-8B",
        dimensions: 4096
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    throw error;
  }
}

async function addMariannePersonalInfo() {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🏡 Adding comprehensive personal information for Marianne Abrams...');
    
    // Update main Person node with complete biographical story
    const personalInfo = "Marianne Abrams is an attractive 39-year-old Russian-born business owner and homeowner in Holbrook, Massachusetts. She escaped war in Russia at age 5 and immigrated to Massachusetts, where she has built an incredible success story. She graduated from Babson College, one of the most prestigious business colleges in Massachusetts, worked as a Senior Financial Analyst at PwC (one of the top Big 4 accounting firms), and now owns her own business and home in Holbrook, MA. She is decorated with many business and financial skills developed through her prestigious education and elite professional experience.";
    const personalEmbedding = await generateQwenEmbedding(personalInfo);
    
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      SET p.age = 39,
          p.appearance = 'attractive',
          p.location = 'Holbrook, Massachusetts',
          p.residence_type = 'homeowner',
          p.business_role = 'business owner',
          p.birth_country = 'Russia',
          p.refugee_status = 'war refugee',
          p.immigration_age = 5,
          p.immigration_destination = 'Massachusetts',
          p.years_in_usa = 34,
          p.big4_experience = 'PwC Senior Financial Analyst',
          p.college_prestige = 'one of the most prestigious business colleges in Massachusetts',
          p.success_story = 'refugee to business owner',
          p.personal_description = $personalInfo,
          p.personal_embedding = $personalEmbedding,
          p.updated_date = date()
    `, { personalInfo, personalEmbedding });
    
    // Add Holbrook, Massachusetts as a Location node
    const locationInfo = "Holbrook, Massachusetts - A town in Norfolk County, Massachusetts, where Marianne Abrams owns her home.";
    const locationEmbedding = await generateQwenEmbedding(locationInfo);
    
    await session.run(`
      MERGE (l:Location {name: 'Holbrook, Massachusetts'})
      SET l.state = 'Massachusetts',
          l.county = 'Norfolk County',
          l.type = 'town',
          l.description = $locationInfo,
          l.embedding = $locationEmbedding
      
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (p)-[:LIVES_IN]->(l)
      MERGE (p)-[:OWNS_HOME_IN]->(l)
    `, { locationInfo, locationEmbedding });
    
    // Update Babson College with prestige information
    await session.run(`
      MERGE (b:Institution {name: 'Babson College'})
      SET b.prestige_level = 'most prestigious business colleges in Massachusetts',
          b.recognition = 'prestigious',
          b.academic_reputation = 'highly decorated business education',
          b.location_state = 'Massachusetts'
    `);
    
    // Add Business Owner role
    const businessInfo = "Marianne Abrams is a skilled business owner, leveraging her prestigious Babson College education and extensive financial expertise to run her own business.";
    const businessEmbedding = await generateQwenEmbedding(businessInfo);
    
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (br:BusinessRole {title: 'Business Owner'})
      SET br.description = $businessInfo,
          br.embedding = $businessEmbedding,
          br.status = 'current',
          br.experience_level = 'decorated with many skills'
      MERGE (p)-[:CURRENTLY_WORKS_AS]->(br)
    `, { businessInfo, businessEmbedding });
    
    // Add Personal Attributes including Russian background and success story
    const attributes = [
      { name: 'Attractive Appearance', description: 'Marianne is known for her attractive appearance' },
      { name: 'Russian Heritage', description: 'Marianne was born in Russia and is fluent in Russian language' },
      { name: 'War Refugee Background', description: 'Marianne and her family escaped war in Russia when she was only 5 years old' },
      { name: 'Immigration Success Story', description: 'Immigrated to Massachusetts at age 5 and built an incredible life over 34 years' },
      { name: 'Homeowner Status', description: 'Marianne owns her home in Holbrook, Massachusetts' },
      { name: 'Business Ownership', description: 'Marianne successfully runs her own business, leveraging her education and experience' },
      { name: 'Prestigious Education', description: 'Graduate of Babson College, one of Massachusetts\' most prestigious business schools' },
      { name: 'Big 4 Professional Experience', description: 'Worked as Senior Financial Analyst at PwC, one of the top Big 4 accounting firms' },
      { name: 'Elite Career Progression', description: 'Rose from refugee to prestigious college graduate to Big 4 professional to business owner' },
      { name: 'Multilingual Skills', description: 'Fluent in Russian (native) and English, with conversational French abilities' },
      { name: 'Resilience and Determination', description: 'Overcame war refugee background to achieve remarkable professional and personal success' }
    ];
    
    for (const attr of attributes) {
      const attrEmbedding = await generateQwenEmbedding(`${attr.name}: ${attr.description}`);
      
      await session.run(`
        MERGE (p:Person {name: 'Marianne Abrams'})
        MERGE (a:Attribute {name: $name})
        SET a.description = $description,
            a.embedding = $embedding,
            a.category = 'personal_attribute'
        MERGE (p)-[:HAS_ATTRIBUTE]->(a)
      `, { name: attr.name, description: attr.description, embedding: attrEmbedding });
    }
    
    console.log('✅ Successfully added comprehensive personal information for Marianne!');
    console.log('📊 Added:');
    console.log('   • Personal details (age 39, attractive, homeowner)');
    console.log('   • Location (Holbrook, Massachusetts)');
    console.log('   • Business owner role');
    console.log('   • Babson College prestige information');
    console.log('   • 5 personal attributes with embeddings');
    console.log('🎯 Aria will now have much richer, more personal responses about Marianne!');
    
  } catch (error) {
    console.error('❌ Error adding personal information:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the function
addMariannePersonalInfo().catch(console.error);
