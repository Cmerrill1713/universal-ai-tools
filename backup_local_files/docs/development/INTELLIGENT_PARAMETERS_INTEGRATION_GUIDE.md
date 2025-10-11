# Intelligent Parameters Integration Guide
## Overview
The Intelligent Parameter System automatically optimizes LLM parameters based on task type, model capabilities, and performance metrics. This guide shows how to leverage this system throughout your codebase.
## Current Implementation Status
### ✅ Components Available
1. **Intelligent Parameter Service** (`src/services/intelligent-parameter-service.ts`)

   - Task type detection and classification

   - Parameter optimization based on task complexity

   - Model-specific parameter adjustments

   - User preference integration
2. **Intelligent Parameter Middleware** (`src/middleware/intelligent-parameters.ts`)

   - Automatic parameter injection for HTTP requests

   - Task-specific middleware variants (chat, code, analysis, creative, vision)

   - Parameter effectiveness logging

   - Manual optimization utility function
3. **Enhanced LLM Router** (`src/services/llm-router-service-enhanced.ts`)

   - Automatic task type detection from prompts

   - Performance-based model selection

   - Parameter performance tracking

   - Adaptive fallback strategies
## Integration Opportunities
### 1. Chat Router Enhancement
The chat router (`src/routers/chat.ts`) currently doesn't use intelligent parameters. Add middleware:
```typescript

import { chatParametersMiddleware } from '@/middleware/intelligent-parameters';
// Apply to chat endpoint

router.post(

  '/',

  chatParametersMiddleware(), // Add this

  authenticate,

  validateRequest,

  async (req, res) => {

    // Optimized parameters are now in req.body

    const { temperature, maxTokens, systemPrompt } = req.body;

    // ... rest of handler

  }

);

```
### 2. Context Storage Service Integration
Enhance context storage to save parameter performance:
```typescript

// In context-storage-service.ts

async storeContextWithParameters(context: any, parameters: OptimizedParameters) {

  return this.storeContext({

    content: context,

    category: 'llm_interaction',

    metadata: {

      parameters,

      taskType: parameters.taskType,

      model: context.model,

      performance: {

        latency: context.latency,

        tokens: context.tokens

      }

    }

  });

}

```
### 3. Agent System Integration
All agents should use intelligent parameters:
```typescript

// In base-agent.ts or enhanced-base-agent.ts

import { optimizeParameters } from '@/middleware/intelligent-parameters';

import { TaskType } from '@/services/intelligent-parameter-service';
async generateResponse(prompt: string) {

  // Auto-optimize parameters

  const optimized = optimizeParameters(prompt, {

    taskType: this.getTaskType(),

    model: this.model,

    domain: this.domain

  });

  

  // Use optimized parameters

  return this.llmService.generate({

    prompt,

    ...optimized

  });

}

```
## Task Type Mapping
### Automatic Detection Patterns
The system detects task types from keywords:
| Task Type | Detection Keywords | Optimal Temperature | Max Tokens |

|-----------|-------------------|-------------------|------------|

| CODE_GENERATION | code, function, class, import, npm, git | 0.2 | 3000 |

| DATA_ANALYSIS | analyze, data, statistics, metrics | 0.3 | 2500 |

| CREATIVE_WRITING | story, poem, creative, narrative | 0.8 | 4000 |

| TECHNICAL_WRITING | documentation, technical, requirements | 0.4 | 3000 |

| IMAGE_ANALYSIS | image, picture, visual, photo | 0.4 | 2000 |

| CASUAL_CHAT | General conversation | 0.7 | 2000 |

| REASONING | why, explain, solve, calculate | 0.5 | 3000 |

| SUMMARIZATION | summarize, brief, overview, tldr | 0.3 | 1500 |

