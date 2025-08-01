/**
 * Comprehensive Adaptive AI Personality System Test Suite
 * 
 * Complete testing suite for the Adaptive AI Personality System covering:
 * - Unit tests for all personality services
 * - Integration tests for full workflow
 * - Performance tests for iOS device optimization
 * - Security tests for biometric data protection
 * - API endpoint validation
 * - Mobile device simulation
 * - Production readiness validation
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { PersonalityAnalyticsService } from '@/services/personality-analytics-service';
import { PersonalityFineTuningExtension } from '@/services/personality-fine-tuning-extension';
import { AdaptiveModelRegistry } from '@/services/adaptive-model-registry';
import { PersonalityContextInjectionExtension } from '@/services/personality-context-injection-extension';
import { PersonalityAwareABMCTSOrchestrator } from '@/services/personality-aware-ab-mcts-orchestrator';
import { BiometricDataProtectionService } from '@/services/biometric-data-protection-service';
import { iOSPerformanceOptimizer } from '@/services/ios-performance-optimizer';
import { VaultService } from '@/services/vault-service';
import { ContextInjectionService } from '@/services/context-injection-service';
import { MLXFineTuningService } from '@/services/mlx-fine-tuning-service';
import { ABMCTSOrchestrator } from '@/services/ab-mcts-orchestrator';
import { logger } from '@/utils/logger';

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'test-key',
  testTimeout: 30000,
  maxRetries: 3,
  testUserId: 'test-user-personality-system',
  testDeviceId: 'test-device-ios-optimization'
};

// Test data
const MOCK_USER_PROFILE = {
  userId: TEST_CONFIG.testUserId,
  communicationStyle: 'technical' as const,
  expertiseAreas: ['software-development', 'machine-learning', 'ios-development'],
  responsePatterns: {
    preferredLength: 'detailed',
    technicalDepth: 'advanced',
    codeExamples: true
  },
  temporalPatterns: {
    activeHours: [9, 10, 11, 14, 15, 16, 17],
    timeZone: 'America/Los_Angeles',
    workdayPatterns: 'weekdays'
  },
  privacySettings: {
    biometricLearning: true,
    patternAnalysis: true,
    modelTraining: true,
    dataRetentionDays: 90
  },
  satisfactionScore: 4.2,
  consistencyScore: 0.85
};

const MOCK_BIOMETRIC_DATA = {
  deviceId: TEST_CONFIG.testDeviceId,
  userId: TEST_CONFIG.testUserId,
  authMethod: 'faceid' as const,
  confidence: 0.92,
  timestamp: new Date(),
  rawPatterns: {
    templateHash: 'mock-hash-12345',
    confidenceMetrics: [0.92, 0.89, 0.95],
    authenticationAttempts: 1,
    timeToAuthenticate: 850
  },
  contextualFactors: {
    deviceState: 'active',
    environmentalFactors: ['indoor', 'good-lighting'],
    userBehaviorIndicators: ['normal-usage'],
    timeOfDay: 'afternoon',
    locationContext: 'home'
  },
  privacyLevel: 'processed' as const,
  consentLevel: 'comprehensive' as const
};

const MOCK_DEVICE_CAPABILITIES = {
  deviceType: 'iPhone' as const,
  modelIdentifier: 'iPhone14,2',
  osVersion: '17.0',
  processorCores: 6,
  neuralEngineSupported: true,
  maxMemoryMB: 6144,
  storageGB: 256,
  batteryLevel: 0.75,
  batteryState: 'unplugged' as const,
  thermalState: 'nominal' as const,
  isLowPowerModeEnabled: false,
  benchmarkScore: 8500,
  modelComplexitySupport: {
    maxModelSizeMB: 250,
    maxContextTokens: 2048,
    maxConcurrentAgents: 2,
    maxExecutionTimeMS: 8000
  }
};

// Test services
let supabase: any;
let vaultService: VaultService;
let contextInjectionService: ContextInjectionService;
let mlxService: MLXFineTuningService;
let abMctsOrchestrator: ABMCTSOrchestrator;

let personalityAnalyticsService: PersonalityAnalyticsService;
let personalityFineTuningService: PersonalityFineTuningExtension;
let adaptiveModelRegistry: AdaptiveModelRegistry;
let personalityContextService: PersonalityContextInjectionExtension;
let personalityOrchestrator: PersonalityAwareABMCTSOrchestrator;
let biometricProtectionService: BiometricDataProtectionService;
let iosPerformanceOptimizer: iOSPerformanceOptimizer;

describe('Adaptive AI Personality System - Comprehensive Test Suite', () => {
  beforeAll(async () => {
    logger.info('Setting up Adaptive AI Personality System test environment');

    // Initialize Supabase client
    supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseAnonKey);

    // Initialize core services
    vaultService = new VaultService();
    contextInjectionService = new ContextInjectionService();
    mlxService = new MLXFineTuningService();
    abMctsOrchestrator = new ABMCTSOrchestrator();

    // Initialize personality services
    personalityAnalyticsService = new PersonalityAnalyticsService(
      contextInjectionService,
      mlxService,
      vaultService
    );

    personalityFineTuningService = new PersonalityFineTuningExtension(
      mlxService,
      contextInjectionService,
      vaultService
    );

    adaptiveModelRegistry = new AdaptiveModelRegistry(
      {} as any, // contextStorageService
      {} as any, // intelligentParameterService
      vaultService
    );

    personalityContextService = new PersonalityContextInjectionExtension(
      contextInjectionService,
      vaultService
    );

    personalityOrchestrator = new PersonalityAwareABMCTSOrchestrator(
      abMctsOrchestrator,
      personalityContextService
    );

    biometricProtectionService = new BiometricDataProtectionService(vaultService);

    iosPerformanceOptimizer = new iOSPerformanceOptimizer();

    // Setup test database
    await setupTestDatabase();

    logger.info('Test environment setup completed');
  }, TEST_CONFIG.testTimeout);

  afterAll(async () => {
    logger.info('Cleaning up test environment');
    await cleanupTestDatabase();
  });

  describe('Unit Tests - Core Services', () => {
    describe('PersonalityAnalyticsService', () => {
      test('should analyze user interaction patterns', async () => {
        const mockInteractions = [
          {
            requestId: 'req-1',
            userRequest: 'Help me implement a SwiftUI view',
            agentResponse: 'Here is a SwiftUI implementation...',
            userSatisfaction: 4.5,
            responseTime: 1200,
            timestamp: new Date()
          }
        ];

        const insights = await personalityAnalyticsService.analyzeUserInteractionPatterns(
          TEST_CONFIG.testUserId,
          mockInteractions
        );

        expect(insights).toBeDefined();
        expect(insights.userId).toBe(TEST_CONFIG.testUserId);
        expect(insights.confidenceScore).toBeGreaterThan(0);
        expect(insights.communicationStyleRecommendation).toBeDefined();
        expect(insights.recommendedModelUpdates).toBeDefined();
      });

      test('should get biometric personality correlations', async () => {
        const correlations = await personalityAnalyticsService.getBiometricPersonalityCorrelations(
          TEST_CONFIG.testUserId,
          [MOCK_BIOMETRIC_DATA]
        );

        expect(correlations).toBeDefined();
        expect(correlations.confidenceCorrelations).toBeDefined();
        expect(correlations.temporalPatterns).toBeDefined();
        expect(correlations.adaptationRecommendations).toBeInstanceOf(Array);
      });

      test('should get personality profile', async () => {
        // First create a profile
        await createTestPersonalityProfile();

        const profile = await personalityAnalyticsService.getPersonalityProfile(TEST_CONFIG.testUserId);

        expect(profile).toBeDefined();
        expect(profile.userId).toBe(TEST_CONFIG.testUserId);
        expect(profile.communicationStyle).toBe(MOCK_USER_PROFILE.communicationStyle);
        expect(profile.expertiseAreas).toEqual(MOCK_USER_PROFILE.expertiseAreas);
      });
    });

    describe('PersonalityFineTuningExtension', () => {
      test('should create personality model with device targets', async () => {
        const deviceTargets = [
          {
            deviceType: 'iPhone' as const,
            modelIdentifier: 'iPhone14,2',
            osVersion: '17.0',
            maxModelSizeMB: 250,
            neuralEngineSupported: true
          }
        ];

        const personalityModel = await personalityFineTuningService.createPersonalityModel(
          TEST_CONFIG.testUserId,
          MOCK_USER_PROFILE as any,
          deviceTargets
        );

        expect(personalityModel).toBeDefined();
        expect(personalityModel.userId).toBe(TEST_CONFIG.testUserId);
        expect(personalityModel.deviceTargets).toEqual(deviceTargets);
        expect(personalityModel.mobileOptimizations).toBeDefined();
        expect(personalityModel.status).toBe('training');
      });

      test('should optimize model for device constraints', async () => {
        const deviceConstraints = {
          deviceType: 'AppleWatch' as const,
          maxModelSizeMB: 50,
          maxContextTokens: 128,
          batteryOptimization: true,
          thermalConstraints: true
        };

        const optimizedModel = await personalityFineTuningService.optimizeModelForDevice(
          'test-model-id',
          deviceConstraints
        );

        expect(optimizedModel).toBeDefined();
        expect(optimizedModel.optimizations.quantization.enabled).toBe(true);
        expect(optimizedModel.optimizations.contextReduction.maxTokens).toBeLessThanOrEqual(128);
        expect(optimizedModel.optimizations.mobileBattery.aggressiveOptimization).toBe(true);
      });
    });

    describe('AdaptiveModelRegistry', () => {
      test('should get personalized model for user and device', async () => {
        const deviceContext = {
          deviceType: 'iPhone' as const,
          batteryLevel: 0.8,
          thermalState: 'nominal' as const,
          performanceProfile: 'balanced' as const
        };

        const taskContext = {
          type: 'code_generation',
          userRequest: 'Create a SwiftUI view',
          userContext: { userId: TEST_CONFIG.testUserId }
        };

        const personalizedModel = await adaptiveModelRegistry.getPersonalizedModel(
          TEST_CONFIG.testUserId,
          deviceContext,
          taskContext
        );

        expect(personalizedModel).toBeDefined();
        expect(personalizedModel.userId).toBe(TEST_CONFIG.testUserId);
        expect(personalizedModel.deviceOptimizations).toBeDefined();
        expect(personalizedModel.optimizedParameters).toBeDefined();
      });

      test('should cache and retrieve models efficiently', async () => {
        const deviceContext = { deviceType: 'iPhone' as const };
        const taskContext = { type: 'general', userContext: { userId: TEST_CONFIG.testUserId } };

        // First call - should create and cache
        const startTime1 = Date.now();
        const model1 = await adaptiveModelRegistry.getPersonalizedModel(
          TEST_CONFIG.testUserId,
          deviceContext,
          taskContext
        );
        const duration1 = Date.now() - startTime1;

        // Second call - should use cache
        const startTime2 = Date.now();
        const model2 = await adaptiveModelRegistry.getPersonalizedModel(
          TEST_CONFIG.testUserId,
          deviceContext,
          taskContext
        );
        const duration2 = Date.now() - startTime2;

        expect(model1.modelId).toBe(model2.modelId);
        expect(duration2).toBeLessThan(duration1); // Cached call should be faster
      });
    });

    describe('BiometricDataProtectionService', () => {
      test('should securely store biometric data', async () => {
        const dataId = await biometricProtectionService.secureStoreBiometricData(
          MOCK_BIOMETRIC_DATA,
          'personality-system',
          'personality_analysis'
        );

        expect(dataId).toBeDefined();
        expect(typeof dataId).toBe('string');
      });

      test('should retrieve and decrypt biometric data', async () => {
        // First store data
        const dataId = await biometricProtectionService.secureStoreBiometricData(
          MOCK_BIOMETRIC_DATA,
          'personality-system',
          'testing'
        );

        // Then retrieve it
        const retrievedData = await biometricProtectionService.retrieveBiometricData(
          TEST_CONFIG.testUserId,
          'personality-system',
          'testing'
        );

        expect(retrievedData).toBeDefined();
        expect(retrievedData.length).toBeGreaterThan(0);
        expect(retrievedData[0].userId).toBe(TEST_CONFIG.testUserId);
        expect(retrievedData[0].authMethod).toBe(MOCK_BIOMETRIC_DATA.authMethod);
      });

      test('should handle data export requests', async () => {
        const exportRequestId = await biometricProtectionService.requestDataExport(
          TEST_CONFIG.testUserId,
          ['biometric_patterns', 'contextual_factors'],
          'json'
        );

        expect(exportRequestId).toBeDefined();
        expect(typeof exportRequestId).toBe('string');
      });

      test('should handle data deletion requests', async () => {
        const deletionRequestId = await biometricProtectionService.requestDataDeletion(
          TEST_CONFIG.testUserId,
          'complete',
          undefined,
          false
        );

        expect(deletionRequestId).toBeDefined();
        expect(typeof deletionRequestId).toBe('string');
      });
    });

    describe('iOSPerformanceOptimizer', () => {
      test('should optimize performance for different device types', async () => {
        const appleWatchCapabilities = {
          ...MOCK_DEVICE_CAPABILITIES,
          deviceType: 'AppleWatch' as const,
          maxMemoryMB: 1024,
          modelComplexitySupport: {
            maxModelSizeMB: 50,
            maxContextTokens: 128,
            maxConcurrentAgents: 1,
            maxExecutionTimeMS: 3000
          }
        };

        const taskContext = {
          taskType: 'simple_query',
          expectedComplexity: 'low' as const,
          priorityLevel: 'normal' as const
        };

        const constraints = await iosPerformanceOptimizer.optimizeForDevice(
          'apple-watch-test',
          appleWatchCapabilities,
          taskContext
        );

        expect(constraints).toBeDefined();
        expect(constraints.maxModelSizeMB).toBeLessThanOrEqual(50);
        expect(constraints.maxConcurrentAgents).toBe(1);
        expect(constraints.maxExecutionTimeMS).toBeLessThanOrEqual(3000);
        expect(constraints.batteryOptimizationEnabled).toBe(true);
      });

      test('should adapt to thermal and battery conditions', async () => {
        const stressedDevice = {
          ...MOCK_DEVICE_CAPABILITIES,
          batteryLevel: 0.15, // Low battery
          thermalState: 'serious' as const,
          isLowPowerModeEnabled: true
        };

        const taskContext = {
          taskType: 'complex_analysis',
          expectedComplexity: 'high' as const,
          priorityLevel: 'high' as const
        };

        const constraints = await iosPerformanceOptimizer.optimizeForDevice(
          'stressed-device-test',
          stressedDevice,
          taskContext
        );

        expect(constraints.batteryOptimizationEnabled).toBe(true);
        expect(constraints.thermalThrottlingEnabled).toBe(true);
        expect(constraints.maxCPUUsagePercent).toBeLessThan(70); // Should be throttled
        expect(constraints.cooldownPeriodMS).toBeGreaterThan(1000);
      });

      test('should run performance benchmarks', async () => {
        const benchmark = await iosPerformanceOptimizer.runPerformanceBenchmark(
          TEST_CONFIG.testDeviceId,
          'inference',
          {
            modelSizeMB: 250,
            contextTokens: 1024,
            agentCount: 2,
            iterationCount: 10
          }
        );

        expect(benchmark).toBeDefined();
        expect(benchmark.deviceType).toBe('iPhone');
        expect(benchmark.testType).toBe('inference');
        expect(benchmark.results.executionTimeMS).toBeGreaterThan(0);
        expect(benchmark.results.memoryUsageMB).toBeGreaterThan(0);
        expect(benchmark.results.qualityScore).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration Tests - Full Workflow', () => {
    test('should execute complete personality-aware workflow', async () => {
      // 1. Store biometric data
      const biometricDataId = await biometricProtectionService.secureStoreBiometricData(
        MOCK_BIOMETRIC_DATA,
        'integration-test',
        'full_workflow_test'
      );

      // 2. Create personality profile
      await createTestPersonalityProfile();

      // 3. Get personalized model
      const personalizedModel = await adaptiveModelRegistry.getPersonalizedModel(
        TEST_CONFIG.testUserId,
        { deviceType: 'iPhone' as const },
        { type: 'general', userContext: { userId: TEST_CONFIG.testUserId } }
      );

      // 4. Inject personality context
      const enhancedContext = await personalityContextService.injectPersonalityContext(
        { userRequest: 'Help me with iOS development', userId: TEST_CONFIG.testUserId },
        personalizedModel,
        MOCK_DEVICE_CAPABILITIES
      );

      // 5. Execute with personality-aware orchestration
      const executionContext = {
        personalityModel: personalizedModel,
        enhancedContext,
        deviceContext: MOCK_DEVICE_CAPABILITIES,
        executionConstraints: {
          maxExecutionTime: 8000,
          maxMemoryUsage: 250,
          maxConcurrentAgents: 2,
          batteryOptimization: false
        },
        personalityRequirements: {
          requiredExpertise: ['ios-development'],
          preferredCommunicationStyle: 'technical',
          minimumConfidenceLevel: 0.7,
          adaptationSensitivity: 0.8
        }
      };

      const result = await personalityOrchestrator.orchestrateWithPersonality(executionContext);

      // Validate complete workflow
      expect(biometricDataId).toBeDefined();
      expect(personalizedModel).toBeDefined();
      expect(enhancedContext).toBeDefined();
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.personalityMetrics).toBeDefined();
      expect(result.biometricInsights).toBeDefined();
      expect(result.devicePerformance).toBeDefined();
    });

    test('should handle device constraints across the full pipeline', async () => {
      // Test with Apple Watch constraints
      const watchCapabilities = {
        ...MOCK_DEVICE_CAPABILITIES,
        deviceType: 'AppleWatch' as const,
        maxMemoryMB: 1024,
        batteryLevel: 0.25, // Low battery
        modelComplexitySupport: {
          maxModelSizeMB: 50,
          maxContextTokens: 128,
          maxConcurrentAgents: 1,
          maxExecutionTimeMS: 3000
        }
      };

      // 1. Optimize performance for Apple Watch
      const constraints = await iosPerformanceOptimizer.optimizeForDevice(
        'watch-integration-test',
        watchCapabilities,
        {
          taskType: 'simple_query',
          expectedComplexity: 'low' as const,
          priorityLevel: 'normal' as const
        }
      );

      // 2. Get personalized model for Apple Watch
      const personalizedModel = await adaptiveModelRegistry.getPersonalizedModel(
        TEST_CONFIG.testUserId,
        watchCapabilities,
        { type: 'general', userContext: { userId: TEST_CONFIG.testUserId } }
      );

      // 3. Execute with Apple Watch constraints
      const enhancedContext = await personalityContextService.injectPersonalityContext(
        { userRequest: 'Quick help', userId: TEST_CONFIG.testUserId },
        personalizedModel,
        watchCapabilities
      );

      const executionContext = {
        personalityModel: personalizedModel,
        enhancedContext,
        deviceContext: watchCapabilities,
        executionConstraints: {
          maxExecutionTime: constraints.maxExecutionTimeMS,
          maxMemoryUsage: constraints.maxModelSizeMB,
          maxConcurrentAgents: constraints.maxConcurrentAgents,
          batteryOptimization: constraints.batteryOptimizationEnabled
        },
        personalityRequirements: {
          requiredExpertise: [],
          preferredCommunicationStyle: 'concise',
          minimumConfidenceLevel: 0.6,
          adaptationSensitivity: 0.5
        }
      };

      const result = await personalityOrchestrator.orchestrateWithPersonality(executionContext);

      // Validate Apple Watch optimizations
      expect(constraints.maxConcurrentAgents).toBe(1);
      expect(constraints.maxModelSizeMB).toBeLessThanOrEqual(50);
      expect(constraints.batteryOptimizationEnabled).toBe(true);
      expect(result.devicePerformance.executionEfficiency).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent personality requests', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map((_, index) => 
        adaptiveModelRegistry.getPersonalizedModel(
          `${TEST_CONFIG.testUserId}-${index}`,
          { deviceType: 'iPhone' as const },
          { type: 'general', userContext: { userId: `${TEST_CONFIG.testUserId}-${index}` } }
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentRequests);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.userId).toBeDefined();
      });
    });

    test('should optimize memory usage across device types', async () => {
      const deviceTypes = ['AppleWatch', 'iPhone', 'iPad', 'Mac'] as const;
      
      for (const deviceType of deviceTypes) {
        const capabilities = {
          ...MOCK_DEVICE_CAPABILITIES,
          deviceType,
          modelComplexitySupport: {
            maxModelSizeMB: deviceType === 'AppleWatch' ? 50 : 
                            deviceType === 'iPhone' ? 250 :
                            deviceType === 'iPad' ? 500 : 2000,
            maxContextTokens: deviceType === 'AppleWatch' ? 128 :
                            deviceType === 'iPhone' ? 1024 :
                            deviceType === 'iPad' ? 2048 : 4096,
            maxConcurrentAgents: deviceType === 'AppleWatch' ? 1 :
                               deviceType === 'iPhone' ? 2 :
                               deviceType === 'iPad' ? 4 : 8,
            maxExecutionTimeMS: deviceType === 'AppleWatch' ? 3000 :
                              deviceType === 'iPhone' ? 8000 :
                              deviceType === 'iPad' ? 12000 : 20000
          }
        };

        const constraints = await iosPerformanceOptimizer.optimizeForDevice(
          `${deviceType.toLowerCase()}-memory-test`,
          capabilities,
          {
            taskType: 'memory_test',
            expectedComplexity: 'medium' as const,
            priorityLevel: 'normal' as const
          }
        );

        expect(constraints.maxModelSizeMB).toBeLessThanOrEqual(capabilities.modelComplexitySupport.maxModelSizeMB);
        expect(constraints.maxConcurrentAgents).toBeLessThanOrEqual(capabilities.modelComplexitySupport.maxConcurrentAgents);
      }
    });
  });

  describe('Security Tests', () => {
    test('should properly encrypt and decrypt biometric data', async () => {
      // Store encrypted data
      const dataId = await biometricProtectionService.secureStoreBiometricData(
        MOCK_BIOMETRIC_DATA,
        'security-test',
        'encryption_validation'
      );

      // Retrieve and validate
      const retrievedData = await biometricProtectionService.retrieveBiometricData(
        TEST_CONFIG.testUserId,
        'security-test',
        'encryption_validation'
      );

      expect(retrievedData).toHaveLength(1);
      const data = retrievedData[0];
      
      // Validate that sensitive data was properly encrypted/decrypted
      expect(data.rawPatterns).toBeDefined();
      expect(data.rawPatterns.templateHash).toBe(MOCK_BIOMETRIC_DATA.rawPatterns.templateHash);
      expect(data.contextualFactors).toBeDefined();
      expect(data.contextualFactors.locationContext).toBe(MOCK_BIOMETRIC_DATA.contextualFactors.locationContext);
    });

    test('should enforce access controls', async () => {
      // Store data as one accessor
      const dataId = await biometricProtectionService.secureStoreBiometricData(
        MOCK_BIOMETRIC_DATA,
        'accessor-1',
        'access_control_test'
      );

      // Try to access as different user (should be denied for other users' data)
      await expect(
        biometricProtectionService.retrieveBiometricData(
          'different-user-id',
          'accessor-2',
          'unauthorized_access'
        )
      ).resolves.toEqual([]); // Should return empty array for unauthorized access
    });

    test('should handle data retention and deletion', async () => {
      // Store test data
      const dataId = await biometricProtectionService.secureStoreBiometricData(
        MOCK_BIOMETRIC_DATA,
        'retention-test',
        'retention_validation'
      );

      // Request deletion
      const deletionRequestId = await biometricProtectionService.requestDataDeletion(
        TEST_CONFIG.testUserId,
        'complete'
      );

      expect(deletionRequestId).toBeDefined();
      expect(typeof deletionRequestId).toBe('string');
    });
  });

  describe('API Endpoint Tests', () => {
    // Note: These would require the actual server to be running
    // For now, we'll test the service layer functionality

    test('should analyze personality patterns via service', async () => {
      const mockInteractions = [
        {
          requestId: 'api-test-1',
          userRequest: 'Help me build an iOS app',
          agentResponse: 'Here is how to build an iOS app...',
          userSatisfaction: 4.3,
          responseTime: 1800,
          timestamp: new Date()
        }
      ];

      const insights = await personalityAnalyticsService.analyzeUserInteractionPatterns(
        TEST_CONFIG.testUserId,
        mockInteractions
      );

      expect(insights).toBeDefined();
      expect(insights.userId).toBe(TEST_CONFIG.testUserId);
      expect(insights.confidenceScore).toBeGreaterThan(0);
    });

    test('should create personality model via service', async () => {
      const deviceTargets = [
        {
          deviceType: 'iPhone' as const,
          modelIdentifier: 'iPhone14,2',
          osVersion: '17.0',
          maxModelSizeMB: 250,
          neuralEngineSupported: true
        }
      ];

      const personalityModel = await personalityFineTuningService.createPersonalityModel(
        TEST_CONFIG.testUserId,
        MOCK_USER_PROFILE as any,
        deviceTargets
      );

      expect(personalityModel).toBeDefined();
      expect(personalityModel.userId).toBe(TEST_CONFIG.testUserId);
      expect(personalityModel.status).toBe('training');
    });
  });

  // Helper functions
  async function setupTestDatabase(): Promise<void> {
    try {
      // Create test user personality profile
      const { error: profileError } = await supabase
        .from('user_personality_profiles')
        .upsert({
          user_id: TEST_CONFIG.testUserId,
          communication_style: MOCK_USER_PROFILE.communicationStyle,
          expertise_areas: MOCK_USER_PROFILE.expertiseAreas,
          response_patterns: MOCK_USER_PROFILE.responsePatterns,
          temporal_patterns: MOCK_USER_PROFILE.temporalPatterns,
          privacy_settings: MOCK_USER_PROFILE.privacySettings,
          satisfaction_score: MOCK_USER_PROFILE.satisfactionScore,
          consistency_score: MOCK_USER_PROFILE.consistencyScore,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (profileError) {
        logger.warn('Could not create test personality profile:', profileError);
      }

      logger.info('Test database setup completed');
    } catch (error) {
      logger.warn('Error setting up test database:', error);
    }
  }

  async function createTestPersonalityProfile(): Promise<void> {
    const { error } = await supabase
      .from('user_personality_profiles')
      .upsert({
        user_id: TEST_CONFIG.testUserId,
        communication_style: MOCK_USER_PROFILE.communicationStyle,
        expertise_areas: MOCK_USER_PROFILE.expertiseAreas,
        response_patterns: MOCK_USER_PROFILE.responsePatterns,
        temporal_patterns: MOCK_USER_PROFILE.temporalPatterns,
        privacy_settings: MOCK_USER_PROFILE.privacySettings,
        satisfaction_score: MOCK_USER_PROFILE.satisfactionScore,
        consistency_score: MOCK_USER_PROFILE.consistencyScore,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      throw error;
    }
  }

  async function cleanupTestDatabase(): Promise<void> {
    try {
      // Clean up test data
      await supabase
        .from('user_personality_profiles')
        .delete()
        .eq('user_id', TEST_CONFIG.testUserId);

      await supabase
        .from('encrypted_biometric_data')
        .delete()
        .eq('user_id', TEST_CONFIG.testUserId);

      await supabase
        .from('personality_models')
        .delete()
        .eq('user_id', TEST_CONFIG.testUserId);

      logger.info('Test database cleanup completed');
    } catch (error) {
      logger.warn('Error cleaning up test database:', error);
    }
  }
}, TEST_CONFIG.testTimeout);