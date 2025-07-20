# Universal AI Tools - API Documentation
## Complete API Reference for Production Platform

**Version**: 1.0.0  
**Base URL**: `http://localhost:9999` (or your production domain)  
**Authentication**: API Key based  
**Content-Type**: `application/json`

---

## 🔑 Authentication

### API Key Authentication
All protected endpoints require authentication using API key headers:

```bash
# Required headers for authenticated endpoints
X-API-Key: your-api-key-here
X-AI-Service: your-service-name
```

### Development vs Production
```bash
# Development
X-API-Key: test-dev-key-12345

# Production  
X-API-Key: your-production-api-key
```

---

## 🏥 Health & Status Endpoints

### Basic Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "Universal AI Tools Service", 
  "timestamp": "2025-07-20T03:12:01.830Z",
  "metadata": {
    "apiVersion": "v1",
    "timestamp": "2025-07-20T03:12:01.831Z"
  }
}
```

### Detailed Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-20T03:12:01.841Z",
  "uptime": 311.0060125,
  "memory": {
    "rss": 158908416,
    "heapTotal": 36438016,
    "heapUsed": 33574952,
    "external": 4711225,
    "arrayBuffers": 164447
  },
  "metrics_enabled": true,
  "prometheus_registry": "active",
  "metadata": {
    "apiVersion": "v1",
    "timestamp": "2025-07-20T03:12:01.841Z"
  }
}
```

### Authenticated Health Check
```http
GET /api/v1/health
Headers: X-API-Key, X-AI-Service
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 311.015576125,
    "services": {
      "database": {
        "status": "healthy",
        "responseTime": 16,
        "lastCheck": "2025-07-20T03:12:01.867Z"
      },
      "memory": {
        "status": "unhealthy",
        "responseTime": 0,
        "lastCheck": "2025-07-20T03:12:01.867Z",
        "error": "Memory usage at 91.4%"
      },
      "api": {
        "status": "healthy",
        "responseTime": 16,
        "lastCheck": "2025-07-20T03:12:01.867Z"
      }
    },
    "metrics": {
      "memoryUsage": 91,
      "cpuUsage": 0,
      "activeConnections": 0,
      "requestsPerMinute": 0
    }
  },
  "meta": {
    "requestId": "27e52b25-62ba-42f3-aa31-cfd0a6b06053",
    "timestamp": "2025-07-20T03:12:01.851Z",
    "processingTime": 16,
    "version": "1.0.0"
  }
}
```

---

## 🧠 Memory Management API

### List Memories
```http
GET /api/v1/memory
Headers: X-API-Key, X-AI-Service
```

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10): Items per page
- `type` (string): Filter by memory type
- `tags` (string): Comma-separated tags filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "a9fe01f9-cdf7-483c-a4e2-15313a4e219b",
      "type": "semantic",
      "content": "Database validation memory",
      "metadata": {
        "test": "comprehensive",
        "validation": true
      },
      "tags": [],
      "importance": 0.5,
      "timestamp": "2025-07-20T02:52:41.836435+00:00"
    }
  ],
  "meta": {
    "requestId": "3d60a582-7aaf-497f-a16d-d40352295527",
    "timestamp": "2025-07-20T03:12:16.845Z",
    "processingTime": 6,
    "version": "1.0.0",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### Create Memory
```http
POST /api/v1/memory
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "This is a new memory entry",
  "metadata": {
    "source": "api",
    "importance": "high"
  },
  "tags": ["test", "api"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-memory-id",
    "content": "This is a new memory entry",
    "metadata": {
      "source": "api", 
      "importance": "high"
    },
    "tags": ["test", "api"],
    "timestamp": "2025-07-20T03:12:16.845Z"
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2025-07-20T03:12:16.845Z",
    "processingTime": 15,
    "version": "1.0.0"
  }
}
```

### Get Memory by ID
```http
GET /api/v1/memory/{id}
Headers: X-API-Key, X-AI-Service
```

### Update Memory
```http
PUT /api/v1/memory/{id}
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

### Delete Memory
```http
DELETE /api/v1/memory/{id}
Headers: X-API-Key, X-AI-Service
```

---

## 🛠️ Tools Management API

### List Available Tools
```http
GET /api/v1/tools
Headers: X-API-Key, X-AI-Service
```

**Response:**
```json
{
  "tools": [
    {
      "id": "tool-id",
      "tool_name": "example_tool",
      "description": "Example tool description",
      "input_schema": {
        "type": "object",
        "properties": {
          "param1": {"type": "string"},
          "param2": {"type": "number"}
        }
      },
      "output_schema": {
        "type": "object", 
        "properties": {
          "result": {"type": "string"}
        }
      },
      "rate_limit": 100
    }
  ],
  "metadata": {
    "apiVersion": "v1",
    "timestamp": "2025-07-20T03:12:16.864Z"
  }
}
```

### Execute Tool
```http
POST /api/v1/tools/execute
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "tool_name": "example_tool",
  "parameters": {
    "param1": "value1",
    "param2": 42
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "output": "Tool execution result"
  },
  "execution_time_ms": 150
}
```

### Create Custom Tool
```http
POST /api/v1/tools
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "tool_name": "my_custom_tool",
  "description": "Custom tool description",
  "input_schema": {
    "type": "object",
    "properties": {
      "input": {"type": "string"}
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "output": {"type": "string"}
    }
  },
  "implementation_type": "function",
  "implementation": "function(parameters, supabase) { return { output: parameters.input.toUpperCase() }; }",
  "rate_limit": 50
}
```

### Execute Built-in Tools
```http
POST /api/v1/tools/execute/builtin/{toolName}
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Available Built-in Tools:**
- `store_context`: Store contextual information
- `retrieve_context`: Retrieve stored context
- `search_knowledge`: Search knowledge base
- `communicate`: Inter-service communication
- `analyze_project`: Project analysis

