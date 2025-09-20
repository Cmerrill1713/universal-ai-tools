# Universal AI Tools - Service Architecture Documentation
## Overview

This document provides comprehensive documentation of the Universal AI Tools platform service architecture, including service descriptions, port mappings, health check endpoints, and troubleshooting procedures.
## Service Architecture
### 1. Core Services

#### 1.1 API Gateway (Port 8080)

- **Purpose**: Central routing and load balancing for all microservices

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8080/health`

- **Features**:

  - Service discovery and registration

  - Health check monitoring

  - Request routing and load balancing

  - Rate limiting and authentication

  - WebSocket support

#### 1.2 Authentication Service (Port 8010)

- **Purpose**: User authentication and authorization

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8010/health`

- **Features**:

  - JWT token management

  - User session handling

  - Role-based access control

#### 1.3 Cache Coordinator (Port 8011)

- **Purpose**: Distributed caching and data synchronization

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8011/health`

- **Features**:

  - Redis integration

  - Cache invalidation

  - Data consistency management
### 2. AI/ML Services

#### 2.1 Fast LLM Service (Port 3030)

- **Purpose**: High-performance language model inference

- **Technology**: Go

- **Health Endpoint**: `http://localhost:3030/health`

- **Features**:

  - Multiple model support (fast-llm-v1, fast-llm-v2, fast-llm-turbo)

  - Low-latency inference

  - Model management

#### 2.2 LLM Router Service (Port 3040)

- **Purpose**: Intelligent routing of LLM requests to appropriate providers

- **Technology**: Go

- **Health Endpoint**: `http://localhost:3040/health`

- **Features**:

  - Provider management (Fast LLM, OpenAI, Anthropic)

  - Load balancing across providers

  - Failover mechanisms

#### 2.3 ML Inference Service (Port 8084)

- **Purpose**: Machine learning model inference

- **Technology**: Rust

- **Health Endpoint**: `http://localhost:8084/health`

- **Features**:

  - SmartCore ML framework

  - Model serving

  - Inference optimization

#### 2.4 Parameter Analytics Service (Port 3032)

- **Purpose**: Analysis and optimization of model parameters

- **Technology**: Rust

- **Health Endpoint**: `http://localhost:3032/health`

- **Features**:

  - Parameter optimization

  - Performance analysis

  - A/B testing support
### 3. Data Services

#### 3.1 Memory Service (Port 8017)

- **Purpose**: Long-term memory storage and retrieval

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8017/health`

- **Features**:

  - Vector storage

  - Semantic search

  - Memory management

#### 3.2 Weaviate Vector Database (Port 8090)

- **Purpose**: Vector database for embeddings and similarity search

- **Technology**: Weaviate

- **Health Endpoint**: `http://localhost:8090/v1/meta`

- **Features**:

  - Vector storage and indexing

  - Similarity search

  - GraphQL API

#### 3.3 Weaviate Client (Port 8019)

- **Purpose**: Client interface for Weaviate operations

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8019/health`

- **Features**:

  - Weaviate API abstraction

  - Query optimization

  - Connection pooling
### 4. Communication Services

#### 4.1 Chat Service (Port 8016)

- **Purpose**: Real-time chat and messaging

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8016/health`

- **Features**:

  - WebSocket communication

  - Message persistence

  - Real-time updates

#### 4.2 WebSocket Hub (Port 8018)

- **Purpose**: WebSocket connection management

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8018/health`

- **Features**:

  - Connection pooling

  - Message broadcasting

  - Connection health monitoring
### 5. Infrastructure Services

#### 5.1 Service Discovery (Port 8094)

- **Purpose**: Service registration and discovery

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8094/api/v1/discovery/health`

- **Features**:

  - Service registration

  - Health monitoring

  - Load balancing

#### 5.2 Metrics Aggregator (Port 8015)

- **Purpose**: System metrics collection and aggregation

- **Technology**: Go

- **Health Endpoint**: `http://localhost:8015/health`

- **Features**:

  - Performance metrics

  - System monitoring

  - Alerting

#### 5.3 Load Balancer (Port 8012)

- **Purpose**: Request distribution and load balancing

- **Technology**: Go

- **Health Endpoint**: Port open but no health endpoint

- **Features**:

  - Round-robin load balancing

  - Health check integration

  - Failover support
### 6. Legacy Services

#### 6.1 Legacy API (Port 3001)

- **Purpose**: Legacy API compatibility

- **Technology**: Node.js/Express

- **Health Endpoint**: `http://localhost:3001/health`

