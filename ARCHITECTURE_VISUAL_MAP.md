# Universal AI Tools - Complete Architecture Visual Map

## Level 1: High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend<br/>Spectrum UI]
        iOS[iOS Companion App<br/>SwiftUI]
        API_CLIENT[API Clients<br/>REST/WebSocket]
    end
    
    subgraph "Server Layer"
        EXPRESS[Express.js Server<br/>Port 9999]
        WS[WebSocket Server<br/>Socket.IO]
        AUTH[Authentication<br/>JWT + Device Auth]
    end
    
    subgraph "Service Layer"
        AGENTS[Agent Registry<br/>6 Enhanced Agents]
        MCP[MCP Integration<br/>Context Management]
        VAULT[Supabase Vault<br/>Secrets Management]
    end
    
    subgraph "Data Layer"
        SUPABASE[(Supabase<br/>PostgreSQL + Vector)]
        REDIS[(Redis<br/>Caching)]
        FILES[File System<br/>Local Storage]
    end
    
    UI --> EXPRESS
    iOS --> EXPRESS
    API_CLIENT --> EXPRESS
    EXPRESS --> WS
    EXPRESS --> AUTH
    EXPRESS --> AGENTS
    EXPRESS --> MCP
    EXPRESS --> VAULT
    AGENTS --> SUPABASE
    MCP --> SUPABASE
    VAULT --> SUPABASE
    EXPRESS --> REDIS
    EXPRESS --> FILES
```

## Level 2: Detailed Service Architecture

```mermaid
graph TB
    subgraph "Express Server Core"
        SERVER[UniversalAIToolsServer]
        MIDDLEWARE[Middleware Stack]
        ROUTES[Route Handlers]
        ERROR[Global Error Handler]
    end
    
    subgraph "Agent System"
        REGISTRY[Agent Registry]
        PLANNER[Enhanced Planner Agent]
        RETRIEVER[Enhanced Retriever Agent]
        SYNTHESIZER[Enhanced Synthesizer Agent]
        PERSONAL[Personal Assistant Agent]
        CODE[Code Assistant Agent]
        A2A[A2A Communication Mesh]
    end
    
    subgraph "AI Services"
        OLLAMA[Ollama Service<br/>Local LLMs]
        MLX[MLX Service<br/>Apple Silicon ML]
        VISION[PyVision Bridge<br/>Image Processing]
        LFM2[LFM2 Bridge<br/>Fast Coordinator]
        DSPY[DSPy Orchestrator<br/>10-Agent Chains]
    end
    
    subgraph "Context & Memory"
        CONTEXT_INJ[Context Injection Service]
        CONTEXT_STORE[Context Storage Service]
        MCP_SERVICE[MCP Integration Service]
        MEMORY[Memory Management]
    end
    
    subgraph "Infrastructure"
        HEALTH[Health Monitor]
        PARAMS[Intelligent Parameters]
        RATE_LIMIT[Rate Limiter]
        SECURITY[Security Headers]
    end
    
    SERVER --> MIDDLEWARE
    MIDDLEWARE --> ROUTES
    ROUTES --> ERROR
    SERVER --> REGISTRY
    REGISTRY --> PLANNER
    REGISTRY --> RETRIEVER
    REGISTRY --> SYNTHESIZER
    REGISTRY --> PERSONAL
    REGISTRY --> CODE
    REGISTRY --> A2A
    SERVER --> OLLAMA
    SERVER --> MLX
    SERVER --> VISION
    SERVER --> LFM2
    SERVER --> DSPY
    SERVER --> CONTEXT_INJ
    SERVER --> CONTEXT_STORE
    SERVER --> MCP_SERVICE
    SERVER --> MEMORY
    SERVER --> HEALTH
    MIDDLEWARE --> PARAMS
    MIDDLEWARE --> RATE_LIMIT
    MIDDLEWARE --> SECURITY
