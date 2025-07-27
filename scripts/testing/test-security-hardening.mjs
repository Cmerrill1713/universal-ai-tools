#!/usr/bin/env node

/**
 * Test script for security hardening service
 * Tests all security endpoints to ensure they're working correctly
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3456';
const TEST_TOKEN = 'test-jwt-token'; // You'll need a valid token in production

async function testSecurityEndpoints() {
  console.log('🔒 Testing Security Hardening Service\n');

  // Test 1: Security Status
  console.log('1. Testing GET /api/security/status');
  try {
    const response = await fetch(`${API_BASE}/api/security/status`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Security audit successful:');
      console.log(`   - Overall Score: ${data.score}/100`);
      console.log(`   - Vulnerabilities: ${data.vulnerabilities}`);
      console.log(`   - Critical Issues: ${data.criticalIssues}`);
      console.log(`   - Expired Keys: ${data.expiredKeys}`);
      console.log(`   - Missing Headers: ${data.missingHeaders}`);
      if (data.recommendations && data.recommendations.length > 0) {
        console.log('   - Recommendations:');
        data.recommendations.slice(0, 3).forEach(rec => {
          console.log(`     • ${rec}`);
        });
      }
    } else {
      console.log('❌ Failed:', response.status, await response.text());
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n2. Testing GET /api/security/vulnerabilities');
  try {
    const response = await fetch(`${API_BASE}/api/security/vulnerabilities`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Vulnerability scan successful:');
      console.log(`   - Total: ${data.total}`);
      console.log(`   - Critical: ${data.critical}`);
      console.log(`   - High: ${data.high}`);
      console.log(`   - Moderate: ${data.moderate}`);
      console.log(`   - Low: ${data.low}`);
    } else {
      console.log('❌ Failed:', response.status, await response.text());
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n3. Testing GET /api/security/common-issues');
  try {
    const response = await fetch(`${API_BASE}/api/security/common-issues`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Common issues check successful:');
      console.log(`   - Passed: ${data.passed}`);
      console.log(`   - Issues Found: ${data.issuesFound}`);
      if (data.issues && data.issues.length > 0) {
        console.log('   - Issues:');
        data.issues.forEach(issue => {
          console.log(`     • ${issue}`);
        });
      }
    } else {
      console.log('❌ Failed:', response.status, await response.text());
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n4. Testing POST /api/security/rotate-key');
  try {
    const response = await fetch(`${API_BASE}/api/security/rotate-key`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyType: 'api_keys' })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Key rotation successful:');
      console.log(`   - Key Type: ${data.keyType}`);
      console.log(`   - Key Preview: ${data.keyPreview}`);
      console.log(`   - Key Length: ${data.keyLength}`);
      console.log(`   - Message: ${data.message}`);
    } else {
      const error = await response.json();
      console.log('❌ Failed:', response.status, error.error);
      if (response.status === 403) {
        console.log('   Note: This endpoint requires admin privileges');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n5. Testing POST /api/security/fix-vulnerabilities (dry run)');
  try {
    const response = await fetch(`${API_BASE}/api/security/fix-vulnerabilities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dryRun: true })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Vulnerability fix dry run successful:');
      console.log(`   - Fixed: ${data.fixed.join(', ') || 'None'}`);
      console.log(`   - Failed: ${data.failed.join(', ') || 'None'}`);
      console.log(`   - Message: ${data.message}`);
    } else {
      const error = await response.json();
      console.log('❌ Failed:', response.status, error.error);
      if (response.status === 403) {
        console.log('   Note: This endpoint requires admin privileges');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🔒 Security hardening service test complete!');
  console.log('\nNote: Some endpoints may fail if:');
  console.log('- The server is not running on port 3456');
  console.log('- Authentication is not properly configured');
  console.log('- Database tables are not migrated');
  console.log('- You don\'t have admin privileges for certain operations');
}

// Run the tests
testSecurityEndpoints().catch(console.error);