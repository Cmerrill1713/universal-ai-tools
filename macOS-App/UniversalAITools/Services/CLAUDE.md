# Services Directory - Business Logic Layer

## Overview
This directory contains all service classes, API clients, and business logic for the Universal AI Tools macOS application.

## Architecture

Services follow the actor pattern for thread safety:
```swift
actor ServiceName {
    static let shared = ServiceName()
    // Implementation
}
```

## Core Services

### APIService.swift
- Main HTTP client for backend communication
- Base URL: `http://localhost:9999`
- Handles authentication and request formatting
- Implements retry logic with exponential backoff

### WebSocketConnectionManager.swift
- Manages real-time WebSocket connections
- Auto-reconnection with exponential backoff
- Message queuing during disconnection
- Multiple channel support

### AgentWorkflowService.swift
- Orchestrates AI agent interactions
- Manages agent lifecycle
- Handles agent communication

### DataSynchronizationService.swift
- Syncs local and remote data
- Conflict resolution
- Offline support with queue

### VoiceServices.swift
- STT (Speech-to-Text) integration
- TTS (Text-to-Speech) integration
- Audio session management

## API Endpoints

### Base Configuration
```swift
let baseURL = "http://localhost:9999/api/v1"
```

### Common Endpoints
- `/chat` - Chat interactions
- `/agents` - Agent management
- `/voice/stt` - Speech to text
- `/voice/tts` - Text to speech
- `/graphrag` - Knowledge graph
- `/monitoring/health` - Health check

## Error Handling

### Service Errors
```swift
enum ServiceError: LocalizedError {
    case networkError(Error)
    case decodingError(Error)
    case unauthorized
    case serverError(Int)
}
```

### Retry Strategy
- 3 retry attempts by default
- Exponential backoff: 1s, 2s, 4s
- Circuit breaker for repeated failures

## WebSocket Protocol

### Connection
```swift
ws://localhost:9999/ws
```

### Message Format
```json
{
  "type": "message_type",
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Event Types
- `chat.message` - New chat message
- `agent.status` - Agent status update
- `graph.update` - Knowledge graph change
- `performance.metrics` - Performance data

## Authentication

### Token Management
- Store in Keychain
- Auto-refresh before expiry
- Handle 401 responses

### Headers
```swift
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
```

## Caching Strategy

### In-Memory Cache
```swift
private var cache: [String: Codable] = [:]
```

### Cache Invalidation
- TTL: 5 minutes for dynamic data
- Manual invalidation on updates
- Clear on memory warning

## Testing Services

### Mocking
```swift
protocol ServiceProtocol {
    func fetchData() async throws -> [Item]
}

struct MockService: ServiceProtocol {
    func fetchData() async throws -> [Item] {
        return mockItems
    }
}
```

### Integration Tests
- Test with local backend
- Mock network responses
- Verify error handling
- Test retry logic

## Performance Optimization

### Batch Requests
- Group multiple requests when possible
- Use GraphQL for complex queries
- Implement pagination for lists

### Connection Pooling
- Reuse URLSession instances
- Limit concurrent connections
- Implement request queuing

## Monitoring

### Logging
```swift
print("[ServiceName] Action: \(description)")
```

### Metrics
- Track request duration
- Monitor error rates
- Log retry attempts
- Record cache hit rates

## Security

### Data Protection
- Use HTTPS in production
- Validate SSL certificates
- Sanitize user inputs
- Implement rate limiting

### Sensitive Data
- Never log tokens or passwords
- Use Keychain for credentials
- Encrypt sensitive cache data
- Clear data on logout

## Migration Guide

When updating services:
1. Maintain backward compatibility
2. Version API endpoints
3. Implement graceful degradation
4. Document breaking changes
5. Update tests