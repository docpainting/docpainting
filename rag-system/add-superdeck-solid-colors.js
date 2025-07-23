const neo4j = require('neo4j-driver');
require('dotenv').config();

async function addSuperDeckSolidColors() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );

  const session = driver.session();
  
  try {
    console.log('🎨 Adding SuperDeck Solid Color Deck Stain Colors to Neo4j...\n');

    // SuperDeck Exterior Waterborne Solid Color Deck Stain (71 colors)
    const superDeckSolidColors = [
      { code: 'SW 3001', name: 'Shagbark', category: 'Natural Wood Tones' },
      { code: 'SW 3002', name: 'Belvedere Tan', category: 'Natural Wood Tones' },
      { code: 'SW 3003', name: 'Buckthorn', category: 'Natural Wood Tones' },
      { code: 'SW 3004', name: 'Summerhouse Beige', category: 'Natural Wood Tones' },
      { code: 'SW 3006', name: 'Sand Castle', category: 'Light Neutrals' },
      { code: 'SW 3007', name: 'Lodge Brown', category: 'Dark Wood Tones' },
      { code: 'SW 3008', name: 'Blue Spruce', category: 'Blue/Green Tones' },
      { code: 'SW 3009', name: 'Pineneedle', category: 'Blue/Green Tones' },
      { code: 'SW 3010', name: 'Woodsmoke Gray', category: 'Gray Tones' },
      { code: 'SW 3011', name: 'Acadia Blue', category: 'Blue/Green Tones' },
      { code: 'SW 3012', name: 'Meadowbrook', category: 'Blue/Green Tones' },
      { code: 'SW 3013', name: 'Gray Birch', category: 'Gray Tones' },
      { code: 'SW 3014', name: 'Juniper Blue', category: 'Blue/Green Tones' },
      { code: 'SW 3015', name: 'Sequoia', category: 'Red Wood Tones' },
      { code: 'SW 3016', name: 'Rock Rose', category: 'Red Wood Tones' },
      { code: 'SW 3017', name: 'Pepperidge', category: 'Natural Wood Tones' },
      { code: 'SW 3018', name: 'Salem Red', category: 'Red Wood Tones' },
      { code: 'SW 3019', name: 'Smoke Tree', category: 'Gray Tones' },
      { code: 'SW 3020', name: 'Cape Cod Red', category: 'Red Wood Tones' },
      { code: 'SW 3021', name: 'Spicewood', category: 'Natural Wood Tones' },
      { code: 'SW 3022', name: 'Black Alder', category: 'Dark Wood Tones' },
      { code: 'SW 3023', name: 'Flagstone', category: 'Gray Tones' },
      { code: 'SW 3024', name: 'River Birch', category: 'Natural Wood Tones' },
      { code: 'SW 3025', name: 'Caribou', category: 'Natural Wood Tones' },
      { code: 'SW 3026', name: 'King\'s Canyon', category: 'Dark Wood Tones' },
      { code: 'SW 3027', name: 'Driftwood', category: 'Gray Tones' },
      { code: 'SW 3029', name: 'Ember', category: 'Red Wood Tones' },
      { code: 'SW 3030', name: 'Desert Wood', category: 'Natural Wood Tones' },
      { code: 'SW 3031', name: 'Cabin Brown', category: 'Dark Wood Tones' },
      { code: 'SW 3034', name: 'Cedar', category: 'Natural Wood Tones' },
      { code: 'SW 3035', name: 'Woodbriar', category: 'Natural Wood Tones' },
      { code: 'SW 3036', name: 'Orchard', category: 'Natural Wood Tones' },
      { code: 'SW 3037', name: 'Shade Tree', category: 'Blue/Green Tones' },
      { code: 'SW 3038', name: 'Palmetto', category: 'Blue/Green Tones' },
      { code: 'SW 3039', name: 'Tobacco', category: 'Dark Wood Tones' },
      { code: 'SW 3040', name: 'Cottonwood', category: 'Natural Wood Tones' },
      { code: 'SW 3041', name: 'Cypress Moss', category: 'Blue/Green Tones' },
      { code: 'SW 3042', name: 'Woodland', category: 'Blue/Green Tones' },
      { code: 'SW 3043', name: 'Cheyenne Red', category: 'Red Wood Tones' },
      { code: 'SW 3044', name: 'Ranchero Red', category: 'Red Wood Tones' },
      { code: 'SW 3045', name: 'Russet Brown', category: 'Dark Wood Tones' },
      { code: 'SW 3046', name: 'Pine Cone', category: 'Natural Wood Tones' },
      { code: 'SW 3047', name: 'Almond Tree', category: 'Light Neutrals' },
      { code: 'SW 3048', name: 'Yosemite Gold', category: 'Natural Wood Tones' },
      { code: 'SW 3049', name: 'Monterey Tan', category: 'Natural Wood Tones' },
      { code: 'SW 3050', name: 'Greenbriar', category: 'Blue/Green Tones' },
      { code: 'SW 3051', name: 'Chesapeake', category: 'Blue/Green Tones' },
      { code: 'SW 3060', name: 'Antique Gray', category: 'Gray Tones' },
      { code: 'SW 3061', name: 'Brick', category: 'Red Wood Tones' },
      { code: 'SW 3062', name: 'Canyon', category: 'Natural Wood Tones' },
      { code: 'SW 3063', name: 'Charcoal', category: 'Dark Wood Tones' },
      { code: 'SW 3064', name: 'Espresso', category: 'Dark Wood Tones' },
      { code: 'SW 3065', name: 'Fawn', category: 'Natural Wood Tones' },
      { code: 'SW 3066', name: 'Forest Dew', category: 'Blue/Green Tones' },
      { code: 'SW 3067', name: 'Hudson Gray', category: 'Gray Tones' },
      { code: 'SW 3068', name: 'Leather', category: 'Dark Wood Tones' },
      { code: 'SW 3069', name: 'Lichen', category: 'Blue/Green Tones' },
      { code: 'SW 3070', name: 'Mallard Green', category: 'Blue/Green Tones' },
      { code: 'SW 3071', name: 'Mercury', category: 'Gray Tones' },
      { code: 'SW 3072', name: 'Mission Brown', category: 'Dark Wood Tones' },
      { code: 'SW 3073', name: 'Misty Mauve', category: 'Light Neutrals' },
      { code: 'SW 3074', name: 'Mushroom', category: 'Natural Wood Tones' },
      { code: 'SW 3075', name: 'River Rock', category: 'Gray Tones' },
      { code: 'SW 3076', name: 'Sahara', category: 'Natural Wood Tones' },
      { code: 'SW 3077', name: 'Shagbark Brown', category: 'Dark Wood Tones' },
      { code: 'SW 3078', name: 'Shale', category: 'Gray Tones' },
      { code: 'SW 3079', name: 'Stone', category: 'Gray Tones' },
      { code: 'SW 3080', name: 'Traditional Mahogany', category: 'Dark Wood Tones' },
      { code: 'SW 3081', name: 'Traditional Stone Hedge', category: 'Gray Tones' },
      { code: 'SW 3082', name: 'Wave Crest', category: 'Light Neutrals' },
      { code: 'SW 3083', name: 'Wet Clay', category: 'Natural Wood Tones' }
    ];

    console.log(`Adding ${superDeckSolidColors.length} SuperDeck solid colors...`);

    const tx = session.beginTransaction();
    
    try {
      // Create Product node for SuperDeck Solid
      await tx.run(`
        MERGE (p:Product {name: 'SuperDeck Exterior Waterborne Solid Color Deck Stain'})
        SET p.brand = 'Sherwin Williams',
            p.type = 'Deck Stain',
            p.finish = 'Solid Color',
            p.application = 'Exterior',
            p.description = 'Premium waterborne solid color deck stain providing complete coverage and protection for exterior deck surfaces',
            p.created_at = datetime(),
            p.updated_at = datetime()
      `);

      // Add each color
      for (const color of superDeckSolidColors) {
        await tx.run(`
          MATCH (p:Product {name: 'SuperDeck Exterior Waterborne Solid Color Deck Stain'})
          CREATE (c:Color {
            code: $code,
            name: $name,
            category: $category,
            product_line: 'SuperDeck Solid',
            brand: 'Sherwin Williams',
            type: 'Solid Color Stain',
            application: 'Exterior',
            created_at: datetime()
          })
          CREATE (p)-[:HAS_COLOR]->(c)
        `, color);
      }

      await tx.commit();
      console.log(`✅ Successfully added ${superDeckSolidColors.length} SuperDeck solid colors to Neo4j!`);
      
      // Verify the data
      const countResult = await session.run(`
        MATCH (c:Color {product_line: 'SuperDeck Solid'})
        RETURN count(c) as color_count
      `);
      
      const colorCount = countResult.records[0].get('color_count').toNumber();
      console.log(`🎨 Verified: ${colorCount} SuperDeck solid colors in database`);
      
      // Show sample colors by category
      const sampleResult = await session.run(`
        MATCH (c:Color {product_line: 'SuperDeck Solid'})
        RETURN c.category, count(c) as count, collect(c.name)[0..3] as sample_colors
        ORDER BY count DESC
      `);
      
      console.log('\n📊 SuperDeck Solid Colors by Category:');
      sampleResult.records.forEach(record => {
        const category = record.get('c.category');
        const count = record.get('count').toNumber();
        const samples = record.get('sample_colors');
        console.log(`  ${category}: ${count} colors (e.g., ${samples.join(', ')})`);
      });

      // Show total color count across all products
      const totalResult = await session.run(`
        MATCH (c:Color)
        RETURN count(c) as total_colors, 
               collect(DISTINCT c.product_line) as product_lines,
               collect(DISTINCT c.type) as stain_types
      `);
      
      const totalColors = totalResult.records[0].get('total_colors').toNumber();
      const productLines = totalResult.records[0].get('product_lines');
      const stainTypes = totalResult.records[0].get('stain_types');
      
      console.log(`\n🎨 TOTAL DATABASE: ${totalColors} colors across ${productLines.length} product lines`);
      console.log(`   Product lines: ${productLines.join(', ')}`);
      console.log(`   Stain types: ${stainTypes.join(', ')}`);
      
    } catch (error) {
      await tx.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error adding SuperDeck solid colors:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the script
addSuperDeckSolidColors();
