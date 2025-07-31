import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { LogContext, log } from '@/utils/logger';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected isInitialized = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public getName(): string {
    return this.config.name;
  }

  public getDescription(): string {
    return this.config.description;
  }

  public getCapabilities(): string[] {
    return this.config.capabilities.map((cap) => cap.name);
  }

  public getPriority(): number {
    return this.config.priority;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.onInitialize();
      this.isInitialized = true;
      log.info(`Agent initialized: ${this.config.name}`, LogContext.AGENT);
    } catch (error) {
      log.error(`Failed to initialize agent: ${this.config.name}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async execute(context: AgentContext): Promise<AgentResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      log.info(`Executing agent: ${this.config.name}`, LogContext.AGENT, {
        requestId: context.requestId,
        userRequest: context.userRequest,
      });

      const response = await this.process(context);

      const executionTime = Date.now() - startTime;
      log.info(`Agent execution completed: ${this.config.name}`, LogContext.AGENT, {
        requestId: context.requestId,
        executionTime: `${executionTime}ms`,
        success: response.success,
        confidence: response.confidence,
      });

      return {
        ...response,
        metadata: {
          ...response.metadata,
          executionTime,
          agentName: this.config.name,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      log.error(`Agent execution failed: ${this.config.name}`, LogContext.AGENT, {
        requestId: context.requestId,
        error: errorMessage,
        executionTime: `${executionTime}ms`,
      });

      return {
        success: false,
        data: null,
        confidence: 0,
        message: `Agent execution failed: ${errorMessage}`,
        reasoning: `Error in ${this.config.name}: ${errorMessage}`,
        metadata: {
          executionTime,
          agentName: this.config.name,
          error: errorMessage,
        },
      };
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.onShutdown();
      this.isInitialized = false;
      log.info(`Agent shutdown: ${this.config.name}`, LogContext.AGENT);
    } catch (error) {
      log.error(`Error during agent shutdown: ${this.config.name}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract process(context: AgentContext): Promise<AgentResponse>;

  // Optional lifecycle hooks
  protected async onInitialize(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async onShutdown(): Promise<void> {
    // Override in subclasses if needed
  }

  // Helper method to validate context
  protected validateContext(context: AgentContext): void {
    if (!context.userRequest || context.userRequest.trim().length === 0) {
      throw new Error('User request is required and cannot be empty');
    }

    if (!context.requestId) {
      throw new Error('Request ID is required');
    }
  }

  // Helper method to create success response
  protected createSuccessResponse(
    data: unknown,
    message: string,
    confidence = 0.8,
    reasoning?: string
  ): AgentResponse {
    return {
      success: true,
      data,
      confidence: Math.max(0, Math.min(1, confidence)),
      message,
      reasoning: reasoning || `Processed by ${this.config.name}`,
      metadata: {
        agentName: this.config.name,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Helper method to create error response
  protected createErrorResponse(message: string, reasoning?: string): AgentResponse {
    return {
      success: false,
      data: null,
      confidence: 0,
      message,
      reasoning: reasoning || `Error in ${this.config.name}: ${message}`,
      metadata: {
        agentName: this.config.name,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
