#!/usr/bin/env node

// Interactive CLI Wrapper for Advanced Qwen RAG Pipeline
// This provides a simple command-line interface that leverages the 
// complete hybrid retrieval + 4-step reasoning framework

const readline = require('readline');
const path = require('path');

// Import the advanced RAG functions from the main test script
const {
  performHybridRetrieval,
  enforceReasoningProcessWithGuidance,
  extractNarrativeSynthesis,
  generateKokoroSpeech,
  generateEmbedding,
  logger
} = require('./test-complete-qwen-rag.js');

class InteractiveQwenRAG {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤔 You: '
    });
    
    this.sessionStartTime = new Date();
    this.questionCount = 0;
  }

  async start() {
    console.log('\n🎭 ========================================');
    console.log('🧠 INTERACTIVE QWEN RAG - Advanced Pipeline');
    console.log('🎭 ========================================\n');
    console.log('🎯 Features: Hybrid Retrieval + 4-Step Reasoning + TTS');
    console.log('📊 System: Qwen3 + Neo4j + Chronological Data');
    console.log('💡 Ask anything about Marianne Abrams\' career!');
    console.log('💡 Type "quit", "exit", or "q" to end\n');
    
    this.askQuestion();
  }

  askQuestion() {
    this.rl.question('🤔 You: ', async (userQuestion) => {
      const trimmed = userQuestion.trim();
      
      // Handle exit commands
      if (['quit', 'exit', 'q', ''].includes(trimmed.toLowerCase())) {
        await this.shutdown();
        return;
      }

      try {
        this.questionCount++;
        console.log(`\n🔍 Processing question ${this.questionCount}...`);
        
        await this.processQuestion(trimmed);
        
      } catch (error) {
        console.error('\n❌ Error processing question:', error.message);
        logger.error('CLI Error:', error);
        console.log('\n🤖 Aria: Sorry, I had trouble with that question. Please try again!\n');
      } finally {
        console.log('\n' + '='.repeat(60) + '\n');
        this.askQuestion();
      }
    });
  }

  async processQuestion(question) {
    const startTime = Date.now();
    
    // Step 1: Generate embedding for the question
    console.log('⚙️  Step 1: Generating question embedding...');
    const queryEmbedding = await generateEmbedding(question);
    
    if (!queryEmbedding) {
      throw new Error('Failed to generate embedding for question');
    }
    
    // Step 2: Perform hybrid retrieval (insights + facts)
    console.log('📚 Step 2: Performing hybrid retrieval...');
    const hybridContext = await performHybridRetrieval(question, queryEmbedding);
    
    console.log(`   📊 Retrieved: ${hybridContext.semanticInsights?.length || 0} insights + ${hybridContext.graphFacts?.length || 0} facts`);
    
    // Step 3: Generate AI response with 4-step reasoning
    console.log('🧠 Step 3: Generating AI response with 4-step reasoning...');
    const aiResponse = await enforceReasoningProcessWithGuidance(question, hybridContext);
    
    if (!aiResponse || aiResponse.trim().length === 0) {
      throw new Error('AI response was empty or invalid');
    }
    
    console.log(`   📝 Generated ${aiResponse.length} character response`);
    
    // Step 4: Extract narrative for display and TTS
    console.log('📖 Step 4: Extracting narrative for speech...');
    const narrative = extractNarrativeSynthesis(aiResponse);
    
    console.log(`   🎤 Narrative: ${narrative.length} characters for TTS`);
    
    // Display the response
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Processing completed in ${processingTime}s\n`);
    
    console.log('🤖 Aria:');
    console.log('─'.repeat(50));
    console.log(narrative);
    console.log('─'.repeat(50));
    
    // Step 5: Generate speech (if available)
    console.log('\n🎵 Generating speech...');
    try {
      await generateKokoroSpeech(narrative);
      console.log('✅ Speech synthesis completed');
    } catch (ttsError) {
      console.log('⚠️  TTS not available, but text response provided above');
      logger.warn('TTS Error:', ttsError.message);
    }
    
    // Show stats
    this.showSessionStats();
  }

  showSessionStats() {
    const runtime = Math.round((Date.now() - this.sessionStartTime.getTime()) / 1000);
    const minutes = Math.floor(runtime / 60);
    const seconds = runtime % 60;
    
    console.log(`\n📈 Session Stats: ${this.questionCount} questions, ${minutes}m ${seconds}s runtime`);
  }

  async shutdown() {
    console.log('\n👋 Shutting down Qwen RAG CLI...');
    this.showSessionStats();
    console.log('\n✨ Thanks for using the Advanced Qwen RAG Pipeline!');
    console.log('🎯 All questions processed with hybrid retrieval + 4-step reasoning\n');
    
    this.rl.close();
    
    // Graceful shutdown - close any connections
    try {
      // The main script handles connection cleanup
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown error:', error);
      process.exit(1);
    }
  }
}

// Handle CTRL+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received CTRL+C - shutting down gracefully...');
  process.exit(0);
});

// Start the CLI if this file is run directly
if (require.main === module) {
  const cli = new InteractiveQwenRAG();
  cli.start().catch(error => {
    console.error('❌ Fatal error starting CLI:', error.message);
    process.exit(1);
  });
}

module.exports = InteractiveQwenRAG;
