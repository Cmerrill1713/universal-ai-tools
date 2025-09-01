/**
 * Advanced Security Service
 * Phase 17: Advanced security and compliance implementation
 * Comprehensive security hardening, compliance monitoring, and threat detection
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { RedisService } from './redis-service';
import { advancedMonitoringService } from './advanced-monitoring-service';
import { createHash, randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const scryptAsync = promisify(scrypt);

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  metadata: Record<string, any>;
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  responseActions: string[];
}

export type SecurityEventType =
  | 'authentication_failure'
  | 'authorization_failure'
  | 'suspicious_activity'
  | 'data_breach_attempt'
  | 'rate_limit_exceeded'
  | 'malicious_payload'
  | 'unusual_access_pattern'
  | 'privilege_escalation_attempt'
  | 'data_exfiltration_attempt'
  | 'injection_attack'
  | 'xss_attempt'
  | 'csrf_attempt'
  | 'brute_force_attack'
  | 'ddos_attempt'
  | 'vulnerability_exploited';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityCondition {
  type: 'ip_range' | 'user_agent' | 'request_rate' | 'payload_size' | 'pattern_match' | 'geolocation';
  operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than' | 'in_range';
  value: any;
  field?: string;
}

export interface SecurityAction {
  type: 'block' | 'throttle' | 'alert' | 'log' | 'quarantine' | 'notify_admin' | 'require_mfa';
  parameters: Record<string, any>;
  delay?: number; // milliseconds
}

export interface ComplianceReport {
  id: string;
  framework: 'gdpr' | 'hipaa' | 'pci_dss' | 'sox' | 'iso27001' | 'custom';
  status: 'compliant' | 'non_compliant' | 'warning' | 'unknown';
  score: number; // 0-100
  findings: ComplianceFinding[];
  lastAssessment: Date;
  nextAssessment: Date;
  recommendations: string[];
}

export interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  requirement: string;
  status: 'open' | 'resolved' | 'mitigated' | 'risk_accepted';
  remediation: string;
  dueDate?: Date;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength?: number;
  keyDerivation: {
    algorithm: string;
    saltLength: number;
    iterations: number;
  };
}

class AdvancedSecurityService extends EventEmitter {
  private securityEvents = new Map<string, SecurityEvent>();
  private securityPolicies = new Map<string, SecurityPolicy>();
  private complianceReports = new Map<string, ComplianceReport>();
  private cache: RedisService;
  private encryptionConfig: EncryptionConfig;
  private masterKey: Buffer | null = null;
  private rateLimiters = new Map<string, any>();
  private blockedIps = new Set<string>();
  private trustedIps = new Set<string>();
  private suspiciousPatterns: RegExp[];

  constructor() {
    super();
    this.cache = RedisService.getInstance();
    this.encryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
      keyDerivation: {
        algorithm: 'scrypt',
        saltLength: 32,
        iterations: 100000
      }
    };
    
    this.initializeSuspiciousPatterns();
    this.initializeDefaultPolicies();
    this.startSecurityMonitoring();
    
    Logger.info('🛡️ Advanced Security Service initialized', {
      encryptionAlgorithm: this.encryptionConfig.algorithm,
      defaultPolicies: this.securityPolicies.size
    });
  }

  private initializeSuspiciousPatterns(): void {
    this.suspiciousPatterns = [
      // SQL Injection patterns
      /(\%27)|(\-\-)|(\%23)|(\%3B)|(;)/i,
      /((union(.*?)select)|(select(.*?)from)|(insert(.*?)into)|(drop(.*?)table))/i,
      
      // XSS patterns
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:|vbscript:|onload|onerror|onclick/i,
      
      // Path traversal
      /(\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c)/i,
      
      // Command injection
      /(;|&|\||>|<|\$\(|\`)/,
      /(wget|curl|nc|netcat|bash|sh|cmd|powershell)/i,
      
      // LDAP injection
      /(\%28)|(\%29)|(\%26)|(\%7c)|(\%2a)/i,
      
      // NoSQL injection
      /(\$gt|\$ne|\$in|\$regex|\$where)/i
    ];
  }

  private async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Rate Limiting Protection',
        description: 'Prevent abuse through rate limiting',
        enabled: true,
        severity: 'medium',
        conditions: [
          {
            type: 'request_rate',
            operator: 'greater_than',
            value: 100, // requests per minute
            field: 'requests_per_minute'
          }
        ],
        actions: [
          {
            type: 'throttle',
            parameters: { delay: 1000 }
          },
          {
            type: 'alert',
            parameters: { message: 'Rate limit exceeded' }
          }
        ]
      },
      {
        name: 'Malicious Payload Detection',
        description: 'Detect and block malicious payloads',
        enabled: true,
        severity: 'high',
        conditions: [
          {
            type: 'pattern_match',
            operator: 'regex',
            value: this.suspiciousPatterns,
            field: 'request_body'
          }
        ],
        actions: [
          {
            type: 'block',
            parameters: { duration: 3600000 } // 1 hour
          },
          {
            type: 'alert',
            parameters: { severity: 'high' }
          },
          {
            type: 'log',
            parameters: { level: 'error' }
          }
        ]
      },
      {
        name: 'Brute Force Protection',
        description: 'Detect and prevent brute force attacks',
        enabled: true,
        severity: 'high',
        conditions: [
          {
            type: 'request_rate',
            operator: 'greater_than',
            value: 10, // failed auth attempts per minute
            field: 'auth_failures_per_minute'
          }
        ],
        actions: [
          {
            type: 'block',
            parameters: { duration: 1800000 } // 30 minutes
          },
          {
            type: 'require_mfa',
            parameters: {}
          },
          {
            type: 'notify_admin',
            parameters: { priority: 'high' }
          }
        ]
      }
    ];

    for (const policyData of defaultPolicies) {
      const policy: SecurityPolicy = {
        ...policyData,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.securityPolicies.set(policy.id, policy);
    }
  }

  private startSecurityMonitoring(): void {
    // Monitor security events every 30 seconds
    setInterval(() => {
      this.analyzeSecurityTrends();
    }, 30000);

    // Clean up old events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000);

    Logger.info('🔍 Security monitoring started');
  }

  async recordSecurityEvent(
    type: SecurityEventType,
    description: string,
    metadata: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    source: string = 'system'
  ): Promise<string> {
    const eventId = this.generateId();
    const timestamp = new Date();

    const event: SecurityEvent = {
      id: eventId,
      type,
      severity,
      description,
      source,
      metadata: {
        ...metadata,
        timestamp: timestamp.toISOString()
      },
      timestamp,
      userId: metadata.userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      resolved: false,
      responseActions: []
    };

    this.securityEvents.set(eventId, event);

    // Cache in Redis for distributed access
    await this.cache.setEx(
      `security:event:${eventId}`,
      86400, // 24 hours
      JSON.stringify(event)
    );

    // Trigger security policies
    await this.evaluateSecurityPolicies(event);

    // Log event
    Logger.warn('🚨 Security event recorded', {
      eventId,
      type,
      severity,
      source,
      description: description.substring(0, 100)
    });

    // Record metrics
    advancedMonitoringService.recordMetric('security_events_total', 1, {
      type: 'counter',
      tags: { type, severity, source }
    });

    this.emit('securityEvent', event);

    return eventId;
  }

  async evaluateSecurityPolicies(event: SecurityEvent): Promise<void> {
    for (const policy of this.securityPolicies.values()) {
      if (!policy.enabled) continue;

      const matches = await this.evaluateConditions(policy.conditions, event);
      
      if (matches) {
        Logger.info('🎯 Security policy triggered', {
          policyId: policy.id,
          policyName: policy.name,
          eventId: event.id
        });

        await this.executeSecurityActions(policy.actions, event);
      }
    }
  }

  private async evaluateConditions(
    conditions: SecurityCondition[],
    event: SecurityEvent
  ): Promise<boolean> {
    for (const condition of conditions) {
      if (!(await this.evaluateCondition(condition, event))) {
        return false; // All conditions must match
      }
    }
    return true;
  }

  private async evaluateCondition(
    condition: SecurityCondition,
    event: SecurityEvent
  ): Promise<boolean> {
    const { type, operator, value, field } = condition;
    let eventValue: any;

    // Extract value from event based on field
    if (field) {
      eventValue = this.getNestedValue(event, field);
    } else {
      eventValue = event;
    }

    switch (type) {
      case 'pattern_match':
        if (operator === 'regex') {
          const patterns = Array.isArray(value) ? value : [value];
          return patterns.some((pattern: RegExp) => pattern.test(String(eventValue)));
        }
        return String(eventValue).includes(String(value));

      case 'request_rate':
        // Check rate from Redis
        const key = `security:rate:${event.ipAddress || event.userId || 'unknown'}`;
        const currentRate = await this.cache.get(key);
        return parseInt(currentRate || '0') > value;

      case 'ip_range':
        // Simplified IP range check
        return this.isIpInRange(event.ipAddress || '', value);

      case 'user_agent':
        if (operator === 'contains') {
          return String(event.userAgent || '').toLowerCase().includes(String(value).toLowerCase());
        }
        return event.userAgent === value;

      case 'payload_size':
        const size = event.metadata?.payloadSize || 0;
        return operator === 'greater_than' ? size > value : size < value;

      default:
        return false;
    }
  }

  private async executeSecurityActions(
    actions: SecurityAction[],
    event: SecurityEvent
  ): Promise<void> {
    for (const action of actions) {
      try {
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay));
        }

        switch (action.type) {
          case 'block':
            await this.blockSource(event, action.parameters);
            break;

          case 'throttle':
            await this.throttleSource(event, action.parameters);
            break;

          case 'alert':
            await this.sendSecurityAlert(event, action.parameters);
            break;

          case 'quarantine':
            await this.quarantineEvent(event);
            break;

          case 'notify_admin':
            await this.notifyAdministrators(event, action.parameters);
            break;

          case 'log':
            this.logSecurityEvent(event, action.parameters);
            break;
        }

        event.responseActions.push(`${action.type}:${JSON.stringify(action.parameters)}`);

      } catch (error) {
        Logger.error('❌ Failed to execute security action', {
          action: action.type,
          eventId: event.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async blockSource(event: SecurityEvent, parameters: Record<string, any>): Promise<void> {
    if (event.ipAddress) {
      this.blockedIps.add(event.ipAddress);
      
      const duration = parameters.duration || 3600000; // Default 1 hour
      await this.cache.setEx(
        `security:blocked:${event.ipAddress}`,
        Math.floor(duration / 1000),
        JSON.stringify({
          reason: event.description,
          blockedAt: new Date().toISOString(),
          eventId: event.id
        })
      );

      Logger.warn('🚫 IP address blocked', {
        ip: event.ipAddress,
        duration: duration,
        reason: event.description
      });
    }
  }

  private async throttleSource(event: SecurityEvent, parameters: Record<string, any>): Promise<void> {
    const delay = parameters.delay || 1000;
    const key = `security:throttle:${event.ipAddress || event.userId || 'unknown'}`;
    
    await this.cache.setEx(key, 60, String(delay));
    
    Logger.info('🐌 Source throttled', {
      source: event.ipAddress || event.userId,
      delay,
      eventId: event.id
    });
  }

  async encryptSensitiveData(data: string, password?: string): Promise<{
    encrypted: string;
    salt: string;
    iv: string;
    tag: string;
  }> {
    const salt = randomBytes(this.encryptionConfig.keyDerivation.saltLength);
    const iv = randomBytes(this.encryptionConfig.ivLength);
    
    // Derive key from password or use master key
    const keyMaterial = password ? 
      await scryptAsync(password, salt, this.encryptionConfig.keyLength) as Buffer :
      this.getMasterKey();
    
    const cipher = createCipheriv(this.encryptionConfig.algorithm, keyMaterial, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  async decryptSensitiveData(
    encryptedData: {
      encrypted: string;
      salt: string;
      iv: string;
      tag: string;
    },
    password?: string
  ): Promise<string> {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    // Derive key from password or use master key
    const keyMaterial = password ?
      await scryptAsync(password, salt, this.encryptionConfig.keyLength) as Buffer :
      this.getMasterKey();
    
    const decipher = createDecipheriv(this.encryptionConfig.algorithm, keyMaterial, iv);
    (decipher as any).setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async generateComplianceReport(framework: ComplianceReport['framework']): Promise<string> {
    const reportId = this.generateId();
    
    const findings: ComplianceFinding[] = await this.assessCompliance(framework);
    const score = this.calculateComplianceScore(findings);
    const status = this.determineComplianceStatus(score, findings);
    
    const report: ComplianceReport = {
      id: reportId,
      framework,
      status,
      score,
      findings,
      lastAssessment: new Date(),
      nextAssessment: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      recommendations: this.generateRecommendations(findings)
    };

    this.complianceReports.set(reportId, report);

    Logger.info('📋 Compliance report generated', {
      reportId,
      framework,
      status,
      score,
      findingsCount: findings.length
    });

    return reportId;
  }

  private async assessCompliance(framework: ComplianceReport['framework']): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    switch (framework) {
      case 'gdpr':
        findings.push(...await this.assessGDPRCompliance());
        break;
      case 'hipaa':
        findings.push(...await this.assessHIPAACompliance());
        break;
      case 'pci_dss':
        findings.push(...await this.assessPCIDSSCompliance());
        break;
      case 'iso27001':
        findings.push(...await this.assessISO27001Compliance());
        break;
      default:
        findings.push({
          id: this.generateId(),
          severity: 'medium',
          category: 'general',
          description: 'Framework-specific assessment not implemented',
          requirement: 'N/A',
          status: 'open',
          remediation: 'Implement specific compliance assessment for this framework'
        });
    }

    return findings;
  }

  private async assessGDPRCompliance(): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Data Protection Impact Assessment
    findings.push({
      id: this.generateId(),
      severity: 'high',
      category: 'data_protection',
      description: 'Data Protection Impact Assessment required for high-risk processing',
      requirement: 'Article 35 GDPR',
      status: 'open',
      remediation: 'Conduct DPIA for AI processing activities involving personal data'
    });

    // Consent Management
    findings.push({
      id: this.generateId(),
      severity: 'medium',
      category: 'consent',
      description: 'Implement granular consent management system',
      requirement: 'Article 7 GDPR',
      status: 'open',
      remediation: 'Deploy consent management platform with withdrawal capabilities'
    });

    // Data Minimization
    findings.push({
      id: this.generateId(),
      severity: 'medium',
      category: 'data_minimization',
      description: 'Review data collection practices for necessity and proportionality',
      requirement: 'Article 5(1)(c) GDPR',
      status: 'open',
      remediation: 'Audit data collection points and implement data minimization controls'
    });

    return findings;
  }

  private async assessHIPAACompliance(): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Access Controls
    findings.push({
      id: this.generateId(),
      severity: 'high',
      category: 'access_control',
      description: 'Implement role-based access controls for PHI',
      requirement: '164.312(a)(1)',
      status: 'open',
      remediation: 'Deploy RBAC system with minimum necessary access principles'
    });

    // Audit Controls
    findings.push({
      id: this.generateId(),
      severity: 'medium',
      category: 'audit',
      description: 'Enhance audit logging for PHI access and modifications',
      requirement: '164.312(b)',
      status: 'open',
      remediation: 'Implement comprehensive audit logging and monitoring'
    });

    return findings;
  }

  private async assessPCIDSSCompliance(): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Network Security
    findings.push({
      id: this.generateId(),
      severity: 'critical',
      category: 'network_security',
      description: 'Implement network segmentation for cardholder data environment',
      requirement: 'PCI DSS 1.2',
      status: 'open',
      remediation: 'Deploy network segmentation and access controls'
    });

    return findings;
  }

  private async assessISO27001Compliance(): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Information Security Policy
    findings.push({
      id: this.generateId(),
      severity: 'medium',
      category: 'policy',
      description: 'Document comprehensive information security policy',
      requirement: 'A.5.1.1',
      status: 'open',
      remediation: 'Create and approve information security policy document'
    });

    return findings;
  }

  isIpBlocked(ip: string): boolean {
    return this.blockedIps.has(ip);
  }

  async checkThrottling(identifier: string): Promise<number> {
    const throttleData = await this.cache.get(`security:throttle:${identifier}`);
    return throttleData ? parseInt(throttleData) : 0;
  }

  // Helper methods
  private getMasterKey(): Buffer {
    if (!this.masterKey) {
      // In production, this should come from a secure key management system
      this.masterKey = createHash('sha256')
        .update(process.env.ENCRYPTION_MASTER_KEY || 'default-unsafe-key')
        .digest();
    }
    return this.masterKey;
  }

  private generateId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isIpInRange(ip: string, range: string): boolean {
    // Simplified IP range check - in production use a proper IP library
    return ip.startsWith(range.split('/')[0].split('.').slice(0, 2).join('.'));
  }

  private calculateComplianceScore(findings: ComplianceFinding[]): number {
    if (findings.length === 0) return 100;

    const weights = { critical: 25, high: 15, medium: 10, low: 5 };
    const totalDeductions = findings.reduce((sum, finding) => {
      return sum + (weights[finding.severity] || 5);
    }, 0);

    return Math.max(0, 100 - totalDeductions);
  }

  private determineComplianceStatus(
    score: number,
    findings: ComplianceFinding[]
  ): ComplianceReport['status'] {
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    
    if (criticalFindings > 0) return 'non_compliant';
    if (score >= 90) return 'compliant';
    if (score >= 70) return 'warning';
    return 'non_compliant';
  }

  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations = new Set<string>();

    findings.forEach(finding => {
      switch (finding.category) {
        case 'access_control':
          recommendations.add('Implement multi-factor authentication for all admin accounts');
          recommendations.add('Conduct regular access reviews and privilege audits');
          break;
        case 'data_protection':
          recommendations.add('Deploy data loss prevention (DLP) solutions');
          recommendations.add('Implement data classification and labeling system');
          break;
        case 'network_security':
          recommendations.add('Deploy intrusion detection and prevention systems');
          recommendations.add('Implement network segmentation and micro-segmentation');
          break;
        case 'audit':
          recommendations.add('Enhance security logging and monitoring capabilities');
          recommendations.add('Implement security information and event management (SIEM)');
          break;
      }
    });

    return Array.from(recommendations);
  }

  private async analyzeSecurityTrends(): Promise<void> {
    // Analyze trends in security events
    const recentEvents = Array.from(this.securityEvents.values())
      .filter(event => event.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000));

    if (recentEvents.length > 0) {
      const eventsByType = recentEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Logger.info('🔍 Security trends analysis', {
        totalEvents: recentEvents.length,
        eventsByType,
        highSeverityEvents: recentEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length
      });
    }
  }

  private cleanupOldEvents(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [id, event] of this.securityEvents.entries()) {
      if (event.timestamp < cutoff) {
        this.securityEvents.delete(id);
      }
    }
  }

  private async sendSecurityAlert(event: SecurityEvent, parameters: Record<string, any>): Promise<void> {
    Logger.warn('🚨 Security Alert', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      description: event.description,
      parameters
    });

    // In production, integrate with alerting systems (email, Slack, PagerDuty, etc.)
    this.emit('securityAlert', { event, parameters });
  }

  private async quarantineEvent(event: SecurityEvent): Promise<void> {
    event.metadata.quarantined = true;
    event.metadata.quarantineTime = new Date().toISOString();
    
    Logger.warn('🔒 Event quarantined', {
      eventId: event.id,
      type: event.type
    });
  }

  private async notifyAdministrators(event: SecurityEvent, parameters: Record<string, any>): Promise<void> {
    Logger.warn('👨‍💼 Administrator notification', {
      eventId: event.id,
      priority: parameters.priority || 'medium',
      event: {
        type: event.type,
        severity: event.severity,
        description: event.description
      }
    });
  }

  private logSecurityEvent(event: SecurityEvent, parameters: Record<string, any>): void {
    const level = parameters.level || 'info';
    Logger[level as keyof typeof Logger]('🛡️ Security event logged', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      description: event.description,
      metadata: event.metadata
    });
  }

  // Public API methods
  async getSecurityEvents(filters: {
    type?: SecurityEventType;
    severity?: string;
    resolved?: boolean;
    from?: Date;
    to?: Date;
    limit?: number;
  } = {}): Promise<SecurityEvent[]> {
    let events = Array.from(this.securityEvents.values());

    // Apply filters
    if (filters.type) {
      events = events.filter(e => e.type === filters.type);
    }
    if (filters.severity) {
      events = events.filter(e => e.severity === filters.severity);
    }
    if (filters.resolved !== undefined) {
      events = events.filter(e => e.resolved === filters.resolved);
    }
    if (filters.from) {
      events = events.filter(e => e.timestamp >= filters.from!);
    }
    if (filters.to) {
      events = events.filter(e => e.timestamp <= filters.to!);
    }

    // Sort by timestamp (most recent first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  async getComplianceReport(reportId: string): Promise<ComplianceReport | null> {
    return this.complianceReports.get(reportId) || null;
  }

  async getSystemSecurityStatus(): Promise<{
    overallStatus: 'secure' | 'warning' | 'critical';
    activeThreats: number;
    blockedIps: number;
    complianceScore: number;
    lastAssessment: Date;
    recommendations: string[];
  }> {
    const recentEvents = await this.getSecurityEvents({
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      resolved: false
    });

    const criticalEvents = recentEvents.filter(e => e.severity === 'critical');
    const highEvents = recentEvents.filter(e => e.severity === 'high');

    let overallStatus: 'secure' | 'warning' | 'critical';
    if (criticalEvents.length > 0) {
      overallStatus = 'critical';
    } else if (highEvents.length > 3 || recentEvents.length > 10) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'secure';
    }

    // Get latest compliance report
    const reports = Array.from(this.complianceReports.values());
    const latestReport = reports.sort((a, b) => b.lastAssessment.getTime() - a.lastAssessment.getTime())[0];

    return {
      overallStatus,
      activeThreats: recentEvents.length,
      blockedIps: this.blockedIps.size,
      complianceScore: latestReport?.score || 0,
      lastAssessment: latestReport?.lastAssessment || new Date(0),
      recommendations: latestReport?.recommendations || []
    };
  }
}

export const advancedSecurityService = new AdvancedSecurityService();