```

## Level 3: API Router Architecture

```mermaid
graph TB
    subgraph "API v1 Routes"
        BASE[/api/v1]
        CHAT[/api/v1/chat<br/>Chat Router]
        AGENTS_API[/api/v1/agents<br/>Agent Router]
        MEMORY_API[/api/v1/memory<br/>Memory Router]
        VISION_API[/api/v1/vision<br/>Vision Router]
        MCP_API[/api/v1/mcp<br/>MCP Agent Router]
        MLX_API[/api/v1/mlx<br/>MLX Router]
        AUTH_API[/api/v1/device-auth<br/>Device Auth Router]
        SECRETS_API[/api/v1/secrets<br/>Secrets Router]
        KNOWLEDGE_API[/api/v1/knowledge<br/>Knowledge Router]
        MONITORING_API[/api/v1/monitoring<br/>Monitoring Router]
        SYSTEM_API[/api/v1/system<br/>System Metrics Router]
    end
    
    subgraph "Specialized Routes"
        AB_MCTS[/api/v1/ab-mcts<br/>AB-MCTS Orchestration]
        HUGGINGFACE[/api/v1/huggingface<br/>HuggingFace Integration]
        SPEECH[/api/speech<br/>Speech/Voice Router]
        FAST_COORD[/api/v1/fast-coordinator<br/>Multi-Tier LLM]
    end
    
    subgraph "WebSocket Endpoints"
        WS_DEVICE[/ws/device-auth<br/>Device Authentication]
        WS_GENERAL[WebSocket Events<br/>ping/pong, connect/disconnect]
    end
    
    BASE --> CHAT
    BASE --> AGENTS_API
    BASE --> MEMORY_API
    BASE --> VISION_API
    BASE --> MCP_API
    BASE --> MLX_API
    BASE --> AUTH_API
    BASE --> SECRETS_API
    BASE --> KNOWLEDGE_API
    BASE --> MONITORING_API
    BASE --> SYSTEM_API
    BASE --> AB_MCTS
    BASE --> HUGGINGFACE
    BASE --> SPEECH
    BASE --> FAST_COORD
