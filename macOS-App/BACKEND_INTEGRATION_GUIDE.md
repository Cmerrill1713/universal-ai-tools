# Backend Integration Guide for Enhanced UI

## Quick Start

### 1. Start Backend Services

```bash
# Terminal 1: Start main server (port 9999)
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run dev

# Terminal 2: Start local LLM server (port 7456)
npm run start:local-llm

# Terminal 3: Start Supabase (if needed)
supabase start
```

### 2. Configure WebSocket Endpoints

The enhanced UI expects these WebSocket endpoints:

```typescript
// Backend WebSocket endpoints to implement/verify
const wsEndpoints = {
  // Knowledge Graph
  '/graph/live': 'Real-time graph updates',
  
  // Agent Orchestration  
  '/agents/orchestration': 'Agent status and decisions',
  
  // Flash Attention Analytics
  '/api/realtime/flash-attention': 'Performance metrics',
  
  // Context Flow
  '/api/realtime/context': 'RAG context retrieval',
  
  // General real-time updates
  '/api/realtime/graph': 'GraphRAG updates',
  '/api/realtime/agents': 'Agent network updates',
  '/api/realtime/analytics': 'Analytics stream'
}
```

### 3. Required REST Endpoints

```typescript
// Graph endpoints
GET /graph/nodes              // Retrieve graph structure
GET /graph/search?query=       // Search graph nodes
POST /graph/query              // Execute graph queries

// Agent endpoints
GET /agents/network            // Agent network topology
GET /agents/performance        // Performance metrics
POST /agents/workflow/execute  // Execute workflows
GET /agents/mcts/tree         // AB-MCTS decision tree

// Analytics endpoints
GET /analytics/flash-attention/current     // Current metrics
GET /analytics/performance/models          // Model comparison
POST /analytics/optimization/suggestions   // Get suggestions
GET /analytics/memory/patterns            // Memory patterns

// Context endpoints
GET /context/flow/current      // Current context flow
GET /context/similarity/network // Semantic network
GET /context/clusters          // Context clusters
GET /context/timeline          // Historical timeline
POST /context/analyze          // Deep analysis
```

### 4. WebSocket Message Format

The UI expects WebSocket messages in this format:

```typescript
interface WSMessage {
  type: 'update' | 'snapshot' | 'delta' | 'error';
  category: 'graph' | 'agent' | 'analytics' | 'context';
  data: {
    timestamp: string;
    payload: any; // Specific to message type
    metadata?: {
      source?: string;
      version?: number;
      correlation_id?: string;
    };
  };
}
```

### 5. Example WebSocket Implementation

Add to your backend server:

```typescript
// src/websocket/enhanced-ui-handler.ts
import { WebSocketServer } from 'ws';

export function setupEnhancedUIWebSockets(wss: WebSocketServer) {
  // Graph updates
  wss.on('connection', (ws, req) => {
    if (req.url === '/graph/live') {
      // Send initial snapshot
      ws.send(JSON.stringify({
        type: 'snapshot',
        category: 'graph',
        data: {
          timestamp: new Date().toISOString(),
          payload: {
            nodes: getGraphNodes(),
            edges: getGraphEdges(),
            clusters: getGraphClusters()
          }
        }
      }));
      
      // Subscribe to graph changes
      graphService.on('update', (update) => {
        ws.send(JSON.stringify({
          type: 'delta',
          category: 'graph',
          data: {
            timestamp: new Date().toISOString(),
            payload: update
          }
        }));
      });
    }
  });
  
  // Similar setup for other endpoints...
}
```

### 6. Mock Data for Testing

If backend endpoints aren't ready, the UI includes mock data generators:

```swift
// In each service file, look for:
private var useMockData = true  // Set to false when backend is ready

// Example: GraphWebSocketService.swift
private func connectToBackend() {
    if useMockData {
        startMockDataGeneration()
    } else {
        // Real WebSocket connection
        let url = URL(string: "ws://localhost:9999/graph/live")!
        // ...
    }
}
```

### 7. Enable Real Backend Connection

To switch from mock to real data:

1. **Update Service Files**:
   ```swift
   // GraphWebSocketService.swift
   private var useMockData = false  // Change to false
   
   // AgentWebSocketService.swift  
   private var useMockData = false
   
   // PerformanceMetricsService.swift
   private var useMockData = false
   
   // ContextFlowService.swift
   private var useMockData = false
   ```

2. **Configure URLs**:
   ```swift
   // In each service, update the WebSocket URL
   let url = URL(string: "ws://localhost:9999/your-endpoint")!
   ```

### 8. Data Flow Architecture

```
Backend Services
    ↓
WebSocket Servers (port 9999)
    ↓
Enhanced UI WebSocket Clients
    ↓
Service Classes (GraphWebSocketService, etc.)
    ↓
ObservableObject State
    ↓
SwiftUI Views
```

### 9. Testing Integration

1. **Test WebSocket Connection**:
   ```bash
   # Test with wscat
   npm install -g wscat
   wscat -c ws://localhost:9999/graph/live
   ```

2. **Monitor Network Traffic**:
   - Open Xcode
   - Run the app
   - Debug Navigator → Network
   - Check WebSocket connections

3. **Console Debugging**:
   ```swift
   // Services log connection status
   // Check Xcode console for:
   "Connected to Graph WebSocket"
   "Received graph update: ..."
   ```

### 10. Performance Considerations

- **Throttling**: UI expects max 60 updates/second
- **Batching**: Bundle multiple small updates
- **Compression**: Consider WebSocket compression for large payloads
- **Pagination**: Send large datasets in chunks

### 11. Error Handling

The UI handles these error scenarios:
- Connection failures (auto-reconnect with backoff)
- Invalid message format (logged, ignored)
- Service unavailable (fallback to cached/mock data)
- Rate limiting (queuing and throttling)

### 12. Required Environment Variables

```bash
# .env file for backend
ENABLE_ENHANCED_UI_WS=true
WS_PORT=9999
GRAPH_SERVICE_ENABLED=true
AGENT_ORCHESTRATION_ENABLED=true
FLASH_ATTENTION_METRICS=true
CONTEXT_FLOW_TRACKING=true
```

## Troubleshooting

### WebSocket Won't Connect
1. Check backend is running on correct port
2. Verify CORS settings allow WebSocket
3. Check firewall/proxy settings
4. Try `ws://` instead of `wss://` for local dev

### No Data Showing
1. Check mock data is enabled (for testing)
2. Verify WebSocket message format matches expected structure
3. Check Xcode console for parsing errors
4. Ensure backend is sending initial snapshot

### Performance Issues
1. Reduce update frequency from backend
2. Enable batching for multiple updates
3. Check memory usage in Xcode Instruments
4. Consider pagination for large datasets

## Next Steps

1. Implement missing WebSocket endpoints in backend
2. Add real GraphRAG data from Neo4j
3. Connect agent orchestration to actual agent system
4. Stream real flash attention metrics
5. Enable context flow tracking from RAG system

With these integrations complete, the enhanced UI will display real-time data from your sophisticated backend systems!