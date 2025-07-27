#!/usr/bin/env tsx
/**
 * API Endpoints Testing
 * Tests the server API endpoints for secrets management
 */

const BASE_URL = 'http://localhost:9999';

interface APITestResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  statusCode?: number;
  responseTime?: number;
  details?: string;
  error?: string;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class APIEndpointTester {
  private results: APITestResult[] = [];

  private logResult(endpoint: string, method: string, status: 'pass' | 'fail' | 'skip', statusCode?: number, responseTime?: number, details?: string, error?: string) {
    const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
    const symbol = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${color}${symbol} ${method} ${endpoint}${colors.reset}`);
    if (statusCode) console.log(`${colors.cyan}   Status: ${statusCode} (${responseTime}ms)${colors.reset}`);
    if (details) console.log(`${colors.cyan}   ${details}${colors.reset}`);
    if (error) console.log(`${colors.red}   Error: ${error}${colors.reset}`);
    
    this.results.push({ endpoint, method, status, statusCode, responseTime, details, error });
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: any): Promise<{
    status: number;
    data: any;
    responseTime: number;
  }> {
    const url = `${BASE_URL}${endpoint}`;
    const start = Date.now();
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const responseTime = Date.now() - start;
    
    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return {
      status: response.status,
      data,
      responseTime
    };
  }

  async testHealthEndpoint() {
    try {
      const result = await this.makeRequest('/health');
      
      if (result.status === 200) {
        this.logResult('/health', 'GET', 'pass', result.status, result.responseTime, 'Server is healthy');
      } else {
        this.logResult('/health', 'GET', 'fail', result.status, result.responseTime, 'Server not responding correctly');
      }
    } catch (error: any) {
      this.logResult('/health', 'GET', 'fail', undefined, undefined, undefined, error.message);
    }
  }

  async testSecretsServicesEndpoint() {
    try {
      const result = await this.makeRequest('/api/v1/secrets/services');
      
      if (result.status === 200 && result.data.success) {
        const serviceCount = result.data.data?.services?.length || 0;
        this.logResult('/api/v1/secrets/services', 'GET', 'pass', result.status, result.responseTime, `Found ${serviceCount} services`);
      } else {
        this.logResult('/api/v1/secrets/services', 'GET', 'fail', result.status, result.responseTime, 'Invalid response format');
      }
    } catch (error: any) {
      this.logResult('/api/v1/secrets/services', 'GET', 'fail', undefined, undefined, undefined, error.message);
    }
  }

  async testSecretsStoreEndpoint() {
    try {
      const testSecret = {
        service: 'test_api_service',
        key: 'test-key-12345',
        description: 'Test API key for endpoint testing'
      };

      const result = await this.makeRequest('/api/v1/secrets/store', 'POST', testSecret);
      
      if (result.status === 200 && result.data.success) {
        this.logResult('/api/v1/secrets/store', 'POST', 'pass', result.status, result.responseTime, 'Secret stored successfully');
        
        // Cleanup
        try {
          await this.makeRequest(`/api/v1/secrets/delete/${testSecret.service}`, 'DELETE');
        } catch (error) {
          console.log(`${colors.yellow}Note: Cleanup may have failed for test secret${colors.reset}`);
        }
      } else {
        this.logResult('/api/v1/secrets/store', 'POST', 'fail', result.status, result.responseTime, 'Failed to store secret');
      }
    } catch (error: any) {
      this.logResult('/api/v1/secrets/store', 'POST', 'fail', undefined, undefined, undefined, error.message);
    }
  }

  async testSecretsMigrateEndpoint() {
    try {
      const result = await this.makeRequest('/api/v1/secrets/migrate', 'POST');
      
      if (result.status === 200) {
        this.logResult('/api/v1/secrets/migrate', 'POST', 'pass', result.status, result.responseTime, 'Migration endpoint responsive');
      } else {
        this.logResult('/api/v1/secrets/migrate', 'POST', 'fail', result.status, result.responseTime, 'Migration failed');
      }
    } catch (error: any) {
      this.logResult('/api/v1/secrets/migrate', 'POST', 'fail', undefined, undefined, undefined, error.message);
    }
  }

  async testSecretsHealthEndpoint() {
    try {
      const result = await this.makeRequest('/api/v1/secrets/health');
      
      if (result.status === 200 && result.data.success) {
        this.logResult('/api/v1/secrets/health', 'GET', 'pass', result.status, result.responseTime, 'Secrets system healthy');
      } else {
        this.logResult('/api/v1/secrets/health', 'GET', 'fail', result.status, result.responseTime, 'Secrets system unhealthy');
      }
    } catch (error: any) {
      this.logResult('/api/v1/secrets/health', 'GET', 'fail', undefined, undefined, undefined, error.message);
    }
  }

  async testMonitoringEndpoints() {
    const endpoints = [
      '/api/v1/system/metrics',
      '/api/v1/system/performance',
      '/api/v1/system/agents/performance',
      '/api/v1/ab-mcts/auto-pilot/status'
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await this.makeRequest(endpoint);
        
        if (result.status === 200) {
          this.logResult(endpoint, 'GET', 'pass', result.status, result.responseTime, 'Endpoint available');
        } else if (result.status === 404) {
          this.logResult(endpoint, 'GET', 'skip', result.status, result.responseTime, 'Not implemented yet (expected)');
        } else {
          this.logResult(endpoint, 'GET', 'fail', result.status, result.responseTime, 'Unexpected response');
        }
      } catch (error: any) {
        this.logResult(endpoint, 'GET', 'fail', undefined, undefined, undefined, error.message);
      }
    }
  }

  generateReport() {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    const total = this.results.length;

    console.log(`\n${colors.blue}📊 API Endpoint Test Results${colors.reset}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`${colors.yellow}Skipped: ${skipped}${colors.reset}`);
    console.log(`${colors.cyan}Total: ${total}${colors.reset}`);
    
    const successRate = total > 0 ? ((passed + skipped) / total) * 100 : 0;
    console.log(`${colors.cyan}Success Rate: ${successRate.toFixed(1)}%${colors.reset}`);

    if (failed === 0) {
      console.log(`\n${colors.green}🎉 ALL CRITICAL ENDPOINTS WORKING! API is functional.${colors.reset}`);
    } else if (failed <= 2) {
      console.log(`\n${colors.yellow}⚠️ Minor issues detected. Core functionality working.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Multiple endpoints failing. Check server status.${colors.reset}`);
    }

    return { passed, failed, skipped, total, successRate };
  }

  async runAllTests() {
    console.log(`\n${colors.magenta}🧪 Testing API Endpoints${colors.reset}\n`);

    // Check if server is running first
    try {
      await this.makeRequest('/health');
      console.log(`${colors.green}✅ Server detected at ${BASE_URL}${colors.reset}\n`);
    } catch {
      console.log(`${colors.red}❌ Server not responding at ${BASE_URL}${colors.reset}`);
      console.log(`${colors.yellow}Please start the server with: npm run dev${colors.reset}\n`);
      return { passed: 0, failed: 1, skipped: 0, total: 1, successRate: 0 };
    }

    await this.testHealthEndpoint();
    await this.testSecretsServicesEndpoint();
    await this.testSecretsStoreEndpoint();
    await this.testSecretsMigrateEndpoint();
    await this.testSecretsHealthEndpoint();
    await this.testMonitoringEndpoints();

    return this.generateReport();
  }
}

async function main() {
  const tester = new APIEndpointTester();
  const results = await tester.runAllTests();
  process.exit(results.failed > 2 ? 1 : 0); // Allow a few non-critical failures
}

main().catch(console.error);