# Universal AI Tools - Comprehensive API Documentation

## Next-Generation AI Platform with Service-Oriented Architecture

**Version**: 2.0.0  
**Base URL**: `http://localhost:9999` (or your production domain)  
**Authentication**: API Key + JWT based  
**Content-Type**: `application/json`

## Overview

Universal AI Tools provides a sophisticated service-oriented architecture with advanced AI capabilities including:

- **Multi-Tier LLM Coordination** - LFM2-1.2B for fast routing, larger models for complex tasks
- **MLX Fine-Tuning Framework** - Apple Silicon optimized model training 
- **Intelligent Parameter Automation** - ML-based parameter optimization
- **AB-MCTS Probabilistic Learning** - Advanced agent selection and spawning
- **PyVision Integration** - SDXL Refiner with MLX optimization
- **DSPy Cognitive Orchestration** - 10-agent reasoning chains
- **Production Infrastructure** - Health monitoring, telemetry, security

---

## 🔑 Authentication

### API Key Authentication
```http
X-API-Key: your-api-key
X-AI-Service: your-service-name
```

### JWT Authentication
```http
Authorization: Bearer <jwt-token>
```

### Development vs Production
```bash
# Development
X-API-Key: test-dev-key-12345

# Production
X-API-Key: your-production-api-key
```

---

## Core Services API

### 1. Multi-Tier LLM Coordination (`/api/v1/fast-coordinator`)

#### POST `/api/v1/fast-coordinator/route`
Fast routing decisions using LFM2-1.2B for optimal service selection.

**Request:**
```json
{
  "userRequest": "Generate a React component for user authentication",
  "context": {
    "taskType": "code_generation",
    "complexity": "medium",
    "urgency": "high",
    "expectedResponseLength": "medium",
    "requiresCreativity": false,
    "requiresAccuracy": true
  }
}
```

**Response:**
```json
{
  "routingDecision": {
    "shouldUseLocal": true,
    "targetService": "lm-studio",
    "reasoning": "Code generation task best suited for specialized model",
    "complexity": "medium",
    "estimatedTokens": 1500,
    "priority": 2
  },
  "executionTime": 45,
  "serviceUsed": "lm-studio"
}
```

#### POST `/api/v1/fast-coordinator/execute`
Execute request with intelligent routing and coordination.

**Request:**
```json
{
  "userRequest": "Analyze this code for security vulnerabilities",
  "context": {
    "taskType": "analysis",
    "complexity": "high",
    "urgency": "medium",
    "expectedResponseLength": "long",
    "requiresCreativity": false,
    "requiresAccuracy": true
  }
}
```

**Response:**
```json
{
  "response": {
    "content": "Security analysis results...",
    "model": "claude-3-sonnet",
    "provider": "anthropic",
    "confidence": 0.92
  },
  "metadata": {
    "routingDecision": {
      "shouldUseLocal": false,
      "targetService": "anthropic",
      "reasoning": "Complex analysis requires advanced model",
      "complexity": "high",
      "estimatedTokens": 2000,
      "priority": 1
    },
    "executionTime": 2340,
    "tokensUsed": 1847,
    "serviceUsed": "anthropic"
  }
}
```

#### POST `/api/v1/fast-coordinator/multi-agent`
Coordinate multiple agents with fast routing for complex tasks.

**Request:**
```json
{
  "primaryTask": "Design a microservices architecture",
  "supportingTasks": [
    "Research best practices for API design",
    "Identify security considerations",
    "Suggest monitoring strategies"
  ]
}
```

**Response:**
```json
{
  "primary": {
    "content": "Comprehensive microservices architecture design with API gateway, service mesh, and event-driven communication patterns...",
    "confidence": 0.91,
    "model": "claude-3-sonnet"
  },
  "supporting": [
    {
      "task": "Research best practices for API design",
      "result": "RESTful principles, GraphQL for complex queries, gRPC for internal services...",
      "confidence": 0.88,
      "model": "llama3.2:3b"
    },
    {
      "task": "Identify security considerations", 
      "result": "OAuth2/OIDC authentication, mTLS between services, API rate limiting...",
      "confidence": 0.92,
      "model": "gpt-4"
    },
    {
      "task": "Suggest monitoring strategies",
      "result": "Distributed tracing with OpenTelemetry, Prometheus metrics, centralized logging...",
      "confidence": 0.85,
      "model": "lm-studio"
    }
  ],
  "coordination": {
    "totalTime": 8500,
    "fastDecisions": 4,
    "servicesUsed": ["anthropic", "ollama", "lm-studio"]
  }
}
```

---

### 2. AB-MCTS Probabilistic Orchestration (`/api/v1/ab-mcts`)

#### POST `/api/v1/ab-mcts/execute`
Execute tasks using probabilistic learning and agent selection.

**Request:**
```json
{
  "task": "Optimize database queries for better performance",
  "context": {
    "taskType": "optimization",
    "priority": "high",
    "expectedOutcome": "performance_improvement"
  },
  "options": {
    "explorationRate": 0.1,
    "maxDepth": 5,
    "useThompsonSampling": true
  }
}
```

