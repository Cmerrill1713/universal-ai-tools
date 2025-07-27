# Security Audit Report

**Generated:** 2025-07-23T01:14:43.856Z
**Overall Score:** 60/100

## Vulnerabilities

✓ No vulnerabilities found

## Security Headers

| Header                    | Present | Value      |
| ------------------------- | ------- | ---------- |
| Strict-Transport-Security | ✓       | configured |
| X-Content-Type-Options    | ✓       | configured |
| X-Frame-Options           | ✓       | configured |
| X-XSS-Protection          | ✓       | configured |
| Content-Security-Policy   | ✓       | configured |
| Referrer-Policy           | ✓       | configured |
| Permissions-Policy        | ✓       | configured |

## API Key Rotation Status

| Key Type       | Last Rotated | Status         | Expires In |
| -------------- | ------------ | -------------- | ---------- |
| jwt_secret     | 4/22/2025    | Needs Rotation | 0 days     |
| encryption_key | 1/22/2025    | Needs Rotation | 0 days     |
| api_keys       | 6/21/2025    | Needs Rotation | 0 days     |
| service_keys   | 5/22/2025    | Needs Rotation | 0 days     |

## Recommendations

- Rotate 4 expired API keys
- - jwt_secret: Last rotated 91 days ago
- - encryption_key: Last rotated 181 days ago
- - api_keys: Last rotated 31 days ago
- - service_keys: Last rotated 61 days ago
- Enable automated security scanning in CI/CD pipeline
- Implement security monitoring and alerting
- Conduct regular security training for development team
