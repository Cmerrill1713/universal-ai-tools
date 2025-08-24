import axios from 'axios';

async function testServerStatus() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Universal AI Tools - Server Status Test\n');

  const ports = [9999, 3000, 4000, 5000, 8080];
  let serverFound = false;
  let activePort = null;

  console.log('1. 🔍 Scanning for active server...\n');

  for (const port of ports) {
    try {
      const response = await axios.get(`http://localhost:${port}/health`, { timeout: 3000 });
      console.log(`✅ Found server on port ${port}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      serverFound = true;
      activePort = port;
      break;
    } catch (error) {
      console.log(`❌ Port ${port}: ${error.code || error.message}`);
    }
  }

  if (!serverFound) {
    console.log('\n❌ No Universal AI Tools server found on standard ports');
    console.log('💡 Please start the server with: npm run dev');
    return;
  }

  console.log(`\n2. 📊 Testing Performance Middleware on port ${activePort}...\n`);

  const baseURL = `http://localhost:${activePort}`;

  const performanceTests = [
    {
      name: 'Basic Health Check',
      url: '/health',
      expected: 'Basic server health',
    },
    {
      name: 'API Health Check',
      url: '/api/health',
      expected: 'Prometheus-integrated health check',
    },
    {
      name: 'Prometheus Metrics',
      url: '/metrics',
      expected: 'Prometheus metrics in text format',
    },
    {
      name: 'Performance Metrics',
      url: '/api/performance/metrics',
      expected: 'JSON performance metrics',
    },
    {
      name: 'Performance Report',
      url: '/api/performance/report',
      expected: 'Performance report',
    },
    {
      name: 'Performance Report (JSON)',
      url: '/api/performance/report?format=json',
      expected: 'JSON formatted report',
    },
  ];

  const results = [];

  for (const test of performanceTests) {
    console.log(`🧪 ${test.name}: ${test.url}`);

    try {
      const startTime = Date.now();
      const response = await axios.get(`${baseURL}${test.url}`, {
        timeout: 10000,
        validateStatus: () => true, // Accept all status codes
      });
      const responseTime = Date.now() - startTime;

      const isSuccess = response.status < 400;
      const statusIcon = isSuccess ? '✅' : '⚠️';

      console.log(`   ${statusIcon} Status: ${response.status} (${responseTime}ms)`);

      if (isSuccess) {
        const responseText =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        console.log(`   📄 Response preview: ${responseText.substring(0, 80)}...`);

        // Analyze response content
        if (test.url === '/metrics') {
          if (typeof response.data === 'string' && response.data.includes('# HELP')) {
            console.log(`   📈 Valid Prometheus format detected`);
            const metricsCount = (response.data.match(/# HELP/g) || []).length;
            console.log(`   🔢 Metrics count: ${metricsCount}`);
          } else {
            console.log(`   ⚠️  Not standard Prometheus format`);
          }
        } else if (test.url.includes('performance')) {
          if (response.data && typeof response.data === 'object') {
            console.log(`   📊 JSON response structure detected`);
            if (response.data.metrics) console.log(`   📈 Contains metrics object`);
            if (response.data.report) console.log(`   📋 Contains report object`);
            if (response.data.success !== undefined)
              console.log(`   ✔️  Contains success flag: ${response.data.success}`);
          }
        }
      } else {
        console.log(`   ❌ Error: ${response.data?.error || response.statusText}`);
        if (response.status === 503) {
          console.log(`   💡 Service unavailable - performance middleware not initialized`);
        }
      }

      results.push({
        test: test.name,
        url: test.url,
        status: response.status,
        success: isSuccess,
        responseTime,
        hasMetrics: !!response.data?.metrics,
        hasReport: !!response.data?.report,
      });
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.code || error.message}`);
      results.push({
        test: test.name,
        url: test.url,
        error: error.code || error.message,
        success: false,
      });
    }

    console.log(''); // Add spacing
  }

  console.log('3. 📈 Generating test load...\n');

  // Generate some load to test performance monitoring
  const loadRequests = [];
  for (let i = 0; i < 15; i++) {
    loadRequests.push(
      axios.get(`${baseURL}/health`, { timeout: 5000 }).catch(() => ({})) // Ignore individual failures
    );
  }

  const startLoadTime = Date.now();
  await Promise.all(loadRequests);
  const loadTime = Date.now() - startLoadTime;
  console.log(`✅ Generated 15 requests in ${loadTime}ms`);

  // Re-test metrics after load
  console.log('\n4. 📊 Re-testing metrics after load generation...\n');

  try {
    const metricsResponse = await axios.get(`${baseURL}/metrics`, { timeout: 5000 });
    if (typeof metricsResponse.data === 'string') {
      const httpMetrics = metricsResponse.data.includes('http_requests_total');
      const performanceMetrics = metricsResponse.data.includes('response_time');
      console.log(`📊 HTTP metrics present: ${httpMetrics ? '✅' : '❌'}`);
      console.log(`⏱️  Performance metrics present: ${performanceMetrics ? '✅' : '❌'}`);
    }
  } catch (error) {
    console.log(`❌ Metrics re-test failed: ${error.message}`);
  }

  console.log('\n📋 Summary Report');
  console.log('================');

  const passed = results.filter((r) => r.success).length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === 0) {
    console.log('\n🚨 Critical: No performance endpoints are working');
    console.log('💡 Recommendations:');
    console.log('   1. Check if PerformanceMiddleware is properly imported and initialized');
    console.log('   2. Verify Prometheus middleware is enabled');
    console.log('   3. Check server logs for initialization errors');
  } else if (passed < total) {
    console.log('\n⚠️  Partial functionality detected');
    console.log('💡 Issues found:');
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        console.log(`   • ${result.test}: ${result.error || 'HTTP ' + result.status}`);
      });
  } else {
    console.log('\n🎉 All performance middleware endpoints are working!');
  }

  console.log('\n🔧 Implementation Status:');
  const hasPrometheus = results.some((r) => r.url === '/metrics' && r.success);
  const hasPerformanceAPI = results.some((r) => r.url.includes('performance') && r.success);
  const hasHealthCheck = results.some((r) => r.url === '/api/health' && r.success);

  console.log(`   📈 Prometheus Integration: ${hasPrometheus ? '✅ Working' : '❌ Not working'}`);
  console.log(`   📊 Performance API: ${hasPerformanceAPI ? '✅ Working' : '❌ Not working'}`);
  console.log(`   💚 Health Checks: ${hasHealthCheck ? '✅ Working' : '❌ Not working'}`);

  console.log('\n📊 Performance Middleware Assessment:');
  if (hasPrometheus && hasPerformanceAPI && hasHealthCheck) {
    console.log('   🎯 Status: FULLY FUNCTIONAL');
    console.log('   ✅ All Phase 1 performance monitoring features are working');
  } else if (hasPrometheus || hasPerformanceAPI) {
    console.log('   🔄 Status: PARTIALLY FUNCTIONAL');
    console.log('   ⚠️  Some performance monitoring features are working');
  } else {
    console.log('   ❌ Status: NOT FUNCTIONAL');
    console.log('   🔧 Performance middleware needs to be properly initialized');
  }
}

testServerStatus().catch(console.error);
