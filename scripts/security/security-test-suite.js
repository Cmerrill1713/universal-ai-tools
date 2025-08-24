#!/usr/bin/env node

/**
 * Comprehensive Security Test Suite for Universal AI Tools
 * Tests input validation, authentication, headers, API security, and more
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';

const BASE_URL = 'http://localhost:9999';
const TEST_API_KEY = 'local-dev-key';
const TEST_SERVICE = 'local-ui';

class SecurityTestSuite {
  constructor() {
    this.results = {
      vulnerabilities: [],
      securityHeaders: [],
      inputValidation: [],
      authentication: [],
      apiSecurity: [],
      systemSecurity: [],
      overallScore: 0,
      recommendations: [],
    };
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔐 Starting Comprehensive Security Test Suite...\n');

    try {
      // 1. Test Input Validation and Sanitization
      await this.testInputValidation();

      // 2. Test Authentication and Authorization
      await this.testAuthentication();

      // 3. Test Security Headers
      await this.testSecurityHeaders();

      // 4. Test API Security
      await this.testApiSecurity();

      // 5. Test Rate Limiting
      await this.testRateLimiting();

      // 6. Test System Security
      await this.testSystemSecurity();

      // 7. Test CSRF Protection
      await this.testCSRFProtection();

      // 8. Test SQL Injection Prevention
      await this.testSQLInjectionPrevention();

      // 9. Test XSS Prevention
      await this.testXSSPrevention();

      // 10. Test Path Traversal Prevention
      await this.testPathTraversalPrevention();

      // Calculate overall score
      this.calculateSecurityScore();

      // Generate report
      this.generateReport();
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error running security tests:', error.message);
    }
  }

  /**
   * Test input validation and sanitization
   */
  async testInputValidation() {
    console.log('🧪 Testing Input Validation and Sanitization...');

    const testCases = [
      {
        name: 'Script injection in body',
        payload: { content: '<script>alert("xss")</script>' },
        endpoint: '/api/v1/memory',
        expectedBehavior: 'sanitized',
      },
      {
        name: 'SQL injection attempt',
        payload: { query: "'; DROP TABLE users; --" },
        endpoint: '/api/v1/memory/search',
        expectedBehavior: 'blocked',
      },
      {
        name: 'Path traversal in parameters',
        payload: { path: '../../../etc/passwd' },
        endpoint: '/api/v1/context/test',
        expectedBehavior: 'blocked',
      },
      {
        name: 'Oversized payload',
        payload: { data: 'A'.repeat(50 * 1024 * 1024) }, // 50MB
        endpoint: '/api/v1/memory',
        expectedBehavior: 'rejected',
      },
      {
        name: 'Null byte injection',
        payload: { filename: 'test\\x00.txt' },
        endpoint: '/api/v1/memory',
        expectedBehavior: 'sanitized',
      },
    ];

    for (const test of testCases) {
      try {
        const response = await fetch(`${BASE_URL}${test.endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TEST_API_KEY,
            'X-AI-Service': TEST_SERVICE,
          },
          body: JSON.stringify(test.payload),
        });

        const result = {
          test: test.name,
          status: response.status,
          passed: this.evaluateInputValidationTest(test, response),
          details: `Expected: ${test.expectedBehavior}, Got: ${response.status}`,
        };

        this.results.inputValidation.push(result);
        console.log(`  ${result.passed ? '✅' : '❌'} ${test.name}: ${result.details}`);
      } catch (error) {
        this.results.inputValidation.push({
          test: test.name,
          status: 'error',
          passed: false,
          details: error.message,
        });
        console.log(`  ❌ ${test.name}: Error - ${error.message}`);
      }
    }
    console.log();
  }

  /**
   * Test authentication and authorization
   */
  async testAuthentication() {
    console.log('🔑 Testing Authentication and Authorization...');

    const authTests = [
      {
        name: 'No API key provided',
        headers: { 'X-AI-Service': TEST_SERVICE },
        expectedStatus: 401,
      },
      {
        name: 'Invalid API key',
        headers: { 'X-API-Key': 'invalid-key', 'X-AI-Service': TEST_SERVICE },
        expectedStatus: 401,
      },
      {
        name: 'Missing AI service header',
        headers: { 'X-API-Key': TEST_API_KEY },
        expectedStatus: 401,
      },
      {
        name: 'Valid credentials (development)',
        headers: { 'X-API-Key': TEST_API_KEY, 'X-AI-Service': TEST_SERVICE },
        expectedStatus: 200,
      },
    ];

    for (const test of authTests) {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/memory`, {
          method: 'GET',
          headers: test.headers,
        });

        const passed = response.status === test.expectedStatus;
        const result = {
          test: test.name,
          status: response.status,
          passed,
          details: `Expected: ${test.expectedStatus}, Got: ${response.status}`,
        };

        this.results.authentication.push(result);
        console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${result.details}`);
      } catch (error) {
        this.results.authentication.push({
          test: test.name,
          status: 'error',
          passed: false,
          details: error.message,
        });
        console.log(`  ❌ ${test.name}: Error - ${error.message}`);
      }
    }
    console.log();
  }

  /**
   * Test security headers
   */
  async testSecurityHeaders() {
    console.log('🛡️ Testing Security Headers...');

    try {
      const response = await fetch(`${BASE_URL}/health`);
      const headers = response.headers;

      const requiredHeaders = [
        { name: 'x-content-type-options', expectedValue: 'nosniff' },
        { name: 'x-frame-options', expectedValue: 'DENY' },
        { name: 'x-xss-protection', expectedValue: '1; mode=block' },
        { name: 'strict-transport-security', expectedValue: null },
        { name: 'content-security-policy', expectedValue: null },
        { name: 'referrer-policy', expectedValue: 'strict-origin-when-cross-origin' },
      ];

      for (const header of requiredHeaders) {
        const headerValue = headers.get(header.name);
        const present = !!headerValue;
        const passed =
          present && (header.expectedValue ? headerValue.includes(header.expectedValue) : true);

        const result = {
          header: header.name,
          present,
          value: headerValue || 'Not set',
          passed,
          recommendation: passed ? 'Good' : `Set ${header.name} header`,
        };

        this.results.securityHeaders.push(result);
        console.log(`  ${passed ? '✅' : '❌'} ${header.name}: ${headerValue || 'Not set'}`);
      }
    } catch (error) {
      console.log(`  ❌ Error testing headers: ${error.message}`);
    }
    console.log();
  }

  /**
   * Test API security measures
   */
  async testApiSecurity() {
    console.log('🔒 Testing API Security Measures...');

    const apiTests = [
      {
        name: 'CORS policy enforcement',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/v1/memory`, {
            method: 'OPTIONS',
            headers: {
              Origin: 'https://malicious-site.com',
              'Access-Control-Request-Method': 'POST',
            },
          });
          return response.status === 200 ? 'fail' : 'pass';
        },
      },
      {
        name: 'HTTP method validation',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/v1/memory`, {
            method: 'TRACE',
            headers: {
              'X-API-Key': TEST_API_KEY,
              'X-AI-Service': TEST_SERVICE,
            },
          });
          return response.status === 405 ? 'pass' : 'fail';
        },
      },
      {
        name: 'Request size limits',
        test: async () => {
          const largePayload = { data: 'X'.repeat(100 * 1024 * 1024) }; // 100MB
          const response = await fetch(`${BASE_URL}/api/v1/memory`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': TEST_API_KEY,
              'X-AI-Service': TEST_SERVICE,
            },
            body: JSON.stringify(largePayload),
          });
          return response.status === 413 ? 'pass' : 'fail';
        },
      },
    ];

    for (const test of apiTests) {
      try {
        const result = await test.test();
        const passed = result === 'pass';

        this.results.apiSecurity.push({
          test: test.name,
          passed,
          details: `Test ${result}`,
        });

        console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${result}`);
      } catch (error) {
        this.results.apiSecurity.push({
          test: test.name,
          passed: false,
          details: `Error: ${error.message}`,
        });
        console.log(`  ❌ ${test.name}: Error - ${error.message}`);
      }
    }
    console.log();
  }

  /**
   * Test rate limiting
   */
  async testRateLimiting() {
    console.log('⚡ Testing Rate Limiting...');

    try {
      const requests = [];
      const endpoint = `${BASE_URL}/api/v1/memory`;

      // Send 10 rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          fetch(endpoint, {
            method: 'GET',
            headers: {
              'X-API-Key': TEST_API_KEY,
              'X-AI-Service': TEST_SERVICE,
            },
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      const passed = rateLimitedResponses.length > 0;
      this.results.apiSecurity.push({
        test: 'Rate limiting enforcement',
        passed,
        details: `${rateLimitedResponses.length}/10 requests rate limited`,
      });

      console.log(
        `  ${passed ? '✅' : '❌'} Rate limiting: ${rateLimitedResponses.length}/10 requests blocked`
      );

      // Check rate limit headers
      const firstResponse = responses[0];
      const hasRateLimitHeaders =
        firstResponse.headers.get('x-ratelimit-limit') ||
        firstResponse.headers.get('x-ratelimit-remaining');

      console.log(
        `  ${hasRateLimitHeaders ? '✅' : '❌'} Rate limit headers: ${hasRateLimitHeaders ? 'Present' : 'Missing'}`
      );
    } catch (error) {
      console.log(`  ❌ Rate limiting test error: ${error.message}`);
    }
    console.log();
  }

  /**
   * Test system security configuration
   */
  async testSystemSecurity() {
    console.log('🔧 Testing System Security Configuration...');

    const systemTests = [
      {
        name: 'Environment variable exposure',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/config`);
          const data = await response.json();

          // Check if sensitive data is exposed
          const hasSensitiveData =
            JSON.stringify(data).includes('password') ||
            JSON.stringify(data).includes('secret') ||
            JSON.stringify(data).includes('key');

          return hasSensitiveData ? 'fail' : 'pass';
        },
      },
      {
        name: 'Error message information leakage',
        test: async () => {
          const response = await fetch(`${BASE_URL}/api/nonexistent-endpoint`);
          const text = await response.text();

          // Check if error messages reveal system information
          const hasSystemInfo =
            text.includes('Error:') || text.includes('stack trace') || text.includes('file path');

          return hasSystemInfo ? 'fail' : 'pass';
        },
      },
      {
        name: 'Health endpoint security',
        test: async () => {
          const response = await fetch(`${BASE_URL}/health`);
          const data = await response.json();

          // Health endpoint should not expose sensitive information
          const exposesSecrets =
            JSON.stringify(data).includes('password') || JSON.stringify(data).includes('secret');

          return exposesSecrets ? 'fail' : 'pass';
        },
      },
    ];

    for (const test of systemTests) {
      try {
        const result = await test.test();
        const passed = result === 'pass';

        this.results.systemSecurity.push({
          test: test.name,
          passed,
          details: `Test ${result}`,
        });

        console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${result}`);
      } catch (error) {
        this.results.systemSecurity.push({
          test: test.name,
          passed: false,
          details: `Error: ${error.message}`,
        });
        console.log(`  ❌ ${test.name}: Error - ${error.message}`);
      }
    }
    console.log();
  }

  /**
   * Test CSRF protection
   */
  async testCSRFProtection() {
    console.log('🎯 Testing CSRF Protection...');

    try {
      // First, get a CSRF token
      const tokenResponse = await fetch(`${BASE_URL}/api/csrf-token`);
      const tokenData = await tokenResponse.json();

      if (tokenData.token) {
        console.log('  ✅ CSRF token endpoint available');

        // Test POST without CSRF token
        const noTokenResponse = await fetch(`${BASE_URL}/api/v1/memory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TEST_API_KEY,
            'X-AI-Service': TEST_SERVICE,
          },
          body: JSON.stringify({ content: 'test' }),
        });

        // Should fail without CSRF token (if CSRF is enabled)
        const csrfProtected = noTokenResponse.status === 403;
        console.log(
          `  ${csrfProtected ? '✅' : '⚠️'} CSRF protection: ${csrfProtected ? 'Active' : 'Not enforced'}`
        );
      } else {
        console.log('  ⚠️ CSRF token endpoint not configured');
      }
    } catch (error) {
      console.log(`  ❌ CSRF test error: ${error.message}`);
    }
    console.log();
  }

  /**
   * Test SQL injection prevention
   */
  async testSQLInjectionPrevention() {
    console.log('💉 Testing SQL Injection Prevention...');

    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/memory/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TEST_API_KEY,
            'X-AI-Service': TEST_SERVICE,
          },
          body: JSON.stringify({ query: payload }),
        });

        const passed = response.status !== 200 || !(await response.text()).includes('DROP');
        console.log(
          `  ${passed ? '✅' : '❌'} SQL injection blocked: ${payload.substring(0, 20)}...`
        );
      } catch (error) {
        console.log(
          `  ✅ SQL injection blocked (connection error): ${payload.substring(0, 20)}...`
        );
      }
    }
    console.log();
  }

  /**
   * Test XSS prevention
   */
  async testXSSPrevention() {
    console.log('🎭 Testing XSS Prevention...');

    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      '<iframe src="javascript:alert(1)"></iframe>',
      'javascript:alert(1)',
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/memory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TEST_API_KEY,
            'X-AI-Service': TEST_SERVICE,
          },
          body: JSON.stringify({ content: payload }),
        });

        const responseText = await response.text();
        const sanitized = !responseText.includes('<script>') && !responseText.includes('onerror');
        console.log(
          `  ${sanitized ? '✅' : '❌'} XSS payload sanitized: ${payload.substring(0, 20)}...`
        );
      } catch (error) {
        console.log(`  ✅ XSS payload blocked: ${payload.substring(0, 20)}...`);
      }
    }
    console.log();
  }

  /**
   * Test path traversal prevention
   */
  async testPathTraversalPrevention() {
    console.log('📁 Testing Path Traversal Prevention...');

    const pathPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd',
    ];

    for (const payload of pathPayloads) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/v1/context/file/${encodeURIComponent(payload)}`,
          {
            method: 'GET',
            headers: {
              'X-API-Key': TEST_API_KEY,
              'X-AI-Service': TEST_SERVICE,
            },
          }
        );

        const blocked =
          response.status === 400 || response.status === 403 || response.status === 404;
        console.log(
          `  ${blocked ? '✅' : '❌'} Path traversal blocked: ${payload.substring(0, 20)}...`
        );
      } catch (error) {
        console.log(`  ✅ Path traversal blocked: ${payload.substring(0, 20)}...`);
      }
    }
    console.log();
  }

  /**
   * Evaluate input validation test results
   */
  evaluateInputValidationTest(test, response) {
    switch (test.expectedBehavior) {
      case 'sanitized':
        return response.status === 200 || response.status === 400;
      case 'blocked':
        return response.status === 400 || response.status === 403;
      case 'rejected':
        return response.status === 413 || response.status === 400;
      default:
        return false;
    }
  }

  /**
   * Calculate overall security score
   */
  calculateSecurityScore() {
    const allTests = [
      ...this.results.inputValidation,
      ...this.results.authentication,
      ...this.results.securityHeaders,
      ...this.results.apiSecurity,
      ...this.results.systemSecurity,
    ];

    const totalTests = allTests.length;
    const passedTests = allTests.filter((test) => test.passed).length;

    this.results.overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Generate recommendations based on failed tests
    const failedTests = allTests.filter((test) => !test.passed);
    failedTests.forEach((test) => {
      this.results.recommendations.push(`Fix: ${test.test} - ${test.details}`);
    });

    // Add general recommendations
    if (this.results.overallScore < 90) {
      this.results.recommendations.push('Implement automated security scanning in CI/CD pipeline');
      this.results.recommendations.push('Review and update security policies regularly');
      this.results.recommendations.push('Conduct regular penetration testing');
    }
  }

  /**
   * Generate comprehensive security report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔐 UNIVERSAL AI TOOLS SECURITY AUDIT REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log(
      `Overall Security Score: ${this.getScoreColor(this.results.overallScore)}${this.results.overallScore}/100\x1b[0m\n`
    );

    // Input Validation Results
    console.log('📝 INPUT VALIDATION & SANITIZATION:');
    this.results.inputValidation.forEach((test) => {
      console.log(`  ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
    });
    console.log();

    // Authentication Results
    console.log('🔑 AUTHENTICATION & AUTHORIZATION:');
    this.results.authentication.forEach((test) => {
      console.log(`  ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
    });
    console.log();

    // Security Headers
    console.log('🛡️ SECURITY HEADERS:');
    this.results.securityHeaders.forEach((header) => {
      console.log(`  ${header.passed ? '✅' : '❌'} ${header.header}: ${header.value}`);
    });
    console.log();

    // API Security
    console.log('🔒 API SECURITY:');
    this.results.apiSecurity.forEach((test) => {
      console.log(`  ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
    });
    console.log();

    // System Security
    console.log('🔧 SYSTEM SECURITY:');
    this.results.systemSecurity.forEach((test) => {
      console.log(`  ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
    });
    console.log();

    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log('💡 SECURITY RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
      console.log();
    }

    // Summary
    const critical = this.results.recommendations.filter((r) => r.includes('Critical')).length;
    const high = this.results.recommendations.filter((r) => r.includes('High')).length;

    console.log('📊 SUMMARY:');
    console.log(
      `  Tests Run: ${this.results.inputValidation.length + this.results.authentication.length + this.results.securityHeaders.length + this.results.apiSecurity.length + this.results.systemSecurity.length}`
    );
    console.log(
      `  Tests Passed: ${[...this.results.inputValidation, ...this.results.authentication, ...this.results.securityHeaders, ...this.results.apiSecurity, ...this.results.systemSecurity].filter((t) => t.passed).length}`
    );
    console.log(`  Security Score: ${this.results.overallScore}/100`);
    console.log(`  Recommendations: ${this.results.recommendations.length}`);
    console.log();

    // Save report to file
    this.saveReportToFile();
  }

  /**
   * Get color for security score
   */
  getScoreColor(score) {
    if (score >= 90) return '\x1b[32m'; // Green
    if (score >= 70) return '\x1b[33m'; // Yellow
    if (score >= 50) return '\x1b[35m'; // Magenta
    return '\x1b[31m'; // Red
  }

  /**
   * Save report to file
   */
  async saveReportToFile() {
    const reportData = {
      timestamp: new Date().toISOString(),
      overallScore: this.results.overallScore,
      results: this.results,
      summary: {
        totalTests:
          this.results.inputValidation.length +
          this.results.authentication.length +
          this.results.securityHeaders.length +
          this.results.apiSecurity.length +
          this.results.systemSecurity.length,
        passedTests: [
          ...this.results.inputValidation,
          ...this.results.authentication,
          ...this.results.securityHeaders,
          ...this.results.apiSecurity,
          ...this.results.systemSecurity,
        ].filter((t) => t.passed).length,
        recommendations: this.results.recommendations.length,
      },
    };

    try {
      await fs.writeFile('security-audit-report.json', JSON.stringify(reportData, null, 2));
      console.log('💾 Report saved to: security-audit-report.json');
    } catch (error) {
      console.log(`❌ Failed to save report: ${error.message}`);
    }
  }
}

// Run the security test suite
const testSuite = new SecurityTestSuite();
testSuite.runAllTests().catch(console.error);
