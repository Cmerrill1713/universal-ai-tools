/**
 * Memory Best Practices Rule System
 * Enforces data quality, accuracy, and integrity standards for AI memory storage
 */

import { LogContext, log } from './logger.js';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  type: 'conversation' | 'knowledge' | 'context' | 'preference';
  metadata: {
    source?: string;
    agentName?: string;
    timestamp: string;
    tags?: string[];
    importance?: number;
    accessCount: number;
    lastAccessed?: string;
    verificationStatus?: 'unverified' | 'verified' | 'disputed' | 'deprecated';
    confidence?: number;
    parentMemory?: string;
    lastUpdated?: string;
  };
  embedding?: number[];
}

export interface ValidationRule {
  id: string;
  name: string;
  category: 'content' | 'metadata' | 'accuracy' | 'privacy' | 'performance';
  severity: 'error' | 'warning' | 'info';
  description: string;
  validator: (memory: Memory) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  suggestions?: string[];
  autoFix?: () => Memory;
}

export interface RuleViolation {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestions: string[];
  canAutoFix: boolean;
}

export class MemoryBestPracticesEngine {
  private static instance: MemoryBestPracticesEngine;
  private rules: Map<string, ValidationRule> = new Map();
  private violations: Map<string, RuleViolation[]> = new Map(); // memoryId -> violations

  private constructor() {
    this.initializeRules();
  }

  public static getInstance(): MemoryBestPracticesEngine {
    if (!MemoryBestPracticesEngine.instance) {
      MemoryBestPracticesEngine.instance = new MemoryBestPracticesEngine();
    }
    return MemoryBestPracticesEngine.instance;
  }

