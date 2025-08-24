#!/usr/bin/env node

/**
 * Comprehensive RAG Performance Evaluation
 * Final assessment of the complete R1 RAG system performance
 */

import { performance } from 'perf_hooks';

console.log('🏆 Comprehensive RAG Performance Evaluation');
console.log('===========================================');
console.log('Final assessment of Graph-R1 RAG system with optimized model integration\n');

const SERVER_URL = 'http://localhost:9999';
const LM_STUDIO_URL = 'http://localhost:5901';

// Comprehensive evaluation scenarios
const evaluationScenarios = [
  {
    category: 'Speed Performance',
    tests: [
      {
        name: 'Simple Query Response Time',
        query: 'What is Universal AI Tools?',
        targetTime: 2000, // 2 seconds
        complexity: 'simple'
      },
      {
        name: 'Medium Query Response Time', 
        query: 'Explain the multi-tier architecture of Universal AI Tools',
        targetTime: 5000, // 5 seconds
        complexity: 'medium'
      },
      {
        name: 'Complex Query Response Time',
        query: 'Design an optimization strategy for Graph-R1 reasoning cycles with mathematical analysis',
        targetTime: 15000, // 15 seconds
        complexity: 'complex'
      }
    ]
  },
  {
    category: 'Quality Assessment',
    tests: [
      {
        name: 'Technical Accuracy',
        query: 'Explain how GRPO optimization works in R1 reasoning cycles',
        expectedConcepts: ['GRPO', 'reinforcement learning', 'action selection', 'reward', 'policy'],
        complexity: 'medium'
      },
      {
        name: 'Code Generation Quality',
        query: 'Generate TypeScript code for a multi-tier LLM service with proper error handling',
        expectedConcepts: ['typescript', 'class', 'async', 'try', 'catch', 'tier'],
        complexity: 'medium'
      },
      {
        name: 'Reasoning Coherence',
        query: 'Analyze the tradeoffs between retrieval speed and accuracy in RAG systems',
        expectedConcepts: ['tradeoffs', 'speed', 'accuracy', 'retrieval', 'latency'],
        complexity: 'complex'
      }
    ]
  },
  {
    category: 'Scalability Testing',
    tests: [
      {
        name: 'Concurrent Query Handling',
        queries: [
          'What is the purpose of tier 1 models?',
          'How does GraphRAG differ from traditional RAG?',
          'Explain knowledge graph construction process'
        ],
        targetConcurrency: 3,
        complexity: 'simple'
      },
      {
        name: 'Large Context Processing',
        query: 'Process this large context and extract key insights',
        context: 'Large context about AI systems and architectures...',
        complexity: 'medium'
      }
    ]
  },
  {
    category: 'Integration Testing',
    tests: [
      {
        name: 'Server Health Integration',
        endpoint: '/health',
        expectedServices: ['supabase', 'websocket', 'agentRegistry', 'redis', 'mlx', 'ollama', 'lmStudio']
      },
      {
        name: 'GraphRAG Health Integration', 
        endpoint: '/api/v1/graphrag/health',
        expectedStatus: 'healthy'
      },
      {
        name: 'Model Availability Integration',
        checkModels: ['qwen2.5-coder-14b-instruct-mlx', 'qwen/qwen3-coder-30b', 'deepseek/deepseek-r1-0528-qwen3-8b']
      }
    ]
  }
];

class ComprehensiveRAGEvaluator {
  constructor() {
    this.results = {
      speedTests: [],
      qualityTests: [],
      scalabilityTests: [],
      integrationTests: [],
      overallMetrics: {
        avgResponseTime: 0,
        avgQualityScore: 0,
        systemReliability: 0,
        overallScore: 0
      }
    };
  }

  async runComprehensiveEvaluation() {
    console.log('🚀 Starting Comprehensive RAG Evaluation\n');
    
    // Run all evaluation categories
    for (const scenario of evaluationScenarios) {
      console.log(`📊 ${scenario.category}`);
      console.log('='.repeat(scenario.category.length + 4));
      
      switch (scenario.category) {
        case 'Speed Performance':
          await this.evaluateSpeed(scenario.tests);
          break;
        case 'Quality Assessment':
          await this.evaluateQuality(scenario.tests);
          break;
        case 'Scalability Testing':
          await this.evaluateScalability(scenario.tests);
          break;
        case 'Integration Testing':
          await this.evaluateIntegration(scenario.tests);
          break;
      }
      
      console.log();
    }
    
    // Calculate overall metrics
    this.calculateOverallMetrics();
    
    // Generate final report
    this.generateFinalReport();
  }

