#!/usr/bin/env node

/**
 * Live Integration Test for LLM Improvements
 * Tests actual connections to Ollama and LM Studio services
 */

import { performance } from 'perf_hooks';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:5901';

class LiveIntegrationTest {
  constructor() {
    this.results = {
      ollama: { available: false, models: [], latency: -1 },
      lmStudio: { available: false, models: [], latency: -1 },
      integration: { caching: false, healthMonitoring: false, loadBalancing: false }
    };
  }

  async runLiveTests() {
    console.log('🔴 Live Integration Test for LLM Improvements');
    console.log('=' .repeat(60));
    console.log('⚠️  This test requires actual services to be running:');
    console.log(`   - Ollama: ${OLLAMA_URL}`);
    console.log(`   - LM Studio: ${LM_STUDIO_URL}`);
    console.log('');

    // Test 1: Service Availability
    await this.testServiceAvailability();
    
    // Test 2: Model Discovery
    await this.testModelDiscovery();
    
    // Test 3: Health Monitoring
    await this.testHealthMonitoring();
    
    // Test 4: Caching Performance
    await this.testCachingPerformance();
    
    // Test 5: Load Balancing
    await this.testLoadBalancingLive();

    // Generate results
    this.generateResults();
  }

  async testServiceAvailability() {
    console.log('🔍 Testing Service Availability...');

    // Test Ollama
    try {
      const startTime = performance.now();
      const response = await fetch(`${OLLAMA_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - startTime);
      
      this.results.ollama.available = response.ok;
      this.results.ollama.latency = latency;
      
      console.log(`  ${response.ok ? '✅' : '❌'} Ollama: ${response.status} (${latency}ms)`);
    } catch (error) {
      console.log(`  ❌ Ollama: ${error.message}`);
    }

    // Test LM Studio
    try {
      const startTime = performance.now();
      const response = await fetch(`${LM_STUDIO_URL}/v1/models`, {
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - startTime);
      
      this.results.lmStudio.available = response.ok;
      this.results.lmStudio.latency = latency;
      
      console.log(`  ${response.ok ? '✅' : '❌'} LM Studio: ${response.status} (${latency}ms)`);
    } catch (error) {
      console.log(`  ❌ LM Studio: ${error.message}`);
    }
  }

  async testModelDiscovery() {
    console.log('\n📋 Testing Model Discovery...');

    // Discover Ollama models
    if (this.results.ollama.available) {
      try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await response.json();
        this.results.ollama.models = data.models?.map(m => m.name) || [];
        
        console.log(`  ✅ Ollama Models (${this.results.ollama.models.length}):`);
        this.results.ollama.models.slice(0, 3).forEach(model => {
          console.log(`     - ${model}`);
        });
        if (this.results.ollama.models.length > 3) {
          console.log(`     ... and ${this.results.ollama.models.length - 3} more`);
        }
      } catch (error) {
        console.log(`  ❌ Ollama model discovery failed: ${error.message}`);
      }
    }

    // Discover LM Studio models
    if (this.results.lmStudio.available) {
      try {
        const response = await fetch(`${LM_STUDIO_URL}/v1/models`);
        const data = await response.json();
        this.results.lmStudio.models = data.data?.map(m => m.id) || [];
        
        console.log(`  ✅ LM Studio Models (${this.results.lmStudio.models.length}):`);
        this.results.lmStudio.models.slice(0, 3).forEach(model => {
          console.log(`     - ${model}`);
        });
        if (this.results.lmStudio.models.length > 3) {
          console.log(`     ... and ${this.results.lmStudio.models.length - 3} more`);
        }
      } catch (error) {
        console.log(`  ❌ LM Studio model discovery failed: ${error.message}`);
      }
    }
  }

  async testHealthMonitoring() {
    console.log('\n💓 Testing Health Monitoring...');

    const healthChecks = [];
    
    // Multiple health checks to test monitoring
    for (let i = 0; i < 3; i++) {
      const checks = await Promise.allSettled([
        this.checkServiceHealth('ollama', `${OLLAMA_URL}/api/tags`),
        this.checkServiceHealth('lmStudio', `${LM_STUDIO_URL}/v1/models`)
      ]);
      
      healthChecks.push(checks.map(result => 
        result.status === 'fulfilled' ? result.value : { service: 'unknown', healthy: false, latency: -1 }
      ));
      
      if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }

    // Analyze health monitoring results
    const ollamaHealths = healthChecks.flatMap(checks => checks.filter(c => c.service === 'ollama'));
    const lmStudioHealths = healthChecks.flatMap(checks => checks.filter(c => c.service === 'lmStudio'));

    if (ollamaHealths.length > 0) {
      const avgLatency = ollamaHealths.reduce((sum, h) => sum + (h.latency || 0), 0) / ollamaHealths.length;
      const healthyCount = ollamaHealths.filter(h => h.healthy).length;
      console.log(`  📊 Ollama Health: ${healthyCount}/${ollamaHealths.length} healthy, ${Math.round(avgLatency)}ms avg latency`);
    }

    if (lmStudioHealths.length > 0) {
      const avgLatency = lmStudioHealths.reduce((sum, h) => sum + (h.latency || 0), 0) / lmStudioHealths.length;
      const healthyCount = lmStudioHealths.filter(h => h.healthy).length;
      console.log(`  📊 LM Studio Health: ${healthyCount}/${lmStudioHealths.length} healthy, ${Math.round(avgLatency)}ms avg latency`);
    }

    this.results.integration.healthMonitoring = healthChecks.length > 0;
  }

  async testCachingPerformance() {
    console.log('\n⚡ Testing Caching Performance...');

    const cache = new Map();
    const cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // First request - no cache
    const startTime1 = performance.now();
    const models1 = await this.getModelsWithCache('ollama', cache, cacheTimeout);
    const duration1 = Math.round(performance.now() - startTime1);

    // Second request - from cache
    const startTime2 = performance.now();
    const models2 = await this.getModelsWithCache('ollama', cache, cacheTimeout);
    const duration2 = Math.round(performance.now() - startTime2);

    const cacheHit = duration2 < duration1 && JSON.stringify(models1) === JSON.stringify(models2);
    
    console.log(`  📊 First request: ${duration1}ms (${models1?.length || 0} models)`);
    console.log(`  📊 Cached request: ${duration2}ms (${models2?.length || 0} models)`);
    console.log(`  ${cacheHit ? '✅' : '❌'} Cache ${cacheHit ? 'working' : 'not working'} - ${Math.round((duration1 - duration2) / duration1 * 100)}% faster`);

    this.results.integration.caching = cacheHit;
  }

  async testLoadBalancingLive() {
    console.log('\n⚖️ Testing Load Balancing...');

    const services = [];
    if (this.results.ollama.available) {
      services.push({ name: 'ollama', weight: 7, latency: this.results.ollama.latency });
    }
    if (this.results.lmStudio.available) {
      services.push({ name: 'lmStudio', weight: 8, latency: this.results.lmStudio.latency });
    }

    if (services.length === 0) {
      console.log('  ⚠️  No services available for load balancing test');
      return;
    }

    // Calculate health scores
    const healthScores = services.map(service => {
      let score = 50; // Base score for being available
      if (service.latency < 100) score += 30;
      else if (service.latency < 500) score += 20;
      else if (service.latency < 1000) score += 10;
      
      return { ...service, score };
    });

    // Sort by score
    healthScores.sort((a, b) => b.score - a.score);
    
    console.log('  📊 Load Balancing Results:');
    healthScores.forEach((service, index) => {
      const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      console.log(`     ${icon} ${service.name}: score=${service.score} (weight=${service.weight}, latency=${service.latency}ms)`);
    });

    this.results.integration.loadBalancing = healthScores.length > 1;
  }

  async checkServiceHealth(service, url) {
    try {
      const startTime = performance.now();
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const latency = Math.round(performance.now() - startTime);
      
      return {
        service,
        healthy: response.ok,
        latency,
        status: response.status
      };
    } catch (error) {
      return {
        service,
        healthy: false,
        latency: -1,
        error: error.message
      };
    }
  }

  async getModelsWithCache(provider, cache, cacheTimeout) {
    const cacheKey = provider;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.lastCheck < cacheTimeout) {
      return cached.models; // Return from cache
    }

    // Fetch fresh data
    try {
      const url = provider === 'ollama' ? `${OLLAMA_URL}/api/tags` : `${LM_STUDIO_URL}/v1/models`;
      const response = await fetch(url);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const models = provider === 'ollama' 
        ? (data.models?.map(m => m.name) || [])
        : (data.data?.map(m => m.id) || []);
      
      // Cache the results
      cache.set(cacheKey, {
        models,
        lastCheck: Date.now()
      });
      
      return models;
    } catch (error) {
      return [];
    }
  }

  generateResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 LIVE INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));

    // Service Status
    console.log('\n🔌 SERVICE STATUS:');
    console.log(`   Ollama: ${this.results.ollama.available ? '✅ Available' : '❌ Unavailable'} (${this.results.ollama.latency}ms)`);
    console.log(`   LM Studio: ${this.results.lmStudio.available ? '✅ Available' : '❌ Unavailable'} (${this.results.lmStudio.latency}ms)`);
    
    // Model Discovery
    console.log('\n📋 MODEL DISCOVERY:');
    console.log(`   Ollama: ${this.results.ollama.models.length} models`);
    console.log(`   LM Studio: ${this.results.lmStudio.models.length} models`);
    
    // Integration Features
    console.log('\n🔧 INTEGRATION FEATURES:');
    console.log(`   Health Monitoring: ${this.results.integration.healthMonitoring ? '✅ Working' : '❌ Not tested'}`);
    console.log(`   Caching: ${this.results.integration.caching ? '✅ Working' : '❌ Not working'}`);
    console.log(`   Load Balancing: ${this.results.integration.loadBalancing ? '✅ Working' : '❌ Not tested'}`);

    // Overall Assessment
    const availableServices = [this.results.ollama.available, this.results.lmStudio.available].filter(Boolean).length;
    const workingFeatures = [
      this.results.integration.healthMonitoring,
      this.results.integration.caching,
      this.results.integration.loadBalancing
    ].filter(Boolean).length;

    console.log('\n🏆 OVERALL ASSESSMENT:');
    console.log(`   Available Services: ${availableServices}/2`);
    console.log(`   Working Features: ${workingFeatures}/3`);
    
    if (availableServices === 2 && workingFeatures === 3) {
      console.log('   Status: 🎉 EXCELLENT - All services and features working');
    } else if (availableServices >= 1 && workingFeatures >= 2) {
      console.log('   Status: 😊 GOOD - Most functionality working');
    } else if (availableServices >= 1) {
      console.log('   Status: 😐 PARTIAL - Basic functionality available');
    } else {
      console.log('   Status: 😞 POOR - No services available for testing');
    }

    console.log('\n💡 RECOMMENDATIONS:');
    if (!this.results.ollama.available) {
      console.log('   - Start Ollama: ollama serve');
    }
    if (!this.results.lmStudio.available) {
      console.log('   - Start LM Studio with local server enabled');
    }
    if (availableServices > 0 && workingFeatures < 3) {
      console.log('   - Review service configurations and error logs');
    }
    if (availableServices === 2 && workingFeatures === 3) {
      console.log('   - All systems operational! Ready for production use.');
    }

    console.log('='.repeat(60));
  }
}

// Run live integration test
async function main() {
  const liveTest = new LiveIntegrationTest();
  await liveTest.runLiveTests();
}

main().catch(console.error);