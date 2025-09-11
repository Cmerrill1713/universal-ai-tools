import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const server = createServer();
const wss = new WebSocketServer({ server });

console.log('Starting Pixel Streaming Signaling Server...');

let streamer = null;
const players = new Map();

wss.on('connection', (ws) => {
    console.log('New connection');
    
    ws.on('message', (message) => {
        const msg = message.toString();
        console.log('Received:', msg.substring(0, 50) + '...');
        
        // Broadcast to all other clients
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(msg);
            }
        });
    });
    
    ws.on('close', () => {
        console.log('Connection closed');
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

server.listen(8080, () => {
    console.log('Signaling server running on ws://localhost:8080');
    console.log('Ready for connections...');
});