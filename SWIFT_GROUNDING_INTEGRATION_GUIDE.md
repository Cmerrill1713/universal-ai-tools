# 🚀 Swift Frontend + Docker Grounding System Integration Guide

## Overview

Your SwiftUI frontend has been successfully integrated with the enhanced Docker grounding system, creating a complete end-to-end monitoring and management solution for your Universal AI Tools platform.

## ✅ **Integration Completed**

### **New Swift Components Added**

#### **1. GroundingSystemManager.swift**
- **Real-time monitoring** of all grounding services
- **Automatic health checks** for Prometheus, Grafana, AI Metrics, etc.
- **Periodic metrics updates** every 30 seconds
- **Alert detection and management**
- **Service discovery** and status tracking

#### **2. MonitoringDashboard.swift**
- **Comprehensive dashboard** with 4 tabs:
  - **Overview**: System health, AI metrics, quick actions
  - **AI Metrics**: Performance charts, quality metrics, resource usage
  - **Services**: Real-time service status monitoring
  - **Alerts**: Active alerts and notifications
- **Interactive charts** and visual indicators
- **Quick actions** to open Grafana and Prometheus

#### **3. GroundingConfig.swift**
- **Centralized configuration** for all grounding system endpoints
- **Environment-based settings** (development/production)
- **Service discovery** and validation
- **Configuration export/import** capabilities

### **Enhanced Main App Features**

#### **New Monitoring Window**
- **Accessible via menu**: Pop-out → System Monitoring
- **Real-time dashboard** showing all grounding system metrics
- **Alert notifications** with severity indicators
- **Service health monitoring** with status indicators

#### **Integrated Menu System**
- **Added "📊 System Monitoring"** to the agent pop-out menu
- **Seamless window management** with proper positioning
- **Consistent UI/UX** with existing agent windows

## 🎯 **How to Use the Integration**

### **1. Start the Grounding System**
```bash
# Start the grounding services
./scripts/start-grounding.sh --profiles "monitoring visualization"

# Verify services are running
./scripts/grounding-status.sh
```

### **2. Launch the Swift App**
```bash
# Build and run the Swift app
cd UniversalAIToolsApp
swift run

# Or open in Xcode
open UniversalAIToolsApp.xcodeproj
```

### **3. Access the Monitoring Dashboard**
1. **Launch your Swift app**
2. **Click the pop-out menu** (rectangle.portrait.and.arrow.right icon)
3. **Select "📊 System Monitoring"**
4. **Monitor your AI infrastructure** in real-time!

## 📊 **Dashboard Features**

### **Overview Tab**
- **System Health Cards**: Status, Memory, CPU usage
- **AI Performance Metrics**: Requests, Error Rate, Response Time, GPU Usage
- **Quick Actions**: Open Grafana, Prometheus, Refresh All
- **Recent Alerts**: Latest 3 alerts with severity indicators

### **AI Metrics Tab**
- **Performance Charts**: Visual metrics with progress indicators
- **Quality Metrics**: Model Accuracy, User Satisfaction, Self Corrections
- **Resource Usage**: Memory and GPU usage monitoring

### **Services Tab**
- **Real-time Service Status**: All grounding services with health indicators
- **Last Check Timestamps**: When each service was last verified
- **Status Indicators**: Green (healthy), Orange (warning), Red (error)

### **Alerts Tab**
- **Active Alerts**: All current system alerts
- **Alert Details**: Title, message, severity, source, timestamp
- **Dismiss Actions**: Remove resolved alerts
- **Severity Levels**: Info (blue), Warning (orange), Critical (red)

## 🔧 **Configuration Options**

### **Automatic Configuration**
The Swift app automatically discovers and connects to:
- **Prometheus**: `http://localhost:9091`
- **Grafana**: `http://localhost:3000`
- **AI Metrics**: `http://localhost:9092`
- **Health Monitor**: `http://localhost:8080`
- **Loki**: `http://localhost:3101`

### **Custom Configuration**
Modify `GroundingConfig.swift` to adjust:
- **Update intervals** (metrics, health, alerts)
- **Alert thresholds** (error rate, response time, resource usage)
- **Notification settings** (visual alerts, sound notifications)
- **Dashboard settings** (refresh rates, chart data points)

### **Environment Variables**
```bash
# Development mode (default)
export ENVIRONMENT=development

# Production mode
export ENVIRONMENT=production

# Custom service URLs
export PROMETHEUS_URL=http://localhost:9091
export GRAFANA_URL=http://localhost:3000
```

## 🚨 **Alert System**

