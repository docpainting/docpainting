// extract-pdf-content.js
// Quick script to extract text content from Your_Top_Choice.pdf using LangChain

const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const path = require('path');

async function extractPDFContent() {
  console.log('📄 Extracting content from Your_Top_Choice.pdf...');
  
  try {
    const pdfPath = '/home/thedoc/Your_Top_Choice.pdf';
    const loader = new PDFLoader(pdfPath);
    
    const docs = await loader.load();
    
    console.log(`✅ Successfully loaded ${docs.length} document chunks`);
    
    // Combine all pages into a single text
    const fullText = docs.map(doc => doc.pageContent).join('\n\n');
    
    console.log('\n📋 EXTRACTED CONTENT:');
    console.log('=' + '='.repeat(50));
    console.log(fullText);
    console.log('=' + '='.repeat(50));
    
    // Analyze for educational patterns
    console.log('\n🎓 EDUCATIONAL PATTERN ANALYSIS:');
    
    const educationalPatterns = [
      /studied at/gi,
      /attended/gi,
      /graduated from/gi,
      /degree from/gi,
      /bachelor/gi,
      /master/gi,
      /phd|ph\.d/gi,
      /university/gi,
      /college/gi,
      /school/gi,
      /education/gi
    ];
    
    educationalPatterns.forEach(pattern => {
      const matches = fullText.match(pattern);
      if (matches) {
        console.log(`✅ Found "${pattern.source}": ${matches.length} matches`);
        // Show context around matches
        const regex = new RegExp(`(.{0,50}${pattern.source}.{0,50})`, 'gi');
        const contextMatches = fullText.match(regex);
        if (contextMatches) {
          contextMatches.slice(0, 3).forEach(match => {
            console.log(`   Context: "${match.trim()}"`);
          });
        }
      }
    });
    
    return fullText;
    
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    return null;
  }
}

// Run the extraction
if (require.main === module) {
  extractPDFContent().then(() => {
    console.log('\n🎯 PDF analysis complete! Ready to test educational relationship extraction.');
    process.exit(0);
  });
}

module.exports = { extractPDFContent };
