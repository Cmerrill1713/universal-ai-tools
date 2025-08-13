import winston from 'winston';
export var LogContext;
(function (LogContext) {
    LogContext["SERVER"] = "server";
    LogContext["API"] = "api";
    LogContext["AGENT"] = "agent";
    LogContext["MEMORY"] = "memory";
    LogContext["DATABASE"] = "database";
    LogContext["DSPY"] = "dspy";
    LogContext["SYSTEM"] = "system";
    LogContext["AUTH"] = "auth";
    LogContext["WEBSOCKET"] = "websocket";
    LogContext["AI"] = "ai";
    LogContext["CONFIG"] = "config";
    LogContext["CACHE"] = "cache";
    LogContext["SECURITY"] = "security";
    LogContext["MCP"] = "mcp";
    LogContext["SERVICE"] = "service";
    LogContext["CONTEXT_INJECTION"] = "context_injection";
    LogContext["SYNTAX_FIXING"] = "syntax_fixing";
})(LogContext || (LogContext = {}));
const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';
const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json(), winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const contextStr = context ? `[${context}] ` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level.toUpperCase()}: ${contextStr}${message}${metaStr}`;
    })),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
    ],
});
if (!isDevelopment) {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
    }));
}
export const log = {
    info: (message, context, meta) => {
        logger.info(message, { context, ...meta });
    },
    error: (message, context, meta) => {
        logger.error(message, { context, ...meta });
    },
    warn: (message, context, meta) => {
        logger.warn(message, { context, ...meta });
    },
    debug: (message, context, meta) => {
        logger.debug(message, { context, ...meta });
    },
};
export { logger };
export default logger;
//# sourceMappingURL=logger.js.map