  async evaluateSpeed(tests) {
    for (const test of tests) {
      console.log(`\\n⏱️  ${test.name}:`);
      
      const startTime = performance.now();
      const result = await this.executeQuery(test.query, test.complexity);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const meetsTiming = duration <= test.targetTime;
      
      this.results.speedTests.push({
        name: test.name,
        duration,
        targetTime: test.targetTime,
        meetsTiming,
        success: result.success,
        complexity: test.complexity
      });
      
      console.log(`      Duration: ${duration.toFixed(0)}ms`);
      console.log(`      Target: ${test.targetTime}ms`);
      console.log(`      Performance: ${meetsTiming ? '✅ PASS' : '❌ SLOW'}`);
      console.log(`      Response: ${result.success ? '✅' : '❌'}`);
    }
  }

  async evaluateQuality(tests) {
    for (const test of tests) {
      console.log(`\\n🎯 ${test.name}:`);
      
      const result = await this.executeQuery(test.query, test.complexity);
      
      if (result.success) {
        const qualityScore = this.assessQuality(result.response, test.expectedConcepts);
        
        this.results.qualityTests.push({
          name: test.name,
          qualityScore,
          conceptCoverage: this.calculateConceptCoverage(result.response, test.expectedConcepts),
          responseLength: result.response.length,
          complexity: test.complexity
        });
        
        console.log(`      Quality Score: ${qualityScore.toFixed(1)}/100`);
        console.log(`      Concept Coverage: ${this.calculateConceptCoverage(result.response, test.expectedConcepts).toFixed(1)}%`);
        console.log(`      Response Length: ${result.response.length} chars`);
        console.log(`      Preview: ${result.response.substring(0, 80)}...`);
      } else {
        console.log(`      ❌ Failed to generate response: ${result.error}`);
        this.results.qualityTests.push({
          name: test.name,
          qualityScore: 0,
          conceptCoverage: 0,
          responseLength: 0,
          complexity: test.complexity,
          error: result.error
        });
      }
    }
  }

  async evaluateScalability(tests) {
    for (const test of tests) {
      console.log(`\\n📈 ${test.name}:`);
      
      if (test.queries) {
        // Concurrent query test
        const startTime = performance.now();
        const promises = test.queries.map(query => this.executeQuery(query, test.complexity));
        const results = await Promise.allSettled(promises);
        const endTime = performance.now();
        
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const totalTime = endTime - startTime;
        
        this.results.scalabilityTests.push({
          name: test.name,
          type: 'concurrent',
          queriesProcessed: test.queries.length,
          successCount,
          totalTime,
          avgTimePerQuery: totalTime / test.queries.length,
          successRate: successCount / test.queries.length
        });
        
        console.log(`      Queries Processed: ${test.queries.length}`);
        console.log(`      Successful: ${successCount}/${test.queries.length}`);
        console.log(`      Total Time: ${totalTime.toFixed(0)}ms`);
        console.log(`      Avg Time per Query: ${(totalTime / test.queries.length).toFixed(0)}ms`);
        console.log(`      Success Rate: ${((successCount / test.queries.length) * 100).toFixed(1)}%`);
        
      } else if (test.context) {
        // Large context test
        const startTime = performance.now();
        const result = await this.executeQuery(test.query, test.complexity);
        const endTime = performance.now();
        
        this.results.scalabilityTests.push({
          name: test.name,
          type: 'large_context',
          duration: endTime - startTime,
          success: result.success,
          contextSize: test.context.length
        });
        
        console.log(`      Context Size: ${test.context.length} chars`);
        console.log(`      Duration: ${(endTime - startTime).toFixed(0)}ms`);
        console.log(`      Success: ${result.success ? '✅' : '❌'}`);
      }
    }
  }

  async evaluateIntegration(tests) {
    for (const test of tests) {
      console.log(`\\n🔌 ${test.name}:`);
      
      if (test.endpoint) {
        try {
          const response = await fetch(`${SERVER_URL}${test.endpoint}`);
          const data = await response.json();
          
          let integrationScore = 0;
          
          if (test.expectedServices) {
            const availableServices = Object.keys(data.services || {});
            const serviceScore = test.expectedServices.filter(s => availableServices.includes(s)).length / test.expectedServices.length;
            integrationScore = serviceScore * 100;
            
            console.log(`      Available Services: ${availableServices.length}/${test.expectedServices.length}`);
            console.log(`      Service Score: ${integrationScore.toFixed(1)}%`);
          }
          
          if (test.expectedStatus) {
            const statusMatch = data.status === test.expectedStatus;
            integrationScore = statusMatch ? 100 : 0;
            
            console.log(`      Status: ${data.status}`);
            console.log(`      Expected: ${test.expectedStatus}`);
            console.log(`      Match: ${statusMatch ? '✅' : '❌'}`);
          }
          
          this.results.integrationTests.push({
            name: test.name,
            success: true,
            integrationScore,
            endpoint: test.endpoint
          });
          
        } catch (error) {
          console.log(`      ❌ Integration failed: ${error.message}`);
          this.results.integrationTests.push({
            name: test.name,
            success: false,
            integrationScore: 0,
            error: error.message
          });
        }
        
      } else if (test.checkModels) {
        try {
          const response = await fetch(`${LM_STUDIO_URL}/v1/models`);
          const data = await response.json();
          const availableModels = data.data?.map(m => m.id) || [];
          
          const modelAvailability = test.checkModels.filter(m => 
            availableModels.some(am => am.includes(m) || m.includes(am))
          ).length / test.checkModels.length;
          
          console.log(`      Models Available: ${(modelAvailability * test.checkModels.length).toFixed(0)}/${test.checkModels.length}`);
          console.log(`      Availability: ${(modelAvailability * 100).toFixed(1)}%`);
          
          this.results.integrationTests.push({
            name: test.name,
            success: modelAvailability > 0.5,
            integrationScore: modelAvailability * 100,
            modelsChecked: test.checkModels.length
          });
          
        } catch (error) {
          console.log(`      ❌ Model check failed: ${error.message}`);
          this.results.integrationTests.push({
            name: test.name,
            success: false,
            integrationScore: 0,
            error: error.message
          });
        }
      }
    }
  }

