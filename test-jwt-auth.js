const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

// Test JWT authentication
async function testJWT() {
  // Generate a test token
  const payload = {
    userId: 'test-user',
    email: 'test@example.com',
    isAdmin: false,
    permissions: ['api_access']
  };
  
  const secret = 'device-auth-secret';
  const token = jwt.sign(payload, secret);
  
  console.log('Generated token:', token);
  console.log('Decoded:', jwt.decode(token));
  
  // Test the health endpoint first
  try {
    const healthResponse = await fetch('http://localhost:9999/health');
    console.log('Health check status:', healthResponse.status);
    const healthData = await healthResponse.json();
    console.log('Health data:', healthData);
  } catch (error) {
    console.error('Health check failed:', error.message);
    console.log('Server might not be running on port 9999');
    return;
  }
  
  // Test authenticated endpoint
  try {
    const response = await fetch('http://localhost:9999/api/v1/device-auth/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Auth test status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Auth test failed:', error);
  }
}

testJWT();