---

## 🎭 Agent Orchestration API

### List Agents
```http
GET /api/v1/orchestration/agents
Headers: X-API-Key, X-AI-Service
```

### Coordinate Agents
```http
POST /api/v1/orchestration/coordinate
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "task": "Analyze user behavior data",
  "available_agents": ["analyzer", "data_processor", "reporter"],
  "context": {
    "dataset_id": "user_data_2025",
    "time_range": "last_30_days"
  }
}
```

### Execute Orchestration
```http
POST /api/v1/orchestration/execute
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "request_id": "unique-request-id",
  "user_request": "Generate a comprehensive report on user engagement",
  "orchestration_mode": "cognitive",
  "context": {
    "priority": "high",
    "deadline": "2025-07-25"
  }
}
```

---

## 🔍 Knowledge Management API

### Search Knowledge
```http
POST /api/v1/orchestration/knowledge/search
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "machine learning best practices",
  "limit": 10,
  "knowledge_type": "documentation"
}
```

### Extract Knowledge
```http
POST /api/v1/orchestration/knowledge/extract
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Long text content to extract knowledge from...",
  "context": {
    "source": "research_paper",
    "domain": "artificial_intelligence"
  }
}
```

### Evolve Knowledge
```http
POST /api/v1/orchestration/knowledge/evolve
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "existing_knowledge": "Current understanding of the topic...",
  "new_information": "New research findings that update our understanding..."
}
```

---

## 📊 GraphQL API

### Endpoint
```http
POST /graphql
Headers: Content-Type: application/json, X-CSRF-Token: <csrf-token>
```

**Note**: GraphQL endpoints require CSRF protection. Obtain CSRF token from authenticated endpoints.

### Example Query
```graphql
query {
  memoriesCollection {
    edges {
      node {
        id
        content
        metadata
        timestamp
      }
    }
  }
}
```

### Example Mutation
```graphql
mutation CreateMemory($content: String!, $metadata: JSON) {
  insertIntoMemoriesCollection(objects: [{
    content: $content
    metadata: $metadata
  }]) {
    records {
      id
      content
      timestamp
    }
  }
}
```

### Available Collections
- `memoriesCollection`: Memory management
- `ai_agentsCollection`: Agent registry
- `agent_toolsCollection`: Tool definitions
- `knowledge_entitiesCollection`: Knowledge graph
- `agent_sessionsCollection`: Session tracking

---

## 📈 Metrics & Monitoring API

### Prometheus Metrics
```http
GET /metrics
```

**Response**: Prometheus format metrics
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/health",status_code="200",ai_service="unknown"} 6

