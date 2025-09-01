#!/usr/bin/env tsx

/**
 * Enterprise ML Deployment Service Integration Test
 * 
 * Tests the complete ML deployment pipeline:
 * - Model registration
 * - Deployment creation
 * - A/B testing
 * - Health monitoring
 * - WebSocket real-time updates
 */

import axios from 'axios';
import WebSocket from 'ws';
import { setTimeout } from 'timers/promises';

const API_BASE = 'http://localhost:9999/api/v1/ml-deployment';
const WS_URL = 'ws://localhost:9999/ws/ml-deployment';

interface TestResults {
  modelRegistration: boolean;
  deploymentCreation: boolean;
  abTesting: boolean;
  healthMonitoring: boolean;
  webSocketConnection: boolean;
  overallSuccess: boolean;
}

class EnterpriseMLDeploymentTester {
  private results: TestResults = {
    modelRegistration: false,
    deploymentCreation: false,
    abTesting: false,
    healthMonitoring: false,
    webSocketConnection: false,
    overallSuccess: false,
  };

  private testModelId: string = '';
  private testDeploymentId: string = '';
  private testABTestId: string = '';

  async runAllTests(): Promise<TestResults> {
    console.log('🚀 Starting Enterprise ML Deployment Service Tests...\n');

    try {
      // Test server health first
      await this.checkServerHealth();
      
      // Run individual test suites
      await this.testModelRegistration();
      await this.testDeploymentCreation();
      await this.testABTesting();
      await this.testHealthMonitoring();
      await this.testWebSocketConnection();

      // Calculate overall success
      this.results.overallSuccess = Object.values(this.results)
        .filter(key => key !== 'overallSuccess')
        .every(result => result);

      this.printResults();
      return this.results;

    } catch (error) {
      console.error('❌ Test suite failed with error:', error);
      return this.results;
    }
  }

