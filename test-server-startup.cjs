const { spawn } = require('child_process');

console.log('Testing server startup...');

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  cwd: process.cwd()
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('[STDOUT]', text.trim());
  
  // Check for success indicators
  if (text.includes('Server running') || text.includes('listening') || text.includes('started')) {
    console.log('✅ Server appears to be starting successfully!');
    server.kill();
    process.exit(0);
  }
});

server.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.log('[STDERR]', text.trim());
  
  // Check for syntax errors
  if (text.includes('TransformError') || text.includes('SyntaxError') || text.includes('ERROR:')) {
    console.log('❌ Syntax error detected:');
    console.log(text);
    server.kill();
    process.exit(1);
  }
});

server.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Server started successfully');
  } else {
    console.log(`❌ Server failed to start (exit code: ${code})`);
  }
  process.exit(code);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Timeout reached - killing server');
  server.kill();
  
  if (errorOutput.includes('TransformError') || errorOutput.includes('ERROR:')) {
    console.log('❌ Server failed due to syntax errors');
    process.exit(1);
  } else {
    console.log('✅ No immediate syntax errors detected');
    process.exit(0);
  }
}, 30000);