### **Automatic Alert Detection**
The system automatically detects:
- **High Error Rates**: > 10% error rate
- **Slow Response Times**: > 5 seconds average
- **High GPU Usage**: > 90% utilization
- **High Memory Usage**: > 80% utilization
- **Service Failures**: Any grounding service offline

### **Alert Notifications**
- **Visual Indicators**: Color-coded severity levels
- **Alert Badges**: Count of active alerts in header
- **Detailed Views**: Full alert information with timestamps
- **Dismiss Actions**: Remove resolved alerts

### **Prometheus Integration**
- **Automatic Prometheus alert parsing**
- **Integration with existing alerting rules**
- **Real-time alert status updates**

## 📈 **Metrics Integration**

### **AI Service Metrics**
The Swift app displays real-time metrics for:
- **Request Volume**: Total AI interactions
- **Error Rates**: Success/failure ratios
- **Response Times**: Latency measurements
- **GPU Usage**: Processing load monitoring
- **Memory Usage**: Resource consumption
- **Model Performance**: Accuracy and confidence scores
- **User Satisfaction**: Experience quality metrics
- **Self Corrections**: Quality improvement tracking

### **System Metrics**
- **Service Health**: All grounding services status
- **Resource Usage**: System-wide CPU, memory, disk
- **Network Status**: Connectivity and performance
- **Alert Status**: Active alerts and notifications

## 🔗 **Service Integration**

### **Connected Services**
Your Swift app now monitors:
- **Chat Service** (port 8010): Main AI chat interface
- **MLX Service** (port 8001): AI model completions
- **HRM Service** (port 8002): Human reasoning models
- **Implementation Service** (port 8029): Code generation
- **Research Service** (port 8028): Research and analysis

### **Grounding Services**
- **Prometheus** (port 9091): Metrics collection and querying
- **Grafana** (port 3000): Advanced visualizations and dashboards
- **AI Metrics Exporter** (port 9092): Specialized AI monitoring
- **Health Monitor** (port 8080): System health tracking
- **Loki** (port 3101): Log aggregation and analysis

## 🎮 **Quick Actions**

### **From Dashboard**
- **Open Grafana**: Direct access to advanced dashboards
- **Open Prometheus**: Access to metrics querying interface
- **Refresh All**: Update all metrics and status information

### **From Main App**
- **Pop-out Menu**: Access to all specialized agent windows
- **System Monitoring**: Direct access to monitoring dashboard
- **Settings**: Configure grounding system preferences

## 🛠️ **Troubleshooting**

### **Connection Issues**
```bash
# Check if grounding services are running
docker-compose -f docker-compose.grounding.yml ps

# Check service health
curl http://localhost:9091/-/healthy
curl http://localhost:3000/api/health
curl http://localhost:9092/health
```

### **Swift App Issues**
```bash
# Check Swift app logs
# Look for grounding system connection messages

# Verify configuration
# Check GroundingConfig.swift for correct URLs
```

### **Common Solutions**
1. **Services Not Detected**: Ensure grounding system is started
2. **Connection Failed**: Check firewall and port availability
3. **Metrics Not Updating**: Verify AI services are running
4. **Alerts Not Showing**: Check Prometheus alert rules

## 🎉 **Benefits of Integration**

### **Complete Visibility**
- **Real-time monitoring** of all AI services
- **Comprehensive metrics** and performance tracking
- **Proactive alerting** for issues and anomalies
- **Visual dashboards** for easy understanding

### **Operational Excellence**
- **Centralized monitoring** from your Swift app
- **Quick access** to Grafana and Prometheus
- **Automated health checks** and service discovery
- **Integrated alert management**

### **Developer Experience**
- **Native macOS integration** with your existing app
- **Consistent UI/UX** across all interfaces
- **Real-time updates** without manual refresh
- **Comprehensive configuration** options

## 🚀 **Next Steps**

### **Immediate Actions**
1. **Start the grounding system**: `./scripts/start-grounding.sh`
2. **Launch your Swift app**: Build and run in Xcode
3. **Open monitoring dashboard**: Via pop-out menu
4. **Explore the features**: Check all tabs and metrics

### **Optional Enhancements**
- **Custom alert rules**: Modify Prometheus alerting rules
- **Additional metrics**: Add more AI-specific monitoring
- **Notification preferences**: Configure alert preferences
- **Dashboard customization**: Modify Grafana dashboards

Your Swift frontend is now fully integrated with the enterprise-grade grounding system, providing complete visibility and control over your Universal AI Tools infrastructure! 🎯