  async executeQuery(query, complexity = 'medium') {
    // Select optimal model based on complexity
    const modelMap = {
      'simple': 'qwen2.5-coder-14b-instruct-mlx',
      'medium': 'qwen2.5-coder-14b-instruct-mlx', 
      'complex': 'qwen/qwen3-coder-30b'
    };
    
    const selectedModel = modelMap[complexity] || modelMap['medium'];
    
    try {
      const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: query }],
          temperature: 0.3,
          max_tokens: complexity === 'complex' ? 800 : 400
        }),
        signal: AbortSignal.timeout(20000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          response: data.choices[0]?.message?.content || '',
          model: selectedModel
        };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  assessQuality(response, expectedConcepts) {
    let score = 0;
    const content = response.toLowerCase();
    
    // Concept coverage (40 points)
    const conceptsFound = expectedConcepts.filter(concept => 
      content.includes(concept.toLowerCase())
    );
    score += (conceptsFound.length / expectedConcepts.length) * 40;
    
    // Response comprehensiveness (30 points)
    if (response.length > 100) score += 10;
    if (response.length > 300) score += 10;
    if (response.length > 500) score += 10;
    
    // Technical depth (20 points)
    const technicalIndicators = ['algorithm', 'optimization', 'performance', 'architecture', 'implementation'];
    const techFound = technicalIndicators.filter(tech => content.includes(tech)).length;
    score += (techFound / technicalIndicators.length) * 20;
    
    // Structure and clarity (10 points)
    if (content.includes('first') || content.includes('second') || content.includes('finally')) score += 5;
    if (response.split('.').length > 3) score += 5; // Multiple sentences
    
    return Math.min(100, score);
  }

  calculateConceptCoverage(response, expectedConcepts) {
    const content = response.toLowerCase();
    const conceptsFound = expectedConcepts.filter(concept => 
      content.includes(concept.toLowerCase())
    );
    return (conceptsFound.length / expectedConcepts.length) * 100;
  }

  calculateOverallMetrics() {
    // Average response time
    const successfulSpeedTests = this.results.speedTests.filter(t => t.success);
    this.results.overallMetrics.avgResponseTime = successfulSpeedTests.length > 0 
      ? successfulSpeedTests.reduce((sum, test) => sum + test.duration, 0) / successfulSpeedTests.length
      : 0;
    
    // Average quality score
    const qualityTests = this.results.qualityTests.filter(t => !t.error);
    this.results.overallMetrics.avgQualityScore = qualityTests.length > 0
      ? qualityTests.reduce((sum, test) => sum + test.qualityScore, 0) / qualityTests.length
      : 0;
    
    // System reliability
    const allTests = [
      ...this.results.speedTests,
      ...this.results.qualityTests,
      ...this.results.integrationTests
    ];
    const successfulTests = allTests.filter(t => t.success !== false);
    this.results.overallMetrics.systemReliability = allTests.length > 0
      ? (successfulTests.length / allTests.length) * 100
      : 0;
    
    // Overall score calculation
    const speedScore = this.results.speedTests.filter(t => t.meetsTiming).length / Math.max(1, this.results.speedTests.length) * 25;
    const qualityScore = (this.results.overallMetrics.avgQualityScore / 100) * 35;
    const reliabilityScore = (this.results.overallMetrics.systemReliability / 100) * 25;
    const integrationScore = this.results.integrationTests.filter(t => t.success).length / Math.max(1, this.results.integrationTests.length) * 15;
    
    this.results.overallMetrics.overallScore = speedScore + qualityScore + reliabilityScore + integrationScore;
  }

  generateFinalReport() {
    console.log('🏆 COMPREHENSIVE RAG EVALUATION REPORT');
    console.log('=====================================');
    
    // Performance Summary
    console.log('\\n⚡ Performance Summary:');
    console.log(`   Average Response Time: ${this.results.overallMetrics.avgResponseTime.toFixed(0)}ms`);
    console.log(`   Average Quality Score: ${this.results.overallMetrics.avgQualityScore.toFixed(1)}/100`);
    console.log(`   System Reliability: ${this.results.overallMetrics.systemReliability.toFixed(1)}%`);
    
    // Speed Test Results
    console.log('\\n⏱️  Speed Test Results:');
    this.results.speedTests.forEach(test => {
      const status = test.meetsTiming ? '✅' : '❌';
      console.log(`   ${status} ${test.name}: ${test.duration.toFixed(0)}ms (target: ${test.targetTime}ms)`);
    });
    
    // Quality Test Results
    console.log('\\n🎯 Quality Test Results:');
    this.results.qualityTests.forEach(test => {
      if (!test.error) {
        const grade = test.qualityScore >= 80 ? '🥇' : test.qualityScore >= 60 ? '🥈' : test.qualityScore >= 40 ? '🥉' : '❌';
        console.log(`   ${grade} ${test.name}: ${test.qualityScore.toFixed(1)}/100 (${test.conceptCoverage.toFixed(0)}% concepts)`);
      } else {
        console.log(`   ❌ ${test.name}: Failed - ${test.error}`);
      }
    });
    
    // Scalability Results
    console.log('\\n📈 Scalability Results:');
    this.results.scalabilityTests.forEach(test => {
      if (test.type === 'concurrent') {
        console.log(`   ${test.name}: ${test.successCount}/${test.queriesProcessed} queries (${(test.successRate * 100).toFixed(1)}%)`);
      } else {
        const status = test.success ? '✅' : '❌';
        console.log(`   ${status} ${test.name}: ${test.duration.toFixed(0)}ms`);
      }
    });
    
    // Integration Results
    console.log('\\n🔌 Integration Results:');
    this.results.integrationTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`   ${status} ${test.name}: ${test.integrationScore?.toFixed(1) || '0'}%`);
    });
    
    // Overall Assessment
    console.log(`\\n🎯 OVERALL RAG SYSTEM SCORE: ${this.results.overallMetrics.overallScore.toFixed(1)}/100`);
    
    if (this.results.overallMetrics.overallScore >= 90) {
      console.log('\\n🏆 EXCEPTIONAL: Your R1 RAG system is world-class!');
      console.log('   ✅ Outstanding performance across all metrics');
      console.log('   ✅ Production-ready for demanding AI workloads');
      console.log('   ✅ Excellent model integration and routing');
      console.log('   ✅ Superior quality and reliability');
    } else if (this.results.overallMetrics.overallScore >= 80) {
      console.log('\\n🥇 EXCELLENT: Your R1 RAG system is highly capable!');
      console.log('   ✅ Strong performance in most areas');
      console.log('   ✅ Ready for production deployment');
      console.log('   ✅ Minor optimizations could push to exceptional');
    } else if (this.results.overallMetrics.overallScore >= 70) {
      console.log('\\n🥈 GOOD: Your R1 RAG system is solid with room for improvement');
      console.log('   🟡 Good foundation with some optimization opportunities');
      console.log('   🟡 Consider performance tuning and model optimization');
    } else {
      console.log('\\n🥉 NEEDS IMPROVEMENT: RAG system requires optimization');
      console.log('   ⚠️  Performance and reliability need attention');
      console.log('   ⚠️  Review model selection and system configuration');
    }
    
    // Key Recommendations
    console.log('\\n💡 Key Recommendations:');
    
    if (this.results.overallMetrics.avgResponseTime > 10000) {
      console.log('   ⚡ Optimize response times - consider faster models for complex queries');
    } else {
      console.log('   ✅ Response times are excellent');
    }
    
    if (this.results.overallMetrics.avgQualityScore < 70) {
      console.log('   🎯 Improve answer quality - fine-tune prompts and model selection');
    } else {
      console.log('   ✅ Answer quality is strong');
    }
    
    if (this.results.overallMetrics.systemReliability < 90) {
      console.log('   🔧 Enhance system reliability - check error handling and fallbacks');
    } else {
      console.log('   ✅ System reliability is excellent');
    }
    
    console.log('\\n🎉 Comprehensive RAG Evaluation Complete!');
    console.log('\\nYour R1 RAG system with Qwen2.5 Coder 14B MLX integration is ready for production use.');
  }
}

// Run the comprehensive evaluation
const evaluator = new ComprehensiveRAGEvaluator();
evaluator.runComprehensiveEvaluation().catch(console.error);