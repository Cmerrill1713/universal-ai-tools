/**
 * WebSocket API Documentation
 * Real-time communication endpoints and events
 */

// WebSocket OpenAPI definitions
interface WebSocketSpec {
  [key: string]: any;
}

export function getWebSocketDocumentation(): WebSocketSpec {
  return {
    '/ws/chat': {
      get: {
        tags: ['WebSocket', 'Chat'],
        summary: 'Real-time chat WebSocket',
        description: `
Establish a WebSocket connection for real-time chat communication.

## Connection URL
\`\`\`
wss://api.universal-ai-tools.com/api/v1/ws/chat
\`\`\`

## Authentication
Include authentication in the connection URL or as the first message:
\`\`\`javascript
// URL authentication
const ws = new WebSocket('wss://api.universal-ai-tools.com/api/v1/ws/chat?token=YOUR_JWT_TOKEN');

// Message authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'YOUR_JWT_TOKEN'
}));
\`\`\`

## Message Format

### Client to Server Messages

#### Send Message
\`\`\`json
{
  "type": "message",
  "data": {
    "content": "Hello, how can you help?",
    "conversationId": "uuid", // optional
    "agentName": "assistant", // optional
    "stream": true // optional
  }
}
\`\`\`

#### Subscribe to Events
\`\`\`json
{
  "type": "subscribe",
  "data": {
    "events": ["agent_status", "typing_indicator"]
  }
}
\`\`\`

#### Ping (Keep-alive)
\`\`\`json
{
  "type": "ping"
}
\`\`\`

### Server to Client Messages

#### Message Response
\`\`\`json
{
  "type": "response",
  "data": {
    "content": "I can help you with...",
    "messageId": "uuid",
    "agentName": "assistant",
    "complete": false // true when message is complete
  }
}
\`\`\`

#### Stream Chunk
\`\`\`json
{
  "type": "stream",
  "data": {
    "chunk": "Next part of the response...",
    "messageId": "uuid",
    "complete": false
  }
}
\`\`\`

#### Error
\`\`\`json
{
  "type": "error",
  "data": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
\`\`\`

#### Agent Status
\`\`\`json
{
  "type": "agent_status",
  "data": {
    "agentName": "assistant",
    "status": "typing" // "idle", "typing", "thinking"
  }
}
\`\`\`

## Connection Lifecycle

1. **Connect**: Establish WebSocket connection
2. **Authenticate**: Send auth token
3. **Subscribe**: Subscribe to desired events
4. **Communicate**: Exchange messages
5. **Disconnect**: Close connection gracefully

## Error Codes

- \`AUTH_REQUIRED\`: Authentication needed
- \`INVALID_TOKEN\`: Invalid or expired token
- \`RATE_LIMIT\`: Too many messages
- \`INVALID_MESSAGE\`: Malformed message format
- \`AGENT_UNAVAILABLE\`: Requested agent is not available
        `.trim(),
        operationId: 'chatWebSocket',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        parameters: [
          {
            name: 'token',
            in: 'query',
            description: 'JWT token for authentication (alternative to header)',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '101': {
            description: 'Switching Protocols - WebSocket connection established',
            headers: {
              'Upgrade': {
                schema: { type: 'string', example: 'websocket' }
              },
              'Connection': {
                schema: { type: 'string', example: 'Upgrade' }
              },
              'Sec-WebSocket-Accept': {
                schema: { type: 'string' }
              }
            }
          },
          '401': { 
            description: 'Unauthorized - Invalid or missing authentication',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '426': {
            description: 'Upgrade Required - Client must upgrade to WebSocket',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    
    '/ws/agents': {
      get: {
        tags: ['WebSocket', 'Agents'],
        summary: 'Agent coordination WebSocket',
        description: `
Establish a WebSocket connection for real-time agent coordination and monitoring.

## Features

- Monitor agent status in real-time
- Coordinate multi-agent workflows
- Receive agent performance metrics
- Handle agent handoffs

## Message Types

### Client Messages

#### Execute Agent Task
\`\`\`json
{
  "type": "execute",
  "data": {
    "agentName": "code-assistant",
    "task": "Review this code",
    "context": {},
    "priority": "high"
  }
}
\`\`\`

#### Monitor Agents
\`\`\`json
{
  "type": "monitor",
  "data": {
    "agents": ["agent1", "agent2"],
    "metrics": true
  }
}
\`\`\`

### Server Messages

#### Agent Update
\`\`\`json
{
  "type": "agent_update",
  "data": {
    "agentName": "code-assistant",
    "status": "processing",
    "progress": 0.75,
    "eta": 5000
  }
}
\`\`\`

#### Task Complete
\`\`\`json
{
  "type": "task_complete",
  "data": {
    "taskId": "uuid",
    "agentName": "code-assistant",
    "result": "Task completed successfully",
    "executionTime": 1234,
    "metadata": {}
  }
}
\`\`\`

#### Agent Metrics
\`\`\`json
{
  "type": "metrics",
  "data": {
    "agentName": "code-assistant",
    "tasksCompleted": 150,
    "averageTime": 2500,
    "successRate": 0.98,
    "currentLoad": 0.65
  }
}
\`\`\`
        `.trim(),
        operationId: 'agentWebSocket',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        responses: {
          '101': {
            description: 'WebSocket connection established'
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '426': {
            description: 'Upgrade Required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    
    '/ws/notifications': {
      get: {
        tags: ['WebSocket'],
        summary: 'System notifications WebSocket',
        description: `
Receive real-time system notifications and alerts.

## Notification Types

### System Events
\`\`\`json
{
  "type": "system",
  "data": {
    "event": "maintenance",
    "message": "Scheduled maintenance in 1 hour",
    "severity": "info",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
\`\`\`

### Rate Limit Warnings
\`\`\`json
{
  "type": "rate_limit",
  "data": {
    "remaining": 10,
    "reset": 1704110400,
    "limit": 100
  }
}
\`\`\`

### Service Status
\`\`\`json
{
  "type": "service_status",
  "data": {
    "service": "vision-api",
    "status": "degraded",
    "message": "Experiencing higher latency"
  }
}
\`\`\`
        `.trim(),
        operationId: 'notificationWebSocket',
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        responses: {
          '101': {
            description: 'WebSocket connection established'
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    }
  };
}

/**
 * Generate WebSocket client examples
 */
export function getWebSocketExamples(): Record<string, string> {
  return {
    javascript: `
// JavaScript WebSocket Example
const ws = new WebSocket('wss://api.universal-ai-tools.com/api/v1/ws/chat');

ws.onopen = () => {
  console.log('Connected to WebSocket');
  
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));
  
  // Send a message
  ws.send(JSON.stringify({
    type: 'message',
    data: {
      content: 'Hello!',
      stream: true
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'response':
      console.log('Response:', message.data.content);
      break;
    case 'stream':
      process.stdout.write(message.data.chunk);
      break;
    case 'error':
      console.error('Error:', message.data.message);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};
`,
    typescript: `
// TypeScript WebSocket Example
interface WSMessage {
  type: string;
  data: any;
}

class UniversalAIWebSocket {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  
  constructor(private token: string) {
    this.connect();
  }
  
  private connect(): void {
    this.ws = new WebSocket('wss://api.universal-ai-tools.com/api/v1/ws/chat');
    
    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
      this.authenticate();
    };
    
    this.ws.onmessage = (event: MessageEvent) => {
      const message: WSMessage = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      this.handleReconnect();
    };
  }
  
  private authenticate(): void {
    this.send({
      type: 'auth',
      token: this.token
    });
  }
  
  private handleMessage(message: WSMessage): void {
    switch(message.type) {
      case 'response':
        this.onResponse(message.data);
        break;
      case 'stream':
        this.onStream(message.data);
        break;
      case 'error':
        this.onError(message.data);
        break;
    }
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++;
      console.log(\`Reconnecting... (attempt \${this.reconnectAttempts})\`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }
  
  public sendMessage(content: string, options?: any): void {
    this.send({
      type: 'message',
      data: {
        content,
        ...options
      }
    });
  }
  
  private send(data: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  protected onResponse(data: any): void {
    // Override in subclass
  }
  
  protected onStream(data: any): void {
    // Override in subclass
  }
  
  protected onError(data: any): void {
    console.error('Error:', data);
  }
}

// Usage
const client = new UniversalAIWebSocket('YOUR_JWT_TOKEN');
client.sendMessage('Hello, how can you help?', { stream: true });
`,
    python: `
# Python WebSocket Example
import asyncio
import websockets
import json

class UniversalAIWebSocket:
    def __init__(self, token):
        self.token = token
        self.uri = 'wss://api.universal-ai-tools.com/api/v1/ws/chat'
    
    async def connect(self):
        async with websockets.connect(self.uri) as websocket:
            # Authenticate
            await websocket.send(json.dumps({
                'type': 'auth',
                'token': self.token
            }))
            
            # Send message
            await websocket.send(json.dumps({
                'type': 'message',
                'data': {
                    'content': 'Hello!',
                    'stream': True
                }
            }))
            
            # Listen for responses
            async for message in websocket:
                data = json.loads(message)
                await self.handle_message(data)
    
    async def handle_message(self, message):
        msg_type = message.get('type')
        
        if msg_type == 'response':
            print(f"Response: {message['data']['content']}")
        elif msg_type == 'stream':
            print(message['data']['chunk'], end='')
        elif msg_type == 'error':
            print(f"Error: {message['data']['message']}")
    
    def run(self):
        asyncio.run(self.connect())

# Usage
client = UniversalAIWebSocket('YOUR_JWT_TOKEN')
client.run()
`,
    socketio: `
// Socket.IO Client Example (Alternative to WebSocket)
import { io } from 'socket.io-client';

const socket = io('https://api.universal-ai-tools.com', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO');
  
  // Join a room
  socket.emit('join', { room: 'chat' });
  
  // Send a message
  socket.emit('message', {
    content: 'Hello!',
    conversationId: 'uuid'
  });
});

socket.on('response', (data) => {
  console.log('Response:', data);
});

socket.on('stream', (chunk) => {
  process.stdout.write(chunk);
});

socket.on('agent_status', (status) => {
  console.log('Agent status:', status);
});

socket.on('error', (error) => {
  console.error('Error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
`
  };
}