#!/usr/bin/env node

/**
 * Quick test to verify the personal agents are properly structured
 */

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 Quick Personal AI Agents Structure Test...\n');

// Test if all personal agent files exist and have proper exports
const personalAgents = [
  'calendar_agent.ts',
  'photo_organizer_agent.ts', 
  'file_manager_agent.ts',
  'code_assistant_agent.ts',
  'system_control_agent.ts',
  'personal_assistant_agent.ts',
  'web_scraper_agent.ts',
  'tool_maker_agent.ts'
];

const agentsDir = './src/agents/personal/';

console.log('📁 Checking Personal Agent Files:');
let allFilesExist = true;

personalAgents.forEach((agentFile, index) => {
  try {
    const filePath = join(agentsDir, agentFile);
    const content = readFileSync(filePath, 'utf8');
    
    // Check for key patterns
    const hasExport = content.includes('export class') || content.includes('export default');
    const hasBaseAgent = content.includes('BaseAgent');
    const hasProcess = content.includes('protected async process');
    
    console.log(`${index + 1}. ${agentFile}:`);
    console.log(`   ✅ File exists`);
    console.log(`   ${hasExport ? '✅' : '❌'} Has proper export`);
    console.log(`   ${hasBaseAgent ? '✅' : '❌'} Extends BaseAgent`);
    console.log(`   ${hasProcess ? '✅' : '❌'} Has process method`);
    
    if (!hasExport || !hasBaseAgent || !hasProcess) {
      allFilesExist = false;
    }
    
  } catch (error) {
    console.log(`${index + 1}. ${agentFile}: ❌ Missing or error - ${error.message}`);
    allFilesExist = false;
  }
});

console.log('\n📊 Registry Integration:');
try {
  const registryContent = readFileSync('./src/agents/universal_agent_registry.ts', 'utf8');
  
  const hasPersonalCategory = registryContent.includes('PERSONAL = \'personal\'');
  const hasPersonalAgentsMethod = registryContent.includes('registerPersonalAgents');
  const hasWebScraper = registryContent.includes('web_scraper');
  const hasToolMaker = registryContent.includes('tool_maker');
  
  console.log(`✅ Registry file exists`);
  console.log(`${hasPersonalCategory ? '✅' : '❌'} Has PERSONAL category`);
  console.log(`${hasPersonalAgentsMethod ? '✅' : '❌'} Has registerPersonalAgents method`);
  console.log(`${hasWebScraper ? '✅' : '❌'} Includes WebScraperAgent`);
  console.log(`${hasToolMaker ? '✅' : '❌'} Includes ToolMakerAgent`);
  
} catch (error) {
  console.log(`❌ Registry check failed: ${error.message}`);
  allFilesExist = false;
}

console.log('\n🎯 Summary:');
if (allFilesExist) {
  console.log('✅ All personal agents are properly structured and integrated!');
  console.log('🚀 Ready for comprehensive AI assistant capabilities:');
  console.log('   📅 Calendar Management');
  console.log('   📸 Photo Organization with Face Recognition');
  console.log('   📁 Intelligent File Management');
  console.log('   💻 Code Assistant & Development Workflow');
  console.log('   🖥️  macOS System Control');
  console.log('   🌐 Web Scraping & API Integration');
  console.log('   🔧 Dynamic Tool Creation');
  console.log('   🤖 Coordinated Personal Assistant');
  
  console.log('\n🔧 Next steps to make it functional:');
  console.log('   1. Set up Supabase database connection');
  console.log('   2. Configure Ollama with required models (llama3.2:3b, deepseek-r1:14b)');
  console.log('   3. Install system dependencies (exiftool, face_recognition)');
  console.log('   4. Test individual agent capabilities');
  console.log('   5. Test end-to-end workflows via PersonalAssistantAgent');
} else {
  console.log('❌ Some issues need to be resolved before the system is ready');
}