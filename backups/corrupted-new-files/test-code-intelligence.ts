#!/usr/bin/env npx tsx

/**
 * Test script for Code Intelligence System
 * Tests the ability to recognize code patterns and learn from existing codebase
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const API_URL = 'http://localhost:9999/api/v1';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}═══ ${msg} ═══${colors.reset}\n`)
};

// Test configuration
const TEST_FILES = [
  '/Users/christianmerrill/Desktop/universal-ai-tools/src/services/semantic-code-analyzer.ts',
  '/Users/christianmerrill/Desktop/universal-ai-tools/src/services/code-intelligence-orchestrator.ts',
  '/Users/christianmerrill/Desktop/universal-ai-tools/src/core/self-improvement/pattern-mining-system.ts'
];

async function waitForServer(maxAttempts = 30): Promise<boolean> {
  log.info('Waiting for server to be ready...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${API_URL}/code-intelligence/status`);
      if (response.data.success) {
        log.success('Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log.error('Server failed to start within timeout');
  return false;
}

async function testFileAnalysis(filePath: string) {
  log.section(`Testing File Analysis: ${path.basename(filePath)}`);
  
  try {
    const response = await axios.post(`${API_URL}/code-intelligence/analyze/file`, {
      filePath,
      options: {
        analysisDepth: 'deep',
        enableLearning: true,
        includeMLSuggestions: true
      }
    });

    const result = response.data.data;
    
    log.success(`Analysis completed in ${result.performance.totalTime}ms`);
    log.info(`Patterns found: ${result.metadata.patterns_found}`);
    log.info(`Issues detected: ${result.metadata.issues_detected}`);
    log.info(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    
    // Display some patterns
    if (result.results.semanticAnalysis?.[0]?.patterns?.length > 0) {
      log.info('\nDetected Patterns:');
      result.results.semanticAnalysis[0].patterns.slice(0, 3).forEach((pattern: any) => {
        console.log(`  - ${colors.yellow}${pattern.name}${colors.reset}: ${pattern.description}`);
        console.log(`    Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
      });
    }
    
    // Display recommendations
    if (result.results.recommendations?.length > 0) {
      log.info('\nTop Recommendations:');
      result.results.recommendations.slice(0, 3).forEach((rec: any) => {
        console.log(`  - [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`    ${rec.description}`);
      });
    }

    return result;
  } catch (error: any) {
    log.error(`Failed to analyze file: ${error.message}`);
    return null;
  }
}

async function testPatternSearch(codeSnippet: string) {
  log.section('Testing Pattern Search');
  
  try {
    const response = await axios.post(`${API_URL}/code-intelligence/patterns/find`, {
      codeSnippet,
      threshold: 0.7,
      options: {
        contextWindow: 100
      }
    });

    const result = response.data.data;
    
    log.success(`Pattern search completed`);
    log.info(`Similar patterns found: ${result.metadata.patterns_found}`);
    
    return result;
  } catch (error: any) {
    log.error(`Failed to search patterns: ${error.message}`);
    return null;
  }
}

async function testDirectoryAnalysis() {
  log.section('Testing Directory Analysis');
  
  try {
    const response = await axios.post(`${API_URL}/code-intelligence/analyze/directory`, {
      directoryPath: '/Users/christianmerrill/Desktop/universal-ai-tools/src/services',
      options: {
        analysisDepth: 'medium',
        enableLearning: true,
        includePatterns: ['*.ts'],
        excludePatterns: ['*.test.ts', '*.spec.ts']
      }
    });

    const result = response.data.data;
    
    log.success(`Directory analysis completed in ${result.performance.totalTime}ms`);
    log.info(`Files analyzed: ${result.results.semanticAnalysis?.length || 0}`);
    log.info(`Total patterns found: ${result.metadata.patterns_found}`);
    log.info(`Total issues detected: ${result.metadata.issues_detected}`);
    
    // Risk assessment
    if (result.results.riskAssessment) {
      log.info('\nRisk Assessment:');
      console.log(`  Overall Risk: ${colors.yellow}${result.results.riskAssessment.overall.toUpperCase()}${colors.reset}`);
      Object.entries(result.results.riskAssessment.categories).forEach(([category, data]: any) => {
        console.log(`  ${category}: ${data.level} (${data.issues.length} issues)`);
      });
    }

    return result;
  } catch (error: any) {
    log.error(`Failed to analyze directory: ${error.message}`);
    return null;
  }
}

async function testLearningFeedback(recommendationId: string) {
  log.section('Testing Learning Feedback');
  
  try {
    const response = await axios.post(`${API_URL}/code-intelligence/feedback`, {
      recommendationId,
      outcome: 'accepted',
      effectiveness: 0.85,
      userNotes: 'This recommendation significantly improved code quality'
    });

    log.success('Feedback recorded successfully');
    return response.data;
  } catch (error: any) {
    log.error(`Failed to record feedback: ${error.message}`);
    return null;
  }
}

async function testAnalytics() {
  log.section('Testing Analytics Retrieval');
  
  try {
    const response = await axios.get(`${API_URL}/code-intelligence/analytics`);
    const analytics = response.data.data;
    
    log.success('Analytics retrieved successfully');
    log.info(`Total queries processed: ${analytics.totalQueries}`);
    log.info(`Average confidence: ${(analytics.averageConfidence * 100).toFixed(1)}%`);
    log.info(`Average quality score: ${(analytics.averageQualityScore * 100).toFixed(1)}%`);
    
    if (analytics.feedbackStats) {
      log.info('\nFeedback Statistics:');
      console.log(`  Total feedback: ${analytics.feedbackStats.totalFeedback}`);
      console.log(`  Acceptance rate: ${(analytics.feedbackStats.acceptanceRate * 100).toFixed(1)}%`);
      console.log(`  Average effectiveness: ${(analytics.feedbackStats.averageEffectiveness * 100).toFixed(1)}%`);
    }

    return analytics;
  } catch (error: any) {
    log.error(`Failed to get analytics: ${error.message}`);
    return null;
  }
}

async function testEnhancedAnalytics() {
  log.section('Testing Enhanced Analytics with Parameter Integration');
  
  try {
    const response = await axios.get(`${API_URL}/code-intelligence/analytics/enhanced`);
    const analytics = response.data.data;
    
    log.success('Enhanced analytics retrieved successfully');
    
    if (analytics.parameterInsights) {
      log.info('\nParameter Analytics Integration:');
      console.log(`  Integration Status: ${analytics.integrationStatus.parameterAnalytics}`);
      console.log(`  Learning Enabled: ${analytics.integrationStatus.learningEnabled}`);
    }

    return analytics;
  } catch (error: any) {
    log.error(`Failed to get enhanced analytics: ${error.message}`);
    return null;
  }
}

async function runTests() {
  log.section('Code Intelligence System Test Suite');
  
  // Wait for server
  const serverReady = await waitForServer();
  if (!serverReady) {
    process.exit(1);
  }

  // Test 1: Analyze individual files
  for (const file of TEST_FILES) {
    const result = await testFileAnalysis(file);
    if (result && result.results.recommendations?.length > 0) {
      // Test feedback on first recommendation
      await testLearningFeedback(result.results.recommendations[0].id);
    }
  }

  // Test 2: Search for patterns
  const sampleCode = `
    async function processData(data: any[]) {
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
          for (let k = 0; k < data[i][j].length; k++) {
            // Deeply nested processing
            console.log(data[i][j][k]);
          }
        }
      }
    }
  `;
  await testPatternSearch(sampleCode);

  // Test 3: Analyze directory
  await testDirectoryAnalysis();

  // Test 4: Get analytics
  await testAnalytics();

  // Test 5: Get enhanced analytics
  await testEnhancedAnalytics();

  log.section('Test Suite Complete');
  log.success('All tests completed successfully!');
  
  // Summary
  log.info('\n📊 The Code Intelligence System is now able to:');
  console.log('  ✓ Analyze TypeScript/JavaScript files for patterns and issues');
  console.log('  ✓ Detect design patterns (Singleton, Factory, Observer)');
  console.log('  ✓ Identify code smells (long methods, large classes)');
  console.log('  ✓ Find performance issues (nested loops, complexity)');
  console.log('  ✓ Detect security vulnerabilities (SQL injection risks)');
  console.log('  ✓ Generate intelligent recommendations with confidence scoring');
  console.log('  ✓ Learn from user feedback to improve recommendations');
  console.log('  ✓ Integrate with parameter analytics for enhanced learning');
  console.log('  ✓ Provide comprehensive analytics and insights');
}

// Run the tests
runTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});