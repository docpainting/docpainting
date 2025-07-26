#!/bin/bash

echo "🧪 Testing DOC Painting AI with Neo4j Aura + OpenRouter..."
echo "============================================================"

# Test 1: Victorian painting project (should find Project nodes)
echo "📋 Test 1: Victorian House Painting Query"
echo "Expected: Should find Project nodes about Victorian homes"
echo ""

curl -X POST https://docpainting.netlify.app/.netlify/functions/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What experience do you have with Victorian house painting?",
    "customerEmail": "test@example.com",
    "customerName": "Test User"
  }' | jq '.'

echo ""
echo "============================================================"

# Test 2: Materials query (should find Material nodes)  
echo "📋 Test 2: Fine Paints of Europe Query"
echo "Expected: Should find Material nodes about Fine Paints of Europe"
echo ""

curl -X POST https://docpainting.netlify.app/.netlify/functions/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about Fine Paints of Europe",
    "customerEmail": "test@example.com",
    "customerName": "Test User"
  }' | jq '.'

echo ""
echo "============================================================"

# Test 3: Marianne query (should find Person/Job nodes)
echo "📋 Test 3: Marianne Abrams Career Query"
echo "Expected: Should find Person/Job nodes about Marianne's experience"
echo ""

curl -X POST https://docpainting.netlify.app/.netlify/functions/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is Marianne Abrams work experience?",
    "customerEmail": "test@example.com", 
    "customerName": "Test User"
  }' | jq '.'

echo ""
echo "🎯 Look for knowledgeItemsFound > 0 in the responses above!"
echo "✅ If > 0: Neo4j Aura database is working"
echo "❌ If = 0: Still getting fallback responses"
