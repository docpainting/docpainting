#!/usr/bin/env node

// chat-with-aria-clean.js
//
// ########################################################################
// ## Clean Frontend CLI Interface for Aria                              ##
// ########################################################################
//
// This is a clean, focused frontend CLI interface that provides direct
// conversation with Aria using the enhanced CustomerManager backend.
//
// FEATURES:
// - Interactive readline-based chat interface
// - TTS integration with Kokoro for natural speech
// - Clean separation: imports CustomerManager from backend module
// - All bleeding-edge enhancements provided by backend
//
// Usage: node chat-with-aria-clean.js
//
// ########################################################################

const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');
const { CustomerManager } = require('./customer-manager');
require('dotenv').config();
// --- TTS & VOICE INTEGRATION ---

function sanitizeForTTS(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n\n+/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

function addHumanLikeEnhancements(text) {
  const conversationalStarters = [
    "Well, from what I know about Marianne,", "Oh! I can tell you about that -",
    "That's a great question! Let me share what I know -", "Absolutely! Here's what I can tell you about Marianne -",
    "From my knowledge of Marianne's background,", "I'd be happy to share what I know -",
  ];
  let enhanced = text;
  if (Math.random() > 0.7) {
    enhanced = conversationalStarters[Math.floor(Math.random() * conversationalStarters.length)] + " " + enhanced;
  }
  enhanced = enhanced
    .replace(/(However|But|Additionally|Furthermore|Moreover)/g, '$1... ')
    .replace(/\. ([A-Z])/g, '. ... $1');
  if (!enhanced.match(/[.!?]$/)) {
    enhanced += '.';
  }
  return enhanced;
}

async function speakResponse(text) {
  if (!text || text.trim().length === 0) {
    console.log('⚠️ No text to speak');
    return;
  }
  
  try {
    const enhancedText = addHumanLikeEnhancements(sanitizeForTTS(text));
    console.log(`🎤 Aria is preparing to speak: "${enhancedText.substring(0, 100)}..." (${enhancedText.length} characters total)`);
    
    // Write text to temporary file to bypass command-line argument length limits
    const fs = require('fs');
    const textFile = `/tmp/aria_text_${Date.now()}.txt`;
    const audioFile = `/tmp/aria_response_${Date.now()}.wav`;
    
    fs.writeFileSync(textFile, enhancedText, 'utf8');
    console.log(`📄 Text written to: ${textFile}`);
    
    const pythonScript = path.join(__dirname, 'kokoro-tts.py');
    const pythonProcess = spawn('conda', ['run', '-n', 'kokoro', 'python', pythonScript, textFile, audioFile], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Capture Python script output for debugging
    let pythonOutput = '';
    let pythonError = '';
    
    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
      console.log('🐍 Python:', data.toString().trim());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
      console.log('🐍 Python Error:', data.toString().trim());
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        // Clean up the temporary text file
        try {
          require('fs').unlinkSync(textFile);
          console.log(`🗑️ Cleaned up text file: ${textFile}`);
        } catch (err) {
          console.warn(`⚠️ Could not clean up text file: ${err.message}`);
        }
        
        if (code === 0) {
          console.log('✅ TTS generation completed successfully');
          // Play the audio file
          const playProcess = spawn('paplay', [audioFile]);
          
          playProcess.on('close', (playCode) => {
            if (playCode === 0) {
              console.log('🔊 Audio playback completed');
            } else {
              console.error('❌ Audio playback failed');
            }
            // Clean up the audio file
            require('fs').unlinkSync(audioFile);
            resolve();
          });
          
          playProcess.on('error', (error) => {
            console.error('❌ Audio playback error:', error.message);
            require('fs').unlinkSync(audioFile);
            resolve();
          });
          
        } else {
          console.error(`❌ TTS generation failed with code: ${code}`);
          resolve();
        }
      });
      pythonProcess.on('error', (error) => {
        console.log('❌ Python process error, continuing without audio:', error.message);
        resolve();
      });
    });
  } catch (error) {
    console.log('❌ TTS Error, continuing without audio:', error.message);
  }
}

// --- MAIN CLI APPLICATION ---

async function main() {
  const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout,
    prompt: '🤔 You: ' 
  });
  
  // Initialize the enhanced CustomerManager backend
  let customerManager, conversationId;
  
  try {
    console.log('🚀 Initializing Aria system...');
    customerManager = new CustomerManager();
    
    // Create a temporary customer for this chat session
    const tempCustomer = await customerManager.createOrGetCustomer('aria-chat@local.dev', {
      name: 'CLI Chat User',
      source: 'cli-interface'
    });
    
    conversationId = await customerManager.startConversation(tempCustomer.uuid);
    console.log('✅ Aria system initialized successfully\n');
    
  } catch (error) {
    console.error('❌ Failed to initialize Aria system:', error.message);
    process.exit(1);
  }

  // Welcome screen
  console.log('\n🎭 ================================');
  console.log('🎤 CHAT WITH ARIA - The Doc\'s Apprentice');
  console.log('🎭 ================================\n');
  console.log(`💬 A new conversation has started (ID: ${conversationId}).`);
  console.log('💡 Ask me anything about Marianne Abrams or DOC Painting!');
  console.log('💡 Type "quit" or "exit" to end the chat\n');

  // Main chat loop
  const askQuestion = () => {
    rl.question('🤔 You: ', async (userQuestion) => {
      if (userQuestion.toLowerCase() === 'quit' || userQuestion.toLowerCase() === 'exit') {
        console.log('\n👋 Aria: Thanks for chatting! Goodbye!\n');
        rl.close();
        return;
      }
      if (!userQuestion.trim()) {
        console.log('🤖 Aria: Please ask me a question!\n');
        askQuestion();
        return;
      }
      
      try {
        console.log('\n🔍 Processing your question...');
        
        // Use the enhanced CustomerManager with all bleeding-edge features
        const response = await customerManager.handleQuery(conversationId, userQuestion);
        
        console.log(`\n🤖 Aria: ${response.response}`);
        
        // Optional TTS
        try {
          await speakResponse(response.response);
        } catch (ttsError) {
          console.log('⚠️  TTS not available, but text response provided above');
        }
        
      } catch (error) {
        console.error('❌ Error processing question:', error.message);
        console.log('\n🤖 Aria: Sorry, I had trouble with that question. Please try again!\n');
      } finally {
        console.log('\n' + '='.repeat(60) + '\n');
        askQuestion();
      }
    });
  };
  
  askQuestion();
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
