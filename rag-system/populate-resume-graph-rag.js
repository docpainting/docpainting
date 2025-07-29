// populate-resume-graph-rag.js
// Ingests Marianne Abrams' resume using a detailed Graph RAG methodology.

const neo4j = require('neo4j-driver');
const fetch = require('node-fetch');
require('dotenv').config();

// --- NEO4J & EMBEDDING SETUP (No changes from previous script) ---
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

async function generateQwenEmbedding(text) {
  // This function remains the same. It calls the HF Router for embeddings.
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

// --- STRUCTURED RESUME DATA ---
// Data extracted and structured from the provided PDF.
const resumeData = {
  person: {
    name: "Marianne Abrams",
    email: "Marianne.abrams@yahoo.com",
    phone: "(508) 309-0399",
    location: "Holbrook, MA 02343",
    summary: "A finance and operations professional with extensive experience in financial reporting, management, accounting operations, and business strategy."
  },
  education: [
    { institution: "Babson College", degree: "Bachelor of Science, Business Management", concentration: "Finance" },
    { institution: "University of Paris, Sorbonne" }
  ],
  skills: {
    "IT Systems": ["Quickbooks", "Advantage", "Clients & Profits", "OpenAir", "Great Plains", "Oracle", "Concur"],
    "Languages": ["Russian (Fluent)", "French (Conversational)"]
  },
  experience: [
    {
      company: "DOC Painting",
      location: "Holbrook, MA",
      roles: [{ title: "Co-owner", startDate: "APR 2021", endDate: "PRESENT" }],
      chunks: [
        "Oversaw financial operations, including budgeting, bookkeeping, and financial reporting.",
        "Responsible for generating quotes and contracts, following in-person estimates.",
        "Assisted in developing business strategies and managing client relationships.",
        "Handled day-to-day operations, including cash management, scheduling, inventory management, and supplier relations."
      ]
    },
    {
      company: "PARTNERS+simons, Inc./MERGE",
      location: "Boston, MA",
      roles: [
        { title: "Assistant Controller", startDate: "JAN 2019", endDate: "NOV 2020" },
        { title: "Accounting Manager", startDate: "APR 2016", endDate: "DEC 2018" },
        { title: "Senior Staff Accountant", startDate: "JUN 2015", endDate: "MAR 2016" },
        { title: "Staff Accountant", startDate: "NOV 2014", endDate: "MAY 2015" }
      ],
      chunks: [
        "Managed revenue, which entailed analyzing actuals vs. forecast, working with account teams to determine monthly revenue recognition, processing all transactions, and organizing and tracking unbilled fee revenue and deferred fee revenue.",
        "Coordinated in-house audits and external (IRS, 401k) audits and all government compliance.",
        "Oversaw and booked all bank transactions, cash application, movement of funds across 10 bank accounts, and client payments.",
        "Supervised all client billing and internal billing transactions, and directly handled all non-media billing for 35 clients.",
        "Included review and tracking of all SOWs.",
        "Processed and reviewed monthly close procedures, General Ledger and balance sheet account reconciliations, standard journal entries, fixed assets, depreciation, sales tax remittance, and Accounts Payable and Accounts Receivable reconciliations.",
        "Trained and directly supervised Staff Accountant and Accounting Manager, leading a team of 5 roles."
      ]
    },
    {
        company: "PricewaterhouseCoopers LLP (Acquired PRTM)",
        location: "Boston, MA",
        roles: [
            { title: "Senior Financial Analyst", startDate: "AUG 2011", endDate: "OCT 2013" },
            { title: "Senior Accounts Payable Specialist", startDate: "JAN 2011", endDate: "AUG 2011" },
            { title: "Accounts Payable Administrator", startDate: "JAN 2009", endDate: "DEC 2010" }
        ],
        chunks: [
            "Trained PwC and PRTM Consultants and Partners through new finance and regulatory procedures.",
            "Transitioned AP for the merger and helped to close out all remaining AP and AR issues.",
            "Served as the primary finance contact for over one hundred consultants and Partners in the Financial Services sector of Advisory.",
            "Managed all aspects of AP for US and Government operations: processing all invoices, entry into Oracle, and issuing payments.",
            "Performed month-end and year-end closing in Oracle AP Module and developed month-end accruals.",
            "Resolved prior outstanding vendor issues, collecting on tens of thousands of dollars for PRTM."
        ]
    },
    {
      company: "EXOS formerly Athletes' Performance",
      location: "Norwell, MA",
      roles: [{ title: "Accounts Payable Administrator", startDate: "OCT 2014", endDate: "MAR 2015" }],
      chunks: [
        "Reorganized all filing, especially the 2014 filing system, to be optimal for audits.",
        "Reviewed and reconciled employee expense reports",
        "Organized, coded, and entered invoices into the Great Plains system."
      ]
    },
    {
      company: "Gaging.com LLC",
      location: "Las Vegas, NV",
      roles: [{ title: "Financial Administrator", startDate: "JAN 2014", endDate: "MAR 2014" }],
      chunks: [
        "Prepared financial sales data necessary to file taxes. This entailed reviewing all invoices and sales backup documentation to ensure accuracy and entering the applicable details in the tracker.",
        "Coordinated with Sales Partners to resolve all discrepancies, reconciling debit/credit issues."
      ]
    },
    {
        company: "Babson College Entrepreneurship Research Conference",
        location: "Wellesley, MA",
        roles: [{ title: "Conference Assistant", startDate: "SUMMER 2005", endDate: "SPRING 2007" }],
        chunks: [
            "Managed and prepared events: logistics, presentations, attendees.",
            "Attended three annual conferences, assisting with registration and organization, including one held in Madrid, Spain.",
            "Co-published and edited Frontiers of Entrepreneurship Research, conference findings."
        ]
    }
  ]
};

async function main() {
  const session = driver.session({ database: 'neo4j' });

  try {
    console.log("--- Starting Graph Population ---");

    // 1. Cleanup and Index Creation
    console.log("Step 1: Cleaning old data and setting up vector indexes...");
    await session.run("MATCH (n) DETACH DELETE n");
    await session.run("CREATE VECTOR INDEX chunk_embeddings IF NOT EXISTS FOR (c:Chunk) ON (c.embedding) OPTIONS {indexConfig: {`vector.dimensions`: 4096, `vector.similarity_function`: 'cosine'}}");
    console.log("✅ Cleanup and indexing complete.");

    // 2. Create Person Node
    console.log("Step 2: Creating Person node...");
    const person = resumeData.person;
    const personEmbedding = await generateQwenEmbedding(`Summary for ${person.name}: ${person.summary}`);
    await session.run(
      `CREATE (p:Person {name: $name, email: $email, phone: $phone, location: $location, summary: $summary, embedding: $embedding})`,
      { ...person, embedding: personEmbedding }
    );
    console.log(`✅ Created node for ${person.name}.`);

    // 3. Create Education Nodes
    console.log("Step 3: Creating Education nodes...");
    for (const edu of resumeData.education) {
        await session.run(
            `MATCH (p:Person {name: $personName})
             MERGE (i:Institution {name: $institution})
             CREATE (p)-[r:STUDIED_AT]->(i)
             SET r += $props`,
            {
                personName: person.name,
                institution: edu.institution,
                props: {
                    degree: edu.degree ? edu.degree : null, 
                    concentration: edu.concentration ? edu.concentration : null
                }
            }
        );
    }
    console.log("✅ Created education relationships.");

    // 4. Create Skill Nodes
    console.log("Step 4: Creating Skill nodes...");
    for (const category in resumeData.skills) {
        for (const skillName of resumeData.skills[category]) {
            await session.run(
                `MATCH (p:Person {name: $personName})
                 MERGE (s:Skill {name: $skillName, category: $category})
                 MERGE (p)-[:HAS_SKILL]->(s)`,
                { personName: person.name, skillName, category }
            );
        }
    }
    console.log("✅ Created skill relationships.");

    // 5. Create Experience Graph (Jobs, Tenures, Companies, Chunks)
    console.log("Step 5: Processing professional experience...");
    for (const exp of resumeData.experience) {
      // Merge company node
      await session.run(`MERGE (c:Company {name: $name, location: $location})`, { name: exp.company, location: exp.location });

      // Create a Tenure node to group roles at a single company
      const tenureResult = await session.run(
        `MATCH (p:Person {name: $personName})
         MATCH (c:Company {name: $companyName})
         CREATE (t:Tenure)
         CREATE (p)-[:HAD_TENURE]->(t)
         CREATE (t)-[:AT_COMPANY]->(c)
         RETURN id(t) AS tenureId`,
        { personName: person.name, companyName: exp.company }
      );
      const tenureId = tenureResult.records[0].get('tenureId');
      console.log(`  - Created Tenure at ${exp.company}`);

      // Create Job nodes for each role within the tenure
      for (const role of exp.roles) {
        await session.run(
            `MATCH (t:Tenure) WHERE id(t) = $tenureId
             CREATE (j:Job { 
                 title: $title,
                 startDate: $startDate,
                 endDate: $endDate
             })
             CREATE (t)-[:INCLUDES_ROLE]->(j)`,
            { tenureId, ...role }
        );
      }
      
      // Create and connect Chunk nodes for each responsibility
      for (const chunkText of exp.chunks) {
        const enrichedText = `At ${exp.company}, while holding roles like ${exp.roles.map(r => r.title).join(', ')}, Marianne Abrams was responsible for the following: "${chunkText}"`;
        const chunkEmbedding = await generateQwenEmbedding(enrichedText);
        if (chunkEmbedding) {
          await session.run(
            `MATCH (t:Tenure) WHERE id(t) = $tenureId
             CREATE (c:Chunk {text: $text, embedding: $embedding})
             CREATE (t)-[:HAS_RESPONSIBILITY]->(c)`,
            { tenureId, text: chunkText, embedding: chunkEmbedding }
          );
        }
      }
      console.log(`  - Processed ${exp.chunks.length} chunks for ${exp.company}.`);
    }

    console.log("\n--- ✅ Population Complete! ---");

  } catch (error) {
    console.error("❌ An error occurred during population:", error);
  } finally {
    await session.close();
    await driver.close();
    console.log("--- Connection Closed ---");
  }
}

main();
