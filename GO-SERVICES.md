# 🐹 Go Services Documentation

## Overview

Go services in Universal AI Tools are responsible for **high-concurrency networking, API management, and service orchestration**. They handle HTTP routing, WebSocket connections, database operations, and service coordination with excellent concurrency support.

## 🎯 Core Principles

- **High Concurrency**: Handle 10,000+ concurrent connections
- **Fast Networking**: Sub-10ms response times for API routing
- **Service Orchestration**: Coordinate between Rust AI services
- **Reliability**: Graceful error handling and circuit breakers

## 📋 Service Inventory

### 1. API Gateway (`go-services/api-gateway/`)

**Port**: 8081 (moved from 8080 to resolve conflict)  
**Status**: 🚧 Needs Port Update

#### Responsibilities:

- **Request Routing**: Route requests to appropriate backend services
- **Load Balancing**: Distribute load across multiple service instances
- **Authentication**: Handle API keys and user authentication
- **Rate Limiting**: Implement request throttling and quotas

#### Key Components:

```go
// API Gateway configuration
type GatewayConfig struct {
    Port        int               `json:"port"`
    Services    map[string]string `json:"services"`
    AuthEnabled bool              `json:"auth_enabled"`
    RateLimit   int               `json:"rate_limit"`
}

// Service routing
type ServiceRouter struct {
    services map[string]*ServiceConfig
    client   *http.Client
    auth     AuthManager
}
```

#### API Endpoints:

- `GET /health` - Gateway health check
- `POST /api/chat` - Route to LLM Router
- `POST /api/memory` - Route to Memory Service
- `GET /api/status` - Service status overview

#### Dependencies:

- `gorilla/mux` - HTTP router
- `net/http` - HTTP client/server
- `context` - Request context management
- `sync` - Concurrency primitives

---

### 2. Memory Service (`go-services/memory-service/`)

**Port**: 8017  
**Status**: ✅ Operational

#### Responsibilities:

- **Memory Storage**: Store and retrieve user memories
- **Context Management**: Maintain conversation context across sessions
- **Search Operations**: Perform memory search and retrieval
- **Database Integration**: Connect with PostgreSQL and Weaviate

#### Key Components:

```go
// Memory data structures
type Memory struct {
    ID          string                 `json:"id"`
    UserID      string                 `json:"user_id"`
    Type        string                 `json:"type"`
    Content     string                 `json:"content"`
    Tags        []string               `json:"tags"`
    Metadata    map[string]interface{} `json:"metadata"`
    CreatedAt   time.Time              `json:"created_at"`
    AccessCount int                    `json:"access_count"`
}

// Memory service configuration
type MemoryService struct {
    dbClient      *sql.DB
    weaviateClient *weaviate.Client
    redisClient   *redis.Client
}
```

#### API Endpoints:

- `GET /health` - Service health check
- `POST /memories` - Create new memory
- `GET /memories` - List user memories
- `GET /memories/{id}` - Get specific memory
- `POST /memories/search` - Search memories
- `DELETE /memories/{id}` - Delete memory

#### Dependencies:

- `database/sql` - Database connectivity
- `github.com/weaviate/weaviate-go-client` - Weaviate integration
- `github.com/go-redis/redis/v8` - Redis client
- `github.com/gorilla/mux` - HTTP routing

---

### 3. WebSocket Hub (`go-services/websocket-hub/`)

**Port**: 8082 (planned)  
**Status**: 🚧 In Development

#### Responsibilities:

- **Connection Management**: Manage WebSocket connections
- **Message Broadcasting**: Broadcast messages to connected clients
- **Connection Pooling**: Efficiently manage connection pools
- **Real-time Communication**: Enable real-time AI interactions

#### Key Components:

```go
// WebSocket hub configuration
type Hub struct {
    clients    map[*Client]bool
    register   chan *Client
    unregister chan *Client
    broadcast  chan []byte
    mutex      sync.RWMutex
}

// Client connection
type Client struct {
    hub      *Hub
    conn     *websocket.Conn
    send     chan []byte
    userID   string
    lastPing time.Time
}
```

#### API Endpoints:

- `GET /ws` - WebSocket connection endpoint
- `GET /health` - Service health check
- `GET /connections` - Active connections count

---

### 4. Service Discovery (`go-services/service-discovery/`)

**Port**: 8083 (planned)  
**Status**: 🚧 In Development

#### Responsibilities:

- **Service Registration**: Register services and their health status
- **Health Monitoring**: Monitor service health and availability
- **Load Balancer Coordination**: Coordinate with load balancers
- **Service Mesh**: Manage service-to-service communication

#### Key Components:

```go
// Service registration
type Service struct {
    ID       string    `json:"id"`
    Name     string    `json:"name"`
    Address  string    `json:"address"`
    Port     int       `json:"port"`
    Health   string    `json:"health"`
    LastSeen time.Time `json:"last_seen"`
}

// Service discovery manager
type DiscoveryManager struct {
    services map[string]*Service
    mutex    sync.RWMutex
    client   *http.Client
}
```

