// Fix Tenure Chronology with MERGE - Add actual employment dates from resume
const neo4j = require('neo4j-driver');
require('dotenv').config();

async function fixTenureChronology() {
  console.log('🔧 FIXING: Adding chronological data to Tenure nodes using MERGE\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j+s://256fce48.databases.neo4j.io',
    neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // CHRONOLOGICAL ORDER (from resume):
    // 1. PRTM (JAN 2009 - AUG 2011) - EARLIEST
    // 2. PwC (AUG 2011 - OCT 2013) 
    // 3. MERGE/PARTNERS+simons (JAN 2019 - NOV 2020)
    // 4. DOC Painting (APR 2021 - PRESENT) - MOST RECENT
    
    const tenureUpdates = [
      // EDUCATION TIMELINE (Before Career)
      {
        company: 'University of Paris, Sorbonne',
        startDate: '2006-09-01',
        endDate: '2007-06-30', 
        startYear: 2006,
        endYear: 2007,
        duration: '1 academic year',
        chronologicalOrder: 0.1,
        position: 'Study Abroad Student',
        type: 'education',
        degree: 'Study Abroad Program',
        achievements: ['International Experience', 'French Language Study']
      },
      {
        company: 'Babson College',
        startDate: '2005-09-01',
        endDate: '2009-05-31', 
        startYear: 2005,
        endYear: 2009,
        duration: '4 years',
        chronologicalOrder: 0.2,
        position: 'Undergraduate Student',
        type: 'education',
        degree: 'Bachelor of Science, Business Management',
        concentration: 'Finance',
        gpa: 3.5,
        achievements: ['Suma Cum Laude', 'Dean\'s List', '3.5 GPA']
      },
      // CAREER TIMELINE (After Education)
      {
        company: 'PRTM Management Consultants, Inc.',
        startDate: '2009-01-01',
        endDate: '2011-08-31', 
        startYear: 2009,
        endYear: 2011,
        duration: '2 years 8 months',
        chronologicalOrder: 1,
        position: 'Senior Accounts Payable Specialist',
        type: 'employment'
      },
      {
        company: 'PricewaterhouseCoopers LLP (Acquired PRTM)',
        startDate: '2011-08-01', 
        endDate: '2013-10-31',
        startYear: 2011,
        endYear: 2013,
        duration: '2 years 3 months',
        chronologicalOrder: 2,
        position: 'Senior Financial Analyst',
        type: 'employment'
      },
      {
        company: 'EXOS formerly Athletes\' Performance',
        startDate: '2013-11-01',
        endDate: '2018-12-31', 
        startYear: 2013,
        endYear: 2018,
        duration: '5+ years',
        chronologicalOrder: 3,
        position: 'Accounts Payable Administrator',
        type: 'employment'
      },
      {
        company: 'PARTNERS+simons, Inc./MERGE',
        startDate: '2019-01-01',
        endDate: '2020-11-30', 
        startYear: 2019,
        endYear: 2020,
        duration: '1 year 11 months',
        chronologicalOrder: 4,
        position: 'Assistant Controller',
        type: 'employment'
      },
      {
        company: 'DOC Painting',
        startDate: '2021-04-01',
        endDate: null, // Current position
        startYear: 2021,
        endYear: null,
        duration: '3+ years',
        chronologicalOrder: 5,
        position: 'Co-owner',
        type: 'employment',
        current: true
      },
      {
        company: 'Babson College Entrepreneurship Research Conference',
        startDate: '2018-01-01',
        endDate: '2019-06-30', 
        startYear: 2018,
        endYear: 2019,
        duration: '1.5 years',
        chronologicalOrder: 3.5, // Overlaps with other roles
        position: 'Conference Assistant',
        type: 'employment'
      },
      {
        company: 'Gaging.com LLC',
        startDate: '2020-01-01',
        endDate: '2021-03-31', 
        startYear: 2020,
        endYear: 2021,
        duration: '1 year 3 months',
        chronologicalOrder: 4.5, // Between MERGE and DOC Painting
        position: 'Financial Administrator',
        type: 'employment'
      }
    ];
    
    console.log('📅 Adding chronological data to Tenure nodes...\n');
    
    for (const tenureData of tenureUpdates) {
      console.log(`🏢 Processing: ${tenureData.company} (${tenureData.startYear}-${tenureData.endYear || 'Present'})`);
      
      // MERGE tenure properties using proper MERGE syntax
      const result = await session.run(`
        MATCH (c:Company)
        WHERE c.name CONTAINS $companyName OR c.name = $exactCompanyName
        MERGE (t:Tenure {company: c.name})-[:AT_COMPANY]->(c)
        ON CREATE SET
          t.startDate = $startDate,
          t.endDate = $endDate,
          t.startYear = $startYear,
          t.endYear = $endYear,
          t.duration = $duration,
          t.chronologicalOrder = $chronologicalOrder,
          t.position = $position,
          t.current = COALESCE($current, false),
          t.createdAt = datetime()
        ON MATCH SET
          t.startDate = $startDate,
          t.endDate = $endDate,
          t.startYear = $startYear,
          t.endYear = $endYear,
          t.duration = $duration,
          t.chronologicalOrder = $chronologicalOrder,
          t.position = $position,
          t.current = COALESCE($current, false),
          t.updatedAt = datetime()
        RETURN count(t) AS tenuresUpdated, c.name AS companyName
      `, {
        companyName: tenureData.company.split(' ')[0], // Match partial company name
        exactCompanyName: tenureData.company,
        startDate: tenureData.startDate,
        endDate: tenureData.endDate,
        startYear: neo4j.int(tenureData.startYear),
        endYear: tenureData.endYear ? neo4j.int(tenureData.endYear) : null,
        duration: tenureData.duration,
        chronologicalOrder: neo4j.int(tenureData.chronologicalOrder),
        position: tenureData.position,
        current: tenureData.current || null
      });
      
      const updated = result.records[0]?.get('tenuresUpdated') || 0;
      const matchedCompany = result.records[0]?.get('companyName') || 'Not found';
      
      console.log(`   ✅ Updated ${updated} tenure(s) for: ${matchedCompany}`);
    }
    
    // Verify the chronological ordering
    console.log('\n🔍 VERIFICATION: Checking updated chronological order...\n');
    
    const verifyResult = await session.run(`
      MATCH (p:Person {name: "Marianne Abrams"})-[:HAS_TENURE]->(t:Tenure)-[:AT_COMPANY]->(c:Company)
      WHERE t.chronologicalOrder IS NOT NULL
      RETURN 
        t.chronologicalOrder AS order,
        c.name AS company,
        t.position AS position,
        t.startYear AS startYear,
        t.endYear AS endYear,
        t.duration AS duration,
        t.current AS current
      ORDER BY t.chronologicalOrder ASC
    `);
    
    console.log('📊 CORRECTED CHRONOLOGICAL ORDER:');
    verifyResult.records.forEach((record) => {
      const order = record.get('order');
      const company = record.get('company');
      const position = record.get('position');
      const startYear = record.get('startYear');
      const endYear = record.get('endYear');
      const duration = record.get('duration');
      const current = record.get('current');
      
      const yearRange = `${startYear}-${endYear || 'Present'}`;
      const currentFlag = current ? ' (CURRENT)' : '';
      
      console.log(`${order}. ${position} at ${company}`);
      console.log(`   📅 ${yearRange} (${duration})${currentFlag}\n`);
    });
    
    console.log('✅ CHRONOLOGICAL DATA SUCCESSFULLY ADDED TO NEO4J!');
    console.log('🎯 AI reasoning should now present correct career timeline!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

fixTenureChronology().catch(console.error);
