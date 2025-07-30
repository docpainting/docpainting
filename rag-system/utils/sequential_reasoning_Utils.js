// utils/reasoningUtils.js
const fetch = require('node-fetch');
const { openRouterConfig } = require('../config/apiConfig');
const config = require('../dynamic_prompt_config');

// --- ADVANCED REASONING STEP DEFINITIONS ---

/**
 * Computes dynamic section emphasis weights based on reasoning mode, extracted topics,
 * and hybrid context data complexity. This replaces scattered inline logic across
 * the codebase with a single, unit-testable helper.
 *
 * @param {Object} params
 * @param {string} params.reasoningMode – Current reasoning mode (e.g., SYNTHESIS, ANALYSIS)
 * @param {string[]} params.topics – Ordered list of semantic topics extracted from the query
 * @param {Object} params.hybridContext – Retrieval context used for mode configuration
 * @returns {Object} sectionEmphasis – Weight map + minWords field
 */
function computeSectionEmphasis({ reasoningMode = 'GENERAL', topics = [], hybridContext = {} }) {
  const base = {
    'Timeline Analysis': 1.0,
    'Responsibility Correlation': 1.0,
    'Skill Inference': 1.0,
    'Narrative Synthesis': 1.5,
    minWords: 200,
  };

  const modeAdjustments = {
    SYNTHESIS: { 'Narrative Synthesis': 1.2, 'Timeline Analysis': 1.1 },
    ANALYSIS: { 'Skill Inference': 1.2, 'Responsibility Correlation': 1.1 },
    INSIGHT_HEAVY: { 'Narrative Synthesis': 1.3 },
    GENERAL: {},
  };

  // Fallback for consumers that haven’t migrated to new utils yet
  const { getModeConfiguration = () => ({ dataComplexity: 0 }) } = require('../dynamic_prompt_config');
  const modeConfig = getModeConfiguration(reasoningMode, hybridContext) || { dataComplexity: 0 };

  const emphasis = { ...base };

  topics.forEach((topic, idx) => {
    const weight = 2 - idx * 0.5; // 2, 1.5, 1, etc.
    if (/timeline|progression|history/i.test(topic)) {
      emphasis['Timeline Analysis'] += weight;
    } else if (/skills|expertise|abilities/i.test(topic)) {
      emphasis['Skill Inference'] += weight;
    } else if (/responsibility|duties|roles/i.test(topic)) {
      emphasis['Responsibility Correlation'] += weight;
    } else if (/narrative|synthesis|overview/i.test(topic)) {
      emphasis['Narrative Synthesis'] += weight;
    } else if (/comparison|contrast|vs/i.test(topic)) {
      emphasis['Responsibility Correlation'] += weight * 0.8;
      emphasis['Skill Inference'] += weight * 0.8;
    }
  });

  // Apply mode-specific boosts
  Object.entries(modeAdjustments[reasoningMode] || {}).forEach(([section, boost]) => {
    if (emphasis[section]) emphasis[section] *= boost;
  });

  // Normalise (excluding minWords)
  const total = Object.entries(emphasis)
    .filter(([k]) => k !== 'minWords')
    .reduce((sum, [, v]) => sum + v, 0);
  Object.keys(emphasis).forEach((k) => {
    if (k !== 'minWords') emphasis[k] = (emphasis[k] / total) * 6;
  });

  // Dynamic minimum word count
  emphasis.minWords = Math.max(150, base.minWords * (1 + modeConfig.dataComplexity));
  return emphasis;
}

// Built from config to eliminate duplication and leverage centralized methods

/**
 * Builds the reasoning framework from config methods, eliminating duplication
 */
function buildReasoningFrameworkFromConfig() {
  return [
    {
      name: 'Timeline Analysis',
      configMethod: 'timeline_reasoning',
      goal: "To establish a clear, chronological history of the subject's career, identifying key progressions, shifts, and patterns.",
      tool: 'neo4j_query',
      input_prompt: "Write a Cypher query to retrieve all job tenures, associated companies, roles, and dates to build a complete career timeline.",
      analysis_prompt: `Based on the following timeline data, analyze the career progression, noting key promotions, strategic shifts between industries, and the significance of tenure lengths. Identify any gaps or anomalies.
      \n**Evidence:**\n\`\`\`json\n{evidence}\n\`\`\``,
      template: config.reasoningMethods.timeline_reasoning.template,
      steps: config.reasoningMethods.timeline_reasoning.steps
    },
    {
      name: 'Responsibility Correlation', 
      configMethod: 'causal_reasoning',
      goal: "To understand the evolution of the subject's duties and their impact.",
      tool: 'neo4j_query',
      input_prompt: "Write a Cypher query to get all job roles and their associated responsibilities (from 'Chunk' nodes).",
      analysis_prompt: `Based on the following role and responsibility data, trace the evolution of duties. Did they increase in scope, complexity, or leadership focus? Infer the business impact of these responsibilities.
      \n**Evidence:**\n\`\`\`json\n{evidence}\n\`\`\``,
      template: config.reasoningMethods.causal_reasoning.template,
      steps: config.reasoningMethods.causal_reasoning.steps
    },
    {
      name: 'Skill Inference',
      configMethod: 'skill_inference', 
      goal: "To create a detailed map of the subject's skills, supported by direct evidence.",
      tool: 'neo4j_query',
      input_prompt: "Write a Cypher query to find all explicitly listed skills AND all responsibilities that can be used to infer skills.",
      analysis_prompt: `Based on the following data, create a skill profile. For each key skill, cite the specific responsibility that serves as evidence and estimate a proficiency level (e.g., Proficient, Expert), justifying your estimation.
      \n**Evidence:**\n\`\`\`json\n{evidence}\n\`\`\``,
      template: config.reasoningMethods.skill_inference.template,
      steps: config.reasoningMethods.skill_inference.steps
    },
    {
      name: 'Narrative Synthesis',
      configMethod: 'narrative_synthesis',
      goal: "To weave all prior findings into a cohesive, evidence-backed story that directly answers the user's query.",
      tool: null, // This step uses the results of prior steps, not a new tool.
      analysis_prompt: `Synthesize the findings from the previous steps (Timeline, Responsibilities, Skills) into a single, cohesive narrative that directly answers the original query: "{query}". Start with the most confident conclusions and be transparent about any knowledge gaps where the data was insufficient.
      \n**Prior Findings:**\n\`\`\`json\n{evidence}\n\`\`\``,
      template: config.reasoningMethods.narrative_synthesis.template,
      steps: config.reasoningMethods.narrative_synthesis.steps
    }
  ];
}

