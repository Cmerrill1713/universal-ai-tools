import winston from 'winston';
export declare enum LogContext {
    SERVER = "server",
    API = "api",
    AGENT = "agent",
    MEMORY = "memory",
    DATABASE = "database",
    DSPY = "dspy",
    SYSTEM = "system",
    AUTH = "auth",
    WEBSOCKET = "websocket",
    AI = "ai",
    CONFIG = "config",
    CACHE = "cache",
    SECURITY = "security",
    MCP = "mcp",
    SERVICE = "service",
    CONTEXT_INJECTION = "context_injection",
    SYNTAX_FIXING = "syntax_fixing"
}
declare const logger: winston.Logger;
export declare const log: {
    info: (message: string, context?: LogContext, meta?: Record<string, unknown>) => void;
    error: (message: string, context?: LogContext, meta?: Record<string, unknown>) => void;
    warn: (message: string, context?: LogContext, meta?: Record<string, unknown>) => void;
    debug: (message: string, context?: LogContext, meta?: Record<string, unknown>) => void;
};
export { logger };
export default logger;
//# sourceMappingURL=logger.d.ts.map