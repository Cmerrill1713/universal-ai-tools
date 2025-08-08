/**
 * Autonomous Action Rollback Tests
 *
 * Tests the autonomous action rollback service functionality
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { autonomousActionRollbackService } from '../../src/services/autonomous-action-rollback-service';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

describe('Autonomous Action Rollback Mechanisms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Performance Degradation Detection', () => {
    it('should not trigger rollback when performance improves', async () => {
      const actionId = 'test-action-123';
      const baselineMetrics = { accuracy: 0.8, latency: 1000 };
      const currentMetrics = { accuracy: 0.9, latency: 800 };

      // Set baseline
      await autonomousActionRollbackService.setBaseline(actionId, baselineMetrics);

      // Add rollback triggers
      await autonomousActionRollbackService.addRollbackTriggers(actionId, [
        { actionId, metric: 'accuracy', threshold: 0.7, operator: 'lt' },
        { actionId, metric: 'latency', threshold: 1500, operator: 'gt' },
      ]);

      // Check if rollback is needed (should not be needed since performance improved)
      const rollbackTrigger = await autonomousActionRollbackService.checkRollbackNeeded(
        actionId,
        currentMetrics
      );

      expect(rollbackTrigger).toBeNull();
    });

    it('should trigger rollback when performance degrades', async () => {
      const actionId = 'test-action-456';
      const baselineMetrics = { accuracy: 0.8, latency: 1000 };
      const currentMetrics = { accuracy: 0.6, latency: 1500 };

      // Set baseline
      await autonomousActionRollbackService.setBaseline(actionId, baselineMetrics);

      // Add rollback triggers
      await autonomousActionRollbackService.addRollbackTriggers(actionId, [
        { actionId, metric: 'accuracy', threshold: 0.7, operator: 'lt' },
        { actionId, metric: 'latency', threshold: 1500, operator: 'gt' },
      ]);

      // Check if rollback is needed (should be needed since performance degraded)
      const rollbackTrigger = await autonomousActionRollbackService.checkRollbackNeeded(
        actionId,
        currentMetrics
      );

      expect(rollbackTrigger).not.toBeNull();
      expect(rollbackTrigger?.metric).toBe('accuracy');
      expect(rollbackTrigger?.triggered).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing baseline metrics gracefully', async () => {
      const actionId = 'test-action-789';
      const currentMetrics = { accuracy: 0.6, latency: 1500 };

      // Don't set baseline, just check rollback
      const rollbackTrigger = await autonomousActionRollbackService.checkRollbackNeeded(
        actionId,
        currentMetrics
      );

      expect(rollbackTrigger).toBeNull();
    });

    it('should execute rollback successfully', async () => {
      const actionId = 'test-action-rollback';
      const baselineMetrics = { accuracy: 0.8, latency: 1000 };

      // Set baseline
      await autonomousActionRollbackService.setBaseline(actionId, baselineMetrics);

      // Execute rollback
      const rollbackResult = await autonomousActionRollbackService.executeRollback(
        actionId,
        'Performance degradation detected'
      );

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.actionId).toBe(actionId);
      expect(rollbackResult.reason).toBe('Performance degradation detected');
      expect(rollbackResult.metricsBefore).toEqual(baselineMetrics);
      expect(rollbackResult.metricsAfter).toEqual(baselineMetrics);
      expect(rollbackResult.duration).toBeGreaterThan(0);
    });

    it('should handle rollback failures gracefully', async () => {
      const actionId = 'test-action-failure';

      // Try to rollback without setting baseline
      try {
        await autonomousActionRollbackService.executeRollback(actionId, 'Test failure');
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('No baseline found for action');
      }
    });
  });

  describe('Service Status and History', () => {
    it('should return service status', async () => {
      const status = await autonomousActionRollbackService.getStatus();

      expect(status).toBeDefined();
      expect(typeof status.activeRollbacks).toBe('number');
      expect(typeof status.totalBaselines).toBe('number');
      expect(typeof status.totalTriggers).toBe('number');
    });

    it('should return rollback history', async () => {
      const actionId = 'test-action-history';
      const baselineMetrics = { accuracy: 0.8, latency: 1000 };

      // Set baseline and execute rollback
      await autonomousActionRollbackService.setBaseline(actionId, baselineMetrics);
      await autonomousActionRollbackService.executeRollback(actionId, 'Test rollback');

      // Get history
      const history = await autonomousActionRollbackService.getRollbackHistory(actionId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].actionId).toBe(actionId);
    });
  });
});
