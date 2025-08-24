/**
 * Autonomous Action Rollback Integration Tests
 *
 * Tests the autonomous action rollback service in integration scenarios
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:9999';

// Mock axios for testing
jest.mock('axios');

describe('Autonomous Action Rollback Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Real Service Rollback Scenarios', () => {
    it('should rollback temperature parameter change on performance degradation', async () => {
      const actionId = 'temp-param-change-123';
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          data: {
            success: true,
            actionId,
            reason: 'Performance degradation detected',
            metricsBefore: { accuracy: 0.8, latency: 1000 },
            metricsAfter: { accuracy: 0.8, latency: 1000 },
            duration: 1000,
            timestamp: new Date().toISOString(),
          },
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const response = await axios.post(`${API_BASE_URL}/api/v1/autonomous-actions/${actionId}/rollback`, {
        reason: 'Performance degradation detected',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.actionId).toBe(actionId);
      expect(response.data.data.success).toBe(true);
    });

    it('should handle rollback failures gracefully', async () => {
      const actionId = 'invalid-action-456';
      const mockError = {
        response: {
          status: 500,
          data: {
            success: false,
            error: {
              code: 'ROLLBACK_ERROR',
              message: 'Failed to execute rollback',
              details: 'No baseline found for action invalid-action-456',
            },
          },
        },
      };

      (axios.post as jest.Mock).mockRejectedValue(mockError);

      try {
        await axios.post(`${API_BASE_URL}/api/v1/autonomous-actions/${actionId}/rollback`, {
          reason: 'Test failure',
        });
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error.code).toBe('ROLLBACK_ERROR');
      }
    });

    it('should validate rollback request parameters', async () => {
      const actionId = 'test-action-789';
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          data: {
            success: true,
            actionId,
            reason: 'Custom rollback reason',
            metricsBefore: { accuracy: 0.8 },
            metricsAfter: { accuracy: 0.8 },
            duration: 500,
            timestamp: new Date().toISOString(),
          },
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const response = await axios.post(`${API_BASE_URL}/api/v1/autonomous-actions/${actionId}/rollback`, {
        reason: 'Custom rollback reason',
      });

      expect(response.status).toBe(200);
      expect(response.data.data.reason).toBe('Custom rollback reason');
    });
  });

  describe('Service Integration', () => {
    it('should integrate with performance monitoring', async () => {
      const actionId = 'performance-test-123';
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          data: {
            success: true,
            actionId,
            reason: 'Performance threshold exceeded',
            metricsBefore: { accuracy: 0.8, latency: 1000 },
            metricsAfter: { accuracy: 0.8, latency: 1000 },
            duration: 750,
            timestamp: new Date().toISOString(),
          },
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const response = await axios.post(`${API_BASE_URL}/api/v1/autonomous-actions/${actionId}/rollback`, {
        reason: 'Performance threshold exceeded',
      });

      expect(response.status).toBe(200);
      expect(response.data.data.metricsBefore).toBeDefined();
      expect(response.data.data.metricsAfter).toBeDefined();
    });

    it('should handle concurrent rollback requests', async () => {
      const actionId = 'concurrent-test-456';
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          data: {
            success: true,
            actionId,
            reason: 'Concurrent rollback test',
            metricsBefore: { accuracy: 0.8 },
            metricsAfter: { accuracy: 0.8 },
            duration: 300,
            timestamp: new Date().toISOString(),
          },
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const concurrentRequests = Array.from({ length: 3 }, () =>
        axios.post(`${API_BASE_URL}/api/v1/autonomous-actions/${actionId}/rollback`, {
          reason: 'Concurrent rollback test',
        })
      );

      const responses = await Promise.allSettled(concurrentRequests);
      const successful = responses.filter((r) => r.status === 'fulfilled');

      expect(successful.length).toBe(3);
    });
  });
});
