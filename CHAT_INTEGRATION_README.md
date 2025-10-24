# 🧠 Chat Integration with UAT-Prompt & Neuroforge

This document describes the integration of neuroforge and UAT-prompt/context engineering with chat features in Universal AI Tools.

## 🏗️ Architecture Overview

The chat integration consists of three main components working together:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UAT-Prompt    │    │   Neuroforge     │    │  Context        │
│   Engine        │    │   Integration    │    │  Engineering    │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Chat Service         │
                    │  (Orchestration Layer)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   API Endpoints         │
                    │  (Express Router)       │
                    └─────────────────────────┘
```

## 🔧 Components

### 1. UAT-Prompt Engine (`src/services/uat-prompt-engine.ts`)

**Purpose**: Intelligent prompt optimization and context injection

**Features**:
- Context retrieval from Supabase
- Conversation pattern analysis
- Prompt enhancement based on task type
- Optimal parameter calculation
- Confidence scoring

**Key Methods**:
- `processChatMessage()` - Main entry point
- `retrieveRelevantContext()` - Context retrieval
- `optimizePrompt()` - Prompt optimization
- `calculateOptimalParameters()` - LLM parameter tuning

### 2. Neuroforge Integration (`src/services/neuroforge-integration.ts`)

**Purpose**: Advanced neural network processing for chat

**Features**:
- Sentiment analysis
- Intent classification
- Complexity analysis
- Neural state management
- Learning from interactions
- Recommendation generation

**Key Methods**:
- `processMessage()` - Main processing pipeline
- `analyzeNeuralPatterns()` - Neural analysis
- `enhanceMessage()` - Message enhancement
- `updateNeuralState()` - State management

### 3. Chat Service (`src/services/chat-service.ts`)

**Purpose**: Orchestrates all components for complete chat functionality

**Features**:
- Session management
- Message processing pipeline
- Database integration
- Service coordination
- Statistics and monitoring

**Key Methods**:
- `processMessage()` - Complete message processing
- `getChatHistory()` - History retrieval
- `updateSessionContext()` - Context management
- `getServiceStats()` - Service monitoring

## 🚀 API Endpoints

### Chat Messages
- `POST /api/chat/message` - Send message and get AI response
- `GET /api/chat/history/:sessionId` - Get chat history
- `POST /api/chat/stream` - Streaming chat (Server-Sent Events)

### Session Management
- `GET /api/chat/context/:sessionId` - Get session context
- `PUT /api/chat/context/:sessionId` - Update session context
- `DELETE /api/chat/session/:sessionId` - Clear session

### Monitoring
- `GET /api/chat/stats` - Get service statistics
- `GET /api/chat/health` - Health check

## 📊 Database Schema

### Chat Messages Table
```sql
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Chat Sessions Table
```sql
CREATE TABLE chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_path TEXT,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔄 Message Processing Flow

1. **Message Reception**: User sends message via API
2. **UAT-Prompt Processing**: 
   - Retrieve relevant context from Supabase
   - Analyze conversation patterns
   - Optimize prompt with context injection
   - Calculate optimal LLM parameters
3. **Neuroforge Processing**:
   - Analyze neural patterns (sentiment, intent, complexity)
   - Enhance message with neural processing
   - Generate recommendations
   - Update neural state
4. **LLM Generation**: Call LLM with enhanced prompt
5. **Post-Processing**: Apply neuroforge insights to response
6. **Storage**: Save message and metadata to database
7. **Response**: Return enhanced AI response to user

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Install dependencies
cd nodejs-api-server
npm install

# Run tests
npx tsx ../scripts/test-chat-integration.ts
```

The test suite covers:
- Database setup verification
- Service health checks
- UAT-Prompt integration
- Neuroforge integration
- Context engineering
- End-to-end chat flow
- Session management
- Performance testing

## ⚙️ Configuration

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_anon_key

# UAT-Prompt Configuration
ENABLE_UAT_PROMPT=true

