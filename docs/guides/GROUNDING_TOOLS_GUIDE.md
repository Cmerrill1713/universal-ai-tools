# 🛠️ Universal AI Tools - Grounding System Management Tools

## Overview

This guide covers all the helpful management tools created for the Docker grounding system. These tools provide comprehensive monitoring, configuration, and troubleshooting capabilities.

## 📋 Available Tools

### 1. **Grounding Status Monitor** (`scripts/grounding-status.sh`)

A comprehensive status dashboard that provides real-time overview of your grounding system.

#### **Features:**
- ✅ System resource monitoring (CPU, memory, disk)
- 🐳 Docker service status checking
- 🤖 AI service health monitoring
- 📊 Metrics summary and analysis
- 🌐 Available endpoint listing
- 📝 Recent activity logs
- ⚡ Quick command reference

#### **Usage:**
```bash
./scripts/grounding-status.sh
```

#### **Sample Output:**
```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Universal AI Tools - Grounding System Status              ║
╚══════════════════════════════════════════════════════════════════════════════╝

🖥️  SYSTEM OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Docker: Running
✅ Docker Compose: Available
✅ Disk Space: 58% used
✅ Memory: 57% used

🐳 GROUNDING SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Monitoring & Observability:
✅ AI Metrics Exporter
❌ Prometheus (Grounded)
❌ Loki (Grounded)
```

---

### 2. **Configuration Manager** (`scripts/configure-grounding.sh`)

Interactive configuration tool for managing all grounding system settings.

#### **Features:**
- 🤖 AI Services Monitoring Configuration
- 🛡️ Security & Compliance Settings
- 💾 Backup & Recovery Configuration
- 🔔 Alert Notification Setup
- 📊 Performance Threshold Management
- 📄 Configuration File Generation
- ✅ Configuration Validation

#### **Usage:**
```bash
./scripts/configure-grounding.sh
```

#### **Menu Options:**
```
1. Configure AI Services Monitoring
2. Configure Security & Compliance
3. Configure Backup & Recovery
4. Configure Alert Notifications
5. Configure Performance Thresholds
6. Configure Log Retention
7. Generate Configuration Files
8. Validate Configuration
9. Export Configuration
0. Exit
```

#### **Example: Adding New AI Service**
```bash
./scripts/configure-grounding.sh
# Select option 1 (Configure AI Services Monitoring)
# Select option 1 (Add new AI service)
# Enter service details:
#   Service name: custom-ai-service
#   Service URL: http://localhost:8080
#   Health endpoint: /health
#   Models: custom-model-1, custom-model-2
```

---

### 3. **Troubleshooting Suite** (`scripts/troubleshoot-grounding.sh`)

Comprehensive diagnostic and repair tool for grounding system issues.

#### **Features:**
- 🐳 Docker Environment Diagnostics
- 🌐 Network Connectivity Testing
- 📝 Service Log Analysis
- 📄 Configuration File Validation
- 🔌 Port Conflict Detection
- 💻 Resource Usage Monitoring
- 🔧 Automated Fix Tools
- 📊 Health Report Generation

#### **Usage:**
```bash
./scripts/troubleshoot-grounding.sh
```

#### **Diagnostic Tools:**
```
1. Docker Environment Check
2. Network Connectivity Check
3. Service Logs Check
4. Configuration Files Check
5. Port Conflicts Check
6. Resource Usage Check
```

#### **Fix Tools:**
```
7. Fix Docker Issues
8. Fix Network Issues
9. Fix Configuration Issues
```

#### **Utilities:**
```
a. Run All Diagnostics
b. Generate Troubleshooting Report
c. Quick Health Check
```

#### **Example: Quick Health Check**
```bash
./scripts/troubleshoot-grounding.sh
# Select option 'c' (Quick Health Check)
# Output:
# ✅ AI Metrics Exporter
# ❌ Chat Service
# ❌ MLX Service
# 
# Health Summary:
#   Healthy: 1/3 services
#   ⚠️ Some services need attention
```

---

### 4. **Grounding System Startup** (`scripts/start-grounding.sh`)

Enhanced startup script with comprehensive options and profiles.

#### **Features:**
- 🚀 Modular service startup (profiles)
- 🔨 Service building and rebuilding
- 🔍 Security scanning integration
- ✅ Health checking and validation
- 📊 Status reporting

#### **Usage:**
```bash
# Start with default profiles
./scripts/start-grounding.sh

# Start specific profiles
./scripts/start-grounding.sh --profiles "security monitoring"

# Full setup with all checks
./scripts/start-grounding.sh --build --scan --check

# Skip building, just start
./scripts/start-grounding.sh --no-build
```

#### **Available Profiles:**
- `security` - Security scanning and compliance
- `monitoring` - Metrics collection and observability
- `reliability` - Health monitoring and auto-recovery
- `data-governance` - Backup and data integrity
- `ai-governance` - AI model monitoring and bias detection
- `testing` - Load testing and performance benchmarking
- `all` - All profiles

---

## 🔧 **Advanced Usage Examples**

### **Complete System Health Check**
```bash
# Run comprehensive diagnostics
./scripts/troubleshoot-grounding.sh
# Select option 'a' (Run All Diagnostics)

# Check system status
./scripts/grounding-status.sh

# Quick health check
./scripts/troubleshoot-grounding.sh
# Select option 'c' (Quick Health Check)
```

### **Adding New AI Service**
```bash
# Configure the new service
./scripts/configure-grounding.sh
# Follow prompts to add service

# Restart grounding services to pick up changes
./scripts/start-grounding.sh --profiles "monitoring"

# Verify the new service is being monitored
./scripts/grounding-status.sh
```