  /**
   * Initialize comprehensive best practices rules
   */
  private initializeRules(): void {
    const rules: ValidationRule[] = [
      // CONTENT QUALITY RULES
      {
        id: 'content_min_length',
        name: 'Minimum Content Length',
        category: 'content',
        severity: 'error',
        description: 'Content must have at least 1 character and be meaningful',
        validator: (memory: Memory) => {
          // Check for null, undefined, or empty content
          if (!memory.content || memory.content.trim().length === 0) {
            return {
              passed: false,
              message: 'Content cannot be empty or null',
              suggestions: ['Provide meaningful content', 'Add descriptive text', 'Include relevant information']
            };
          }
          
          const passed = memory.content.length >= 10;
          return {
            passed,
            message: !passed 
              ? `Content too short (${memory.content.length} chars). Minimum 10 characters recommended.`
              : 'Content length is appropriate',
            suggestions: !passed 
              ? ['Add more descriptive details', 'Include context information', 'Expand abbreviations']
              : []
          };
        }
      },

      {
        id: 'content_max_length',
        name: 'Maximum Content Length',
        category: 'content',
        severity: 'warning',
        description: 'Content should not exceed 10,000 characters for optimal performance',
        validator: (memory: Memory) => ({
          passed: memory.content.length <= 10000,
          message: memory.content.length > 10000 
            ? `Content too long (${memory.content.length} chars). Consider splitting into multiple memories.`
            : 'Content length is within optimal range',
          suggestions: memory.content.length > 10000 
            ? ['Split into multiple related memories', 'Summarize key points', 'Use references to external sources']
            : []
        })
      },

      {
        id: 'content_no_pii',
        name: 'No Personal Information',
        category: 'privacy',
        severity: 'error',
        description: 'Content should not contain personal identifiable information',
        validator: (memory: Memory) => {
          const piiPatterns = [
            // SSN patterns (various formats) - but not simple test strings
            /\b\d{3}-\d{2}-\d{4}\b/, // 123-45-6789
            /(?<!\d)\d{9}(?!\d)/, // 123456789 (exactly 9 digits, not part of longer number)
            /\b\d{3}\s\d{2}\s\d{4}\b/, // 123 45 6789
            
            // Credit card patterns (various formats)
            /(?<!\d)\d{16}(?!\d)/, // 1234567890123456 (exactly 16 digits)
            /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // 1234-5678-9012-3456
            /\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/, // 1234 5678 9012 3456
            
            // Email patterns
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
            
            // Phone number patterns (more specific to avoid false positives)
            /\b\d{3}-\d{3}-\d{4}\b/, // 555-123-4567
            /\b\(\d{3}\)\s?\d{3}-\d{4}\b/, // (555) 123-4567 or (555)123-4567
            /\b\d{3}\.\d{3}\.\d{4}\b/, // 555.123.4567
            // More specific 10-digit phone pattern - avoid simple test strings
            /\b[2-9]\d{2}[2-9]\d{6}\b/ // US phone format (area code 200-999, exchange 200-999)
          ];
          
          const detectedPatterns = piiPatterns.filter(pattern => pattern.test(memory.content));
          return {
            passed: detectedPatterns.length === 0,
            message: detectedPatterns.length > 0 
              ? 'Content contains potential PII. Remove personal information before storing.'
              : 'No PII detected in content',
            suggestions: detectedPatterns.length > 0 
              ? ['Anonymize personal data', 'Use placeholder values', 'Remove sensitive information']
              : []
          };
        }
      },

      {
        id: 'content_language_appropriate',
        name: 'Appropriate Language',
        category: 'content',
        severity: 'warning',
        description: 'Content should use professional and appropriate language',
        validator: (memory: Memory) => {
          const inappropriateWords = ['fuck', 'shit', 'damn']; // Basic example
          const hasInappropriate = inappropriateWords.some(word => 
            memory.content.toLowerCase().includes(word.toLowerCase())
          );
          
          return {
            passed: !hasInappropriate,
            message: hasInappropriate 
              ? 'Content contains potentially inappropriate language'
              : 'Content language is appropriate',
            suggestions: hasInappropriate 
              ? ['Use professional terminology', 'Replace with neutral language', 'Consider context appropriateness']
              : []
          };
        }
      },

      // METADATA QUALITY RULES
      {
        id: 'metadata_required_fields',
        name: 'Required Metadata Fields',
        category: 'metadata',
        severity: 'error',
        description: 'Essential metadata fields must be present',
        validator: (memory: Memory) => {
          const missing = [];
          if (!memory.metadata.timestamp) missing.push('timestamp');
          if (!memory.metadata.source) missing.push('source');
          if (memory.metadata.importance === undefined) missing.push('importance');
          
          return {
            passed: missing.length === 0,
            message: missing.length > 0 
              ? `Missing required metadata: ${missing.join(', ')}`
              : 'All required metadata present',
            suggestions: missing.length > 0 
              ? ['Add timestamp for when memory was created', 'Specify source of information', 'Set importance level (0-1)']
              : [],
            autoFix: missing.length > 0 ? () => ({
              ...memory,
              metadata: {
                ...memory.metadata,
                timestamp: memory.metadata.timestamp || new Date().toISOString(),
                source: memory.metadata.source || 'unknown',
                importance: memory.metadata.importance ?? 0.5
              }
            }) : undefined
          };
        }
      },

      {
        id: 'metadata_tags_quality',
        name: 'Tag Quality Standards',
        category: 'metadata',
        severity: 'warning',
        description: 'Tags should follow naming conventions and be meaningful',
        validator: (memory: Memory) => {
          const tags = memory.metadata.tags || [];
          const issues = [];
          
          // Check for minimum tags
          if (tags.length === 0) {
            issues.push('No tags provided for categorization');
          }
          
          // Check tag quality
          const invalidTags = tags.filter(tag => 
            tag.length < 2 || tag.length > 30 || /[^a-zA-Z0-9_-]/.test(tag)
          );
          
          if (invalidTags.length > 0) {
            issues.push(`Invalid tags: ${invalidTags.join(', ')}`);
          }
          
          return {
            passed: issues.length === 0,
            message: issues.length > 0 ? issues.join('; ') : 'Tags meet quality standards',
            suggestions: [
              'Use descriptive, single-word tags',
              'Keep tags between 2-30 characters',
              'Use only letters, numbers, hyphens, and underscores',
              'Include at least 2-3 relevant tags'
            ]
          };
        }
      },

      {
        id: 'metadata_importance_range',
        name: 'Importance Score Range',
        category: 'metadata',
        severity: 'error',
        description: 'Importance must be between 0 and 1',
        validator: (memory: Memory) => {
          const importance = memory.metadata.importance;
          const isValid = importance !== undefined && importance >= 0 && importance <= 1;
          
          return {
            passed: isValid,
            message: !isValid 
              ? `Invalid importance score: ${importance}. Must be between 0 and 1.`
              : 'Importance score is within valid range',
            suggestions: !isValid 
              ? ['Set importance between 0 (low) and 1 (critical)', 'Use 0.5 for moderate importance']
              : [],
            autoFix: !isValid ? () => ({
              ...memory,
              metadata: {
                ...memory.metadata,
                importance: Math.max(0, Math.min(1, importance || 0.5))
              }
            }) : undefined
          };
        }
      },

      // ACCURACY & VERIFICATION RULES
      {
        id: 'knowledge_needs_verification',
        name: 'Knowledge Verification Required',
        category: 'accuracy',
        severity: 'info',
        description: 'Knowledge-type memories should be verified for accuracy',
        validator: (memory: Memory) => {
          if (memory.type !== 'knowledge') {
            return { passed: true, message: 'Non-knowledge memory, verification not required' };
          }
          
          const hasVerification = memory.metadata.verificationStatus !== undefined;
          return {
            passed: hasVerification,
            message: hasVerification 
              ? `Knowledge verified as: ${memory.metadata.verificationStatus}`
              : 'Knowledge memory lacks verification status',
            suggestions: !hasVerification 
              ? ['Add verification status', 'Cross-check facts with reliable sources', 'Use AI verification system']
              : []
          };
        }
      },

      {
        id: 'research_source_credibility',
        name: 'Source Credibility Check',
        category: 'accuracy',
        severity: 'warning',
        description: 'Research should come from credible sources',
        validator: (memory: Memory) => {
          const source = memory.metadata.source?.toLowerCase() || '';
          
          // Define credible source patterns
          const credibleSources = [
            'academic_paper', 'peer_reviewed', 'official_documentation', 
            'government_source', 'established_publication', 'primary_research',
            'web_research', 'mlx_verification', 'self_verification'
          ];
          
          const isCredible = credibleSources.some(pattern => source.includes(pattern));
          
          return {
            passed: isCredible || memory.type !== 'knowledge',
            message: !isCredible && memory.type === 'knowledge'
              ? `Questionable source credibility: ${source}`
              : 'Source appears credible or memory type doesn\'t require verification',
            suggestions: !isCredible && memory.type === 'knowledge'
              ? ['Verify information with additional sources', 'Add source credibility assessment', 'Include publication date and author']
              : []
          };
        }
      },

      // PERFORMANCE RULES
      {
        id: 'embedding_efficiency',
        name: 'Embedding Efficiency',
        category: 'performance',
        severity: 'info',
        description: 'Memories should have vector embeddings for efficient search',
        validator: (memory: Memory) => ({
          passed: memory.embedding !== undefined,
          message: memory.embedding 
            ? 'Vector embedding present for efficient search'
            : 'No vector embedding - search performance may be limited',
          suggestions: memory.embedding 
            ? [] 
            : ['Generate vector embedding for content', 'Enable semantic search capabilities']
        })
      },

      {
        id: 'duplicate_content_check',
        name: 'Duplicate Content Detection',
        category: 'performance',
        severity: 'warning',
        description: 'Avoid storing duplicate or near-duplicate content',
        validator: (memory: Memory) => {
          // This would need access to other memories to check for duplicates
          // For now, check for obviously duplicate content patterns
          const hasRepeatingPatterns = /(.{10,})\1{2,}/.test(memory.content);
          
          return {
            passed: !hasRepeatingPatterns,
            message: hasRepeatingPatterns 
              ? 'Content contains repetitive patterns that may indicate duplication'
              : 'No obvious content duplication detected',
            suggestions: hasRepeatingPatterns 
              ? ['Remove repetitive text', 'Check for existing similar memories', 'Consolidate related information']
              : []
          };
        }
      }
    ];

    // Register all rules
    rules.forEach(rule => {
      this.rules.set(rule.id, rule);
      log.info(`Registered memory rule: ${rule.name}`, LogContext.SYSTEM);
    });

    log.info(`Memory best practices engine initialized with ${rules.length} rules`, LogContext.SYSTEM);
  }

