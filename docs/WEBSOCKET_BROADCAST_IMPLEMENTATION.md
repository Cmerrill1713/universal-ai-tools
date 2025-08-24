# Enhanced WebSocket Real-time Broadcast Service

This document describes the implementation of the enhanced WebSocket broadcasting system for real-time agent state, performance metrics, workflow execution updates, and memory timeline data streaming.

## Overview

The Real-time Broadcast Service provides a comprehensive WebSocket-based solution for streaming live data from the Universal AI Tools backend to connected clients. It supports room-based subscriptions, message buffering, error handling, and health monitoring.

## Architecture

```
Client Applications
        ↓
    Socket.IO Server
        ↓
RealtimeBroadcastService
        ↓
┌─────────────────────────────────────┐
│ Message Types & Broadcasting        │
├─────────────────────────────────────┤
│ • Agent State Changes               │
│ • Performance Metrics (Buffered)    │
│ • Workflow Execution Updates        │
│ • Memory Timeline Events            │
│ • System Alerts                    │
└─────────────────────────────────────┘
```

## Files Created/Modified

### Core Service
- **`src/services/realtime-broadcast-service.ts`** - Main broadcast service
- **`src/services/broadcast-integration-examples.ts`** - Integration examples
- **`src/services/__tests__/realtime-broadcast-service.test.ts`** - Test suite

### Type Definitions
- **`src/types/websocket-client.ts`** - Client-side types and WebSocket client class
- **`src/types/index.ts`** - Updated to export WebSocket types

### Server Integration
- **`src/server.ts`** - Integrated broadcast service with Socket.IO setup
- Added health monitoring endpoints
- Added broadcast testing endpoints

## Message Types

### 1. Agent State Message
```typescript
interface AgentStateMessage {
  type: 'agent_state';
  agentId: string;
  status: 'idle' | 'active' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    activeConnections: number;
  };
  metadata?: Record<string, any>;
  timestamp: number;
}
```

### 2. Performance Metric
```typescript
interface PerformanceMetric {
  type: 'performance_metric';
  metricName: string;
  value: number;
  unit: string;
  category: 'system' | 'agent' | 'network' | 'database';
  agentId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
```

### 3. Workflow Execution Update
```typescript
interface WorkflowExecutionUpdate {
  type: 'workflow_execution';
  workflowId: string;
  executionId: string;
  stage: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  agentId?: string;
  result?: any;
  error?: string;
  timestamp: number;
}
```

### 4. Memory Timeline Data
```typescript
interface MemoryTimelineData {
  type: 'memory_timeline';
  memoryId: string;
  action: 'created' | 'updated' | 'accessed' | 'deleted';
  content?: string;
  importance: number;
  tags: string[];
  agentId?: string;
  timestamp: number;
}
```

### 5. System Alert
```typescript
interface SystemAlert {
  type: 'system_alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}
```

## Room-based Subscriptions

Clients can subscribe to specific data streams using room-based subscriptions:

### Standard Rooms
- `agent_states` - All agent state changes
- `performance_metrics` - System and agent performance metrics
- `workflow_executions` - All workflow execution updates
- `memory_timeline` - Memory operations timeline
- `system_alerts` - System-wide alerts and notifications

### Filtered Rooms
- `agent:${agentId}` - Events for specific agent
- `workflow:${workflowId}` - Events for specific workflow

## API Endpoints

### WebSocket Status
```
GET /api/v1/websocket/status
```
Returns the current status of WebSocket connections and broadcast service health.

### Test Broadcast
```
POST /api/v1/websocket/broadcast/test
```
Sends a test broadcast message to verify the system is working.

### Enhanced Health Check
```
GET /api/v1/health
```
Now includes WebSocket and broadcast service health information.

## Client Usage

### Basic Client Setup

```typescript
import { UniversalAIWebSocketClient } from './types/websocket-client';

const client = new UniversalAIWebSocketClient(
  {
    serverUrl: 'http://localhost:9999',
    subscriptions: {
      rooms: ['agent_states', 'performance_metrics', 'system_alerts']
    }
  },
  {
    onConnect: () => console.log('Connected to Universal AI Tools'),
    onAgentState: (data) => console.log('Agent state:', data),
    onPerformanceMetrics: (data) => console.log('Performance:', data),
    onSystemAlert: (data) => console.log('Alert:', data),
  }
);
```

### Monitoring Client
```typescript
import { createMonitoringClient } from './types/websocket-client';

const monitor = createMonitoringClient(
  'http://localhost:9999',
  (type, data) => {
    console.log(`[${type}]`, data);
    // Update your monitoring dashboard
  }
);
```

