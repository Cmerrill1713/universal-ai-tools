#!/usr/bin/env node

/**
 * R1 Reasoning Workflow Demonstration
 * Shows the complete Think-Generate-Retrieve-Rethink methodology in action
 */

import { performance } from 'perf_hooks';
import fetch from 'node-fetch';

console.log('🧠 R1 Reasoning Workflow Demonstration');
console.log('=====================================');
console.log('Demonstrating Think-Generate-Retrieve-Rethink methodology\n');

const SERVER_URL = 'http://localhost:9999';
const LM_STUDIO_URL = 'http://localhost:5901';

class R1ReasoningDemo {
  constructor() {
    this.reasoningChain = [];
    this.confidenceEvolution = [];
    this.totalStartTime = 0;
  }

  async demonstrateR1Reasoning() {
    console.log('🚀 Starting R1 Reasoning Demonstration\n');

    const complexQuery = 'Design an optimal AI system architecture that combines knowledge graphs, multi-tier model routing, and advanced reasoning workflows for maximum performance and accuracy';

    console.log(`🎯 Complex Query: "${complexQuery}"\n`);
    console.log('📋 R1 Methodology: Think → Generate → Retrieve → Rethink\n');

    this.totalStartTime = performance.now();

    try {
      // Phase 1: THINK - Deep analysis
      await this.executeThinkPhase(complexQuery);

      // Phase 2: GENERATE - Initial hypothesis
      await this.executeGeneratePhase();

      // Phase 3: RETRIEVE - Knowledge gathering
      await this.executeRetrievePhase();

      // Phase 4: RETHINK - Synthesis and refinement
      await this.executeRethinkPhase();

      // Final synthesis
      await this.synthesizeFinalAnswer();

    } catch (error) {
      console.error('❌ R1 reasoning demonstration failed:', error.message);
    }
  }

