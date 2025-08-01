declare global {
    const console: Console;
    const process: NodeJS.Process;
    const global: typeof globalThis;
    const Buffer: typeof Buffer;
    const __dirname: string;
    const __filename: string;
    const fetch: typeof fetch;
    const setImmediate: typeof setImmediate;
    const clearImmediate: typeof clearImmediate;
    const setTimeout: typeof setTimeout;
    const setInterval: typeof setInterval;
    const clearTimeout: typeof clearTimeout;
    const clearInterval: typeof clearInterval;
    const require: NodeRequire;
    const jest: typeof jest;
    const expect: typeof expect;
    const describe: typeof describe;
    const it: typeof it;
    const test: typeof test;
    const beforeAll: typeof beforeAll;
    const afterAll: typeof afterAll;
    const beforeEach: typeof beforeEach;
    const afterEach: typeof afterEach;
    const fetch: (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;
}
export {};
//# sourceMappingURL=setup.d.ts.map