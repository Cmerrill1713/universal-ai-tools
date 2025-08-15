/**
 * Input Guardrails Service
 * Comprehensive content filtering and safety validation for incoming requests
 */

import { z } from 'zod';

import { log, LogContext } from '../../utils/logger.js';

// Input validation schemas
const SafeTextSchema = z.string()
  .min(1, 'Input cannot be empty')
  .max(50000, 'Input exceeds maximum length')
  .refine(text => !containsUnsafeContent(text), 'Content contains prohibited material');

const SafeImageSchema = z.object({
  imageBase64: z.string().refine(isValidBase64Image, 'Invalid image format'),
  imagePath: z.string().optional(),
  options: z.object({
    maxSize: z.number().max(50 * 1024 * 1024).optional(), // 50MB max
    allowedFormats: z.array(z.enum(['jpg', 'jpeg', 'png', 'webp', 'gif'])).optional()
  }).optional()
});

interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  confidence: number;
  categories: string[];
  sanitizedContent?: string;
}

interface ContentCategory {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: RegExp[];
  action: 'warn' | 'block' | 'sanitize';
}

class InputGuardrailsService {
  private readonly blockedPatterns: ContentCategory[] = [
    {
      name: 'malicious_code',
      severity: 'critical',
      patterns: [
        /(?:rm\s+-rf|del\s+\/[sq]|format\s+[cd]:)/i,
        /(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)/i,
        /(?:eval\s*\(|exec\s*\(|system\s*\()/i,
        /(?:<script|javascript:|vbscript:|data:text\/html)/i,
        /(?:powershell|cmd\.exe|\/bin\/bash|\/bin\/sh)\s/i
      ],
      action: 'block'
    },
    {
      name: 'personal_info',
      severity: 'high',
      patterns: [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email (warning only)
        /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/ // Phone number
      ],
      action: 'sanitize'
    },
    {
      name: 'inappropriate_content',
      severity: 'high',
      patterns: [
        /(?:violent|harmful|dangerous)\s+(?:instructions|tutorial|guide)/i,
        /(?:bomb|weapon|explosive)\s+(?:making|creation|assembly)/i,
        /(?:hack|crack|exploit)\s+(?:system|password|account)/i
      ],
      action: 'block'
    },
    {
      name: 'prompt_injection',
      severity: 'critical',
      patterns: [
        /ignore\s+(?:previous|above|prior)\s+(?:instructions|prompts?|rules?)/i,
        /(?:pretend|act|behave)\s+(?:as|like)\s+(?:if|you\s+are)/i,
        /(?:override|bypass|disable)\s+(?:safety|security|guardrails?)/i,
        /(?:jailbreak|roleplay|character)\s+mode/i,
        /(?:system|admin|root)\s+(?:prompt|mode|access)/i
      ],
      action: 'block'
    },
    {
      name: 'excessive_requests',
      severity: 'medium',
      patterns: [
        /(?:generate|create|make)\s+(?:\d+|many|lots?\s+of|hundreds?|thousands?)/i,
        /(?:repeat|loop|iterate)\s+(?:\d+|many|endless)/i
      ],
      action: 'warn'
    }
  ];

  private readonly rateLimiter = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequestsPerHour = 100;
  private readonly maxRequestsPerMinute = 10;

  /**
   * Validate and filter input content
   */
  async validateInput(content: string, userId?: string, requestType?: string): Promise<GuardrailResult> {
    try {
      // Rate limiting check
      if (userId) {
        const rateLimitResult = this.checkRateLimit(userId);
        if (!rateLimitResult.allowed) {
          return {
            allowed: false,
            reason: 'Rate limit exceeded',
            confidence: 1.0,
            categories: ['rate_limit']
          };
        }
      }

      // Content length validation
      if (content.length > 50000) {
        return {
          allowed: false,
          reason: 'Content exceeds maximum length',
          confidence: 1.0,
          categories: ['length_violation']
        };
      }

      // Content safety analysis
      const safetyResult = this.analyzeSafety(content);
      
      // Log security events
      if (!safetyResult.allowed) {
        log.warn('🛡️ Input blocked by guardrails', LogContext.SECURITY, {
          userId,
          requestType,
          reason: safetyResult.reason,
          categories: safetyResult.categories,
          contentPreview: content.substring(0, 100) + '...'
        });
      }

      return safetyResult;

    } catch (error) {
      log.error('Guardrails validation failed', LogContext.SECURITY, { error });
      return {
        allowed: false,
        reason: 'Validation system error',
        confidence: 0.0,
        categories: ['system_error']
      };
    }
  }

  /**
   * Validate image content
   */
  async validateImage(imageData: { imageBase64?: string; imagePath?: string }, userId?: string): Promise<GuardrailResult> {
    try {
      // Basic format validation
      if (imageData.imageBase64) {
        if (!isValidBase64Image(imageData.imageBase64)) {
          return {
            allowed: false,
            reason: 'Invalid image format',
            confidence: 1.0,
            categories: ['format_violation']
          };
        }

        // Size check (base64 length approximates file size)
        const estimatedSize = (imageData.imageBase64.length * 3) / 4;
        if (estimatedSize > 50 * 1024 * 1024) { // 50MB
          return {
            allowed: false,
            reason: 'Image exceeds size limit',
            confidence: 1.0,
            categories: ['size_violation']
          };
        }
      }

      // Rate limiting for image uploads
      if (userId) {
        const rateLimitResult = this.checkRateLimit(userId, 'image');
        if (!rateLimitResult.allowed) {
          return {
            allowed: false,
            reason: 'Image upload rate limit exceeded',
            confidence: 1.0,
            categories: ['rate_limit']
          };
        }
      }

      return {
        allowed: true,
        confidence: 1.0,
        categories: ['safe_image']
      };

    } catch (error) {
      log.error('Image validation failed', LogContext.SECURITY, { error });
      return {
        allowed: false,
        reason: 'Image validation error',
        confidence: 0.0,
        categories: ['system_error']
      };
    }
  }

  /**
   * Analyze content safety
   */
  private analyzeSafety(content: string): GuardrailResult {
    const detectedCategories: string[] = [];
    let maxSeverity: ContentCategory['severity'] = 'low';
    let shouldBlock = false;
    let sanitizedContent = content;

    for (const category of this.blockedPatterns) {
      for (const pattern of category.patterns) {
        if (pattern.test(content)) {
          detectedCategories.push(category.name);
          
          if (category.severity === 'critical' || category.severity === 'high') {
            maxSeverity = category.severity;
          }

          switch (category.action) {
            case 'block':
              shouldBlock = true;
              break;
            case 'sanitize':
              sanitizedContent = content.replace(pattern, '[REDACTED]');
              break;
            case 'warn':
              // Log warning but allow content
              log.warn('Content warning detected', LogContext.SECURITY, {
                category: category.name,
                pattern: pattern.source
              });
              break;
          }
        }
      }
    }

    const confidence = detectedCategories.length > 0 ? 0.9 : 1.0;

    if (shouldBlock) {
      return {
        allowed: false,
        reason: `Content blocked: ${detectedCategories.join(', ')}`,
        confidence,
        categories: detectedCategories
      };
    }

    if (sanitizedContent !== content) {
      return {
        allowed: true,
        confidence,
        categories: detectedCategories,
        sanitizedContent
      };
    }

    return {
      allowed: true,
      confidence,
      categories: detectedCategories.length > 0 ? detectedCategories : ['safe']
    };
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(userId: string, type: 'text' | 'image' = 'text'): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const key = `${userId}_${type}`;
    const hourKey = `${key}_hour`;
    const minuteKey = `${key}_minute`;

    // Check hourly limit
    const hourlyData = this.rateLimiter.get(hourKey) || { count: 0, resetTime: now + 3600000 };
    if (now > hourlyData.resetTime) {
      hourlyData.count = 0;
      hourlyData.resetTime = now + 3600000;
    }

    // Check minute limit  
    const minuteData = this.rateLimiter.get(minuteKey) || { count: 0, resetTime: now + 60000 };
    if (now > minuteData.resetTime) {
      minuteData.count = 0;
      minuteData.resetTime = now + 60000;
    }

    const maxHourly = type === 'image' ? 20 : this.maxRequestsPerHour;
    const maxMinute = type === 'image' ? 2 : this.maxRequestsPerMinute;

    if (hourlyData.count >= maxHourly || minuteData.count >= maxMinute) {
      return { allowed: false, remaining: 0 };
    }

    // Increment counters
    hourlyData.count++;
    minuteData.count++;
    this.rateLimiter.set(hourKey, hourlyData);
    this.rateLimiter.set(minuteKey, minuteData);

    return { 
      allowed: true, 
      remaining: Math.min(maxHourly - hourlyData.count, maxMinute - minuteData.count) 
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimiter(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimiter.entries()) {
      if (now > data.resetTime) {
        this.rateLimiter.delete(key);
      }
    }
  }

  /**
   * Get guardrail statistics
   */
  getStats(): {
    totalBlocked: number;
    totalSanitized: number;
    categoryBreakdown: Record<string, number>;
    rateLimitActive: number;
  } {
    // This would typically be stored in a database
    // For now, return current in-memory state
    return {
      totalBlocked: 0, // Would track over time
      totalSanitized: 0, // Would track over time
      categoryBreakdown: {}, // Would track category frequencies
      rateLimitActive: this.rateLimiter.size
    };
  }
}

// Utility functions
function containsUnsafeContent(text: string): boolean {
  const service = new InputGuardrailsService();
  const result = service['analyzeSafety'](text); // Access private method for validation
  return !result.allowed;
}

function isValidBase64Image(base64: string): boolean {
  try {
    // Check if it's valid base64
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(base64)) {
      return false;
    }

    // Extract the actual base64 data
    const base64Data = base64.split(',')[1];
    if (!base64Data) return false;

    // Validate base64 format
    const validBase64 = /^[A-Za-z0-9+\/]+=*$/.test(base64Data);
    return validBase64;
  } catch {
    return false;
  }
}

export const inputGuardrailsService = new InputGuardrailsService();
export { InputGuardrailsService, SafeImageSchema,SafeTextSchema };
export type { GuardrailResult };