**Response:**
```json
{
  "result": {
    "selectedPath": "path_optimizer_agent_v2",
    "confidence": 0.87,
    "expectedReward": 0.82,
    "solution": {
      "optimizations": [
        "Add composite indexes on frequently joined columns",
        "Implement query result caching with Redis",
        "Use database connection pooling",
        "Optimize N+1 queries with eager loading"
      ],
      "estimatedImprovement": "65% reduction in query time"
    }
  },
  "tree": {
    "totalNodes": 23,
    "exploredPaths": 8,
    "bestPath": {
      "nodes": ["initial", "analyze_queries", "identify_bottlenecks", "optimize_indexes", "implement_caching"],
      "totalReward": 0.87
    }
  },
  "learning": {
    "agentPerformanceUpdates": 3,
    "newSpawns": 1,
    "convergenceMetrics": {
      "explorationRate": 0.08,
      "convergenceScore": 0.91,
      "confidence": 0.85
    }
  }
}
```

#### GET `/api/v1/ab-mcts/tree/{sessionId}`
Get the current MCTS tree state for a session.

**Response:**
```json
{
  "tree": {
    "root": {
      "id": "root_node",
      "state": "initial_task",
      "visits": 45,
      "totalReward": 35.2,
      "children": ["node_1", "node_2", "node_3"]
    },
    "totalNodes": 45,
    "maxDepth": 7,
    "explorationStats": {
      "totalVisits": 230,
      "explorationRate": 0.1,
      "averageReward": 0.78,
      "bestPathReward": 0.91
    }
  },
  "agents": [
    {
      "id": "optimizer_v1",
      "performance": {
        "successRate": 0.78,
        "averageReward": 0.72,
        "executionCount": 23
      }
    }
  ]
}
```

#### POST `/api/v1/ab-mcts/feedback`
Provide feedback to update agent performance models.

**Request:**
```json
{
  "sessionId": "mcts_session_123",
  "nodeId": "node_45",
  "feedback": {
    "userSatisfaction": 0.9,
    "taskCompleted": true,
    "executionTime": 1200,
    "qualityRating": 0.85
  }
}
```

---

### 3. DSPy Cognitive Orchestration (`/api/v1/dspy`)

#### POST `/api/v1/dspy/cognitive-reasoning`
Execute 10-agent cognitive reasoning chain for complex problems.

**Request:**
```json
{
  "request": "Design a scalable authentication system for a multi-tenant SaaS application",
  "context": {
    "complexity": "high",
    "domain": "enterprise_software",
    "constraints": ["GDPR compliance", "OAuth2 support", "rate limiting"]
  },
  "mode": "cognitive"
}
```

**Response:**
```json
{
  "cognitive_analysis": {
    "intent": "Design secure, scalable auth system",
    "assumptions": ["Multi-tenant isolation required", "OAuth2 integration needed"],
    "constraints": ["GDPR compliance", "Performance requirements"],
    "challenges": ["Data isolation", "Token management", "Scalability"],
    "risks": ["Security vulnerabilities", "Performance bottlenecks"],
    "ethical_concerns": ["Data privacy", "User consent"],
    "plan": "Detailed implementation plan...",
    "resources": ["Auth0/Okta integration", "Redis for sessions", "PostgreSQL"],
    "synthesis": "Integrated approach combining...",
    "execution": ["Phase 1: Core auth", "Phase 2: Multi-tenancy", "Phase 3: OAuth"],
    "learnings": ["Consider JWKS rotation", "Implement rate limiting early"],
    "validation_score": 0.92,
    "final_report": "Comprehensive authentication system design...",
    "key_insights": ["Token rotation strategy", "Tenant isolation patterns"]
  },
  "metadata": {
    "timestamp": "2025-01-15T10:30:00Z",
    "reasoning_mode": "cognitive",
    "agent_count": 10
  }
}
```

#### POST `/api/v1/dspy/adaptive`
Adaptive orchestration with automatic complexity analysis.

**Request:**
```json
{
  "request": "What's the weather like today?",
  "preferred_mode": "auto"
}
```

**Response:**
```json
{
  "mode": "simple",
  "response": "I don't have access to real-time weather data...",
  "complexity": 0.2
}
```

#### POST `/api/v1/dspy/task-coordination`
Coordinate complex tasks across multiple specialized agents.

**Request:**
```json
{
  "task": "Migrate legacy monolith to microservices",
  "available_agents": [
    "architecture_agent",
    "database_agent", 
    "deployment_agent",
    "testing_agent"
  ]
}
```

**Response:**
```json
{
  "task_analysis": {
    "subtasks": "Service decomposition, Data migration, API design, Deployment pipeline",
    "dependencies": "Architecture -> Database -> API -> Deployment",
    "priority": "high"
  },
  "agent_assignments": [
    {
      "subtask": "Service decomposition",
      "agent": "architecture_agent",
      "confidence": 0.9
    }
  ],
  "coordination_plan": "Parallel execution plan with dependency management",
  "consensus": "Recommended phased migration approach",
  "confidence": 0.87
}
```

---

### 4. PyVision Integration with SDXL Refiner (`/api/v1/vision`)

#### POST `/api/v1/vision/analyze`
Analyze images using YOLO, CLIP, and other vision models.

**Request:**
```json
{
  "image": "base64_encoded_image_data",
  "analysis_type": "object_detection",
  "models": ["yolo-v8n", "clip-vit-b32"],
  "options": {
    "confidence_threshold": 0.7,
    "max_objects": 10
  }
}
```

