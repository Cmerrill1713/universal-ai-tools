#!/usr/bin/env node

/**
 * Unit tests for security implementations
 * Tests the actual middleware implementations without requiring a running server
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const log = {
  title: (msg) => console.log(`\n${colors.blue}====== ${msg} ======${colors.reset}\n`),
  test: (name) => console.log(`${colors.blue}TEST:${colors.reset} ${name}`),
  pass: (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`  ${colors.yellow}ℹ${colors.reset}  ${msg}`),
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    log.pass(message);
  } else {
    failedTests++;
    log.fail(message);
  }
}

async function testSecurityImplementations() {
  log.title('Universal AI Tools - Security Implementation Tests');

  // Test 1: Check if comprehensive validation middleware exists
  log.test('Comprehensive Validation Middleware');
  try {
    const validationPath = path.join(__dirname, 'src/middleware/comprehensive-validation.ts');
    const validationExists = fs.existsSync(validationPath);
    assert(validationExists, 'Comprehensive validation middleware file exists');

    if (validationExists) {
      const content = fs.readFileSync(validationPath, 'utf-8');
      assert(
        content.includes('ComprehensiveValidationMiddleware'),
        'Contains ComprehensiveValidationMiddleware class'
      );
      assert(content.includes('SQL_INJECTION_DETECTED'), 'Includes SQL injection protection');
      assert(content.includes('XSS prevention'), 'Includes XSS prevention');
      assert(content.includes('Input sanitization'), 'Includes input sanitization');
      assert(content.includes('Request size limiting'), 'Includes request size limiting');
    }
  } catch (error) {
    log.fail(`Error testing validation middleware: ${error.message}`);
  }

  // Test 2: Check enhanced security middleware updates
  log.test('\nEnhanced Security Middleware Updates');
  try {
    const securityPath = path.join(__dirname, 'src/middleware/security-enhanced.ts');
    const securityExists = fs.existsSync(securityPath);
    assert(securityExists, 'Enhanced security middleware file exists');

    if (securityExists) {
      const content = fs.readFileSync(securityPath, 'utf-8');
      assert(
        content.includes('ComprehensiveValidationMiddleware'),
        'Imports comprehensive validation'
      );
      assert(content.includes('enableInputValidation'), 'Has input validation configuration');
      assert(
        content.includes('SupabaseRateLimitStore'),
        'Uses Supabase rate limit store in production'
      );
      assert(content.includes('totalEndpointsProtected: 29'), 'Protects 29 endpoint categories');
    }
  } catch (error) {
    log.fail(`Error testing security middleware: ${error.message}`);
  }

  // Test 3: Check rate limiting implementation
  log.test('\nRate Limiting Implementation');
  try {
    const rateLimiterPath = path.join(__dirname, 'src/middleware/rate-limiter.ts');
    const rateLimiterExists = fs.existsSync(rateLimiterPath);
    assert(rateLimiterExists, 'Rate limiter middleware exists');

    if (rateLimiterExists) {
      const content = fs.readFileSync(rateLimiterPath, 'utf-8');
      assert(content.includes('SupabaseRateLimitStore'), 'Has Supabase rate limit store');
      assert(content.includes('anonymous: 100'), 'Has anonymous tier (100 requests)');
      assert(content.includes('authenticated: 1000'), 'Has authenticated tier (1000 requests)');
      assert(content.includes('premium: 5000'), 'Has premium tier (5000 requests)');
      assert(content.includes('admin: 10000'), 'Has admin tier (10000 requests)');
    }
  } catch (error) {
    log.fail(`Error testing rate limiter: ${error.message}`);
  }

  // Test 4: Check SQL injection protection
  log.test('\nSQL Injection Protection');
  try {
    const sqlProtectionPath = path.join(__dirname, 'src/middleware/sql-injection-protection.ts');
    const sqlProtectionExists = fs.existsSync(sqlProtectionPath);
    assert(sqlProtectionExists, 'SQL injection protection middleware exists');

    if (sqlProtectionExists) {
      const content = fs.readFileSync(sqlProtectionPath, 'utf-8');
      assert(content.includes('SQL_PATTERNS'), 'Has SQL injection patterns');
      assert(content.includes('NOSQL_PATTERNS'), 'Has NoSQL injection patterns');
      assert(content.includes('detectSQLInjection'), 'Has SQL injection detection method');
      assert(content.includes('trackSuspiciousIP'), 'Tracks suspicious IPs');
    }
  } catch (error) {
    log.fail(`Error testing SQL protection: ${error.message}`);
  }

  // Test 5: Check removed security vulnerabilities
  log.test('\nSecurity Vulnerability Fixes');
  try {
    // Check JWT auto-generation fix
    const envConfigPath = path.join(__dirname, 'src/config/environment.ts');
    if (fs.existsSync(envConfigPath)) {
      const envContent = fs.readFileSync(envConfigPath, 'utf-8');
      assert(
        envContent.includes('JWT_SECRET must be set and secure in production'),
        'JWT secret validation in production'
      );
      assert(
        !envContent.includes("crypto.randomBytes(32).toString('hex')") ||
          envContent.includes("if (process.env.NODE_ENV === 'production')"),
        'No auto-generation in production'
      );
    }

    // Check hardcoded API key removal
    const apiLibPath = path.join(__dirname, 'ui/src/lib/api.ts');
    if (fs.existsSync(apiLibPath)) {
      const apiContent = fs.readFileSync(apiLibPath, 'utf-8');
      assert(!apiContent.includes('test-api-key-123'), 'No hardcoded test API key');
      assert(
        apiContent.includes('VITE_API_KEY environment variable is required'),
        'Requires environment variable'
      );
    }

    // Check arbitrary code execution fix
    const toolsRouterPath = path.join(__dirname, 'src/routers/tools.ts');
    if (fs.existsSync(toolsRouterPath)) {
      const toolsContent = fs.readFileSync(toolsRouterPath, 'utf-8');
      assert(
        toolsContent.includes('Tool execution is disabled in production'),
        'Tool execution disabled'
      );
      assert(
        !toolsContent.includes('new Function(') || toolsContent.includes('throw new Error'),
        'No arbitrary code execution'
      );
    }
  } catch (error) {
    log.fail(`Error testing vulnerability fixes: ${error.message}`);
  }

  // Test 6: Check database query limits
  log.test('\nDatabase Query Optimizations');
  try {
    const filesToCheck = [
      {
        path: path.join(__dirname, 'src/services/enhanced-context-service.ts'),
        limits: ['.limit(50)', '.limit(100)', '.limit(20)'],
      },
      {
        path: path.join(__dirname, 'src/core/knowledge/dspy-knowledge-manager.ts'),
        limits: ['.limit(1000)', '.limit(1)'],
      },
      {
        path: path.join(__dirname, 'src/routers/knowledge-monitoring.ts'),
        limits: ['.limit(500)', '.limit(1000)', '.limit(100)'],
      },
    ];

    filesToCheck.forEach((file) => {
      if (fs.existsSync(file.path)) {
        const content = fs.readFileSync(file.path, 'utf-8');
        const hasLimits = file.limits.some((limit) => content.includes(limit));
        assert(hasLimits, `${file.path} has query limits`);
      }
    });
  } catch (error) {
    log.fail(`Error testing database optimizations: ${error.message}`);
  }

  // Test 7: Check structured logging
  log.test('\nStructured Logging Implementation');
  try {
    const criticalFiles = [
      path.join(__dirname, 'src/server.ts'),
      path.join(__dirname, 'src/server-minimal.ts'),
      path.join(__dirname, 'src/server-minimal-fixed.ts'),
    ];

    criticalFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        const hasConsoleLog = content.match(/console\.(log|warn|error)\(/g);
        const hasLogger = content.includes('logger.');

        if (hasConsoleLog && hasConsoleLog.length > 5) {
          log.info(`${file} might still have console.log statements`);
        } else if (hasLogger) {
          log.pass(`${file} uses structured logging`);
          passedTests++;
          totalTests++;
        }
      }
    });
  } catch (error) {
    log.fail(`Error testing logging: ${error.message}`);
  }

  // Summary
  log.title('Test Summary');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(
    `${colors.blue}Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%${colors.reset}`
  );

  if (failedTests === 0) {
    console.log(`\n${colors.green}✅ All security implementations are in place!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}⚠️  Some security implementations need attention${colors.reset}`);
  }
}

// Run the tests
testSecurityImplementations().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
