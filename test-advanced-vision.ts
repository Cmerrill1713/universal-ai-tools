/**
 * Advanced Vision Service - Functional Test & Benchmark Suite
 * Tests vision analysis endpoints with real models and measures performance
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import { createReadStream } from 'fs';

// Test configuration - using port 8081 from server logs
const BASE_URL = 'http://localhost:8081';
const VISION_API = `${BASE_URL}/api/v1/advanced-vision`;

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

// Test prompts for different analysis types
const TEST_PROMPTS = {
  simple: 'What is in this image?',
  detailed: 'Provide a comprehensive analysis of this image including objects, colors, composition, mood, and any notable details.',
  reasoning: 'Analyze this image and explain what activity is happening, why it might be happening, and what we can infer about the context.',
  counting: 'Count all visible objects in this image and list them by category.'
};

// Performance metrics storage
interface PerformanceMetrics {
  endpoint: string;
  analysisType: string;
  model?: string;
  responseTime: number;
  tokensGenerated?: number;
  success: boolean;
  error?: string;
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
async function testHealthEndpoint(): Promise<void> {
  log('Testing /health endpoint...', 'test');
  
  try {
    const { result: response, time } = await measurePerformance(
      () => fetch(`${VISION_API}/health`),
      'Health Check'
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/health',
      analysisType: 'health_check',
      responseTime: time,
      success: response.ok
    });
    
    if (response.ok && data.success) {
      log(`✅ Health check passed in ${time}ms`, 'success');
      log(`  Available models: ${JSON.stringify(data.data.availableModels)}`, 'info');
      log(`  Service healthy: ${data.data.healthy}`, 'info');
    } else {
      log(`❌ Health check failed: ${JSON.stringify(data)}`, 'error');
    }
  } catch (error) {
    log(`❌ Health check error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/health',
      analysisType: 'health_check',
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function testModelsEndpoint(): Promise<void> {
  log('Testing /models endpoint...', 'test');
  
  try {
    const { result: response, time } = await measurePerformance(
      () => fetch(`${VISION_API}/models`),
      'Models Info'
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/models',
      analysisType: 'models_info',
      responseTime: time,
      success: response.ok
    });
    
    if (response.ok && data.success) {
      log(`✅ Models endpoint passed in ${time}ms`, 'success');
      if (data.data.availableModels) {
        log(`  Available: ${data.data.availableModels.join(', ')}`, 'info');
      }
      if (data.data.recommendedModel) {
        log(`  Recommended: ${data.data.recommendedModel}`, 'info');
      }
    } else {
      log(`❌ Models endpoint failed: ${JSON.stringify(data)}`, 'error');
    }
  } catch (error) {
    log(`❌ Models endpoint error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/models',
      analysisType: 'models_info',
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function testUrlAnalysis(
  imageUrl: string,
  prompt: string,
  analysisType: 'fast' | 'balanced' | 'detailed' | 'expert',
  label: string
): Promise<void> {
  log(`Testing URL analysis (${analysisType}): ${label}...`, 'test');
  
  try {
    const requestBody = {
      imageUrl,
      prompt,
      analysisType,
      maxTokens: analysisType === 'detailed' ? 2048 : 1024,
      temperature: 0.3
    };
    
    const { result: response, time } = await measurePerformance(
      () => fetch(`${VISION_API}/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }),
      `URL Analysis - ${analysisType}`
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/analyze-url',
      analysisType,
      model: data.data?.modelUsed,
      responseTime: time,
      tokensGenerated: data.data?.metadata?.tokensGenerated,
      success: response.ok
    });
    
    if (response.ok && data.success) {
      log(`✅ ${label} completed in ${time}ms`, 'success');
      log(`  Model used: ${data.data.modelUsed || 'unknown'}`, 'info');
      log(`  Tokens generated: ${data.data.metadata?.tokensGenerated || 'unknown'}`, 'info');
      log(`  Response preview: ${data.data.text.substring(0, 100)}...`, 'info');
    } else {
      log(`❌ ${label} failed: ${data.message || data.error}`, 'error');
    }
  } catch (error) {
    log(`❌ ${label} error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/analyze-url',
      analysisType,
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function testFileUpload(): Promise<void> {
  log('Testing file upload analysis...', 'test');
  
  try {
    // Create a test image file
    const testImagePath = '/tmp/test-vision-image.jpg';
    const imageResponse = await fetch(TEST_IMAGES.simple);
    const imageBuffer = await imageResponse.buffer();
    await fs.writeFile(testImagePath, imageBuffer);
    
    // Prepare form data
    const form = new FormData();
    form.append('image', createReadStream(testImagePath));
    form.append('prompt', TEST_PROMPTS.simple);
    form.append('analysisType', 'balanced');
    form.append('maxTokens', '1024');
    
    const { result: response, time } = await measurePerformance(
      () => fetch(`${VISION_API}/analyze`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      }),
      'File Upload Analysis'
    );
    
    const data = await response.json();
    
    performanceResults.push({
      endpoint: '/analyze',
      analysisType: 'file_upload',
      model: data.data?.modelUsed,
      responseTime: time,
      tokensGenerated: data.data?.metadata?.tokensGenerated,
      success: response.ok
    });
    
    if (response.ok && data.success) {
      log(`✅ File upload analysis completed in ${time}ms`, 'success');
      log(`  Model used: ${data.data.modelUsed || 'unknown'}`, 'info');
      log(`  Response preview: ${data.data.text.substring(0, 100)}...`, 'info');
    } else {
      log(`❌ File upload failed: ${data.message || data.error}`, 'error');
    }
    
    // Cleanup
    await fs.unlink(testImagePath).catch(() => {});
  } catch (error) {
    log(`❌ File upload error: ${error}`, 'error');
    performanceResults.push({
      endpoint: '/analyze',
      analysisType: 'file_upload',
      responseTime: 0,
      success: false,
      error: String(error)
    });
  }
}

async function runBenchmark(): Promise<void> {
  log('🚀 Starting Advanced Vision Benchmark Suite', 'info');
  log('=' . repeat(60), 'info');
  
  // Test health and models endpoints
  await testHealthEndpoint();
  await new Promise(r => setTimeout(r, 1000));
  
  await testModelsEndpoint();
  await new Promise(r => setTimeout(r, 1000));
  
  // Test different analysis types with various images
  const testCases = [
    { image: TEST_IMAGES.simple, prompt: TEST_PROMPTS.simple, type: 'fast' as const, label: 'Fast Simple' },
    { image: TEST_IMAGES.simple, prompt: TEST_PROMPTS.detailed, type: 'balanced' as const, label: 'Balanced Detailed' },
    { image: TEST_IMAGES.complex, prompt: TEST_PROMPTS.reasoning, type: 'detailed' as const, label: 'Detailed Reasoning' },
    { image: TEST_IMAGES.nature, prompt: TEST_PROMPTS.counting, type: 'expert' as const, label: 'Expert Counting' }
  ];
  
  for (const testCase of testCases) {
    await testUrlAnalysis(
      testCase.image,
      testCase.prompt,
      testCase.type,
      testCase.label
    );
    await new Promise(r => setTimeout(r, 2000)); // Rate limiting
  }
  
  // Test file upload
  await testFileUpload();
  
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
      
      // Model usage statistics
      const modelUsage = successful.reduce((acc, r) => {
        if (r.model) {
          acc[r.model] = (acc[r.model] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      if (Object.keys(modelUsage).length > 0) {
        log(`  🤖 Models used:`, 'info');
        Object.entries(modelUsage).forEach(([model, count]) => {
          log(`     - ${model}: ${count} times`, 'info');
        });
      }
    }
    
    if (failed.length > 0) {
      log(`  ❌ Failures: ${failed.length}`, 'error');
      failed.forEach(f => {
        if (f.error) log(`     - ${f.analysisType}: ${f.error}`, 'error');
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
  
  log(`Total tests run: ${totalTests}`, 'info');
  log(`Success rate: ${totalSuccess}/${totalTests} (${(totalSuccess/totalTests*100).toFixed(1)}%)`, 
    totalSuccess === totalTests ? 'success' : 'warning');
  log(`Total time: ${(totalTime/1000).toFixed(2)}s`, 'info');
  log(`Average response time: ${(totalTime/totalTests).toFixed(0)}ms`, 'info');
  
  // Save detailed results to file
  const reportPath = `/tmp/vision-benchmark-${Date.now()}.json`;
  fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      successRate: totalSuccess / totalTests,
      totalTimeMs: totalTime,
      avgResponseTimeMs: totalTime / totalTests
    },
    results: performanceResults
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