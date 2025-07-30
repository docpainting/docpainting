// reasoning-logic.js - Implementation of reasoning methods from dynamic-prompt-config.js
// This module provides executable logic for the reasoning methods defined in config
// Usage: const { executeHierarchicalSequential } = require('./reasoning-logic');

const config = require('./dynamic_prompt_config');

/**
 * Executes hierarchical sequential reasoning following the 5-step template
 * Auto-scales complexity based on problem scope and requirements
 */
class HierarchicalSequentialReasoner {
  constructor(query, context, options = {}) {
    this.query = query;
    this.context = context;
    this.options = {
      maxComplexity: options.maxComplexity || 5,
      enableRevision: options.enableRevision !== false,
      enableBranching: options.enableBranching !== false,
      debugMode: options.debugMode || false,
      ...options
    };
    
    this.components = [];
    this.subProblems = [];
    this.dependencies = [];
    this.solutions = [];
    this.revisions = [];
    this.debugLog = [];
  }

  /**
   * Main execution method following the 5-step hierarchical template
   */
  async execute() {
    this.log('🧠 Starting Hierarchical Sequential Reasoning');
    this.log(`Query: ${this.query}`);
    
    try {
      // Step 1: Identify main components
      const components = await this.identifyComponents();
      
      // Step 2: Break into sub-problems  
      const subProblems = await this.breakIntoSubProblems(components);
      
      // Step 3: Address dependencies in order
      const dependencies = await this.analyzeDependencies(subProblems);
      
      // Step 4: Build incrementally with validation
      const solutions = await this.buildIncrementally(dependencies);
      
      // Step 5: Integrate and revise as needed
      const finalSolution = await this.integrateAndRevise(solutions);
      
      return {
        success: true,
        solution: finalSolution,
        reasoning: {
          components: this.components,
          subProblems: this.subProblems,
          dependencies: this.dependencies,
          solutions: this.solutions,
          revisions: this.revisions
        },
        debugLog: this.options.debugMode ? this.debugLog : null
      };
      
    } catch (error) {
      this.log(`❌ Error in hierarchical reasoning: ${error.message}`);
      return {
        success: false,
        error: error.message,
        debugLog: this.options.debugMode ? this.debugLog : null
      };
    }
  }

  /**
   * Step 1: Component Identification
   * Analyzes query and context to identify main components/aspects
   */
  async identifyComponents() {
    this.log('📋 Step 1: Identifying main components...');
    
    const components = [];
    
    // Analyze query for key concepts
    const queryWords = this.query.toLowerCase().split(/\s+/);
    const contextKeys = Object.keys(this.context || {});
    
    // Career analysis components
    if (this.isCareerQuery()) {
      components.push(
        { type: 'timeline', priority: 1, description: 'Career progression chronology' },
        { type: 'skills', priority: 2, description: 'Technical and soft skills analysis' },
        { type: 'achievements', priority: 2, description: 'Notable accomplishments' },
        { type: 'companies', priority: 1, description: 'Company and role context' }
      );
    }
    
    // CRM/Business components
    if (this.isCRMQuery()) {
      components.push(
        { type: 'customer_needs', priority: 1, description: 'Customer requirements analysis' },
        { type: 'service_matching', priority: 1, description: 'Service capability alignment' },
        { type: 'pricing', priority: 2, description: 'Cost estimation and breakdown' },
        { type: 'availability', priority: 3, description: 'Scheduling and resource availability' }
      );
    }
    
    // Technical/System components
    if (this.isTechnicalQuery()) {
      components.push(
        { type: 'architecture', priority: 1, description: 'System design and structure' },
        { type: 'implementation', priority: 2, description: 'Code and logic implementation' },
        { type: 'validation', priority: 3, description: 'Testing and quality assurance' },
        { type: 'integration', priority: 3, description: 'System integration points' }
      );
    }
    
    // Sort by priority and complexity
    components.sort((a, b) => a.priority - b.priority);
    
    this.components = components;
    this.log(`✅ Identified ${components.length} components: ${components.map(c => c.type).join(', ')}`);
    
    return components;
  }

