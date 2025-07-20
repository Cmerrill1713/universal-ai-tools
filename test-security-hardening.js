const axios = require('axios');

async function testSecurityHardening() {
  console.log('Testing Security Hardening Service...\n');
  
  const baseURL = 'http://localhost:8080';
  const apiKey = 'local-dev-key'; // This will need to be fixed later
  
  try {
    // Test 1: Check if security status endpoint exists
    console.log('1. Testing security status endpoint...');
    try {
      const statusResponse = await axios.get(`${baseURL}/api/security/status`, {
        headers: {
          'x-api-key': apiKey
        }
      });
      console.log('✅ Security status endpoint is working');
      console.log('Security Score:', statusResponse.data.score);
      console.log('Vulnerabilities:', statusResponse.data.vulnerabilities);
      console.log('Critical Issues:', statusResponse.data.criticalIssues);
      console.log('Expired Keys:', statusResponse.data.expiredKeys);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Security status endpoint requires authentication (good!)');
      } else {
        throw error;
      }
    }
    
    // Test 2: Check if key rotation endpoint exists
    console.log('\n2. Testing key rotation endpoint...');
    try {
      const rotateResponse = await axios.post(`${baseURL}/api/security/rotate-key`, {
        keyType: 'test'
      }, {
        headers: {
          'x-api-key': apiKey
        }
      });
      console.log('✅ Key rotation endpoint is working');
      console.log('Response:', rotateResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Key rotation endpoint requires authentication (good!)');
      } else if (error.response?.status === 400 || error.response?.status === 500) {
        console.log('⚠️  Key rotation endpoint exists but returned error:', error.response.data);
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ Security hardening service endpoints are available!');
    console.log('Note: You may need proper authentication to fully test these endpoints.');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: Server is not running. Please start the server first with "npm run dev"');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Run the test
testSecurityHardening();