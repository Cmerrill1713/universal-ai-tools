# LLM Status Streaming Guide

## Overview
Real-time status indicators for LLM processing, showing animated thinking dots, reasoning steps, and progress updates during AI responses.

## Features

### 🧠 Intelligent Status Detection
- **Simple queries**: Quick response indicators
- **Complex queries**: Multi-step R1 reasoning process
- **Automatic detection**: Based on query complexity and keywords

### 🎯 Status Types
- **🤔 Thinking**: Initial request analysis
- **🔍 Retrieving**: Searching conversation history
- **🔬 Analyzing**: Processing context and complexity
- **💭 Reasoning**: R1 deep reasoning cycles
- **🔎 Searching**: Knowledge graph traversal
- **🔗 Connecting**: Linking related concepts
- **✍️ Generating**: Composing final response
- **✅ Complete**: Response ready

### 📊 Visual Indicators
- Animated emoji icons with pulsing effects
- Flowing dots animation (e.g., "Thinking...")
- Progress bars for multi-step processes
- Step counters (e.g., "Step 3/7")
- Color-coded status containers

## Implementation

### Backend Components

#### 1. Status Stream Service (`llm-status-stream-service.ts`)
```typescript
// Send status update
llmStatusStream.sendStatus(sessionId, 'thinking', 'Analyzing your request...');

// Send reasoning step
llmStatusStream.sendReasoningStep(sessionId, 3, 7, 'connecting', 'Linking concepts');

// Complete stream
llmStatusStream.completeStream(sessionId, 'Response ready');
```

#### 2. Server-Sent Events Endpoint (`/api/v1/llm-stream/status/:sessionId`)
- Real-time streaming via SSE
- Cross-origin support
- Automatic cleanup on disconnect

#### 3. Chat Integration
- Automatic session ID generation
- Status updates throughout processing
- R1 reasoning detection and visualization

### Frontend Integration

#### HTML/JavaScript Example
```html
<!-- Status display container -->
<div class="status-container">
    <div class="status-display">
        <span class="status-icon">🤔</span>
        <span class="status-message">Thinking...</span>
    </div>
    <div class="progress-bar">
        <div class="progress-fill"></div>
    </div>
</div>

<script>
// Connect to status stream
const eventSource = new EventSource(`/api/v1/llm-stream/status/${sessionId}`);

eventSource.addEventListener('status', (event) => {
    const data = JSON.parse(event.data);
    updateStatusDisplay(data.type, data.message, data);
});

eventSource.addEventListener('animation', (event) => {
    const data = JSON.parse(event.data);
    updateAnimatedFrame(data.frame);
});
</script>
```

#### React Component Example
```jsx
import { useEffect, useState } from 'react';

function StatusIndicator({ sessionId }) {
    const [status, setStatus] = useState({ type: 'thinking', message: 'Starting...' });
    
    useEffect(() => {
        const eventSource = new EventSource(`/api/v1/llm-stream/status/${sessionId}`);
        
        eventSource.addEventListener('status', (event) => {
            setStatus(JSON.parse(event.data));
        });
        
        return () => eventSource.close();
    }, [sessionId]);
    
    return (
        <div className="status-indicator">
            <span className="icon">{getStatusIcon(status.type)}</span>
            <span className="message">{status.message}</span>
        </div>
    );
}
```

## API Endpoints

### 1. Status Streaming
```bash
GET /api/v1/llm-stream/status/:sessionId
# Server-Sent Events stream for real-time updates
```

### 2. Current Status
```bash
GET /api/v1/llm-stream/current/:sessionId
# Get current status snapshot
```

### 3. Test Animation
```bash
POST /api/v1/llm-stream/test
# Trigger demo animation sequence
```

## Usage Examples

### 1. Start Chat with Status Streaming
```bash
# Send chat message
curl -X POST http://localhost:9999/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "Explain how machine learning works",
    "conversationId": "conv-123"
  }'

# Response includes sessionId and stream URL
{
  "data": {
    "sessionId": "chat-conv-123-1755482512739",
    "statusStreamUrl": "/api/v1/llm-stream/status/chat-conv-123-1755482512739"
  }
}
```

### 2. Connect to Status Stream
```javascript
// Frontend JavaScript
const sessionId = response.data.sessionId;
const eventSource = new EventSource(`/api/v1/llm-stream/status/${sessionId}`);

eventSource.addEventListener('status', (event) => {
    const { type, message, progress, step, totalSteps } = JSON.parse(event.data);
    
    // Update UI based on status
    updateStatusIndicator(type, message, progress);
    
    if (step && totalSteps) {
        updateStepIndicator(step, totalSteps);
    }
});
```

### 3. Test Demo Animation
```bash
# Start test animation
curl -X POST http://localhost:9999/api/v1/llm-stream/test \
  -H "Content-Type: application/json" \
  -d '{}'

# Then connect to stream URL from response
```

## Status Flow Examples

### Simple Query Flow
```
🤔 Thinking... → ✍️ Generating response... → ✅ Complete
```

### Complex R1 Reasoning Flow
```
🤔 Thinking...
    ↓
🔍 Searching conversation history...
    ↓
🔬 Analyzing request complexity...
    ↓
💭 Engaging deep reasoning (R1)...
    ↓
🔎 Searching knowledge graph...
    ↓
🔗 Connecting related concepts...
    ↓
✍️ Generating response...
    ↓
✅ Complete
```

## Styling Guide

### CSS Classes
```css
.status-container {
    background: #2a2a2a;
    border-radius: 12px;
    padding: 20px;
    position: relative;
}

.status-icon {
    animation: pulse 2s infinite;
}

.progress-bar {
    background: #444;
    height: 4px;
    border-radius: 2px;
}

.progress-fill {
    background: linear-gradient(90deg, #4CAF50, #81C784);
    transition: width 0.3s ease;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}
```

### Animation Patterns
- **Pulse**: Gentle opacity animation for icons
- **Thinking dots**: Progressive dots for processing states
- **Progress bars**: Smooth width transitions
- **Color coding**: Green for success, red for errors

## Demo

Open `demo-status-display.html` in a browser to see:
- ✨ Animated status indicators
- 📊 Real-time progress updates
- 🔄 Complete R1 reasoning simulation
- 📝 Event logging and debugging

## Integration with Your Frontend

### For React/Vue/Angular Apps
1. Create a status component using the patterns above
2. Connect to SSE endpoint when starting LLM requests
3. Update UI based on received events
4. Handle reconnection and error states

### For CLI/Terminal Apps
```javascript
// Use the built-in CLI formatter
const display = llmStatusStream.formatStatusForCLI(sessionId);
console.log(`\r${display}`); // Overwrite current line
```

### For Mobile Apps
- Use WebSocket or HTTP polling as fallback
- Implement native status indicators
- Consider battery optimization for long requests

## Performance Notes

- ⚡ **Minimal overhead**: SSE is lightweight
- 🧹 **Auto cleanup**: Sessions automatically cleaned after 5 seconds
- 📊 **Memory efficient**: Circular buffers and typed arrays
- 🔄 **Reconnection**: Built-in reconnection handling

## Troubleshooting

### Common Issues
1. **CORS errors**: Ensure proper CORS headers in production
2. **Connection drops**: Implement reconnection logic
3. **Session not found**: Check session ID format and timing

### Debug Mode
Enable verbose logging in the status service for debugging:
```typescript
const verbose = true;
llmStatusStream.sendStatus(sessionId, 'thinking', 'Debug message', { verbose });
```

This creates a smooth, animated experience that shows users exactly what the AI is doing, especially during complex R1 reasoning cycles!