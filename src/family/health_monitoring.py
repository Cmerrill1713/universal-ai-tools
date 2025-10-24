#!/usr/bin/env python3
"""
Family Athena Health Monitoring
Comprehensive health monitoring for all services
"""

import asyncio
import json
import time
import psutil
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

class HealthMonitor:
    def __init__(self):
        self.services = {}
        self.health_checks = {}
        self.metrics = {}
        self.alerts = []
        self.running = False
        self.check_interval = 30  # seconds
        
    def log(self, message, level="INFO"):
        """Log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_service(self, service_name: str, health_check_func):
        """Register a service for health monitoring"""
        self.health_checks[service_name] = health_check_func
        self.log(f"✅ Health monitoring registered for {service_name}")
        
    async def check_service_health(self, service_name: str) -> Dict[str, Any]:
        """Check health of a specific service"""
        if service_name not in self.health_checks:
            return {
                "status": "unknown",
                "message": "Service not registered for health monitoring",
                "timestamp": datetime.now().isoformat()
            }
        
        try:
            health_check = self.health_checks[service_name]
            if asyncio.iscoroutinefunction(health_check):
                result = await health_check()
            else:
                result = health_check()
            
            return {
                "status": "healthy" if result else "unhealthy",
                "message": "Service is healthy" if result else "Service is unhealthy",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
    
    async def check_system_health(self) -> Dict[str, Any]:
        """Check overall system health"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu_usage": cpu_percent,
            "memory_usage": memory.percent,
            "memory_available": memory.available,
            "disk_usage": disk.percent,
            "disk_free": disk.free,
            "timestamp": datetime.now().isoformat()
        }
    
    async def check_family_data_health(self) -> Dict[str, Any]:
        """Check health of family data"""
        try:
            from src.family.family_profiles import get_family_profile_service
            from src.family.family_calendar import get_family_calendar_service
            from src.family.family_knowledge import get_family_knowledge_service
            
            profile_service = get_family_profile_service()
            calendar_service = get_family_calendar_service()
            knowledge_service = get_family_knowledge_service()
            
            # Check data integrity
            family_summary = await profile_service.get_family_summary()
            calendar_events = await calendar_service.get_family_schedule(
                datetime.now().date(),
                datetime.now().date() + timedelta(days=7)
            )
            knowledge_summary = await knowledge_service.get_knowledge_summary()
            
            return {
                "family_members": family_summary["total_members"],
                "calendar_events": len(calendar_events["events"]),
                "knowledge_items": knowledge_summary["total_items"],
                "data_integrity": "good",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "data_integrity": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """Run all health checks"""
        health_report = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "healthy",
            "services": {},
            "system": {},
            "family_data": {},
            "alerts": []
        }
        
        # Check individual services
        for service_name in self.health_checks:
            service_health = await self.check_service_health(service_name)
            health_report["services"][service_name] = service_health
            
            if service_health["status"] != "healthy":
                health_report["overall_status"] = "degraded"
                health_report["alerts"].append({
                    "type": "service_unhealthy",
                    "service": service_name,
                    "message": service_health["message"],
                    "timestamp": service_health["timestamp"]
                })
        
        # Check system health
        system_health = await self.check_system_health()
        health_report["system"] = system_health
        
        # Check for system resource issues
        if system_health["cpu_usage"] > 80:
            health_report["alerts"].append({
                "type": "high_cpu_usage",
                "message": f"CPU usage is {system_health['cpu_usage']}%",
                "timestamp": system_health["timestamp"]
            })
            health_report["overall_status"] = "degraded"
        
        if system_health["memory_usage"] > 90:
            health_report["alerts"].append({
                "type": "high_memory_usage",
                "message": f"Memory usage is {system_health['memory_usage']}%",
                "timestamp": system_health["timestamp"]
            })
            health_report["overall_status"] = "degraded"
        
        # Check family data health
        family_data_health = await self.check_family_data_health()
        health_report["family_data"] = family_data_health
        
        if family_data_health.get("data_integrity") == "error":
            health_report["alerts"].append({
                "type": "data_integrity_error",
                "message": "Family data integrity check failed",
                "timestamp": family_data_health["timestamp"]
            })
            health_report["overall_status"] = "unhealthy"
        
        return health_report
    
    async def start_monitoring(self):
        """Start health monitoring"""
        self.running = True
        self.log("🏥 Health monitoring started")
        
        # Start monitoring loop
        asyncio.create_task(self.monitoring_loop())
    
    async def monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                health_report = await self.run_health_checks()
                
                # Log health status
                status = health_report["overall_status"]
                if status == "healthy":
                    self.log("✅ All systems healthy")
                elif status == "degraded":
                    self.log("⚠️ System degraded - check alerts")
                else:
                    self.log("❌ System unhealthy - immediate attention required")
                
                # Store metrics
                self.metrics[datetime.now().isoformat()] = health_report
                
                # Check for alerts
                if health_report["alerts"]:
                    for alert in health_report["alerts"]:
                        self.log(f"🚨 ALERT: {alert['message']}", "WARNING")
                        self.alerts.append(alert)
                
                await asyncio.sleep(self.check_interval)
                
            except Exception as e:
                self.log(f"❌ Error in monitoring loop: {e}", "ERROR")
                await asyncio.sleep(self.check_interval)
    
    async def stop_monitoring(self):
        """Stop health monitoring"""
        self.running = False
        self.log("🛑 Health monitoring stopped")
    
    def get_health_summary(self) -> Dict[str, Any]:
        """Get current health summary"""
        if not self.metrics:
            return {"status": "no_data", "message": "No health data available"}
        
        latest_metric = max(self.metrics.keys())
        return self.metrics[latest_metric]
    
    def get_alerts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get alerts from the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_alerts = []
        
        for alert in self.alerts:
            alert_time = datetime.fromisoformat(alert["timestamp"])
            if alert_time >= cutoff_time:
                recent_alerts.append(alert)
        
        return recent_alerts

# Global health monitor instance
_health_monitor = None

def get_health_monitor() -> HealthMonitor:
    """Get global health monitor instance"""
    global _health_monitor
    if _health_monitor is None:
        _health_monitor = HealthMonitor()
    return _health_monitor

# Health monitoring functions
async def register_service_health(service_name: str, health_check_func):
    """Register a service for health monitoring"""
    monitor = get_health_monitor()
    monitor.register_service(service_name, health_check_func)

async def get_system_health() -> Dict[str, Any]:
    """Get current system health"""
    monitor = get_health_monitor()
    return await monitor.run_health_checks()

async def start_health_monitoring():
    """Start health monitoring"""
    monitor = get_health_monitor()
    await monitor.start_monitoring()

if __name__ == "__main__":
    async def main():
        monitor = get_health_monitor()
        await monitor.start_monitoring()
        
        # Keep running
        while True:
            await asyncio.sleep(1)
    
    asyncio.run(main())
