#!/usr/bin/env tsx
/**
 * Context Loader for MCP System
 * Loads Universal AI Tools project knowledge, patterns, and history into the MCP system
 */

import { mcpIntegrationService } from '../services/mcp-integration-service.js';
import { LogContext, log } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

interface ContextEntry {
  content: string;
  category: string;
  metadata?: Record<string, unknown>;
}

class ContextLoader {
  private loadedItems = 0;
  private failedItems = 0;

  async loadAllContext(): Promise<void> {
    log.info('📚 Starting context loading to MCP system', LogContext.MCP);

    try {
      // Start MCP service
      const started = await mcpIntegrationService.start();
      if (!started) {
        throw new Error('Failed to start MCP service');
      }

      // Wait for service to be ready
      await this.delay(2000);

      // Load different types of context
      await this.loadProjectContext();
      await this.loadTaskProgress();
      await this.loadCodePatterns();
      await this.loadErrorAnalysis();
      await this.loadSystemKnowledge();
      await this.loadCurrentState();

      log.info('✅ Context loading completed', LogContext.MCP, {
        loaded: this.loadedItems,
        failed: this.failedItems,
        total: this.loadedItems + this.failedItems,
      });
    } catch (error) {
      log.error('❌ Context loading failed', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
        loaded: this.loadedItems,
        failed: this.failedItems,
      });
      throw error;
    } finally {
      await mcpIntegrationService.shutdown();
    }
  }

  private async loadProjectContext(): Promise<void> {
    log.info('📖 Loading project overview and architecture', LogContext.MCP);

    const projectContexts: ContextEntry[] = [
      {
        content: `Universal AI Tools is a next-generation AI platform featuring advanced service-oriented architecture, MLX fine-tuning capabilities, intelligent parameter automation, and distributed learning systems. This is a production-ready platform with sophisticated AI orchestration, not a simple collection of individual agents.

Key Components:
- MLX Fine-Tuning Framework: Custom model training and optimization
- Intelligent Parameter Automation: Self-optimizing AI systems with ML-based parameter selection  
- AB-MCTS Orchestration: Probabilistic learning and advanced coordination
- Multi-Tier LLM Architecture: Efficient model routing (LFM2, Ollama, External APIs)
- PyVision Integration: Advanced image processing with SDXL refiner support
- DSPy Cognitive Orchestration: 10-agent reasoning chains with internal LLM relay
- Distributed Learning Systems: Feedback loops, performance optimization, and analytics
- Production Infrastructure: Health monitoring, resource management, and auto-scaling
- Supabase Vault Integration: Secure secrets management for all API keys and sensitive data`,
        category: 'project_overview',
        metadata: { importance: 'critical', source: 'CLAUDE.md', version: '2025-07-29' },
      },
      {
        content: `Service-Oriented Architecture:
- Better resource sharing and efficiency than isolated agents
- Comprehensive error handling and recovery
- Production-ready scalability and monitoring

Advanced Learning Systems:
- Intelligent parameter automation reduces manual tuning
- AB-MCTS provides probabilistic optimization
- Feedback loops enable continuous improvement

MLX Integration:
- Custom model training for specific use cases
- Apple Silicon optimization for maximum performance
- Automated model lifecycle management

Production Infrastructure:
- Health monitoring and auto-scaling
- Comprehensive security and authentication
- Advanced caching and performance optimization`,
        category: 'architecture_principles',
        metadata: { importance: 'high', source: 'CLAUDE.md' },
      },
      {
        content: `Never store API keys in environment variables or code! Universal AI Tools uses Supabase Vault for secure secrets management.

Critical Pattern: Use Supabase Vault for ALL API Keys

Storing Secrets:
await supabase.rpc('vault.create_secret', {
  secret: apiKey,
  name: 'openai_api_key', 
  description: 'OpenAI API key for production'
});

Retrieving Secrets:
const { data: secret } = await supabase.rpc('vault.read_secret', {
  secret_name: 'openai_api_key'
});
const apiKey = secret.decrypted_secret;

Best Practices:
1. Store Once, Retrieve at Runtime
2. Namespace Your Secrets (use prefixes like llm_, service_, auth_)
3. Rotate Regularly using Vault's built-in capabilities
4. Audit Access - all secret access is logged in Supabase`,
        category: 'security_patterns',
        metadata: { importance: 'critical', source: 'CLAUDE.md', pattern_type: 'security' },
      },
    ];

    await this.saveContextBatch(projectContexts);
  }

  private async loadTaskProgress(): Promise<void> {
    log.info('📊 Loading task progress and development history', LogContext.MCP);

    // Load current development milestones
    await mcpIntegrationService.sendMessage('save_task_progress', {
      task_id: 'ts_error_reduction',
      description: 'Reduce TypeScript errors from 33,131 to couple hundred or less',
      status: 'in_progress',
      progress_percentage: 78,
      metadata: {
        initial_errors: 33131,
        current_errors: 7075,
        target_errors: 200,
        improvement_percentage: 78.6,
        last_updated: new Date().toISOString(),
      },
    });

    await mcpIntegrationService.sendMessage('save_task_progress', {
      task_id: 'mcp_system_setup',
      description: 'Set up Supabase MCP system for context persistence and pattern learning',
      status: 'in_progress',
      progress_percentage: 85,
      metadata: {
        components: ['mcp_server', 'integration_service', 'context_loader', 'health_monitoring'],
        completed: ['database_schema', 'server_implementation', 'fallback_system'],
        remaining: ['testing', 'documentation', 'monitoring'],
      },
    });

    await mcpIntegrationService.sendMessage('save_task_progress', {
      task_id: 'aggressive_fix_prevention',
      description: 'Prevent aggressive string fixes that cause syntax regressions',
      status: 'completed',
      progress_percentage: 100,
      metadata: {
        problem: 'Aggressive regex patterns corrupted files and increased errors',
        solution: 'Conservative pattern-based fixes with MCP pattern learning',
        lesson: 'Always validate fixes against known successful patterns',
      },
    });

    this.loadedItems += 3;
  }

  private async loadCodePatterns(): Promise<void> {
    log.info('🔧 Loading successful code fix patterns', LogContext.MCP);

    const patterns = [
      {
        pattern_type: 'nested_ternary_fix',
        before_code: 'const result = condition ? value1 : condition2 ? value2 : value3;',
        after_code:
          'const result = getResultBasedOnCondition(condition, condition2, value1, value2, value3);',
        description:
          'Replace nested ternary operators with explicit functions for better readability',
        error_types: ['complexity', 'readability', 'ESLint_complexity'],
        metadata: { success_rate: 0.95, common_error: 'TODO: Refactor nested ternary' },
      },
      {
        pattern_type: 'unknown_type_fix',
        before_code: 'const value: unknown = someFunction();',
        after_code: 'const value: SpecificType = someFunction() as SpecificType;',
        description: 'Replace unknown types with specific type assertions where safe',
        error_types: ['TS18046', 'type_safety', 'unknown_type'],
        metadata: { success_rate: 0.88, warning: 'Only use when type is guaranteed' },
      },
      {
        pattern_type: 'import_fix',
        before_code: 'import { thing } from "./relative/path"',
        after_code: 'import { thing } from "../utils/module.js"',
        description: 'Fix import paths to use correct relative paths and extensions',
        error_types: ['TS2307', 'module_resolution', 'import_error'],
        metadata: { success_rate: 0.92, note: 'Always include .js extension for ES modules' },
      },
      {
        pattern_type: 'conservative_string_fix',
        before_code: 'const msg = "unclosed string',
        after_code: 'const msg = "properly closed string";',
        description: 'Fix unterminated string literals with proper closing quotes',
        error_types: ['TS1002', 'syntax_error', 'unterminated_string'],
        metadata: {
          success_rate: 0.99,
          warning: 'Avoid aggressive regex replacement, validate each fix',
          lesson: 'Aggressive string fixes caused 22,319→28,753 error increase',
        },
      },
    ];

    for (const pattern of patterns) {
      try {
        await mcpIntegrationService.sendMessage('save_code_pattern', pattern);
        this.loadedItems++;
      } catch (error) {
        log.warn('⚠️ Failed to save code pattern', LogContext.MCP, {
          pattern_type: pattern.pattern_type,
          error: error instanceof Error ? error.message : String(error),
        });
        this.failedItems++;
      }
    }
  }

  private async loadErrorAnalysis(): Promise<void> {
    log.info('🔍 Loading error analysis and patterns', LogContext.MCP);

    const errorAnalyses = [
      {
        error_type: 'TS18046',
        error_message: "'req' is of type 'unknown'",
        solution_pattern: 'Add proper type assertion: req as Request',
        metadata: {
          frequency: 15,
          files_affected: ['utils/validation.ts', 'utils/api-response.ts'],
          fix_success_rate: 0.9,
        },
      },
      {
        error_type: 'TS2345',
        error_message: 'Argument of type string is not assignable to parameter of type number',
        solution_pattern: 'Add type conversion: parseInt(value) or Number(value)',
        metadata: {
          frequency: 8,
          common_locations: ['parameter validation', 'API parsing'],
          fix_success_rate: 0.95,
        },
      },
      {
        error_type: 'nested_ternary',
        error_message: 'TODO: Refactor nested ternary',
        solution_pattern: 'Extract to explicit function with clear logic flow',
        metadata: {
          frequency: 12,
          files_affected: ['services/ab-mcts-service.ts'],
          fix_success_rate: 0.88,
          example: 'Replace ? : ? : with determineValue() function',
        },
      },
    ];

    for (const analysis of errorAnalyses) {
      try {
        await mcpIntegrationService.sendMessage('analyze_errors', analysis);
        this.loadedItems++;
      } catch (error) {
        log.warn('⚠️ Failed to save error analysis', LogContext.MCP, {
          error_type: analysis.error_type,
          error: error instanceof Error ? error.message : String(error),
        });
        this.failedItems++;
      }
    }
  }

  private async loadSystemKnowledge(): Promise<void> {
    log.info('🧠 Loading system knowledge and best practices', LogContext.MCP);

    const knowledgeEntries: ContextEntry[] = [
      {
        content: `TypeScript Error Reduction Strategy:
1. Conservative Approach: Make small, targeted fixes rather than aggressive replacements
2. Pattern Validation: Check MCP for similar error patterns before applying fixes
3. Test After Each Fix: Run type-check after every batch of changes
4. Learn from Failures: Document what doesn't work to prevent future mistakes

Historical Lessons:
- Aggressive string fixes (22,319→28,753 errors): AVOID bulk regex replacements
- Conservative fixes work better: Small, targeted changes with validation
- Pattern learning prevents repeating mistakes
- Context awareness reduces hallucinations`,
        category: 'error_reduction_strategy',
        metadata: { importance: 'critical', lessons_learned: true },
      },
      {
        content: `MCP Pattern Learning System:
- Save successful fixes as patterns for future reference
- Use error frequency tracking to prioritize common issues  
- Validate new fixes against historical successful patterns
- Maintain context of what works vs what causes regressions

Key Functions:
- save_code_pattern(): Store successful fix patterns
- get_code_patterns(): Retrieve patterns for similar errors
- analyze_errors(): Track error frequency and solutions
- search_context(): Find relevant context for current issues`,
        category: 'mcp_usage_patterns',
        metadata: { importance: 'high', system_component: 'mcp' },
      },
      {
        content: `Production Code Quality Standards:
- NEVER use 'any' types - always provide explicit types
- NO console.log statements - use winston logger instead
- Handle all promises with try/catch or .catch()
- Keep functions under 40 lines, complexity under 8
- Use Supabase Vault for ALL secrets, never hardcode
- Validate all user inputs and sanitize data
- Write tests for new features, aim for 80% coverage`,
        category: 'code_quality_standards',
        metadata: { importance: 'critical', source: 'CLAUDE.md' },
      },
    ];

    await this.saveContextBatch(knowledgeEntries);
  }

  private async loadCurrentState(): Promise<void> {
    log.info('📅 Loading current development state', LogContext.MCP);

    const currentState: ContextEntry[] = [
      {
        content: `Current Development Status (2025-07-29):
- TypeScript Errors: Reduced from 33,131 to 7,075 (78% improvement)
- MCP System: Being implemented with Supabase integration
- Architecture: Service-oriented with MLX, AB-MCTS, and intelligent parameters
- Security: Supabase Vault integration for secrets management
- Goal: Reduce TS errors to "couple hundred or less"

Next Priorities:
1. Complete MCP system testing and validation
2. Implement MCP-assisted TypeScript error fixing
3. Continue conservative error reduction approach
4. Build pattern learning feedback loops`,
        category: 'current_development_state',
        metadata: {
          date: '2025-07-29',
          error_count: 7075,
          improvement_percentage: 78.6,
          status: 'in_progress',
        },
      },
      {
        content: `Tools and Commands Available:
- npm run type-check: Check TypeScript errors
- npm run lint:fix: Auto-fix linting issues  
- npm run format: Format code with Prettier
- npm test: Run test suite
- npm run dev: Start development server
- tsx scripts/test-mcp-system.ts: Test MCP functionality
- tsx scripts/load-context-to-mcp.ts: Load context to MCP

Development Workflow:
1. Check current errors: npm run type-check
2. Load context: tsx scripts/load-context-to-mcp.ts
3. Query MCP for patterns before making fixes
4. Apply conservative, targeted fixes
5. Validate with type-check and tests`,
        category: 'development_workflow',
        metadata: { importance: 'high', tool_reference: true },
      },
    ];

    await this.saveContextBatch(currentState);
  }

  private async saveContextBatch(entries: ContextEntry[]): Promise<void> {
    for (const entry of entries) {
      try {
        await mcpIntegrationService.sendMessage('save_context', entry);
        this.loadedItems++;
        log.debug('📝 Saved context entry', LogContext.MCP, {
          category: entry.category,
          length: entry.content.length,
        });
      } catch (error) {
        log.warn('⚠️ Failed to save context entry', LogContext.MCP, {
          category: entry.category,
          error: error instanceof Error ? error.message : String(error),
        });
        this.failedItems++;
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loader = new ContextLoader();

  loader
    .loadAllContext()
    .then(() => {
      console.log('✅ Context loading completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Context loading failed:', error);
      process.exit(1);
    });
}

export { ContextLoader };
