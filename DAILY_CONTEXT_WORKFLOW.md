# 📅 DAILY CONTEXT PRESERVATION WORKFLOW

## 🌅 **MORNING RITUAL** (5 minutes)

### **1. System Health Check** 🏥
```bash
# Check all containers running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check API response times
curl -w "Response time: %{time_total}s\n" -s http://localhost:8081/health

# Check port conflicts
netstat -tulpn | grep -E ":(8001|8002|8003|8004|8005|8006|8080|8081|8091|8092)"
```

### **2. Context Refresh** 🧠
- [ ] Read `ECOSYSTEM_ARCHITECTURE_MAP.md` (current state)
- [ ] Check `FULL_ECOSYSTEM_INTEGRATION_PLAN.md` (progress)
- [ ] Review `CONTEXT_PRESERVATION_CHECKLIST.md` (process)
- [ ] Scan `COMPREHENSIVE_AUDIT_REPORT.md` (known issues)

### **3. Daily Planning** 📋
- [ ] Identify today's integration tasks
- [ ] Check for blockers or dependencies
- [ ] Plan testing and validation steps
- [ ] Set success criteria for the day

## 🔄 **DURING WORK** (Continuous)

### **Before Each Change** ⚠️
- [ ] **Context Check**: What services will this affect?
- [ ] **Impact Assessment**: Will this break existing functionality?
- [ ] **Dependency Check**: What other services depend on this?
- [ ] **Port Check**: Are there any port conflicts?
- [ ] **Testing Plan**: How will I validate this change?

### **After Each Change** ✅
- [ ] **Immediate Test**: Does the service still start?
- [ ] **Health Check**: Is the health endpoint responding?
- [ ] **Integration Test**: Can other services reach it?
- [ ] **Documentation Update**: Did I update the architecture map?
- [ ] **Context Preservation**: Did I follow the checklist?

### **Every 30 Minutes** ⏰
- [ ] **System Status**: Are all 16+ containers still running?
- [ ] **Performance Check**: Are API response times still <4ms?
- [ ] **Memory Check**: Is total memory usage still <450MB?
- [ ] **Port Check**: Are there any new port conflicts?

## 🌆 **EVENING RITUAL** (10 minutes)

### **1. Full System Validation** 🔍
```bash
# Complete health check suite
./scripts/health-check-all.sh

# Performance validation
./scripts/performance-check.sh

# Integration test
./scripts/integration-test.sh
```

### **2. Progress Documentation** 📝
- [ ] Update `ECOSYSTEM_ARCHITECTURE_MAP.md` with changes
- [ ] Record progress in `FULL_ECOSYSTEM_INTEGRATION_PLAN.md`
- [ ] Add lessons learned to `CONTEXT_PRESERVATION_CHECKLIST.md`
- [ ] Update any service status changes

### **3. Context Preservation** 🧠
- [ ] **Architecture Map**: Updated with new service states
- [ ] **Integration Plan**: Marked completed tasks
- [ ] **Checklist**: Added new patterns or issues
- [ ] **Documentation**: All changes documented

### **4. Next Day Preparation** 📅
- [ ] Identify tomorrow's priority tasks
- [ ] Check for any new blockers
- [ ] Plan testing strategy
- [ ] Set clear success criteria

## 🚨 **EMERGENCY PROCEDURES**

### **If System Breaks** 💥
1. **STOP** - Don't make more changes
2. **ASSESS** - What's broken and why?
3. **ROLLBACK** - Revert to last working state
4. **ANALYZE** - What went wrong?
5. **DOCUMENT** - Record the issue and solution
6. **RETRY** - Apply fix with better testing

### **If Context is Lost** 🧠
1. **READ** - Start with `ECOSYSTEM_ARCHITECTURE_MAP.md`
2. **ANALYZE** - Check current system state
3. **COMPARE** - What's different from expected?
4. **RECONSTRUCT** - Build understanding step by step
5. **VALIDATE** - Test understanding with system checks

## 📊 **CONTEXT METRICS TRACKING**

### **Daily Metrics** 📈
- **Services Running**: X/16 containers
- **API Response Time**: Xms average
- **Memory Usage**: XMB total
- **Port Conflicts**: X conflicts
- **Integration Progress**: X% complete

### **Weekly Metrics** 📊
- **System Uptime**: X% (target: 100%)
- **Performance Regression**: X% (target: 0%)
- **Documentation Coverage**: X% (target: 100%)
- **Test Coverage**: X% (target: 85%+)

## 🎯 **CONTEXT PRESERVATION RULES**

### **NEVER DO** ❌
1. **Make changes without context check**
2. **Skip testing after changes**
3. **Ignore port conflicts**
4. **Forget to update documentation**
5. **Work on multiple services simultaneously**

### **ALWAYS DO** ✅
1. **Check system health before starting**
2. **Read architecture map before changes**
3. **Test after every change**
4. **Update documentation immediately**
5. **Follow the checklist religiously**

## 🔧 **TOOLS & SCRIPTS**

### **Health Check Script** 🏥
```bash
#!/bin/bash
# health-check-all.sh
echo "🔍 Universal AI Tools Health Check"
echo "=================================="

# Check containers
echo "📦 Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check APIs
echo "🌐 API Health:"
curl -s http://localhost:8081/health | jq '.status'

# Check ports
echo "🔌 Port Status:"
netstat -tulpn | grep -E ":(8001|8002|8003|8004|8005|8006|8080|8081|8091|8092)"

# Check performance
echo "⚡ Performance:"
curl -w "Response time: %{time_total}s\n" -s http://localhost:8081/health
```

### **Context Check Script** 🧠
```bash
#!/bin/bash
# context-check.sh
echo "🧠 Context Preservation Check"
echo "============================"

# Check if architecture map exists
if [ -f "ECOSYSTEM_ARCHITECTURE_MAP.md" ]; then
    echo "✅ Architecture map present"
else
    echo "❌ Architecture map missing - CRITICAL"
fi

# Check if integration plan exists
if [ -f "FULL_ECOSYSTEM_INTEGRATION_PLAN.md" ]; then
    echo "✅ Integration plan present"
else
    echo "❌ Integration plan missing - CRITICAL"
fi

# Check if checklist exists
if [ -f "CONTEXT_PRESERVATION_CHECKLIST.md" ]; then
    echo "✅ Checklist present"
else
    echo "❌ Checklist missing - CRITICAL"
fi

echo "🎯 Context preservation status: READY"
```

## 🎉 **SUCCESS INDICATORS**

### **Daily Success** ✅
- All 16+ containers running
- API response times <4ms
- No port conflicts
- All health checks passing
- Documentation updated

### **Weekly Success** 🏆
- 100% system uptime
- 0% performance regression
- 100% integration progress
- Complete documentation
- All tests passing

**This workflow ensures we never lose context of the massive 900K+ line codebase while successfully integrating the new modern Rust services!** 🚀