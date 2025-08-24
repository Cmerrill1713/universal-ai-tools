/**
 * Security Configuration Validator
 * Validates security headers configuration against OWASP standards
 * 
 * @version 1.0.0
 * @author Security Team
 * @date 2025-08-21
 */

import { log, LogContext } from '../utils/logger';

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100 security score
}

export interface SecurityConfigValidation {
  csp: {
    hasUnsafeInline: boolean;
    hasUnsafeEval: boolean;
    hasReporting: boolean;
    allowsHttps: boolean;
  };
  headers: {
    hasHSTS: boolean;
    hasFrameOptions: boolean;
    hasContentTypeOptions: boolean;
    hasReferrerPolicy: boolean;
  };
  environment: {
    isProduction: boolean;
    hasSecureDefaults: boolean;
  };
}

/**
 * Validates Content Security Policy configuration
 */
export function validateCSPConfiguration(csp: string): { errors: string[]; warnings: string[]; score: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Critical security checks
  if (!csp.includes("object-src 'none'")) {
    errors.push("Missing 'object-src none' - vulnerable to plugin-based attacks");
    score -= 20;
  }

  if (!csp.includes("frame-ancestors 'none'") && !csp.includes("frame-ancestors 'self'")) {
    errors.push("Missing 'frame-ancestors' directive - vulnerable to clickjacking");
    score -= 20;
  }

  if (!csp.includes("base-uri 'self'")) {
    errors.push("Missing 'base-uri self' - vulnerable to base tag injection");
    score -= 15;
  }

  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    if (csp.includes("'unsafe-inline'")) {
      warnings.push("Production CSP contains 'unsafe-inline' - consider using nonces");
      score -= 10;
    }

    if (csp.includes("'unsafe-eval'")) {
      errors.push("Production CSP contains 'unsafe-eval' - significant XSS risk");
      score -= 25;
    }

    if (!csp.includes('upgrade-insecure-requests')) {
      warnings.push("Missing 'upgrade-insecure-requests' in production");
      score -= 5;
    }

    if (!csp.includes('block-all-mixed-content')) {
      warnings.push("Missing 'block-all-mixed-content' in production");
      score -= 5;
    }
  }

  // Best practices
  if (!csp.includes('report-uri') && !csp.includes('report-to')) {
    warnings.push("No CSP violation reporting configured");
    score -= 5;
  }

  if (csp.includes('*') && !csp.includes('img-src')) {
    warnings.push("Wildcard (*) found in CSP - review for necessity");
    score -= 10;
  }

  return { errors, warnings, score: Math.max(0, score) };
}

/**
 * Validates all security headers configuration
 */
export function validateSecurityHeaders(headers: Record<string, string>): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalScore = 0;
  let maxScore = 0;

  // Content Security Policy validation
  if (headers['content-security-policy']) {
    const cspResult = validateCSPConfiguration(headers['content-security-policy']);
    errors.push(...cspResult.errors);
    warnings.push(...cspResult.warnings);
    totalScore += cspResult.score;
    maxScore += 100;
  } else {
    errors.push("Missing Content-Security-Policy header");
    maxScore += 100;
  }

  // HSTS validation (production only)
  if (process.env.NODE_ENV === 'production') {
    if (headers['strict-transport-security']) {
      const hsts = headers['strict-transport-security'];
      if (!hsts.includes('max-age=')) {
        errors.push("HSTS header missing max-age directive");
      } else {
        const maxAge = parseInt(hsts.match(/max-age=(\d+)/)?.[1] || '0');
        if (maxAge < 31536000) { // 1 year minimum
          warnings.push("HSTS max-age should be at least 1 year (31536000 seconds)");
          totalScore += 80;
        } else {
          totalScore += 100;
        }
      }
      
      if (!hsts.includes('includeSubDomains')) {
        warnings.push("HSTS should include 'includeSubDomains' for better security");
      }
      
      maxScore += 100;
    } else {
      errors.push("Missing Strict-Transport-Security header in production");
      maxScore += 100;
    }
  }

  // X-Frame-Options validation
  if (headers['x-frame-options']) {
    const xfo = headers['x-frame-options'].toUpperCase();
    if (['DENY', 'SAMEORIGIN'].includes(xfo)) {
      totalScore += 100;
    } else {
      warnings.push(`X-Frame-Options value '${xfo}' may not provide adequate protection`);
      totalScore += 50;
    }
    maxScore += 100;
  } else {
    errors.push("Missing X-Frame-Options header");
    maxScore += 100;
  }

  // X-Content-Type-Options validation
  if (headers['x-content-type-options'] === 'nosniff') {
    totalScore += 100;
  } else {
    errors.push("Missing or incorrect X-Content-Type-Options header");
  }
  maxScore += 100;

  // Referrer-Policy validation
  const secureReferrerPolicies = [
    'no-referrer',
    'no-referrer-when-downgrade',
    'strict-origin',
    'strict-origin-when-cross-origin'
  ];
  
  if (headers['referrer-policy']) {
    if (secureReferrerPolicies.includes(headers['referrer-policy'])) {
      totalScore += 100;
    } else {
      warnings.push(`Referrer-Policy '${headers['referrer-policy']}' may leak information`);
      totalScore += 70;
    }
    maxScore += 100;
  } else {
    warnings.push("Missing Referrer-Policy header");
    maxScore += 100;
  }

  // Permissions-Policy validation
  if (headers['permissions-policy']) {
    totalScore += 100;
  } else {
    warnings.push("Missing Permissions-Policy header");
    totalScore += 50;
  }
  maxScore += 100;

  // Cross-Origin policies validation
  const crossOriginHeaders = [
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy'
  ];
  
  let crossOriginScore = 0;
  crossOriginHeaders.forEach(header => {
    if (headers[header]) {
      crossOriginScore += 33.33;
    }
  });
  totalScore += crossOriginScore;
  maxScore += 100;

  // Security disclosure headers (should be removed)
  const dangerousHeaders = ['server', 'x-powered-by', 'x-aspnet-version'];
  let disclosureCount = 0;
  dangerousHeaders.forEach(header => {
    if (headers[header]) {
      warnings.push(`Header '${header}' discloses server information`);
      disclosureCount++;
    }
  });
  
  if (disclosureCount === 0) {
    totalScore += 100;
  } else {
    totalScore += Math.max(0, 100 - (disclosureCount * 30));
  }
  maxScore += 100;

  const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: finalScore
  };
}

