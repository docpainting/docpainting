const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://c148cb1a.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'doconnell797@gmail.com',
    process.env.NEO4J_PASSWORD || 'jBgAtldPuNYSLzZ7RquO8gvaqB9xpLPItpbLVOsXgwI'
  )
);

async function setupSchema() {
  const session = driver.session();
  
  try {
    console.log('Setting up DOC Painting knowledge base schema...');
    
    // Create constraints
    await session.run('CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT material_name IF NOT EXISTS FOR (m:Material) REQUIRE m.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT location_city IF NOT EXISTS FOR (l:Location) REQUIRE l.city IS UNIQUE');
    await session.run('CREATE CONSTRAINT technique_name IF NOT EXISTS FOR (t:Technique) REQUIRE t.name IS UNIQUE');
    
    // Sample DOC Painting data
    const sampleData = [
      // Projects
      {
        query: `
          MERGE (p1:Project {id: 'victorian-boston-2023'})
          SET p1.description = 'Victorian home exterior restoration in Boston',
              p1.cost = '$15000-18000',
              p1.timeline = '2-3 weeks',
              p1.year = 2023,
              p1.type = 'exterior'
        `
      },
      {
        query: `
          MERGE (p2:Project {id: 'deck-holbrook-2024'})
          SET p2.description = 'Brazilian Rosewood deck restoration in Holbrook',
              p2.cost = '$8000-12000',
              p2.timeline = '1-2 weeks',
              p2.year = 2024,
              p2.type = 'deck'
        `
      },
      {
        query: `
          MERGE (p3:Project {id: 'kitchen-cabinets-weymouth'})
          SET p3.description = 'Kitchen cabinet refinishing in Weymouth',
              p3.cost = '$5000-7000',
              p3.timeline = '1 week',
              p3.year = 2024,
              p3.type = 'interior'
        `
      },
      
      // Materials
      {
        query: `
          MERGE (m1:Material {name: 'Fine Paints of Europe'})
          SET m1.type = 'premium paint',
              m1.use_case = 'high-end finishes, historical restoration',
              m1.benefits = 'superior durability, authentic colors'
        `
      },
      {
        query: `
          MERGE (m2:Material {name: 'Penofin'})
          SET m2.type = 'deck stain',
              m2.use_case = 'exotic wood protection',
              m2.benefits = 'penetrating oil, weather resistance'
        `
      },
      {
        query: `
          MERGE (m3:Material {name: 'Renner Wood Coatings'})
          SET m3.type = 'cabinet finish',
              m3.use_case = 'kitchen cabinet refinishing',
              m3.benefits = 'professional grade, durable finish'
        `
      },
      
      // Locations
      {
        query: `
          MERGE (l1:Location {city: 'Boston'})
          SET l1.area = 'Boston Metro',
              l1.specialties = 'Victorian homes, historical restoration'
        `
      },
      {
        query: `
          MERGE (l2:Location {city: 'Holbrook'})
          SET l2.area = 'South Shore',
              l2.specialties = 'residential painting, deck restoration'
        `
      },
      {
        query: `
          MERGE (l3:Location {city: 'Weymouth'})
          SET l3.area = 'South Shore',
              l3.specialties = 'kitchen renovations, cabinet work'
        `
      },
      
      // Techniques
      {
        query: `
          MERGE (t1:Technique {name: 'Historical Color Matching'})
          SET t1.description = 'Period-accurate color restoration for Victorian homes',
              t1.expertise_level = 'expert'
        `
      },
      {
        query: `
          MERGE (t2:Technique {name: 'Penetrating Oil Application'})
          SET t2.description = 'Deep wood protection for exotic decking materials',
              t2.expertise_level = 'specialized'
        `
      },
      {
        query: `
          MERGE (t3:Technique {name: 'Spray Finishing'})
          SET t3.description = 'Professional cabinet refinishing with smooth finish',
              t3.expertise_level = 'professional'
        `
      },
      
      // Relationships
      {
        query: `
          MATCH (p:Project {id: 'victorian-boston-2023'}), (m:Material {name: 'Fine Paints of Europe'}), 
                (l:Location {city: 'Boston'}), (t:Technique {name: 'Historical Color Matching'})
          MERGE (p)-[:USED_MATERIAL]->(m)
          MERGE (p)-[:IN_LOCATION]->(l)
          MERGE (p)-[:REQUIRED_TECHNIQUE]->(t)
        `
      },
      {
        query: `
          MATCH (p:Project {id: 'deck-holbrook-2024'}), (m:Material {name: 'Penofin'}), 
                (l:Location {city: 'Holbrook'}), (t:Technique {name: 'Penetrating Oil Application'})
          MERGE (p)-[:USED_MATERIAL]->(m)
          MERGE (p)-[:IN_LOCATION]->(l)
          MERGE (p)-[:REQUIRED_TECHNIQUE]->(t)
        `
      },
      {
        query: `
          MATCH (p:Project {id: 'kitchen-cabinets-weymouth'}), (m:Material {name: 'Renner Wood Coatings'}), 
                (l:Location {city: 'Weymouth'}), (t:Technique {name: 'Spray Finishing'})
          MERGE (p)-[:USED_MATERIAL]->(m)
          MERGE (p)-[:IN_LOCATION]->(l)
          MERGE (p)-[:REQUIRED_TECHNIQUE]->(t)
        `
      }
    ];
    
    // Execute all queries
    for (const item of sampleData) {
      await session.run(item.query);
      console.log('✓ Executed:', item.query.split('\n')[1].trim());
    }
    
    console.log('\n🎉 DOC Painting knowledge base setup complete!');
    console.log('📊 Access Neo4j Browser at: http://localhost:7474');
    
  } catch (error) {
    console.error('Error setting up schema:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

setupSchema();
