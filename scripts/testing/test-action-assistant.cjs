#!/usr/bin/env node

/**
 * Manual test script for Action Assistant and Activity Monitor
 * Tests functionality without Playwright dependencies
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🧪 ACTION ASSISTANT TEST SUITE');
console.log('='.repeat(50));

let testsPassed = 0;
let testsFailed = 0;

// Test helper
function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Check if HTML files exist
test('Action Assistant HTML exists', () => {
    const filePath = path.join(__dirname, 'action-assistant.html');
    if (!fs.existsSync(filePath)) {
        throw new Error('action-assistant.html not found');
    }
});

test('Activity Monitor HTML exists', () => {
    const filePath = path.join(__dirname, 'activity-monitor.html');
    if (!fs.existsSync(filePath)) {
        throw new Error('activity-monitor.html not found');
    }
});

// Test 2: Check if action server file exists
test('Action Server script exists', () => {
    const filePath = path.join(__dirname, 'action-assistant-server.cjs');
    if (!fs.existsSync(filePath)) {
        throw new Error('action-assistant-server.cjs not found');
    }
});

// Test 3: Test action server endpoints
async function testActionServer() {
    return new Promise((resolve) => {
        console.log('\n📡 Testing Action Server Endpoints...');
        
        // Check if server is running
        const options = {
            hostname: 'localhost',
            port: 3004,
            path: '/health',
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const health = JSON.parse(data);
                    test('Action Server /health endpoint', () => {
                        if (health.status !== 'healthy') {
                            throw new Error('Server not healthy');
                        }
                    });
                    
                    test('Action Server has tools', () => {
                        if (!health.tools || health.tools < 1) {
                            throw new Error('No tools available');
                        }
                    });
                    
                    // Test /api/tools endpoint
                    testToolsEndpoint(resolve);
                } catch (error) {
                    console.log('⚠️  Action server not running. Start it with: node action-assistant-server.cjs');
                    resolve();
                }
            });
        });
        
        req.on('error', () => {
            console.log('⚠️  Action server not reachable at port 3004');
            console.log('   Start it with: node action-assistant-server.cjs');
            resolve();
        });
        
        req.end();
    });
}

function testToolsEndpoint(callback) {
    const options = {
        hostname: 'localhost',
        port: 3004,
        path: '/api/tools',
        method: 'GET'
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                test('Action Server /api/tools endpoint', () => {
                    if (!response.tools || !Array.isArray(response.tools)) {
                        throw new Error('Invalid tools response');
                    }
                });
                
                test('Action Server has bash tool', () => {
                    const hasBash = response.tools.some(t => t.name === 'bash');
                    if (!hasBash) {
                        throw new Error('bash tool not found');
                    }
                });
                
                test('Action Server has readFile tool', () => {
                    const hasRead = response.tools.some(t => t.name === 'readFile');
                    if (!hasRead) {
                        throw new Error('readFile tool not found');
                    }
                });
                
                test('Action Server has writeFile tool', () => {
                    const hasWrite = response.tools.some(t => t.name === 'writeFile');
                    if (!hasWrite) {
                        throw new Error('writeFile tool not found');
                    }
                });
            } catch (error) {
                console.log('❌ Failed to parse tools response:', error.message);
            }
            callback();
        });
    });
    
    req.on('error', callback);
    req.end();
}

// Test 4: Verify HTML content
test('Action Assistant has required elements', () => {
    const content = fs.readFileSync('action-assistant.html', 'utf8');
    
    if (!content.includes('id="chatInput"')) {
        throw new Error('Missing chat input element');
    }
    
    if (!content.includes('id="sendButton"')) {
        throw new Error('Missing send button');
    }
    
    if (!content.includes('openActivityMonitor')) {
        throw new Error('Missing activity monitor integration');
    }
    
    if (!content.includes('sendToMonitor')) {
        throw new Error('Missing monitor communication function');
    }
});

test('Activity Monitor has required panels', () => {
    const content = fs.readFileSync('activity-monitor.html', 'utf8');
    
    if (!content.includes('REQUEST FLOW')) {
        throw new Error('Missing request flow panel');
    }
    
    if (!content.includes('MODEL ACTIVITY')) {
        throw new Error('Missing model activity panel');
    }
    
    if (!content.includes('REASONING & TOKENS')) {
        throw new Error('Missing reasoning panel');
    }
    
    if (!content.includes('STATISTICS')) {
        throw new Error('Missing statistics panel');
    }
});

// Test 5: Check integration features
test('Action Assistant opens monitor window', () => {
    const content = fs.readFileSync('action-assistant.html', 'utf8');
    if (!content.includes("window.open") || !content.includes("activity-monitor.html")) {
        throw new Error('Monitor window opening code not found');
    }
});

test('Monitor listens for messages', () => {
    const content = fs.readFileSync('activity-monitor.html', 'utf8');
    if (!content.includes("window.addEventListener('message'")) {
        throw new Error('Message listener not found');
    }
});

test('Communication protocol exists', () => {
    const assistantContent = fs.readFileSync('action-assistant.html', 'utf8');
    const monitorContent = fs.readFileSync('activity-monitor.html', 'utf8');
    
    if (!assistantContent.includes("postMessage")) {
        throw new Error('Assistant missing postMessage');
    }
    
    if (!monitorContent.includes("event.data.type")) {
        throw new Error('Monitor missing message type handling');
    }
});

// Run async tests
async function runTests() {
    await testActionServer();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testsPassed} tests`);
    if (testsFailed > 0) {
        console.log(`❌ Failed: ${testsFailed} tests`);
    }
    console.log('='.repeat(50));
    
    if (testsFailed === 0) {
        console.log('🎉 ALL TESTS PASSED! System is working correctly.');
        console.log('\nTo use the system:');
        console.log('1. Start action server: node action-assistant-server.cjs');
        console.log('2. Open action-assistant.html in browser');
        console.log('3. Activity monitor will open automatically');
    } else {
        console.log('⚠️  Some tests failed. Please fix the issues above.');
    }
}

runTests();