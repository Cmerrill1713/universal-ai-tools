# Agent Performance Tracker
A comprehensive performance monitoring system for AI agents in the Universal AI Tools platform. This system tracks execution metrics, visualizes performance data, and provides real-time monitoring capabilities.
## Features
### 1. Performance Metrics Tracking

- **Execution Time**: Track how long tasks take to complete

- **Resource Usage**: Monitor CPU, memory, network, and disk I/O

- **Success Rates**: Calculate and track agent reliability

- **Task Complexity**: Analyze performance based on task difficulty
### 2. Real-time Monitoring

- WebSocket-based real-time updates

- Live performance dashboards

- Instant alerts for performance issues

- Streaming metrics visualization
### 3. Performance Analytics

- Historical trend analysis

- Agent comparison and ranking

- Performance benchmarking

- Automated alerting system
### 4. Visual Components

- Interactive charts (line, bar, pie, radar)

- Agent performance cards

- Real-time metrics stream

- Alert notifications
## Architecture
### Database Schema

#### Tables

1. **agent_performance_metrics**: Raw performance data

2. **agent_performance_aggregated**: Pre-aggregated metrics for faster queries

3. **agent_performance_benchmarks**: Expected performance standards

4. **agent_performance_alerts**: Performance issue notifications

#### Views

- **agent_performance_summary**: Real-time agent performance overview
### Services

#### AgentPerformanceTracker (`src/services/agent-performance-tracker.ts`)

Core service that handles:

- Metric recording and buffering

- Performance calculations

- Data aggregation

- Event emission

#### AgentPerformanceWebSocket (`src/services/agent-performance-websocket.ts`)

WebSocket handler for:

- Real-time metric streaming

- Client request handling

- Performance data broadcasting
### API Endpoints

#### Router: `/api/v1/agent-performance`
- `GET /summary` - Get agent performance summaries

- `GET /metrics` - Retrieve raw performance metrics

- `GET /trends` - Get aggregated performance trends

- `GET /alerts` - Fetch performance alerts

- `POST /alerts/:id/resolve` - Resolve an alert

- `GET /compare` - Compare multiple agents

- `GET /benchmarks` - Get performance benchmarks

- `PUT /benchmarks` - Update benchmarks

- `POST /aggregate` - Trigger manual aggregation
### UI Components

#### AgentPerformanceTracker (`ui/src/components/AgentPerformanceTracker.tsx`)

Main React component featuring:

- Agent overview cards

- Performance charts (execution time, success rate, resource usage)

- Agent comparison radar chart

- Real-time metrics stream

- Alert management
## Integration with SwarmOrchestrator
The performance tracker is fully integrated with the SwarmOrchestrator:
```typescript

// Automatic tracking when tasks are assigned

await this.performanceTracker.startTaskExecution(

  agent.id,

  agent.name,

  agent.type,

  task.id,

  task.name,

  complexity

);
// Automatic tracking when tasks complete

await this.performanceTracker.endTaskExecution(

  agent.id,

  agent.name,

  agent.type,

  task.id,

  success,

  error,

  resourceUsage

);

```
## Usage
### 1. Running the Migration
```bash
# Apply the database migration

npx supabase db push

```
### 2. Testing the Setup
```bash
# Run the test script

npm run test:agent-performance

```
### 3. Accessing the UI
Navigate to `/agent-performance` in the web UI to see the performance dashboard.
### 4. Using the API
```typescript

// Get agent performance summary

const response = await fetch('/api/v1/agent-performance/summary');

const { data } = await response.json();
// Get performance trends for a specific agent

const trends = await fetch(`/api/v1/agent-performance/trends?agentId=${agentId}&period=day&lookback=7`);

```
### 5. WebSocket Connection
```typescript

const ws = new WebSocket('ws://localhost:9999/agent-performance');
ws.on('message', (data) => {

  const message = JSON.parse(data);

  switch (message.type) {

    case 'performance:taskStarted':

      console.log('Task started:', message.data);

      break;

    case 'performance:taskCompleted':

      console.log('Task completed:', message.data);

      break;

    case 'performance:metricRecorded':

      console.log('New metric:', message.data);

      break;

  }

});

```
## Performance Metrics
### Success Rate Calculation

```

Success Rate = (Successful Tasks / Total Tasks) × 100

```
### Reliability Score

```

Reliability = (Success Rate × 0.7) + (Consistency × 0.3)

```
### Task Complexity Levels

1. **Level 1**: Simple, single-step tasks

2. **Level 2**: Tasks with dependencies

3. **Level 3**: High-priority or long-duration tasks

4. **Level 4**: Complex multi-step operations

5. **Level 5**: Maximum complexity tasks
## Benchmarking
Default benchmarks are provided for different agent types:

- **Cognitive Agents**: 1-5 seconds based on complexity

- **Tool Maker Agents**: 3-10 seconds based on complexity

- **Orchestrator Agents**: 0.5-2 seconds based on complexity
## Alerts
Automatic alerts are generated for:

- **Slow Execution**: Task takes >1.5x expected time

- **High Failure Rate**: Success rate drops below threshold

- **Resource Overuse**: CPU/Memory exceeds limits

- **Degraded Performance**: Consistent underperformance
## Best Practices
1. **Buffer Flushing**: Metrics are buffered and flushed every 5 seconds

2. **Aggregation**: Automatic aggregation runs every 5 minutes

3. **Data Retention**: Default 30-day retention for raw metrics

4. **Real-time Updates**: Enable for live monitoring, disable for batch processing
## Troubleshooting
### Common Issues
1. **Metrics not showing**: Check WebSocket connection and Supabase connectivity

2. **Aggregation failing**: Verify database permissions and function creation

3. **High memory usage**: Adjust buffer size and flush interval

4. **Missing benchmarks**: Re-run migration to insert default benchmarks
### Debug Mode
Enable debug logging:

```typescript

logger.setLevel('debug');

```
## Future Enhancements
1. **Machine Learning**: Predictive performance analysis

2. **Anomaly Detection**: Automatic outlier identification

3. **Custom Dashboards**: User-configurable views

4. **Export Features**: Performance reports in various formats

5. **Integration APIs**: Third-party monitoring tool support