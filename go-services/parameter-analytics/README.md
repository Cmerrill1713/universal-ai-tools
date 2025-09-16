# Parameter Analytics Service

A Go-based analytics service for tracking and analyzing system parameters and performance metrics.

## Features

- **Metrics Collection**: Collect and analyze system parameters
- **Performance Tracking**: Monitor service performance metrics
- **Health Monitoring**: Service health checks and status reporting
- **Analytics API**: RESTful API for analytics data access

## Endpoints

- `GET /health` - Service health check
- `GET /metrics` - Performance metrics
- `GET /analytics` - Analytics data

## Configuration

Set the following environment variables:

- `PORT` - Service port (default: 3032)

## Usage

```bash
# Start the service
go run main.go

# Health check
curl http://localhost:3032/health

# Get metrics
curl http://localhost:3032/metrics

# Get analytics
curl http://localhost:3032/analytics
```

## Response Formats

### Health Check

```json
{
  "status": "healthy"
}
```

### Metrics

```json
{
  "service": "parameter-analytics",
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "metrics": {
    "total_requests": 1000,
    "avg_response_time": 125.5,
    "success_rate": 98.5,
    "cpu_usage": "12.5%",
    "memory_usage": "45.2MB",
    "active_connections": 5
  }
}
```

### Analytics

```json
{
  "analytics": "dummy data"
}
```

## Development

```bash
# Run tests
go test

# Build
go build

# Run with debug logging
LOG_LEVEL=debug go run main.go
```
