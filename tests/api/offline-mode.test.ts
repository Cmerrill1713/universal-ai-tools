import request from 'supertest';

import UniversalAIToolsServer from '../../src/server';

describe('Offline mode API behavior', () => {
  let server: UniversalAIToolsServer;
  let app: any;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.OFFLINE_MODE = 'true';
    process.env.DISABLE_EXTERNAL_CALLS = 'true';
    server = new UniversalAIToolsServer();
    await server.start();
    app = server.getApp();
  });

  afterAll(async () => {
    try {
      await (server as any)?.testShutdown?.();
    } catch {}
    process.env = originalEnv;
  });

  it('exposes offline flags in /api/v1/status', async () => {
    const res = await request(app).get('/api/v1/status');
    expect(res.status).toBe(200);
    expect(res.body?.data?.mode?.offline).toBe(true);
    expect(res.body?.data?.mode?.disableExternalCalls).toBe(true);
  });

  it('skips external routes: /api/v1/huggingface', async () => {
    const res = await request(app).get('/api/v1/huggingface');
    // Router not mounted; expect 404
    expect([404, 503]).toContain(res.status);
  });

  it('skips external routes: /api/v1/knowledge-ingestion', async () => {
    const res = await request(app).get('/api/v1/knowledge-ingestion');
    expect([404, 503]).toContain(res.status);
  });

  it('skips external routes: /api/v1/knowledge', async () => {
    const res = await request(app).get('/api/v1/knowledge');
    expect([404, 503]).toContain(res.status);
  });
});
