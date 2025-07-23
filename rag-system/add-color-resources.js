const neo4j = require('neo4j-driver');
require('dotenv').config();

async function addColorResources() {
  console.log('🎨 Adding Color Reference Resources to Neo4j...\n');

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();

  try {
    const timestamp = new Date().toISOString();
    
    // Add Sherwin Williams color reference
    await session.run(`
      MERGE (r:Resource {
        name: 'Sherwin Williams Color Center',
        type: 'color_reference',
        url: 'https://www.sherwin-williams.com/en-us/color',
        description: 'Official Sherwin Williams color center where customers can view all available colors, see color combinations, and explore color palettes',
        category: 'color_tools',
        brand: 'Sherwin Williams',
        created_at: $timestamp
      })
    `, { timestamp });

    // Add DOC Painting contact info as a resource
    await session.run(`
      MERGE (r:Resource {
        name: 'DOC Painting Contact',
        type: 'contact_info',
        phone: '(978) 408-5183',
        email: 'thedoc@docpainting.com',
        description: 'Direct contact for personalized color consultation and project quotes',
        category: 'customer_service',
        created_at: $timestamp
      })
    `);

    // Add color consultation service info
    await session.run(`
      MERGE (s:Service {
        name: 'Color Consultation',
        type: 'consultation',
        description: 'Professional color matching and custom tinting services available for any project',
        category: 'color_services',
        availability: 'By appointment',
        created_at: $timestamp
      })
    `);

    console.log('✅ Successfully added color reference resources to Neo4j!');

    // Verify what we added
    const result = await session.run(`
      MATCH (r:Resource)
      RETURN r.name, r.type, r.url, r.description
      ORDER BY r.type, r.name
    `);

    console.log('\n📚 Color Resources in Database:');
    result.records.forEach(record => {
      const name = record.get('r.name');
      const type = record.get('r.type');
      const url = record.get('r.url');
      const description = record.get('r.description');
      
      console.log(`   - ${name} (${type})`);
      if (url) console.log(`     URL: ${url}`);
      console.log(`     ${description}\n`);
    });

  } catch (error) {
    console.error('❌ Error adding color resources:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

addColorResources();
