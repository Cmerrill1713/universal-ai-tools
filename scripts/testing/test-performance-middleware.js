const axios = require('axios');

async function testPerformanceMiddleware() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('Testing Performance Middleware...\n');

  const baseURL = 'http://localhost:8080';

  try {
    // Test 1: Check if performance metrics endpoint exists
    console.log('1. Testing performance metrics endpoint...');
    const metricsResponse = await axios.get(`${baseURL}/api/performance/metrics`);
    console.log('✅ Performance metrics endpoint is working');
    console.log('Metrics:', JSON.stringify(metricsResponse.data, null, 2));

    // Test 2: Check if performance report endpoint exists
    console.log('\n2. Testing performance report endpoint...');
    const reportResponse = await axios.get(`${baseURL}/api/performance/report?format=json`);
    console.log('✅ Performance report endpoint is working');
    console.log('Report preview:', reportResponse.data.report.text.substring(0, 200) + '...');

    // Test 3: Make a few requests to generate metrics
    console.log('\n3. Making test requests to generate metrics...');
    for (let i = 0; i < 5; i++) {
      await axios.get(`${baseURL}/api/health`);
    }
    console.log('✅ Made 5 test requests');

    // Test 4: Check metrics again
    console.log('\n4. Checking updated metrics...');
    const updatedMetrics = await axios.get(`${baseURL}/api/performance/metrics`);
    console.log('Request count:', updatedMetrics.data.metrics.requestCount);
    console.log('Average response time:', updatedMetrics.data.metrics.averageResponseTime + 'ms');

    console.log('\n✅ Performance middleware is working correctly!');
  } catch (error) {
    if (error.response) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(
        '❌ Error: Server is not running. Please start the server first with "npm run dev"'
      );
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Run the test
testPerformanceMiddleware();