**Response:**
```json
{
  "analysis": {
    "objects": [
      {
        "class": "person",
        "confidence": 0.92,
        "bbox": [100, 150, 200, 400],
        "attributes": ["standing", "outdoors"]
      }
    ],
    "scene": {
      "description": "Outdoor scene with people",
      "embedding": [0.1, 0.2, 0.15, 0.8, 0.3, 0.45, 0.6, 0.25],
      "confidence": 0.88
    }
  },
  "metadata": {
    "models_used": ["yolo-v8n", "clip-vit-b32"],
    "processing_time": 1200,
    "gpu_memory_used": "2.1GB"
  }
}
```

#### POST `/api/v1/vision/generate`
Generate images using Stable Diffusion with optional refinement.

**Request:**
```json
{
  "prompt": "A futuristic city with flying cars at sunset",
  "negative_prompt": "blurry, low quality",
  "model": "sd3b",
  "parameters": {
    "steps": 30,
    "guidance": 7.5,
    "width": 1024,
    "height": 1024,
    "auto_refine": true
  },
  "refinement": {
    "strength": 0.3,
    "steps": 15,
    "backend": "mlx"
  }
}
```

**Response:**
```json
{
  "generated_image": "base64_encoded_image",
  "refined_image": "base64_encoded_refined_image",
  "metadata": {
    "generation_time": 15000,
    "refinement_time": 8000,
    "model_used": "sd3b",
    "refiner_used": "sdxl-refiner",
    "backend": "mlx",
    "gpu_memory_peak": "8.5GB",
    "parameters_used": {
      "steps": 30,
      "guidance": 7.5,
      "width": 1024,
      "height": 1024,
      "seed": 42,
      "scheduler": "euler_ancestral"
    }
  }
}
```

#### POST `/api/v1/vision/refine`
Refine existing images using SDXL Refiner with MLX optimization.

**Request:**
```json
{
  "image": "base64_encoded_image_data",
  "parameters": {
    "strength": 0.4,
    "steps": 20,
    "guidance": 7.0,
    "denoising_end": 0.8,
    "backend": "auto"
  }
}
```

**Response:**
```json
{
  "refined_image": "base64_encoded_refined_image",
  "comparison": {
    "quality_improvement": 0.23,
    "detail_enhancement": 0.31,
    "noise_reduction": 0.18
  },
  "metadata": {
    "refinement_time": 8500,
    "backend_used": "mlx",
    "model_path": "/path/to/sdxl-refiner-q4_1.gguf",
    "memory_used": "2.5GB"
  }
}
```

#### GET `/api/v1/vision/models`
Get available vision models and their status.

**Response:**
```json
{
  "models": {
    "yolo-v8n": {
      "type": "analysis",
      "status": "loaded",
      "memory_usage": "0.006GB",
      "last_used": "2025-01-15T10:25:00Z"
    },
    "sdxl-refiner": {
      "type": "generation",
      "status": "available",
      "memory_usage": "0GB",
      "size": "2.5GB",
      "backend": "mlx"
    }
  },
  "gpu_status": {
    "total_vram": "24GB",
    "used_vram": "6.1GB",
    "available_vram": "17.9GB",
    "temperature": 52,
    "utilization": 85
  }
}
```

---

### 5. MLX Fine-Tuning Framework (`/api/v1/mlx`)

#### POST `/api/v1/mlx/fine-tune/start`
Start fine-tuning a model using MLX optimization.

**Request:**
```json
{
  "base_model": "lfm2-1.2b",
  "dataset": {
    "training_data": "s3://bucket/training.jsonl",
    "validation_data": "s3://bucket/validation.jsonl",
    "format": "chat"
  },
  "parameters": {
    "learning_rate": 1e-4,
    "batch_size": 8,
    "epochs": 3,
    "sequence_length": 2048,
    "lora_rank": 16,
    "lora_alpha": 32
  },
  "optimization": {
    "gradient_checkpointing": true,
    "mixed_precision": "bf16",
    "apple_silicon_optimized": true
  }
}
```

**Response:**
```json
{
  "job_id": "mlx_ft_20240115_103000",
  "status": "started",
  "estimated_duration": "2h 30m",
  "progress": {
    "current_epoch": 0,
    "steps_completed": 0,
    "total_steps": 1250
  },
  "resources": {
    "memory_allocated": "18GB",
    "gpu_utilization": 0,
    "estimated_completion": "2025-01-15T13:00:00Z"
  }
}
```

#### GET `/api/v1/mlx/fine-tune/{job_id}/status`
Get fine-tuning job status and progress.

**Response:**
```json
{
  "job_id": "mlx_ft_20240115_103000",
  "status": "training",
  "progress": {
    "current_epoch": 2,
    "steps_completed": 875,
    "total_steps": 1250,
    "completion_percentage": 70
  },
  "metrics": {
    "current_loss": 0.234,
    "best_loss": 0.198,
    "learning_rate": 8.5e-5,
    "gradient_norm": 0.12
  },
  "performance": {
    "steps_per_second": 2.3,
    "tokens_per_second": 4680,
    "memory_usage": "16.2GB",
    "estimated_completion": "2025-01-15T12:45:00Z"
  }
}
```

#### POST `/api/v1/mlx/fine-tune/{job_id}/stop`
Stop a running fine-tuning job.

