// Add Marianne Abrams resume data to Neo4j knowledge base
// This helps reduce AI hallucinations by providing factual resume information

const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '../.env' });

// Neo4j connection
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function addMarianneResumeData() {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🔍 Adding Marianne Abrams resume data to Neo4j...');
    
    // Create main Person node for Marianne
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      SET p.resume_updated = '2024',
          p.languages = ['Russian (Fluent)', 'French (Conversational)'],
          p.skills_computer = ['Microsoft PowerPoint', 'Word', 'Excel', 'Outlook', 'Zoom calls'],
          p.skills_systems = ['QuickBooks (Excellent)', 'Advantage', 'Clients & Profits', 'OpenAir', 'Great Plains', 'Oracle', 'Concur'],
          p.category = 'professional_resume'
    `);
    
    // Work Experience - PricewaterhouseCoopers LLP
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (j:Job {
        company: 'PricewaterhouseCoopers LLP',
        location: 'Boston, MA',
        title: 'Senior Financial Analyst',
        start_date: 'August 2011',
        end_date: 'October 2013'
      })
      SET j.responsibilities = [
        'Trained PwC and PRTM Consultants and Partners through new finance and regulatory procedures',
        'Set up and released charge codes after thorough review of regulatory and financial details',
        'Transitioned AP for merger and helped close out remaining AP and AR issues',
        'Served as primary finance contact for over 100 consultants and Partners in Financial Services sector',
        'Assisted teams on project financials: training on Advisory Pricing Tool, making financial adjustments',
        'Reviewed and approved time and expense transfers based on financial reporting impact',
        'Generated monthly reconciliation and production of operating margin report',
        'Filled in for Leadership to produce pipeline reporting for sector leaders',
        'Ran dozens of reports from GFS and BW systems for consulting teams'
      ],
      j.category = 'work_experience'
      MERGE (p)-[:WORKED_AT]->(j)
    `);
    
    // Work Experience - PRTM Management Consultants
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (j:Job {
        company: 'PRTM Management Consultants, Inc.',
        location: 'Waltham, MA',
        title: 'Senior Accounts Payable Specialist / Accounts Payable Administrator',
        start_date: 'January 2009',
        end_date: 'August 2011'
      })
      SET j.responsibilities = [
        'Managed all aspects of AP for US and Government operations: processing invoices, Oracle entry, issuing payments',
        'Performed month-end and year-end closing in Oracle AP Module and developed month-end accruals',
        'Maintained monthly reconciliations for cash, prepaid expenses, and insurance accounts',
        'Collected vendor documentation: W-9, W8-BEN, and Business Size Classification Forms',
        'Refined systems for tracking fixed assets and sales tax to be remitted',
        'Responsible for preparing and issuing 1099 Forms every year',
        'Worked with international Finance to manage intercompany charges and invoicing',
        'Coordinated with Accounts Receivable to organize and maintain client charges',
        'Resolved outstanding vendor issues, collecting tens of thousands of dollars for PRTM',
        'Led projects to implement new supplier programs, such as worldwide FedEx usage',
        'Collaborated with Payroll and IT to develop seamless expense report processing system'
      ],
      j.category = 'work_experience'
      MERGE (p)-[:WORKED_AT]->(j)
    `);
    
    // Work Experience - Gaging.com LLC
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (j:Job {
        company: 'Gaging.com LLC',
        location: 'Las Vegas, NV',
        title: 'Financial Administrator',
        start_date: 'January 2014',
        end_date: 'March 2014'
      })
      SET j.responsibilities = [
        'Prepared financial sales data necessary to file taxes',
        'Reviewed all invoices and sales backup documentation to ensure accuracy',
        'Entered applicable details in tracking system',
        'Helped optimize Excel tracking tool and formulas',
        'Coordinated with Sales Partners to resolve discrepancies, reconciling debit/credit issues'
      ],
      j.category = 'work_experience'
      MERGE (p)-[:WORKED_AT]->(j)
    `);
    
    // Work Experience - Babson College
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (j:Job {
        company: 'Babson College Entrepreneurship Research Conference',
        location: 'Wellesley, MA',
        title: 'Conference Assistant',
        start_date: 'Summer 2005',
        end_date: 'Spring 2007'
      })
      SET j.responsibilities = [
        'Managed and prepared events: logistics, presentations, attendees',
        'Attended three annual conferences, assisting with registration and organization',
        'Attended conference in Madrid, Spain',
        'Co-published and edited Frontiers of Entrepreneurship Research, conference findings'
      ],
      j.category = 'work_experience'
      MERGE (p)-[:WORKED_AT]->(j)
    `);
    
    // Create skill nodes and relationships
    const skills = [
      'Microsoft PowerPoint', 'Microsoft Word', 'Microsoft Excel', 'Microsoft Outlook', 'Zoom',
      'QuickBooks', 'Advantage', 'Clients & Profits', 'OpenAir', 'Great Plains', 'Oracle', 'Concur',
      'Russian Language', 'French Language', 'Financial Analysis', 'Accounts Payable', 'Accounts Receivable',
      'Month-end Closing', 'Year-end Closing', 'Vendor Management', '1099 Processing', 'Expense Report Processing'
    ];
    
    for (const skill of skills) {
      await session.run(`
        MERGE (p:Person {name: 'Marianne Abrams'})
        MERGE (s:Skill {name: $skill})
        SET s.category = 'professional_skill'
        MERGE (p)-[:HAS_SKILL]->(s)
      `, { skill });
    }
    
    console.log('✅ Successfully added Marianne Abrams resume data to Neo4j!');
    console.log('📊 Added: Person profile, 4 job experiences, and 20+ skills');
    console.log('🎯 This will help reduce AI hallucinations by providing factual resume information');
    
  } catch (error) {
    console.error('❌ Error adding resume data:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the function
addMarianneResumeData().catch(console.error);
