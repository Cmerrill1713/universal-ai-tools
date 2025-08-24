# Universal AI Tools Server Architecture & Startup Flow

## Server Startup Flow

```mermaid
flowchart TD
    A[server.ts starts] --> B[Import modules]
    B --> C[Initialize configuration]
    C --> D[Create Express app]
    D --> E[Setup middleware]
    E --> F[Create HTTP server]
    F --> G[Create WebSocket server]
    G --> H[Define API routes]
    H --> I[server.listen on port 9999]
    I --> J[Initialize services in callback]
    J --> K[Server running]

    B --> DSPy[DSPy Service singleton created]
    DSPy --> DSPyInit[DSPy.initialize called in constructor]
    DSPyInit --> DSPyConnect[Connects to mock server on 8766]

    style DSPy fill:#ff9999
    style DSPyInit fill:#ff9999
    style I fill:#ffff99
```

## API Endpoints Structure

```mermaid
graph LR
    API[/api] --> Health[/health]
    API --> V1[/v1]
    API --> Legacy[Legacy Routes]

    V1 --> V1Tools[/tools]
    V1 --> V1Memory[/memory]
    V1 --> V1Context[/context]
    V1 --> V1Knowledge[/knowledge]
    V1 --> V1Orchestration[/orchestration]
    V1 --> V1Speech[/speech]
    V1 --> V1Docs[/docs]
    V1 --> V1Backup[/backup]

    Legacy --> LTools[/tools]
    Legacy --> LMemory[/memory]
    Legacy --> LContext[/context]
    Legacy --> LKnowledge[/knowledge]
    Legacy --> LOrchestration[/orchestration]

    API --> Ports[/ports]
    Ports --> PortStatus[/status]
    Ports --> PortReport[/report]
    Ports --> PortHealth[/health-check]
    Ports --> PortResolve[/resolve-conflict]

    API --> Performance[/performance]
    Performance --> PerfMetrics[/metrics]
    Performance --> PerfReport[/report]

    API --> Assistant[/assistant]
    Assistant --> Chat[/chat]
    Assistant --> SuggestTools[/suggest-tools]
    Assistant --> GenIntegration[/generate-integration]
    Assistant --> RouteRequest[/route-request]

    style Ports fill:#ff9999
```

## Service Dependencies

```mermaid
graph TD
    Server[Main Server] --> Express[Express App]
    Server --> HTTP[HTTP Server]
    Server --> WS[WebSocket Server]

    Server --> Services{Services}
    Services --> DSPy[DSPy Service]
    Services --> Redis[Redis Client]
    Services --> Supabase[Supabase Client]
    Services --> PortIntegration[Port Integration Service]

    DSPy --> MockServer[DSPy Mock Server :8766]
    PortIntegration --> PortManager[Smart Port Manager]
    PortIntegration --> HealthMonitor[Port Health Monitor]

    Server --> Routers{API Routers}
    Routers --> ToolRouter
    Routers --> MemoryRouter
    Routers --> OrchestrationRouter
    Routers --> KnowledgeRouter
    Routers --> SpeechRouter

    OrchestrationRouter --> DSPy

    style PortIntegration fill:#ffff99
    style DSPy fill:#ff9999
```

## Potential Issues Identified

```mermaid
graph TD
    Issue1[DSPy Service initialization in constructor]
    Issue1 --> Problem1[Async init not awaited]

    Issue2[Port Integration Service disabled]
    Issue2 --> Problem2[Port endpoints will fail]

    Issue3[Server startup sequence]
    Issue3 --> Problem3[Code not reaching server.listen]

    Issue4[Module-level initialization]
    Issue4 --> Problem4[DSPy singleton blocks at import time]

    style Issue1 fill:#ff9999
    style Issue4 fill:#ff9999
```