/**
 * Validates environment-specific security configuration
 */
export function validateEnvironmentSecurity(): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Environment variable checks
  if (isProduction) {
    if (!process.env.CSP_REPORT_URI) {
      warnings.push("CSP_REPORT_URI not configured in production");
    }
    
    if (process.env.CSP_ENABLE_NONCE !== 'true') {
      warnings.push("Consider enabling CSP nonces in production (CSP_ENABLE_NONCE=true)");
    }
  }

  // Development environment warnings
  if (!isProduction) {
    if (process.env.CSP_ENABLE_NONCE === 'true') {
      warnings.push("CSP nonces enabled in development - may cause issues with hot reload");
    }
  }

  // Security configuration completeness
  const requiredEnvVars = ['NODE_ENV'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: errors.length === 0 ? (warnings.length === 0 ? 100 : 85) : 60
  };
}

/**
 * Comprehensive security configuration audit
 */
export function auditSecurityConfiguration(headers: Record<string, string>): SecurityValidationResult {
  const headerValidation = validateSecurityHeaders(headers);
  const envValidation = validateEnvironmentSecurity();
  
  const combinedResult: SecurityValidationResult = {
    isValid: headerValidation.isValid && envValidation.isValid,
    errors: [...headerValidation.errors, ...envValidation.errors],
    warnings: [...headerValidation.warnings, ...envValidation.warnings],
    score: Math.round((headerValidation.score + envValidation.score) / 2)
  };

  // Log audit results
  log.info('🔍 Security configuration audit completed', LogContext.SECURITY, {
    score: combinedResult.score,
    isValid: combinedResult.isValid,
    errorCount: combinedResult.errors.length,
    warningCount: combinedResult.warnings.length,
    environment: process.env.NODE_ENV
  });

  if (combinedResult.errors.length > 0) {
    log.error('🚨 Security configuration errors found', LogContext.SECURITY, {
      errors: combinedResult.errors
    });
  }

  if (combinedResult.warnings.length > 0) {
    log.warn('⚠️ Security configuration warnings', LogContext.SECURITY, {
      warnings: combinedResult.warnings
    });
  }

  return combinedResult;
}

/**
 * Middleware to validate security headers on each request (development only)
 */
export function securityValidationMiddleware(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === 'development' && process.env.SECURITY_VALIDATION_ENABLED === 'true') {
    const originalSetHeader = res.setHeader.bind(res);
    const headers: Record<string, string> = {};

    res.setHeader = function(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return originalSetHeader(name, value);
    };

    res.on('finish', () => {
      const validation = validateSecurityHeaders(headers);
      if (!validation.isValid || validation.score < 80) {
        log.warn('🔍 Security headers validation failed', LogContext.SECURITY, {
          path: req.path,
          score: validation.score,
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    });
  }
  
  next();
}

export default {
  validateCSPConfiguration,
  validateSecurityHeaders,
  validateEnvironmentSecurity,
  auditSecurityConfiguration,
  securityValidationMiddleware
};