  /**
   * Step 2: Sub-problem Breakdown
   * Breaks each component into manageable sub-problems
   */
  async breakIntoSubProblems(components) {
    this.log('🔍 Step 2: Breaking into sub-problems...');
    
    const subProblems = [];
    
    for (const component of components) {
      const componentSubProblems = await this.decomposeComponent(component);
      subProblems.push(...componentSubProblems);
    }
    
    this.subProblems = subProblems;
    this.log(`✅ Created ${subProblems.length} sub-problems`);
    
    return subProblems;
  }

  /**
   * Step 3: Dependency Analysis
   * Identifies and orders dependencies between sub-problems
   */
  async analyzeDependencies(subProblems) {
    this.log('🔗 Step 3: Analyzing dependencies...');
    
    const dependencies = [];
    
    // Build dependency graph
    for (let i = 0; i < subProblems.length; i++) {
      for (let j = 0; j < subProblems.length; j++) {
        if (i !== j && this.hasDependency(subProblems[i], subProblems[j])) {
          dependencies.push({
            from: subProblems[j],
            to: subProblems[i],
            type: this.getDependencyType(subProblems[j], subProblems[i])
          });
        }
      }
    }
    
    this.dependencies = dependencies;
    this.log(`✅ Found ${dependencies.length} dependencies`);
    
    return dependencies;
  }

  /**
   * Step 4: Incremental Building
   * Builds solutions incrementally, respecting dependencies
   */
  async buildIncrementally(dependencies) {
    this.log('🏗️ Step 4: Building incrementally...');
    
    const solutions = [];
    const solved = new Set();
    
    // Topological sort for dependency order
    const sortedProblems = this.topologicalSort(this.subProblems, dependencies);
    
    for (const problem of sortedProblems) {
      if (!solved.has(problem.id)) {
        const solution = await this.solveProblem(problem, solutions);
        
        if (solution) {
          solutions.push(solution);
          solved.add(problem.id);
          
          // Validate solution
          if (this.options.enableRevision && !await this.validateSolution(solution)) {
            this.log(`⚠️ Solution validation failed for ${problem.id}, attempting revision...`);
            const revisedSolution = await this.reviseSolution(solution);
            if (revisedSolution) {
              solutions[solutions.length - 1] = revisedSolution;
              this.revisions.push({ original: solution, revised: revisedSolution });
            }
          }
        }
      }
    }
    
    this.solutions = solutions;
    this.log(`✅ Built ${solutions.length} incremental solutions`);
    
    return solutions;
  }

  /**
   * Step 5: Integration and Revision
   * Integrates all solutions and performs final revisions
   */
  async integrateAndRevise(solutions) {
    this.log('🔄 Step 5: Integrating and revising...');
    
    // Integrate solutions into coherent response
    let integratedSolution = await this.integrateSolutions(solutions);
    
    // Final revision pass if enabled
    if (this.options.enableRevision) {
      const finalRevision = await this.performFinalRevision(integratedSolution);
      if (finalRevision) {
        this.revisions.push({ 
          type: 'final_integration', 
          original: integratedSolution, 
          revised: finalRevision 
        });
        integratedSolution = finalRevision;
      }
    }
    
    this.log('✅ Integration and revision complete');
    
    return integratedSolution;
  }

  // Helper Methods
  log(message) {
    if (this.options.debugMode) {
      console.log(`[HierarchicalReasoner] ${message}`);
    }
    this.debugLog.push({ timestamp: new Date().toISOString(), message });
  }

  isCareerQuery() {
    const careerKeywords = ['job', 'career', 'work', 'experience', 'skill', 'company', 'role', 'position'];
    return careerKeywords.some(keyword => this.query.toLowerCase().includes(keyword));
  }

  isCRMQuery() {
    const crmKeywords = ['service', 'quote', 'price', 'customer', 'paint', 'color', 'project', 'estimate'];
    return crmKeywords.some(keyword => this.query.toLowerCase().includes(keyword));
  }

  isTechnicalQuery() {
    const techKeywords = ['code', 'implement', 'system', 'architecture', 'function', 'logic', 'debug'];
    return techKeywords.some(keyword => this.query.toLowerCase().includes(keyword));
  }

