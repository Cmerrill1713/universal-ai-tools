#!/usr/bin/env node

/**
 * Universal AI Tools Connection Helper
 * This script helps you connect any program to the Universal AI Tools system
 * using Ollama for intelligent code generation
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_BASE = 'http://localhost:9999/api';

async function main() {
  console.log('🤖 Universal AI Tools Connection Helper\n');

  // Get user input
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node connect-any-program.js <language> <framework> <purpose>');
    console.log('\nExamples:');
    console.log('  node connect-any-program.js python flask "web app that needs memory"');
    console.log('  node connect-any-program.js javascript express "chatbot with context"');
    console.log('  node connect-any-program.js go gin "api server with knowledge base"');
    return;
  }

  const [language, framework, purpose] = args;

  console.log(`📝 Generating ${language} integration for ${framework}...`);
  console.log(`📌 Purpose: ${purpose}\n`);

  try {
    // Step 1: Generate integration code
    const { data: { code } } = await axios.post(`${API_BASE}/assistant/generate-integration`, {
      language,
      framework,
      purpose
    });

    console.log('✅ Generated integration code:\n');
    console.log('─'.repeat(80));
    console.log(code);
    console.log('─'.repeat(80));

    // Save the code
    const filename = `universal-ai-${language}-${framework}.${getFileExtension(language)}`;
    await fs.writeFile(filename, code);
    console.log(`\n💾 Saved to: ${filename}`);

    // Step 2: Suggest tools based on purpose
    console.log('\n🔧 Suggesting tools for your use case...');
    const { data: suggestions } = await axios.post(`${API_BASE}/assistant/suggest-tools`, {
      request: purpose
    });

    if (suggestions && suggestions.suggested_tools) {
      console.log('\nRecommended tools:');
      suggestions.suggested_tools.forEach(tool => {
        console.log(`  - ${tool}`);
      });
      if (suggestions.reasoning) {
        console.log(`\nReasoning: ${suggestions.reasoning}`);
      }
    }

    // Step 3: Create a custom tool if needed
    console.log('\n🛠️  Would you like to create a custom tool? (This example creates a sample)');
    
    const customToolExample = {
      name: `${framework}_helper`,
      description: `Helper tool for ${framework} ${purpose}`,
      requirements: `A tool that helps ${framework} applications with ${purpose}`
    };

    const { data: { tool } } = await axios.post(`${API_BASE}/assistant/create-tool`, customToolExample);
    
    console.log('\nExample custom tool generated:');
    console.log(JSON.stringify(tool, null, 2));

    // Step 4: Show next steps
    console.log('\n📚 Next Steps:');
    console.log('1. Start the Universal AI Tools service: npm run dev');
    console.log('2. Register your application to get an API key');
    console.log('3. Use the generated code in your project');
    console.log('4. Store memories, context, and knowledge as needed');
    console.log('\nFor more details, see UNIVERSAL_AI_TOOLS_SETUP.md');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    console.log('\nMake sure:');
    console.log('1. Universal AI Tools service is running (port 9999)');
    console.log('2. Ollama is running');
    console.log('3. You have at least one Ollama model installed');
  }
}

function getFileExtension(language) {
  const extensions = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    go: 'go',
    rust: 'rs',
    java: 'java',
    csharp: 'cs',
    ruby: 'rb',
    php: 'php'
  };
  return extensions[language.toLowerCase()] || 'txt';
}

main().catch(console.error);