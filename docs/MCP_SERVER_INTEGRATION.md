# MCP Server Integration in Docker

## 🚀 Overview

The Universal AI Tools project now includes comprehensive MCP (Model Context Protocol) server integration running in Docker containers. This provides AI agents with access to various tools and capabilities through standardized protocols.

## 🏗️ Architecture

### MCP Server Manager
- **Location**: `mcp-servers/src/mcp-server-manager.ts`
- **Purpose**: Manages multiple MCP servers in a single container
- **Features**: Auto-restart, health monitoring, graceful shutdown

### HTTP Wrapper
- **Location**: `mcp-servers/src/http-wrapper.ts`
- **Purpose**: Provides HTTP endpoints for MCP server management
- **Endpoints**: Health checks, status monitoring, server control

### Docker Integration
- **Container**: `universal-ai-tools-mcp-servers`
- **Ports**: 3001-3008 for individual MCP servers
- **Health Checks**: Automatic monitoring and restart

## 🔧 Available MCP Servers

| Server | Port | Purpose | Status |
|--------|------|---------|---------|
| code-search | 3001 | Code search and analysis | ✅ Ready |
| everything | 3002 | Comprehensive tool access | ✅ Ready |
| filesystem | 3003 | File system operations | ✅ Ready |
| sequential-thinking | 3004 | Step-by-step reasoning | ✅ Ready |
| memory | 3005 | Knowledge graph management | ✅ Ready |
| time | 3006 | Time-based operations | ✅ Ready |
| git | 3007 | Git repository operations | ✅ Ready |
| fetch | 3008 | HTTP request handling | ✅ Ready |

## 🐳 Docker Setup

### Starting MCP Servers
```bash
# Start with MCP servers
docker-compose --profile mcp up -d

# Start with all services including MCP
docker-compose --profile full up -d

# Start only MCP servers
docker-compose --profile mcp up -d mcp-servers
```

### Docker Compose Configuration
```yaml
mcp-servers:
  build:
    context: ./mcp-servers
    dockerfile: Dockerfile
  container_name: universal-ai-tools-mcp-servers
  ports:
    - '3001:3001'  # code-search
    - '3002:3002'  # everything
    - '3003:3003'  # filesystem
    - '3004:3004'  # sequential-thinking
    - '3005:3005'  # memory
    - '3006:3006'  # time
    - '3007:3007'  # git
    - '3008:3008'  # fetch
  environment:
    - NODE_ENV=production
    - ENABLE_LOGGING=true
    - LOG_LEVEL=info
  profiles:
    - mcp
    - full
```

## 📡 HTTP API Endpoints

### Health Check
```http
GET /health
```
Returns overall health status of all MCP servers.

### Server Status
```http
GET /status
```
Returns detailed status of all MCP servers.

### Individual Server Status
```http
GET /server/{server-name}
```
Returns status of a specific MCP server.

### Control Endpoints
```http
POST /start          # Start all servers
POST /stop           # Stop all servers
POST /server/{name}/start  # Start specific server
POST /server/{name}/stop   # Stop specific server
```

## 🔌 Main Application Integration

### MCP Integration Service
- **Location**: `src/services/mcp-integration-service.ts`
- **Purpose**: Connects main app to Docker MCP servers
- **Features**: Automatic connection, health monitoring, fallback handling

### Connection Process
1. Main app attempts to connect to all MCP servers
2. Health checks verify server availability
3. Successful connections are maintained
4. Failed connections trigger fallback operations

### Environment Variables
```bash
# MCP Server URLs (automatically configured)
MCP_CODE_SEARCH_URL=http://mcp-servers:3001
MCP_EVERYTHING_URL=http://mcp-servers:3002
MCP_FILESYSTEM_URL=http://mcp-servers:3003
# ... etc for all servers
```

## 🧪 Testing MCP Servers

### Health Check
```bash
curl http://localhost:3001/health
```

### Server Status
```bash
curl http://localhost:3001/status
```

### Individual Server
```bash
curl http://localhost:3001/server/code-search
```

## 🔍 Monitoring and Debugging

### Container Logs
```bash
docker logs universal-ai-tools-mcp-servers
```

### Health Status
```bash
docker-compose ps mcp-servers
```

### Real-time Monitoring
```bash
docker stats universal-ai-tools-mcp-servers
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Ensure ports 3001-3008 are available
   - Check for other services using these ports

2. **Build Failures**
   - Verify Node.js version compatibility
   - Check TypeScript compilation errors
   - Ensure all dependencies are installed

3. **Connection Issues**
   - Verify network connectivity between containers
   - Check firewall settings
   - Validate health check endpoints

### Debug Commands
```bash
# Check container status
docker-compose ps

# View detailed logs
docker logs universal-ai-tools-mcp-servers --tail 100

# Test individual server connectivity
curl -v http://localhost:3001/health

# Restart MCP servers
docker-compose restart mcp-servers
```

## 📈 Performance Considerations

### Resource Limits
- **CPU**: 1.0 core limit, 0.5 core reservation
- **Memory**: 2GB limit, 1GB reservation
- **Auto-restart**: Maximum 3 attempts with 5-second delays

### Optimization
- **Container-aware**: Optimized for Docker environment
- **Graceful shutdown**: Proper signal handling
- **Health monitoring**: Continuous status checking

## 🔮 Future Enhancements

### Planned Features

* [ ] Load balancing across multiple MCP server instances
* [ ] Advanced metrics and monitoring
* [ ] Dynamic server scaling
* [ ] Enhanced error recovery
* [ ] Performance analytics

### Integration Opportunities

* [ ] Grafana dashboards for MCP server metrics
* [ ] Prometheus monitoring integration
* [ ] Alerting and notification systems
* [ ] Automated testing and validation

## 📚 Additional Resources

* [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
* [MCP Server Standards](https://github.com/modelcontextprotocol/servers)
* [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
* [Node.js in Containers](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

**Status**: ✅ **Ready for Production**
**Last Updated**: $(date)
**Version**: 1.0.0