  /**
   * Validate a memory against all applicable rules
   */
  public validateMemory(memory: Memory): {
    passed: boolean;
    violations: RuleViolation[];
    fixable: number;
    autoFixedMemory?: Memory;
  } {
    const violations: RuleViolation[] = [];
    let autoFixedMemory = { ...memory };
    let hasAutoFixes = false;

    for (const rule of this.rules.values()) {
      const result = rule.validator(memory);
      
      if (!result.passed) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: result.message,
          suggestions: result.suggestions || [],
          canAutoFix: !!result.autoFix
        });

        // Apply auto-fix if available
        if (result.autoFix) {
          autoFixedMemory = result.autoFix();
          hasAutoFixes = true;
        }
      }
    }

    // Store violations for this memory
    if (violations.length > 0) {
      this.violations.set(memory.id, violations);
    }

    const errorCount = violations.filter(v => v.severity === 'error').length;
    
    return {
      passed: errorCount === 0,
      violations,
      fixable: violations.filter(v => v.canAutoFix).length,
      autoFixedMemory: hasAutoFixes ? autoFixedMemory : undefined
    };
  }

  /**
   * Get validation report for a specific memory
   */
  public getValidationReport(memoryId: string): RuleViolation[] {
    return this.violations.get(memoryId) || [];
  }

  /**
   * Get system-wide validation statistics
   */
  public getValidationStats(): {
    totalMemoriesChecked: number;
    memoriesWithViolations: number;
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
  } {
    const totalMemoriesChecked = this.violations.size;
    const allViolations = Array.from(this.violations.values()).flat();
    
    const violationsByType: Record<string, number> = {};
    const violationsBySeverity: Record<string, number> = {};
    
    for (const violation of allViolations) {
      const rule = this.rules.get(violation.ruleId);
      if (rule) {
        violationsByType[rule.category] = (violationsByType[rule.category] || 0) + 1;
      }
      violationsBySeverity[violation.severity] = (violationsBySeverity[violation.severity] || 0) + 1;
    }

    return {
      totalMemoriesChecked,
      memoriesWithViolations: totalMemoriesChecked,
      totalViolations: allViolations.length,
      violationsByType,
      violationsBySeverity
    };
  }

  /**
   * Add custom rule
   */
  public addCustomRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
    log.info(`Added custom memory rule: ${rule.name}`, LogContext.SYSTEM);
  }

  /**
   * Remove rule
   */
  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    log.info(`Removed memory rule: ${ruleId}`, LogContext.SYSTEM);
  }

  /**
   * Get all rules
   */
  public getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Clear violations for a memory (after fixing)
   */
  public clearViolations(memoryId: string): void {
    this.violations.delete(memoryId);
  }
}

export default MemoryBestPracticesEngine;