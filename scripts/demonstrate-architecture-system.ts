#!/usr/bin/env tsx
/**
 * Demonstrate Architecture System
 * Shows how the context-aware architecture system works
 */

import { supabaseClient as supabase } from '../src/services/supabase-client';
import { architectureAdvisor } from '../src/services/architecture-advisor-service';
import { contextInjectionService } from '../src/services/context-injection-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateArchitectureSystem() {
  console.log('🏗️  Architecture System Demonstration\n');
  console.log('=====================================\n');
  
  try {
    // Example 1: Search for memory management patterns
    console.log('📚 Example 1: Finding Memory Management Patterns\n');
    
    const memoryRequest = 'I need to build a chatbot that remembers conversations across sessions';
    console.log(`User Request: "${memoryRequest}"\n`);
    
    const memoryRecommendations = await architectureAdvisor.getTaskRecommendations(
      memoryRequest,
      { limit: 3 }
    );
    
    console.log('🎯 Recommended Patterns:\n');
    memoryRecommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec.pattern.name} (${rec.pattern.framework})`);
      console.log(`   Relevance: ${(rec.relevanceScore * 100).toFixed(0)}%`);
      console.log(`   Success Rate: ${(rec.pattern.successRate * 100).toFixed(0)}%`);
      console.log(`   ${rec.reasoning}\n`);
    });
    
    // Example 2: Analyze implementation
    console.log('\n📝 Example 2: Analyzing Current Implementation\n');
    
    const currentCode = `
class SimpleChatbot {
  constructor() {
    this.messages = [];
  }
  
  async processMessage(message) {
    this.messages.push(message);
    return await this.llm.generate(message);
  }
}`;
    
    console.log('Current Implementation:');
    console.log(currentCode);
    console.log('\nTarget Pattern: MemGPT Virtual Context Management\n');
    
    const analysis = await architectureAdvisor.analyzeImplementation(
      currentCode,
      'Virtual Context Management'
    );
    
    console.log('🔍 Analysis Results:');
    console.log(`   Pattern Match Score: ${(analysis.score * 100).toFixed(0)}%\n`);
    
    if (analysis.gaps.length > 0) {
      console.log('   Missing Components:');
      analysis.gaps.forEach(gap => console.log(`   - ${gap}`));
    }
    
    if (analysis.suggestions.length > 0) {
      console.log('\n   Improvement Suggestions:');
      analysis.suggestions.forEach(suggestion => console.log(`   - ${suggestion}`));
    }
    
    // Example 3: Context injection with architecture patterns
    console.log('\n\n🤖 Example 3: Agent Context with Architecture Guidance\n');
    
    const agentRequest = 'Help me implement a memory system for my AI assistant';
    console.log(`Agent Request: "${agentRequest}"\n`);
    
    const enrichedContext = await contextInjectionService.enrichUserRequest(
      agentRequest,
      {
        projectPath: process.cwd(),
        includeArchitecturePatterns: true,
        metadata: {
          agentType: 'code_assistant',
          capabilities: ['memory', 'persistence']
        }
      }
    );
    
    console.log('📋 Enriched Context Summary:');
    console.log(`   ${enrichedContext.contextSummary}`);
    console.log(`   Sources Used: ${enrichedContext.sourcesUsed.join(', ')}\n`);
    
    // Extract architecture guidance from enriched prompt
    const promptLines = enrichedContext.enrichedPrompt.split('\n');
    const architectureSection = promptLines.findIndex(line => 
      line.includes('Architecture Patterns')
    );
    
    if (architectureSection !== -1) {
      console.log('🏛️ Architecture Guidance Included in Agent Context:\n');
      const relevantLines = promptLines.slice(
        architectureSection, 
        architectureSection + 15
      ).join('\n');
      console.log(relevantLines);
    }
    
    // Example 4: Track pattern usage
    console.log('\n\n📊 Example 4: Tracking Pattern Usage\n');
    
    const patternId = memoryRecommendations[0]?.pattern.id;
    if (patternId) {
      await architectureAdvisor.trackPatternUsage(
        patternId,
        {
          userRequest: memoryRequest,
          agentType: 'chatbot',
          taskComplexity: 'medium'
        },
        true, // success
        {
          responseTime: 250,
          tokenUsage: 1500,
          userSatisfaction: 0.9
        }
      );
      
      console.log(`✅ Tracked successful usage of ${memoryRecommendations[0].pattern.name}`);
      
      // Get updated metrics
      const metrics = await architectureAdvisor.getPatternMetrics(patternId);
      if (metrics.length > 0) {
        const pattern = metrics[0];
        console.log(`\n   Updated Metrics:`);
        console.log(`   - Usage Count: ${pattern.usageCount}`);
        console.log(`   - Success Rate: ${(pattern.successRate * 100).toFixed(0)}%`);
        console.log(`   - Avg Response Time: ${pattern.avgResponseTime?.toFixed(0)}ms`);
      }
    }
    
    console.log('\n\n✨ Architecture System Benefits:\n');
    console.log('1. 🎯 Context-aware pattern recommendations');
    console.log('2. 🔍 Implementation gap analysis');
    console.log('3. 🤖 Automatic context enrichment for agents');
    console.log('4. 📊 Usage tracking and continuous improvement');
    console.log('5. 🧮 Semantic search with vector embeddings\n');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  }
}

// Run the demonstration
demonstrateArchitectureSystem().catch(console.error);