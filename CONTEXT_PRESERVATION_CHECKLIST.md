# 🧠 CONTEXT PRESERVATION CHECKLIST

## 📋 **BEFORE ANY CHANGE**

### **1. Full System Analysis** 🔍
- [ ] Read `ECOSYSTEM_ARCHITECTURE_MAP.md` for current state
- [ ] Check `COMPREHENSIVE_AUDIT_REPORT.md` for known issues
- [ ] Review `ARCHITECTURE.md` for design principles
- [ ] Scan `README-SYSTEM.md` for operational status

### **2. Service Impact Assessment** ⚡
- [ ] Identify all services that will be affected
- [ ] Check port conflicts and dependencies
- [ ] Verify service discovery registration
- [ ] Confirm monitoring integration

### **3. Change Validation** ✅
- [ ] Does this change align with polyglot architecture?
- [ ] Will this break existing service communication?
- [ ] Are we maintaining 77%+ operational status?
- [ ] Does this improve or degrade performance?

## 📋 **DURING IMPLEMENTATION**

### **4. Incremental Updates** 🔄
- [ ] Update one service at a time
- [ ] Test integration after each change
- [ ] Maintain backward compatibility
- [ ] Document changes in real-time

### **5. Integration Verification** 🔗
- [ ] Verify API Gateway routing works
- [ ] Confirm service discovery registration
- [ ] Check monitoring data collection
- [ ] Test health check endpoints

## 📋 **AFTER EACH CHANGE**

### **6. System Validation** 🎯
- [ ] Run full health check suite
- [ ] Verify all 16+ containers are running
- [ ] Check API response times <4ms
- [ ] Confirm no port conflicts

### **7. Documentation Updates** 📝
- [ ] Update `ECOSYSTEM_ARCHITECTURE_MAP.md`
- [ ] Add to service inventory
- [ ] Update dependency mappings
- [ ] Record performance metrics

### **8. Context Preservation** 🧠
- [ ] Update this checklist with lessons learned
- [ ] Add new patterns discovered
- [ ] Record integration challenges
- [ ] Document best practices

## 🚨 **CRITICAL REMINDERS**

### **Never Forget:**
1. **This is a 900K+ line enterprise platform**
2. **77% operational success rate must be maintained**
3. **Sub-4ms API response times are critical**
4. **16+ Docker containers must stay running**
5. **Polyglot architecture (Rust + Go + Python) is intentional**

### **Always Check:**
1. **Port conflicts** before assigning new ports
2. **Service dependencies** before making changes
3. **Monitoring integration** for all new services
4. **API Gateway routing** for all endpoints
5. **Docker Compose** files for all services

## 📊 **CONTEXT METRICS**

### **System Health Indicators**
- **Services Running**: 16/16 containers
- **API Response Time**: <4ms average
- **Memory Usage**: <450MB total
- **Port Conflicts**: 0
- **Integration Coverage**: 100%

### **Quality Gates**
- **All health checks pass**: ✅
- **No port conflicts**: ✅
- **Monitoring data flowing**: ✅
- **API Gateway routing**: ✅
- **Service discovery working**: ✅