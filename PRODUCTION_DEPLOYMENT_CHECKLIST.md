# Production Deployment Checklist

## Pre-Deployment Verification

### Code Quality ✅
- [x] TypeScript compilation completes (with warnings)
- [x] ESLint configured (requires fixes)
- [x] Dependencies installed and up to date
- [x] rate-limit-redis package added

### Security 🔐
- [x] API keys migrated to Supabase Vault (partial)
  - Some services still reference process.env
  - Migration script available: `npm run migrate:vault`
- [ ] JWT secrets in Vault
- [ ] SSL/TLS certificates configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled on all endpoints
- [ ] Security headers implemented

### Database 📊
- [ ] All migrations applied to production
- [ ] Backup strategy in place
- [ ] Connection pooling configured
- [ ] Indexes optimized

### Environment Configuration 🔧
- [ ] Production .env file configured
- [ ] Redis connection verified
- [ ] Supabase connection verified
- [ ] LLM service endpoints configured

### Services Health 💚
- [ ] Health check endpoints working
- [ ] Circuit breakers configured
- [ ] Fallback mechanisms tested
- [ ] Error handling verified

### Performance 🚀
- [ ] Production build optimized
- [ ] Caching strategies implemented
- [ ] Resource limits configured
- [ ] Monitoring setup

## Deployment Steps

1. **Pre-flight Checks**
   ```bash
   npm run validate:production
   npm run test:integration
   npm run security:audit
   ```

2. **Database Migration**
   ```bash
   npm run migrate:production
   ```

3. **Secret Migration**
   ```bash
   npm run migrate:vault
   ```

4. **Build & Deploy**
   ```bash
   npm run build:prod
   npm run start:production
   ```

5. **Post-Deployment**
   ```bash
   npm run health:check
   npm run monitor:start
   ```

## Critical Issues to Address

1. **TypeScript Errors**: Auto-fix script introduced duplicate return statements
2. **Linting Errors**: ~3800+ errors need resolution
3. **API Key Migration**: Complete migration to Vault for all services
4. **Test Coverage**: Ensure all critical paths have tests

## Rollback Plan

1. Keep previous version tagged
2. Database migration rollback scripts ready
3. Quick switch via environment variables
4. Health check monitoring for auto-rollback

## Monitoring & Alerts

- [ ] Prometheus metrics configured
- [ ] Error tracking setup (Sentry/similar)
- [ ] Uptime monitoring
- [ ] Performance metrics dashboard

## Support Contacts

- DevOps Team: [Contact Info]
- Database Admin: [Contact Info]
- Security Team: [Contact Info]
- On-Call Engineer: [Contact Info]