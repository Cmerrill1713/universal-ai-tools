const axios = require('axios');

async function testSecurityConfig() {
  console.log('Testing Security Configuration...\n');

  const baseURL = 'http://localhost:9999';
  const apiKey = process.env.DEV_API_KEY || '';

  if (!apiKey) {
    console.warn('⚠️  Warning: DEV_API_KEY not set in environment');
  }

  try {
    // Test 1: CORS headers
    console.log('1. Testing CORS headers...');
    const corsResponse = await axios.get(`${baseURL}/api/health`, {
      headers: {
        Origin: 'http://localhost:3000',
        'X-API-Key': apiKey,
      },
    });

    console.log('✅ CORS headers received:');
    console.log(
      '   Access-Control-Allow-Origin:',
      corsResponse.headers['access-control-allow-origin']
    );
    console.log(
      '   Access-Control-Allow-Credentials:',
      corsResponse.headers['access-control-allow-credentials']
    );

    // Test 2: Security headers
    console.log('\n2. Testing security headers...');
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security',
      'referrer-policy',
      'content-security-policy',
    ];

    securityHeaders.forEach((header) => {
      const value = corsResponse.headers[header];
      if (value) {
        console.log(`✅ ${header}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
      } else {
        console.log(`❌ ${header}: not set`);
      }
    });

    // Test 3: Rate limiting headers
    console.log('\n3. Testing rate limiting headers...');
    const rateLimitHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];

    rateLimitHeaders.forEach((header) => {
      const value = corsResponse.headers[header];
      if (value) {
        console.log(`✅ ${header}: ${value}`);
      } else {
        console.log(`⚠️  ${header}: not set`);
      }
    });

    // Test 4: CORS preflight
    console.log('\n4. Testing CORS preflight...');
    try {
      const preflightResponse = await axios.options(`${baseURL}/api/memory`, {
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-api-key',
        },
      });

      console.log('✅ CORS preflight successful');
      console.log('   Allowed methods:', preflightResponse.headers['access-control-allow-methods']);
      console.log('   Allowed headers:', preflightResponse.headers['access-control-allow-headers']);
    } catch (error) {
      console.log('❌ CORS preflight failed:', error.message);
    }

    // Test 5: Authentication with proper API key
    console.log('\n5. Testing authentication...');
    if (apiKey) {
      try {
        const authResponse = await axios.get(`${baseURL}/api/memory`, {
          headers: {
            'X-API-Key': apiKey,
          },
        });
        console.log('✅ Authentication successful with API key');
      } catch (error) {
        console.log('❌ Authentication failed:', error.response?.status, error.response?.data);
      }
    } else {
      console.log('⚠️  Skipping authentication test (no API key)');
    }

    // Test 6: Test unauthorized access
    console.log('\n6. Testing unauthorized access...');
    try {
      await axios.get(`${baseURL}/api/memory`, {
        headers: {
          'X-API-Key': 'invalid-key',
        },
      });
      console.log('❌ Unauthorized access allowed (security issue!)');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Unauthorized access properly blocked');
      } else {
        console.log('⚠️  Unexpected error:', error.response?.status);
      }
    }

    console.log('\n✅ Security configuration test complete!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Server is not running. Start it with: npm run dev');
    }
  }
}

// Run the test
testSecurityConfig();
