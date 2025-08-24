# Standardized Validation and Error Handling System

This document outlines the comprehensive standardized validation and error handling system implemented for Phase 2.2 of the Universal AI Tools project.

## Overview

The new system provides:
- Consistent error response formats across all API endpoints
- Comprehensive request validation using Zod schemas
- Proper HTTP status codes for different error types
- Input sanitization and security validation
- Centralized error handling middleware
- Request timing and correlation tracking
- Integration with logging and monitoring systems

## Components

### 1. Validation Schemas (`validation-schemas.ts`)

Comprehensive Zod schemas for all API endpoints including:

#### Base Schemas
- `baseIdSchema` - Standard resource identifiers
- `userIdSchema` - UUID-based user identifiers
- `apiKeySchema` - API key validation

#### Feature-Specific Schemas
- `chatRequestSchema` - Chat message validation
- `agentRequestSchema` - Agent execution requests
- `flashAttentionOptimizeSchema` - Flash attention parameters
- `imageUploadSchema` - Image processing requests
- `trainingJobSchema` - ML training configurations
- `deviceRegistrationSchema` - Device authentication
- `proactiveTaskSchema` - Automated task scheduling

#### Common Patterns
- `paginationSchema` - Standard pagination parameters
- `searchSchema` - Search query validation
- `systemMetricsQuerySchema` - Monitoring queries

### 2. Enhanced Validation Middleware (`enhanced-validation.ts`)

Advanced validation middleware with features:

#### Main Functions
- `validateRequestBody()` - Request body validation with sanitization
- `validateQueryParams()` - Query parameter validation with type coercion
- `validateParams()` - Path parameter validation
- `validateRequest()` - Combined validation for all request parts

#### Security Features
- Input sanitization to prevent XSS attacks
- SQL injection protection
- Content-Type validation
- Request size limits
- Custom field validation

#### Type Safety
- Full TypeScript integration
- Validated data attached to request object
- Proper error formatting with field-level details

### 3. Standardized Error Handler (`standardized-error-handler.ts`)

Unified error handling system:

#### Error Classification
- HTTP status code mapping based on error types
- Consistent error code constants
- Development vs production error exposure

#### Error Types
- `ApiValidationError` - Request validation failures
- `ApiAuthenticationError` - Authentication issues
- `ApiAuthorizationError` - Permission problems
- `ApiNotFoundError` - Resource not found
- `ApiConflictError` - Resource conflicts
- `ApiRateLimitError` - Rate limiting
- `ApiServiceUnavailableError` - Service outages
- `ApiContentBlockedError` - Content safety violations

#### Features
- Request correlation IDs
- Performance timing
- Detailed error logging
- Sentry integration
- Health check special handling

### 4. Enhanced Global Error Handler (`global-error-handler.ts`)

Comprehensive error handling integration:

#### Features
- Integration with all error handling components
- Request timing and correlation tracking
- Sentry error reporting (production only)
- Error logging service integration
- Health check endpoint protection
- Data sanitization for logging

#### Setup
```typescript
import { setupErrorHandling } from '@/middleware/global-error-handler';

// Apply to Express app
setupErrorHandling(app);
```

## Usage Examples

### Basic Router with Validation

```typescript
import { Router } from 'express';
import { 
  validateRequestBody, 
  validateQueryParams,
  asyncErrorHandler 
} from '@/middleware/enhanced-validation';
import { chatRequestSchema } from '@/middleware/validation-schemas';
import { ApiNotFoundError } from '@/middleware/standardized-error-handler';

const router = Router();

router.post('/chat',
  validateRequestBody(chatRequestSchema),
  asyncErrorHandler(async (req, res) => {
    const validatedData = req.body; // Fully validated and typed
    
    if (someCondition) {
      throw new ApiNotFoundError('Chat session');
    }
    
    sendSuccess(res, result);
  })
);
```

### Combined Validation

```typescript
router.post('/agents/:id/execute',
  ...validateRequest({
    params: idParamSchema,
    query: paginationSchema.partial(),
    body: agentRequestSchema
  }),
  validateContentType('application/json'),
  authenticate,
  asyncErrorHandler(async (req, res) => {
    // All request data is validated and typed
    const { id } = req.params;
    const queryParams = req.query;
    const requestData = req.body;
    
    // Business logic here
  })
);
```

### Custom Validation

```typescript
router.post('/custom',
  validateCustomField('email', async (email) => {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase();
  }),
  asyncErrorHandler(async (req, res) => {
    // Email is now validated and normalized
  })
);
```

## Error Response Format

All errors now follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email",
        "code": "invalid_string",
        "expected": "valid email format"
      }
    ]
  },
  "metadata": {
    "requestId": "req_1234567890_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0"
  }
}
```

## Error Codes

Standard error codes across the system:

- `VALIDATION_ERROR` (400) - Request validation failed
- `AUTHENTICATION_ERROR` (401) - Authentication required
- `FORBIDDEN_ERROR` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Resource conflict
- `RATE_LIMIT_EXCEEDED` (429) - Rate limit exceeded
- `INTERNAL_ERROR` (500) - Server error
- `SERVICE_UNAVAILABLE` (503) - Service temporarily unavailable

## Security Features

### Input Sanitization
- HTML/XML tag removal
- JavaScript protocol stripping
- Data protocol removal
- Nested object sanitization

### Rate Limiting
- Per-endpoint rate limits
- User-based rate limiting
- IP-based protection
- Custom rate limit responses

### Content Validation
- File type verification
- Size limit enforcement
- Content-Type checking
- Schema-based validation

## Monitoring and Logging

### Error Tracking
- Request correlation IDs
- Performance timing
- Error frequency monitoring
- Health check protection

### Integration
- Sentry error reporting
- Custom logging service
- Metrics collection
- Alert thresholds

## Migration Guide

### From Old Validation
Replace manual validation:
```typescript
// Old way
if (!req.body.email || typeof req.body.email !== 'string') {
  return res.status(400).json({ error: 'Invalid email' });
}

// New way
validateRequestBody(userSchema),
```

### Error Handling
Replace manual error responses:
```typescript
// Old way
res.status(500).json({ error: 'Something went wrong' });

// New way
throw new ApiServiceUnavailableError('User service');
```

## Best Practices

1. **Always use validation middleware** for all endpoints
2. **Use typed error classes** instead of generic errors
3. **Wrap async handlers** with `asyncErrorHandler`
4. **Validate at the edge** - validate inputs immediately
5. **Sanitize data** to prevent security issues
6. **Use correlation IDs** for request tracking
7. **Log errors appropriately** with proper context
8. **Test error scenarios** to ensure proper handling

## Testing

The system includes comprehensive test coverage for:
- Validation schema edge cases
- Error handler behavior
- Request sanitization
- Type coercion
- Security validation
- Performance timing
- Integration scenarios

Run tests with:
```bash
npm test -- src/middleware/__tests__/
```

## Performance Considerations

- Schema validation is cached for efficiency
- Sanitization is optimized for common cases
- Error handling has minimal overhead
- Logging is asynchronous where possible
- Health checks bypass heavy validation

## Future Enhancements

Planned improvements include:
- OpenAPI schema generation from Zod schemas
- Advanced rate limiting strategies
- Real-time error monitoring dashboard
- Automated security scanning integration
- Performance optimization based on metrics