**Response:**
```json
{
  "job_id": "mlx_ft_20240115_103000",
  "status": "stopped",
  "final_metrics": {
    "final_loss": 0.245,
    "epochs_completed": 1.8,
    "total_steps": 780
  },
  "model_checkpoint": "models/lfm2_fine_tuned_checkpoint_780.bin"
}
```

---

### 6. Intelligent Parameter Automation (`/api/v1/intelligent-params`)

#### POST `/api/v1/intelligent-params/optimize`
Automatically optimize parameters for AI tasks using ML-based learning.

**Request:**
```json
{
  "task_type": "text_generation",
  "objective": "maximize_quality",
  "constraints": {
    "max_tokens": 2000,
    "max_time": 5000,
    "quality_threshold": 0.8
  },
  "context": {
    "user_preference": "detailed_responses",
    "domain": "technical_writing",
    "urgency": "medium"
  }
}
```

**Response:**
```json
{
  "optimized_parameters": {
    "temperature": 0.72,
    "top_p": 0.91,
    "top_k": 45,
    "repetition_penalty": 1.05,
    "max_tokens": 1800
  },
  "prediction": {
    "expected_quality": 0.87,
    "expected_time": 3200,
    "confidence": 0.84
  },
  "reasoning": {
    "temperature_choice": "Balanced for technical content",
    "token_limit_choice": "Optimized for quality vs speed",
    "model_confidence": "High confidence based on similar tasks"
  },
  "alternatives": [
    {
      "profile": "speed_optimized",
      "parameters": {
        "temperature": 0.85,
        "top_p": 0.95,
        "top_k": 40,
        "repetition_penalty": 1.0,
        "max_tokens": 1200
      },
      "tradeoffs": "20% faster, 5% lower quality"
    }
  ]
}
```

#### POST `/api/v1/intelligent-params/learn`
Update parameter learning models with execution results.

**Request:**
```json
{
  "task_id": "task_123",
  "parameters_used": {
    "temperature": 0.72,
    "top_p": 0.91,
    "max_tokens": 1800
  },
  "results": {
    "quality_score": 0.89,
    "execution_time": 2980,
    "user_satisfaction": 0.92,
    "token_efficiency": 0.78
  },
  "context": {
    "task_type": "text_generation",
    "domain": "technical_writing"
  }
}
```

**Response:**
```json
{
  "learning_updated": true,
  "model_improvements": {
    "accuracy_gain": 0.03,
    "samples_added": 1,
    "total_samples": 247
  },
  "insights": [
    "Temperature 0.72 consistently performs well for technical content",
    "Token efficiency correlates with user satisfaction"
  ]
}
```

#### GET `/api/v1/intelligent-params/profiles`
Get available parameter optimization profiles.

**Response:**
```json
{
  "profiles": {
    "quality_optimized": {
      "description": "Maximizes output quality",
      "typical_use": "Research, analysis, creative writing",
      "speed_multiplier": 0.8,
      "quality_multiplier": 1.2
    },
    "speed_optimized": {
      "description": "Minimizes response time",
      "typical_use": "Quick answers, real-time chat",
      "speed_multiplier": 1.5,
      "quality_multiplier": 0.9
    },
    "balanced": {
      "description": "Balances quality and speed",
      "typical_use": "General purpose tasks",
      "speed_multiplier": 1.0,
      "quality_multiplier": 1.0
    }
  }
}
```

---

### 7. Agent Performance Monitoring (`/api/v1/agents`)

#### GET `/api/v1/agents/performance`
Get performance metrics for all agents.

**Response:**
```json
{
  "agents": {
    "enhanced_code_assistant": {
      "performance": {
        "successRate": 0.89,
        "confidenceInterval": [0.84, 0.94],
        "executionCount": 145,
        "averageReward": 0.82,
        "recentTrend": "improving",
        "spawnCount": 2
      },
      "recent_executions": [
        {
          "timestamp": "2025-01-15T10:25:00Z",
          "success": true,
          "confidence": 0.91,
          "execution_time": 2300
        }
      ]
    }
  },
  "system_metrics": {
    "total_executions": 1247,
    "average_success_rate": 0.87,
    "active_agents": 12,
    "spawned_variants": 8
  }
}
```

#### POST `/api/v1/agents/{agent_name}/feedback`
Provide feedback for agent performance learning.

**Request:**
```json
{
  "execution_id": "exec_123",
  "feedback": {
    "quality_rating": 0.9,
    "speed_rating": 0.8,
    "usefulness": 0.95,
    "accuracy": 0.88
  },
  "context": {
    "task_complexity": "medium",
    "user_expertise": "expert"
  }
}
```

#### GET `/api/v1/agents/{agent_name}/variants`
Get spawned variants for a specific agent.

**Response:**
```json
{
  "base_agent": "enhanced_code_assistant",
  "variants": [
    {
      "id": "enhanced_code_assistant_v2",
      "spawn_reason": "poor_performance_in_debugging",
      "modifications": ["increased_temperature", "extended_context"],
      "performance": {
        "successRate": 0.92,
        "sample_size": 23
      },
      "status": "active"
    }
  ]
}
```

---

### 8. Memory & Knowledge Management (`/api/v1/memory`)

#### POST `/api/v1/memory/store`
Store information in the vector memory system.

