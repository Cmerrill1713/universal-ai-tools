/**
 * Vision Service - Functional Test & Benchmark Suite
 * Tests standard vision analysis endpoints with available models
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import { createReadStream } from 'fs';

// Test configuration
const BASE_URL = 'http://localhost:8080';
const VISION_API = `${BASE_URL}/api/v1/vision`;
const CHAT_API = `${BASE_URL}/api/v1/chat`;

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test images
const TEST_IMAGES = {
  simple: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400', // Cat photo
  complex: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800', // Gym scene
  text: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', // Face with text
  nature: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' // Mountain landscape
};

// Test prompts
const TEST_PROMPTS = {
  simple: 'What is in this image?',
  detailed: 'Provide a comprehensive analysis of this image including objects, colors, composition, mood, and any notable details.',
  reasoning: 'Analyze this image and explain what activity is happening, why it might be happening, and what we can infer about the context.',
  counting: 'Count all visible objects in this image and list them by category.'
};

// Performance metrics storage
interface PerformanceMetrics {
  endpoint: string;
  testType: string;
  model?: string;
  responseTime: number;
  tokensGenerated?: number;
  success: boolean;
  error?: string;
  responseLength?: number;
}

const performanceResults: PerformanceMetrics[] = [];

// Utility functions
function log(message: string, type: 'info' | 'success' | 'error' | 'warning' | 'test' = 'info') {
  const typeColors = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    test: colors.magenta
  };
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors.bright}[${timestamp}]${colors.reset} ${typeColors[type]}${message}${colors.reset}`);
}

async function measurePerformance<T>(
  fn: () => Promise<T>,
  label: string
): Promise<{ result: T; time: number }> {
  const start = Date.now();
  const result = await fn();
  const time = Date.now() - start;
  return { result, time };
}

// Test functions
async function testServerHealth(): Promise<void> {
  log('Testing server health...', 'test');
  
  try {
    const { result: response, time } = await measurePerformance(
      () => fetch(`${BASE_URL}/health`),
      'Server Health'
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/health',
      testType: 'server_health',
      responseTime: time,
      success: response.ok
    });
    
    if (response.ok) {
      log(`✅ Server health check passed in ${time}ms`, 'success');
      log(`  Status: ${data.status}`, 'info');
      log(`  Services: ${JSON.stringify(data.services)}`, 'info');
    } else {
      log(`❌ Server health check failed`, 'error');
    }
  } catch (error) {
    log(`❌ Server health error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/health',
      testType: 'server_health',
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function testVisionHealth(): Promise<void> {
  log('Testing vision service health...', 'test');
  
  try {
    const { result: response, time } = await measurePerformance(
      () => fetch(`${VISION_API}/health`),
      'Vision Health'
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/api/v1/vision/health',
      testType: 'vision_health',
      responseTime: time,
      success: response.ok
    });
    
    if (response.ok) {
      log(`✅ Vision health check passed in ${time}ms`, 'success');
      log(`  Status: ${data.status}`, 'info');
      if (data.availableModels) {
        log(`  Available models: ${data.availableModels.join(', ')}`, 'info');
      }
    } else {
      log(`❌ Vision health check failed: ${data.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Vision health error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/api/v1/vision/health',
      testType: 'vision_health',
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function testVisionAnalyze(
  imageUrl: string,
  prompt: string,
  model: string,
  label: string
): Promise<void> {
  log(`Testing vision analysis (${model}): ${label}...`, 'test');
  
  try {
    const requestBody = {
      image: imageUrl,
      prompt,
      model,
      maxTokens: 1024
    };
    
    const { result: response, time } = await measurePerformance(
      () => fetch(`${VISION_API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }),
      `Vision Analysis - ${model}`
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/api/v1/vision/analyze',
      testType: `vision_${model}`,
      model,
      responseTime: time,
      success: response.ok,
      responseLength: data.data?.text?.length || 0
    });
    
    if (response.ok && data.success) {
      log(`✅ ${label} completed in ${time}ms`, 'success');
      log(`  Model: ${model}`, 'info');
      log(`  Response length: ${data.data.text.length} chars`, 'info');
      log(`  Preview: ${data.data.text.substring(0, 100)}...`, 'info');
    } else {
      log(`❌ ${label} failed: ${data.message || data.error}`, 'error');
    }
  } catch (error) {
    log(`❌ ${label} error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/api/v1/vision/analyze',
      testType: `vision_${model}`,
      model,
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function testChatWithVision(
  imageUrl: string,
  prompt: string,
  model: string,
  label: string
): Promise<void> {
  log(`Testing chat with vision (${model}): ${label}...`, 'test');
  
  try {
    const requestBody = {
      message: prompt,
      model,
      images: [imageUrl],
      maxTokens: 1024,
      temperature: 0.3
    };
    
    const { result: response, time } = await measurePerformance(
      () => fetch(`${CHAT_API}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }),
      `Chat Vision - ${model}`
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/api/v1/chat/completions',
      testType: `chat_vision_${model}`,
      model,
      responseTime: time,
      success: response.ok,
      responseLength: data.data?.response?.length || 0,
      tokensGenerated: data.data?.usage?.totalTokens
    });
    
    if (response.ok && data.success) {
      log(`✅ ${label} completed in ${time}ms`, 'success');
      log(`  Model: ${model}`, 'info');
      log(`  Tokens used: ${data.data.usage?.totalTokens || 'unknown'}`, 'info');
      log(`  Response preview: ${data.data.response.substring(0, 100)}...`, 'info');
    } else {
      log(`❌ ${label} failed: ${data.message || data.error}`, 'error');
    }
  } catch (error) {
    log(`❌ ${label} error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/api/v1/chat/completions',
      testType: `chat_vision_${model}`,
      model,
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function runBenchmark(): Promise<void> {
  log('🚀 Starting Vision Service Benchmark Suite', 'info');
  log('=' . repeat(60), 'info');
  
  // Test server health
  await testServerHealth();
  await new Promise(r => setTimeout(r, 500));
  
  // Test vision service health
  await testVisionHealth();
  await new Promise(r => setTimeout(r, 1000));
  
  // Available vision models
  const visionModels = ['llava:13b', 'llama3.2-vision:latest'];
  
  // Test cases for vision endpoint
  log('\n📸 Testing Vision Analyze Endpoint', 'info');
  log('-' . repeat(40), 'info');
  
  for (const model of visionModels) {
    // Check if model exists first
    try {
      const checkResponse = await fetch('http://localhost:11434/api/tags');
      const tags = await checkResponse.json();
      const modelExists = tags.models?.some((m: any) => m.name === model);
      
      if (!modelExists) {
        log(`⚠️ Model ${model} not installed, skipping`, 'warning');
        continue;
      }
    } catch (error) {
      log(`⚠️ Could not check if ${model} exists, trying anyway`, 'warning');
    }
    
    await testVisionAnalyze(
      TEST_IMAGES.simple,
      TEST_PROMPTS.simple,
      model,
      `${model} - Simple Analysis`
    );
    await new Promise(r => setTimeout(r, 2000));
    
    await testVisionAnalyze(
      TEST_IMAGES.complex,
      TEST_PROMPTS.detailed,
      model,
      `${model} - Detailed Analysis`
    );
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Test chat with vision
  log('\n💬 Testing Chat with Vision', 'info');
  log('-' . repeat(40), 'info');
  
  for (const model of visionModels) {
    await testChatWithVision(
      TEST_IMAGES.nature,
      TEST_PROMPTS.reasoning,
      model,
      `${model} - Chat Vision Analysis`
    );
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Generate performance report
  generatePerformanceReport();
}

function generatePerformanceReport(): void {
  log('\n' + '=' . repeat(60), 'info');
  log('📊 Performance Benchmark Report', 'info');
  log('=' . repeat(60), 'info');
  
  // Group results by endpoint
  const byEndpoint = performanceResults.reduce((acc, result) => {
    if (!acc[result.endpoint]) acc[result.endpoint] = [];
    acc[result.endpoint].push(result);
    return acc;
  }, {} as Record<string, PerformanceMetrics[]>);
  
  // Calculate statistics for each endpoint
  Object.entries(byEndpoint).forEach(([endpoint, results]) => {
    log(`\n${colors.bright}Endpoint: ${endpoint}${colors.reset}`, 'info');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      const avgTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
      const minTime = Math.min(...successful.map(r => r.responseTime));
      const maxTime = Math.max(...successful.map(r => r.responseTime));
      
      log(`  ✅ Success rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`, 'success');
      log(`  ⏱️  Avg response time: ${avgTime.toFixed(0)}ms`, 'info');
      log(`  ⏱️  Min/Max: ${minTime}ms / ${maxTime}ms`, 'info');
      
      // Token statistics if available
      const withTokens = successful.filter(r => r.tokensGenerated);
      if (withTokens.length > 0) {
        const avgTokens = withTokens.reduce((sum, r) => sum + (r.tokensGenerated || 0), 0) / withTokens.length;
        log(`  📝 Avg tokens generated: ${avgTokens.toFixed(0)}`, 'info');
      }
      
      // Response length statistics
      const withLength = successful.filter(r => r.responseLength);
      if (withLength.length > 0) {
        const avgLength = withLength.reduce((sum, r) => sum + (r.responseLength || 0), 0) / withLength.length;
        log(`  📄 Avg response length: ${avgLength.toFixed(0)} chars`, 'info');
      }
      
      // Model statistics
      const modelStats = successful.reduce((acc, r) => {
        if (r.model) {
          acc[r.model] = (acc[r.model] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      if (Object.keys(modelStats).length > 0) {
        log(`  🤖 Models tested:`, 'info');
        Object.entries(modelStats).forEach(([model, count]) => {
          const modelResults = successful.filter(r => r.model === model);
          const modelAvgTime = modelResults.reduce((sum, r) => sum + r.responseTime, 0) / modelResults.length;
          log(`     - ${model}: ${count} tests, avg ${modelAvgTime.toFixed(0)}ms`, 'info');
        });
      }
    }
    
    if (failed.length > 0) {
      log(`  ❌ Failures: ${failed.length}`, 'error');
      failed.forEach(f => {
        if (f.error) log(`     - ${f.testType}: ${f.error}`, 'error');
      });
    }
  });
  
  // Overall summary
  log('\n' + '=' . repeat(60), 'info');
  log('📈 Overall Summary', 'info');
  log('=' . repeat(60), 'info');
  
  const totalTests = performanceResults.length;
  const totalSuccess = performanceResults.filter(r => r.success).length;
  const totalTime = performanceResults.reduce((sum, r) => sum + r.responseTime, 0);
  const successfulTests = performanceResults.filter(r => r.success && r.responseTime > 0);
  const avgTime = successfulTests.length > 0 
    ? successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
    : 0;
  
  log(`Total tests run: ${totalTests}`, 'info');
  log(`Success rate: ${totalSuccess}/${totalTests} (${(totalSuccess/totalTests*100).toFixed(1)}%)`, 
    totalSuccess === totalTests ? 'success' : totalSuccess > 0 ? 'warning' : 'error');
  log(`Total time: ${(totalTime/1000).toFixed(2)}s`, 'info');
  if (avgTime > 0) {
    log(`Average response time: ${avgTime.toFixed(0)}ms`, 'info');
  }
  
  // Performance recommendations
  log('\n' + '=' . repeat(60), 'info');
  log('💡 Performance Insights', 'info');
  log('=' . repeat(60), 'info');
  
  if (successfulTests.length > 0) {
    const fastestTest = successfulTests.reduce((min, r) => r.responseTime < min.responseTime ? r : min);
    const slowestTest = successfulTests.reduce((max, r) => r.responseTime > max.responseTime ? r : max);
    
    log(`🏆 Fastest: ${fastestTest.testType} (${fastestTest.responseTime}ms)`, 'success');
    log(`🐢 Slowest: ${slowestTest.testType} (${slowestTest.responseTime}ms)`, 'warning');
    
    if (avgTime > 5000) {
      log(`⚠️ Average response time is high (${avgTime.toFixed(0)}ms)`, 'warning');
      log(`  Consider using smaller models or optimizing prompts`, 'info');
    } else if (avgTime < 2000) {
      log(`✨ Excellent average response time (${avgTime.toFixed(0)}ms)`, 'success');
    }
  }
  
  // Save detailed results to file
  const reportPath = `/tmp/vision-benchmark-${Date.now()}.json`;
  fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      successRate: totalTests > 0 ? totalSuccess / totalTests : 0,
      totalTimeMs: totalTime,
      avgResponseTimeMs: avgTime
    },
    results: performanceResults,
    recommendations: {
      optimizeModels: avgTime > 5000,
      installMoreModels: totalSuccess < totalTests * 0.5,
      performanceGrade: avgTime < 2000 ? 'A' : avgTime < 5000 ? 'B' : avgTime < 10000 ? 'C' : 'D'
    }
  }, null, 2)).then(() => {
    log(`\n📄 Detailed report saved to: ${reportPath}`, 'info');
  });
}

// Error handling
process.on('unhandledRejection', (error) => {
  log(`Unhandled rejection: ${error}`, 'error');
  process.exit(1);
});

// Run the benchmark
runBenchmark().catch(error => {
  log(`Fatal error: ${error}`, 'error');
  process.exit(1);
});