### Workflow-specific Client
```typescript
import { createWorkflowClient } from './types/websocket-client';

const workflowClient = createWorkflowClient(
  'http://localhost:9999',
  'my-workflow-id',
  (update) => {
    console.log('Workflow update:', update);
    // Update workflow progress UI
  }
);
```

## Server Integration Examples

### Broadcasting Agent State Changes
```typescript
// In your agent service
const broadcastService = server.getBroadcastService();

if (broadcastService) {
  broadcastService.broadcastAgentState({
    agentId: 'my-agent',
    status: 'active',
    currentTask: 'Processing user request',
    resourceUsage: {
      cpu: 45.2,
      memory: 67.8,
      activeConnections: 3
    }
  });
}
```

### Streaming Performance Metrics
```typescript
// Using the integration helper
import { createBroadcastIntegrations } from './services/broadcast-integration-examples';

const integrations = createBroadcastIntegrations(broadcastService);

// Start streaming system metrics every 5 seconds
integrations.performanceMetrics.startStreaming(5000);
```

### Tracking Workflow Execution
```typescript
const workflowMonitor = integrations.workflowExecution;

// Start workflow
workflowMonitor.startWorkflow('user-request-workflow', 'exec-123', 'agent-1');

// Update progress
workflowMonitor.updateWorkflowProgress('user-request-workflow', 'exec-123', 'processing', 50);

// Complete workflow
workflowMonitor.completeWorkflow('user-request-workflow', 'exec-123', { result: 'success' });
```

## Features

### Performance Optimizations
- **Message Buffering**: Performance metrics are buffered and sent in batches to reduce network overhead
- **Room-based Broadcasting**: Only send messages to clients that have subscribed to relevant rooms
- **Automatic Cleanup**: Resources are properly cleaned up when clients disconnect

### Error Handling
- **Connection Recovery**: Automatic reconnection with exponential backoff
- **Subscription Validation**: Server-side validation of subscription preferences
- **Error Broadcasting**: System errors are automatically broadcast as alerts

### Health Monitoring
- **Service Health**: Built-in health monitoring for the broadcast service itself
- **Client Tracking**: Track number of connected clients and their subscriptions
- **Room Statistics**: Monitor room membership and activity

### Security
- **CORS Configuration**: Proper CORS setup for development and production
- **Input Validation**: All incoming subscription requests are validated
- **Rate Limiting**: Built-in protection against message flooding

## Development and Testing

### Running Tests
```bash
npx jest src/services/__tests__/realtime-broadcast-service.test.ts
```

### Building the Project
```bash
npm run build
```

### Testing WebSocket Connection
```bash
# Start the server
npm run dev

# Test the WebSocket status
curl http://localhost:9999/api/v1/websocket/status

# Send a test broadcast
curl -X POST http://localhost:9999/api/v1/websocket/broadcast/test
```

## Configuration

### Environment Variables
The WebSocket service respects the same CORS and environment variables as the main server:
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Allowed frontend URL for CORS
- `PRODUCTION_URL` - Production URL for CORS

### Customizing Buffer Settings
The service includes configurable buffering for performance metrics:
- `BUFFER_SIZE` - Number of metrics to buffer before flushing (default: 50)
- `BUFFER_FLUSH_INTERVAL` - Time interval for flushing buffers (default: 1000ms)

## Future Enhancements

1. **Authentication Integration**: Add JWT-based authentication for WebSocket connections
2. **Message Persistence**: Optional persistence of critical messages for offline clients
3. **Rate Limiting**: Per-client rate limiting for subscription changes
4. **Compression**: Message compression for large payloads
5. **Clustering Support**: Multi-instance support with Redis adapter

## Troubleshooting

### Common Issues

**WebSocket Connection Fails**
- Check CORS configuration
- Verify server is running on expected port
- Check firewall settings

**No Messages Received**
- Verify subscription to correct rooms
- Check client event handlers are properly set up
- Monitor server logs for broadcast service errors

**Performance Issues**
- Monitor buffer flush intervals
- Check number of connected clients
- Verify message sizes aren't too large

### Debug Mode
Enable debug logging in the client:
```typescript
const client = new UniversalAIWebSocketClient({
  serverUrl: 'http://localhost:9999',
  debug: true
}, handlers);
```

## Conclusion

The Enhanced WebSocket Real-time Broadcast Service provides a robust, scalable foundation for real-time communication in the Universal AI Tools platform. It supports all the requested features including agent state broadcasting, performance streaming, workflow updates, and memory timeline data, with proper error handling, health monitoring, and client management.