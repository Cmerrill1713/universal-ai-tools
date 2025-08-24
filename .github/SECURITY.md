# Security Policy

## Supported Versions

Currently supported versions of Universal AI Tools for security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **Email**: Send details to security@universalaitools.com
2. **GitHub Security**: Use the private vulnerability reporting feature
3. **Urgent Issues**: Create a private GitHub issue with security label

## Security Measures Implemented

### Electron Security
- Context isolation enabled in production
- Node integration disabled by default  
- Secure CSP (Content Security Policy) headers
- Preload scripts for secure IPC communication

### Dependencies
- Regular Dependabot security updates
- Automated vulnerability scanning
- Minimal dependency surface area

### Data Protection
- Local-first architecture by default
- User preference isolation per session
- Secure localStorage key namespacing

## Known Security Considerations

### Current Debugging Configuration
⚠️ **Temporary Security Relaxation**

The current branch contains debugging configuration with:
- `nodeIntegration: true` (temporarily enabled)
- `contextIsolation: false` (temporarily disabled)

This is **only for debugging user preference isolation issues** and will be reverted once the issue is resolved.

### Production Security Checklist
- [ ] Restore production Electron security settings
- [ ] Enable GitHub security scanning
- [ ] Address all Dependabot alerts
- [ ] Complete security audit of archived TypeScript files
- [ ] Implement proper user session isolation

## Automated Security Monitoring

GitHub Actions workflows monitor for:
- Dependency vulnerabilities
- Code scanning alerts
- Security policy violations
- Unsafe code patterns

## Contact

For security concerns: security@universalaitools.com