**Headers Required:**
- `X-API-Key`: Your API key
- `X-AI-Service`: Your service name
- `Content-Type`: application/json

**Request:**
```json
{
  "content": "React hooks best practices for state management",
  "metadata": {
    "type": "knowledge",
    "category": "react",
    "source": "expert_advice",
    "tags": ["hooks", "state", "react", "frontend"]
  },
  "embedding_model": "clip-vit-b32"
}
```

**Response:**
```json
{
  "id": "mem_123456",
  "status": "stored",
  "embedding_generated": true,
  "vector_dimensions": 512,
  "storage_location": "primary",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### POST `/api/v1/memory/search`
Search the memory system using semantic similarity.

**Headers Required:**
- `X-API-Key`: Your API key
- `X-AI-Service`: Your service name
- `Content-Type`: application/json

**Request:**
```json
{
  "query": "How to optimize React component performance?",
  "limit": 10,
  "filters": {
    "category": "react",
    "min_relevance": 0.7
  },
  "include_embeddings": false
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "React hooks best practices for state management",
      "relevance": 0.89,
      "metadata": {
        "type": "knowledge",
        "category": "react",
        "timestamp": "2025-01-15T09:30:00Z"
      },
      "id": "mem_123456"
    }
  ],
  "total_found": 15,
  "search_time": 45,
  "search_method": "semantic_similarity",
  "model_used": "clip-vit-b32"
}
```

---

## 9. WebSocket Real-Time API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:9999/ws');
// Note: Same server as HTTP API, WebSocket endpoint on /ws path
```

### Events

#### Agent Execution Progress
```json
{
  "type": "agent_progress",
  "data": {
    "agent_name": "enhanced_code_assistant",
    "execution_id": "exec_123",
    "progress": 0.65,
    "stage": "processing_response",
    "estimated_completion": 2000
  }
}
```

#### MCTS Tree Updates
```json
{
  "type": "mcts_update",
  "data": {
    "session_id": "mcts_session_123",
    "new_nodes": 3,
    "best_path_changed": true,
    "exploration_progress": 0.78
  }
}
```

