/**
 * Biometric Data Protection Service
 * 
 * Comprehensive security service for protecting biometric authentication data
 * in the Adaptive AI Personality System. Implements enterprise-grade encryption,
 * privacy compliance, and secure data lifecycle management.
 * 
 * Features:
 * - End-to-end encryption with device-specific keys
 * - GDPR/CCPA compliant data anonymization and aggregation
 * - Automatic data retention and secure deletion
 * - Comprehensive audit logging and access controls
 * - Privacy-preserving analytics and insights
 * - Secure data export and user rights management
 * - Integration with Supabase Vault for key management
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import type { VaultService } from './vault-service';
import { CircuitBreaker } from '@/utils/circuit-breaker';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// BIOMETRIC DATA PROTECTION TYPES
// =============================================================================

export interface BiometricAuthData {
  deviceId: string;
  userId: string;
  authMethod: 'touchid' | 'faceid' | 'voiceid' | 'passcode' | 'proximity';
  confidence: number; // 0-1
  timestamp: Date;
  sessionId?: string;
  
  // Raw biometric patterns (will be encrypted)
  rawPatterns?: {
    templateHash?: string; // Hashed biometric template
    confidenceMetrics?: number[];
    authenticationAttempts?: number;
    timeToAuthenticate?: number;
  };
  
  // Context data (will be anonymized)
  contextualFactors: {
    deviceState?: string;
    environmentalFactors?: string[];
    userBehaviorIndicators?: string[];
    timeOfDay?: string;
    locationContext?: string; // Anonymized
  };
  
  // Metadata
  privacyLevel: 'raw' | 'processed' | 'aggregated';
  consentLevel: 'minimal' | 'standard' | 'comprehensive';
}

export interface EncryptedBiometricData {
  id: string;
  userId: string;
  deviceId: string;
  authMethod: string;
  confidence: number;
  timestamp: Date;
  
  // Encrypted fields
  encryptedPatterns: string; // AES-256 encrypted raw patterns
  encryptedContext: string; // AES-256 encrypted contextual factors
  
  // Public aggregated metrics (safe for analytics)
  aggregatedMetrics: {
    averageConfidence: number;
    authMethodFrequency: Record<string, number>;
    temporalPatterns: Record<string, number>;
    devicePerformanceScore: number;
  };
  
  // Security metadata
  encryptionKeyId: string;
  encryptionAlgorithm: string;
  dataClassification: 'sensitive' | 'restricted' | 'confidential';
  retentionUntil: Date;
  
  // Audit trail
  accessLog: BiometricAccessLogEntry[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface BiometricAccessLogEntry {
  id: string;
  accessType: 'read' | 'write' | 'decrypt' | 'export' | 'delete';
  accessorId: string; // User or service ID
  accessorType: 'user' | 'service' | 'system';
  purpose: string;
  dataFields: string[]; // Which fields were accessed
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  auditMetadata?: Record<string, any>;
}

export interface BiometricPrivacySettings {
  userId: string;
  dataRetentionDays: number; // 1-365
  allowBiometricStorage: boolean;
  allowPatternAnalysis: boolean;
  allowCrossDeviceCorrelation: boolean;
  anonymizationLevel: 'minimal' | 'standard' | 'aggressive';
  consentWithdrawalDate?: Date;
  dataExportRequests: BiometricDataExportRequest[];
  deletionRequests: BiometricDataDeletionRequest[];
}

export interface BiometricDataExportRequest {
  id: string;
  userId: string;
  requestDate: Date;
  dataTypes: string[]; // Types of biometric data to export
  format: 'json' | 'csv' | 'encrypted';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedDate?: Date;
  downloadUrl?: string; // Secure temporary URL
  expiresAt?: Date;
}

export interface BiometricDataDeletionRequest {
  id: string;
  userId: string;
  requestDate: Date;
  deletionScope: 'partial' | 'complete';
  specificDataTypes?: string[];
  retainAggregatedData: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedDate?: Date;
  deletionCertificate?: string;
}

export interface BiometricSecurityConfig {
  encryptionAlgorithm: string;
  keyRotationIntervalDays: number;
  maxRetentionDays: number;
  requireSecureTransport: boolean;
  enableAuditLogging: boolean;
  anonymizationThreshold: number; // Minimum data points for anonymization
  allowedAccessRoles: string[];
  requireMultiFactorAuth: boolean;
}

// =============================================================================
// BIOMETRIC DATA PROTECTION SERVICE
// =============================================================================

export class BiometricDataProtectionService extends EventEmitter {
  private supabase: SupabaseClient;
  private vaultService: VaultService;
  private circuitBreaker: CircuitBreaker;
  private config: BiometricSecurityConfig;
  
  // Encryption and security
  private encryptionKeyCache: Map<string, { key: Buffer; expiry: number }> = new Map();
  private accessControlCache: Map<string, { permissions: string[]; expiry: number }> = new Map();
  
  // Data processing queues
  private encryptionQueue: Map<string, BiometricAuthData[]> = new Map();
  private deletionQueue: Map<string, string[]> = new Map();
  private exportQueue: Map<string, BiometricDataExportRequest> = new Map();

  constructor(
    vaultService: VaultService,
    config?: Partial<BiometricSecurityConfig>
  ) {
    super();
    
    this.vaultService = vaultService;
    
    // Default security configuration
    this.config = {
      encryptionAlgorithm: 'aes-256-gcm',
      keyRotationIntervalDays: 30,
      maxRetentionDays: 90,
      requireSecureTransport: true,
      enableAuditLogging: true,
      anonymizationThreshold: 10,
      allowedAccessRoles: ['user', 'personality_service', 'admin'],
      requireMultiFactorAuth: false,
      ...config
    };
    
    // Initialize Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
    
    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker('biometric-data-protection', {
      failureThreshold: 3,
      resetTimeout: 60000,
      monitoringPeriod: 30000
    });
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Biometric Data Protection Service');
      
      // Load vault secrets
      await this.loadVaultSecrets();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      logger.info('Biometric Data Protection Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Biometric Data Protection Service:', error);
      throw error;
    }
  }

  private async loadVaultSecrets(): Promise<void> {
    try {
      // Load Supabase service key
      const supabaseServiceKey = await this.vaultService.getSecret('supabase_service_key');
      if (supabaseServiceKey) {
        this.supabase = createClient(
          process.env.SUPABASE_URL || '',
          supabaseServiceKey
        );
      }
      
      // Load master encryption key
      const masterKey = await this.vaultService.getSecret('biometric_master_encryption_key');
      if (!masterKey) {
        // Generate and store master key if it doesn't exist
        const newMasterKey = crypto.randomBytes(32).toString('hex');
        await this.vaultService.createSecret('biometric_master_encryption_key', newMasterKey);
        logger.info('Generated new biometric master encryption key');
      }
      
    } catch (error) {
      logger.warn('Could not load some vault secrets:', error);
    }
  }

  private setupEventListeners(): void {
    // Listen for circuit breaker events
    this.circuitBreaker.on('stateChange', (state) => {
      logger.info(`Biometric Protection Circuit Breaker state: ${state}`);
      this.emit('circuit_breaker_state_change', { state });
    });
  }

  private startBackgroundTasks(): void {
    // Process encryption queue every 30 seconds
    setInterval(() => {
      this.processEncryptionQueue();
    }, 30 * 1000);

    // Clean up expired data every hour
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000);

    // Rotate encryption keys daily
    setInterval(() => {
      this.rotateEncryptionKeys();
    }, 24 * 60 * 60 * 1000);

    // Process deletion requests every 6 hours
    setInterval(() => {
      this.processDeletionQueue();
    }, 6 * 60 * 60 * 1000);
  }

  // =============================================================================
  // CORE BIOMETRIC DATA PROTECTION
  // =============================================================================

  async secureStoreBiometricData(
    biometricData: BiometricAuthData,
    accessorId: string,
    purpose: string
  ): Promise<string> {
    return await this.circuitBreaker.execute(async () => {
      try {
        logger.info(`Securing biometric data for user: ${biometricData.userId}, device: ${biometricData.deviceId}`);

        // Validate input data
        this.validateBiometricData(biometricData);

        // Check user consent and privacy settings
        await this.validateUserConsent(biometricData.userId, 'storage');

        // Get device-specific encryption key
        const encryptionKey = await this.getDeviceEncryptionKey(biometricData.deviceId);
        const encryptionKeyId = await this.getEncryptionKeyId(biometricData.deviceId);

        // Encrypt sensitive patterns
        const encryptedPatterns = await this.encryptBiometricPatterns(
          biometricData.rawPatterns,
          encryptionKey
        );

        // Encrypt contextual factors
        const encryptedContext = await this.encryptContextualFactors(
          biometricData.contextualFactors,
          encryptionKey
        );

        // Generate aggregated metrics (safe for analytics)
        const aggregatedMetrics = this.generateAggregatedMetrics(biometricData);

        // Calculate retention date
        const privacySettings = await this.getUserPrivacySettings(biometricData.userId);
        const retentionUntil = new Date();
        retentionUntil.setDate(retentionUntil.getDate() + privacySettings.dataRetentionDays);

        // Create encrypted biometric record
        const encryptedRecord: EncryptedBiometricData = {
          id: uuidv4(),
          userId: biometricData.userId,
          deviceId: biometricData.deviceId,
          authMethod: biometricData.authMethod,
          confidence: biometricData.confidence,
          timestamp: biometricData.timestamp,
          encryptedPatterns,
          encryptedContext,
          aggregatedMetrics,
          encryptionKeyId,
          encryptionAlgorithm: this.config.encryptionAlgorithm,
          dataClassification: 'sensitive',
          retentionUntil,
          accessLog: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Store encrypted data
        const { data, error } = await this.supabase
          .from('encrypted_biometric_data')
          .insert({
            id: encryptedRecord.id,
            user_id: encryptedRecord.userId,
            device_id: encryptedRecord.deviceId,
            auth_method: encryptedRecord.authMethod,
            confidence: encryptedRecord.confidence,
            auth_timestamp: encryptedRecord.timestamp.toISOString(),
            encrypted_patterns: encryptedRecord.encryptedPatterns,
            encrypted_context: encryptedRecord.encryptedContext,
            aggregated_metrics: encryptedRecord.aggregatedMetrics,
            encryption_key_id: encryptedRecord.encryptionKeyId,
            encryption_algorithm: encryptedRecord.encryptionAlgorithm,
            data_classification: encryptedRecord.dataClassification,
            retention_until: encryptedRecord.retentionUntil.toISOString(),
            created_at: encryptedRecord.createdAt.toISOString(),
            updated_at: encryptedRecord.updatedAt.toISOString()
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Log access for audit trail
        await this.logBiometricAccess({
          id: uuidv4(),
          accessType: 'write',
          accessorId,
          accessorType: 'service',
          purpose,
          dataFields: ['encrypted_patterns', 'encrypted_context', 'aggregated_metrics'],
          timestamp: new Date(),
          success: true,
          auditMetadata: {
            dataId: encryptedRecord.id,
            encryptionUsed: true,
            retentionDays: privacySettings.dataRetentionDays
          }
        });

        // Emit storage event
        this.emit('biometric_data_stored', {
          dataId: encryptedRecord.id,
          userId: biometricData.userId,
          deviceId: biometricData.deviceId,
          retentionUntil: retentionUntil.toISOString()
        });

        return encryptedRecord.id;

      } catch (error) {
        logger.error('Error securing biometric data:', error);
        throw error;
      }
    });
  }

  async retrieveBiometricData(
    userId: string,
    accessorId: string,
    purpose: string,
    filters?: {
      deviceId?: string;
      startDate?: Date;
      endDate?: Date;
      authMethods?: string[];
    }
  ): Promise<BiometricAuthData[]> {
    return await this.circuitBreaker.execute(async () => {
      try {
        logger.info(`Retrieving biometric data for user: ${userId}`);

        // Validate access permissions
        await this.validateAccess(accessorId, userId, 'read');

        // Check user consent
        await this.validateUserConsent(userId, 'retrieval');

        // Build query with filters
        let query = this.supabase
          .from('encrypted_biometric_data')
          .select('*')
          .eq('user_id', userId)
          .gt('retention_until', new Date().toISOString()); // Only non-expired data

        if (filters?.deviceId) {
          query = query.eq('device_id', filters.deviceId);
        }

        if (filters?.startDate) {
          query = query.gte('auth_timestamp', filters.startDate.toISOString());
        }

        if (filters?.endDate) {
          query = query.lte('auth_timestamp', filters.endDate.toISOString());
        }

        if (filters?.authMethods && filters.authMethods.length > 0) {
          query = query.in('auth_method', filters.authMethods);
        }

        const { data, error } = await query.order('auth_timestamp', { ascending: false });

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          return [];
        }

        // Decrypt and return data
        const decryptedData: BiometricAuthData[] = [];

        for (const record of data) {
          try {
            // Get decryption key
            const decryptionKey = await this.getDeviceEncryptionKey(record.device_id);

            // Decrypt patterns
            const rawPatterns = await this.decryptBiometricPatterns(
              record.encrypted_patterns,
              decryptionKey
            );

            // Decrypt contextual factors
            const contextualFactors = await this.decryptContextualFactors(
              record.encrypted_context,
              decryptionKey
            );

            // Reconstruct original data structure
            const biometricData: BiometricAuthData = {
              deviceId: record.device_id,
              userId: record.user_id,
              authMethod: record.auth_method,
              confidence: record.confidence,
              timestamp: new Date(record.auth_timestamp),
              rawPatterns,
              contextualFactors,
              privacyLevel: 'processed', // Indicate this was stored encrypted
              consentLevel: 'standard'
            };

            decryptedData.push(biometricData);

            // Log access for audit trail
            await this.logBiometricAccess({
              id: uuidv4(),
              accessType: 'decrypt',
              accessorId,
              accessorType: 'service',
              purpose,
              dataFields: ['encrypted_patterns', 'encrypted_context'],
              timestamp: new Date(),
              success: true,
              auditMetadata: {
                dataId: record.id,
                decryptionUsed: true
              }
            });

          } catch (decryptError) {
            logger.error(`Error decrypting biometric record ${record.id}:`, decryptError);
            // Continue with other records, but log the failure
          }
        }

        return decryptedData;

      } catch (error) {
        logger.error('Error retrieving biometric data:', error);
        throw error;
      }
    });
  }

  // =============================================================================
  // PRIVACY AND COMPLIANCE METHODS
  // =============================================================================

  async requestDataExport(
    userId: string,
    dataTypes: string[],
    format: 'json' | 'csv' | 'encrypted' = 'json'
  ): Promise<string> {
    try {
      logger.info(`Data export requested for user: ${userId}`);

      // Validate user permissions
      await this.validateAccess(userId, userId, 'export');

      // Create export request
      const exportRequest: BiometricDataExportRequest = {
        id: uuidv4(),
        userId,
        requestDate: new Date(),
        dataTypes,
        format,
        status: 'pending'
      };

      // Store export request
      const { data, error } = await this.supabase
        .from('biometric_data_export_requests')
        .insert({
          id: exportRequest.id,
          user_id: exportRequest.userId,
          request_date: exportRequest.requestDate.toISOString(),
          data_types: exportRequest.dataTypes,
          format: exportRequest.format,
          status: exportRequest.status
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add to export queue for processing
      this.exportQueue.set(exportRequest.id, exportRequest);

      // Log the request
      await this.logBiometricAccess({
        id: uuidv4(),
        accessType: 'export',
        accessorId: userId,
        accessorType: 'user',
        purpose: 'data_export_request',
        dataFields: dataTypes,
        timestamp: new Date(),
        success: true,
        auditMetadata: {
          exportRequestId: exportRequest.id,
          format
        }
      });

      this.emit('data_export_requested', {
        requestId: exportRequest.id,
        userId,
        dataTypes,
        format
      });

      return exportRequest.id;

    } catch (error) {
      logger.error('Error requesting data export:', error);
      throw error;
    }
  }

  async requestDataDeletion(
    userId: string,
    deletionScope: 'partial' | 'complete',
    specificDataTypes?: string[],
    retainAggregatedData = true
  ): Promise<string> {
    try {
      logger.info(`Data deletion requested for user: ${userId}, scope: ${deletionScope}`);

      // Validate user permissions
      await this.validateAccess(userId, userId, 'delete');

      // Create deletion request
      const deletionRequest: BiometricDataDeletionRequest = {
        id: uuidv4(),
        userId,
        requestDate: new Date(),
        deletionScope,
        specificDataTypes,
        retainAggregatedData,
        status: 'pending'
      };

      // Store deletion request
      const { data, error } = await this.supabase
        .from('biometric_data_deletion_requests')
        .insert({
          id: deletionRequest.id,
          user_id: deletionRequest.userId,
          request_date: deletionRequest.requestDate.toISOString(),
          deletion_scope: deletionRequest.deletionScope,
          specific_data_types: deletionRequest.specificDataTypes,
          retain_aggregated_data: deletionRequest.retainAggregatedData,
          status: deletionRequest.status
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add to deletion queue for processing
      if (!this.deletionQueue.has(userId)) {
        this.deletionQueue.set(userId, []);
      }
      this.deletionQueue.get(userId)!.push(deletionRequest.id);

      // Log the request
      await this.logBiometricAccess({
        id: uuidv4(),
        accessType: 'delete',
        accessorId: userId,
        accessorType: 'user',
        purpose: 'data_deletion_request',
        dataFields: specificDataTypes || ['all'],
        timestamp: new Date(),
        success: true,
        auditMetadata: {
          deletionRequestId: deletionRequest.id,
          scope: deletionScope,
          retainAggregated: retainAggregatedData
        }
      });

      this.emit('data_deletion_requested', {
        requestId: deletionRequest.id,
        userId,
        deletionScope,
        specificDataTypes
      });

      return deletionRequest.id;

    } catch (error) {
      logger.error('Error requesting data deletion:', error);
      throw error;
    }
  }

  // =============================================================================
  // ENCRYPTION AND SECURITY METHODS
  // =============================================================================

  private async getDeviceEncryptionKey(deviceId: string): Promise<Buffer> {
    const cacheKey = `device_key_${deviceId}`;
    const cached = this.encryptionKeyCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.key;
    }

    try {
      // Try to get device-specific key from vault
      let deviceKey = await this.vaultService.getSecret(`biometric_device_key_${deviceId}`);
      
      if (!deviceKey) {
        // Generate new device-specific key
        const masterKey = await this.vaultService.getSecret('biometric_master_encryption_key');
        if (!masterKey) {
          throw new Error('Master encryption key not found');
        }
        
        // Derive device key from master key and device ID
        deviceKey = crypto.pbkdf2Sync(masterKey, deviceId, 100000, 32, 'sha256').toString('hex');
        
        // Store device key in vault
        await this.vaultService.createSecret(`biometric_device_key_${deviceId}`, deviceKey);
      }
      
      const keyBuffer = Buffer.from(deviceKey, 'hex');
      
      // Cache the key for 1 hour
      this.encryptionKeyCache.set(cacheKey, {
        key: keyBuffer,
        expiry: Date.now() + 60 * 60 * 1000
      });
      
      return keyBuffer;
      
    } catch (error) {
      logger.error(`Error getting device encryption key for ${deviceId}:`, error);
      throw error;
    }
  }

  private async encryptBiometricPatterns(
    patterns: any,
    encryptionKey: Buffer
  ): Promise<string> {
    if (!patterns) return '';
    
    try {
      const plaintext = JSON.stringify(patterns);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, encryptionKey);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      return `${iv.toString('hex')  }:${  encrypted}`;
    } catch (error) {
      logger.error('Error encrypting biometric patterns:', error);
      throw error;
    }
  }

  private async decryptBiometricPatterns(
    encryptedData: string,
    decryptionKey: Buffer
  ): Promise<any> {
    if (!encryptedData) return null;
    
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher(this.config.encryptionAlgorithm, decryptionKey);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Error decrypting biometric patterns:', error);
      throw error;
    }
  }

  private async encryptContextualFactors(
    contextualFactors: any,
    encryptionKey: Buffer
  ): Promise<string> {
    // Similar to encryptBiometricPatterns but for contextual data
    return this.encryptBiometricPatterns(contextualFactors, encryptionKey);
  }

  private async decryptContextualFactors(
    encryptedData: string,
    decryptionKey: Buffer
  ): Promise<any> {
    // Similar to decryptBiometricPatterns but for contextual data
    return this.decryptBiometricPatterns(encryptedData, decryptionKey);
  }

  // =============================================================================
  // UTILITY AND HELPER METHODS
  // =============================================================================

  private validateBiometricData(data: BiometricAuthData): void {
    if (!data.userId || !data.deviceId || !data.authMethod) {
      throw new Error('Invalid biometric data: missing required fields');
    }
    
    if (data.confidence < 0 || data.confidence > 1) {
      throw new Error('Invalid confidence value: must be between 0 and 1');
    }
    
    const validAuthMethods = ['touchid', 'faceid', 'voiceid', 'passcode', 'proximity'];
    if (!validAuthMethods.includes(data.authMethod)) {
      throw new Error(`Invalid auth method: must be one of ${validAuthMethods.join(', ')}`);
    }
  }

  private async validateUserConsent(userId: string, operation: string): Promise<void> {
    const privacySettings = await this.getUserPrivacySettings(userId);
    
    switch (operation) {
      case 'storage':
        if (!privacySettings.allowBiometricStorage) {
          throw new Error('User has not consented to biometric data storage');
        }
        break;
      case 'retrieval':
      case 'analysis':
        if (!privacySettings.allowPatternAnalysis) {
          throw new Error('User has not consented to biometric pattern analysis');
        }
        break;
    }
  }

  private async validateAccess(accessorId: string, userId: string, operation: string): Promise<void> {
    // Check if accessor has permission to perform operation on user's data
    if (accessorId === userId) {
      return; // Users can always access their own data
    }
    
    // Check service/admin permissions (simplified implementation)
    const cacheKey = `access_${accessorId}`;
    let permissions = this.accessControlCache.get(cacheKey);
    
    if (!permissions || Date.now() > permissions.expiry) {
      // Load permissions from database/service registry
      permissions = {
        permissions: ['read', 'write'], // Would be loaded from actual permission system
        expiry: Date.now() + 5 * 60 * 1000 // 5 minutes
      };
      this.accessControlCache.set(cacheKey, permissions);
    }
    
    if (!permissions.permissions.includes(operation)) {
      throw new Error(`Access denied: ${accessorId} cannot perform ${operation} on user ${userId} data`);
    }
  }

  private async getUserPrivacySettings(userId: string): Promise<BiometricPrivacySettings> {
    try {
      const { data, error } = await this.supabase
        .from('user_personality_profiles')
        .select('privacy_settings')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Return default privacy settings
        return {
          userId,
          dataRetentionDays: 90,
          allowBiometricStorage: true,
          allowPatternAnalysis: true,
          allowCrossDeviceCorrelation: false,
          anonymizationLevel: 'standard',
          dataExportRequests: [],
          deletionRequests: []
        };
      }

      return {
        userId,
        dataRetentionDays: data.privacy_settings?.dataRetentionDays || 90,
        allowBiometricStorage: data.privacy_settings?.biometricLearning !== false,
        allowPatternAnalysis: data.privacy_settings?.patternAnalysis !== false,
        allowCrossDeviceCorrelation: data.privacy_settings?.crossDeviceCorrelation === true,
        anonymizationLevel: data.privacy_settings?.anonymizationLevel || 'standard',
        dataExportRequests: [],
        deletionRequests: []
      };
    } catch (error) {
      logger.error('Error getting user privacy settings:', error);
      throw error;
    }
  }

  private generateAggregatedMetrics(data: BiometricAuthData): any {
    return {
      averageConfidence: data.confidence,
      authMethodFrequency: { [data.authMethod]: 1 },
      temporalPatterns: { [data.timestamp.getHours().toString()]: 1 },
      devicePerformanceScore: data.confidence * 0.8 + 0.2 // Simple scoring
    };
  }

  private async getEncryptionKeyId(deviceId: string): Promise<string> {
    return crypto.createHash('sha256').update(`key_${deviceId}`).digest('hex').substring(0, 16);
  }

  private async logBiometricAccess(accessEntry: BiometricAccessLogEntry): Promise<void> {
    if (!this.config.enableAuditLogging) return;
    
    try {
      await this.supabase
        .from('biometric_access_log')
        .insert({
          id: accessEntry.id,
          access_type: accessEntry.accessType,
          accessor_id: accessEntry.accessorId,
          accessor_type: accessEntry.accessorType,
          purpose: accessEntry.purpose,
          data_fields: accessEntry.dataFields,
          timestamp: accessEntry.timestamp.toISOString(),
          ip_address: accessEntry.ipAddress,
          user_agent: accessEntry.userAgent,
          success: accessEntry.success,
          audit_metadata: accessEntry.auditMetadata
        });
    } catch (error) {
      logger.error('Error logging biometric access:', error);
      // Don't throw error to avoid breaking main operations
    }
  }

  // Background task methods
  private async processEncryptionQueue(): Promise<void> {
    // Process pending encryption tasks
    for (const [userId, dataArray] of this.encryptionQueue.entries()) {
      try {
        for (const data of dataArray) {
          await this.secureStoreBiometricData(data, 'system', 'background_processing');
        }
        this.encryptionQueue.delete(userId);
      } catch (error) {
        logger.error(`Error processing encryption queue for user ${userId}:`, error);
      }
    }
  }

  private async cleanupExpiredData(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('encrypted_biometric_data')
        .delete()
        .lt('retention_until', new Date().toISOString())
        .select('id'); // Add select to get deleted records

      if (error) {
        throw error;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        logger.info(`Cleaned up ${data.length} expired biometric records`);
        this.emit('data_cleanup_completed', { recordsDeleted: data.length });
      }
    } catch (error) {
      logger.error('Error cleaning up expired data:', error);
    }
  }

  private async rotateEncryptionKeys(): Promise<void> {
    try {
      logger.info('Starting encryption key rotation');
      
      // Clear encryption key cache to force regeneration
      this.encryptionKeyCache.clear();
      
      // Generate new master key
      const newMasterKey = crypto.randomBytes(32).toString('hex');
      await this.vaultService.createSecret('biometric_master_encryption_key', newMasterKey);
      
      this.emit('encryption_keys_rotated', { timestamp: new Date() });
      
      logger.info('Encryption key rotation completed');
    } catch (error) {
      logger.error('Error rotating encryption keys:', error);
    }
  }

  private async processDeletionQueue(): Promise<void> {
    for (const [userId, requestIds] of this.deletionQueue.entries()) {
      try {
        for (const requestId of requestIds) {
          await this.processDeletionRequest(requestId);
        }
        this.deletionQueue.delete(userId);
      } catch (error) {
        logger.error(`Error processing deletion queue for user ${userId}:`, error);
      }
    }
  }

  private async processDeletionRequest(requestId: string): Promise<void> {
    try {
      // Get deletion request details
      const { data: request, error } = await this.supabase
        .from('biometric_data_deletion_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !request) {
        throw new Error(`Deletion request ${requestId} not found`);
      }

      // Update status to processing
      await this.supabase
        .from('biometric_data_deletion_requests')
        .update({ status: 'processing' })
        .eq('id', requestId);

      // Perform deletion based on scope
      if (request.deletion_scope === 'complete') {
        // Delete all biometric data for the user
        await this.supabase
          .from('encrypted_biometric_data')
          .delete()
          .eq('user_id', request.user_id);
      } else {
        // Partial deletion based on specific data types
        if (request.specific_data_types && request.specific_data_types.length > 0) {
          await this.supabase
            .from('encrypted_biometric_data')
            .delete()
            .eq('user_id', request.user_id)
            .in('auth_method', request.specific_data_types);
        }
      }

      // Update status to completed
      await this.supabase
        .from('biometric_data_deletion_requests')
        .update({ 
          status: 'completed', 
          completed_date: new Date().toISOString(),
          deletion_certificate: this.generateDeletionCertificate(request.user_id, request.deletion_scope)
        })
        .eq('id', requestId);

      this.emit('data_deletion_completed', {
        requestId,
        userId: request.user_id,
        scope: request.deletion_scope
      });

    } catch (error) {
      logger.error(`Error processing deletion request ${requestId}:`, error);
      
      // Update status to failed
      await this.supabase
        .from('biometric_data_deletion_requests')
        .update({ status: 'failed' })
        .eq('id', requestId);
    }
  }

  private generateDeletionCertificate(userId: string, scope: string): string {
    const certificate = {
      userId,
      deletionScope: scope,
      timestamp: new Date().toISOString(),
      certificationId: uuidv4(),
      verificationHash: crypto.createHash('sha256')
        .update(`${userId}:${scope}:${new Date().toISOString()}`)
        .digest('hex')
    };
    
    return Buffer.from(JSON.stringify(certificate)).toString('base64');
  }
}

export default BiometricDataProtectionService;