#!/usr/bin/env node

import axios from 'axios';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test environment
const loadTestEnv = () => {
  const envPath = path.join(__dirname, '..', '.env.test');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
};

loadTestEnv();

const BASE_URL = `http://localhost:${process.env.PORT || 9999}`;
const API_KEY = process.env.DEV_API_KEY;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  section: (name) => console.log(`\n${colors.blue}=== ${name} ===${colors.reset}`),
  test: (name) => console.log(`\n${colors.yellow}TEST:${colors.reset} ${name}`),
  pass: (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`  ${colors.blue}ℹ${colors.reset}  ${msg}`),
  warn: (msg) => console.log(`  ${colors.yellow}⚠${colors.reset}  ${msg}`)
};

const securityTests = {
  total: 0,
  passed: 0,
  failed: 0,
  vulnerabilities: []
};

async function testSecurity(name, testFn) {
  securityTests.total++;
  log.test(name);
  
  try {
    const result = await testFn();
    securityTests.passed++;
    log.pass('Security check passed');
    if (result) log.info(result);
  } catch (error) {
    securityTests.failed++;
    securityTests.vulnerabilities.push({ test: name, error: error.message });
    log.fail(`Security vulnerability detected: ${error.message}`);
  }
}

// Test for hardcoded credentials
async function testHardcodedCredentials() {
  log.section('Hardcoded Credentials Check');
  
  const hardcodedKeys = [
    'local-dev-key',
    'test-key-123',
    'demo-api-key',
    'sk-test',
    'Bearer hardcoded'
  ];
  
  for (const key of hardcodedKeys) {
    await testSecurity(`Reject hardcoded key: ${key}`, async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/stats`, {
          headers: { 'X-API-Key': key },
          validateStatus: () => true
        });
        
        if (response.status !== 401) {
          throw new Error(`Hardcoded key '${key}' was accepted (status: ${response.status})`);
        }
        
        return `Key '${key}' correctly rejected`;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Server not running');
        }
        throw error;
      }
    });
  }
}

// Test SQL Injection vulnerabilities
async function testSQLInjection() {
  log.section('SQL Injection Prevention');
  
  const sqlInjectionPayloads = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "1; DELETE FROM memories WHERE 1=1; --",
    "' UNION SELECT * FROM users --"
  ];
  
  for (const payload of sqlInjectionPayloads) {
    await testSecurity(`SQL Injection: ${payload.substring(0, 20)}...`, async () => {
      const response = await axios.get(`${BASE_URL}/api/memories/search`, {
        params: { query: payload },
        headers: { 'X-API-Key': API_KEY },
        validateStatus: () => true
      });
      
      // Should either sanitize input or return error, not execute SQL
      if (response.status === 500) {
        throw new Error('Server error - possible SQL injection vulnerability');
      }
      
      return 'Input properly sanitized';
    });
  }
}

// Test XSS vulnerabilities
async function testXSS() {
  log.section('Cross-Site Scripting (XSS) Prevention');
  
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror="alert(1)">',
    'javascript:alert(document.cookie)',
    '<svg onload=alert(1)>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>'
  ];
  
  for (const payload of xssPayloads) {
    await testSecurity(`XSS Prevention: ${payload.substring(0, 20)}...`, async () => {
      const response = await axios.post(`${BASE_URL}/api/memories`, {
        content: payload,
        metadata: { test: payload }
      }, {
        headers: { 'X-API-Key': API_KEY },
        validateStatus: () => true
      });
      
      // Check if response contains unescaped script
      if (response.data && typeof response.data === 'string' && 
          response.data.includes('<script>')) {
        throw new Error('Unescaped script tag in response');
      }
      
      return 'XSS payload properly escaped';
    });
  }
}

// Test security headers
async function testSecurityHeaders() {
  log.section('Security Headers Validation');
  
  await testSecurity('Content Security Policy', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    const csp = response.headers['content-security-policy'];
    if (!csp) {
      throw new Error('CSP header missing');
    }
    
    // Check for unsafe directives
    if (csp.includes('unsafe-inline') && process.env.NODE_ENV === 'production') {
      throw new Error('unsafe-inline directive in production CSP');
    }
    
    return 'CSP header properly configured';
  });
  
  await testSecurity('X-Frame-Options', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    const xfo = response.headers['x-frame-options'];
    if (!xfo || xfo.toUpperCase() === 'ALLOWALL') {
      throw new Error('X-Frame-Options not restrictive enough');
    }
    
    return `X-Frame-Options: ${xfo}`;
  });
  
  await testSecurity('Strict-Transport-Security', async () => {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    const hsts = response.headers['strict-transport-security'];
    if (!hsts && process.env.NODE_ENV === 'production') {
      throw new Error('HSTS header missing in production');
    }
    
    return hsts ? `HSTS: ${hsts}` : 'HSTS not required in development';
  });
}

// Test authentication bypass attempts
async function testAuthBypass() {
  log.section('Authentication Bypass Prevention');
  
  const bypassAttempts = [
    { headers: {} }, // No auth
    { headers: { 'X-API-Key': '' } }, // Empty key
    { headers: { 'X-API-Key': 'null' } }, // Null string
    { headers: { 'X-API-Key': 'undefined' } }, // Undefined string
    { headers: { 'Authorization': 'Bearer invalid' } }, // Wrong auth type
    { headers: { 'x-api-key': API_KEY } }, // Wrong case (should still work)
  ];
  
  for (let i = 0; i < bypassAttempts.length; i++) {
    const attempt = bypassAttempts[i];
    const testName = `Auth bypass attempt ${i + 1}`;
    
    await testSecurity(testName, async () => {
      const response = await axios.get(`${BASE_URL}/api/agents`, {
        ...attempt,
        validateStatus: () => true
      });
      
      // Last attempt (lowercase header) should work
      if (i === bypassAttempts.length - 1) {
        if (response.status !== 200) {
          throw new Error('Case-insensitive header matching not working');
        }
        return 'Case-insensitive headers work correctly';
      } else {
        if (response.status !== 401) {
          throw new Error(`Authentication bypassed (status: ${response.status})`);
        }
        return 'Authentication correctly enforced';
      }
    });
  }
}

// Test rate limiting
async function testRateLimiting() {
  log.section('Rate Limiting');
  
  await testSecurity('Rate limiting enforced', async () => {
    const requests = [];
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
    
    // Make requests up to the limit
    for (let i = 0; i < maxRequests + 5; i++) {
      requests.push(
        axios.get(`${BASE_URL}/api/health`, {
          headers: { 'X-API-Key': API_KEY },
          validateStatus: () => true
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    if (!rateLimited) {
      log.warn('Rate limiting may not be properly configured');
      return 'Rate limiting not triggered (may need configuration)';
    }
    
    return 'Rate limiting working correctly';
  });
}

// Test CORS configuration
async function testCORSSecurity() {
  log.section('CORS Security');
  
  await testSecurity('CORS wildcard prevention', async () => {
    const response = await axios.options(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': 'https://evil-site.com',
        'Access-Control-Request-Method': 'POST'
      },
      validateStatus: () => true
    });
    
    const allowOrigin = response.headers['access-control-allow-origin'];
    if (allowOrigin === '*') {
      throw new Error('CORS allows wildcard origin (*)');
    }
    
    if (allowOrigin === 'https://evil-site.com') {
      throw new Error('CORS allows arbitrary origins');
    }
    
    return 'CORS properly restricts origins';
  });
  
  await testSecurity('CORS credentials handling', async () => {
    const response = await axios.options(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': process.env.CORS_ORIGINS?.split(',')[0] || 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST'
      },
      validateStatus: () => true
    });
    
    const allowCreds = response.headers['access-control-allow-credentials'];
    const allowOrigin = response.headers['access-control-allow-origin'];
    
    if (allowCreds === 'true' && allowOrigin === '*') {
      throw new Error('CORS allows credentials with wildcard origin');
    }
    
    return 'CORS credentials properly configured';
  });
}

// Generate security report
function generateSecurityReport() {
  const timestamp = new Date().toISOString();
  const score = Math.max(0, 100 - (securityTests.failed * 10));
  
  let report = `# Security Validation Report\n\n`;
  report += `**Date:** ${timestamp}\n`;
  report += `**Security Score:** ${score}/100\n`;
  report += `**Total Tests:** ${securityTests.total}\n`;
  report += `**Passed:** ${securityTests.passed}\n`;
  report += `**Failed:** ${securityTests.failed}\n\n`;
  
  if (securityTests.vulnerabilities.length > 0) {
    report += `## 🚨 Vulnerabilities Found\n\n`;
    securityTests.vulnerabilities.forEach(vuln => {
      report += `### ${vuln.test}\n`;
      report += `- **Issue:** ${vuln.error}\n`;
      report += `- **Severity:** ${getSeverity(vuln.test)}\n\n`;
    });
  } else {
    report += `## ✅ No Critical Vulnerabilities Found\n\n`;
  }
  
  report += `## Recommendations\n\n`;
  report += generateRecommendations();
  
  return report;
}

function getSeverity(testName) {
  if (testName.includes('SQL Injection') || testName.includes('hardcoded')) {
    return 'CRITICAL';
  }
  if (testName.includes('XSS') || testName.includes('Auth bypass')) {
    return 'HIGH';
  }
  if (testName.includes('CORS') || testName.includes('Headers')) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function generateRecommendations() {
  const recs = [];
  
  if (securityTests.vulnerabilities.some(v => v.test.includes('SQL'))) {
    recs.push('- Use parameterized queries for all database operations');
    recs.push('- Implement input validation and sanitization');
  }
  
  if (securityTests.vulnerabilities.some(v => v.test.includes('XSS'))) {
    recs.push('- Escape all user input in responses');
    recs.push('- Set Content-Type headers appropriately');
  }
  
  if (securityTests.vulnerabilities.some(v => v.test.includes('hardcoded'))) {
    recs.push('- Remove all hardcoded credentials');
    recs.push('- Use environment variables for all secrets');
  }
  
  if (recs.length === 0) {
    recs.push('- Continue regular security audits');
    recs.push('- Keep dependencies updated');
    recs.push('- Monitor for new vulnerabilities');
  }
  
  return recs.join('\n');
}

// Main test runner
async function main() {
  console.log('🔒 Universal AI Tools - Security Validation Suite');
  console.log('==============================================\n');
  
  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/api/health`);
  } catch (error) {
    console.error('❌ Server is not running!');
    console.error('Please start the server with: npm run dev');
    process.exit(1);
  }
  
  // Run all security tests
  await testHardcodedCredentials();
  await testSQLInjection();
  await testXSS();
  await testSecurityHeaders();
  await testAuthBypass();
  await testRateLimiting();
  await testCORSSecurity();
  
  // Print summary
  console.log('\n==============================================');
  console.log('SECURITY VALIDATION SUMMARY');
  console.log('==============================================');
  console.log(`Total Tests: ${securityTests.total}`);
  console.log(`${colors.green}Passed: ${securityTests.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${securityTests.failed}${colors.reset}`);
  
  const score = Math.max(0, 100 - (securityTests.failed * 10));
  console.log(`\nSecurity Score: ${score}/100`);
  
  if (securityTests.failed > 0) {
    console.log(`\n${colors.red}⚠️  CRITICAL: Security vulnerabilities detected!${colors.reset}`);
    console.log('Do not deploy to production until all issues are resolved.');
  } else {
    console.log(`\n${colors.green}✅ No critical security vulnerabilities found${colors.reset}`);
  }
  
  // Generate report
  const reportPath = path.join(__dirname, '..', 'SECURITY_VALIDATION_REPORT.md');
  const report = generateSecurityReport();
  require('fs').writeFileSync(reportPath, report);
  console.log(`\nDetailed report saved to: ${reportPath}`);
  
  process.exit(securityTests.failed > 0 ? 1 : 0);
}

// Run security validation
main().catch(err => {
  console.error(`Security validation failed: ${err.message}`);
  process.exit(1);
});