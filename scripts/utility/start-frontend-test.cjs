#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3001;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;

    // Default to index.html
    if (pathname === '/') {
        pathname = '/frontend-test-dashboard.html';
    }

    // Remove leading slash for file system
    const filePath = path.join(__dirname, pathname);
    
    console.log(`📡 Request: ${req.method} ${req.url} -> ${filePath}`);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, {'Content-Type': 'text/html'});
                res.end(`
                    <h1>404 - File Not Found</h1>
                    <p>Could not find: ${pathname}</p>
                    <p><a href="/">Go to Dashboard</a></p>
                `);
            } else {
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.end('Internal Server Error');
            }
            return;
        }

        // Determine content type
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        res.writeHead(200, {'Content-Type': contentType});
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('🚀 Universal AI Tools Frontend Test Server');
    console.log('=====================================');
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}/frontend-test-dashboard.html`);
    console.log('');
    console.log('🔧 Backend Services:');
    console.log('  - API Gateway:           http://localhost:8080');
    console.log('  - Database Automation:   http://localhost:8086');
    console.log('  - Documentation Gen:     http://localhost:8087'); 
    console.log('  - ML Model Management:   http://localhost:8088');
    console.log('  - Performance Optimizer: http://localhost:8085');
    console.log('');
    console.log('💡 Open the dashboard URL in your browser to start testing!');
    console.log('   All API calls will go directly to the backend services.');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
    }
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down frontend test server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});