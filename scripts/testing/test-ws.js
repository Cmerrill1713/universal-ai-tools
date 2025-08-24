const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:8888');

ws.on('open', () => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('✅ WebSocket connected!');
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('❌ WebSocket error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Connection timeout');
  process.exit(1);
}, 5000);