| TRANSLATION | translate, language, french, spanish | 0.2 | 2000 |
## Usage Examples
### 1. Direct Service Usage
```typescript

import { intelligentParameterService, TaskType } from '@/services/intelligent-parameter-service';
// Create task context

const context = intelligentParameterService.createTaskContext(

  userInput,

  TaskType.CODE_GENERATION,

  { language: 'typescript', framework: 'express' },

  { preferredTemperature: 0.3 }

);
// Get optimized parameters

const params = intelligentParameterService.getTaskParameters(context);
// Apply model-specific optimizations

const finalParams = intelligentParameterService.getModelOptimizedParameters(

  params,

  'gpt-4'

);

```
### 2. Middleware Usage in Routers
```typescript

import { 

  codeParametersMiddleware,

  analysisParametersMiddleware,

  creativeParametersMiddleware 

} from '@/middleware/intelligent-parameters';
// Code generation endpoint

router.post('/generate-code', 

  codeParametersMiddleware(),

  async (req, res) => {

    // Parameters are automatically optimized

    const result = await llmService.generate(req.body);

    res.json(result);

  }

);
// Data analysis endpoint

router.post('/analyze', 

  analysisParametersMiddleware(),

  async (req, res) => {

    // Temperature and tokens optimized for analysis

    const analysis = await analyzeData(req.body);

    res.json(analysis);

  }

);

```
### 3. Enhanced LLM Router Usage
```typescript

import { enhancedLLMRouter } from '@/services/llm-router-service-enhanced';
// Automatic parameter optimization

const response = await enhancedLLMRouter.route({

  prompt: "Write a function to calculate fibonacci numbers",

  autoOptimize: true, // Default

  userPreferences: {

    preferredTemperature: 0.3,

    writingStyle: 'concise'

  }

});
// Access optimized parameters used

console.log('Task detected:', response.taskContext?.type); // CODE_GENERATION

console.log('Temperature used:', response.optimizedParameters?.temperature); // 0.2

```
### 4. Manual Optimization
```typescript

import { optimizeParameters } from '@/middleware/intelligent-parameters';
// Manually optimize for specific use case

const params = optimizeParameters(userInput, {

  taskType: TaskType.REASONING,

  model: 'llama3.2:3b',

  complexity: 'complex',

  overrides: {

    maxTokens: 5000 // Override specific parameter

  }

});
// Use optimized parameters

const response = await fetch('/api/llm/generate', {

  method: 'POST',

  body: JSON.stringify({

    prompt: userInput,

    ...params

  })

});

```
## Performance Tracking
### Monitoring Parameter Effectiveness
```typescript

// Check parameter performance

const performance = await enhancedLLMRouter.getParameterPerformance();
performance.forEach(stat => {

  console.log(`Task: ${stat.taskType}, Model: ${stat.model}`);

  console.log(`Avg Latency: ${stat.avgLatency}ms`);

  console.log(`Success Rate: ${stat.successRate * 100}%`);

});

```
### Health Check with Metrics
```typescript

const health = await enhancedLLMRouter.healthCheck();

console.log('Available Models:', health.availableModels);

console.log('Parameter Performance:', health.parameterPerformance);

```
## Best Practices
### 1. Always Use Task-Specific Middleware
```typescript

// ✅ GOOD - Uses appropriate middleware

router.post('/chat', chatParametersMiddleware(), handler);

router.post('/code', codeParametersMiddleware(), handler);
// ❌ BAD - No parameter optimization

router.post('/chat', handler);

```
### 2. Leverage Automatic Detection
```typescript

// ✅ GOOD - Let system detect task type

const response = await enhancedLLMRouter.route({

  prompt: userInput

  // System will detect CODE_GENERATION from content

});
// ⚠️ AVOID - Manual parameters without optimization

const response = await llmRouter.route({

  prompt: userInput,

  temperature: 0.9, // Might be suboptimal

  maxTokens: 500   // Might be insufficient

});

```
### 3. Track Performance Metrics
```typescript

// ✅ GOOD - Monitor and adjust

import { parameterEffectivenessLogger } from '@/middleware/intelligent-parameters';
app.use('/api/v1/llm/*', parameterEffectivenessLogger());

```
### 4. Provide Context for Better Optimization
```typescript

// ✅ GOOD - Rich context for optimization

const response = await enhancedLLMRouter.route({

  prompt: userInput,

  context: {

    domain: 'healthcare',

    requiresPrecision: true,

    targetAudience: 'medical professionals'

  },

  userPreferences: {

    writingStyle: 'formal',

    preferredLength: 2000

  }

});
// ❌ BAD - No context provided

const response = await enhancedLLMRouter.route({

  prompt: userInput

});

```
## Migration Checklist
To fully integrate intelligent parameters:
- [ ] Replace `llmRouter` with `enhancedLLMRouter` in all services

- [ ] Add appropriate middleware to all LLM endpoints

- [ ] Update agents to use `optimizeParameters()`

- [ ] Implement parameter performance tracking

- [ ] Add context storage for parameter analytics

- [ ] Configure task type preferences for custom models

- [ ] Set up monitoring dashboards for parameter effectiveness

- [ ] Document task type mappings for your domain
## Advanced Configuration
### Custom Task Types
Extend the task type enum for domain-specific needs:
```typescript

// In intelligent-parameter-service.ts

export enum CustomTaskType {

  ...TaskType,

  MEDICAL_DIAGNOSIS = 'medical_diagnosis',

  LEGAL_ANALYSIS = 'legal_analysis',

  FINANCIAL_MODELING = 'financial_modeling'

}
// Add detection patterns

if (text.match(/\b(diagnosis|symptoms|treatment|medical)\b/i)) {

  return CustomTaskType.MEDICAL_DIAGNOSIS;

}

```
### Model-Specific Preferences
Configure models with task preferences:
```typescript

// In model configuration

this.models.set('medical-llama', {

  available: true,

  priority: 1,

  endpoint: 'http://localhost:11434',

  type: 'ollama',

  capabilities: ['chat', 'medical'],

  preferredTaskTypes: [

    CustomTaskType.MEDICAL_DIAGNOSIS,

    TaskType.DATA_ANALYSIS

  ],

  performanceMetrics: {

    avgLatency: 0,

    avgTokensPerSecond: 0,

    successRate: 1.0

  }

});

```
## Troubleshooting
### Issue: Parameters Not Being Applied
Check middleware is registered:

```typescript

console.log('Request body after middleware:', req.body);

// Should show temperature, maxTokens, etc.

```
### Issue: Wrong Task Type Detected
Explicitly specify task type:

```typescript

const response = await enhancedLLMRouter.route({

  prompt: userInput,

  taskType: TaskType.CODE_GENERATION // Force specific type

});

```
### Issue: Performance Degradation
Review parameter performance:

```typescript

const stats = await enhancedLLMRouter.getParameterPerformance();

// Look for low success rates or high latencies

```
## Next Steps
1. **Immediate**: Add middleware to chat and API endpoints

2. **Short-term**: Migrate to enhanced LLM router

3. **Medium-term**: Implement performance tracking dashboard

4. **Long-term**: ML-based parameter learning from performance data
## Support
For questions or issues with intelligent parameters:

- Check logs with `LogContext.AI` filter

- Review parameter performance metrics

- Consult the enhanced LLM router documentation

- File issues with parameter performance data