#### Model Loading Status
```json
{
  "type": "model_status",
  "data": {
    "model": "sdxl-refiner",
    "status": "loading",
    "progress": 0.45,
    "memory_usage": "1.2GB"
  }
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "temperature",
      "reason": "Must be between 0 and 1"
    },
    "request_id": "req_123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Error Codes
- `VALIDATION_ERROR`: Invalid request parameters
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `MODEL_ERROR`: AI model execution failed
- `RESOURCE_ERROR`: Insufficient resources (GPU memory, etc.)
- `TIMEOUT_ERROR`: Request exceeded time limit
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `INTERNAL_ERROR`: Internal server error

### Service-Specific Error Examples

#### Fast Coordinator Error
```json
{
  "error": {
    "code": "MODEL_ERROR",
    "message": "LFM2 model failed to load",
    "details": {
      "model": "lfm2-1.2b",
      "reason": "Insufficient memory",
      "available_memory": "1.2GB",
      "required_memory": "1.5GB"
    },
    "request_id": "req_fc_789",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

#### Vision Processing Error
```json
{
  "error": {
    "code": "RESOURCE_ERROR",
    "message": "GPU memory exhausted",
    "details": {
      "current_usage": "23.5GB",
      "max_available": "24GB",
      "requested_model": "sdxl-refiner",
      "model_requirements": "2.5GB"
    },
    "request_id": "req_vision_456",
    "timestamp": "2025-01-15T10:31:00Z"
  }
}
```

#### AB-MCTS Error
```json
{
  "error": {
    "code": "TIMEOUT_ERROR",
    "message": "MCTS exploration exceeded time limit",
    "details": {
      "timeout_ms": 30000,
      "nodes_explored": 156,
      "partial_result_available": true,
      "best_path_so_far": "path_optimizer_agent_v1"
    },
    "request_id": "req_mcts_234",
    "timestamp": "2025-01-15T10:32:00Z"
  }
}
```

---

## Rate Limits

| Endpoint Category | Limit | Window | Headers |
|-------------------|-------|---------|---------|
| Fast Coordinator | 100 requests | 1 minute | X-RateLimit headers included |
| Vision Processing | 20 requests | 5 minutes | X-RateLimit headers included |
| Vision Refinement | 8 requests | 3 minutes | X-RateLimit headers included |
| Fine-tuning | 5 jobs | 1 hour | X-RateLimit headers included |
| DSPy Cognitive | 50 requests | 10 minutes | X-RateLimit headers included |
| Memory Operations | 200 requests | 1 minute | X-RateLimit headers included |
| AB-MCTS Execution | 30 requests | 5 minutes | X-RateLimit headers included |
| Parameter Optimization | 60 requests | 10 minutes | X-RateLimit headers included |
| Agent Performance | 100 requests | 5 minutes | X-RateLimit headers included |
| WebSocket Connections | 10 concurrent | Per IP | Connection limit enforced |

---

## API Versioning Strategy

### Version Structure
- **Current Version**: v2.0.0
- **Legacy Support**: v1.0.0 endpoints maintained for backwards compatibility
- **Version Format**: `/api/v{major}/endpoint`

### Version Differences

#### v2.0.0 (Current)
- Advanced service endpoints (Fast Coordinator, AB-MCTS, MLX, etc.)
- Enhanced authentication with JWT support
- Real-time WebSocket API
- Comprehensive error responses with request IDs
- Advanced rate limiting with headers

#### v1.0.0 (Legacy)
- Basic CRUD operations
- API key authentication only
- Standard REST endpoints
- Simple error responses
- Basic rate limiting

### Migration Guide
1. Update base URL to include version: `/api/v2/`
2. Add JWT support alongside API keys
3. Update error handling for new error response format
4. Implement WebSocket connections for real-time updates
5. Update SDK to handle new response structures

### Deprecation Policy
- v1.0.0 endpoints will be maintained for 12 months
- Deprecation warnings added to response headers 6 months before removal
- Migration tools and guides provided
- Email notifications to registered API users

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { UniversalAIClient } from 'universal-ai-tools-sdk';

const client = new UniversalAIClient({
  baseUrl: 'http://localhost:9999',
  apiKey: 'your-api-key'
});

// Fast coordinated execution
const result = await client.fastCoordinator.execute({
  userRequest: 'Generate a React component',
  context: {
    taskType: 'code_generation',
    complexity: 'medium'
  }
});

// Vision processing with refinement
const refined = await client.vision.refine(imageBuffer, {
  strength: 0.3,
  backend: 'mlx'
});
```

### Python
```python
from universal_ai_tools import UniversalAIClient

client = UniversalAIClient(
    base_url="http://localhost:9999",
    api_key="your-api-key"
)

# MLX fine-tuning
job = client.mlx.start_fine_tune(
    base_model="lfm2-1.2b",
    dataset={"training_data": "data.jsonl"},
    parameters={"learning_rate": 1e-4}
)

# AB-MCTS execution
result = client.ab_mcts.execute(
    task="Optimize database queries",
    options={"exploration_rate": 0.1}
)
```

---

## CORS Headers

All API responses include the following CORS headers:

```http
Access-Control-Allow-Origin: * (configurable per environment)
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-AI-Service, X-CSRF-Token
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true (when using JWT auth)
```

For production environments, configure specific allowed origins:
```javascript
// Example configuration
{
  allowedOrigins: [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    'http://localhost:3000' // Development only
  ]
}
```

---

## Response Headers

All API responses include standard headers:

```http
Content-Type: application/json; charset=utf-8
X-Request-ID: unique-request-identifier
X-Response-Time: processing-time-in-ms
X-API-Version: 2.0.0
X-RateLimit-Limit: rate-limit-maximum
X-RateLimit-Remaining: requests-remaining
X-RateLimit-Reset: reset-timestamp
Cache-Control: no-cache, no-store, must-revalidate
```

---

## Performance Benchmarks

| Service | Average Response Time | Throughput | GPU Memory |
|---------|----------------------|------------|------------|
| Fast Coordinator | 45ms | 2000 req/min | 0.1GB |
| DSPy Cognitive | 3.2s | 100 req/min | 2GB |
| Vision Analysis | 1.2s | 150 req/min | 4GB |
| Vision Generation | 15s | 20 req/min | 8GB |
| MLX Fine-tuning | 2h per epoch | 1 job/GPU | 16GB |

---

## Legacy API Endpoints (v1.0 - Backwards Compatibility)

### 🏥 Health & Status Endpoints

### Basic Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "Universal AI Tools Service",
  "timestamp": "2025-07-20T03:12:01.830Z",
  "metadata": {
    "apiVersion": "v1",
    "timestamp": "2025-07-20T03:12:01.831Z"
  }
}
```

### Detailed Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-07-20T03:12:01.841Z",
  "uptime": 311.0060125,
  "memory": {
    "rss": 158908416,
    "heapTotal": 36438016,
    "heapUsed": 33574952,
    "external": 4711225,
    "arrayBuffers": 164447
  },
  "metrics_enabled": true,
  "prometheus_registry": "active",
  "metadata": {
    "apiVersion": "v1",
    "timestamp": "2025-07-20T03:12:01.841Z"
  }
}
```

### Authenticated Health Check

```http
GET /api/v1/health
Headers: X-API-Key, X-AI-Service
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 311.015576125,
    "services": {
      "database": {
        "status": "healthy",
        "responseTime": 16,
        "lastCheck": "2025-07-20T03:12:01.867Z"
      },
      "memory": {
        "status": "unhealthy",
        "responseTime": 0,
        "lastCheck": "2025-07-20T03:12:01.867Z",
        "error": "Memory usage at 91.4%"
      },
      "api": {
        "status": "healthy",
        "responseTime": 16,
        "lastCheck": "2025-07-20T03:12:01.867Z"
      }
    },
    "metrics": {
      "memoryUsage": 91,
      "cpuUsage": 0,
      "activeConnections": 0,
      "requestsPerMinute": 0
    }
  },
  "meta": {
    "requestId": "27e52b25-62ba-42f3-aa31-cfd0a6b06053",
    "timestamp": "2025-07-20T03:12:01.851Z",
    "processingTime": 16,
    "version": "1.0.0"
  }
}
```

---

## 🧠 Memory Management API

### List Memories

```http
GET /api/v1/memory
Headers: X-API-Key, X-AI-Service
```

**Query Parameters:**

- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10): Items per page
- `type` (string): Filter by memory type
- `tags` (string): Comma-separated tags filter

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "a9fe01f9-cdf7-483c-a4e2-15313a4e219b",
      "type": "semantic",
      "content": "Database validation memory",
      "metadata": {
        "test": "comprehensive",
        "validation": true
      },
      "tags": [],
      "importance": 0.5,
      "timestamp": "2025-07-20T02:52:41.836435+00:00"
    }
  ],
  "meta": {
    "requestId": "3d60a582-7aaf-497f-a16d-d40352295527",
    "timestamp": "2025-07-20T03:12:16.845Z",
    "processingTime": 6,
    "version": "1.0.0",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### Create Memory

```http
POST /api/v1/memory
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "This is a new memory entry",
  "metadata": {
    "source": "api",
    "importance": "high"
  },
  "tags": ["test", "api"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "new-memory-id",
    "content": "This is a new memory entry",
    "metadata": {
      "source": "api",
      "importance": "high"
    },
    "tags": ["test", "api"],
    "timestamp": "2025-07-20T03:12:16.845Z"
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2025-07-20T03:12:16.845Z",
    "processingTime": 15,
    "version": "1.0.0"
  }
}
```

### Get Memory by ID

```http
GET /api/v1/memory/{id}
Headers: X-API-Key, X-AI-Service
```

### Update Memory

```http
PUT /api/v1/memory/{id}
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

