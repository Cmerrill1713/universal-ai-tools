# Security Hardening Service Documentation

## Overview

The Security Hardening Service provides comprehensive security auditing, vulnerability scanning, and API key rotation capabilities for the Universal AI Tools platform. This service has been fully implemented and enabled to replace the previous mock implementation.

## Features

### 1. Security Auditing
- Comprehensive security score calculation (0-100)
- Dependency vulnerability scanning using npm audit
- Security header validation
- API key rotation status monitoring
- Automated recommendations generation

### 2. API Key Management
- Secure key generation using crypto.randomBytes
- Key rotation history tracking in database
- Configurable rotation schedules for different key types
- SHA256 hashing for secure storage

### 3. Vulnerability Management
- Real-time dependency scanning
- Automated vulnerability fixes (with dry-run option)
- Common security issue detection
- Detailed vulnerability reporting by severity

## API Endpoints

### GET /api/security/status
Returns a comprehensive security audit including:
- Overall security score
- Vulnerability counts by severity
- Expired API keys
- Missing security headers
- Actionable recommendations

**Response Example:**
```json
{
  "score": 85,
  "vulnerabilities": 3,
  "criticalIssues": 0,
  "highIssues": 1,
  "moderateIssues": 2,
  "lowIssues": 0,
  "expiredKeys": 1,
  "missingHeaders": 2,
  "recommendations": [
    "Fix 1 high severity vulnerabilities as soon as possible",
    "Rotate 1 expired API keys",
    "- api_keys: Last rotated 45 days ago"
  ],
  "timestamp": "2025-01-20T12:00:00.000Z"
}
```

### GET /api/security/vulnerabilities
Scans and returns all dependency vulnerabilities.

**Response Example:**
```json
{
  "total": 3,
  "critical": 0,
  "high": 1,
  "moderate": 2,
  "low": 0,
  "vulnerabilities": [
    {
      "severity": "high",
      "package": "example-package",
      "vulnerability": "Prototype Pollution",
      "fixAvailable": true,
      "recommendation": "Run 'npm audit fix' to update example-package"
    }
  ]
}
```

### POST /api/security/rotate-key
Rotates API keys with proper authorization checks.

**Request Body:**
```json
{
  "keyType": "api_keys"
}
```

**Allowed Key Types:**
- `jwt_secret` (90-day rotation)
- `encryption_key` (180-day rotation)
- `api_keys` (30-day rotation)
- `service_keys` (60-day rotation)

**Response Example:**
```json
{
  "success": true,
  "keyType": "api_keys",
  "message": "Key rotated successfully. Update your configuration.",
  "keyPreview": "A7B3C9D2...",
  "keyLength": 44
}
```

### POST /api/security/fix-vulnerabilities
Attempts to fix vulnerabilities automatically.

**Request Body:**
```json
{
  "dryRun": true
}
```

**Response Example:**
```json
{
  "success": true,
  "dryRun": true,
  "fixed": ["Ran npm audit fix", "Updated npm dependencies"],
  "failed": [],
  "message": "Dry run completed. Review the changes before running without dryRun."
}
```

### GET /api/security/common-issues
Checks for common security misconfigurations.

**Response Example:**
```json
{
  "passed": false,
  "issuesFound": 2,
  "issues": [
    ".env.production is not in .gitignore",
    "Encryption key is too short (minimum 32 characters)"
  ],
  "timestamp": "2025-01-20T12:00:00.000Z"
}
```

## Database Schema

The service uses two tables for persistence:

### security_key_rotations
```sql
- id: BIGSERIAL PRIMARY KEY
- key_name: VARCHAR(255) NOT NULL
- key_hash: VARCHAR(64) NOT NULL
- rotated_by: VARCHAR(255) NOT NULL
- created_at: TIMESTAMP WITH TIME ZONE
```

### security_audits
```sql
- id: BIGSERIAL PRIMARY KEY
- audit_type: VARCHAR(50) NOT NULL
- score: INTEGER (0-100)
- vulnerabilities_count: INTEGER
- findings: JSONB
- created_at: TIMESTAMP WITH TIME ZONE
```

## Security Features

### Input Sanitization
- HTML tag removal using sanitize-html
- SQL injection prevention using sqlstring
- Zod schema validation for input verification

### Authorization
- Role-based access control for sensitive operations
- Admin/service_role required for key rotation and vulnerability fixes
- Audit logging for all security operations

### Data Protection
- Secure key generation (32 bytes, base64 encoded)
- SHA256 hashing for stored key references
- Row-level security policies on database tables

## Configuration

The service automatically initializes with default rotation schedules:
- JWT Secret: 90 days
- Encryption Key: 180 days
- API Keys: 30 days
- Service Keys: 60 days

## Testing

Run the test script to verify the service is working:
```bash
node test-security-hardening.mjs
```

This will test all security endpoints and report their status.

## Monitoring

The service logs all operations with the SECURITY context:
- Audit executions
- Key rotations
- Vulnerability scans
- Authorization failures

Logs are stored in:
- Console output (with enhanced logger)
- File: `logs/security-audit.log`
- Database: `security_audits` table

## Best Practices

1. **Regular Audits**: Run security audits at least weekly
2. **Key Rotation**: Follow the recommended rotation schedules
3. **Vulnerability Fixes**: Address critical and high vulnerabilities immediately
4. **Monitoring**: Set up alerts for security score drops below 70
5. **Access Control**: Limit admin privileges to essential personnel only

## Migration from Mock Implementation

The previous mock implementation has been completely replaced with:
- Real npm audit integration
- Actual key generation and rotation
- Database persistence
- Comprehensive security scoring
- Automated vulnerability fixing

No code changes are required in client applications - the API remains compatible.