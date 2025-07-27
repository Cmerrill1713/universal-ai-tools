#!/usr/bin/env node

const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Universal AI Tools Test',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>Universal AI Tools - Test Server</h1>
      <p>✅ Server is running</p>
      <p><a href="/health">Health Check</a></p>
    `);
  }
});

const port = 9999;

server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Test server running on http://localhost:${port}`);
  console.log(`🏥 Health: http://localhost:${port}/health`);
  console.log(`🔌 Server bound to 0.0.0.0:${port}`);
  
  const address = server.address();
  console.log(`🔍 Actual address:`, address);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});