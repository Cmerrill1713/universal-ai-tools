# DSPy Orchestrator Component

A comprehensive React component for the Universal AI Tools platform that provides advanced AI orchestration, coordination, and optimization capabilities using the DSPy framework.

## Features

### 🎯 **Orchestration**
- **Multi-mode orchestration**: Simple, Standard, Cognitive, and Adaptive modes
- **Real-time execution tracking**: Request ID, execution time, confidence scoring
- **Context management**: JSON-based context passing for complex scenarios
- **Agent participation**: Visual display of which agents participated in the orchestration

### 🤝 **Agent Coordination**
- **Visual agent selection**: Interactive checkboxes with agent details and capabilities
- **Coordination planning**: AI-generated coordination plans for multi-agent tasks
- **Assignment tracking**: Detailed breakdown of agent assignments and responsibilities
- **Real-time coordination**: Live coordination with available agents

### 🧠 **Knowledge Management**
- **Knowledge search**: Semantic search with customizable filters and limits
- **Knowledge extraction**: Extract structured knowledge from unstructured content
- **Knowledge evolution**: Merge existing knowledge with new information using AI
- **Flexible filtering**: JSON-based filters for precise knowledge queries

### ⚡ **Prompt Optimization**
- **MIPROv2 integration**: Advanced prompt optimization using DSPy's MIPROv2
- **Example-based training**: Provide input/output examples for optimization
- **Performance metrics**: Track optimization gains and improvements
- **Automated improvements**: AI-generated suggestions for prompt enhancement

## Component Architecture

```typescript
interface DSPyOrchestratorProps {
  // No props required - fully self-contained
}
```

## API Integration

The component integrates with the following API endpoints:

- `POST /api/orchestration/orchestrate` - Main orchestration
- `POST /api/orchestration/coordinate` - Agent coordination
- `POST /api/orchestration/knowledge/search` - Knowledge search
- `POST /api/orchestration/knowledge/extract` - Knowledge extraction
- `POST /api/orchestration/knowledge/evolve` - Knowledge evolution
- `POST /api/orchestration/optimize/prompts` - Prompt optimization

## State Management

### Orchestration State
- `userRequest`: The main user query/request
- `orchestrationMode`: Selected orchestration mode
- `context`: JSON context object
- `orchestrationResult`: API response with metrics

### Coordination State
- `availableAgents`: List of available agents from API
- `selectedAgents`: User-selected agents for coordination
- `coordinationTask`: Task description for coordination
- `coordinationResult`: Coordination plan and assignments

### Knowledge State
- `knowledgeQuery`: Search query string
- `knowledgeContent`: Content for extraction
- `knowledgeFilters`: JSON filters for search
- `knowledgeLimit`: Result limit for search
- `existingKnowledge`: Knowledge base for evolution
- `newInformation`: New information to integrate
- `knowledgeResult`: Knowledge operation results

### Optimization State
- `optimizationExamples`: JSON array of training examples
- `optimizationResult`: Optimization results and metrics

## UI Components

### Tab Navigation
Four main tabs for different operations:
- **Orchestration** (🎯): Main AI orchestration interface
- **Agent Coordination** (🤝): Multi-agent coordination
- **Knowledge Management** (🧠): Knowledge operations
- **Prompt Optimization** (⚡): MIPROv2 optimization

### Results Display
Real-time results panel showing:
- Success/failure status
- Execution metrics (time, confidence)
- Participating agents
- Response data in formatted JSON
- Performance summaries

### Error Handling
- Input validation with user-friendly messages
- API error handling with specific error types
- Loading states during operations
- Graceful fallbacks for JSON parsing

## Usage Examples

### Basic Orchestration
```typescript
// User inputs a request like:
"Analyze the latest sales data and create a summary report"

// The component will:
1. Send request to orchestration API
2. Display participating agents
3. Show confidence score and execution time
4. Present formatted results
```

### Agent Coordination
```typescript
// User selects agents and provides task:
Task: "Create a marketing campaign for Q4"
Selected Agents: ["content-writer", "data-analyst", "designer"]

// The component will:
1. Generate coordination plan
2. Show agent assignments
3. Display coordination strategy
```

### Knowledge Operations
```typescript
// Search example:
Query: "machine learning best practices"
Filters: {"domain": "AI", "type": "best-practices"}
Limit: 10

// Extract example:
Content: "Long document about AI implementation..."
// Returns structured knowledge

// Evolve example:
Existing: "Current AI implementation guidelines"
New: "Latest research on AI safety practices"
// Returns evolved knowledge base
```

### Prompt Optimization
```typescript
// Training examples:
[
  {
    "input": "What's the weather?",
    "output": "Please provide your location for weather information.",
    "metadata": {"type": "clarification"}
  }
]
// Returns optimized prompts with performance metrics
```

## Performance Metrics

The component tracks and displays:
- **Execution Time**: API response time in milliseconds
- **Confidence Score**: AI confidence level (0-100%)
- **Agent Count**: Number of participating agents
- **Optimization Gain**: Performance improvement percentage

## Error Handling

Comprehensive error handling for:
- Network failures
- API errors (400, 500, etc.)
- Invalid JSON input
- Missing required fields
- Timeout scenarios

## Dependencies

- React 18+ with hooks
- TypeScript for type safety
- Tailwind CSS for styling
- Lucide React for icons
- Custom API client with axios

## Accessibility

- Keyboard navigation support
- Screen reader friendly labels
- High contrast color scheme
- Semantic HTML structure
- ARIA attributes where needed

## Future Enhancements

- Real-time WebSocket updates
- Conversation history
- Export/import functionality
- Advanced visualization
- Collaborative features
- Performance analytics dashboard

## Integration

The component is automatically integrated into the main application:
- Route: `/dspy`
- Navigation: "DSPy Orchestration" in sidebar
- Icon: Workflow icon from Lucide React

Access the component by navigating to the DSPy Orchestration section in the Universal AI Tools interface.