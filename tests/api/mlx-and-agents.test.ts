import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import UniversalAIToolsServer from '@/server';

let server: UniversalAIToolsServer;
let app: any;

describe('MLX Health and Agents API', () => {
  beforeAll(async () => {
    // Start server in test mode on a random port
    server = new UniversalAIToolsServer();
    await server.start(0);
    app = server.getApp();
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.testShutdown();
    }
  });

  describe('MLX Health', () => {
    it('returns 200 healthy when MLX is ready or 200 degraded when initializing', async () => {
      const res = await request(app).get('/api/v1/mlx/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      // success true when healthy path, degraded true when init path
      if (res.body.degraded) {
        expect(res.body.success).toBe(true);
      } else {
        expect(res.body.success).toBe(true);
      }
    });
  });

  describe('Agents list', () => {
    it('returns 200 with array even if registry not initialized', async () => {
      const res = await request(app).get('/api/v1/agents');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.agents)).toBe(true);
    });

    it('exposes registry info without error', async () => {
      const res = await request(app).get('/api/v1/agents/registry');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
    });
  });
});