### Delete Memory

```http
DELETE /api/v1/memory/{id}
Headers: X-API-Key, X-AI-Service
```

---

## 🛠️ Tools Management API

### List Available Tools

```http
GET /api/v1/tools
Headers: X-API-Key, X-AI-Service
```

**Response:**

```json
{
  "tools": [
    {
      "id": "tool-id",
      "tool_name": "example_tool",
      "description": "Example tool description",
      "input_schema": {
        "type": "object",
        "properties": {
          "param1": { "type": "string" },
          "param2": { "type": "number" }
        }
      },
      "output_schema": {
        "type": "object",
        "properties": {
          "result": { "type": "string" }
        }
      },
      "rate_limit": 100
    }
  ],
  "metadata": {
    "apiVersion": "v1",
    "timestamp": "2025-07-20T03:12:16.864Z"
  }
}
```

### Execute Tool

```http
POST /api/v1/tools/execute
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "tool_name": "example_tool",
  "parameters": {
    "param1": "value1",
    "param2": 42
  }
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "output": "Tool execution result"
  },
  "execution_time_ms": 150
}
```

### Create Custom Tool

```http
POST /api/v1/tools
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "tool_name": "my_custom_tool",
  "description": "Custom tool description",
  "input_schema": {
    "type": "object",
    "properties": {
      "input": { "type": "string" }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "output": { "type": "string" }
    }
  },
  "implementation_type": "function",
  "implementation": "function(parameters, supabase) { return { output: parameters.input.toUpperCase() }; }",
  "rate_limit": 50
}
```

### Execute Built-in Tools

```http
POST /api/v1/tools/execute/builtin/{toolName}
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Available Built-in Tools:**

- `store_context`: Store contextual information
- `retrieve_context`: Retrieve stored context
- `search_knowledge`: Search knowledge base
- `communicate`: Inter-service communication
- `analyze_project`: Project analysis

---

## 🎭 Agent Orchestration API

### List Agents

```http
GET /api/v1/orchestration/agents
Headers: X-API-Key, X-AI-Service
```

### Coordinate Agents

```http
POST /api/v1/orchestration/coordinate
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "task": "Analyze user behavior data",
  "available_agents": ["analyzer", "data_processor", "reporter"],
  "context": {
    "dataset_id": "user_data_2025",
    "time_range": "last_30_days"
  }
}
```

### Execute Orchestration

```http
POST /api/v1/orchestration/execute
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "request_id": "unique-request-id",
  "user_request": "Generate a comprehensive report on user engagement",
  "orchestration_mode": "cognitive",
  "context": {
    "priority": "high",
    "deadline": "2025-07-25"
  }
}
```

---

## 🔍 Knowledge Management API

### Search Knowledge

```http
POST /api/v1/orchestration/knowledge/search
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "machine learning best practices",
  "limit": 10,
  "knowledge_type": "documentation"
}
```

### Extract Knowledge

```http
POST /api/v1/orchestration/knowledge/extract
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "Long text content to extract knowledge from...",
  "context": {
    "source": "research_paper",
    "domain": "artificial_intelligence"
  }
}
```

### Evolve Knowledge

```http
POST /api/v1/orchestration/knowledge/evolve
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "existing_knowledge": "Current understanding of the topic...",
  "new_information": "New research findings that update our understanding..."
}
```

---

## 📊 GraphQL API

### Endpoint

```http
POST /graphql
Headers: Content-Type: application/json, X-CSRF-Token: <csrf-token>
```

**Note**: GraphQL endpoints require CSRF protection. Obtain CSRF token from authenticated endpoints.

### Example Query

```graphql
query {
  memoriesCollection {
    edges {
      node {
        id
        content
        metadata
        timestamp
      }
    }
  }
}
```

### Example Mutation

```graphql
mutation CreateMemory($content: String!, $metadata: JSON) {
  insertIntoMemoriesCollection(objects: [{ content: $content, metadata: $metadata }]) {
    records {
      id
      content
      timestamp
    }
  }
}
```

### Available Collections

- `memoriesCollection`: Memory management
- `ai_agentsCollection`: Agent registry
- `agent_toolsCollection`: Tool definitions
- `knowledge_entitiesCollection`: Knowledge graph
- `agent_sessionsCollection`: Session tracking

---

## 📈 Metrics & Monitoring API

### Prometheus Metrics

```http
GET /metrics
```

**Response**: Prometheus format metrics

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/health",status_code="200",ai_service="unknown"} 6

# HELP http_request_duration_seconds Request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/health",le="0.005"} 5
```

