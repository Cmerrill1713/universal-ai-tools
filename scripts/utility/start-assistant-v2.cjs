#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3003;

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
    '.ico': 'image/x-icon'
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

    // Default to v2 assistant dashboard
    if (pathname === '/') {
        pathname = '/comprehensive-assistant-v2.html';
    }

    // Remove leading slash for file system
    const filePath = path.join(__dirname, pathname);
    
    console.log(`🤖 Request: ${req.method} ${req.url} -> ${filePath}`);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, {'Content-Type': 'text/html'});
                res.end(`
                    <h1>404 - File Not Found</h1>
                    <p>Could not find: ${pathname}</p>
                    <p><a href="/">Go to AI Assistant v2</a></p>
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
    console.log('🚀 Universal AI Tools - Model-Agnostic Assistant v2');
    console.log('================================================');
    console.log(`🤖 AI Assistant v2: http://localhost:${PORT}`);
    console.log('');
    console.log('✨ New Features:');
    console.log('  🎯 Model-Agnostic: Auto-selects best model for each task');
    console.log('  ⚡ Draft Models: Uses fast draft models for quick responses');
    console.log('  🔄 Smart Fallback: Automatically switches models if one fails');
    console.log('  📊 Capability Routing: Routes queries to specialized models');
    console.log('  🏠 Local First: Prefers local models (LM Studio/Ollama)');
    console.log('');
    console.log('🔧 Model Support:');
    console.log('  - LM Studio (Port 1234) - With draft model support');
    console.log('  - Ollama (Port 11434) - Fast local inference');
    console.log('  - Go API Gateway (Port 8092) - Enhanced reasoning');
    console.log('');
    console.log('📈 Strategies:');
    console.log('  - Auto-Select: Smart selection based on query complexity');
    console.log('  - Speed Priority: Uses draft models for fastest response');
    console.log('  - Quality Priority: Uses best models for accuracy');
    console.log('  - Balanced: Optimizes for both speed and quality');
    console.log('  - Local Only: Uses only local models (privacy mode)');
    console.log('');
    console.log('💡 The assistant will automatically detect available models');
    console.log('   and route your queries appropriately!');
    console.log('');
    console.log('🌐 Open http://localhost:' + PORT + ' in your browser to start!');
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
    console.log('\n👋 Shutting down AI Assistant v2 server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});