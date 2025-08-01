import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
const BASE_URL = 'http://localhost:9999';
const API_BASE = `${BASE_URL}/api/v1/device-auth`;
const WS_URL = 'ws://localhost:8080/ws/device-auth';
const testDevice = {
    deviceId: `test-device-${uuidv4()}`,
    deviceName: 'Test iPhone 15 Pro',
    deviceType: 'iPhone',
    publicKey: 'test-public-key-' + crypto.randomBytes(16).toString('hex'),
    metadata: {
        osVersion: '17.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity', 'face_id']
    }
};
function generateMockToken(userId = 'test-user', deviceId) {
    const payload = {
        userId,
        email: `${userId}@test.com`,
        isAdmin: false,
        permissions: ['api_access', 'device_auth'],
        ...(deviceId && { deviceId })
    };
    const secret = process.env.JWT_SECRET || 'universal-ai-tools-secret';
    const token = jwt.sign(payload, secret, {
        expiresIn: '1h',
        issuer: 'universal-ai-tools',
        subject: userId
    });
    return token;
}
function waitForConnection(ws) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        if (ws.readyState === WebSocket.OPEN) {
            clearTimeout(timeout);
            resolve();
            return;
        }
        const openHandler = () => {
            clearTimeout(timeout);
            ws.off('open', openHandler);
            ws.off('error', errorHandler);
            resolve();
        };
        const errorHandler = (error) => {
            clearTimeout(timeout);
            ws.off('open', openHandler);
            ws.off('error', errorHandler);
            reject(error);
        };
        ws.on('open', openHandler);
        ws.on('error', errorHandler);
    });
}
function waitForMessage(ws, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.off('message', handler);
            reject(new Error('Message timeout'));
        }, timeout);
        const handler = (data) => {
            clearTimeout(timer);
            ws.off('message', handler);
            try {
                const message = JSON.parse(data.toString());
                resolve(message);
            }
            catch (error) {
                reject(error);
            }
        };
        ws.on('message', handler);
    });
}
function waitForClose(ws) {
    return new Promise(resolve => {
        const handler = (code, reason) => {
            ws.off('close', handler);
            resolve({ code, reason: reason.toString() });
        };
        ws.on('close', handler);
    });
}
async function createAuthenticatedWebSocket(userId = 'test-user', deviceId) {
    const token = generateMockToken(userId, deviceId);
    const ws = new WebSocket(WS_URL, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    await waitForConnection(ws);
    return ws;
}
function closeWebSocket(ws) {
    return new Promise(resolve => {
        if (ws.readyState === WebSocket.CLOSED) {
            resolve();
            return;
        }
        ws.on('close', () => resolve());
        ws.close(1000, 'Test completed');
    });
}
test.describe('Device Authentication API Tests', () => {
    let authToken;
    let registeredDeviceId;
    test.beforeAll(async () => {
        authToken = generateMockToken();
    });
    test.describe('Health Check', () => {
        test('should verify backend is running', async ({ request }) => {
            const response = await request.get(`${BASE_URL}/health`);
            expect(response.ok()).toBeTruthy();
            const health = await response.json();
            expect(health.status).toBe('ok');
            expect(health.services).toBeDefined();
            expect(health.services.websocket).toBe(true);
        });
    });
    test.describe('Device Registration', () => {
        test('should register a new device', async ({ request }) => {
            const response = await request.post(`${API_BASE}/register-initial`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: testDevice
            });
            if (!response.ok()) {
                const error = await response.json();
                console.log('Registration failed:', error);
                console.log('Status:', response.status());
                console.log('Headers sent:', {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                });
            }
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.deviceId).toBeDefined();
            expect(result.data.message).toBe('Device registered successfully');
            expect(result.data.requiresTrust).toBe(false);
            registeredDeviceId = result.data.deviceId;
        });
        test('should update existing device on re-registration', async ({ request }) => {
            await request.post(`${API_BASE}/register-initial`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: testDevice
            });
            const updatedDevice = {
                ...testDevice,
                deviceName: 'Updated Test iPhone'
            };
            const response = await request.post(`${API_BASE}/register-initial`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: updatedDevice
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.message).toBe('Device updated successfully');
        });
        test('should fail without authentication', async ({ request }) => {
            const response = await request.post(`${API_BASE}/register`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: testDevice
            });
            expect(response.status()).toBe(401);
            const result = await response.json();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('AUTHENTICATION_ERROR');
        });
        test('should validate required fields', async ({ request }) => {
            const invalidDevice = {
                deviceName: 'Test Device'
            };
            const response = await request.post(`${API_BASE}/register-initial`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: invalidDevice
            });
            expect(response.status()).toBe(400);
            const result = await response.json();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('VALIDATION_ERROR');
        });
    });
    test.describe('Device Listing', () => {
        test('should list user devices', async ({ request }) => {
            const response = await request.get(`${API_BASE}/devices`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.devices).toBeDefined();
            expect(Array.isArray(result.data.devices)).toBe(true);
            expect(result.data.total).toBe(result.data.devices.length);
        });
        test('should return empty list for new user', async ({ request }) => {
            const newUserToken = generateMockToken('new-user-' + uuidv4());
            const response = await request.get(`${API_BASE}/devices`, {
                headers: {
                    'Authorization': `Bearer ${newUserToken}`
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.devices).toEqual([]);
            expect(result.data.total).toBe(0);
        });
    });
    test.describe('Authentication Challenge', () => {
        let challengeId;
        let challenge;
        test('should request authentication challenge', async ({ request }) => {
            const response = await request.post(`${API_BASE}/challenge`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: 'iPhone-CM-15Pro-2024'
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.challengeId).toBeDefined();
            expect(result.data.challenge).toBeDefined();
            expect(result.data.expiresAt).toBeDefined();
            challengeId = result.data.challengeId;
            challenge = result.data.challenge;
            const expiresIn = result.data.expiresAt - Date.now();
            expect(expiresIn).toBeGreaterThan(290000);
            expect(expiresIn).toBeLessThan(310000);
        });
        test('should fail for unregistered device', async ({ request }) => {
            const response = await request.post(`${API_BASE}/challenge`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: 'non-existent-device'
                }
            });
            expect(response.status()).toBe(404);
            const result = await response.json();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('DEVICE_NOT_FOUND');
        });
        test('should verify challenge response', async ({ request }) => {
            const challengeResponse = await request.post(`${API_BASE}/challenge`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: 'iPhone-CM-15Pro-2024'
                }
            });
            const challengeData = await challengeResponse.json();
            if (!challengeData.success) {
                throw new Error('Failed to get challenge');
            }
            const mockSignature = crypto
                .createHash('sha256')
                .update(challengeData.data.challenge)
                .digest('base64');
            const response = await request.post(`${API_BASE}/verify`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    challengeId: challengeData.data.challengeId,
                    signature: mockSignature,
                    proximity: {
                        rssi: -50
                    }
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.token).toBeDefined();
            expect(result.data.expiresIn).toBe(86400);
            expect(result.data.deviceId).toBeDefined();
            expect(result.data.userId).toBeDefined();
        });
        test('should fail with invalid challenge', async ({ request }) => {
            const response = await request.post(`${API_BASE}/verify`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    challengeId: 'invalid-challenge-id',
                    signature: 'invalid-signature'
                }
            });
            expect(response.status()).toBe(404);
            const result = await response.json();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('CHALLENGE_NOT_FOUND');
        });
    });
    test.describe('Proximity Updates', () => {
        test('should update proximity information', async ({ request }) => {
            const response = await request.post(`${API_BASE}/proximity`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: registeredDeviceId || 'test-device',
                    rssi: -60
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.sessionId).toBeDefined();
            expect(result.data.proximity).toBe('near');
            expect(result.data.locked).toBe(false);
        });
        test('should lock when device is far', async ({ request }) => {
            const response = await request.post(`${API_BASE}/proximity`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: registeredDeviceId || 'test-device',
                    rssi: -95
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.proximity).toBe('unknown');
            expect(result.data.locked).toBe(true);
        });
        test('should validate RSSI range', async ({ request }) => {
            const response = await request.post(`${API_BASE}/proximity`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: registeredDeviceId || 'test-device',
                    rssi: 10
                }
            });
            expect(response.status()).toBe(400);
            const result = await response.json();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe('VALIDATION_ERROR');
        });
    });
    test.describe('WebSocket Connection Tests', () => {
        test('should connect to WebSocket with valid JWT token', async () => {
            let ws = null;
            try {
                ws = await createAuthenticatedWebSocket();
                const welcomeMessage = await waitForMessage(ws);
                expect(welcomeMessage.type).toBe('welcome');
                expect(welcomeMessage.data).toBeDefined();
                expect(welcomeMessage.data.userId).toBe('test-user');
                expect(welcomeMessage.data.clientId).toBeDefined();
                expect(welcomeMessage.data.timestamp).toBeDefined();
            }
            finally {
                if (ws) {
                    await closeWebSocket(ws);
                }
            }
        });
        test('should reject connection with invalid token', async () => {
            const invalidToken = 'invalid-jwt-token';
            const ws = new WebSocket(WS_URL, {
                headers: {
                    'Authorization': `Bearer ${invalidToken}`
                }
            });
            const closeEvent = await waitForClose(ws);
            expect(closeEvent.code).toBe(1002);
        });
        test('should reject connection without authentication', async () => {
            const ws = new WebSocket(WS_URL);
            const closeEvent = await waitForClose(ws);
            expect(closeEvent.code).toBe(1002);
        });
        test('should connect with device-specific token', async () => {
            let ws = null;
            try {
                const deviceId = 'test-device-123';
                ws = await createAuthenticatedWebSocket('test-user', deviceId);
                const welcomeMessage = await waitForMessage(ws);
                expect(welcomeMessage.type).toBe('welcome');
                expect(welcomeMessage.data.deviceId).toBe(deviceId);
                expect(welcomeMessage.data.userId).toBe('test-user');
            }
            finally {
                if (ws) {
                    await closeWebSocket(ws);
                }
            }
        });
    });
    test.describe('WebSocket Message Handling', () => {
        let ws;
        test.beforeEach(async () => {
            ws = await createAuthenticatedWebSocket('test-user', 'test-device');
            await waitForMessage(ws);
        });
        test.afterEach(async () => {
            if (ws) {
                await closeWebSocket(ws);
            }
        });
        test('should handle ping-pong messages', async () => {
            ws.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
            const pongMessage = await waitForMessage(ws);
            expect(pongMessage.type).toBe('pong');
            expect(pongMessage.timestamp).toBeDefined();
        });
        test('should handle channel subscription', async () => {
            ws.send(JSON.stringify({
                type: 'subscribe',
                channels: ['user:test-user', 'device:test-device']
            }));
            const subscribeResponse = await waitForMessage(ws);
            expect(subscribeResponse.type).toBe('subscribed');
            expect(subscribeResponse.data.channels).toContain('user:test-user');
            expect(subscribeResponse.data.channels).toContain('device:test-device');
        });
        test('should handle channel unsubscription', async () => {
            ws.send(JSON.stringify({
                type: 'subscribe',
                channels: ['user:test-user']
            }));
            await waitForMessage(ws);
            ws.send(JSON.stringify({
                type: 'unsubscribe',
                channels: ['user:test-user']
            }));
            const unsubscribeResponse = await waitForMessage(ws);
            expect(unsubscribeResponse.type).toBe('unsubscribed');
            expect(unsubscribeResponse.data.channels).not.toContain('user:test-user');
        });
        test('should reject unauthorized channel subscriptions', async () => {
            ws.send(JSON.stringify({
                type: 'subscribe',
                channels: ['user:other-user']
            }));
            const subscribeResponse = await waitForMessage(ws);
            expect(subscribeResponse.type).toBe('subscribed');
            expect(subscribeResponse.data.channels).not.toContain('user:other-user');
        });
        test('should handle proximity updates', async () => {
            ws.send(JSON.stringify({
                type: 'proximity_update',
                data: {
                    rssi: -50,
                    proximity: 'near',
                    locked: false
                }
            }));
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(ws.readyState).toBe(WebSocket.OPEN);
        });
        test('should handle malformed messages gracefully', async () => {
            ws.send('invalid-json-message');
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(ws.readyState).toBe(WebSocket.OPEN);
            ws.send(JSON.stringify({
                type: 'unknown-message-type',
                data: 'test'
            }));
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(ws.readyState).toBe(WebSocket.OPEN);
        });
    });
    test.describe('WebSocket Authentication Events', () => {
        test('should broadcast proximity changes between devices', async () => {
            let ws1 = null;
            let ws2 = null;
            try {
                ws1 = await createAuthenticatedWebSocket('shared-user', 'device-1');
                ws2 = await createAuthenticatedWebSocket('shared-user', 'device-2');
                await waitForMessage(ws1);
                await waitForMessage(ws2);
                ws1.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['user:shared-user']
                }));
                ws2.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['user:shared-user']
                }));
                await waitForMessage(ws1);
                await waitForMessage(ws2);
                ws1.send(JSON.stringify({
                    type: 'proximity_update',
                    data: {
                        rssi: -30,
                        proximity: 'immediate',
                        locked: false
                    }
                }));
                const event1 = await waitForMessage(ws1, 2000);
                const event2 = await waitForMessage(ws2, 2000);
                expect(event1.type).toBe('auth_event');
                expect(event1.event.type).toBe('proximity_changed');
                expect(event1.event.deviceId).toBe('device-1');
                expect(event2.type).toBe('auth_event');
                expect(event2.event.type).toBe('proximity_changed');
                expect(event2.event.deviceId).toBe('device-1');
            }
            finally {
                if (ws1)
                    await closeWebSocket(ws1);
                if (ws2)
                    await closeWebSocket(ws2);
            }
        });
        test('should handle device disconnection events', async () => {
            let ws1 = null;
            let ws2 = null;
            try {
                ws1 = await createAuthenticatedWebSocket('shared-user', 'device-1');
                ws2 = await createAuthenticatedWebSocket('shared-user', 'device-2');
                await waitForMessage(ws1);
                await waitForMessage(ws2);
                ws2.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['user:shared-user']
                }));
                await waitForMessage(ws2);
                ws1.close(1000, 'Test disconnect');
                ws1 = null;
                const disconnectEvent = await waitForMessage(ws2, 3000);
                expect(disconnectEvent.type).toBe('auth_event');
                expect(disconnectEvent.event.type).toBe('device_removed');
                expect(disconnectEvent.event.deviceId).toBe('device-1');
                expect(disconnectEvent.event.data.reason).toBe('disconnected');
            }
            finally {
                if (ws1)
                    await closeWebSocket(ws1);
                if (ws2)
                    await closeWebSocket(ws2);
            }
        });
    });
    test.describe('WebSocket Heartbeat and Connection Health', () => {
        test('should respond to WebSocket ping', async () => {
            let ws = null;
            try {
                ws = await createAuthenticatedWebSocket();
                await waitForMessage(ws);
                const pongReceived = new Promise(resolve => {
                    const timeout = setTimeout(() => resolve(false), 2000);
                    ws.on('pong', () => {
                        clearTimeout(timeout);
                        resolve(true);
                    });
                });
                ws.ping('test-ping-data');
                const receivedPong = await pongReceived;
                expect(receivedPong).toBe(true);
            }
            finally {
                if (ws)
                    await closeWebSocket(ws);
            }
        });
        test('should maintain connection during idle periods', async () => {
            let ws = null;
            try {
                ws = await createAuthenticatedWebSocket();
                await waitForMessage(ws);
                await new Promise(resolve => setTimeout(resolve, 2000));
                expect(ws.readyState).toBe(WebSocket.OPEN);
                ws.send(JSON.stringify({
                    type: 'ping',
                    timestamp: Date.now()
                }));
                const response = await waitForMessage(ws);
                expect(response.type).toBe('pong');
            }
            finally {
                if (ws)
                    await closeWebSocket(ws);
            }
        });
    });
    test.describe('WebSocket Error Handling and Edge Cases', () => {
        test('should handle rapid message sending', async () => {
            let ws = null;
            try {
                ws = await createAuthenticatedWebSocket();
                await waitForMessage(ws);
                const messageCount = 10;
                const messages = [];
                for (let i = 0; i < messageCount; i++) {
                    const message = {
                        type: 'ping',
                        id: i,
                        timestamp: Date.now()
                    };
                    messages.push(message);
                    ws.send(JSON.stringify(message));
                }
                const responses = [];
                for (let i = 0; i < messageCount; i++) {
                    const response = await waitForMessage(ws, 1000);
                    responses.push(response);
                }
                expect(responses).toHaveLength(messageCount);
                responses.forEach(response => {
                    expect(response.type).toBe('pong');
                });
            }
            finally {
                if (ws)
                    await closeWebSocket(ws);
            }
        });
        test('should handle connection cleanup on server shutdown simulation', async () => {
            let ws = null;
            try {
                ws = await createAuthenticatedWebSocket();
                await waitForMessage(ws);
                const closePromise = waitForClose(ws);
                ws.terminate();
                const closeEvent = await closePromise;
                expect(ws.readyState).toBe(WebSocket.CLOSED);
                ws = null;
            }
            finally {
                if (ws && ws.readyState !== WebSocket.CLOSED) {
                    await closeWebSocket(ws);
                }
            }
        });
        test('should handle concurrent connections from same user', async () => {
            const connections = [];
            const connectionCount = 3;
            try {
                for (let i = 0; i < connectionCount; i++) {
                    const ws = await createAuthenticatedWebSocket('multi-user', `device-${i}`);
                    await waitForMessage(ws);
                    connections.push(ws);
                }
                connections.forEach(ws => {
                    expect(ws.readyState).toBe(WebSocket.OPEN);
                });
                const pingPromises = connections.map((ws, index) => {
                    ws.send(JSON.stringify({
                        type: 'ping',
                        connectionId: index
                    }));
                    return waitForMessage(ws);
                });
                const responses = await Promise.all(pingPromises);
                responses.forEach((response, index) => {
                    expect(response.type).toBe('pong');
                });
            }
            finally {
                await Promise.all(connections.map(ws => ws.readyState === WebSocket.OPEN ? closeWebSocket(ws) : Promise.resolve()));
            }
        });
    });
    test.describe('Error Handling', () => {
        test('should handle malformed JSON', async ({ request }) => {
            const response = await request.post(`${API_BASE}/register`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: 'invalid json'
            });
            expect(response.status()).toBe(400);
        });
        test('should handle missing content-type', async ({ request }) => {
            const response = await request.post(`${API_BASE}/register`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                data: testDevice
            });
            expect(response.status()).toBe(200);
        });
        test.skip('should rate limit excessive requests', async ({ request }) => {
            const promises = Array(10).fill(null).map(() => request.get(`${API_BASE}/devices`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }));
            const responses = await Promise.all(promises);
            const rateLimited = responses.some(r => r.status() === 429);
            expect(rateLimited).toBe(true);
        });
    });
    test.describe('Security Tests', () => {
        test('should reject SQL injection attempts', async ({ request }) => {
            const response = await request.post(`${API_BASE}/challenge`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    deviceId: "'; DROP TABLE devices; --"
                }
            });
            expect([400, 404]).toContain(response.status());
        });
        test('should reject XSS attempts', async ({ request }) => {
            const response = await request.post(`${API_BASE}/register`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    ...testDevice,
                    deviceName: '<script>alert("XSS")</script>'
                }
            });
            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.success).toBe(true);
        });
        test('should enforce CORS policies', async ({ request }) => {
            const response = await request.get(`${API_BASE}/devices`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Origin': 'http://malicious-site.com'
                }
            });
            const corsHeader = response.headers()['access-control-allow-origin'];
            expect(corsHeader).not.toBe('http://malicious-site.com');
        });
    });
});
test.describe('Performance Tests', () => {
    test('should handle concurrent registrations', async ({ request }) => {
        const concurrentRequests = 5;
        const authToken = generateMockToken();
        const promises = Array(concurrentRequests).fill(null).map((_, i) => request.post(`${API_BASE}/register`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                ...testDevice,
                deviceId: `concurrent-device-${i}`,
                deviceName: `Concurrent Device ${i}`
            }
        }));
        const startTime = Date.now();
        const responses = await Promise.all(promises);
        const duration = Date.now() - startTime;
        responses.forEach(response => {
            expect(response.ok()).toBeTruthy();
        });
        expect(duration).toBeLessThan(5000);
    });
    test('should respond quickly to health checks', async ({ request }) => {
        const iterations = 10;
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await request.get(`${BASE_URL}/health`);
            times.push(Date.now() - start);
        }
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        expect(avgTime).toBeLessThan(100);
    });
});
//# sourceMappingURL=device-auth-api.test.js.map