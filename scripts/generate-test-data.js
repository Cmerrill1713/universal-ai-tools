#!/usr/bin/env node

/**
 * Test Data Generator for Monitoring Validation
 * Generates synthetic telemetry data for testing monitoring systems
 */

import axios from 'axios';
import { randomBytes } from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:9999';
const DURATION_MINUTES = parseInt(process.env.DURATION_MINUTES) || 5;
const REQUESTS_PER_MINUTE = parseInt(process.env.REQUESTS_PER_MINUTE) || 60;

// Test data generators
const ENDPOINTS = [
  '/api/health',
  '/api/memory/query',
  '/api/memory/store',
  '/api/llm/chat',
  '/api/sweet-athena/interact',
  '/api/speech/synthesize',
  '/metrics'
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
];

const SWEET_ATHENA_INTERACTIONS = [
  'greeting', 'question', 'compliment', 'joke', 'advice', 'goodbye'
];

const PERSONALITY_MOODS = [
  'sweet', 'playful', 'caring', 'energetic', 'calm', 'cheerful'
];

let requestCount = 0;
let errorCount = 0;
let traceIds = [];
let spanIds = [];

class TestDataGenerator {
  constructor() {
    this.startTime = Date.now();
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimes: [],
      endpoints: {},
      traces: [],
      metrics: []
    };
  }

  // Generate random user ID
  generateUserId() {
    return `user_${randomBytes(4).toString('hex')}`;
  }

  // Generate random session ID
  generateSessionId() {
    return `session_${randomBytes(6).toString('hex')}`;
  }

  // Generate random trace ID
  generateTraceId() {
    return randomBytes(16).toString('hex');
  }

  // Generate random span ID
  generateSpanId() {
    return randomBytes(8).toString('hex');
  }

  // Generate request headers with tracing context
  generateHeaders() {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    traceIds.push(traceId);
    spanIds.push(spanId);

    return {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'X-Trace-Id': traceId,
      'X-Span-Id': spanId,
      'traceparent': `00-${traceId}-${spanId}-01`,
      'Content-Type': 'application/json'
    };
  }

  // Generate Sweet Athena interaction data
  generateAthenaInteraction() {
    return {
      message: `Test interaction ${requestCount}`,
      userId: this.generateUserId(),
      sessionId: this.generateSessionId(),
      interactionType: SWEET_ATHENA_INTERACTIONS[Math.floor(Math.random() * SWEET_ATHENA_INTERACTIONS.length)],
      personalityMood: PERSONALITY_MOODS[Math.floor(Math.random() * PERSONALITY_MOODS.length)],
      sweetnessLevel: Math.floor(Math.random() * 10) + 1,
      timestamp: new Date().toISOString()
    };
  }

  // Generate memory operation data
  generateMemoryOperation() {
    return {
      query: `Test query ${requestCount}`,
      memoryType: Math.random() > 0.5 ? 'episodic' : 'semantic',
      userId: this.generateUserId(),
      context: {
        sessionId: this.generateSessionId(),
        timestamp: new Date().toISOString()
      }
    };
  }

  // Generate LLM chat data
  generateLLMChat() {
    return {
      message: `Test message ${requestCount}`,
      model: Math.random() > 0.5 ? 'gpt-4' : 'claude-3',
      userId: this.generateUserId(),
      sessionId: this.generateSessionId(),
      temperature: Math.random() * 1.0,
      maxTokens: Math.floor(Math.random() * 2000) + 100
    };
  }

  // Make HTTP request with error simulation
  async makeRequest(endpoint, data = null) {
    const startTime = Date.now();
    const headers = this.generateHeaders();
    
    try {
      let response;
      
      // Simulate different HTTP methods
      if (data && (endpoint.includes('interact') || endpoint.includes('chat') || endpoint.includes('store'))) {
        response = await axios.post(`${BASE_URL}${endpoint}`, data, { 
          headers,
          timeout: 30000,
          validateStatus: () => true // Accept all status codes
        });
      } else {
        response = await axios.get(`${BASE_URL}${endpoint}`, { 
          headers,
          timeout: 30000,
          validateStatus: () => true
        });
      }
      
      const responseTime = Date.now() - startTime;
      this.results.responseTimes.push(responseTime);
      
      // Track endpoint statistics
      if (!this.results.endpoints[endpoint]) {
        this.results.endpoints[endpoint] = {
          requests: 0,
          success: 0,
          errors: 0,
          avgResponseTime: 0
        };
      }
      
      this.results.endpoints[endpoint].requests++;
      
      if (response.status >= 200 && response.status < 400) {
        this.results.successfulRequests++;
        this.results.endpoints[endpoint].success++;
      } else {
        this.results.failedRequests++;
        this.results.endpoints[endpoint].errors++;
        errorCount++;
      }
      
      this.results.totalRequests++;
      requestCount++;

      console.log(`[${new Date().toISOString()}] ${response.status} ${endpoint} (${responseTime}ms)`);
      
      return {
        status: response.status,
        responseTime,
        endpoint,
        traceId: headers['X-Trace-Id'],
        spanId: headers['X-Span-Id']
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.failedRequests++;
      this.results.totalRequests++;
      errorCount++;
      requestCount++;

      if (!this.results.endpoints[endpoint]) {
        this.results.endpoints[endpoint] = {
          requests: 0,
          success: 0,
          errors: 0,
          avgResponseTime: 0
        };
      }
      
      this.results.endpoints[endpoint].requests++;
      this.results.endpoints[endpoint].errors++;

      console.error(`[${new Date().toISOString()}] ERROR ${endpoint} (${responseTime}ms): ${error.message}`);
      
      return {
        status: 500,
        responseTime,
        endpoint,
        error: error.message,
        traceId: headers['X-Trace-Id'],
        spanId: headers['X-Span-Id']
      };
    }
  }

  // Generate traffic pattern
  async generateTraffic() {
    const requests = [];
    
    // Generate burst of requests
    for (let i = 0; i < Math.floor(REQUESTS_PER_MINUTE / 4); i++) {
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
      let data = null;
      
      // Generate appropriate payload for POST endpoints
      if (endpoint.includes('sweet-athena/interact')) {
        data = this.generateAthenaInteraction();
      } else if (endpoint.includes('memory/store') || endpoint.includes('memory/query')) {
        data = this.generateMemoryOperation();
      } else if (endpoint.includes('llm/chat')) {
        data = this.generateLLMChat();
      }
      
      requests.push(this.makeRequest(endpoint, data));
    }
    
    // Wait for all requests to complete
    const results = await Promise.allSettled(requests);
    
    return results.map(result => result.status === 'fulfilled' ? result.value : null).filter(Boolean);
  }

  // Start continuous data generation
  async start() {
    console.log(`Starting test data generation for ${DURATION_MINUTES} minutes...`);
    console.log(`Target: ${REQUESTS_PER_MINUTE} requests per minute`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log('');

    const endTime = this.startTime + (DURATION_MINUTES * 60 * 1000);
    const intervalMs = Math.floor(60000 / (REQUESTS_PER_MINUTE / 4)); // Distribute requests evenly

    const interval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        await this.finish();
        return;
      }
      
      await this.generateTraffic();
    }, intervalMs);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      clearInterval(interval);
      await this.finish();
      process.exit(0);
    });
  }

  // Calculate final results
  async finish() {
    console.log('\n=== Test Data Generation Complete ===');
    
    // Calculate averages
    this.results.averageResponseTime = this.results.responseTimes.length > 0 
      ? this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length 
      : 0;

    // Calculate endpoint statistics
    Object.keys(this.results.endpoints).forEach(endpoint => {
      const stats = this.results.endpoints[endpoint];
      const responseTimes = this.results.responseTimes.filter((_, index) => 
        index % ENDPOINTS.length === ENDPOINTS.indexOf(endpoint)
      );
      stats.avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;
    });

    // Print summary
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests}`);
    console.log(`Failed: ${this.results.failedRequests}`);
    console.log(`Average Response Time: ${this.results.averageResponseTime.toFixed(2)}ms`);
    console.log(`Generated Traces: ${traceIds.length}`);
    console.log(`Success Rate: ${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%`);
    
    console.log('\nEndpoint Statistics:');
    Object.entries(this.results.endpoints).forEach(([endpoint, stats]) => {
      console.log(`  ${endpoint}:`);
      console.log(`    Requests: ${stats.requests}`);
      console.log(`    Success: ${stats.success}`);
      console.log(`    Errors: ${stats.errors}`);
      console.log(`    Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
    });

    // Save results to file
    const resultsFile = `test-results-${Date.now()}.json`;
    await import('fs').then(fs => {
      fs.writeFileSync(resultsFile, JSON.stringify({
        ...this.results,
        traceIds: traceIds.slice(0, 100), // Limit trace IDs in output
        spanIds: spanIds.slice(0, 100),
        testDuration: DURATION_MINUTES,
        targetRpm: REQUESTS_PER_MINUTE,
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log(`\nResults saved to: ${resultsFile}`);
    });

    console.log('\n=== Monitoring Validation Data Generated ===');
  }
}

// Start the test data generator
const generator = new TestDataGenerator();
generator.start().catch(console.error);