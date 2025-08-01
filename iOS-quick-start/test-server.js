// Simple test server - no dependencies needed
const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} from ${req.connection.remoteAddress}`);
  
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.url === '/api/v1/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      status: 'healthy',
      message: 'Personality System Ready!',
      device: 'Optimized for iPhone',
      features: {
        personalityAnalysis: true,
        mobileOptimization: true,
        modelSize: '250MB for iPhone'
      }
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 9999;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Test server running!`);
  console.log(`\n📱 For your iPhone app, use:`);
  console.log(`   http://YOUR_MAC_IP:${PORT}/api/v1/health\n`);
  console.log(`🔍 Find your Mac's IP with:`);
  console.log(`   ifconfig | grep "inet " | grep -v 127.0.0.1\n`);
  console.log(`✅ Server is ready for connections!\n`);
});