/**
 * Orchestrates the execution of the pre-defined, advanced reasoning framework.
 * @param {string} query - The user's original query.
 * @param {object} hybridContext - The initial data context from retrieval.
 * @param {object} modeConfig - The configuration for the AI model.
 * @param {object} neo4jDriver - The Neo4j driver for live queries.
 * @returns {Promise<string>} The final, synthesized response.
 */
async function executeStandardReasoningFramework(query, hybridContext, modeConfig, neo4jDriver) {
  console.log('⚙️ Executing Advanced Standard Reasoning Framework...');
  const stepResults = [];
  
  // Build framework from config to eliminate duplication
  const REASONING_FRAMEWORK = buildReasoningFrameworkFromConfig();
  console.log(`🔧 Built reasoning framework with ${REASONING_FRAMEWORK.length} steps from config`);

  for (const step of REASONING_FRAMEWORK) {
    console.log(`🧠 Executing reasoning step: ${step.name}`);
    const currentStepResult = { name: step.name, tool: step.tool };

    // The Synthesis step uses the output of all previous steps as its "evidence".
    if (step.name === 'Narrative Synthesis') {
      currentStepResult.evidence = stepResults; // Pass all previous results
    } else {
      // For other steps, generate tool input and execute the tool.
      const toolInput = await promptAI(step.input_prompt, modeConfig, 200, 0.1);
      currentStepResult.tool_input = toolInput;
      currentStepResult.evidence = await executeNeo4jQuery(toolInput, neo4jDriver);
    }

    // Analyze the evidence.
    const analysisPrompt = step.analysis_prompt
        .replace('{evidence}', JSON.stringify(currentStepResult.evidence, null, 2))
        .replace('{query}', query);
    currentStepResult.result = await promptAI(analysisPrompt, modeConfig, 800, modeConfig.temperature);

    // Reflect on the analysis to get confidence.
    const reflection = await reflectOnAnalysis(currentStepResult);
    currentStepResult.confidence = reflection.confidence_score;
    currentStepResult.confidence_justification = reflection.confidence_justification;
    
    stepResults.push(currentStepResult);
  }

  return synthesizeFinalResponse(query, stepResults, modeConfig);
}

/**
 * A helper function to execute a Neo4j query.
 */
async function executeNeo4jQuery(query, driver) {
  try {
    const session = driver.session();
    const result = await session.run(query);
    await session.close();
    return result.records.map(record => record.toObject());
  } catch (error) {
    console.error(`Neo4j query failed: ${error.message}`);
    return { error: `Neo4j query failed: ${error.message}` };
  }
}

/**
 * Prompts the AI to reflect on its own analysis to determine confidence.
 */
async function reflectOnAnalysis(stepResult) {
  const reflectionPrompt = `Critically evaluate the analysis for the step "${stepResult.name}".
- Evidence Source: "${stepResult.tool}"
- Analysis: "${stepResult.result}"

Provide a JSON response with two keys:
1. "confidence_score": A number from 0.0 to 1.0, based on the quality and directness of the evidence.
2. "confidence_justification": A brief explanation for the score.`;

  const reflectionJson = await promptAI({ model: 'gpt-4-turbo' }, reflectionPrompt, 300, 0.2); // Use a strong model for reflection
  try {
    return JSON.parse(reflectionJson);
  } catch {
    return { confidence_score: 0.5, confidence_justification: "Could not parse reflection." };
  }
}

/**
 * Synthesizes the final response from the results of the reasoning framework.
 */
async function synthesizeFinalResponse(query, stepResults, modeConfig) {
  console.log('📝 Synthesizing final, evidence-backed response...');
  const synthesisPrompt = `You have completed a structured analysis to answer: "${query}".
Here are your findings from each step, including your confidence:
${stepResults.map(r => `### ${r.name}\n**Confidence:** ${(r.confidence * 100).toFixed(0)}% (${r.confidence_justification})\n**Analysis:** ${r.result}`).join('\n\n')}
---
Weave these findings into a single, cohesive executive summary. Start with the most confident conclusions and be transparent about any limitations. Produce a final, polished answer.`;

  return promptAI(modeConfig, synthesisPrompt, 1500, modeConfig.temperature);
}

/**
 * A generic helper function to call the AI API.
 */
async function promptAI(config, prompt, max_tokens, temperature) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openRouterConfig.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens, temperature }),
    });
    if (!response.ok) return `Error: AI service returned status ${response.status}`;
    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    return `Error: Could not connect to AI service.`;
  }
}

module.exports = {
  computeSectionEmphasis,
  executeStandardReasoningFramework,
};