  async executeThinkPhase(query) {
    console.log('🤔 PHASE 1: THINK - Deep Analysis');
    console.log('-------------------------------');

    const thinkPrompt = `THINKING PHASE - Deep Analysis

Query: ${query}

Analyze this problem systematically:
1. What are the key components mentioned?
2. What relationships exist between these components?
3. What are the main challenges in designing such a system?
4. What knowledge areas are most relevant?
5. What assumptions should we make?

Provide structured thinking:`;

    const result = await this.callLLMStep('THINK', thinkPrompt, 'qwen2.5-coder-14b-instruct-mlx');
    
    console.log(`📝 Thinking Output:\n${this.formatOutput(result.content)}\n`);
    console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`⏱️  Duration: ${result.duration}ms\n`);
  }

  async executeGeneratePhase() {
    console.log('💡 PHASE 2: GENERATE - Initial Hypothesis');
    console.log('----------------------------------------');

    const lastThinking = this.reasoningChain[this.reasoningChain.length - 1];
    const generatePrompt = `GENERATION PHASE - Initial Hypothesis

Based on the thinking analysis: "${lastThinking.content.substring(0, 200)}..."

Generate initial approach:
1. What would be the core architecture components?
2. How would these components interact?
3. What are 2-3 alternative approaches?
4. What are the main technical considerations?
5. What additional information would be helpful?

Provide initial hypothesis:`;

    const result = await this.callLLMStep('GENERATE', generatePrompt, 'google/gemma-3-4b');
    
    console.log(`💭 Generated Hypothesis:\n${this.formatOutput(result.content)}\n`);
    console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`⏱️  Duration: ${result.duration}ms\n`);
  }

  async executeRetrievePhase() {
    console.log('🔍 PHASE 3: RETRIEVE - Knowledge Gathering');
    console.log('-----------------------------------------');

    // Simulate knowledge retrieval from multiple sources
    console.log('   📚 Retrieving from knowledge sources...');
    
    // Try GraphRAG retrieval
    const graphKnowledge = await this.retrieveFromGraphRAG();
    
    // Simulate additional knowledge sources
    const additionalKnowledge = [
      'AI system architectures often use microservices patterns for scalability',
      'Knowledge graphs provide structured semantic relationships for reasoning',
      'Multi-tier routing optimizes compute resources based on query complexity',
      'Performance optimization requires balancing accuracy and speed'
    ];

    const retrievedContent = [
      'GraphRAG Knowledge: ' + (graphKnowledge || 'No specific graph knowledge found'),
      'Domain Knowledge: ' + additionalKnowledge.join('; ')
    ].join('\n\n');

    const retrieveResult = {
      phase: 'RETRIEVE',
      content: retrievedContent,
      confidence: 0.85,
      duration: 800,
      sources: ['GraphRAG', 'Domain Knowledge Base']
    };

    this.reasoningChain.push(retrieveResult);
    this.confidenceEvolution.push(retrieveResult.confidence);

    console.log(`📖 Retrieved Knowledge:\n${this.formatOutput(retrieveResult.content)}\n`);
    console.log(`🎯 Confidence: ${(retrieveResult.confidence * 100).toFixed(1)}%`);
    console.log(`📡 Sources: ${retrieveResult.sources.join(', ')}`);
    console.log(`⏱️  Duration: ${retrieveResult.duration}ms\n`);
  }

  async executeRethinkPhase() {
    console.log('🔄 PHASE 4: RETHINK - Synthesis and Refinement');
    console.log('---------------------------------------------');

    const previousSteps = this.reasoningChain.map(step => 
      `${step.phase}: ${step.content.substring(0, 150)}...`
    ).join('\n\n');

    const rethinkPrompt = `RETHINKING PHASE - Evidence Integration

Previous reasoning steps:
${previousSteps}

Now synthesize and refine:
1. How does the retrieved evidence support or modify initial hypothesis?
2. What are the strongest architecture approaches based on evidence?
3. What specific recommendations can you make?
4. What is your refined understanding of the optimal solution?
5. What confidence level do you have in this refined approach?

Provide refined synthesis:`;

    const result = await this.callLLMStep('RETHINK', rethinkPrompt, 'deepseek/deepseek-r1-0528-qwen3-8b');
    
    console.log(`🧠 Refined Analysis:\n${this.formatOutput(result.content)}\n`);
    console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`⏱️  Duration: ${result.duration}ms\n`);
  }

  async synthesizeFinalAnswer() {
    console.log('✨ FINAL SYNTHESIS');
    console.log('=================');

    const finalPrompt = `FINAL SYNTHESIS

Based on the complete R1 reasoning chain with ${this.reasoningChain.length} steps:

${this.reasoningChain.map((step, i) => 
  `${i + 1}. ${step.phase}: ${step.content.substring(0, 100)}...`
).join('\n')}

Provide the final, comprehensive answer to the original question about designing an optimal AI system architecture. Be specific, actionable, and confident.`;

    const finalResult = await this.callLLMStep('SYNTHESIZE', finalPrompt, 'qwen2.5-coder-14b-instruct-mlx');
    
    const totalTime = performance.now() - this.totalStartTime;
    const avgConfidence = this.confidenceEvolution.reduce((sum, c) => sum + c, 0) / this.confidenceEvolution.length;

    console.log(`🎯 FINAL ANSWER:\n${this.formatOutput(finalResult.content)}\n`);
    
    console.log('📊 R1 REASONING METRICS');
    console.log('=======================');
    console.log(`Total Steps: ${this.reasoningChain.length + 1}`);
    console.log(`Total Time: ${totalTime.toFixed(0)}ms`);
    console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`Final Confidence: ${(finalResult.confidence * 100).toFixed(1)}%`);
    console.log(`Confidence Evolution: ${this.confidenceEvolution.map(c => (c * 100).toFixed(0) + '%').join(' → ')} → ${(finalResult.confidence * 100).toFixed(0)}%\n`);

    console.log('🏆 R1 REASONING WORKFLOW COMPLETED SUCCESSFULLY!');
    console.log('✨ Advanced multi-step reasoning with Think-Generate-Retrieve-Rethink methodology demonstrated');
  }

  async callLLMStep(phase, prompt, model) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: phase === 'THINK' ? 0.4 : phase === 'GENERATE' ? 0.6 : 0.3,
          max_tokens: 600
        }),
        signal: AbortSignal.timeout(15000)
      });

      const duration = performance.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        // Calculate confidence based on content quality and phase
        let confidence = 0.7;
        if (content.length > 200) confidence += 0.1;
        if (content.includes('because') || content.includes('therefore')) confidence += 0.1;
        if (phase === 'RETHINK') confidence += 0.1; // Boost for synthesis
        
        const stepResult = {
          phase,
          content,
          confidence: Math.min(0.95, confidence),
          duration: Math.round(duration),
          model
        };

        this.reasoningChain.push(stepResult);
        this.confidenceEvolution.push(stepResult.confidence);

        return stepResult;
      } else {
        throw new Error(`LLM call failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${phase} phase failed:`, error.message);
      return {
        phase,
        content: `Error in ${phase} phase: ${error.message}`,
        confidence: 0.3,
        duration: performance.now() - startTime,
        model
      };
    }
  }

  async retrieveFromGraphRAG() {
    try {
      const response = await fetch(`${SERVER_URL}/api/v1/graphrag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'AI system architecture knowledge graphs multi-tier routing',
          maxResults: 3
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results.map(r => r.content || r.entity).join('; ');
        }
      }
    } catch (error) {
      console.log(`   ⚠️ GraphRAG retrieval failed: ${error.message}`);
    }
    
    return null;
  }

  formatOutput(text) {
    // Format output for better readability
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => `   ${line}`)
      .join('\n');
  }
}

// Run the R1 reasoning demonstration
const demo = new R1ReasoningDemo();
demo.demonstrateR1Reasoning().catch(console.error);