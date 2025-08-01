import { config } from 'dotenv';
import { jest } from '@jest/globals';
config({ path: '.env.test' });
if (typeof globalThis.fetch === 'undefined') {
    globalThis.fetch = async (...args) => {
        const { default: fetch } = await import('node-fetch');
        return fetch(...args);
    };
}
const originalConsole = console;
global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
jest.setTimeout(30000);
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