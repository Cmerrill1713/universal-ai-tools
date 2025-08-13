/**
 * Test User Preferences API Endpoints
 * Tests the actual API endpoints via HTTP requests
 */

const http = require('http');

async function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 9999,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-api',
        ...headers,
      },
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testUserPreferencesAPI() {
  console.log('🧪 Testing User Preferences API Endpoints...\n');
  
  try {
    console.log('1. Testing health check...');
    try {
      const health = await makeRequest('GET', '/api/v1/user-preferences/health');
      console.log(`✅ Health check: ${health.statusCode} - ${health.data.data?.status || health.data.status}`);
    } catch (error) {
      console.log(`❌ Health check failed: ${error.message}`);
    }
    console.log('');

    console.log('2. Testing model recommendations...');
    try {
      const recommendations = await makeRequest('POST', '/api/v1/user-preferences/recommendations', {
        context: {
          taskType: 'coding',
          complexity: 0.8,
          urgency: 0.6,
          creativity: 0.2,
          technicalLevel: 0.9,
        },
        topN: 3,
      });
      console.log(`✅ Recommendations: ${recommendations.statusCode}`);
      if (recommendations.data.data) {
        console.log(`   Found ${recommendations.data.data.recommendations?.length || 0} recommendations`);
      }
    } catch (error) {
      console.log(`❌ Recommendations failed: ${error.message}`);
    }
    console.log('');

    console.log('3. Testing model selection...');
    try {
      const selection = await makeRequest('POST', '/api/v1/user-preferences/select-model', {
        context: {
          taskType: 'writing',
          complexity: 0.6,
          creativity: 0.8,
        },
      });
      console.log(`✅ Model selection: ${selection.statusCode}`);
      if (selection.data.data) {
        console.log(`   Selected: ${selection.data.data.selectedModel || 'N/A'}`);
      }
    } catch (error) {
      console.log(`❌ Model selection failed: ${error.message}`);
    }
    console.log('');

    console.log('4. Testing interaction recording...');
    try {
      const interaction = await makeRequest('POST', '/api/v1/user-preferences/interactions', {
        sessionId: 'test-session-123',
        interactionType: 'response_rating',
        modelId: 'gpt-4',
        providerId: 'openai',
        rating: 4,
        feedback: 'Good response quality',
        taskType: 'coding',
        responseTime: 2500,
      });
      console.log(`✅ Interaction recording: ${interaction.statusCode}`);
    } catch (error) {
      console.log(`❌ Interaction recording failed: ${error.message}`);
    }
    console.log('');

    console.log('5. Testing feedback recording...');
    try {
      const feedback = await makeRequest('POST', '/api/v1/user-preferences/feedback', {
        sessionId: 'test-session-124',
        modelId: 'claude-3',
        providerId: 'anthropic',
        rating: 5,
        feedback: 'Excellent response!',
      });
      console.log(`✅ Feedback recording: ${feedback.statusCode}`);
    } catch (error) {
      console.log(`❌ Feedback recording failed: ${error.message}`);
    }
    console.log('');

    console.log('6. Testing user insights...');
    try {
      const insights = await makeRequest('GET', '/api/v1/user-preferences/insights');
      console.log(`✅ User insights: ${insights.statusCode}`);
      if (insights.data.data) {
        console.log(`   Models: ${insights.data.data.topModels?.length || 0}`);
        console.log(`   Tasks: ${insights.data.data.preferredTasks?.length || 0}`);
      }
    } catch (error) {
      console.log(`❌ User insights failed: ${error.message}`);
    }
    console.log('');

    console.log('7. Testing model preferences...');
    try {
      const models = await makeRequest('GET', '/api/v1/user-preferences/models?limit=5');
      console.log(`✅ Model preferences: ${models.statusCode}`);
      if (models.data.data) {
        console.log(`   Found ${models.data.data.models?.length || 0} model preferences`);
      }
    } catch (error) {
      console.log(`❌ Model preferences failed: ${error.message}`);
    }
    console.log('');

    console.log('8. Testing task preferences...');
    try {
      const tasks = await makeRequest('GET', '/api/v1/user-preferences/tasks');
      console.log(`✅ Task preferences: ${tasks.statusCode}`);
    } catch (error) {
      console.log(`❌ Task preferences failed: ${error.message}`);
    }
    console.log('');

    console.log('9. Testing general preferences update...');
    try {
      const update = await makeRequest('PUT', '/api/v1/user-preferences/general', {
        responseSpeed: 'fast',
        creativityLevel: 0.8,
        preferredTone: 'friendly',
      });
      console.log(`✅ General preferences update: ${update.statusCode}`);
    } catch (error) {
      console.log(`❌ General preferences update failed: ${error.message}`);
    }
    console.log('');

    console.log('10. Testing analytics endpoint...');
    try {
      const analytics = await makeRequest('GET', '/api/v1/user-preferences/analytics');
      console.log(`✅ Analytics: ${analytics.statusCode}`);
    } catch (error) {
      console.log(`❌ Analytics failed: ${error.message}`);
    }
    console.log('');

    console.log('11. Testing error handling...');
    try {
      const errorTest = await makeRequest('POST', '/api/v1/user-preferences/interactions', {
        // Missing required fields
        sessionId: 'test-session-error',
      });
      console.log(`✅ Error handling: ${errorTest.statusCode} (should be 4xx)`);
    } catch (error) {
      console.log(`✅ Error handling: Request failed as expected`);
    }
    console.log('');

    console.log('🎉 API endpoint testing completed!\n');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
console.log('⚠️  This test requires the server to be running on port 9999');
console.log('   Please start the server with: npm run dev');
console.log('   Then run this test in another terminal\n');

testUserPreferencesAPI();