# CI/CD Pipeline Documentation

This directory contains the comprehensive CI/CD pipeline configuration for Universal AI Tools. The pipeline ensures code quality, security, and reliable deployments through automated workflows.

## 📁 Directory Structure

```
.github/
├── workflows/                 # GitHub Actions workflows
│   ├── ci.yml                # Main CI pipeline
│   ├── deploy-production.yml # Production deployment
│   ├── deploy-staging.yml    # Staging deployment
│   ├── security-scan.yml     # Security scanning
│   ├── performance-test.yml  # Performance testing
│   ├── docker-build.yml      # Docker build & security
│   ├── branch-protection.yml # Code quality gates
│   └── repository-sync.yml   # Repository configuration
├── ISSUE_TEMPLATE/           # Issue templates
│   ├── bug_report.yml        # Bug report template
│   ├── feature_request.yml   # Feature request template
│   └── security_report.yml   # Security report template
├── pull_request_template.md  # PR template
├── dependabot.yml           # Dependency management
└── README.md               # This file
```

## 🚀 Workflows Overview

### 1. Main CI Pipeline (`ci.yml`)

**Triggers:** Push to main/master/develop, Pull requests

**Purpose:** Comprehensive testing and validation

**Jobs:**
- **Code Quality & Linting:** ESLint, Prettier, TypeScript checks
- **Security Scanning:** Vulnerability detection, secret scanning, CodeQL
- **Database Migration Testing:** PostgreSQL migration validation
- **Testing:** Unit, integration, and frontend tests
- **Build Validation:** Development and production builds
- **Performance Testing:** Basic performance checks (on labeled PRs)
- **Documentation Generation:** Auto-generated API docs

**Key Features:**
- Parallel execution for faster feedback
- Comprehensive test coverage reporting
- Automatic documentation deployment
- Performance baseline tracking

### 2. Production Deployment (`deploy-production.yml`)

**Triggers:** Git tags, Manual dispatch

**Purpose:** Safe production deployments with rollback capability

**Jobs:**
- **Pre-deployment Validation:** Production readiness checks
- **Build & Package:** Production-optimized builds
- **Docker Build & Push:** Multi-platform container images
- **Database Migration:** Safe schema updates
- **Deployment:** Blue-green deployment strategy
- **Post-deployment Monitoring:** Health checks and alerts
- **Rollback:** Emergency rollback on failure

**Key Features:**
- Multi-stage deployment with gates
- Automated rollback on failure
- Performance monitoring
- Release notes generation

### 3. Staging Deployment (`deploy-staging.yml`)

**Triggers:** Push to develop/staging, PR labels, Manual dispatch

**Purpose:** Fast iteration and testing environment

**Jobs:**
- **Quick Validation:** Fast quality checks
- **Build:** Development-optimized builds
- **Deploy:** Staging environment deployment
- **Validation:** Smoke tests and health checks
- **Notification:** Team notifications

**Key Features:**
- Fast deployment for quick feedback
- Automatic cleanup of old deployments
- PR integration for preview deployments

### 4. Security Scanning (`security-scan.yml`)

**Triggers:** Daily schedule, Push to main, Pull requests

**Purpose:** Continuous security monitoring

**Jobs:**
- **Dependency Scan:** npm audit, Snyk, vulnerability detection
- **Secret Scan:** TruffleHog, GitLeaks, credential detection
- **Code Security:** Static analysis, security rules
- **Infrastructure Scan:** Docker security, configuration analysis
- **License Compliance:** License compatibility checking
- **Security Report:** Comprehensive security assessment

**Key Features:**
- Multi-tool security scanning
- SARIF integration with GitHub Security tab
- Automated security issue creation
- License compliance monitoring

### 5. Performance Testing (`performance-test.yml`)

**Triggers:** Weekly schedule, Performance-labeled PRs

**Purpose:** Performance regression detection

**Jobs:**
- **Quick Tests:** Basic response time and memory checks
- **Load Testing:** Artillery-based load testing
- **Memory Profiling:** Memory leak detection
- **Performance Report:** Comprehensive performance analysis

**Key Features:**
- Configurable test duration and load
- Memory leak detection
- Performance threshold enforcement
- Historical performance tracking

### 6. Docker Build & Security (`docker-build.yml`)

**Triggers:** Push to main/develop, Tags, Pull requests

**Purpose:** Secure container builds

**Jobs:**
- **Build Preparation:** Application build and optimization
- **Dockerfile Linting:** Hadolint security checks
- **Docker Build:** Multi-platform container builds
- **Security Scanning:** Trivy, Grype vulnerability scanning
- **Compliance Testing:** Container security validation

**Key Features:**
- Multi-stage Docker builds
- Security-hardened containers
- Vulnerability scanning with SARIF output
- SBOM (Software Bill of Materials) generation

### 7. Branch Protection (`branch-protection.yml`)

**Triggers:** Pull requests to protected branches

**Purpose:** Enforce code quality standards

**Jobs:**
- **Code Quality Gate:** Linting, formatting, type checking
- **Security Quality Gate:** Security checks, secret detection
- **Test Quality Gate:** Test execution and coverage
- **Build Quality Gate:** Build validation and size checking
- **Change Impact Analysis:** Risk assessment
- **Final Quality Gate:** Overall validation

**Key Features:**
- Multiple quality gates
- Change impact analysis
- Coverage threshold enforcement
- Breaking change detection

