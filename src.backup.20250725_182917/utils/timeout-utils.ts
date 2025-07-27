import { LogContext, logger } from './enhanced-logger';

export interface TimeoutOptions {
  timeout: number;
  name: string;
  fallbackValue?: any;
  throwOnTimeout?: boolean;
}

/**
 * Wraps a promise with a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, options: TimeoutOptions): Promise<T> {
  const { timeout, name, fallbackValue, throwOnTimeout = false } = options;

  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      const error = new Error(`${name} timed out after ${timeout}ms`);
      if (throwOnTimeout) {
        reject(error);
      } else {
        logger.warn(`${name} initialization timed out`, LogContext.SYSTEM, {
          timeout,
          fallbackValue,
        });
      }
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } catch (error) {
    if (!throwOnTimeout && fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw error;
  }
}

/**
 * Initialize a service with timeout protection
 */
export async function initializeWithTimeout<T>(
  initFunction: () => Promise<T>,
  serviceName: string,
  timeout = 10000,
  options: { critical?: boolean; fallbackValue?: T } = {}
): Promise<T | null> {
  const startTime = Date.now();

  try {
    logger.info(`🔄 Initializing ${serviceName}...`);

    const result = await withTimeout(initFunction(), {
      timeout,
      name: serviceName,
      fallbackValue: options.fallbackValue,
      throwOnTimeout: options.critical,
    });

    const duration = Date.now() - startTime;
    logger.info(`✅ ${serviceName} initialized successfully in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.critical) {
      logger.error(`❌ Critical service ${serviceName} failed to initialize`, LogContext.SYSTEM, {
        error: errorMessage,
        duration,
      });
      throw error;
    } else {
      logger.warn(
        `⚠️  ${serviceName} failed to initialize, continuing without it`,
        LogContext.SYSTEM,
        {
          error: errorMessage,
          duration,
        }
      );
      return options.fallbackValue || null;
    }
  }
}

/**
 * Initialize multiple services in parallel with timeout protection
 */
export async function initializeServicesParallel(
  services: Array<{
    name: string;
    init: () => Promise<unknown>;
    timeout?: number;
    critical?: boolean;
  }>;
): Promise<Map<string, { success: boolean; result?: any; error?: string }>> {
  const results = new Map<string, { success: boolean; result?: any; error?: string }>();

  await Promise.all(
    services.map(async (service) => {
      try {
        const result = await initializeWithTimeout(
          service.init,
          service.name,
          service.timeout || 10000,
          { critical: service.critical }
        );

        results.set(service.name, {
          success: true,
          result
        });
      } catch (error) {
        results.set(service.name, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  return results;
}

/**
 * Retry initialization with exponential backoff
 */
export async function initializeWithRetry<T>(
  initFunction: () => Promise<T>,
  serviceName: string,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, timeout = 10000 } = options;

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(
        `🔄 Attempting to initialize ${serviceName} (attempt ${attempt}/${maxRetries})...`
      );

      const result = await withTimeout(initFunction(), {
        timeout,
        name: serviceName,
        throwOnTimeout: true,
      });

      logger.info(`✅ ${serviceName} initialized successfully on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Attempt ${attempt)} failed for ${serviceName}`, LogContext.SYSTEM, {
        error: lastError.message,
        nextRetryIn: attempt < maxRetries ? delay : 'none',
      });

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay); // Exponential backoff with max delay
      }
    }
  }
  throw lastError || new Error(`Failed to initialize ${serviceName} after ${maxRetries} attempts`);
}
