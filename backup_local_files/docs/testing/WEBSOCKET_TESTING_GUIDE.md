# WebSocket Testing Guide for Device Authentication
This guide provides comprehensive patterns and best practices for testing the device authentication WebSocket endpoint (`ws://localhost:8080/ws/device-auth`) using Playwright.
## Table of Contents

1. [Overview](#overview)

2. [Test Setup](#test-setup)

3. [WebSocket Test Helper Class](#websocket-test-helper-class)

4. [Testing Authentication Flows](#testing-authentication-flows)

5. [Mocking WebSocket Connections](#mocking-websocket-connections)

6. [Testing Real-Time Features](#testing-real-time-features)

7. [Error Handling and Edge Cases](#error-handling-and-edge-cases)

8. [Best Practices](#best-practices)
## Overview
The device authentication WebSocket endpoint handles:

- Device registration/removal notifications

- Authentication state change broadcasts

- Proximity-based lock/unlock events

- Auto-disconnect detection with cleanup

- Heartbeat monitoring for connection health
## Test Setup
### Prerequisites
```bash

npm install -D @playwright/test @types/ws

```
### Base Test Configuration
```typescript

// tests/websocket/websocket.config.ts

import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {

  use: {

    baseURL: 'http://localhost:3000',

    trace: 'on-first-retry',

  },

  webServer: {

    command: 'npm run dev',

    port: 3000,

    reuseExistingServer: !process.env.CI,

  },

};
export default config;

```
## WebSocket Test Helper Class
Create a reusable helper class for WebSocket testing:
```typescript

// tests/websocket/DeviceAuthWebSocketTester.ts

import { Page, WebSocket } from '@playwright/test';
interface WebSocketMessage {

  type: string;

  [key: string]: any;

}
export class DeviceAuthWebSocketTester {

  private page: Page;

  private ws: WebSocket | null = null;

  private messages: WebSocketMessage[] = [];

  private errors: Error[] = [];

  private connectionPromise: Promise<void> | null = null;
  constructor(page: Page) {

    this.page = page;

  }
  async connect(url: string = 'ws://localhost:8080/ws/device-auth'): Promise<void> {

    // Set up WebSocket event listener before connection

    const wsPromise = this.page.waitForEvent('websocket', {

      predicate: ws => ws.url() === url

    });
    // Inject WebSocket connection in the browser

    await this.page.evaluate((wsUrl) => {

      window.deviceWs = new WebSocket(wsUrl);

      

      // Add event listeners in browser context

      window.deviceWs.onopen = () => {

        console.log('WebSocket connected');

      };

      

      window.deviceWs.onerror = (error) => {

        console.error('WebSocket error:', error);

      };

      

      window.deviceWs.onclose = (event) => {

        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);

      };

    }, url);
    this.ws = await wsPromise;

    this.setupEventListeners();

    

    // Wait for connection to be established

    await this.waitForOpen();

  }
  private setupEventListeners(): void {

    if (!this.ws) return;
    // Capture all received messages

    this.ws.on('framereceived', (event) => {

      try {

        const message = JSON.parse(event.payload.toString());

        this.messages.push(message);

        console.log('Received:', message);

      } catch (error) {

        console.error('Failed to parse message:', event.payload);

      }

    });
    // Capture sent messages for debugging

    this.ws.on('framesent', (event) => {

      console.log('Sent:', event.payload);

    });
    // Handle errors

    this.ws.on('error', (error) => {

      this.errors.push(new Error(error));

    });
    this.ws.on('close', () => {

      console.log('WebSocket connection closed');

    });

  }
  private async waitForOpen(timeout: number = 5000): Promise<void> {

    const startTime = Date.now();

    

    while (Date.now() - startTime < timeout) {

      const isOpen = await this.page.evaluate(() => {

        return window.deviceWs && window.deviceWs.readyState === WebSocket.OPEN;

      });

      

      if (isOpen) return;

      await this.page.waitForTimeout(100);

    }

    

    throw new Error('WebSocket connection timeout');

  }
  async sendMessage(message: WebSocketMessage): Promise<void> {

    await this.page.evaluate((msg) => {

      if (window.deviceWs && window.deviceWs.readyState === WebSocket.OPEN) {

        window.deviceWs.send(JSON.stringify(msg));

      } else {

        throw new Error('WebSocket is not connected');

      }

    }, message);

  }
  async waitForMessage(

    predicate: (msg: WebSocketMessage) => boolean,

    timeout: number = 5000

  ): Promise<WebSocketMessage | null> {

    const startTime = Date.now();

    

    while (Date.now() - startTime < timeout) {

      const message = this.messages.find(predicate);

      if (message) return message;

      await this.page.waitForTimeout(100);

    }

    

    return null;

  }
  async waitForMessageType(type: string, timeout?: number): Promise<WebSocketMessage | null> {

    return this.waitForMessage(msg => msg.type === type, timeout);

  }
  async authenticate(deviceId: string, token: string): Promise<boolean> {

    await this.sendMessage({

      type: 'device_auth',

      deviceId,

      token,

      timestamp: Date.now()

    });
    const response = await this.waitForMessageType('auth_response', 5000);

    return response?.status === 'authenticated';

  }
  async registerDevice(deviceInfo: {

    deviceId: string;

    deviceType: string;

    capabilities: string[];

  }): Promise<boolean> {

    await this.sendMessage({

      type: 'register_device',

      ...deviceInfo,

      timestamp: Date.now()

    });
    const response = await this.waitForMessageType('device_registered', 5000);

    return response?.success === true;

  }
  async updateProximity(distance: number, signalStrength?: number): Promise<void> {

    await this.sendMessage({

      type: 'proximity_update',

      distance,

      unit: 'meters',

      signalStrength: signalStrength || (-50 + (distance * 10)),

      timestamp: Date.now()

    });

  }
  async disconnect(): Promise<void> {

    await this.page.evaluate(() => {

      if (window.deviceWs && window.deviceWs.readyState === WebSocket.OPEN) {

        window.deviceWs.close(1000, 'Test completed');

      }

    });

  }
  getMessages(): WebSocketMessage[] {

    return [...this.messages];

  }
  getErrors(): Error[] {

    return [...this.errors];

  }
  clearMessages(): void {

    this.messages = [];

  }

}

```
## Testing Authentication Flows
### Basic Authentication Test
```typescript

// tests/websocket/device-auth.spec.ts

import { test, expect } from '@playwright/test';

import { DeviceAuthWebSocketTester } from './DeviceAuthWebSocketTester';
test.describe('Device Authentication WebSocket', () => {

  let tester: DeviceAuthWebSocketTester;
  test.beforeEach(async ({ page }) => {

    tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

  });
  test.afterEach(async () => {

    await tester.disconnect();

  });
  test('successful device authentication', async () => {

    await tester.connect();
    // Register device first

    const registered = await tester.registerDevice({

      deviceId: 'test-iphone-001',

      deviceType: 'iPhone',

      capabilities: ['bluetooth', 'proximity', 'biometric']

    });

    expect(registered).toBe(true);
    // Authenticate device

    const authenticated = await tester.authenticate('test-iphone-001', 'valid-token-123');

    expect(authenticated).toBe(true);
    // Verify authentication broadcast

    const broadcast = await tester.waitForMessageType('auth_state_broadcast', 2000);

    expect(broadcast).toMatchObject({

      type: 'auth_state_broadcast',

      deviceId: 'test-iphone-001',

      state: 'authenticated'

    });

  });
  test('authentication with invalid token', async () => {

    await tester.connect();
    const authenticated = await tester.authenticate('test-device', 'invalid-token');

    expect(authenticated).toBe(false);
    const errorMsg = await tester.waitForMessageType('auth_error', 2000);

    expect(errorMsg).toMatchObject({

      type: 'auth_error',

      reason: expect.stringContaining('Invalid')

    });

  });
  test('proximity-based authentication', async () => {

    await tester.connect();

    

    // Register and authenticate device

    await tester.registerDevice({

      deviceId: 'apple-watch-001',

      deviceType: 'Apple Watch',

      capabilities: ['bluetooth', 'proximity']

    });

    

    await tester.authenticate('apple-watch-001', 'valid-token');
    // Test proximity updates

    const distances = [5.0, 3.0, 1.5, 0.5]; // meters

    

    for (const distance of distances) {

      await tester.updateProximity(distance);

      

      const proximityEvent = await tester.waitForMessage(

        msg => msg.type === 'proximity_state' && msg.distance === distance,

        2000

      );

      

      expect(proximityEvent).toBeTruthy();

      

      // Check if auto-unlock triggered at close proximity

      if (distance <= 1.0) {

        const unlockEvent = await tester.waitForMessageType('auto_unlock', 1000);

        expect(unlockEvent).toMatchObject({

          type: 'auto_unlock',

          deviceId: 'apple-watch-001',

          reason: 'proximity'

        });

      }

    }

  });

});

```
### Testing Heartbeat and Connection Health
```typescript

test.describe('Connection Health Monitoring', () => {

  test('heartbeat mechanism', async ({ page }) => {

    const tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

    await tester.connect();
    // Wait for initial heartbeat

    const heartbeat = await tester.waitForMessageType('heartbeat', 10000);

    expect(heartbeat).toBeTruthy();

    expect(heartbeat.timestamp).toBeGreaterThan(Date.now() - 10000);
    // Respond to heartbeat

    await tester.sendMessage({

      type: 'pong',

      timestamp: Date.now()

    });
    // Wait for acknowledgment

    const ack = await tester.waitForMessageType('heartbeat_ack', 2000);

    expect(ack).toBeTruthy();

  });
  test('auto-disconnect on missing heartbeat', async ({ page }) => {

    const tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

    await tester.connect();
    // Don't respond to heartbeats

    let heartbeatCount = 0;

    const startTime = Date.now();
    while (Date.now() - startTime < 30000) { // 30 second timeout

      const heartbeat = await tester.waitForMessageType('heartbeat', 10000);

      if (heartbeat) {

        heartbeatCount++;

        // Deliberately don't respond

      }
      // Check if disconnected after missing heartbeats

      const disconnectMsg = await tester.waitForMessageType('connection_timeout', 1000);

      if (disconnectMsg) {

        expect(heartbeatCount).toBeGreaterThanOrEqual(2); // At least 2 missed heartbeats

        break;

      }

    }

  });

});

```
## Mocking WebSocket Connections
### Using Playwright's WebSocket Route (v1.48+)
```typescript

test('mocked device authentication', async ({ page }) => {

  // Mock the WebSocket server

  await page.routeWebSocket('ws://localhost:8080/ws/device-auth', (ws) => {

    console.log('WebSocket route established');
    // Send initial connection message

    ws.send(JSON.stringify({

      type: 'connected',

      message: 'Mock device auth server connected',

      serverTime: Date.now()

    }));
    // Handle incoming messages

    ws.onMessage((message) => {

      const data = JSON.parse(message.toString());

      

      switch(data.type) {

        case 'register_device':

          ws.send(JSON.stringify({

            type: 'device_registered',

            success: true,

            deviceId: data.deviceId,

            sessionId: `session-${Date.now()}`

          }));

          break;
        case 'device_auth':

          // Simulate authentication logic

          const isValid = data.token === 'valid-token-123';

          ws.send(JSON.stringify({

            type: 'auth_response',

            status: isValid ? 'authenticated' : 'failed',

            deviceId: data.deviceId,

            ...(isValid && { sessionToken: `jwt-${Date.now()}` })

          }));

          

          // Broadcast authentication state

          if (isValid) {

            setTimeout(() => {

              ws.send(JSON.stringify({

                type: 'auth_state_broadcast',

                deviceId: data.deviceId,

                state: 'authenticated'

              }));

            }, 100);

          }

          break;
        case 'proximity_update':

          ws.send(JSON.stringify({

            type: 'proximity_state',

            distance: data.distance,

            timestamp: Date.now()

          }));

          

          // Trigger auto-unlock at close proximity

          if (data.distance <= 1.0) {

            ws.send(JSON.stringify({

              type: 'auto_unlock',

              deviceId: 'mock-device',

              reason: 'proximity'

            }));

          }

          break;
        case 'pong':

          ws.send(JSON.stringify({

            type: 'heartbeat_ack',

            latency: Date.now() - data.timestamp

          }));

          break;

      }

    });
    // Simulate heartbeat

    const heartbeatInterval = setInterval(() => {

      ws.send(JSON.stringify({

        type: 'heartbeat',

        timestamp: Date.now()

      }));

    }, 5000);
    ws.onClose(() => {

      clearInterval(heartbeatInterval);

    });

  });
  // Run tests with mocked WebSocket

  const tester = new DeviceAuthWebSocketTester(page);

  await page.goto('/');

  await tester.connect();
  const authenticated = await tester.authenticate('test-device', 'valid-token-123');

  expect(authenticated).toBe(true);

});

```
## Testing Real-Time Features
### Multi-Device Synchronization
```typescript

test('real-time state synchronization across devices', async ({ browser }) => {

  // Create two browser contexts to simulate different devices

  const context1 = await browser.newContext();

  const context2 = await browser.newContext();

  

  const page1 = await context1.newPage();

  const page2 = await context2.newPage();

  

  const tester1 = new DeviceAuthWebSocketTester(page1);

  const tester2 = new DeviceAuthWebSocketTester(page2);
  try {

    // Connect both devices

    await page1.goto('/');

    await page2.goto('/');

    

    await tester1.connect();

    await tester2.connect();
    // Register both devices

    await tester1.registerDevice({

      deviceId: 'iphone-001',

      deviceType: 'iPhone',

      capabilities: ['bluetooth', 'proximity']

    });
    await tester2.registerDevice({

      deviceId: 'macbook-001',

      deviceType: 'MacBook',

      capabilities: ['bluetooth']

    });
    // Authenticate iPhone

    await tester1.authenticate('iphone-001', 'token-123');
    // Verify MacBook receives authentication notification

    const notification = await tester2.waitForMessage(

      msg => msg.type === 'device_authenticated' && msg.deviceId === 'iphone-001',

      3000

    );

    

    expect(notification).toBeTruthy();

    expect(notification.deviceType).toBe('iPhone');
    // Test proximity-based unlock from iPhone to MacBook

    await tester1.updateProximity(0.5);
    const unlockNotification = await tester2.waitForMessage(

      msg => msg.type === 'proximity_unlock_available',

      2000

    );

    

    expect(unlockNotification).toMatchObject({

      type: 'proximity_unlock_available',

      fromDevice: 'iphone-001',

      toDevice: 'macbook-001'

    });

  } finally {

    await context1.close();

    await context2.close();

  }

});

```
### Testing Auto-Reconnection
```typescript

test('automatic reconnection with exponential backoff', async ({ page }) => {

  let reconnectAttempts = 0;

  let reconnectDelays: number[] = [];
  await page.exposeFunction('logReconnectAttempt', (delay: number) => {

    reconnectAttempts++;

    reconnectDelays.push(delay);

  });
  await page.goto('/');
  // Inject reconnection logic

  await page.evaluate(() => {

    let ws: WebSocket;

    let attemptCount = 0;

    

    function connect() {

      ws = new WebSocket('ws://localhost:8080/ws/device-auth');

      

      ws.onopen = () => {

        console.log('Connected');

        attemptCount = 0; // Reset on successful connection

      };

      

      ws.onclose = (event) => {

        if (event.code !== 1000) { // Not a normal closure

          attemptCount++;

          const delay = Math.min(1000 * Math.pow(2, attemptCount - 1), 30000);

          window.logReconnectAttempt(delay);

          

          setTimeout(connect, delay);

        }

      };

      

      ws.onerror = (error) => {

        console.error('WebSocket error:', error);

      };

    }

    

    connect();

    window.deviceWs = ws;

  });
  // Wait for initial connection

  await page.waitForTimeout(1000);
  // Force disconnect

  await page.evaluate(() => {

    window.deviceWs.close(1006, 'Abnormal closure');

  });
  // Wait for reconnection attempts

  await page.waitForTimeout(10000);
  // Verify exponential backoff

  expect(reconnectAttempts).toBeGreaterThan(0);

  expect(reconnectDelays[0]).toBe(1000); // First retry: 1s

  expect(reconnectDelays[1]).toBe(2000); // Second retry: 2s

  expect(reconnectDelays[2]).toBe(4000); // Third retry: 4s

});

```
## Error Handling and Edge Cases
### Network Failure Scenarios
```typescript

test.describe('Network Failure Handling', () => {

  test('handles network disconnection gracefully', async ({ page, context }) => {

    const tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

    await tester.connect();
    // Authenticate device

    await tester.authenticate('test-device', 'valid-token');
    // Simulate network disconnection

    await context.setOffline(true);

    

    // Wait for disconnect event

    await page.waitForTimeout(2000);
    // Verify disconnect handling

    const isConnected = await page.evaluate(() => {

      return window.deviceWs && window.deviceWs.readyState === WebSocket.OPEN;

    });

    expect(isConnected).toBe(false);
    // Restore network

    await context.setOffline(false);
    // Verify reconnection attempt

    await page.waitForTimeout(3000);

    

    // Check for reconnection

    const reconnected = await page.evaluate(() => {

      return window.deviceWs && window.deviceWs.readyState === WebSocket.OPEN;

    });

    expect(reconnected).toBe(true);

  });
  test('handles malformed messages', async ({ page }) => {

    const tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

    await tester.connect();
    // Send malformed message

    await page.evaluate(() => {

      window.deviceWs.send('{ invalid json }');

    });
    // Wait for error handling

    await page.waitForTimeout(1000);
    // Connection should remain open

    const isConnected = await page.evaluate(() => {

      return window.deviceWs.readyState === WebSocket.OPEN;

    });

    expect(isConnected).toBe(true);
    // Should receive error message

    const errorMsg = await tester.waitForMessageType('parse_error', 2000);

    expect(errorMsg).toBeTruthy();

  });

});

```
### Security Testing
```typescript

test.describe('Security Tests', () => {

  test('rejects connections without authentication', async ({ page }) => {

    const tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

    await tester.connect();
    // Try to send privileged command without authentication

    await tester.sendMessage({

      type: 'admin_command',

      action: 'list_all_devices'

    });
    const errorMsg = await tester.waitForMessageType('unauthorized', 2000);

    expect(errorMsg).toMatchObject({

      type: 'unauthorized',

      reason: 'Authentication required'

    });

  });
  test('rate limiting on authentication attempts', async ({ page }) => {

    const tester = new DeviceAuthWebSocketTester(page);

    await page.goto('/');

    await tester.connect();
    const attempts = 10;

    const results: boolean[] = [];
    // Rapid authentication attempts

    for (let i = 0; i < attempts; i++) {

      const authenticated = await tester.authenticate(

        'test-device',

        `invalid-token-${i}`

      );

      results.push(authenticated);

    }
    // Should be rate limited after several attempts

    const rateLimitMsg = await tester.waitForMessageType('rate_limit_exceeded', 2000);

    expect(rateLimitMsg).toBeTruthy();

    expect(rateLimitMsg.retryAfter).toBeGreaterThan(0);

  });

});

```
## Best Practices
### 1. Test Isolation
Always clean up WebSocket connections after each test:
```typescript

test.afterEach(async ({ page }) => {

  // Close WebSocket connection

  await page.evaluate(() => {

    if (window.deviceWs && window.deviceWs.readyState === WebSocket.OPEN) {

      window.deviceWs.close(1000, 'Test cleanup');

    }

  });

  

  // Wait for closure

  await page.waitForTimeout(500);

});

```
### 2. Debugging WebSocket Tests
Enable verbose logging for debugging:
```typescript

test.use({

  // Capture console logs

  launchOptions: {

    args: ['--enable-logging=stderr'],

  },

});
test.beforeEach(async ({ page }) => {

  // Log all console messages

  page.on('console', msg => {

    console.log(`Browser log: ${msg.type()}: ${msg.text()}`);

  });
  // Log WebSocket frames

  page.on('websocket', ws => {

    console.log(`WebSocket created: ${ws.url()}`);

    ws.on('framesent', event => console.log('>>>', event.payload));

    ws.on('framereceived', event => console.log('<<<', event.payload));

  });

});

```
### 3. Timeout Management
Use appropriate timeouts for different operations:
```typescript

const TIMEOUTS = {

  CONNECTION: 5000,      // Initial connection

  AUTH_RESPONSE: 3000,   // Authentication response

  HEARTBEAT: 10000,      // Heartbeat interval

  BROADCAST: 2000,       // State broadcasts

  CLEANUP: 1000,         // Connection cleanup

};

```
### 4. Message Type Safety
Use TypeScript enums for message types:
```typescript

enum MessageType {

  // Authentication

  DEVICE_AUTH = 'device_auth',

  AUTH_RESPONSE = 'auth_response',

  AUTH_ERROR = 'auth_error',

  

  // Device Management

  REGISTER_DEVICE = 'register_device',

  DEVICE_REGISTERED = 'device_registered',

  REMOVE_DEVICE = 'remove_device',

  

  // Proximity

  PROXIMITY_UPDATE = 'proximity_update',

  PROXIMITY_STATE = 'proximity_state',

  AUTO_UNLOCK = 'auto_unlock',

  

  // Connection

  HEARTBEAT = 'heartbeat',

  PONG = 'pong',

  CONNECTED = 'connected',

  DISCONNECTED = 'disconnected',

}

```
### 5. Flaky Test Prevention
Implement retry logic for unreliable operations:
```typescript

async function withRetry<T>(

  operation: () => Promise<T>,

  maxAttempts: number = 3,

  delay: number = 1000

): Promise<T> {

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {

    try {

      return await operation();

    } catch (error) {

      if (attempt === maxAttempts) throw error;

      await new Promise(resolve => setTimeout(resolve, delay));

    }

  }

  throw new Error('Max retry attempts reached');

}
// Usage

test('connection with retry', async ({ page }) => {

  const tester = new DeviceAuthWebSocketTester(page);

  await page.goto('/');

  

  await withRetry(async () => {

    await tester.connect();

  });

});

```
### 6. Performance Testing
Monitor WebSocket performance metrics:
```typescript

test('websocket performance metrics', async ({ page }) => {

  const metrics = {

    messagesSent: 0,

    messagesReceived: 0,

    totalLatency: 0,

    maxLatency: 0,

  };
  await page.exposeFunction('recordMetric', (type: string, value: number) => {

    if (type === 'latency') {

      metrics.totalLatency += value;

      metrics.maxLatency = Math.max(metrics.maxLatency, value);

    }

  });
  await page.goto('/');

  

  await page.evaluate(() => {

    const ws = new WebSocket('ws://localhost:8080/ws/device-auth');

    let messageTimestamps = new Map();

    

    ws.onmessage = (event) => {

      const data = JSON.parse(event.data);

      

      if (data.responseId && messageTimestamps.has(data.responseId)) {

        const latency = Date.now() - messageTimestamps.get(data.responseId);

        window.recordMetric('latency', latency);

        messageTimestamps.delete(data.responseId);

      }

    };

    

    // Send test messages

    setInterval(() => {

      const id = `msg-${Date.now()}`;

      messageTimestamps.set(id, Date.now());

      ws.send(JSON.stringify({ type: 'ping', id }));

    }, 100);

  });
  await page.waitForTimeout(5000);
  // Assert performance metrics

  expect(metrics.maxLatency).toBeLessThan(100); // Max 100ms latency

  const avgLatency = metrics.totalLatency / metrics.messagesReceived;

  expect(avgLatency).toBeLessThan(50); // Average under 50ms

});

```
## Conclusion
This guide provides comprehensive patterns for testing WebSocket connections in Playwright. Key takeaways:
1. Use a dedicated test helper class for WebSocket operations

2. Mock WebSocket servers for isolated testing

3. Test real-time features with multiple browser contexts

4. Handle errors and edge cases gracefully

5. Follow best practices for reliable, maintainable tests
Remember to adapt these patterns to your specific use case and requirements.