---

## 🔧 Development Guidelines

### Error Handling:

```go
import (
    "errors"
    "fmt"
    "log"
)

// Custom error types
type ServiceError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Service string `json:"service"`
}

func (e *ServiceError) Error() string {
    return fmt.Sprintf("[%s] %d: %s", e.Service, e.Code, e.Message)
}

// Proper error handling pattern
func handleRequest(w http.ResponseWriter, r *http.Request) {
    result, err := processRequest(r)
    if err != nil {
        log.Printf("Request failed: %v", err)
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}
```

### Concurrency Patterns:

```go
import (
    "context"
    "sync"
    "time"
)

// Worker pool pattern
type WorkerPool struct {
    workers    int
    jobQueue   chan Job
    resultChan chan Result
    wg         sync.WaitGroup
}

func (wp *WorkerPool) Start(ctx context.Context) {
    for i := 0; i < wp.workers; i++ {
        wp.wg.Add(1)
        go wp.worker(ctx)
    }
}

func (wp *WorkerPool) worker(ctx context.Context) {
    defer wp.wg.Done()

    for {
        select {
        case job := <-wp.jobQueue:
            result := processJob(job)
            wp.resultChan <- result
        case <-ctx.Done():
            return
        }
    }
}
```

### HTTP Client Patterns:

```go
import (
    "context"
    "net/http"
    "time"
)

// HTTP client with proper configuration
func createHTTPClient() *http.Client {
    return &http.Client{
        Timeout: 30 * time.Second,
        Transport: &http.Transport{
            MaxIdleConns:        100,
            MaxIdleConnsPerHost: 10,
            IdleConnTimeout:     90 * time.Second,
        },
    }
}

// Request with context and timeout
func makeRequest(ctx context.Context, url string) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    client := createHTTPClient()
    return client.Do(req)
}
```

### Database Patterns:

```go
import (
    "database/sql"
    "context"
    "time"
)

// Database connection with proper configuration
func createDBConnection(dsn string) (*sql.DB, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, err
    }

    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(25)
    db.SetConnMaxLifetime(5 * time.Minute)

    return db, nil
}

// Database operation with context
func (ms *MemoryService) GetMemory(ctx context.Context, id string) (*Memory, error) {
    query := "SELECT id, user_id, type, content, tags, metadata, created_at, access_count FROM memories WHERE id = $1"

    var memory Memory
    err := ms.db.QueryRowContext(ctx, query, id).Scan(
        &memory.ID, &memory.UserID, &memory.Type, &memory.Content,
        &memory.Tags, &memory.Metadata, &memory.CreatedAt, &memory.AccessCount,
    )

    if err != nil {
        return nil, err
    }

    return &memory, nil
}
```

## 📊 Performance Metrics

### Target Performance:

- **Response Time**: <10ms for API routing
- **Memory Usage**: <200MB per service
- **Concurrency**: 10,000+ concurrent connections
- **CPU Usage**: <70% under normal load

### Monitoring:

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics collection
var (
    requestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )

    requestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "HTTP request duration in seconds",
        },
        []string{"method", "endpoint"},
    )
)
```

## 🚀 Deployment

### Build Configuration:

```go
// go.mod optimization
module universal-ai-tools/go-services/api-gateway

go 1.21

require (
    github.com/gorilla/mux v1.8.0
    github.com/prometheus/client_golang v1.17.0
    github.com/go-redis/redis/v8 v8.11.5
)
```

### Container Strategy:

```dockerfile
# Multi-stage build for minimal image
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api-gateway

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/api-gateway .
EXPOSE 8081
CMD ["./api-gateway"]
```

## 🔍 Testing Strategy

### Unit Tests:

```go
func TestMemoryService_GetMemory(t *testing.T) {
    // Setup test database
    db := setupTestDB(t)
    defer db.Close()

    service := NewMemoryService(db, nil, nil)

    // Test memory retrieval
    memory, err := service.GetMemory(context.Background(), "test-id")
    assert.NoError(t, err)
    assert.Equal(t, "test-id", memory.ID)
}
```

### Integration Tests:

```go
func TestAPIGateway_Integration(t *testing.T) {
    // Start test server
    server := httptest.NewServer(setupTestRouter())
    defer server.Close()

    // Test API endpoints
    resp, err := http.Get(server.URL + "/health")
    assert.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

## 📝 Maintenance

### Logging:

```go
import (
    "log/slog"
    "os"
)

// Structured logging
func setupLogger() *slog.Logger {
    return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
}

// Usage
logger := setupLogger()
logger.Info("Service started", "port", 8081, "service", "api-gateway")
```

### Health Checks:

```go
func healthCheck(w http.ResponseWriter, r *http.Request) {
    status := map[string]interface{}{
        "status":    "healthy",
        "service":   "api-gateway",
        "timestamp": time.Now().Unix(),
        "version":   "1.0.0",
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(status)
}
```

---

**Next Steps**: Resolve port conflicts with Rust services and implement comprehensive service discovery.
