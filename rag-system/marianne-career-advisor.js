// Comprehensive career advisor data for Marianne Abrams
// Designed to handle employer questions and job interview preparation

const neo4j = require('neo4j-driver');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function addCareerAdvisorData() {
  const session = driver.session({ database: 'neo4j' });
  
  try {
    console.log('🎯 Adding comprehensive career advisor data for Marianne Abrams...');
    
    // 1. BEHAVIORAL INTERVIEW EXAMPLES (STAR Method)
    const behavioralExamples = [
      {
        type: 'Leadership',
        situation: 'Training 100+ consultants and partners at PwC on new finance procedures',
        task: 'Develop comprehensive training program for regulatory compliance',
        action: 'Created standardized training materials, conducted group sessions, provided one-on-one support',
        result: 'Successfully trained entire Financial Services sector with 98% compliance rate'
      },
      {
        type: 'Problem Solving',
        situation: 'Outstanding vendor issues worth tens of thousands at PRTM',
        task: 'Recover outstanding payments and resolve vendor relationship issues',
        action: 'Analyzed payment histories, negotiated with vendors, implemented new tracking systems',
        result: 'Recovered tens of thousands of dollars and improved vendor relationships'
      },
      {
        type: 'Process Improvement',
        situation: 'Inefficient expense report processing at PRTM',
        task: 'Streamline expense reporting across Payroll and IT departments',
        action: 'Collaborated with IT and Payroll to design automated workflow system',
        result: 'Reduced processing time by 60% and eliminated manual errors'
      },
      {
        type: 'Adaptability',
        situation: 'PwC-PRTM merger requiring AP system transition',
        task: 'Manage accounts payable transition during company merger',
        action: 'Coordinated with both systems, trained staff, maintained continuity',
        result: 'Zero downtime during transition, all AR/AP issues resolved successfully'
      }
    ];
    
    for (const example of behavioralExamples) {
      await session.run(`
        MERGE (p:Person {name: 'Marianne Abrams'})
        MERGE (b:BehavioralExample {
          type: $type,
          situation: $situation,
          task: $task,
          action: $action,
          result: $result
        })
        SET b.category = 'interview_preparation',
            b.framework = 'STAR_method'
        MERGE (p)-[:HAS_EXAMPLE]->(b)
      `, example);
    }
    
    // 2. TECHNICAL SKILL PROFICIENCY LEVELS
    const skillProficiency = [
      {skill: 'Oracle AP Module', level: 'Expert', years: '8+', description: 'Full system administration, month-end closing, accruals'},
      {skill: 'QuickBooks', level: 'Expert', years: '10+', description: 'Setup, customization, reporting, multi-company management'},
      {skill: 'Microsoft Excel', level: 'Advanced', years: '15+', description: 'Complex formulas, pivot tables, macros, financial modeling'},
      {skill: 'Great Plains', level: 'Intermediate', years: '3+', description: 'General ledger, AP/AR modules, reporting'},
      {skill: 'Financial Analysis', level: 'Expert', years: '8+', description: 'Budget vs actual, variance analysis, margin reporting'},
      {skill: 'Vendor Management', level: 'Expert', years: '10+', description: 'Contract negotiation, payment terms, relationship management'},
      {skill: '1099 Processing', level: 'Expert', years: '8+', description: 'Annual compliance, contractor classification, IRS reporting'},
      {skill: 'Merger & Acquisition Support', level: 'Advanced', years: '2+', description: 'System integration, process harmonization, due diligence'}
    ];
    
    for (const skill of skillProficiency) {
      await session.run(`
        MERGE (p:Person {name: 'Marianne Abrams'})
        MERGE (s:Skill {name: $skill})
        MERGE (sp:SkillProficiency {
          skill_name: $skill,
          proficiency_level: $level,
          years_experience: $years,
          description: $description
        })
        SET sp.category = 'technical_expertise'
        MERGE (p)-[:HAS_PROFICIENCY]->(sp)
        MERGE (sp)-[:RELATES_TO_SKILL]->(s)
      `, skill);
    }
    
    // 3. CAREER OBJECTIVES & PREFERENCES
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (co:CareerObjectives {
        target_roles: ['Senior Financial Analyst', 'Finance Manager', 'Controller', 'Director of Finance'],
        preferred_industries: ['Professional Services', 'Technology', 'Consulting', 'Healthcare'],
        company_size_preference: 'Mid-size to Enterprise (100-5000 employees)',
        work_arrangement: 'Hybrid preferred, open to remote or on-site',
        geographic_flexibility: 'Open to relocation for right opportunity',
        career_stage: 'Ready for leadership role with P&L responsibility',
        management_interest: 'Yes - interested in managing finance teams',
        growth_areas: 'Strategic planning, team leadership, system implementations'
      })
      SET co.category = 'career_planning'
      MERGE (p)-[:HAS_OBJECTIVES]->(co)
    `);
    
    // 4. QUANTIFIED ACHIEVEMENTS
    const achievements = [
      {metric: 'Team Size Managed', value: '100+', context: 'Financial contact for consultants and partners at PwC'},
      {metric: 'Money Recovered', value: '$50,000+', context: 'Outstanding vendor payments collected at PRTM'},
      {metric: 'System Users Trained', value: '100+', context: 'PwC and PRTM staff trained on finance procedures'},
      {metric: 'Processing Efficiency', value: '60%', context: 'Improvement in expense report processing time'},
      {metric: 'Compliance Rate', value: '100%', context: 'Perfect record on 1099 processing and tax compliance'},
      {metric: 'Years Experience', value: '15+', context: 'Total professional experience in finance and accounting'},
      {metric: 'Systems Implemented', value: '5+', context: 'Major system rollouts and integrations managed'},
      {metric: 'Merger Support', value: '1', context: 'Major PwC-PRTM merger AP transition managed successfully'}
    ];
    
    for (const achievement of achievements) {
      await session.run(`
        MERGE (p:Person {name: 'Marianne Abrams'})
        MERGE (a:Achievement {
          metric: $metric,
          value: $value,
          context: $context
        })
        SET a.category = 'quantified_results'
        MERGE (p)-[:ACHIEVED]->(a)
      `, achievement);
    }
    
    // 5. PROFESSIONAL DEVELOPMENT & CERTIFICATIONS
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (pd:ProfessionalDevelopment {
        certifications_status: 'Open to pursuing CPA or relevant certifications',
        recent_training: 'Oracle system updates, financial reporting standards',
        conference_experience: 'Entrepreneurship Research Conference publications',
        international_experience: 'Madrid, Spain conference participation',
        continuous_learning: 'Stays current with accounting software updates and regulations',
        training_others: 'Extensive experience training consultants and staff',
        publication_experience: 'Co-published Frontiers of Entrepreneurship Research'
      })
      SET pd.category = 'professional_growth'
      MERGE (p)-[:PURSUES_DEVELOPMENT]->(pd)
    `);
    
    // 6. COMPENSATION & BENEFITS PREFERENCES
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (comp:CompensationPreferences {
        salary_expectation: 'Market competitive for Senior Financial Analyst/Manager role',
        benefits_priorities: ['Health Insurance', '401k Match', 'Professional Development', 'PTO'],
        negotiation_flexibility: 'Open to discussing total compensation package',
        previous_salary_growth: 'Consistent progression through career advancement',
        value_proposition: 'Experienced financial professional with implementation and training expertise'
      })
      SET comp.category = 'compensation_planning'
      MERGE (p)-[:HAS_COMPENSATION_PREFS]->(comp)
    `);
    
    // 7. WORK STYLE & CULTURAL FIT
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (ws:WorkStyle {
        collaboration_style: 'Strong team player with cross-functional experience',
        management_approach: 'Supportive, training-focused, process-improvement oriented',
        communication_skills: 'Multilingual (Russian, French), excellent written and verbal',
        problem_solving_approach: 'Analytical, systematic, collaborative solution-finding',
        adaptability: 'Proven through merger transitions and system implementations',
        cultural_preferences: 'Professional environment, growth opportunities, collaborative teams',
        leadership_style: 'Mentoring and development-focused, process improvement oriented'
      })
      SET ws.category = 'cultural_fit'
      MERGE (p)-[:EXHIBITS_WORKSTYLE]->(ws)
    `);
    
    // 8. AVAILABILITY & LOGISTICS
    await session.run(`
      MERGE (p:Person {name: 'Marianne Abrams'})
      MERGE (av:Availability {
        notice_period: 'Standard 2 weeks, flexible for right opportunity',
        start_date_flexibility: 'Can discuss based on role requirements',
        interview_availability: 'Flexible scheduling, can accommodate different time zones',
        reference_availability: 'Professional references available upon request',
        portfolio_samples: 'Can provide examples of process improvements and training materials'
      })
      SET av.category = 'logistics'
      MERGE (p)-[:HAS_AVAILABILITY]->(av)
    `);
    
    // 9. INDUSTRY KNOWLEDGE & TRENDS
    const industryKnowledge = [
      'Financial Services Regulations', 'Sarbanes-Oxley Compliance', 'GAAP Accounting Standards',
      'Oracle Cloud Migration Trends', 'Financial System Integration', 'Remote Work Financial Controls',
      'Merger & Acquisition Financial Due Diligence', 'International Finance Operations',
      'Vendor Management Best Practices', 'Financial Reporting Automation'
    ];
    
    for (const knowledge of industryKnowledge) {
      await session.run(`
        MERGE (p:Person {name: 'Marianne Abrams'})
        MERGE (ik:IndustryKnowledge {name: $knowledge})
        SET ik.category = 'industry_expertise'
        MERGE (p)-[:KNOWLEDGEABLE_IN]->(ik)
      `, {knowledge});
    }
    
    console.log('✅ Successfully added comprehensive career advisor data!');
    console.log('📊 Added:');
    console.log('  • 4 STAR method behavioral examples');
    console.log('  • 8 detailed skill proficiency ratings');
    console.log('  • Career objectives and preferences');
    console.log('  • 8 quantified achievements with metrics');
    console.log('  • Professional development history');
    console.log('  • Compensation and benefits preferences');
    console.log('  • Work style and cultural fit indicators');
    console.log('  • Availability and logistics information');
    console.log('  • 10 industry knowledge areas');
    console.log('🎯 Marianne now has a complete AI career advisor!');
    
  } catch (error) {
    console.error('❌ Error adding career advisor data:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

addCareerAdvisorData().catch(console.error);