# Neuroforge Configuration
ENABLE_NEUROFORGE=true
NEUROFORGE_MODEL_PATH=./models/neuroforge
NEUROFORGE_MAX_TOKENS=2000
NEUROFORGE_TEMPERATURE=0.7
NEUROFORGE_ENABLE_LEARNING=true
NEUROFORGE_CONTEXT_WINDOW=4000

# Context Engineering
ENABLE_CONTEXT_ENGINEERING=true
```

## 📈 Monitoring

### Service Statistics
```typescript
{
  activeSessions: number,
  totalMessages: number,
  neuroforge: {
    totalInteractions: number,
    activeSessions: number,
    averageSentiment: number,
    topIntents: Array<[string, number]>
  },
  configuration: {
    uatPromptEnabled: boolean,
    neuroforgeEnabled: boolean,
    contextEngineeringEnabled: boolean
  }
}
```

### Health Check
```typescript
{
  status: 'healthy',
  service: 'chat-service',
  timestamp: string,
  features: {
    uatPrompt: boolean,
    neuroforge: boolean,
    contextEngineering: boolean
  }
}
```

## 🔧 Usage Examples

### Basic Chat Message
```typescript
const response = await fetch('http://localhost:9999/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    sessionId: 'session-456',
    message: 'Help me with TypeScript error handling',
    projectPath: '/workspace/my-project'
  })
});

const data = await response.json();
console.log(data.message.content); // Enhanced AI response
console.log(data.message.metadata); // UAT-Prompt & Neuroforge metadata
```

### Streaming Chat
```typescript
const eventSource = new EventSource('http://localhost:9999/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    sessionId: 'session-456',
    message: 'Explain async/await in JavaScript'
  })
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'chunk') {
    console.log(data.content); // Streamed response chunk
  }
};
```

### Session Management
```typescript
// Get chat history
const history = await fetch('http://localhost:9999/api/chat/history/session-456');

// Update session context
await fetch('http://localhost:9999/api/chat/context/session-456', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    categories: ['conversation', 'project_info', 'error_analysis']
  })
});

// Clear session
await fetch('http://localhost:9999/api/chat/session/session-456', {
  method: 'DELETE'
});
```

## 🚀 Getting Started

1. **Start Supabase**:
   ```bash
   supabase start
   ```

2. **Install Dependencies**:
   ```bash
   cd nodejs-api-server
   npm install
   ```

3. **Run Database Migrations**:
   ```bash
   supabase db reset
   ```

4. **Start the Server**:
   ```bash
   npm run dev
   ```

5. **Test the Integration**:
   ```bash
   npx tsx ../scripts/test-chat-integration.ts
   ```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Ensure Supabase is running
   - Check SUPABASE_URL and SUPABASE_ANON_KEY

2. **Service Not Responding**:
   - Check if all dependencies are installed
   - Verify port 9999 is available
   - Check server logs for errors

3. **Context Not Retrieved**:
   - Ensure context_storage table has data
   - Check user_id matches in context queries
   - Verify hybrid search function exists

4. **Neuroforge Not Working**:
   - Check ENABLE_NEUROFORGE environment variable
   - Verify neural state is being updated
   - Check learning data collection

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=chat-service,uat-prompt,neuroforge
```

## 📚 Further Reading

- [UAT-Prompt Engine Documentation](./src/services/uat-prompt-engine.ts)
- [Neuroforge Integration Documentation](./src/services/neuroforge-integration.ts)
- [Chat Service Documentation](./src/services/chat-service.ts)
- [API Router Documentation](./src/routers/chat.ts)
- [Database Schema](./supabase/migrations/20250127000000_chat_messages_table.sql)

## 🤝 Contributing

When adding new features to the chat integration:

1. Update the appropriate service files
2. Add tests to the test suite
3. Update this documentation
4. Ensure backward compatibility
5. Test with all integration components enabled/disabled

## 📝 License

This chat integration is part of Universal AI Tools and follows the same MIT license.