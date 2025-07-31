import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Test JWT authentication directly
async function testJWT() {
  // First test health endpoint (no auth required)
  try {
    const healthResponse = await fetch('http://localhost:9999/health');
    console.log('Health check status:', healthResponse.status);
    const healthData = await healthResponse.json();
    console.log('Health data:', JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.error('Health check failed:', error.message);
    return;
  }

  // Generate token with different secrets to test
  const secrets = [
    'device-auth-secret',
    process.env.JWT_SECRET,
    'jwt-secret-key',
    'test-secret'
  ];

  for (const secret of secrets) {
    if (!secret) continue;
    
    console.log(`\nTesting with secret: ${secret}`);
    
    const payload = {
      userId: 'test-user',
      email: 'test@example.com',
      isAdmin: false,
      permissions: ['api_access']
    };
    
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    console.log('Token:', token);
    
    try {
      const response = await fetch('http://localhost:9999/api/v1/device-auth/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
      
      if (response.ok()) {
        console.log('✅ SUCCESS with secret:', secret);
        break;
      }
    } catch (error) {
      console.error('Request failed:', error);
    }
  }
}

testJWT();