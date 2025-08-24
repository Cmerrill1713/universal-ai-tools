# TypeScript Error Fixes

Generated: 2025-07-18T06:20:53.577Z

## Summary

- Total error types: 22
- Total errors: 519

## TS1240 (250 occurrences)

**Error**: Unable to resolve signature of property decorator when called as an expression.

**Affected files**:

- src/models/pydantic_models.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS1240.

## TS2345 (80 occurrences)

**Error**: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.

**Affected files**:

- src/agents/cognitive/retriever_agent.ts
- src/agents/enhanced_memory_agent.ts
- src/agents/personal/enhanced_personal_assistant_agent.ts
- src/enhanced/enhanced_orchestrator.ts
- src/services/hybrid_inference_router.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2345.

## TS2339 (71 occurrences)

**Error**: Property 'metadata' does not exist on type 'AgentContext'.

**Affected files**:

- src/agents/cognitive/ethics_agent.ts
- src/agents/cognitive/reflector_agent.ts
- src/agents/cognitive/resource_manager_agent.ts
- src/agents/cognitive/retriever_agent.ts
- src/agents/cognitive/synthesizer_agent.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2339.

## TS7053 (24 occurrences)

**Error**: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{ planner: string; retriever: string; devils_advocate: string; synthesizer: string; reflector: string; user_intent: string; tool_maker: string; ethics: string; resource_manager: string; orchestrator: string; }'.

**Affected files**:

- src/agents/cognitive/mock_cognitive_agent.ts
- src/agents/cognitive/reflector_agent.ts
- src/enhanced/adaptive_tool_integration.ts
- src/enhanced/enhanced_orchestrator.ts
- src/services/ollama-assistant.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS7053.

## TS2322 (24 occurrences)

**Error**: Type 'string[]' is not assignable to type 'string'.

**Affected files**:

- src/agents/cognitive/resource_manager_agent.ts
- src/agents/cognitive/retriever_agent.ts
- src/agents/cognitive/synthesizer_agent.ts
- src/memory/enhanced_memory_system.ts
- src/services/framework_pattern_extractor.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2322.

## TS7006 (14 occurrences)

**Error**: Parameter 'd' implicitly has an 'any' type.

**Affected files**:

- src/agents/cognitive/ethics_agent.ts
- src/agents/cognitive/reflector_agent.ts
- src/agents/cognitive/synthesizer_agent.ts
- src/memory/enhanced_memory_system.ts
- src/services/ollama-assistant.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS7006.

## TS2551 (8 occurrences)

**Error**: Property 'addLearningInsight' does not exist on type 'EthicsAgent'. Did you mean 'learningInsights'?

**Affected files**:

- src/agents/cognitive/ethics_agent.ts
- src/agents/cognitive/reflector_agent.ts
- src/tests/unit/services/model_lifecycle_manager.test.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2551.

## TS2739 (7 occurrences)

**Error**: Type '{ success: true; data: Plan; confidence: number; message: string; reasoning: string; metadata: { planningTime: number; memoryUtilization: any; domainExpertise: number; patternsUsed: string[]; }; }' is missing the following properties from type 'AgentResponse<any>': latencyMs, agentId

**Affected files**:

- src/agents/cognitive/enhanced_planner_agent.ts
- src/agents/cognitive/ethics_agent.ts
- src/agents/cognitive/reflector_agent.ts
- src/agents/cognitive/synthesizer_agent.ts
- src/agents/enhanced_orchestrator.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2739.

## TS2554 (7 occurrences)

**Error**: Expected 1 arguments, but got 3.

**Affected files**:

- src/agents/enhanced_base_agent.ts
- src/tests/unit/services/anti_hallucination_service.test.ts
- src/tests/unit/services/model_lifecycle_manager.test.ts
- src/tools/pydantic_tools.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2554.

## TS2353 (7 occurrences)

**Error**: Object literal may only specify known properties, and 'id' does not exist in type 'ResourceManagerConfig'.

**Affected files**:

- src/tests/unit/agents/resource_manager_agent.test.ts
- src/tests/unit/agents/retriever_agent.test.ts
- src/tools/pydantic_tools.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2353.

## TS18046 (6 occurrences)

**Error**: 'error' is of type 'unknown'.

**Affected files**:

- src/agents/cognitive/mock_cognitive_agent.ts
- src/agents/cognitive_orchestrator.ts
- src/agents/enhanced_memory_agent.ts
- src/agents/enhanced_orchestrator.ts
- src/enhanced/mlx_integration.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS18046.

## TS18048 (5 occurrences)

**Error**: 'query.constraints.minRelevance' is possibly 'undefined'.

**Affected files**:

- src/agents/cognitive/retriever_agent.ts
- src/memory/access_pattern_learner.ts
- src/services/mlx_fine_tuning_service.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS18048.

## TS2654 (3 occurrences)

**Error**: Non-abstract class 'ResourceManagerAgent' is missing implementations for the following members of 'EnhancedMemoryAgent': 'executeWithMemory', 'onInitialize', 'process', 'onShutdown'.

**Affected files**:

- src/agents/cognitive/resource_manager_agent.ts
- src/agents/cognitive/retriever_agent.ts
- src/agents/personal/enhanced_personal_assistant_agent.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2654.

## TS2416 (2 occurrences)

**Error**: Property 'metrics' in type 'ResourceManagerAgent' is not assignable to the same property in base type 'EnhancedMemoryAgent'.

**Affected files**:

- src/agents/cognitive/resource_manager_agent.ts
- src/agents/cognitive/retriever_agent.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2416.

## TS7034 (2 occurrences)

**Error**: Variable 'processed' implicitly has type 'any[]' in some locations where its type cannot be determined.

**Affected files**:

- src/agents/cognitive/resource_manager_agent.ts
- src/agents/cognitive/synthesizer_agent.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS7034.

## TS7005 (2 occurrences)

**Error**: Variable 'processed' implicitly has an 'any[]' type.

**Affected files**:

- src/agents/cognitive/resource_manager_agent.ts
- src/agents/cognitive/synthesizer_agent.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS7005.

## TS2783 (2 occurrences)

**Error**: 'model' is specified more than once, so this usage will be overwritten.

**Affected files**:

- src/memory/enhanced_memory_system.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2783.

## TS2367 (1 occurrences)

**Error**: This comparison appears to be unintentional because the types '"error" | "performance" | "pattern" | "optimization"' and '"ethics_improvement"' have no overlap.

**Affected files**:

- src/agents/cognitive/ethics_agent.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2367.

## TS2741 (1 occurrences)

**Error**: Property 'timeOfDay' is missing in type '{ sessionLength: number; taskType: string | undefined; urgency: "medium" | "low" | "high" | "critical" | undefined; }' but required in type '{ timeOfDay: number; sessionLength: number; taskType?: string | undefined; urgency?: "medium" | "low" | "high" | "critical" | undefined; }'.

**Affected files**:

- src/memory/enhanced_memory_system.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2741.

## TS2304 (1 occurrences)

**Error**: Cannot find name 'FrameworkDetector'.

**Affected files**:

- src/services/framework_pattern_extractor.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2304.

## TS2362 (1 occurrences)

**Error**: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.

**Affected files**:

- src/tests/unit/services/model_lifecycle_manager.test.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2362.

## TS2363 (1 occurrences)

**Error**: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.

**Affected files**:

- src/tests/unit/services/model_lifecycle_manager.test.ts

### Manual Fix Required

No automated fixes found. Review TypeScript documentation for TS2363.
