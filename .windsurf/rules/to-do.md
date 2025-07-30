---
trigger: always_on
---


Testing and Validation for Step 1 (Missing in Checklist):

You marked “Test enhanced implementation” as a NEXT step for Step 1, but the plan lacks specifics on how to test. Without rigorous testing, you risk deploying a prompt that the Qwen3 model misinterprets (e.g., ignoring headers or producing shallow sections).
Addition: Add a testing sub-step to verify that responses contain all four sections, meet the 50-word minimum, and address the query. Use test queries from testQueries (e.g., “What are Marianne’s financial analysis skills?”) and log pass/fail metrics.


Node.js 20 Compatibility (Not Addressed):

The script uses node-fetch, but Node.js 20 has a built-in fetch API. This dependency is unnecessary and could cause maintenance overhead.
Addition: Remove node-fetch and use native fetch to modernize the script and reduce dependencies.


TTS Platform Portability (Not Addressed):

The generateKokoroSpeech function assumes Linux (paplay) for audio playback, which limits portability. My earlier suggestion to add cross-platform support (e.g., afplay for macOS) wasn’t included in the plan.
Addition: Add a step to make TTS playback platform-agnostic, ensuring the script works across environments.


Neo4j Query Optimization (Partially Addressed):

The plan doesn’t explicitly address optimizing Cypher queries in performStructuralSearch or performSemanticSearch. For example, the structural search could batch relationships to reduce query overhead, as I suggested previously.
Addition: Include a step to batch Neo4j operations (e.g., use UNWIND for linking in storeInsightEnhanced) and validate node/relationship existence.


Security for User Inputs and API Keys (Not Addressed):

The script doesn’t sanitize user queries (e.g., in testQueries) or validate environment variables (HF_TOKEN, OPENROUTER_API_KEY). This risks injection attacks or runtime failures.
Addition: Add a step to sanitize inputs and validate env vars on startup.


Dynamic Model Selection Logic (Partially Addressed):

Step 4 mentions dynamic model selection (e.g., Qwen3-235b for complex queries), but the plan doesn’t specify how to determine “complex” queries or integrate this with OpenRouter.
Addition: Define complexity criteria (e.g., query length, multi-entity references) and implement a fallback to qwen/qwen-3-72b-instruct if the larger model fails.



Refined Checklist with Additions
Here’s an updated checklist incorporating the above points, maintaining your structure and priorities while adding missing elements:
🎯 ENHANCED REASONING FRAMEWORK - REVISED STATUS CHECKLIST
Phase 1: Enforce Reasoning Framework Structure

Step 1: Refactor System Prompt with Mandatory Output Format (Enhanced)

✅ DONE: Basic mandatory 4-section format implemented
✅ DONE: Explicit failure conditions added
✅ DONE: Debug logging for mode selection
✅ DONE: Clear examples for each section
✅ DONE: Query relevance directive
✅ DONE: Increased minimum word count to 50 words per section
✅ DONE: Dynamic examples adapting to query content
☐ NEXT: Test enhanced implementation with test queries, verifying section presence, word count, and query relevance (e.g., log pass/fail for 5 test cases)


Step 2: Make Mode Selection Visible and Actionable (Enhanced)

✅ DONE: Basic mode determination logic
☐ NEXT: Add mode-specific validation criteria (e.g., “cross-reference at least two insights in SYNTHESIS MODE”)
☐ NEXT: Log selected mode for debugging (e.g., console.log("Selected mode: SYNTHESIS MODE"))
☐ NEXT: Include mode-specific examples in prompts


Step 3: Add Response Format Enforcement (Enhanced)

