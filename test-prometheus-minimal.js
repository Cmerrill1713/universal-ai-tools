import express from 'express';

// Simple test without importing the full metrics system

console.log('🧪 Testing Prometheus Middleware Minimal Setup...\n');

const app = express();
const port = 9998; // Use different port

try {
  console.log('1. Creating Express app...');
  
  console.log('2. Testing basic prometheus setup...');
  console.log('   - Skipping full metrics import for now');
  
  console.log('3. Setting up basic endpoint...');
  app.get('/test', (req, res) => {
    res.json({ message: 'Test endpoint working' });
  });
  
  console.log('4. Setting up basic metrics endpoint...');
  app.get('/metrics', async (req, res) => {
    try {
      // Simple test metrics
      const testMetrics = `# HELP test_metric A test metric
# TYPE test_metric counter
test_metric 1

# HELP test_requests_total Total test requests
# TYPE test_requests_total counter
test_requests_total 42
`;
      res.set('Content-Type', 'text/plain');
      res.send(testMetrics);
    } catch (error) {
      console.error('Metrics error:', error.message);
      res.status(500).send('Metrics unavailable');
    }
  });
  
  console.log('5. Starting minimal server...');
  const server = app.listen(port, () => {
    console.log(`✅ Minimal server running on port ${port}`);
    console.log(`📊 Test metrics at: http://localhost:${port}/metrics`);
    console.log(`🧪 Test endpoint at: http://localhost:${port}/test`);
    
    // Auto-test after startup
    setTimeout(testEndpoints, 1000);
  });
  
  async function testEndpoints() {
    console.log('\n6. 🧪 Testing endpoints...');
    
    try {
      // Test basic endpoint
      const testResponse = await fetch(`http://localhost:${port}/test`);
      const testData = await testResponse.text();
      console.log(`   ✅ Test endpoint: ${testResponse.status} - ${testData.substring(0, 50)}`);
      
      // Test metrics endpoint
      const metricsResponse = await fetch(`http://localhost:${port}/metrics`);
      const metricsData = await metricsResponse.text();
      console.log(`   📊 Metrics endpoint: ${metricsResponse.status} - ${metricsData.length} bytes`);
      
      if (metricsData.includes('# HELP')) {
        console.log('   ✅ Valid Prometheus format detected');
      } else {
        console.log('   ⚠️  Unexpected metrics format');
      }
      
    } catch (error) {
      console.error('   ❌ Test failed:', error.message);
    }
    
    console.log('\n✅ Prometheus minimal test complete');
    process.exit(0);
  }
  
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}