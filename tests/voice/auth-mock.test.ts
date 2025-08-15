/**
 * Simple test to verify authentication mocking works for voice performance tests
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user', email: 'test@example.com' };
    next();
  }),
}));

describe('Authentication Mock Test', () => {
  it('should allow requests with mocked authentication', async () => {
    const app = express();
    app.use(express.json());
    
    // Import auth after mocking
    const { authenticate } = require('../../src/middleware/auth');
    
    // Create a simple protected route
    app.post('/test', authenticate, (req, res) => {
      res.json({
        success: true,
        user: req.user,
        message: 'Authentication successful'
      });
    });

    const response = await request(app)
      .post('/test')
      .send({ data: 'test' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.id).toBe('test-user');
    expect(response.body.message).toBe('Authentication successful');
  });
});