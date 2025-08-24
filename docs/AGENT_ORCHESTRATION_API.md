# Agent Orchestration API for Arc UI

This document describes the enhanced agent orchestration endpoints designed specifically for the Arc UI dashboard.

## Base URL
```
http://localhost:9999/api/v1/agent-orchestration
```

## WebSocket Connection
```
ws://localhost:9999/ws/orchestration
```

## REST Endpoints

### 1. Agent Status and Health Monitoring

**GET /status**
- Returns comprehensive status of all agents
- Includes real-time health metrics, load status, and capabilities
- Authentication required

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "name": "planner",
        "category": "core",
        "description": "Strategic task planning...",
        "isLoaded": true,
        "status": "online",
        "trustLevel": 0.9,
        "collaborationScore": 0.8,
        "queueLength": 2,
        "metrics": {
          "totalRequests": 145,
          "averageResponseTime": 1250,
          "successRate": 0.97,
          "cpuUsage": 15.2,
          "memoryUsage": 128.5
        }
      }
    ],
    "summary": {
      "totalAgents": 12,
      "onlineAgents": 8,
      "meshHealth": 0.85
    }
  }
}
```

### 2. Network Topology Visualization

**GET /topology**
- Returns network topology data for graph visualization
- Includes nodes (agents) and edges (dependencies/communications)

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "planner",
        "name": "planner",
        "category": "core",
        "status": "online",
        "capabilities": ["planning", "task_decomposition"],
        "position": { "x": 200, "y": 150 }
      }
    ],
    "edges": [
      {
        "source": "planner",
        "target": "synthesizer",
        "type": "dependency",
        "weight": 1,
        "lastActive": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### 3. Performance Metrics and Analytics

**GET /metrics**
- Returns performance metrics for agents
- Supports filtering by agent name and time range

**Query Parameters:**
- `timeRange`: `1h`, `6h`, `24h`, `7d` (default: `1h`)
- `agentName`: Filter by specific agent

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "agentName": "planner",
        "totalRequests": 145,
        "averageResponseTime": 1250,
        "successRate": 0.97,
        "errorCount": 4,
        "cpuUsage": 15.2,
        "memoryUsage": 128.5,
        "collaborationCount": 23
      }
    ],
    "aggregates": {
      "totalRequests": 1250,
      "averageResponseTime": 1150,
      "averageSuccessRate": 0.94,
      "totalActiveAgents": 8
    }
  }
}
```

### 4. Task Assignment and Coordination

**POST /tasks**
- Create and assign tasks to agents
- Returns task ID for tracking

**Request Body:**
```json
{
  "agentName": "planner",
  "type": "planning_task",
  "context": {
    "userRequest": "Plan a deployment strategy",
    "priority": "high"
  },
  "priority": 1,
  "estimatedDuration": 30000
}
```

**GET /tasks**
- Retrieve active and historical tasks
- Supports filtering by status and agent

**Query Parameters:**
- `status`: `pending`, `running`, `completed`, `failed`
- `agentName`: Filter by agent
- `limit`: Number of results (default: 100)

### 5. Agent Collaboration

**POST /collaborate**
- Request collaboration between multiple agents
- Returns collaboration session ID

**Request Body:**
```json
{
  "task": "Complex analysis requiring multiple capabilities",
  "requiredCapabilities": ["planning", "analysis", "synthesis"],
  "teamSize": 3,
  "priority": "high"
}
```

### 6. Communication Tracking

**GET /communications**
- Get A2A communication history and active sessions
- Shows collaboration patterns and message flows

**Response:**
```json
{
  "success": true,
  "data": {
    "communications": [
      {
        "id": "collab_123",
        "participants": ["planner", "synthesizer", "retriever"],
        "task": "Strategic analysis",
        "status": "active",
        "messageCount": 15,
        "type": "collaboration"
      }
    ],
    "summary": {
      "activeSessions": 2,
      "completedSessions": 45
    }
  }
}
```

### 7. Resource Usage Monitoring

**GET /resources**
- Monitor resource usage per agent
- Includes CPU, memory, and queue metrics

**Response:**
```json
{
  "success": true,
  "data": {
    "resources": [
      {
        "agentName": "planner",
        "status": "online",
        "cpuUsage": 15.2,
        "memoryUsage": 128.5,
        "queueLength": 2,
        "collaborationScore": 0.8
      }
    ],
    "systemResources": {
      "totalCpuUsage": 125.6,
      "averageMemoryUsage": 156.8,
      "meshHealth": 0.85
    }
  }
}
```

### 8. Workflow Orchestration

**POST /orchestrate**
- Execute complex multi-agent workflows
- Coordinate primary and supporting agents

**Request Body:**
```json
{
  "primaryAgent": "planner",
  "supportingAgents": ["retriever", "synthesizer"],
  "context": {
    "userRequest": "Create comprehensive project plan",
    "requirements": ["timeline", "resources", "risks"]
  }
}
```

## WebSocket Events

### Real-time Updates

Connect to `ws://localhost:9999/ws/orchestration` to receive real-time updates:

**Event Types:**
- `initial_state`: Initial dashboard state
- `agent_loaded`/`agent_unloaded`: Agent lifecycle events
- `agent_communication`: A2A message events
- `periodic_update`: Regular status updates (every 5 seconds)
- `task_created`/`task_started`/`task_completed`/`task_failed`: Task lifecycle
- `collaboration_started`: New collaboration sessions
- `orchestration_completed`: Workflow completion

**Example Message:**
```json
{
  "type": "agent_communication",
  "data": {
    "from": "planner",
    "to": "synthesizer",
    "type": "collaboration",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## Error Handling

Standard error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse. WebSocket connections are throttled for broadcast messages.

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// REST API
const response = await fetch('/api/v1/agent-orchestration/status', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();

// WebSocket
const ws = new WebSocket('ws://localhost:9999/ws/orchestration');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Orchestration update:', message);
};
```

### React Hook Example

```typescript
function useAgentOrchestration() {
  const [status, setStatus] = useState(null);
  const [topology, setTopology] = useState(null);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9999/ws/orchestration');
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'initial_state') {
        setStatus(message.data.meshStatus);
        setTopology(message.data.topology);
      } else if (message.type === 'periodic_update') {
        setStatus(message.data.meshStatus);
        setTopology(message.data.topology);
      }
    };
    
    return () => ws.close();
  }, []);
  
  return { status, topology };
}
```

This API provides comprehensive real-time monitoring and control capabilities for the Arc UI agent orchestration dashboard.