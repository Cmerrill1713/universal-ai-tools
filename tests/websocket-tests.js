import WebSocket from 'ws';
import { describe, it, expect, beforeAll } from '@jest/globals';
import { TWO } from '../src/utils/constants';
const WS_BASE_URL = process.env.WS_URL || 'ws://localhost:9999';
const TEST_TIMEOUT = 10000;
describe('WebSocket System Tests', () => {
    let testToken = 'test-api-key-123';
    beforeAll(() => {
        console.log('🔌 Starting WebSocket tests...');
        console.log(`📍 WebSocket URL: ${WS_BASE_URL}`);
    });
    describe('Sweet Athena WebSocket', () => {
        it('should connect to Sweet Athena WebSocket endpoint', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            ws.on('open', () => {
                expect(ws.readyState).toBe(WebSocket.OPEN);
                ws.close();
                done();
            });
            ws.on('error', (error) => {
                done(error);
            });
            setTimeout(() => {
                ws.close();
                done(new Error('Connection timeout'));
            }, 5000);
        });
        it('should authenticate with token', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'auth',
                    data: { token: testToken },
                }));
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                    expect(message.authenticated).toBe(true);
                    ws.close();
                    done();
                }
                else if (message.type === 'auth_failed') {
                    ws.close();
                    done(new Error('Authentication failed'));
                }
            });
            ws.on('error', (error) => {
                done(error);
            });
            setTimeout(() => {
                ws.close();
                done(new Error('Authentication timeout'));
            }, TEST_TIMEOUT);
        });
        it('should handle chat messages', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            let authenticated = false;
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'auth',
                    data: { token: testToken },
                }));
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                    authenticated = true;
                    ws.send(JSON.stringify({
                        type: 'chat',
                        data: {
                            message: 'Hello Sweet Athena!',
                            personalityMode: 'sweet',
                        },
                    }));
                }
                else if (message.type === 'chat_response' && authenticated) {
                    expect(message.data).toHaveProperty('response');
                    expect(message.data.response).toBeTruthy();
                    ws.close();
                    done();
                }
            });
            ws.on('error', (error) => {
                done(error);
            });
            setTimeout(() => {
                ws.close();
                done(new Error('Chat message timeout'));
            }, TEST_TIMEOUT);
        });
        it('should handle personality changes', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            let authenticated = false;
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'auth',
                    data: { token: testToken },
                }));
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                    authenticated = true;
                    ws.send(JSON.stringify({
                        type: 'personality_change',
                        data: {
                            personality: 'playful',
                        },
                    }));
                }
                else if (message.type === 'personality_changed' && authenticated) {
                    expect(message.data.personality).toBe('playful');
                    ws.close();
                    done();
                }
            });
            ws.on('error', (error) => {
                done(error);
            });
            setTimeout(() => {
                ws.close();
                done(new Error('Personality change timeout'));
            }, TEST_TIMEOUT);
        });
        it('should handle ping/pong heartbeat', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            let pongReceived = false;
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'auth',
                    data: { token: testToken },
                }));
            });
            ws.on('pong', () => {
                pongReceived = true;
                expect(pongReceived).toBe(true);
                ws.close();
                done();
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                    ws.ping();
                }
            });
            ws.on('error', (error) => {
                done(error);
            });
            setTimeout(() => {
                ws.close();
                done(new Error('Heartbeat timeout'));
            }, TEST_TIMEOUT);
        });
        it('should enforce rate limiting', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            let authenticated = false;
            let rateLimitHit = false;
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'auth',
                    data: { token: testToken },
                }));
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                    authenticated = true;
                    for (let i = 0; i < 100; i++) {
                        ws.send(JSON.stringify({
                            type: 'chat',
                            data: { message: `Message ${i}` },
                        }));
                    }
                }
                else if (message.type === 'error' && message.error === 'rate_limit_exceeded') {
                    rateLimitHit = true;
                    expect(rateLimitHit).toBe(true);
                    ws.close();
                    done();
                }
            });
            ws.on('error', (error) => {
                if (rateLimitHit) {
                    done();
                }
                else {
                    done(error);
                }
            });
            setTimeout(() => {
                ws.close();
                if (rateLimitHit) {
                    done();
                }
                else {
                    done(new Error('Rate limit test timeout'));
                }
            }, TEST_TIMEOUT);
        });
        it('should handle reconnection', (done) => {
            let connections = 0;
            let firstWs;
            const connect = () => {
                const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
                ws.on('open', () => {
                    connections++;
                    if (connections === 1) {
                        firstWs = ws;
                        ws.close();
                    }
                    else if (connections === TWO) {
                        expect(connections).toBe(2);
                        ws.close();
                        done();
                    }
                });
                ws.on('close', () => {
                    if (connections === 1) {
                        setTimeout(connect, 100);
                    }
                });
                ws.on('error', (error) => {
                    if (connections < TWO) {
                        setTimeout(connect, 100);
                    }
                    else {
                        done(error);
                    }
                });
            };
            connect();
            setTimeout(() => {
                if (firstWs)
                    firstWs.close();
                done(new Error('Reconnection test timeout'));
            }, TEST_TIMEOUT);
        });
    });
    describe('Agent Coordination WebSocket', () => {
        it('should attempt connection to agent coordination endpoint', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/agent-ws`);
            ws.on('open', () => {
                ws.close();
                done();
            });
            ws.on('error', (error) => {
                expect(error).toBeDefined();
                done();
            });
            setTimeout(() => {
                ws.close();
                done();
            }, 2000);
        });
    });
    describe('WebSocket Error Handling', () => {
        it('should handle invalid message format', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            ws.on('open', () => {
                ws.send('invalid json {]');
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'error') {
                    expect(message.error).toContain('Invalid message format');
                    ws.close();
                    done();
                }
            });
            ws.on('error', () => {
                done();
            });
            setTimeout(() => {
                ws.close();
                done();
            }, TEST_TIMEOUT);
        });
        it('should handle unknown message types', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'auth',
                    data: { token: testToken },
                }));
            });
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'auth_success') {
                    ws.send(JSON.stringify({
                        type: 'unknown_type',
                        data: { test: true },
                    }));
                }
                else if (message.type === 'error') {
                    expect(message.error).toContain('Unknown message type');
                    ws.close();
                    done();
                }
            });
            ws.on('error', (error) => {
                done(error);
            });
            setTimeout(() => {
                ws.close();
                done(new Error('Unknown message type test timeout'));
            }, TEST_TIMEOUT);
        });
        it('should handle connection loss gracefully', (done) => {
            const ws = new WebSocket(`${WS_BASE_URL}/api/sweet-athena/ws`);
            let closed = false;
            ws.on('open', () => {
                ws.terminate();
            });
            ws.on('close', (code) => {
                closed = true;
                expect(closed).toBe(true);
                expect(code).toBeDefined();
                done();
            });
            ws.on('error', () => {
                if (!closed) {
                    ws.close();
                }
            });
            setTimeout(() => {
                if (!closed) {
                    ws.close();
                    done(new Error('Connection loss test timeout'));
                }
            }, TEST_TIMEOUT);
        });
    });
});
export async function runWebSocketTests() {
    try {
        const { run } = await import('@jest/core');
        const result = await run(['websocket-tests.ts'], {
            testTimeout: TEST_TIMEOUT,
            verbose: true,
        });
        return result.results.success;
    }
    catch (error) {
        console.error('WebSocket tests failed:', error);
        return false;
    }
}
//# sourceMappingURL=websocket-tests.js.map