  private async checkServerHealth(): Promise<void> {
    try {
      console.log('🔍 Checking server health...');
      const response = await axios.get('http://localhost:9999/health');
      
      if (response.status === 200) {
        console.log('✅ Server is healthy and responding\n');
      } else {
        throw new Error(`Server health check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Server health check failed:', error.message);
      throw error;
    }
  }

  private async testModelRegistration(): Promise<void> {
    console.log('📝 Testing Model Registration...');
    
    try {
      const modelData = {
        name: 'test-llama-model',
        version: '1.0.0',
        description: 'Test model for enterprise deployment pipeline',
        framework: 'pytorch',
        runtime: 'python',
        modelPath: '/models/test-llama-3.2-3b',
        configPath: '/configs/test-model.json',
        requirements: ['torch>=1.13.0', 'transformers>=4.20.0'],
        resources: {
          cpu: 2,
          memory: '4GB',
          gpu: 1
        },
        metadata: {
          task: 'text-generation',
          language: 'multilingual',
          parameters: '3B'
        }
      };

      const response = await axios.post(`${API_BASE}/models/register`, modelData);
      
      if (response.status === 201 && response.data.success) {
        this.testModelId = response.data.data.modelId;
        this.results.modelRegistration = true;
        console.log('✅ Model registered successfully:', this.testModelId);
      } else {
        throw new Error('Model registration failed');
      }

      // Verify model retrieval
      const getResponse = await axios.get(`${API_BASE}/models/${this.testModelId}`);
      if (getResponse.status === 200 && getResponse.data.success) {
        console.log('✅ Model retrieval verified');
      }

    } catch (error) {
      console.error('❌ Model registration failed:', error.response?.data || error.message);
    }

    console.log('');
  }

  private async testDeploymentCreation(): Promise<void> {
    console.log('🚀 Testing Deployment Creation...');

    if (!this.testModelId) {
      console.error('❌ Cannot test deployment without registered model');
      return;
    }

    try {
      const deploymentData = {
        modelId: this.testModelId,
        name: 'test-deployment-production',
        environment: 'production',
        strategy: 'blue_green',
        replicas: 2,
        resources: {
          cpu: 4,
          memory: '8GB',
          gpu: 1
        },
        config: {
          maxTokens: 4096,
          temperature: 0.7,
          enableStreaming: true
        }
      };

      const response = await axios.post(`${API_BASE}/deployments`, deploymentData);
      
      if (response.status === 201 && response.data.success) {
        this.testDeploymentId = response.data.data.deploymentId;
        this.results.deploymentCreation = true;
        console.log('✅ Deployment created successfully:', this.testDeploymentId);
      } else {
        throw new Error('Deployment creation failed');
      }

      // Test deployment listing
      const listResponse = await axios.get(`${API_BASE}/deployments`);
      if (listResponse.status === 200 && listResponse.data.success) {
        console.log('✅ Deployment listing verified');
      }

      // Test deployment update
      const updateResponse = await axios.put(`${API_BASE}/deployments/${this.testDeploymentId}`, {
        replicas: 3,
        config: { temperature: 0.8 }
      });
      
      if (updateResponse.status === 200) {
        console.log('✅ Deployment update verified');
      }

    } catch (error) {
      console.error('❌ Deployment creation failed:', error.response?.data || error.message);
    }

    console.log('');
  }

  private async testABTesting(): Promise<void> {
    console.log('🧪 Testing A/B Testing Framework...');

    if (!this.testModelId) {
      console.error('❌ Cannot test A/B testing without registered model');
      return;
    }

    try {
      // Register a second model for comparison
      const experimentModelData = {
        name: 'test-llama-model-v2',
        version: '2.0.0',
        description: 'Experimental version for A/B testing',
        framework: 'pytorch',
        runtime: 'python',
        modelPath: '/models/test-llama-3.2-3b-fine-tuned',
        resources: { cpu: 2, memory: '4GB', gpu: 1 }
      };

      const modelResponse = await axios.post(`${API_BASE}/models/register`, experimentModelData);
      const experimentModelId = modelResponse.data.data.modelId;

      // Create A/B test
      const abTestData = {
        name: 'llama-model-comparison',
        description: 'Comparing base model vs fine-tuned version',
        controlModelId: this.testModelId,
        experimentModelId: experimentModelId,
        trafficSplit: 0.2, // 20% to experiment
        metrics: ['accuracy', 'latency', 'user_satisfaction'],
        duration: 24, // 24 hours
        config: {
          minimumSampleSize: 100,
          confidenceLevel: 0.95
        }
      };

      const response = await axios.post(`${API_BASE}/ab-tests`, abTestData);
      
      if (response.status === 201 && response.data.success) {
        this.testABTestId = response.data.data.testId;
        this.results.abTesting = true;
        console.log('✅ A/B test created successfully:', this.testABTestId);
      }

      // Test A/B test listing
      const listResponse = await axios.get(`${API_BASE}/ab-tests`);
      if (listResponse.status === 200 && listResponse.data.success) {
        console.log('✅ A/B test listing verified');
      }

    } catch (error) {
      console.error('❌ A/B testing failed:', error.response?.data || error.message);
    }

    console.log('');
  }

  private async testHealthMonitoring(): Promise<void> {
    console.log('🩺 Testing Health Monitoring...');

    if (!this.testDeploymentId) {
      console.error('❌ Cannot test health monitoring without deployment');
      return;
    }

    try {
      // Test health endpoint
      const healthResponse = await axios.get(`${API_BASE}/deployments/${this.testDeploymentId}/health`);
      
      if (healthResponse.status === 200 && healthResponse.data.success) {
        console.log('✅ Health monitoring endpoint working');
      }

      // Test metrics endpoint
      const metricsResponse = await axios.get(`${API_BASE}/deployments/${this.testDeploymentId}/metrics`);
      
      if (metricsResponse.status === 200 && metricsResponse.data.success) {
        console.log('✅ Metrics endpoint working');
      }

      // Test system overview
      const overviewResponse = await axios.get(`${API_BASE}/overview`);
      
      if (overviewResponse.status === 200 && overviewResponse.data.success) {
        this.results.healthMonitoring = true;
        console.log('✅ System overview endpoint working');
      }

    } catch (error) {
      console.error('❌ Health monitoring failed:', error.response?.data || error.message);
    }

    console.log('');
  }

  private async testWebSocketConnection(): Promise<void> {
    console.log('🌐 Testing WebSocket Real-time Updates...');

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(WS_URL);
        let connectionEstablished = false;
        let messagesReceived = 0;

        const timeout = setTimeout(() => {
          if (!connectionEstablished) {
            console.error('❌ WebSocket connection timeout');
          }
          ws.close();
          resolve();
        }, 5000);

        ws.on('open', () => {
          connectionEstablished = true;
          console.log('✅ WebSocket connection established');
          
          // Send a test message
          ws.send(JSON.stringify({
            type: 'subscribe',
            deploymentId: this.testDeploymentId
          }));
        });

        ws.on('message', (data) => {
          messagesReceived++;
          try {
            const message = JSON.parse(data.toString());
            console.log('✅ WebSocket message received:', message.type);
            
            if (message.type === 'connection_established') {
              console.log('✅ Connection acknowledgment received');
            }
            
            // If we've received messages and connection is working
            if (messagesReceived >= 1 && connectionEstablished) {
              this.results.webSocketConnection = true;
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        });

        ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          clearTimeout(timeout);
          resolve();
        });

        ws.on('close', () => {
          console.log('🔌 WebSocket connection closed');
          clearTimeout(timeout);
          resolve();
        });

      } catch (error) {
        console.error('❌ WebSocket test failed:', error);
        resolve();
      }
    });
  }

  private printResults(): void {
    console.log('\n📊 Enterprise ML Deployment Service Test Results:');
    console.log('================================================');
    console.log(`Model Registration:    ${this.results.modelRegistration ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Deployment Creation:   ${this.results.deploymentCreation ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`A/B Testing:          ${this.results.abTesting ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Health Monitoring:     ${this.results.healthMonitoring ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`WebSocket Connection:  ${this.results.webSocketConnection ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('================================================');
    console.log(`Overall Success:       ${this.results.overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('');

    if (this.results.overallSuccess) {
      console.log('🎉 Enterprise ML Deployment Service is fully operational!');
    } else {
      console.log('⚠️  Some components need attention. Check the logs above for details.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new EnterpriseMLDeploymentTester();
  
  tester.runAllTests()
    .then((results) => {
      process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test suite crashed:', error);
      process.exit(1);
    });
}

export default EnterpriseMLDeploymentTester;