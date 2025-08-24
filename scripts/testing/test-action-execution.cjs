// Test that actions are actually executed
const http = require('http');

async function testActionExecution() {
    console.log('🧪 Testing Action Execution...\n');
    
    // Test a simple bash command
    const testAction = {
        tool: 'bash',
        parameters: { command: 'echo "Test action executed successfully!"' }
    };
    
    const options = {
        hostname: 'localhost',
        port: 3004,
        path: '/api/execute',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ Response received:');
                    console.log('   Success:', result.success);
                    console.log('   Output:', result.stdout || result.output);
                    
                    if (result.success) {
                        console.log('\n🎉 Action execution is working!');
                    } else {
                        console.log('\n❌ Action failed:', result.error);
                    }
                    resolve();
                } catch (error) {
                    console.log('❌ Failed to parse response:', error);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.log('❌ Request failed:', error.message);
            reject(error);
        });
        
        req.write(JSON.stringify(testAction));
        req.end();
    });
}

// Run the test
testActionExecution().catch(console.error);