- **Features**:

  - API compatibility layer

  - Legacy endpoint support

  - Migration assistance
## Port Mapping Summary
| Service | Port | Technology | Health Endpoint | Status |

|---------|------|------------|-----------------|--------|

| API Gateway | 8080 | Go | `/health` | ✅ Healthy |

| Auth Service | 8010 | Go | `/health` | ✅ Healthy |

| Cache Coordinator | 8011 | Go | `/health` | ✅ Healthy |

| Load Balancer | 8012 | Go | N/A | ⚠️ No Health Endpoint |

| Metrics Aggregator | 8015 | Go | `/health` | ✅ Healthy |

| Chat Service | 8016 | Go | `/health` | ✅ Healthy |

| Memory Service | 8017 | Go | `/health` | ✅ Healthy |

| WebSocket Hub | 8018 | Go | `/health` | ✅ Healthy |

| Weaviate Client | 8019 | Go | `/health` | ✅ Healthy |

| Fast LLM | 3030 | Go | `/health` | ⚠️ Health Check Timing |

| LLM Router | 3040 | Go | `/health` | ⚠️ Health Check Timing |

| Parameter Analytics | 3032 | Rust | `/health` | ✅ Healthy |

| ML Inference | 8084 | Rust | `/health` | ✅ Healthy |

| Service Discovery | 8094 | Go | `/api/v1/discovery/health` | ✅ Healthy |

| Weaviate | 8090 | Weaviate | `/v1/meta` | ✅ Healthy |

| Legacy API | 3001 | Node.js | `/health` | ✅ Healthy |
## Health Check Implementation
### Standard Health Check Response Format

```json

{

  "status": "healthy",

  "service": "service-name",

  "timestamp": "2025-09-12T00:00:00.000Z",

  "version": "1.0.0",

  "additional_info": {}

}

```
### Health Check Endpoints

- **Standard**: `http://localhost:PORT/health`

- **Custom**: Service-specific endpoints as documented above

- **Method**: GET

- **Response**: JSON with service status information
## Troubleshooting Guide
### Common Issues

#### 1. Port Conflicts

**Symptoms**: Service fails to start with "Address already in use" error

**Resolution**:

1. Check what's running on the port: `lsof -i :PORT`

2. Kill conflicting process: `kill -9 PID`

3. Restart the service

#### 2. Health Check Timing Issues

**Symptoms**: Service is healthy but API Gateway reports it as unhealthy

**Resolution**:

1. Wait for health check interval (10 seconds)

2. Manually trigger health check refresh

3. Check service logs for errors

#### 3. Service Startup Failures

**Symptoms**: Service exits immediately after startup

**Resolution**:

1. Check service logs for error messages

2. Verify port availability

3. Check for missing dependencies

4. Verify configuration files
### Service-Specific Troubleshooting

#### Fast LLM Service

- **Port**: 3030

- **Common Issues**: Port conflicts, model loading failures

- **Logs**: Check `fast-llm.log` for detailed error messages

#### LLM Router Service

- **Port**: 3040

- **Common Issues**: Provider configuration, routing failures

- **Logs**: Check `llm-router.log` for provider connection issues

#### Parameter Analytics Service

- **Port**: 3032

- **Common Issues**: Rust compilation errors, port conflicts

- **Logs**: Check stderr for compilation warnings and errors
## Monitoring and Alerting
### Health Check Monitoring

```bash
# Check overall system health

curl -s http://localhost:8080/health | jq '.services'

# Check specific service

curl -s http://localhost:PORT/health

# Manual health check refresh

curl -s http://localhost:8080/health/refresh -X POST

```
### Service Status Dashboard

- **URL**: `http://localhost:8080/health`

- **Refresh Rate**: Every 10 seconds

- **Alerting**: Automatic alerts for service failures
## Development Guidelines
### Adding New Services

1. Choose an available port from the port mapping table

2. Implement standard health check endpoint

3. Register service with API Gateway

4. Update this documentation

5. Add service to monitoring scripts
### Health Check Implementation

1. Implement `/health` endpoint returning JSON

2. Include service status, timestamp, and version

3. Return appropriate HTTP status codes

4. Handle errors gracefully
### Service Dependencies

1. Document all service dependencies

2. Implement proper error handling for dependency failures

3. Use circuit breaker patterns for resilience

4. Monitor dependency health
---
**Document Version**: 1.0  

**Last Updated**: September 11, 2025  

**Next Review**: September 18, 2025  

**Maintainer**: Development Team