### Security Status

```http
GET /api/security/status
Headers: X-API-Key, X-AI-Service
```

**Response:**

```json
{
  "score": 95,
  "vulnerabilities": 0,
  "criticalIssues": 0,
  "expiredKeys": 0,
  "timestamp": "2025-07-20T03:12:01.867Z"
}
```

---

## 🔊 Context & Communication API

### Store Context

```http
POST /api/v1/context
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "context_type": "conversation",
  "context_key": "session_123",
  "content": "User is asking about AI capabilities",
  "metadata": {
    "user_id": "user_456",
    "timestamp": "2025-07-20T03:12:01.867Z"
  }
}
```

### Retrieve Context

```http
GET /api/v1/context/{context_type}/{context_key}
Headers: X-API-Key, X-AI-Service
```

---

## 📝 Speech & Audio API

### Text-to-Speech

```http
POST /api/v1/speech/synthesize
Headers: X-API-Key, X-AI-Service, Content-Type: application/json
```

**Request Body:**

```json
{
  "text": "Hello, this is a test of the speech synthesis system",
  "voice": "neural",
  "speed": 1.0,
  "pitch": 1.0
}
```

### Speech-to-Text

```http
POST /api/v1/speech/transcribe
Headers: X-API-Key, X-AI-Service, Content-Type: multipart/form-data
```

**Form Data:**

- `audio`: Audio file (WAV, MP3, OGG)
- `language`: Language code (default: "en")

---

## ❌ Error Responses

### Standard Error Format

```json
{
  "error": "Error type",
  "message": "Human readable error message",
  "code": 400,
  "timestamp": "2025-07-20T03:12:01.867Z",
  "requestId": "request-id-here"
}
```

### Common Error Codes

- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing/invalid API key
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server issue

### CORS Errors

```json
{
  "error": "Not allowed by CORS",
  "message": "Origin not in allowed list",
  "allowedOrigins": ["https://yourdomain.com"]
}
```

---

## 🔧 Rate Limiting

### Default Limits

- **Standard endpoints**: 1000 requests/hour
- **Heavy operations**: 100 requests/hour
- **Authenticated users**: Higher limits based on service tier

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

---

## 📚 SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:9999/api/v1',
  headers: {
    'X-API-Key': 'your-api-key',
    'X-AI-Service': 'your-service-name',
    'Content-Type': 'application/json',
  },
});

// Create memory
const memory = await client.post('/memory', {
  content: 'Important information to remember',
  metadata: { priority: 'high' },
  tags: ['important'],
});

// Execute tool
const result = await client.post('/tools/execute', {
  tool_name: 'data_analyzer',
  parameters: { dataset: 'user_behavior' },
});
```

### Python

```python
import requests

class UniversalAIClient:
    def __init__(self, base_url, api_key, service_name):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'X-AI-Service': service_name,
            'Content-Type': 'application/json'
        }

    def create_memory(self, content, metadata=None, tags=None):
        response = requests.post(
            f'{self.base_url}/api/v1/memory',
            headers=self.headers,
            json={
                'content': content,
                'metadata': metadata or {},
                'tags': tags or []
            }
        )
        return response.json()

# Usage
client = UniversalAIClient(
    'http://localhost:9999',
    'your-api-key',
    'your-service-name'
)

memory = client.create_memory(
    'User prefers dark mode interface',
    metadata={'user_id': '123', 'preference': 'ui'},
    tags=['user-preference', 'ui']
)
```

### cURL Examples

```bash
# Health check
curl http://localhost:9999/health

# Create memory
curl -X POST http://localhost:9999/api/v1/memory \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: your-service" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test memory", "tags": ["test"]}'

# Execute tool
curl -X POST http://localhost:9999/api/v1/tools/execute \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: your-service" \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "example_tool", "parameters": {"input": "test"}}'
```

---

## 🛡️ Security Best Practices

### API Key Management

- Generate unique API keys per service/environment
- Rotate keys regularly (monthly recommended)
- Use environment variables, never hardcode keys
- Monitor usage for anomalies

### Request Security

- Always use HTTPS in production
- Validate all input data
- Implement request signing for sensitive operations
- Use rate limiting to prevent abuse

### Data Protection

- Encrypt sensitive data in transit and at rest
- Implement proper access controls
- Log security events for auditing
- Regular security assessments

---

This comprehensive API documentation covers the sophisticated service-oriented architecture of Universal AI Tools, highlighting the advanced capabilities that distinguish it from simpler agent-based systems. Each service is designed for production use with proper error handling, monitoring, and optimization.

**API Version**: v2.0.0  
**Last Updated**: July 26, 2025  
**Status**: Production Ready  
**Support**: Enterprise grade with comprehensive documentation
