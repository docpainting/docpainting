const neo4j = require('neo4j-driver');
require('dotenv').config();

async function addSuperDeckColors() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();
  
  try {
    console.log('🎨 Adding SuperDeck Semi-Transparent Stain Colors to Neo4j...\n');

    // SuperDeck Semi-Transparent Stain Colors (102 colors)
    const superDeckColors = [
      { code: 'SW 2100', name: 'Weathered Gray', category: 'Gray Tones' },
      { code: 'SW 2101', name: 'Seashell', category: 'Gray Tones' },
      { code: 'SW 2102', name: 'Beige Gray', category: 'Gray Tones' },
      { code: 'SW 2103', name: 'Silver Fur', category: 'Gray Tones' },
      { code: 'SW 2104', name: 'Cape Cod Gray', category: 'Gray Tones' },
      { code: 'SW 2105', name: 'Coastal', category: 'Gray Tones' },
      { code: 'SW 2106', name: 'Nantucket', category: 'Gray Tones' },
      { code: 'SW 2107', name: 'Driftwood', category: 'Gray Tones' },
      { code: 'SW 2108', name: 'Newport Bay', category: 'Gray Tones' },
      { code: 'SW 2109', name: 'River Rock', category: 'Gray Tones' },
      { code: 'SW 2110', name: 'Gray Pine', category: 'Gray Tones' },
      { code: 'SW 2111', name: 'Harbor Gray', category: 'Gray Tones' },
      { code: 'SW 2112', name: 'Seattle', category: 'Gray Tones' },
      { code: 'SW 2113', name: 'Granite', category: 'Gray Tones' },
      { code: 'SW 2114', name: 'Coastal Gray', category: 'Gray Tones' },
      { code: 'SW 2115', name: 'Gray Sky', category: 'Gray Tones' },
      { code: 'SW 2116', name: 'Blue Spruce', category: 'Blue Tones' },
      { code: 'SW 2117', name: 'Blue Oak', category: 'Blue Tones' },
      { code: 'SW 2118', name: 'Beachwood', category: 'Blue Tones' },
      { code: 'SW 2119', name: 'Blue Gum', category: 'Blue Tones' },
      { code: 'SW 2120', name: 'Faded Denim', category: 'Blue Tones' },
      
      { code: 'SW 2200', name: 'Cedar', category: 'Natural Wood Tones' },
      { code: 'SW 2201', name: 'White Pine', category: 'Natural Wood Tones' },
      { code: 'SW 2202', name: 'Sugar Pine', category: 'Natural Wood Tones' },
      { code: 'SW 2203', name: 'Bamboo', category: 'Natural Wood Tones' },
      { code: 'SW 2204', name: 'Tan Oak', category: 'Natural Wood Tones' },
      { code: 'SW 2205', name: 'Hickory', category: 'Natural Wood Tones' },
      { code: 'SW 2206', name: 'Douglas Fir', category: 'Natural Wood Tones' },
      { code: 'SW 2207', name: 'Birch', category: 'Natural Wood Tones' },
      { code: 'SW 2208', name: 'Dark Cedar', category: 'Natural Wood Tones' },
      { code: 'SW 2209', name: 'Sandalwood', category: 'Natural Wood Tones' },
      { code: 'SW 2210', name: 'Rich Maple', category: 'Natural Wood Tones' },
      { code: 'SW 2211', name: 'Hazelnut', category: 'Natural Wood Tones' },
      { code: 'SW 2212', name: 'Pacific Dogwood', category: 'Natural Wood Tones' },
      { code: 'SW 2213', name: 'Pecan', category: 'Natural Wood Tones' },
      { code: 'SW 2214', name: 'Sycamore', category: 'Natural Wood Tones' },
      { code: 'SW 2215', name: 'Limewood', category: 'Natural Wood Tones' },
      { code: 'SW 2216', name: 'Pistachio', category: 'Green Tones' },
      { code: 'SW 2217', name: 'Green Apple', category: 'Green Tones' },
      { code: 'SW 2218', name: 'Avocado', category: 'Green Tones' },
      { code: 'SW 2219', name: 'Olive', category: 'Green Tones' },
      { code: 'SW 2220', name: 'Pacific Pine', category: 'Green Tones' },
      
      { code: 'SW 2300', name: 'Redwood (Db)', category: 'Red Wood Tones' },
      { code: 'SW 2301', name: 'Coast Redwood', category: 'Red Wood Tones' },
      { code: 'SW 2302', name: 'Red Cedar', category: 'Red Wood Tones' },
      { code: 'SW 2303', name: 'Spanish Cedar', category: 'Red Wood Tones' },
      { code: 'SW 2304', name: 'Manzanita', category: 'Red Wood Tones' },
      { code: 'SW 2305', name: 'Red Meranti', category: 'Red Wood Tones' },
      { code: 'SW 2306', name: 'Rosewood', category: 'Red Wood Tones' },
      { code: 'SW 2307', name: 'Redheart', category: 'Red Wood Tones' },
      { code: 'SW 2308', name: 'Classic Barn', category: 'Red Wood Tones' },
      { code: 'SW 2309', name: 'New Barn Red', category: 'Red Wood Tones' },
      { code: 'SW 2310', name: 'Purpleheart', category: 'Red Wood Tones' },
      { code: 'SW 2311', name: 'Basswood', category: 'Red Wood Tones' },
      { code: 'SW 2312', name: 'Mesquite', category: 'Red Wood Tones' },
      { code: 'SW 2313', name: 'Corkwood', category: 'Red Wood Tones' },
      { code: 'SW 2314', name: 'Mahogany', category: 'Red Wood Tones' },
      { code: 'SW 2315', name: 'Tavern Oak', category: 'Red Wood Tones' },
      { code: 'SW 2316', name: 'Chestnut', category: 'Red Wood Tones' },
      { code: 'SW 2317', name: 'Fig', category: 'Red Wood Tones' },
      { code: 'SW 2318', name: 'Teak', category: 'Red Wood Tones' },
      { code: 'SW 2319', name: 'English Walnut', category: 'Red Wood Tones' },
      { code: 'SW 2320', name: 'Cape Blackwood', category: 'Red Wood Tones' },
      
      { code: 'SW 3501', name: 'Redwood', category: 'Classic Collection' },
      { code: 'SW 3502', name: 'Mission Wall', category: 'Classic Collection' },
      { code: 'SW 3503', name: 'White Birch', category: 'Classic Collection' },
      { code: 'SW 3504', name: 'Woodridge', category: 'Classic Collection' },
      { code: 'SW 3505', name: 'Yankee Barn', category: 'Classic Collection' },
      { code: 'SW 3507', name: 'Riverwood', category: 'Classic Collection' },
      { code: 'SW 3508', name: 'Covered Bridge', category: 'Classic Collection' },
      { code: 'SW 3509', name: 'Baja Beige', category: 'Classic Collection' },
      { code: 'SW 3511', name: 'Cedar Bark', category: 'Classic Collection' },
      { code: 'SW 3512', name: 'Cider Mill', category: 'Classic Collection' },
      { code: 'SW 3513', name: 'Spice Chest', category: 'Classic Collection' },
      { code: 'SW 3518', name: 'Hawthorne', category: 'Classic Collection' },
      { code: 'SW 3520', name: 'Ficus', category: 'Classic Collection' },
      { code: 'SW 3521', name: 'Crossroads', category: 'Classic Collection' },
      { code: 'SW 3522', name: 'Banyan Brown', category: 'Classic Collection' },
      { code: 'SW 3524', name: 'Chestnut', category: 'Classic Collection' },
      { code: 'SW 3530', name: 'Moss Olive', category: 'Classic Collection' },
      { code: 'SW 3531', name: 'Blue Shadow', category: 'Classic Collection' },
      { code: 'SW 3532', name: 'Hill Country', category: 'Classic Collection' },
      { code: 'SW 3533', name: 'Leeward', category: 'Classic Collection' },
      { code: 'SW 3535', name: 'Foliage', category: 'Classic Collection' },
      { code: 'SW 3540', name: 'Mountain Ash', category: 'Classic Collection' },
      { code: 'SW 3541', name: 'Harbor Mist', category: 'Classic Collection' },
      { code: 'SW 3542', name: 'Charwood', category: 'Classic Collection' },
      
      { code: 'SW 3560', name: 'Gray Pine', category: 'Popular Collection' },
      { code: 'SW 3561', name: 'Cedar', category: 'Popular Collection' },
      { code: 'SW 3562', name: 'Blue Spruce', category: 'Popular Collection' },
      { code: 'SW 3563', name: 'Redwood (Superdeck)', category: 'Popular Collection' },
      { code: 'SW 3564', name: 'Faded Denim', category: 'Popular Collection' },
      { code: 'SW 3565', name: 'Bamboo', category: 'Popular Collection' },
      { code: 'SW 3566', name: 'Douglas Fir', category: 'Popular Collection' },
      { code: 'SW 3567', name: 'Limewood', category: 'Popular Collection' },
      { code: 'SW 3568', name: 'Weathered Gray', category: 'Popular Collection' },
      { code: 'SW 3569', name: 'Olive', category: 'Popular Collection' },
      { code: 'SW 3570', name: 'Pacific Pine', category: 'Popular Collection' },
      { code: 'SW 3571', name: 'Classic Barn Red', category: 'Popular Collection' },
      { code: 'SW 3572', name: 'New Barn Red', category: 'Popular Collection' },
      { code: 'SW 3573', name: 'Tavern Oak', category: 'Popular Collection' },
      { code: 'SW 3574', name: 'English Walnut', category: 'Popular Collection' }
    ];

    console.log(`Adding ${superDeckColors.length} SuperDeck colors...`);

    const tx = session.beginTransaction();
    
    try {
      // Create Product node for SuperDeck
      await tx.run(`
        MERGE (p:Product {name: 'SuperDeck Semi-Transparent Stain'})
        SET p.brand = 'Sherwin Williams',
            p.type = 'Deck Stain',
            p.finish = 'Semi-Transparent',
            p.application = 'Exterior',
            p.description = 'Premium semi-transparent deck stain offering excellent protection and natural wood appearance',
            p.created_at = datetime(),
            p.updated_at = datetime()
      `);

      // Add each color
      for (const color of superDeckColors) {
        await tx.run(`
          MATCH (p:Product {name: 'SuperDeck Semi-Transparent Stain'})
          CREATE (c:Color {
            code: $code,
            name: $name,
            category: $category,
            product_line: 'SuperDeck',
            brand: 'Sherwin Williams',
            type: 'Semi-Transparent Stain',
            application: 'Exterior',
            created_at: datetime()
          })
          CREATE (p)-[:HAS_COLOR]->(c)
        `, color);
      }

      await tx.commit();
      console.log(`✅ Successfully added ${superDeckColors.length} SuperDeck colors to Neo4j!`);
      
      // Verify the data
      const countResult = await session.run(`
        MATCH (c:Color {product_line: 'SuperDeck'})
        RETURN count(c) as color_count
      `);
      
      const colorCount = countResult.records[0].get('color_count').toNumber();
      console.log(`🎨 Verified: ${colorCount} SuperDeck colors in database`);
      
      // Show sample colors by category
      const sampleResult = await session.run(`
        MATCH (c:Color {product_line: 'SuperDeck'})
        RETURN c.category, count(c) as count, collect(c.name)[0..3] as sample_colors
        ORDER BY count DESC
      `);
      
      console.log('\n📊 SuperDeck Colors by Category:');
      sampleResult.records.forEach(record => {
        const category = record.get('c.category');
        const count = record.get('count').toNumber();
        const samples = record.get('sample_colors');
        console.log(`  ${category}: ${count} colors (e.g., ${samples.join(', ')})`);
      });
      
    } catch (error) {
      await tx.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error adding SuperDeck colors:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the script
addSuperDeckColors();
