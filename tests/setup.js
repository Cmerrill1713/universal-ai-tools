// Test setup file
import { config } from 'dotenv';
import { jest } from '@jest/globals';
// Load test environment variables
config({ path: '.env.test' });
// Set up module system globals for ES/CommonJS compatibility
if (typeof globalThis.__filename === 'undefined') {
    // In CommonJS/test environment - use Node.js globals if available
    if (typeof __filename !== 'undefined') {
        globalThis.__filename = __filename;
        globalThis.__dirname = __dirname;
    }
    else {
        // Fallback for test environment
        globalThis.__filename = process.cwd() + '/tests/setup.ts';
        globalThis.__dirname = process.cwd() + '/tests';
    }
}
// Ensure test environment
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
// Add test bypass headers for requests
process.env.X_TEST_BYPASS = 'true';
// Prevent background services from starting in tests
process.env.DISABLE_BACKGROUND_SERVICES = 'true';
process.env.DISABLE_TIMERS = 'true';
process.env.DISABLE_MONITORING = 'true';
process.env.DISABLE_HEALTH_CHECKS = 'true';
// Polyfill fetch if not available
if (typeof globalThis.fetch === 'undefined') {
    globalThis.fetch = async (...args) => {
        const { default: fetch } = await import('node-fetch');
        return fetch(...args);
    };
}
// Mock console methods to reduce noise in tests
const originalConsole = console;
global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Increase timeout for async operations
jest.setTimeout(30000);
// Set up teardown tracking
global.testTeardownInProgress = false;
// Memory monitoring and cleanup
const originalSetInterval = setInterval;
const originalSetTimeout = setTimeout;
const activeTimers = new Set();
const activeConnections = new Set();
// Monitor memory usage
function logMemoryUsage(label) {
    if (process.env.NODE_ENV === 'test') {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
        if (heapUsedMB > 400) { // Warning if over 400MB
            console.warn(`⚠️  Memory warning at ${label}: ${heapUsedMB}MB/${heapTotalMB}MB heap used`);
        }
    }
}
// Force garbage collection if available
function forceGC() {
    if (global.gc) {
        global.gc();
    }
}
// Enhanced cleanup function
function performCleanup() {
    // Clear all timers
    activeTimers.forEach(timer => {
        try {
            clearTimeout(timer);
            clearInterval(timer);
        }
        catch (e) {
            // Ignore cleanup errors
        }
    });
    activeTimers.clear();
    // Close any remaining connections
    activeConnections.forEach(conn => {
        try {
            if (conn && typeof conn.close === 'function') {
                conn.close();
            }
            else if (conn && typeof conn.end === 'function') {
                conn.end();
            }
            else if (conn && typeof conn.destroy === 'function') {
                conn.destroy();
            }
        }
        catch (e) {
            // Ignore cleanup errors
        }
    });
    activeConnections.clear();
    // Force garbage collection
    forceGC();
}
global.setInterval = jest.fn().mockImplementation((callback, delay, ...args) => {
    // In test mode, don't actually start intervals for background services
    if (process.env.DISABLE_TIMERS === 'true') {
        return { _id: Math.random(), _destroyed: false };
    }
    const timer = originalSetInterval(callback, delay, ...args);
    activeTimers.add(timer);
    return timer;
});
global.setTimeout = jest.fn().mockImplementation((callback, delay, ...args) => {
    // Allow short timeouts for tests, but prevent long background delays
    if (process.env.DISABLE_TIMERS === 'true' && delay > 1000) {
        return { _id: Math.random(), _destroyed: false };
    }
    const timer = originalSetTimeout(callback, delay, ...args);
    activeTimers.add(timer);
    return timer;
});
// Track test lifecycle with enhanced cleanup
afterEach(async () => {
    global.testTeardownInProgress = true;
    // Log memory usage before cleanup
    logMemoryUsage('before cleanup');
    // Perform comprehensive cleanup
    performCleanup();
    // Short delay to allow cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    // Log memory usage after cleanup
    logMemoryUsage('after cleanup');
});
beforeEach(() => {
    global.testTeardownInProgress = false;
    jest.clearAllMocks();
    // Log memory at test start
    logMemoryUsage('test start');
});
// Add custom matchers if needed
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
});
//# sourceMappingURL=setup.js.map