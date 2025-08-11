import request from 'supertest';

import UniversalAIToolsServer from '../../src/server';

describe('Auth Enforcement', () => {
  let server: UniversalAIToolsServer;
  let app: any;

  beforeAll(async () => {
    server = new UniversalAIToolsServer();
    // Wait for server initialization
    await server.start();
    app = server.getApp();
  });

  afterAll(async () => {
    // Clean up
    if (server) {
      await server.testShutdown();
    }
  });

  test('POST /api/v1/chat requires auth', async () => {
    const res = await request(app).post('/api/v1/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
    expect(res.body?.success).toBe(false);
  });

  test('POST /api/v1/assistant/chat requires auth', async () => {
    const res = await request(app).post('/api/v1/assistant/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
    expect(res.body?.success).toBe(false);
  });
});
