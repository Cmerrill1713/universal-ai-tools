/**
 * Basic Content Filter Middleware
 * Simple content safety implementation for immediate deployment
 */

import type { NextFunction,Request, Response } from 'express';

interface ContentCheckResult {
  allowed: boolean;
  reason?: string;
  sanitized?: string;
}

// Harmful content patterns
const BLOCKED_PATTERNS = [
  // Malicious code
  /(?:rm\s+-rf|del\s+\/[sq]|format\s+[cd]:)/i,
  /(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)/i,
  /(?:eval\s*\(|exec\s*\(|system\s*\()/i,
  /(?:<script|javascript:|vbscript:|data:text\/html)/i,
  
  // Prompt injection
  /ignore\s+(?:previous|above|prior)\s+(?:instructions|prompts?|rules?)/i,
  /(?:pretend|act|behave)\s+(?:as|like)\s+(?:if|you\s+are)/i,
  /(?:override|bypass|disable)\s+(?:safety|security|guardrails?)/i,
  
  // Inappropriate content
  /(?:bomb|weapon|explosive)\s+(?:making|creation|assembly)/i,
  /(?:hack|crack|exploit)\s+(?:system|password|account)/i
];

// PII patterns for sanitization
const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN-REDACTED]' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD-REDACTED]' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL-REDACTED]' }
];

/**
 * Check content for harmful patterns
 */
function checkContent(content: string): ContentCheckResult {
  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      return {
        allowed: false,
        reason: 'Content contains prohibited material'
      };
    }
  }

  // Sanitize PII
  let sanitized = content;
  let hasPII = false;
  
  for (const pii of PII_PATTERNS) {
    if (pii.pattern.test(sanitized)) {
      sanitized = sanitized.replace(pii.pattern, pii.replacement);
      hasPII = true;
    }
  }

  return {
    allowed: true,
    sanitized: hasPII ? sanitized : undefined
  };
}

/**
 * Basic input content filter
 */
export const basicInputFilter = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Extract content to check
    let contentToCheck = '';
    
    if (req.body?.message) contentToCheck = req.body.message;
    else if (req.body?.prompt) contentToCheck = req.body.prompt;
    else if (req.body?.content) contentToCheck = req.body.content;
    else if (req.body?.query) contentToCheck = req.body.query;

    if (contentToCheck) {
      const result = checkContent(contentToCheck);
      
      if (!result.allowed) {
        console.log(`🛡️ Content blocked: ${result.reason}`);
        res.status(400).json({
          success: false,
          error: {
            code: 'CONTENT_BLOCKED',
            message: result.reason || 'Content not allowed'
          }
        });
        return;
      }

      // Apply sanitization if needed
      if (result.sanitized) {
        console.log('🧹 Content sanitized (PII removed)');
        if (req.body.message) req.body.message = result.sanitized;
        if (req.body.prompt) req.body.prompt = result.sanitized;
        if (req.body.content) req.body.content = result.sanitized;
        if (req.body.query) req.body.query = result.sanitized;
      }
    }

    next();
  } catch (error) {
    console.error('Content filter error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FILTER_ERROR',
        message: 'Content validation failed'
      }
    });
  }
};

/**
 * Basic output content filter
 */
export const basicOutputFilter = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function(data: any) {
    try {
      // Only filter successful AI responses
      if (res.statusCode >= 200 && res.statusCode < 300 && data) {
        let responseContent = '';
        
        if (typeof data === 'string') {
          responseContent = data;
        } else if (data?.data?.response) {
          responseContent = data.data.response;
        } else if (data?.response) {
          responseContent = data.response;
        } else if (data?.content) {
          responseContent = data.content;
        }

        if (responseContent) {
          const result = checkContent(responseContent);
          
          if (!result.allowed) {
            console.log(`🛡️ Response blocked: ${result.reason}`);
            const safeResponse = {
              success: false,
              error: {
                code: 'CONTENT_FILTERED',
                message: 'Response was filtered for safety reasons'
              }
            };
            return originalSend.call(this, safeResponse);
          }

          // Apply sanitization if needed
          if (result.sanitized) {
            console.log('🧹 Response sanitized (PII removed)');
            if (typeof data === 'string') {
              data = result.sanitized;
            } else if (data?.data?.response) {
              data.data.response = result.sanitized;
            } else if (data?.response) {
              data.response = result.sanitized;
            } else if (data?.content) {
              data.content = result.sanitized;
            }
          }
        }
      }
    } catch (error) {
      console.error('Output filter error:', error);
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Combined basic content safety middleware
 */
export const basicContentSafety = [basicInputFilter, basicOutputFilter];

export default basicContentSafety;