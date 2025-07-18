/**
 * Tests for Task-Aware Temperature Controller
 */

import { TemperatureController } from '../../services/temperature_controller';

// Mock dependencies
jest.mock('../../utils/logger');

// Track mock function calls
const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn();

// Configure mock behavior
mockFrom.mockReturnValue({
  select: mockSelect,
  upsert: mockUpsert
});

mockSelect.mockResolvedValue({ data: [], error: null });
mockUpsert.mockResolvedValue({ error: null });

jest.mock('../../services/supabase_service', () => ({
  SupabaseService: {
    getInstance: () => ({
      client: {
        from: mockFrom
      }
    })
  }
}));

describe('TemperatureController', () => {
  let temperatureController: TemperatureController;
  let originalRandom: () => number;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Save original Math.random
    originalRandom = Math.random;
    // Mock Math.random to disable A/B testing by default
    Math.random = () => 0.5; // Greater than 0.1 sample rate
    // Reset singleton instance
    (TemperatureController as any).instance = undefined;
    temperatureController = TemperatureController.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original Math.random
    Math.random = originalRandom;
  });

  describe('Task-Specific Temperature Profiles', () => {
    it('should return correct temperature ranges for different task types', async () => {
      const testCases = [
        { task: 'creative_writing', minTemp: 0.7, maxTemp: 1.0, defaultTemp: 0.85 },
        { task: 'code_generation', minTemp: 0.0, maxTemp: 0.3, defaultTemp: 0.1 },
        { task: 'factual_qa', minTemp: 0.0, maxTemp: 0.2, defaultTemp: 0.1 },
        { task: 'brainstorming', minTemp: 0.6, maxTemp: 0.9, defaultTemp: 0.75 },
        { task: 'analysis', minTemp: 0.2, maxTemp: 0.4, defaultTemp: 0.3 }
      ];

      for (const { task, minTemp, maxTemp, defaultTemp } of testCases) {
        const params = await temperatureController.getOptimalParams(task);
        expect(params.temperature).toBeGreaterThanOrEqual(minTemp);
        expect(params.temperature).toBeLessThanOrEqual(maxTemp);
        expect(params.temperature).toBeCloseTo(defaultTemp, 1);
      }
    });

    it('should handle unknown task types with general profile', async () => {
      const params = await temperatureController.getOptimalParams('unknown_task');
      expect(params.temperature).toBeGreaterThanOrEqual(0.3);
      expect(params.temperature).toBeLessThanOrEqual(0.7);
    });
  });

  describe('Context-Based Adjustments', () => {
    it('should adjust temperature based on complexity', async () => {
      const baseParams = await temperatureController.getOptimalParams('analysis');
      const lowComplexity = await temperatureController.getOptimalParams('analysis', {
        complexity: 'low'
      });
      const highComplexity = await temperatureController.getOptimalParams('analysis', {
        complexity: 'high'
      });

      // For analysis tasks, low complexity reduces temperature, high complexity increases it
      expect(lowComplexity.temperature).toBeLessThan(baseParams.temperature);
      expect(highComplexity.temperature).toBeGreaterThan(baseParams.temperature);
    });

    it('should respect user preferences within bounds', async () => {
      const params = await temperatureController.getOptimalParams('code_generation', {
        userPreference: 0.5
      });

      // Should clamp to max allowed for code generation (0.3)
      expect(params.temperature).toBeLessThanOrEqual(0.3);
    });

    it('should increase temperature for retry attempts', async () => {
      const firstAttempt = await temperatureController.getOptimalParams('general');
      const secondAttempt = await temperatureController.getOptimalParams('general', {
        previousAttempts: 1
      });
      const thirdAttempt = await temperatureController.getOptimalParams('general', {
        previousAttempts: 2
      });

      expect(secondAttempt.temperature).toBeGreaterThan(firstAttempt.temperature);
      expect(thirdAttempt.temperature).toBeGreaterThan(secondAttempt.temperature);
    });

    it('should adjust for quality requirements', async () => {
      const speed = await temperatureController.getOptimalParams('general', {
        qualityRequirement: 'speed'
      });
      const balanced = await temperatureController.getOptimalParams('general', {
        qualityRequirement: 'balanced'
      });
      const quality = await temperatureController.getOptimalParams('general', {
        qualityRequirement: 'quality'
      });

      expect(speed.temperature).toBeLessThan(balanced.temperature);
      expect(quality.temperature).toBeGreaterThan(balanced.temperature);
    });
  });

  describe('Complementary Parameters', () => {
    it('should calculate appropriate complementary parameters', async () => {
      const creativeParams = await temperatureController.getOptimalParams('creative_writing');
      const codeParams = await temperatureController.getOptimalParams('code_generation');

      // Creative writing should have higher top-k and repetition penalty
      expect(creativeParams.topK).toBeGreaterThan(codeParams.topK!);
      expect(creativeParams.repetitionPenalty).toBeGreaterThan(codeParams.repetitionPenalty!);

      // Code generation should have no repetition penalty
      expect(codeParams.repetitionPenalty).toBe(1.0);

      // Both should have top-p values
      expect(creativeParams.topP).toBeDefined();
      expect(codeParams.topP).toBeDefined();
    });

    it('should set presence/frequency penalties for high temperatures', async () => {
      const highTempParams = await temperatureController.getOptimalParams('creative_writing');
      const lowTempParams = await temperatureController.getOptimalParams('code_generation');

      expect(highTempParams.presencePenalty).toBeDefined();
      expect(highTempParams.frequencyPenalty).toBeDefined();
      expect(lowTempParams.presencePenalty).toBeUndefined();
      expect(lowTempParams.frequencyPenalty).toBeUndefined();
    });
  });

  describe('Learning and Optimization', () => {
    it('should record results for future optimization', async () => {
      await temperatureController.recordResult('code_generation', 0.1, true, 0.9);
      await temperatureController.recordResult('code_generation', 0.2, false, 0.3);
      await temperatureController.recordResult('code_generation', 0.15, true, 0.95);

      // Get recommendations to see if learning was applied
      const recommendations = temperatureController.getRecommendations();
      const codeRec = recommendations.find(r => r.taskType === 'code_generation');

      expect(codeRec?.performance).toBeDefined();
      expect(codeRec?.performance?.successRate).toBeGreaterThan(0);
      expect(codeRec?.performance?.totalGenerations).toBe(3);
    });
  });

  describe('Recommendations', () => {
    it('should provide comprehensive recommendations for all task types', () => {
      const recommendations = temperatureController.getRecommendations();

      expect(recommendations.length).toBeGreaterThan(5);
      
      recommendations.forEach(rec => {
        expect(rec.taskType).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.recommended).toBeGreaterThan(0);
        expect(rec.range.min).toBeLessThanOrEqual(rec.range.max);
        expect(rec.recommended).toBeGreaterThanOrEqual(rec.range.min);
        expect(rec.recommended).toBeLessThanOrEqual(rec.range.max);
      });
    });

    it('should include learned temperatures when available', async () => {
      // Record multiple successful results
      for (let i = 0; i < 15; i++) {
        await temperatureController.recordResult('code_generation', 0.15, true, 0.9);
      }

      const recommendations = temperatureController.getRecommendations();
      const codeRec = recommendations.find(r => r.taskType === 'code_generation');

      expect(codeRec?.learned).toBeDefined();
      expect(codeRec?.learned).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown task types gracefully', async () => {
      const params = await temperatureController.getOptimalParams('completely_unknown_task');
      
      // Should default to general profile
      expect(params.temperature).toBeGreaterThanOrEqual(0.3);
      expect(params.temperature).toBeLessThanOrEqual(0.7);
    });

    it('should handle partial task type matches', async () => {
      const params1 = await temperatureController.getOptimalParams('code');
      const params2 = await temperatureController.getOptimalParams('creative');
      
      // Should match code_generation and creative_writing profiles respectively
      expect(params1.temperature).toBeLessThanOrEqual(0.3);
      expect(params2.temperature).toBeGreaterThanOrEqual(0.7);
    });

    it('should handle extreme user preferences', async () => {
      const params1 = await temperatureController.getOptimalParams('code_generation', {
        userPreference: 10.0  // Way too high
      });
      const params2 = await temperatureController.getOptimalParams('code_generation', {
        userPreference: -5.0  // Negative
      });

      // Should clamp to profile bounds
      expect(params1.temperature).toBe(0.3);  // Max for code_generation
      expect(params2.temperature).toBe(0.0);  // Min for code_generation
    });

    it('should handle excessive retry attempts', async () => {
      const params = await temperatureController.getOptimalParams('general', {
        previousAttempts: 100
      });

      // Should cap the adjustment
      const baseParams = await temperatureController.getOptimalParams('general');
      expect(params.temperature - baseParams.temperature).toBeLessThanOrEqual(0.1);
    });

    it('should handle null quality scores in recordResult', async () => {
      // Should not throw
      await expect(
        temperatureController.recordResult('general', 0.5, true)
      ).resolves.not.toThrow();
      
      await expect(
        temperatureController.recordResult('general', 0.5, false)
      ).resolves.not.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
      });

      // Should not throw when loading metrics fails
      const newController = TemperatureController.getInstance();
      expect(newController).toBeDefined();
    });
  });

  describe('A/B Testing', () => {
    it('should occasionally apply A/B test variations', async () => {
      // Mock Math.random to control A/B testing
      let randomValue = 0;
      Math.random = () => randomValue;

      // Force A/B test to be applied
      randomValue = 0.05; // Less than 0.1 sample rate
      const params1 = await temperatureController.getOptimalParams('general');

      // Force A/B test to not be applied
      randomValue = 0.15; // Greater than 0.1 sample rate
      const params2 = await temperatureController.getOptimalParams('general');

      // One should have variation applied
      expect(params1.temperature).not.toBe(params2.temperature);
    });

    it('should keep A/B test variations within profile bounds', async () => {
      Math.random = () => 0.05; // Force A/B test

      const params = await temperatureController.getOptimalParams('code_generation');
      
      // Should still be within code_generation bounds
      expect(params.temperature).toBeGreaterThanOrEqual(0.0);
      expect(params.temperature).toBeLessThanOrEqual(0.3);
    });
  });

  describe('Persistence and Loading', () => {
    it('should load existing metrics on initialization', async () => {
      const mockData = [
        {
          task_type: 'code_generation',
          success_count: 50,
          failure_count: 5,
          avg_quality_score: 0.85,
          optimal_temp: 0.12,
          last_updated: new Date().toISOString()
        }
      ];

      mockSelect.mockResolvedValueOnce({ data: mockData, error: null });

      // Create new instance to trigger loading
      (TemperatureController as any).instance = undefined;
      const controller = TemperatureController.getInstance();

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 10));

      const recommendations = controller.getRecommendations();
      const codeRec = recommendations.find(r => r.taskType === 'code_generation');

      expect(codeRec?.performance?.successRate).toBeCloseTo(50/55, 2);
      expect(codeRec?.learned).toBe(0.12);
    });

    it('should save metrics after recording results', async () => {
      await temperatureController.recordResult('general', 0.5, true, 0.8);

      // Wait for async save
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFrom).toHaveBeenCalledWith('temperature_metrics');
      expect(mockUpsert).toHaveBeenCalled();

      const upsertCall = mockUpsert.mock.calls[0];
      expect(upsertCall[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            task_type: 'general',
            success_count: 1,
            failure_count: 0
          })
        ])
      );
    });

    it('should handle save errors gracefully', async () => {
      mockUpsert.mockResolvedValueOnce({ error: new Error('Save failed') });

      // Should not throw
      await expect(
        temperatureController.recordResult('general', 0.5, true, 0.8)
      ).resolves.not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should always return the same instance', () => {
      const instance1 = TemperatureController.getInstance();
      const instance2 = TemperatureController.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = TemperatureController.getInstance();
      await instance1.recordResult('general', 0.5, true, 0.9);

      const instance2 = TemperatureController.getInstance();
      const recommendations = instance2.getRecommendations();
      const generalRec = recommendations.find(r => r.taskType === 'general');

      expect(generalRec?.performance?.totalGenerations).toBe(1);
    });
  });

  describe('Parameter Calculation', () => {
    it('should calculate all complementary parameters correctly', async () => {
      const params = await temperatureController.getOptimalParams('creative_writing');

      expect(params.temperature).toBeDefined();
      expect(params.topP).toBeDefined();
      expect(params.topK).toBeDefined();
      expect(params.repetitionPenalty).toBeDefined();
      expect(params.presencePenalty).toBeDefined();
      expect(params.frequencyPenalty).toBeDefined();
    });

    it('should calculate top-p inversely to temperature', async () => {
      const lowTempParams = await temperatureController.getOptimalParams('code_generation');
      const highTempParams = await temperatureController.getOptimalParams('creative_writing');

      expect(lowTempParams.topP!).toBeGreaterThan(highTempParams.topP!);
    });

    it('should not set presence/frequency penalties for low temperatures', async () => {
      const params = await temperatureController.getOptimalParams('code_generation');

      expect(params.presencePenalty).toBeUndefined();
      expect(params.frequencyPenalty).toBeUndefined();
    });

    it('should handle all task types in profiles', async () => {
      const taskTypes = [
        'creative_writing', 'code_generation', 'factual_qa', 'brainstorming',
        'analysis', 'translation', 'summarization', 'conversation',
        'technical_documentation', 'general'
      ];

      for (const taskType of taskTypes) {
        const params = await temperatureController.getOptimalParams(taskType);
        expect(params.temperature).toBeGreaterThan(0);
        expect(params.temperature).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe('Complex Context Handling', () => {
    it('should handle multiple context factors simultaneously', async () => {
      const params = await temperatureController.getOptimalParams('analysis', {
        complexity: 'high',
        userPreference: 0.35,
        previousAttempts: 2,
        qualityRequirement: 'quality'
      });

      // Should be within analysis bounds but adjusted
      expect(params.temperature).toBeGreaterThanOrEqual(0.2);
      expect(params.temperature).toBeLessThanOrEqual(0.4);
      expect(params.temperature).not.toBe(0.3); // Should differ from default
    });

    it('should prioritize user preference over other adjustments', async () => {
      const params = await temperatureController.getOptimalParams('general', {
        complexity: 'high',
        userPreference: 0.4,
        previousAttempts: 5,
        qualityRequirement: 'speed'
      });

      // User preference should override other adjustments
      expect(params.temperature).toBeCloseTo(0.4, 1);
    });
  });

  describe('Learning and Optimization', () => {
    it('should update optimal temperature using gradient descent', async () => {
      // Record initial results
      for (let i = 0; i < 20; i++) {
        await temperatureController.recordResult('general', 0.45, true, 0.7);
      }

      const rec1 = temperatureController.getRecommendations()
        .find(r => r.taskType === 'general');
      const learned1 = rec1?.learned!;

      // Record better results with different temperature
      for (let i = 0; i < 20; i++) {
        await temperatureController.recordResult('general', 0.55, true, 0.9);
      }

      const rec2 = temperatureController.getRecommendations()
        .find(r => r.taskType === 'general');
      const learned2 = rec2?.learned!;

      // Should have adjusted toward better temperature
      expect(learned2).not.toBe(learned1);
      expect(learned2).toBeGreaterThan(learned1);
    });

    it('should maintain quality score with exponential moving average', async () => {
      await temperatureController.recordResult('general', 0.5, true, 0.9);
      await temperatureController.recordResult('general', 0.5, true, 0.8);
      await temperatureController.recordResult('general', 0.5, true, 0.7);

      const rec = temperatureController.getRecommendations()
        .find(r => r.taskType === 'general');

      // Should be weighted average, not simple average
      expect(rec?.performance?.avgQuality).toBeGreaterThan(0.7);
      expect(rec?.performance?.avgQuality).toBeLessThan(0.9);
    });

    it('should not apply learning with insufficient data', async () => {
      // Record only a few results
      for (let i = 0; i < 5; i++) {
        await temperatureController.recordResult('general', 0.6, true, 0.9);
      }

      const params = await temperatureController.getOptimalParams('general');
      
      // Should use default, not learned temperature
      expect(params.temperature).toBeCloseTo(0.5, 1); // Default for general
    });
  });
});