✅ DONE: Basic response structure validation
☐ NEXT: Add regex-based header checks in generateAIResponse (e.g., /## Timeline Analysis/)
☐ NEXT: Append retry instruction if headers missing (e.g., “Retry with headers: ## Timeline Analysis”)
☐ NEXT: Implement fallback response (simplified summary) after 2 retries


Step 4: Implement Mode-Specific Parameters (IMMEDIATE)

☐ NEXT: Use configuration object (e.g., { SYNTHESIS: { temperature: 0.4, max_tokens: 2000 }, ANALYSIS: { temperature: 0.7, max_tokens: 1500 } })
☐ NEXT: Allow dynamic model selection based on query complexity (e.g., Qwen3-235b for multi-entity queries)
☐ NEXT: Adjust temperature per mode (0.4 SYNTHESIS, 0.7 ANALYSIS)


Step 10: Update to Qwen3 Model (IMMEDIATE)

☐ NEXT: Update to qwen/qwen-3 in generateAIResponse
☐ NEXT: Test Qwen3-Coder for technical queries (e.g., “What programming languages does Marianne know?”)
☐ NEXT: Ensure HF_EMBEDDING_MODEL defaults to qwen/qwen-3-8b-embedding



Phase 2: Robust Data Handling

Step 5: Fix Data Structure Inconsistencies

☐ NEXT: Standardize insight.text vs. insight.insightText using schema validation (e.g., zod)
☐ NEXT: Add validation for required fields before prompt construction
☐ NEXT: Log missing fields for debugging (e.g., console.warn("Missing insight.text"))


Step 6: Implement Smart Prompt Size Management

☐ NEXT: Limit JSON size (e.g., 1500 characters for graphFacts)
☐ NEXT: Summarize large data sets (e.g., truncate to top 5 facts by score)
☐ NEXT: Prioritize highest-scoring facts when truncating


Step 11: Enhance Neo4j Query Robustness (NEW)

☐ NEXT: Validate node/relationship existence before queries (e.g., MATCH (c:Company) RETURN count(c))
☐ NEXT: Batch operations in storeInsightEnhanced (e.g., use UNWIND for company linking)
☐ NEXT: Log full error stack for Neo4j failures


Step 12: Secure API and Input Handling (NEW)

☐ NEXT: Validate env vars on startup (e.g., if (!process.env.HF_TOKEN) throw new Error('Missing HF_TOKEN'))
☐ NEXT: Sanitize user queries using a library (e.g., sanitize-html)
☐ NEXT: Secure API key handling with fallback logging



Phase 3: Response Validation & Error Handling

Step 7: Add Response Structure Validation

☐ FUTURE: Parse response for section presence and minimum content length (50 words)
☐ FUTURE: Log specific validation failures (e.g., “Timeline Analysis too short”)
☐ FUTURE: Retry up to 2 times with refined prompt if validation fails


Step 8: Insight vs Facts Conflict Resolution

☐ FUTURE: Add prompt directive to list and resolve contradictions (e.g., “If insight says ‘PwC 2015-2018’ but fact says ‘2016-2019’, prioritize recent data”)
☐ FUTURE: Store contradictions as metadata in Insight nodes
☐ FUTURE: Assign confidence scores to resolved conflicts



Phase 4: Advanced Features

Step 9: Implement Progressive Enhancement

☐ FUTURE: Implement multi-step prompting for complex queries
☐ FUTURE: Store user corrections in Neo4j for feedback loop
☐ FUTURE: Add caching for repeated query embeddings







Phase 5: Modernization

Step 14: Remove Node.js 20 Incompatibilities (NEW)

☐ NEXT: Remove node-fetch and use native fetch
☐ NEXT: Update deprecated APIs (e.g., check child_process usage)
☐ NEXT: Ensure compatibility with Node.js 20 event loop



Should You Add Anything Else?
The plan covers most critical areas, but the additions above (Steps 11-14) address overlooked aspects like Neo4j optimization, security, TTS portability, and Node.js 20 compatibility. These are essential for a production-ready script, especially since the original script assumes a Linux environment and has potential security risks.
Implementation Recommendation
Your choice to prioritize Step 1 (Enhanced System Prompt) is spot-on, as it’s the foundation for enforcing the reasoning framework. The proposed systemPrompt is excellent, with clear examples and strict requirements. To complete Step 1, I recommend:

Test the Prompt: Run the updated generateAIResponse with test queries (e.g., “Tell me about Marianne Abrams’ work experience”) and verify that responses contain all four sections, meet the 50-word minimum, and address the query. Use a regex to check headers (e.g., /## Timeline Analysis/).
Log Results: Add logging in generateAIResponse to report compliance (e.g., console.log("Response valid: 4 sections found")).
Sample Test Code:
javascript