  async decomposeComponent(component) {
    // Component-specific decomposition logic
    const decompositions = {
      timeline: [
        { id: 'extract_dates', description: 'Extract start/end dates', complexity: 1 },
        { id: 'calculate_durations', description: 'Calculate role durations', complexity: 1 },
        { id: 'identify_progression', description: 'Identify career progression patterns', complexity: 2 }
      ],
      skills: [
        { id: 'technical_skills', description: 'Identify technical skills', complexity: 1 },
        { id: 'soft_skills', description: 'Identify soft skills', complexity: 1 },
        { id: 'skill_proficiency', description: 'Assess skill proficiency levels', complexity: 2 }
      ],
      customer_needs: [
        { id: 'requirements_analysis', description: 'Analyze customer requirements', complexity: 2 },
        { id: 'budget_constraints', description: 'Identify budget constraints', complexity: 1 },
        { id: 'timeline_preferences', description: 'Understand timeline preferences', complexity: 1 }
      ]
      // Add more component decompositions as needed
    };
    
    return decompositions[component.type] || [
      { id: `${component.type}_analysis`, description: `Analyze ${component.type}`, complexity: 2 }
    ];
  }

  hasDependency(problemA, problemB) {
    // Define dependency rules
    const dependencyRules = {
      'extract_dates': ['calculate_durations', 'identify_progression'],
      'requirements_analysis': ['budget_constraints', 'timeline_preferences'],
      'technical_skills': ['skill_proficiency']
    };
    
    return dependencyRules[problemB.id]?.includes(problemA.id) || false;
  }

  getDependencyType(from, to) {
    return 'sequential'; // Could be 'parallel', 'conditional', etc.
  }

  topologicalSort(problems, dependencies) {
    // Simple topological sort implementation
    const visited = new Set();
    const result = [];
    
    const visit = (problem) => {
      if (visited.has(problem.id)) return;
      visited.add(problem.id);
      
      // Visit dependencies first
      dependencies
        .filter(dep => dep.to.id === problem.id)
        .forEach(dep => visit(dep.from));
      
      result.push(problem);
    };
    
    problems.forEach(visit);
    return result;
  }

  async solveProblem(problem, existingSolutions) {
    this.log(`🔧 Solving problem: ${problem.description}`);
    
    // Problem-specific solution logic would go here
    // For now, return a placeholder solution structure
    return {
      id: problem.id,
      problem: problem,
      solution: `Solution for ${problem.description}`,
      confidence: 0.8,
      timestamp: new Date().toISOString()
    };
  }

  async validateSolution(solution) {
    // Solution validation logic
    return solution.confidence > 0.5;
  }

  async reviseSolution(solution) {
    this.log(`🔄 Revising solution: ${solution.id}`);
    // Revision logic would go here
    return {
      ...solution,
      solution: `Revised: ${solution.solution}`,
      confidence: Math.min(solution.confidence + 0.1, 1.0),
      revised: true
    };
  }

  async integrateSolutions(solutions) {
    this.log('🔗 Integrating all solutions...');
    
    return {
      type: 'integrated_solution',
      components: solutions,
      summary: solutions.map(s => s.solution).join('. '),
      confidence: solutions.reduce((acc, s) => acc + s.confidence, 0) / solutions.length,
      timestamp: new Date().toISOString()
    };
  }

  async performFinalRevision(solution) {
    this.log('✨ Performing final revision...');
    
    // Final revision logic
    return {
      ...solution,
      summary: `Final: ${solution.summary}`,
      confidence: Math.min(solution.confidence + 0.05, 1.0),
      finalRevision: true
    };
  }
}

/**
 * Factory function to execute hierarchical sequential reasoning
 */
async function executeHierarchicalSequential(query, context, options = {}) {
  const reasoner = new HierarchicalSequentialReasoner(query, context, options);
  return await reasoner.execute();
}

/**
 * Check if a query should use hierarchical sequential reasoning
 */
function shouldUseHierarchicalSequential(query, topics = []) {
  const triggers = config.reasoningMethods.hierarchical_sequential.when;
  
  // Check if query contains any trigger keywords
  const queryLower = query.toLowerCase();
  const triggerMatches = triggers.some(trigger => 
    queryLower.includes(trigger.replace('_', ' ')) || 
    topics.includes(trigger)
  );
  
  return triggerMatches;
}

module.exports = {
  HierarchicalSequentialReasoner,
  executeHierarchicalSequential,
  shouldUseHierarchicalSequential
};