```

## Level 4: Database Schema Architecture

```mermaid
erDiagram
    tasks {
        text id PK
        text agent_name
        text_array supporting_agents
        text user_request
        jsonb context
        text status
        text priority
        jsonb result
        timestamptz created_at
        timestamptz completed_at
    }
    
    agent_performance_metrics {
        uuid id PK
        text agent_name
        text task_id FK
        integer execution_time_ms
        boolean success
        float confidence_score
        timestamptz created_at
    }
    
    context_storage {
        uuid id PK
        text content
        text category
        text source
        text user_id
        text project_path
        jsonb metadata
        timestamptz created_at
    }
    
    mcp_context {
        uuid id PK
        text content
        text category
        jsonb metadata
        timestamptz created_at
    }
    
    mcp_code_patterns {
        uuid id PK  
        text pattern_name
        text pattern_type
        text content
        jsonb metadata
        timestamptz created_at
    }
    
    architecture_patterns {
        uuid id PK
        text name
        text framework
        text pattern_type
        text description
        jsonb implementation
        integer usage_count
        float success_rate
        timestamptz created_at
    }
    
    knowledge_sources {
        uuid id PK
        text content
        text source
        text type
        text user_id
        vector embedding
        timestamptz created_at
    }
    
    documents {
        uuid id PK
        text name
        text path
        text content
        text content_type
        jsonb metadata
        timestamptz created_at
    }
    
    memories {
        uuid id PK
        uuid source_id
        text content
        text content_type
        vector text_embedding
        vector visual_embedding
        jsonb metadata
        timestamptz created_at
    }
    
    tasks ||--o{ agent_performance_metrics : "tracks"
    context_storage ||--o{ mcp_context : "references"
    architecture_patterns ||--o{ tasks : "guides"
    knowledge_sources ||--o{ memories : "feeds_into"
    documents ||--o{ memories : "creates"
```

## Level 5: Service Integration Flow

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant Agent
    participant Context
    participant MCP
    participant Supabase
    participant Vault
    
    Client->>Express: POST /api/v1/agents/execute
    Express->>Express: Apply Middleware (Auth, Rate Limit, Params)
    Express->>Context: Inject Context
    Context->>Supabase: Retrieve Relevant Knowledge
    Context->>MCP: Get Code Patterns
    MCP->>Supabase: Query mcp_context
    Context-->>Express: Enriched Context
    Express->>Agent: Execute with Context
    Agent->>Vault: Get API Keys
    Vault->>Supabase: vault.read_secret()
    Vault-->>Agent: API Key
    Agent->>Agent: Process Request
    Agent->>Supabase: Store Results in tasks
    Agent-->>Express: Agent Response
    Express->>Context: Store Execution Context
    Context->>Supabase: Insert context_storage
    Express-->>Client: JSON Response
```

## Level 6: Error Handling & Monitoring Flow

```mermaid
graph TB
    subgraph "Error Sources"
        ROUTE_ERROR[Route Handler Error]
        SERVICE_ERROR[Service Failure]
        DB_ERROR[Database Error]
        EXTERNAL_ERROR[External API Error]
    end
    
    subgraph "Error Processing"
        GLOBAL_HANDLER[Global Error Handler]
        ERROR_ANALYSIS[Error Analysis]
        CONTEXT_STORAGE[Context Storage]
        SANITIZATION[Response Sanitization]
    end
    
    subgraph "Error Response"
        CLIENT_RESPONSE[Sanitized Client Response]
        ERROR_LOG[Structured Error Log]
        STORED_CONTEXT[Stored Error Context]
    end
    
    subgraph "Monitoring"
        HEALTH_MONITOR[Health Monitor]
        METRICS[Performance Metrics]
        ALERTING[Alert System]
    end
    
    ROUTE_ERROR --> GLOBAL_HANDLER
    SERVICE_ERROR --> GLOBAL_HANDLER
    DB_ERROR --> GLOBAL_HANDLER
    EXTERNAL_ERROR --> GLOBAL_HANDLER
    
    GLOBAL_HANDLER --> ERROR_ANALYSIS
    ERROR_ANALYSIS --> CONTEXT_STORAGE
    ERROR_ANALYSIS --> SANITIZATION
    
    SANITIZATION --> CLIENT_RESPONSE
    ERROR_ANALYSIS --> ERROR_LOG
    CONTEXT_STORAGE --> STORED_CONTEXT
    
    GLOBAL_HANDLER --> HEALTH_MONITOR
    HEALTH_MONITOR --> METRICS
    METRICS --> ALERTING
```

## Level 7: Frontend Integration Architecture

```mermaid
graph TB
    subgraph "React Frontend (ui/src/)"
        APP[App.tsx<br/>Router Provider]
        DASHBOARD[DashboardModern.tsx]
        CHAT[ChatModern.tsx]
        AGENTS_UI[Agents.tsx]
        MEMORY_UI[Memory.tsx]
        VISION_UI[VisionStudio.tsx]
        MONITORING_UI[MonitoringDashboard.tsx]
    end
    
    subgraph "API Integration"
        API_LIB[lib/api.ts]
        API_ENHANCED[lib/api-enhanced.ts]
        SUPABASE_CLIENT[lib/supabase.ts]
    end
    
    subgraph "State Management"
        STORE[store/index.ts]
        HOOKS[hooks/<br/>useChat, useSystemStatus]
        CONTEXT[contexts/AuthContext]
    end
    
    subgraph "Backend APIs"
        BACKEND_CHAT[/api/v1/chat]
        BACKEND_STATUS[/api/v1/status]
        BACKEND_MCP[/api/v1/mcp]
        BACKEND_AGENTS[/api/v1/agents]
        BACKEND_MEMORY[/api/v1/memory]
    end
    
    APP --> DASHBOARD
    APP --> CHAT
    APP --> AGENTS_UI
    APP --> MEMORY_UI
    APP --> VISION_UI
    APP --> MONITORING_UI
    
    DASHBOARD --> API_LIB
    CHAT --> API_ENHANCED
    AGENTS_UI --> API_LIB
    
    API_LIB --> BACKEND_CHAT
    API_LIB --> BACKEND_STATUS
    API_LIB --> BACKEND_MCP
    API_ENHANCED --> BACKEND_AGENTS
    API_ENHANCED --> BACKEND_MEMORY
    
    STORE --> HOOKS
    HOOKS --> CONTEXT
    CONTEXT --> SUPABASE_CLIENT
```

## Level 8: iOS Companion App Architecture

```mermaid
graph TB
    subgraph "SwiftUI App Structure"
        APP_SWIFT[UniversalAICompanionApp.swift]
        CONTENT[ContentView.swift]
        AUTH_VIEW[AuthenticationView.swift]
        ANIMATED_STATUS[AnimatedAuthenticationStatusView.swift]
    end
    
    subgraph "Core Services"
        DEVICE_AUTH[DeviceAuthenticationManager.swift]
        PROXIMITY[ProximityDetectionService.swift]
        WATCH_CONN[WatchConnectivityService.swift]
        IMAGE_CACHE[ImageCacheManager.swift]
    end
    
    subgraph "Apple Frameworks"
        CORE_BT[CoreBluetooth<br/>BLE Communication]
        LOCAL_AUTH[LocalAuthentication<br/>Biometric Auth]
        WATCH_KIT[WatchConnectivity<br/>Apple Watch]
        SECURITY[Security Framework<br/>Keychain]
    end
    
    subgraph "Backend Integration"
        DEVICE_API[/api/v1/device-auth<br/>Registration/Challenge]
        WS_DEVICE_API[/ws/device-auth<br/>Real-time Events]
        JWT_TOKENS[JWT Token Exchange]
    end
    
    APP_SWIFT --> CONTENT
    CONTENT --> AUTH_VIEW
    AUTH_VIEW --> ANIMATED_STATUS
    
    AUTH_VIEW --> DEVICE_AUTH
    DEVICE_AUTH --> PROXIMITY
    DEVICE_AUTH --> WATCH_CONN
    CONTENT --> IMAGE_CACHE
    
    DEVICE_AUTH --> CORE_BT
    DEVICE_AUTH --> LOCAL_AUTH
    WATCH_CONN --> WATCH_KIT
    DEVICE_AUTH --> SECURITY
    
    DEVICE_AUTH --> DEVICE_API
    PROXIMITY --> WS_DEVICE_API
    DEVICE_API --> JWT_TOKENS
```

## Level 9: Security & Authentication Flow

```mermaid
graph TB
    subgraph "Authentication Methods"
        JWT_AUTH[JWT Authentication<br/>Bearer Tokens]
        API_KEY[API Key Authentication<br/>X-API-Key Header]
        DEVICE_AUTH[Device Authentication<br/>Bluetooth Proximity]
        BIOMETRIC[Biometric Authentication<br/>Touch/Face ID]
    end
    
    subgraph "Security Layers"
        HELMET[Helmet.js<br/>Security Headers]
        CORS[CORS Configuration<br/>Origin Validation]
        RATE_LIMITING[Rate Limiting<br/>Request Throttling]
        INPUT_VALIDATION[Input Validation<br/>Request Sanitization]
    end
    
    subgraph "Secret Management"
        VAULT_SERVICE[Vault Service<br/>Runtime Secret Access]
        SUPABASE_VAULT[Supabase Vault<br/>Encrypted Storage]
        MIGRATION_SERVICE[Vault Migration Service<br/>Env → Vault]
    end
    
    subgraph "Security Monitoring"
        ERROR_HANDLER[Global Error Handler<br/>Security Filtering]
        PROMPT_INJECTION[Prompt Injection Detection]
        SENSITIVE_DATA[Sensitive Data Filtering]
        AUDIT_LOG[Security Audit Logging]
    end
    
    JWT_AUTH --> HELMET
    API_KEY --> CORS
    DEVICE_AUTH --> RATE_LIMITING
    BIOMETRIC --> INPUT_VALIDATION
    
    HELMET --> VAULT_SERVICE
    CORS --> SUPABASE_VAULT
    RATE_LIMITING --> MIGRATION_SERVICE
    
    VAULT_SERVICE --> ERROR_HANDLER
    SUPABASE_VAULT --> PROMPT_INJECTION
    MIGRATION_SERVICE --> SENSITIVE_DATA
    INPUT_VALIDATION --> AUDIT_LOG
```

## Summary

This comprehensive architecture map shows how Universal AI Tools connects all frameworks across 9 detailed levels:

1. **High-Level System** - Client, Server, Service, Data layers
2. **Service Architecture** - Express core, agents, AI services, infrastructure  
3. **API Routes** - All REST endpoints and WebSocket connections
4. **Database Schema** - Complete table relationships and data flow
5. **Service Integration** - Request/response flow between components
6. **Error Handling** - Comprehensive error processing and monitoring
7. **Frontend Integration** - React app structure and API connections
8. **iOS Companion** - SwiftUI app with Apple framework integration
9. **Security Flow** - Authentication, secrets, and security monitoring

Each level shows the specific connections and data flow, providing a complete visual understanding of how all frameworks interconnect in the Universal AI Tools ecosystem.