# HELP http_request_duration_seconds Request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/health",le="0.005"} 5
```

### Security Status
```http
GET /api/security/status
Headers: X-API-Key, X-AI-Service
```

**Response:**
```json
{
  "score": 95,
  "vulnerabilities": 0,
  "criticalIssues": 0,
  "expiredKeys": 0,
  "timestamp": "2025-07-20T03:12:01.867Z"
}
```

---

## 🔊 Context & Communication API

### Store Context
```http
POST /api/v1/context
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "context_type": "conversation",
  "context_key": "session_123",
  "content": "User is asking about AI capabilities",
  "metadata": {
    "user_id": "user_456",
    "timestamp": "2025-07-20T03:12:01.867Z"
  }
}
```

### Retrieve Context
```http
GET /api/v1/context/{context_type}/{context_key}
Headers: X-API-Key, X-AI-Service
```

---

## 📝 Speech & Audio API

### Text-to-Speech
```http
POST /api/v1/speech/synthesize
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Hello, this is a test of the speech synthesis system",
  "voice": "neural",
  "speed": 1.0,
  "pitch": 1.0
}
```

### Speech-to-Text
```http
POST /api/v1/speech/transcribe
Headers: X-API-Key, X-AI-Service, Content-Type: multipart/form-data
```

**Form Data:**
- `audio`: Audio file (WAV, MP3, OGG)
- `language`: Language code (default: "en")

---

## ❌ Error Responses

### Standard Error Format
```json
{
  "error": "Error type",
  "message": "Human readable error message",
  "code": 400,
  "timestamp": "2025-07-20T03:12:01.867Z",
  "requestId": "request-id-here"
}
```

### Common Error Codes
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing/invalid API key
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server issue

### CORS Errors
```json
{
  "error": "Not allowed by CORS",
  "message": "Origin not in allowed list",
  "allowedOrigins": ["https://yourdomain.com"]
}
```

---

## 🔧 Rate Limiting

### Default Limits
- **Standard endpoints**: 1000 requests/hour
- **Heavy operations**: 100 requests/hour
- **Authenticated users**: Higher limits based on service tier

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

---

## 📚 SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:9999/api/v1',
  headers: {
    'X-API-Key': 'your-api-key',
    'X-AI-Service': 'your-service-name',
    'Content-Type': 'application/json'
  }
});

// Create memory
const memory = await client.post('/memory', {
  content: 'Important information to remember',
  metadata: { priority: 'high' },
  tags: ['important']
});

// Execute tool
const result = await client.post('/tools/execute', {
  tool_name: 'data_analyzer',
  parameters: { dataset: 'user_behavior' }
});
```

### Python
```python
import requests

class UniversalAIClient:
    def __init__(self, base_url, api_key, service_name):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'X-AI-Service': service_name,
            'Content-Type': 'application/json'
        }
    
    def create_memory(self, content, metadata=None, tags=None):
        response = requests.post(
            f'{self.base_url}/api/v1/memory',
            headers=self.headers,
            json={
                'content': content,
                'metadata': metadata or {},
                'tags': tags or []
            }
        )
        return response.json()

# Usage
client = UniversalAIClient(
    'http://localhost:9999',
    'your-api-key', 
    'your-service-name'
)

memory = client.create_memory(
    'User prefers dark mode interface',
    metadata={'user_id': '123', 'preference': 'ui'},
    tags=['user-preference', 'ui']
)
```

### cURL Examples
```bash
# Health check
curl http://localhost:9999/health

# Create memory
curl -X POST http://localhost:9999/api/v1/memory \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: your-service" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test memory", "tags": ["test"]}'

# Execute tool
curl -X POST http://localhost:9999/api/v1/tools/execute \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: your-service" \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "example_tool", "parameters": {"input": "test"}}'
```

---

## 🛡️ Security Best Practices

### API Key Management
- Generate unique API keys per service/environment
- Rotate keys regularly (monthly recommended)
- Use environment variables, never hardcode keys
- Monitor usage for anomalies

### Request Security
- Always use HTTPS in production
- Validate all input data
- Implement request signing for sensitive operations
- Use rate limiting to prevent abuse

### Data Protection
- Encrypt sensitive data in transit and at rest
- Implement proper access controls
- Log security events for auditing
- Regular security assessments

---

**API Version**: v1.0.0  
**Last Updated**: July 20, 2025  
**Status**: Production Ready  
**Support**: Enterprise grade with comprehensive documentation