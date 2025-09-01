/**
 * Development HTTPS Server for Universal AI Tools
 * Run this to test HTTPS functionality in development
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL configuration
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'private.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certificate.crt'))
};

// Simple test server
const server = https.createServer(sslOptions, (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy to main application
  const options = {
    hostname: 'localhost',
    port: 9999,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxy = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxy, { end: true });
});

const PORT = 9443; // HTTPS port
server.listen(PORT, () => {
  console.log(`🔒 HTTPS development server running on https://localhost:${PORT}`);
  console.log(`📡 Proxying requests to http://localhost:9999`);
  console.log(``);
  console.log(`🌐 Access your application at:`);
  console.log(`   https://localhost:${PORT}/health`);
  console.log(`   https://localhost:${PORT}/api/v1/status`);
  console.log(``);
  console.log(`⚠️ You may see SSL warnings in your browser.`);
  console.log(`   This is normal for self-signed certificates.`);
  console.log(`   Click "Advanced" -> "Proceed to localhost (unsafe)"`);
});

server.on('error', (err) => {
  console.error('HTTPS server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Try a different port.`);
  }
});
