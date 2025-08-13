import { log, LogContext } from '@/utils/logger';
export class BaseAgent {
    config;
    isInitialized = false;
    constructor(config) {
        this.config = config;
    }
    getName() {
        return this.config.name;
    }
    getDescription() {
        return this.config.description;
    }
    getCapabilities() {
        return this.config.capabilities.map((cap) => cap.name);
    }
    getPriority() {
        return this.config.priority;
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.onInitialize();
            this.isInitialized = true;
            log.info(`Agent initialized: ${this.config.name}`, LogContext.AGENT);
        }
        catch (error) {
            log.error(`Failed to initialize agent: ${this.config.name}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async execute(context) {
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
        }
        catch (error) {
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
    async shutdown() {
        try {
            await this.onShutdown();
            this.isInitialized = false;
            log.info(`Agent shutdown: ${this.config.name}`, LogContext.AGENT);
        }
        catch (error) {
            log.error(`Error during agent shutdown: ${this.config.name}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async onInitialize() {
    }
    async onShutdown() {
    }
    validateContext(context) {
        if (!context.userRequest || context.userRequest.trim().length === 0) {
            throw new Error('User request is required and cannot be empty');
        }
        if (!context.requestId) {
            throw new Error('Request ID is required');
        }
    }
    createSuccessResponse(data, message, confidence = 0.8, reasoning) {
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
    createErrorResponse(message, reasoning) {
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
//# sourceMappingURL=base-agent.js.map