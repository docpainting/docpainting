// Strategic Reconnaissance Intelligence Script
// Comprehensive employer and institution research for Marianne's job search advantage
// This adds key details, missions, values, rankings, and prestige info to Neo4j

const neo4j = require('neo4j-driver');
const fetch = require('node-fetch');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

// Generate 4096D Qwen embeddings for all intelligence data
async function generateQwenEmbedding(text) {
  try {
    const response = await fetch('https://router.huggingface.co/nebius/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: "Qwen/Qwen3-Embedding-8B",
        dimensions: 4096
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    return new Array(4096).fill(0);
  }
}

async function addEmployerResearchIntelligence() {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🕵️‍♀️ Adding strategic employer and institution research intelligence...');
    
    // ============================================================================
    // PwC (PricewaterhouseCoopers) - Big 4 Strategic Intelligence
    // ============================================================================
    
    const pwcIntelligence = `PricewaterhouseCoopers (PwC) is entering a bold new chapter driven by sharper thinking, deeper expertise and an unwavering focus on what's next. PwC is a global leader providing Value in Motion consulting, focusing on digital transformation, sustainability, and bringing clients to the leading edge. Key services include Consulting, Audit & Assurance, Tax Services, Board Governance, and ESG/Sustainability. Notable clients include GE, Penn State, and Wellstar Health System. PwC emphasizes a tech-enabled and people-empowered approach with global expertise across 140+ countries and 370,000+ employees generating $55.4 billion revenue (2024).`;
    
    const pwcEmbedding = await generateQwenEmbedding(pwcIntelligence);
    
    await session.run(`
      MERGE (c:Company {name: 'PricewaterhouseCoopers LLP'})
      SET c.strategic_intelligence = $intelligence,
      c.intelligence_embedding = $embedding,
      c.mission = 'Bold new chapter driven by sharper thinking, deeper expertise and unwavering focus on what is next',
      c.value_proposition = 'Value in Motion - bringing clients to the leading edge',
      c.approach = 'tech-enabled and people-empowered',
      c.focus_areas = ['Digital Transformation', 'Sustainability', 'ESG', 'Board Governance'],
      c.notable_clients = ['GE', 'Penn State', 'Wellstar Health System'],
      c.competitive_advantage = 'Leading edge consulting with global expertise',
      c.career_emphasis = 'Personal growth, meaningful impact, learning with purpose',
      c.research_date = date(),
      c.intelligence_source = 'Official PwC website reconnaissance'
    `, { intelligence: pwcIntelligence, embedding: pwcEmbedding });
    
    // ============================================================================
    // Babson College - World's #1 Entrepreneurship Strategic Intelligence  
    // ============================================================================
    
    const babsonIntelligence = `Babson College is the worldwide leader in entrepreneurship education, creator of entrepreneurship education and convenor of entrepreneurial leaders for 100+ years. Ranked #2 Best College in United States by Wall Street Journal (2025) and #1 Business School for Salary Potential (PayScale 2015-2024). Founded in 1919 by Roger Babson, the college focuses on practical experience over lectures to prepare students for business realities. Core philosophy centers on Entrepreneurial Leadership mindset: managing risk, navigating uncertainty, and exploring ambiguity to turn problems into opportunities that create economic and social value. Campus locations include Wellesley (main), Boston, and Miami. 87% of full-time faculty hold doctoral degrees with real-world experience.`;
    
    const babsonEmbedding = await generateQwenEmbedding(babsonIntelligence);
    
    await session.run(`
      MERGE (i:Institution {name: 'Babson College'})
      SET i.strategic_intelligence = $intelligence,
      i.intelligence_embedding = $embedding,
      i.global_ranking = '#1 Worldwide Leader in Entrepreneurship Education',
      i.us_ranking = '#2 Best College in United States (Wall Street Journal 2025)',
      i.salary_ranking = '#1 Business School for Salary Potential (PayScale 2015-2024)',
      i.founded = '1919',
      i.founder = 'Roger Babson',
      i.core_philosophy = 'Entrepreneurial Leadership: managing risk, navigating uncertainty, exploring ambiguity',
      i.educational_approach = 'Practical experience over lectures',
      i.mission = 'Turn problems into opportunities that create economic and social value',
      i.faculty_quality = '87% hold doctoral degrees with real-world experience',
      i.campus_locations = ['Wellesley (main)', 'Boston', 'Miami'],
      i.prestige_level = 'Most prestigious business college in Massachusetts',
      i.years_of_excellence = '100+',
      i.competitive_advantage = 'Creator and worldwide leader of entrepreneurship education',
      i.research_date = date(),
      i.intelligence_source = 'Official Babson College website reconnaissance'
    `, { intelligence: babsonIntelligence, embedding: babsonEmbedding });
    
    // ============================================================================
    // PRTM Management Consultants - Prestigious Acquisition Target Intelligence
    // ============================================================================
    
    const prtmIntelligence = `PRTM Management Consultants was a prestigious management consulting firm founded in 1976 (Pittiglio, Rabin, Todd & McGrath) specializing in operational strategy, supply chain innovation, product innovation, and customer experience innovation. The firm was valuable enough to be acquired by PwC on August 22, 2011, demonstrating its high-quality consulting capabilities and strategic value. PRTM created industry-leading frameworks including PACE (Product and Cycle-time Excellence) and co-developed SCOR (Supply-Chain Operations Reference-model) with the Supply-Chain Council. With 19 offices in 10 countries, PRTM served automotive, aerospace, consumer goods, electronics, and industrial sectors. The successful acquisition by PwC validates the quality and strategic importance of PRTM's consulting expertise and methodologies.`;
    
    const prtmEmbedding = await generateQwenEmbedding(prtmIntelligence);
    
    await session.run(`
      MERGE (c:Company {name: 'PRTM Management Consultants, Inc.'})
      SET c.strategic_intelligence = $intelligence,
      c.intelligence_embedding = $embedding,
      c.acquisition_prestige = 'Acquired by PwC (Big 4) on August 22, 2011',
      c.acquisition_validation = 'Valuable enough for PwC acquisition demonstrates high-quality consulting capabilities',
      c.founded = '1976',
      c.original_name = 'Pittiglio, Rabin, Todd & McGrath',
      c.specializations = ['Operational Strategy', 'Supply Chain Innovation', 'Product Innovation', 'Customer Experience Innovation'],
      c.industry_frameworks = ['PACE (Product and Cycle-time Excellence)', 'SCOR (Supply-Chain Operations Reference-model)'],
      c.global_presence = '19 offices in 10 countries',
      c.industry_focus = ['Automotive', 'Aerospace', 'Consumer Goods', 'Electronics', 'Industrial'],
      c.strategic_value = 'Created industry-leading consulting frameworks and methodologies',
      c.competitive_advantage = 'Prestigious enough to be acquired by Big 4 PwC',
      c.headquarters = 'Waltham, Massachusetts',
      c.research_date = date(),
      c.intelligence_source = 'Wikipedia and acquisition research'
    `, { intelligence: prtmIntelligence, embedding: prtmEmbedding });
    
    // ============================================================================
    // Gaging.com LLC - Specialized Industrial/Manufacturing Intelligence
    // ============================================================================
    
    const gagingIntelligence = `Gaging.com LLC is a veteran-owned specialized company in the industrial and manufacturing sector, focusing on precision gaging and measurement solutions. The company emphasizes customer service with dedicated phone support (888-978-9873) and factory-direct pricing. As a veteran-owned business, Gaging.com demonstrates commitment to quality, precision, and service excellence in the specialized manufacturing and industrial measurement market. Their business model centers on providing precision gaging tools and measurement solutions directly to customers with personalized service support.`;
    
    const gagingEmbedding = await generateQwenEmbedding(gagingIntelligence);
    
    await session.run(`
      MERGE (c:Company {name: 'Gaging.com LLC'})
      SET c.strategic_intelligence = $intelligence,
      c.intelligence_embedding = $embedding,
      c.ownership_type = 'Veteran-owned business',
      c.industry_focus = 'Industrial and manufacturing precision gaging and measurement solutions',
      c.business_model = 'Factory-direct pricing with personalized customer service',
      c.customer_service_phone = '(888)978-9873',
      c.core_values = ['Quality', 'Precision', 'Service Excellence'],
      c.competitive_advantage = 'Specialized precision measurement solutions with veteran-owned commitment to quality',
      c.market_segment = 'Specialized manufacturing and industrial measurement',
      c.service_approach = 'Direct customer support and factory-direct pricing',
      c.research_date = date(),
      c.intelligence_source = 'Company website reconnaissance'
    `, { intelligence: gagingIntelligence, embedding: gagingEmbedding });
    
    // ============================================================================
    // Create Strategic Intelligence Relationships
    // ============================================================================
    
    // Connect Marianne to enhanced company intelligence
    await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})
      MATCH (c:Company)
      WHERE c.strategic_intelligence IS NOT NULL
      MERGE (p)-[:HAS_STRATEGIC_KNOWLEDGE_OF]->(c)
    `);
    
    // Connect Marianne to enhanced institution intelligence  
    await session.run(`
      MATCH (p:Person {name: 'Marianne Abrams'})
      MATCH (i:Institution)
      WHERE i.strategic_intelligence IS NOT NULL
      MERGE (p)-[:HAS_STRATEGIC_KNOWLEDGE_OF]->(i)
    `);
    
    console.log('✅ Successfully added comprehensive employer and institution strategic intelligence!');
    console.log('📊 Strategic Intelligence Added:');
    console.log('   🏢 PwC: Big 4 mission, values, competitive advantages, and client portfolio');
    console.log('   🎓 Babson College: #1 worldwide entrepreneurship ranking, prestige, and philosophy'); 
    console.log('   🏢 PRTM: Prestigious PwC acquisition target with industry-leading frameworks');
    console.log('   🏢 Gaging.com: Veteran-owned precision manufacturing specialization');
    console.log('   🔗 Strategic knowledge relationships created for interview readiness');
    console.log('🎯 Marianne now has comprehensive intelligence for informed job interviews!');

  } catch (error) {
    console.error('❌ Error adding strategic intelligence:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the strategic intelligence function
addEmployerResearchIntelligence().catch(console.error);
