import axios from 'axios';

async function testPerformanceMiddleware() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Testing Performance Middleware (Phase 1 Fixes)\n');

  const baseURL = 'http://localhost:9999';

  try {
    console.log('📍 Testing server connectivity...');

    // First test basic connectivity
    try {
      const basicResponse = await axios.get(`${baseURL}/`);
      console.log('✅ Server is accessible');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Server is not running on port 9999');
        console.log('🔄 Trying alternative ports...');

        // Try common development ports
        const ports = [3000, 4000, 5000, 8080];
        let foundPort = null;

        for (const port of ports) {
          try {
            await axios.get(`http://localhost:${port}/`);
            foundPort = port;
            console.log(`✅ Found server running on port ${port}`);
            break;
          } catch (e) {
            // Continue to next port
          }
        }

        if (!foundPort) {
          console.log('❌ Could not find running server on common ports');
          console.log('💡 Please start the server with: npm run dev');
          return;
        }

        // Update baseURL to found port
        const newBaseURL = `http://localhost:${foundPort}`;
        console.log(`🔄 Using server at ${newBaseURL}`);

        // Test basic endpoints on found port
        await testEndpoints(newBaseURL);
        return;
      }
      throw error;
    }

    // Test with original port if connection was successful
    await testEndpoints(baseURL);
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Unexpected error:', error.message);
  }
}

async function testEndpoints(baseURL) {
  console.log(`\n🔍 Testing Performance Middleware on ${baseURL}...\n`);

  const tests = [
    {
      name: '1. Health Check Endpoint',
      url: '/api/health',
      description: 'Testing basic health endpoint with potential Prometheus integration',
    },
    {
      name: '2. Prometheus Metrics Endpoint',
      url: '/metrics',
      description: 'Testing Prometheus metrics endpoint',
    },
    {
      name: '3. Performance Metrics Endpoint',
      url: '/api/performance/metrics',
      description: 'Testing performance metrics collection',
    },
    {
      name: '4. Performance Report Endpoint',
      url: '/api/performance/report',
      description: 'Testing performance report generation',
    },
    {
      name: '5. Performance Report (JSON format)',
      url: '/api/performance/report?format=json',
      description: 'Testing JSON formatted performance report',
    },
  ];

  const results = {
    passed: 0,
    failed: 0,
    details: [],
  };

  for (const test of tests) {
    console.log(`📋 ${test.name}: ${test.description}`);

    try {
      const response = await axios.get(`${baseURL}${test.url}`, {
        timeout: 10000,
      });

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response size: ${JSON.stringify(response.data).length} bytes`);

      // Analyze response content
      if (test.url === '/metrics') {
        // Prometheus metrics should be plain text
        if (typeof response.data === 'string' && response.data.includes('# HELP')) {
          console.log(`   📈 Found Prometheus metrics format`);
          console.log(`   🔢 Metrics count: ${(response.data.match(/# HELP/g) || []).length}`);
        } else {
          console.log(`   ⚠️  Response doesn't appear to be Prometheus format`);
        }
      } else if (test.url.includes('performance')) {
        // Performance endpoints should return JSON
        if (response.data && typeof response.data === 'object') {
          console.log(`   📊 JSON response received`);
          if (response.data.metrics) {
            console.log(`   📈 Metrics object found`);
          }
          if (response.data.report) {
            console.log(`   📋 Report object found`);
          }
        }
      } else if (test.url === '/api/health') {
        // Health endpoint analysis
        if (response.data && response.data.status) {
          console.log(`   💚 Health status: ${response.data.status}`);
        }
        if (response.data && response.data.metrics) {
          console.log(`   📊 Health metrics included`);
        }
      }

      results.passed++;
      results.details.push({
        test: test.name,
        status: 'PASS',
        url: test.url,
        responseStatus: response.status,
        responseSize: JSON.stringify(response.data).length,
      });
    } catch (error) {
      console.log(`   ❌ Failed: ${error.response?.status || error.code || error.message}`);

      if (error.response?.status === 404) {
        console.log(`   💡 Endpoint not implemented yet`);
      } else if (error.response?.status === 503) {
        console.log(`   ⚠️  Service unavailable - middleware might not be initialized`);
      } else if (error.response?.status === 500) {
        console.log(`   🔥 Internal server error - check server logs`);
      }

      results.failed++;
      results.details.push({
        test: test.name,
        status: 'FAIL',
        url: test.url,
        error: error.response?.status || error.code || error.message,
      });
    }

    console.log(''); // Add spacing between tests
  }

  // Generate load to test performance monitoring
  console.log('📈 Generating load to test performance monitoring...');
  const loadPromises = [];
  for (let i = 0; i < 10; i++) {
    loadPromises.push(
      axios.get(`${baseURL}/api/health`).catch(() => {}) // Ignore errors for load test
    );
  }

  await Promise.all(loadPromises);
  console.log('✅ Load generation completed (10 requests)\n');

  // Final summary
  console.log('📊 Performance Middleware Test Summary');
  console.log('=====================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📋 Total Tests: ${results.passed + results.failed}`);

  if (results.passed > 0) {
    console.log('\n🎉 Some performance middleware functionality is working!');
  }

  if (results.failed > 0) {
    console.log('\n⚠️  Issues found:');
    results.details
      .filter((d) => d.status === 'FAIL')
      .forEach((detail) => {
        console.log(`   • ${detail.test}: ${detail.error}`);
      });
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (results.details.some((d) => d.url === '/metrics' && d.status === 'PASS')) {
    console.log('   ✅ Prometheus integration is working');
  } else {
    console.log('   🔧 Prometheus metrics endpoint needs setup');
  }

  if (results.details.some((d) => d.url.includes('performance') && d.status === 'PASS')) {
    console.log('   ✅ Performance monitoring endpoints are functional');
  } else {
    console.log('   🔧 Performance monitoring endpoints need implementation');
  }

  console.log('   📊 Consider monitoring response times and memory usage');
  console.log('   🎯 Implement custom metrics for Sweet Athena interactions');
}

// Run the test
testPerformanceMiddleware();
