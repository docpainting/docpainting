// config.js - Central configuration for dynamic prompting system
// This config guides prompt generation, forking, and reasoning across use cases.
// Structure: Shared (global), plus per-use-case sections.
// Load via: const config = require('./config.js');
// Usage in methods: e.g., if (config.useCase === 'painting_crm') { ... }
// Scaling: Add new topics/modes/services here; methods like getSectionEmphasis reference these maps.

module.exports = {
    // Shared Configs (Applicable to all use cases)
    useCase: 'career', // Default; override at runtime (e.g., via env or query param). Options: 'career', 'painting_crm'
    forkRules: {
      // Fork definitions: Key = fork name, value = { condition: fn(topics, query, mode), modifiers: { ... }, description: string }
      high_priority: {
        condition: (topics, query) => query.toLowerCase().includes('urgent') || topics.includes('problem_solving'),
        modifiers: {
          emphasisBoosts: { minWords: 100 }, // Increase min words for detailed responses
          additionalRequirements: ['Prioritize quick, actionable insights.']
        },
        description: 'Fork for urgent or problem-solving queries.'
      },
      calculation_heavy: {
        condition: (topics, query) => topics.includes('problem_solving') || query.toLowerCase().includes('calculate') || query.toLowerCase().includes('estimate'),
        modifiers: {
          emphasisBoosts: { 'Responsibility Correlation': 1.2 }, // Boost for breakdowns
          additionalRequirements: ['Use step-by-step calculations; show work.']
        },
        description: 'Fork for math/estimation-intensive queries.'
      },
      default: {
        condition: () => true,
        modifiers: {},
        description: 'Standard fallback fork.'
      }
      // Scale: Add forks like 'multi_service' for painting CRM combos
    },
    // CONSOLIDATED: Enhanced reasoningMethods with base + extensions pattern
    reasoningMethods: {
      // Shared base templates for inheritance
      base: {
        stepBased: {
          structure: '1. [Step1]. 2. [Step2]. 3. [Step3]. 4. [Step4].',
          commonSteps: ['analysis', 'synthesis', 'validation', 'conclusion']
        },
        retrieval: {
          template: 'Retrieve from DB: {db_query}. Context: {retrieved}. Synthesize response.',
          when: ['inquire', 'data_driven']
        }
      },
      
      // CONSOLIDATED: Calculation & Logic Reasoning (merged cot + estimation_reasoning)
      calculation_reasoning: {
        template: 'Step-by-Step Calculation: 1. Identify key elements and parameters. 2. Apply formulas and logic. 3. Factor in variables and constraints. 4. Present breakdown with conclusions.',
        when: ['calculation', 'quoting', 'problem_solving', 'estimation', 'quote_estimation', 'service_booking'],
        steps: ['parameter_identification', 'formula_application', 'variable_adjustment', 'breakdown_presentation'],
        modes: {
          basic: 'Think step-by-step reasoning',
          estimation: 'Quote calculation with pricing formulas',
          problem_solving: 'Logical problem resolution'
        }
      },
      
      // CONSOLIDATED: Branching & Options Reasoning (merged tot + recommendation_reasoning)
      branching_reasoning: {
        template: 'Options Exploration: 1. Identify available branches/options. 2. Assess each path/choice. 3. Compare benefits and constraints. 4. Select optimal solution with alternatives.',
        when: ['comparative_analysis', 'service_booking', 'service_inquiry', 'material_selection', 'options'],
        steps: ['option_identification', 'path_assessment', 'benefit_comparison', 'optimal_selection'],
        modes: {
          exploration: 'Tree-of-thought branching',
          recommendation: 'Service/solution recommendations',
          comparison: 'Multi-option analysis'
        }
      },
      
      // CONSOLIDATED: Sequential & Temporal Reasoning (merged timeline_reasoning + causal_reasoning)
      sequential_reasoning: {
        template: 'Sequential Analysis: 1. Extract temporal/causal data. 2. Establish chronological/logical order. 3. Identify patterns and connections. 4. Synthesize progression narrative.',
        when: ['timeline_analysis', 'career_progression', 'responsibility_analysis', 'achievement_focus', 'sequence'],
        steps: ['data_extraction', 'ordering_establishment', 'pattern_identification', 'narrative_synthesis'],
        modes: {
          timeline: 'Chronological progression analysis',
          causal: 'Cause-effect relationship tracing',
          progression: 'Development pattern identification'
        }
      },
      
      // CONSOLIDATED: Integration & Validation Reasoning (merged narrative_synthesis + self_consistency + evidence_validation)
      integrative_reasoning: {
        template: 'Integration & Validation: 1. Synthesize multiple sources/insights. 2. Check consistency and evidence quality. 3. Resolve conflicts and contradictions. 4. Generate coherent, validated narrative.',
        when: ['synthesis', 'integration', 'storytelling', 'final_response', 'high_stakes', 'complex_queries', 'fact_checking', 'validation_required'],
        steps: ['source_synthesis', 'consistency_check', 'conflict_resolution', 'narrative_generation'],
        modes: {
          synthesis: 'Multi-source integration',
          validation: 'Evidence quality assessment',
          consistency: 'Cross-reference validation'
        }
      },
      
      // CONSOLIDATED: Diagnostic & Inference Reasoning (merged abductive_reasoning + problem_solving)
      diagnostic_reasoning: {
        template: 'Diagnostic Inference: 1. Observe facts and symptoms. 2. Generate hypotheses/solutions. 3. Evaluate plausibility and feasibility. 4. Select best explanation/action plan.',
        when: ['diagnosis', 'hypothesis', 'inference', 'customer_support', 'troubleshooting'],
        steps: ['observation', 'hypothesis_generation', 'evaluation', 'selection'],
        modes: {
          abductive: 'Best explanation inference',
          troubleshooting: 'Problem diagnosis and resolution',
          root_cause: 'Root cause analysis'
        }
      },
      
      // SPECIALIZED: Keep distinct methods for unique capabilities
      skill_inference: {
        template: 'Skill Extraction: 1. Map responsibilities to skill categories. 2. Infer proficiency from experience depth. 3. Validate against role progression. 4. Categorize by skill type.',
        when: ['skills_assessment', 'technical_expertise'],
        steps: ['responsibility_mapping', 'proficiency_inference', 'validation', 'categorization']
      },
      
      comparative_reasoning: {
        template: 'Comparative Framework: 1. Identify comparison dimensions. 2. Extract parallel data points. 3. Highlight differences and similarities. 4. Draw conclusions with "whereas" and "in contrast" language.',
        when: ['comparative_analysis', 'comparison'],
        steps: ['dimension_identification', 'parallel_extraction', 'contrast_analysis', 'conclusion_synthesis']
      },
      
      // NEW: Essential Methods (2025 Research)
      analogical_reasoning: {
        template: 'Analogical Mapping: 1. Identify similar past cases. 2. Map parallels. 3. Transfer insights. 4. Adapt to current query.',
        when: ['recommendation', 'skill_transfer', 'analogy'],
        steps: ['case_identification', 'parallel_mapping', 'insight_transfer', 'adaptation']
      },
      
      counterfactual_reasoning: {
        template: 'What-If Analysis: 1. Establish baseline. 2. Alter variables. 3. Simulate outcomes. 4. Compare to actual.',
        when: ['scenario_planning', 'risk_assessment', 'alternatives', 'what_if'],
        steps: ['baseline_establish', 'variable_alter', 'outcome_simulation', 'comparison']
      },
      
      probabilistic_reasoning: {
        template: 'Bayesian Update: 1. Set priors. 2. Gather evidence. 3. Update probabilities. 4. Infer conclusions.',
        when: ['uncertainty', 'risk', 'prediction', 'probability'],
        steps: ['prior_setting', 'evidence_gathering', 'probability_update', 'inference']
      },
      
      // NEW: Advanced Strategic Reasoning Methods
      holistic_iterative_reasoning: {
        template: 'Holistic Iteration: 1. Establish big-picture view. 2. Analyze component interactions. 3. Iterate through refinement cycles. 4. Synthesize evolved understanding.',
        when: ['systems_thinking', 'complex_analysis', 'iterative_refinement', 'holistic_view'],
        steps: ['big_picture_establishment', 'interaction_analysis', 'refinement_iteration', 'evolved_synthesis'],
        features: ['multiple_cycles', 'system_perspective', 'continuous_refinement']
      },
      
      step_back_reasoning: {
        template: 'Step Back Analysis: 1. Identify current focus/constraints. 2. Step back to broader context. 3. Reframe from higher perspective. 4. Apply insights to original problem.',
        when: ['reframing', 'perspective_shift', 'problem_solving', 'meta_analysis'],
        steps: ['constraint_identification', 'context_broadening', 'perspective_reframing', 'insight_application'],
        features: ['perspective_shift', 'constraint_release', 'meta_level_thinking']
      },
      
      six_hats_reasoning: {
        template: 'Six Hats Analysis: 1. White Hat (Facts/Info). 2. Red Hat (Emotions/Feelings). 3. Black Hat (Critical/Cautions). 4. Yellow Hat (Benefits/Optimism). 5. Green Hat (Creativity/Alternatives). 6. Blue Hat (Process/Meta-thinking).',
        when: ['comprehensive_analysis', 'decision_making', 'perspective_exploration', 'structured_thinking'],
        steps: ['facts_analysis', 'emotions_consideration', 'critical_evaluation', 'benefits_identification', 'creative_alternatives', 'process_control'],
        modes: {
          white: 'Facts and objective information',
          red: 'Emotions and intuitive responses', 
          black: 'Critical judgment and risks',
          yellow: 'Optimistic benefits and opportunities',
          green: 'Creative alternatives and innovation',
          blue: 'Process control and meta-cognition'
        },
        features: ['multi_perspective', 'structured_exploration', 'comprehensive_coverage']
      },
      
      // COMPREHENSIVE: Hierarchical Sequential (master orchestrator)
      hierarchical_sequential: {
        template: 'Hierarchical Analysis: 1. Identify main components. 2. Break into sub-problems. 3. Address dependencies in order. 4. Build incrementally with validation. 5. Integrate and revise as needed.',
        when: ['step_by_step', 'logical_progression', 'incremental_analysis', 'complex_problems', 'uncertain_scope', 'multi_step_validation', 'complex_architecture', 'dependency_management', 'system_design'],
        steps: ['component_identification', 'sub_problem_breakdown', 'dependency_analysis', 'incremental_building', 'integration_validation'],
        features: ['auto_scales_complexity', 'handles_simple_linear', 'supports_revision', 'manages_dependencies', 'adaptive_branching'],
        canOrchestrate: ['calculation_reasoning', 'branching_reasoning', 'sequential_reasoning', 'integrative_reasoning', 'diagnostic_reasoning']
      },
      
      // RAG: Keep as foundational
      rag: {
        template: 'Retrieve from DB: {db_query}. Context: {retrieved}. Synthesize response.',
        when: ['inquire', 'data_retrieval', 'knowledge_base'],
        steps: ['query_generation', 'data_retrieval', 'context_integration', 'response_synthesis']
      }
      // Scale: Add 'predictive_reasoning' for forecasting
    },
    /* DEPRECATED crmWorkflows replaced by crmFlow */
    // crmWorkflows: [
    //   { step: 'lead_capture', prompt: 'After answering {query}, ask for email/phone to follow up.' },
    //   { step: 'booking', prompt: 'Suggest availability slots from DB after service confirmation.' },
    //   { step: 'upsell', prompt: 'If {query} is basic, recommend add-ons like high-end finishes.' }
    // ],

    crmFlow: {
      stages: [
        {
          name: 'lead_capture',
          prompt: 'After answering {query}, ask for email/phone to follow up.',
          next: 'booking'
        },
        {
          name: 'booking',
          prompt: 'Suggest availability slots from DB after service confirmation.',
          next: 'upsell'
        },
        {
          name: 'upsell',
          prompt: 'If {query} is basic, recommend add-ons like high-end finishes.',
          next: null
        }
      ]
    },
    dbPlaceholders: {
      // Templates for RAG/DB queries (reason over in formatHybridContext)
      services_query: 'SELECT * FROM services WHERE name LIKE "%{service}%"',
      quotes_query: 'SELECT pricing FROM quotes WHERE service = "{service}" AND date > "{current_date}"',
      career_query: 'MATCH (p:Person)-[:HAS_JOB]->(j:Job) WHERE p.name = "{name}" RETURN j'
      // Scale: Add 'customer_history' for personalized CRM responses
    },
    baseEmphasis: {
      // Base for all sections (used in getSectionEmphasis)
      'Timeline Analysis': 1.0,
      'Responsibility Correlation': 1.0,
      'Skill Inference': 1.0,
      'Narrative Synthesis': 1.5,
      minWords: 200
    },
    modeAdjustments: {
      // Existing + additions (multipliers applied in getSectionEmphasis)
      SYNTHESIS: { 'Narrative Synthesis': 1.2, 'Timeline Analysis': 1.1 },
      ANALYSIS: { 'Skill Inference': 1.2, 'Responsibility Correlation': 1.1 },
      INSIGHT_HEAVY: { 'Narrative Synthesis': 1.3 },
      GENERAL: {},
      // New for CRM
      CRM_QUOTING: { 'Narrative Synthesis': 1.4 },
      CUSTOMER_SUPPORT: { 'Timeline Analysis': 1.2 },
      CAREER_ADVICE: { 'Narrative Synthesis': 1.3, 'Skill Inference': 1.1 }
      // Scale: Add 'SALES_PROMO' for seasonal adjustments
    },
  
    // Career-Specific Configs (Fork if useCase === 'career')
    career: {
      topicEmphasisMappings: {
        // Existing + additions
        timeline_analysis: { 'Timeline Analysis': 1.0 },
        career_progression: { 'Timeline Analysis': 0.8, 'Narrative Synthesis': 0.5 },
        skills_assessment: { 'Skill Inference': 1.0 },
        technical_expertise: { 'Skill Inference': 0.8, 'Responsibility Correlation': 0.5 },
        comparative_analysis: { 'Responsibility Correlation': 0.7, 'Skill Inference': 0.7 },
        education_background: { 'Timeline Analysis': 0.6, 'Narrative Synthesis': 0.4 },
        leadership_skills: { 'Responsibility Correlation': 0.8, 'Skill Inference': 0.6 },
        general: {},
        // New
        salary_negotiation: { 'Narrative Synthesis': 1.2 },
        job_search: { 'Skill Inference': 1.0, 'Timeline Analysis': 0.8 }
        // Scale: Add 'interview_prep' or 'resume_optimization'
      },
      sectionExampleTemplates: {
        // Functions for dynamic examples (used in getTailoredExamples)
        'Timeline Analysis': (topic, query, emphasis, topics) => `Example: Progressed from Analyst (2015-2018) to Manager, relating to '${query}'.`,
        // ... existing ones
        'Career Advice': (topic, query, emphasis, topics) => `Example: For '${query}', suggest upskilling in ${topic}.`
        // Scale: Add per new section/topic
      }
    },
  
    // Painting CRM-Specific Configs (Fork if useCase === 'painting_crm')
    painting_crm: {
      topicEmphasisMappings: {
        // Tailored to services
        quote_estimation: { 'Responsibility Correlation': 1.2 },
        service_booking: { 'Timeline Analysis': 1.0 },
        material_selection: { 'Skill Inference': 0.8 },
        comparative_analysis: { 'Responsibility Correlation': 0.7, 'Skill Inference': 0.7 },
        general: {},
        // New service-specific
        interior_exterior: { 'Narrative Synthesis': 1.1 },
        deck_staining: { 'Timeline Analysis': 0.9 },
        cabinet_refinishing: { 'Skill Inference': 1.0 },
        faux_custom: { 'Responsibility Correlation': 1.0 }
        // Scale: Add 'high_end_painting' or new services like 'wallpaper'
      },
      sectionExampleTemplates: {
        // Customized for business
        'Narrative Synthesis': (topic, query, emphasis, topics) => `Example: For '${query}' on deck staining, summarize protection benefits and cost.`,
        // ... add per section
        'Quote Breakdown': (topic, query, emphasis, topics) => `Example: Interior painting estimate: ${query} sq ft at $X, total $Y.`
        // Scale: Templates for new intents like 'upsell_example'
      },
      serviceDetails: {
        // Core data for reasoning (used in formatHybridContext or examples)
        interior_painting: { desc: 'Indoor color application with premium paints.', pricing: 'sq_ft * 5' }, // Formula for CoT
        exterior_painting: { desc: 'Weather-resistant outdoor finishes.', pricing: 'sq_ft * 6' },
        high_end_painting: { desc: 'Luxury textures and custom blends.', pricing: 'sq_ft * 8' },
        deck_staining: { desc: 'Wood protection with semi-transparent stains.', pricing: 'sq_ft * 4' },
        cabinet_refinishing: { desc: 'Restore cabinets with new stain/paint.', pricing: 'unit * 50' },
        faux_painting: { desc: 'Artistic effects like marble or wood grain.', pricing: 'sq_ft * 7' },
        custom_painting: { desc: 'Bespoke designs per client specs.', pricing: 'custom_quote' }
        // Scale: Add 'eco_painting': { ... }
      },
      crmIntents: [
        // Intents mapping to consolidated reasoning methods
        { intent: 'quote', method: 'calculation_reasoning', requirements: 'Include pricing breakdown.' },
        { intent: 'book', method: 'branching_reasoning', requirements: 'Check availability slots.' },
        { intent: 'inquire', method: 'rag', requirements: 'Pull service desc from DB.' }
        // Scale: Add 'upsell' or 'feedback'
      ],

    // New: Neo4j-specific configs for forking analysis
    neo4jForkMappings: {
      // Shared/Existing
      general: {
        cypherTemplate: 'MATCH (n) RETURN n LIMIT {limit}',
        modifiers: { limit: 10 }
      },
      timeline_analysis: {
        cypherTemplate: 'MATCH (p:Person)-[r:HAS_TENURE]->(t:Tenure) WHERE p.name = "{name}" RETURN t ORDER BY t.startDate',
        modifiers: { sort: 'ASC' }
      },
      skills_assessment: {
        cypherTemplate: 'MATCH (p:Person)-[:HAS_SKILL]->(s:Skill) RETURN s.name, s.proficiency',
        modifiers: { filter: 'proficiency > 0.7' }
      },
      // NEW: Career-specific for Marianne
      comparative_analysis: {
        cypherTemplate: 'MATCH (p:Person)-[:HAS_TENURE]->(t1:Tenure)-[:AT_COMPANY]->(c1:Company), (p)-[:HAS_TENURE]->(t2:Tenure)-[:AT_COMPANY]->(c2:Company) WHERE p.name = "{name}" AND c1.name = "{company1}" AND c2.name = "{company2}" RETURN t1, t2, c1, c2',
        modifiers: { compareFields: ['responsibilities', 'skills', 'duration'] }
      },
      education_background: {
        cypherTemplate: 'MATCH (p:Person)-[:ATTENDED]->(e:Education) WHERE p.name = "{name}" RETURN e.institution, e.degree, e.gpa, e.honors, e.startDate, e.endDate',
        modifiers: { sort: 'startDate' }
      },
      company_analysis: {
        cypherTemplate: 'MATCH (p:Person)-[:HAS_TENURE]->(t:Tenure)-[:AT_COMPANY]->(c:Company) WHERE p.name = "{name}" AND c.name = "{company}" RETURN t, c, t.responsibilities, t.achievements',
        modifiers: { includeRelated: true }
      },
      responsibility_analysis: {
        cypherTemplate: 'MATCH (p:Person)-[:HAS_TENURE]->(t:Tenure) WHERE p.name = "{name}" RETURN t.title, t.responsibilities, t.startDate, t.endDate ORDER BY t.startDate',
        modifiers: { expandText: true }
      },
      achievement_focus: {
        cypherTemplate: 'MATCH (p:Person)-[:HAS_ACHIEVEMENT|:HAS_RECOGNITION]->(a) WHERE p.name = "{name}" RETURN a.type, a.description, a.date',
        modifiers: { relevanceScore: true }
      },
      // NEW: Customer-facing painting business
      service_inquiry: {
        cypherTemplate: 'MATCH (s:Service) WHERE s.name CONTAINS "{service_type}" RETURN s.name, s.description, s.basePrice, s.duration',
        modifiers: { includeImages: true, sortBy: 'popularity' }
      },
      /* DEPRECATED individual pricing forks merged into pricing_fork */
      quote_request: {
        cypherTemplate: 'MATCH (s:Service)-[:HAS_PRICING]->(p:PricingRule) WHERE s.name = "{service}" RETURN s, p.formula, p.materialCost, p.laborRate',
        modifiers: { calculateTotal: true, includeDiscounts: true }
      },
      availability_check: {
        cypherTemplate: 'MATCH (t:TimeSlot)-[:FOR_SERVICE]->(s:Service) WHERE s.name = "{service}" AND t.date >= "{requested_date}" AND t.available = true RETURN t.date, t.timeRange',
        modifiers: { limit: 10, bufferDays: 3 }
      },
      color_consultation: {
        cypherTemplate: 'MATCH (c:Color)-[:SUITABLE_FOR]->(r:Room), (c)-[:PAIRS_WITH]->(c2:Color) WHERE r.type = "{room_type}" RETURN c.name, c.hex, c2.name AS complementary',
        modifiers: { includeSwatches: true, trendingFirst: true }
      },
      project_gallery: {
        cypherTemplate: 'MATCH (proj:Project)-[:USED_SERVICE]->(s:Service) WHERE s.name = "{service}" AND proj.featured = true RETURN proj.images, proj.description, proj.cost',
        modifiers: { limit: 6, qualityFilter: 'high' }
      },
      customer_reviews: {
        cypherTemplate: 'MATCH (r:Review)-[:FOR_SERVICE]->(s:Service) WHERE s.name = "{service}" AND r.rating >= 4 RETURN r.text, r.rating, r.customerName, r.date',
        modifiers: { limit: 5, verified: true }
      },
      estimate_calculator: {
        cypherTemplate: 'MATCH (s:Service {name: "{service}"})-[:HAS_COST_FACTOR]->(f:CostFactor) RETURN f.factor, f.multiplier, f.description',
        modifiers: { includeFormula: true, roundUp: true }
      },
      material_options: {
        cypherTemplate: 'MATCH (m:Material)-[:USED_IN]->(s:Service) WHERE s.name = "{service}" RETURN m.brand, m.quality, m.pricePoint, m.warranty',
        modifiers: { tierByPrice: true, ecoFriendlyFirst: true }
      },
      /* Consolidated Forks */
      pricing_fork: {
        cypherTemplate: 'MATCH (s:Service)-[:HAS_PRICING]->(p:PricingRule) WHERE s.name = "{service}" RETURN s, p.formula, p.materialCost, p.laborRate',
        modifiers: { calculateTotal: true, includeDiscounts: true, includeFormula: true, roundUp: true }
      },
      scheduling_fork: {
        cypherTemplate: 'MATCH (t:TimeSlot)-[:FOR_SERVICE]->(s:Service) WHERE s.name = "{service}" AND t.date >= "{requested_date}" AND t.available = true RETURN t.date, t.timeRange, t.slotId, t.contractor',
        modifiers: { limit: 10, bufferDays: 3, proximitySort: true, ratingMin: 4.5 }
      },
      service_info_fork: {
        cypherTemplate: 'MATCH (s:Service) WHERE s.name = "{service}" RETURN s.name, s.description, s.basePrice, s.duration, s.materialOptions',
        modifiers: { includeImages: true, sortBy: 'popularity', tierByPrice: true, ecoFriendlyFirst: true }
      },

      /* Original individual entries kept for backward compatibility */
      contractor_availability: {
        cypherTemplate: 'MATCH (c:Contractor)-[:SPECIALIZES_IN]->(s:Service) WHERE s.name = "{service}" AND c.available = true RETURN c.name, c.rating, c.nextAvailable',
        modifiers: { ratingMin: 4.5, proximitySort: true }
      },
      lead_qualification: {
        cypherTemplate: 'MATCH (l:Lead) WHERE l.phone = "{phone}" OR l.email = "{email}" RETURN l.previousQuotes, l.serviceHistory, l.preferences',
        modifiers: { createIfNew: true, updateContact: true }
      }
      // Scale: Add more like 'seasonal_promo' for time-sensitive forks
    },
    'career_progression': {
        cypherTemplate: 'MATCH path = (p:Person)-[:HAS_JOB*]->(j:Job) RETURN path',
        modifiers: { pathLength: 5 } // Limit graph depth
      },
      // Painting CRM-specific forks
      'quote_estimation': {
        cypherTemplate: 'MATCH (s:Service {name: "{service}"}) RETURN s.pricing, s.desc',
        modifiers: { params: { service: 'deck_staining' } } // Dynamic param injection
      },
      'service_booking': {
        cypherTemplate: 'MATCH (a:Availability) WHERE a.date > "{current_date}" RETURN a.slots',
        modifiers: { filter: 'slots > 0' } // Fork for available slots only
      }
      // Scale: Add 'comparative_analysis': { cypherTemplate: 'MATCH (s1:Service)-[:SIMILAR_TO]->(s2:Service) RETURN s1, s2' }
    },

    // Updated: Expanded forkThresholds
    forkThresholds: {
      topicScoreMin: 3, // Min score from Step 1 to activate topic fork
      intentConfidence: 0.6, // For CRM intents
      contextRelevance: 0.8, // For filtering retrieved data in prompt
      leadScoreMin: 50, // For qualifying hot leads in CRM
      quotePriorityThreshold: 1000 // High-value quotes get priority routing in CRM
    }
  };