### **Setting Up Alert Notifications**
```bash
# Configure alerts
./scripts/configure-grounding.sh
# Select option 4 (Configure Alert Notifications)
# Select option 1 (Configure webhook notifications)
# Enter webhook URL and test

# Verify configuration
./scripts/configure-grounding.sh
# Select option 8 (Validate Configuration)
```

### **Troubleshooting Service Issues**
```bash
# Quick health check first
./scripts/troubleshoot-grounding.sh
# Select option 'c'

# If issues found, run full diagnostics
./scripts/troubleshoot-grounding.sh
# Select option 'a'

# Generate detailed report
./scripts/troubleshoot-grounding.sh
# Select option 'b'

# Apply fixes based on diagnostics
./scripts/troubleshoot-grounding.sh
# Select appropriate fix option (7, 8, or 9)
```

---

## 📊 **Monitoring Endpoints**

### **AI Metrics Exporter** (Currently Running)
- **Health**: `http://localhost:9092/health`
- **Metrics**: `http://localhost:9092/metrics`
- **Configuration**: `http://localhost:9092/config`

### **Available When Services Start:**
- **Prometheus**: `http://localhost:9091`
- **Loki**: `http://localhost:3101`
- **Health Monitor**: `http://localhost:8080/status`
- **OPA Policy Engine**: `http://localhost:8181`

### **AI Services:**
- **Chat Service**: `http://localhost:8010`
- **MLX Service**: `http://localhost:8001`
- **HRM Service**: `http://localhost:8002`
- **Implementation Service**: `http://localhost:8029`
- **Research Service**: `http://localhost:8028`

---

## 🚨 **Common Issues and Solutions**

### **Issue: Services Not Starting**
```bash
# Check Docker environment
./scripts/troubleshoot-grounding.sh
# Select option 1

# Check port conflicts
./scripts/troubleshoot-grounding.sh
# Select option 5

# Fix Docker issues
./scripts/troubleshoot-grounding.sh
# Select option 7
```

### **Issue: Configuration Errors**
```bash
# Validate configuration
./scripts/configure-grounding.sh
# Select option 8

# Regenerate configuration files
./scripts/configure-grounding.sh
# Select option 7

# Fix configuration issues
./scripts/troubleshoot-grounding.sh
# Select option 9
```

### **Issue: Network Connectivity Problems**
```bash
# Check network connectivity
./scripts/troubleshoot-grounding.sh
# Select option 2

# Fix network issues
./scripts/troubleshoot-grounding.sh
# Select option 8
```

### **Issue: High Resource Usage**
```bash
# Check resource usage
./scripts/troubleshoot-grounding.sh
# Select option 6

# Clean up Docker resources
./scripts/troubleshoot-grounding.sh
# Select option 7, then option 2 (Clean up Docker resources)
```

---

## 📁 **File Locations**

### **Configuration Files:**
- `monitoring/config/ai-services.yml` - AI service monitoring config
- `monitoring/config/health-checks.yml` - Health check configuration
- `monitoring/config/alerts.yml` - Alert notification settings
- `monitoring/prometheus/prometheus-grounded.yml` - Prometheus config
- `monitoring/loki/loki-grounded.yml` - Loki log aggregation config
- `monitoring/promtail/promtail-grounded.yml` - Log shipping config

### **Log Files:**
- `logs/ai-metrics/` - AI metrics exporter logs
- `logs/health-monitor/` - Health monitoring logs
- `logs/backup/` - Backup service logs
- `logs/falco/` - Security monitoring logs

### **Reports:**
- `security/reports/` - Vulnerability scan reports
- `backups/` - Backup files and archives
- `troubleshooting-report-*.txt` - Diagnostic reports

---

## 🎯 **Best Practices**

### **Daily Operations:**
1. Run `./scripts/grounding-status.sh` to check system health
2. Monitor AI metrics at `http://localhost:9092/metrics`
3. Check service logs for any issues

### **Weekly Maintenance:**
1. Run security scans: `docker-compose -f docker-compose.grounding.yml run --rm trivy-scanner`
2. Validate configurations: `./scripts/configure-grounding.sh` → option 8
3. Review backup status and logs

### **Monthly Tasks:**
1. Generate comprehensive troubleshooting report
2. Review and update alert thresholds
3. Clean up old logs and reports
4. Update security policies and rules

### **When Adding New Services:**
1. Configure monitoring: `./scripts/configure-grounding.sh`
2. Update health checks and thresholds
3. Test connectivity: `./scripts/troubleshoot-grounding.sh` → option 2
4. Restart grounding services to pick up changes

---

## 🆘 **Getting Help**

### **Quick Reference:**
- **Status Check**: `./scripts/grounding-status.sh`
- **Configuration**: `./scripts/configure-grounding.sh`
- **Troubleshooting**: `./scripts/troubleshoot-grounding.sh`
- **Start Services**: `./scripts/start-grounding.sh`

### **Documentation:**
- `DOCKER_GROUNDING_README.md` - Comprehensive grounding system guide
- `GROUNDING_TOOLS_GUIDE.md` - This tools guide
- Configuration files contain inline documentation

### **Logs and Reports:**
- Check `logs/` directory for service logs
- Generate troubleshooting reports for detailed diagnostics
- Security reports in `security/reports/`

The grounding system management tools provide everything you need to monitor, configure, and troubleshoot your AI infrastructure effectively. Start with the status monitor to get an overview, then use the configuration manager to customize settings, and the troubleshooting suite when issues arise.