### 8. Repository Sync (`repository-sync.yml`)

**Triggers:** Push to main, Manual dispatch

**Purpose:** Maintain repository configuration

**Jobs:**
- **Sync Labels:** Standardized issue/PR labels
- **Branch Protection Suggestions:** Security recommendations
- **Security Configuration:** Security best practices

## 🔧 Configuration

### Required Secrets

#### Production Deployment
```
SUPABASE_ACCESS_TOKEN       # Supabase CLI access
SUPABASE_PROJECT_ID         # Production project ID
SUPABASE_URL               # Production Supabase URL
SUPABASE_SERVICE_KEY       # Production service key
SUPABASE_ANON_KEY          # Production anonymous key
DEPLOY_HOST                # Production server host
DEPLOY_USER                # Deployment user
DEPLOY_KEY                 # SSH deployment key
PRODUCTION_URL             # Production URL for health checks
```

#### Staging Environment
```
STAGING_SUPABASE_URL       # Staging Supabase URL
STAGING_SUPABASE_SERVICE_KEY # Staging service key
STAGING_PROJECT_ID         # Staging project ID
STAGING_HOST               # Staging server host
STAGING_USER               # Staging deployment user
STAGING_KEY                # Staging SSH key
STAGING_URL                # Staging URL
```

#### Security Scanning
```
SNYK_TOKEN                 # Snyk security scanning
CODECOV_TOKEN              # Code coverage reporting
```

#### Optional
```
GRAFANA_USER               # Monitoring dashboard
GRAFANA_PASSWORD           # Monitoring password
```

### Environment Variables

The pipeline uses environment-specific configurations:

- **NODE_VERSION:** `20` (consistent Node.js version)
- **PYTHON_VERSION:** `3.12` (for DSPy components)
- **PERFORMANCE_THRESHOLDS:** Response time, memory, CPU limits
- **MINIMUM_COVERAGE:** `80%` (test coverage requirement)

## 📊 Quality Gates

### Code Quality Standards
- ✅ ESLint rules passing
- ✅ Prettier formatting
- ✅ TypeScript compilation
- ✅ No TODO/FIXME accumulation

### Security Standards
- ✅ No critical vulnerabilities
- ✅ No hardcoded secrets
- ✅ Dependency security audit
- ✅ SAST analysis passing

### Test Standards
- ✅ All unit tests passing
- ✅ Integration tests passing
- ✅ 80%+ test coverage
- ✅ Frontend tests passing

### Build Standards
- ✅ Production build successful
- ✅ Application startup test
- ✅ Build size within limits
- ✅ No build warnings/errors

## 🎯 Best Practices

### For Developers

1. **Branch Naming:**
   ```
   feature/description
   bugfix/issue-description
   hotfix/critical-fix
   ```

2. **Commit Messages:**
   ```
   type(scope): description
   
   Examples:
   feat(api): add user authentication endpoint
   fix(ui): resolve navigation menu overflow
   docs(readme): update installation instructions
   ```

3. **PR Labels:**
   - Use `performance` label for performance-related changes
   - Use `security` label for security-related changes
   - Use `deploy-staging` to trigger staging deployment

### For Code Reviews

1. **Required Checks:** All quality gates must pass
2. **Security Review:** Required for security-labeled PRs
3. **Performance Review:** Required for performance-labeled PRs
4. **Breaking Changes:** Must be documented and approved

### For Deployment

1. **Staging First:** Always deploy to staging before production
2. **Health Checks:** Verify application health post-deployment
3. **Rollback Plan:** Have a rollback strategy ready
4. **Monitoring:** Monitor metrics post-deployment

## 🔍 Monitoring & Alerting

### Automated Alerts
- CI/CD pipeline failures
- Security vulnerabilities
- Performance regressions
- Deployment failures

### Dashboard Links
- [GitHub Actions](../../actions)
- [Security Overview](../../security)
- [Insights](../../insights)

## 🛠️ Troubleshooting

### Common Issues

#### CI/CD Pipeline Failures
1. **Check logs:** Review workflow run logs
2. **Dependency issues:** Clear cache, update dependencies
3. **Test failures:** Run tests locally first
4. **Build failures:** Verify build works locally

#### Deployment Issues
1. **Environment variables:** Verify all secrets are set
2. **Database migrations:** Check migration status
3. **Health checks:** Verify application starts correctly
4. **Rollback:** Use emergency rollback if needed

#### Security Scanning Issues
1. **False positives:** Review and whitelist if necessary
2. **Dependency vulnerabilities:** Update dependencies
3. **Secret detection:** Remove or move to environment variables

### Getting Help

1. **Documentation:** Check this README and workflow comments
2. **Issues:** Create an issue with logs and reproduction steps
3. **Team:** Contact the development team for urgent issues

## 📈 Metrics & KPIs

### Quality Metrics
- Test coverage percentage
- Build success rate
- Security vulnerability count
- Code quality score

### Performance Metrics
- Build time
- Test execution time
- Deployment time
- Application startup time

### Security Metrics
- Vulnerability resolution time
- Security scan success rate
- Dependency update frequency

---

## 🔄 Continuous Improvement

This CI/CD pipeline is continuously improved based on:
- Developer feedback
- Industry best practices
- Security requirements
- Performance needs

Submit suggestions and improvements through issues or pull requests!

---

**Last Updated:** 2025-01-20
**Pipeline Version:** 1.0.0
**Maintainer:** Universal AI Tools Team