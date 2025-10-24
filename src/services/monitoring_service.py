#!/usr/bin/env python3
"""
Comprehensive Monitoring System
Production-ready monitoring with metrics, alerts, and dashboards
"""

import asyncio
import json
import time
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class Metric:
    name: str
    value: float
    timestamp: float
    tags: Dict[str, str]
    unit: str = ""

@dataclass
class Alert:
    id: str
    severity: str
    message: str
    timestamp: float
    resolved: bool = False

class MonitoringService:
    def __init__(self):
        self.metrics = []
        self.alerts = []
        self.thresholds = {
            'response_time': 1000,  # ms
            'error_rate': 0.05,     # 5%
            'memory_usage': 0.8,    # 80%
            'cpu_usage': 0.8        # 80%
        }
        self.start_time = time.time()
        
    async def record_metric(self, metric: Metric):
        """Record a metric"""
        self.metrics.append(metric)
        
        # Check for alerts
        await self._check_thresholds(metric)
        
        # Keep only last 1000 metrics
        if len(self.metrics) > 1000:
            self.metrics = self.metrics[-1000:]
    
    async def _check_thresholds(self, metric: Metric):
        """Check if metric exceeds thresholds"""
        threshold = self.thresholds.get(metric.name)
        if threshold and metric.value > threshold:
            alert = Alert(
                id=f"{metric.name}_{int(time.time())}",
                severity="warning" if metric.value < threshold * 1.5 else "critical",
                message=f"{metric.name} exceeded threshold: {metric.value} > {threshold}",
                timestamp=time.time()
            )
            self.alerts.append(alert)
            self.log(f"ALERT: {alert.message}", "WARNING")
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get overall system health status"""
        uptime = time.time() - self.start_time
        
        # Calculate current metrics
        recent_metrics = [m for m in self.metrics if time.time() - m.timestamp < 300]  # Last 5 minutes
        
        response_times = [m.value for m in recent_metrics if m.name == 'response_time']
        error_rates = [m.value for m in recent_metrics if m.name == 'error_rate']
        
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        avg_error_rate = sum(error_rates) / len(error_rates) if error_rates else 0
        
        # Determine health status
        if avg_error_rate > 0.1 or avg_response_time > 5000:
            health_status = "critical"
        elif avg_error_rate > 0.05 or avg_response_time > 2000:
            health_status = "warning"
        else:
            health_status = "healthy"
        
        return {
            "status": health_status,
            "uptime": uptime,
            "metrics": {
                "total_metrics": len(self.metrics),
                "recent_metrics": len(recent_metrics),
                "avg_response_time": avg_response_time,
                "avg_error_rate": avg_error_rate
            },
            "alerts": {
                "total": len(self.alerts),
                "unresolved": len([a for a in self.alerts if not a.resolved]),
                "recent": len([a for a in self.alerts if time.time() - a.timestamp < 3600])
            }
        }
    
    async def get_performance_report(self) -> Dict[str, Any]:
        """Get detailed performance report"""
        now = time.time()
        last_hour = now - 3600
        
        # Filter metrics from last hour
        recent_metrics = [m for m in self.metrics if m.timestamp > last_hour]
        
        # Group by metric name
        metric_groups = {}
        for metric in recent_metrics:
            if metric.name not in metric_groups:
                metric_groups[metric.name] = []
            metric_groups[metric.name].append(metric.value)
        
        # Calculate statistics
        report = {
            "period": "last_hour",
            "metrics": {},
            "summary": {
                "total_requests": len([m for m in recent_metrics if m.name == 'request_count']),
                "avg_response_time": 0,
                "error_rate": 0,
                "throughput": 0
            }
        }
        
        for name, values in metric_groups.items():
            if values:
                report["metrics"][name] = {
                    "count": len(values),
                    "min": min(values),
                    "max": max(values),
                    "avg": sum(values) / len(values),
                    "p95": sorted(values)[int(len(values) * 0.95)] if len(values) > 1 else values[0]
                }
        
        # Calculate summary metrics
        if 'response_time' in report["metrics"]:
            report["summary"]["avg_response_time"] = report["metrics"]["response_time"]["avg"]
        
        if 'error_rate' in report["metrics"]:
            report["summary"]["error_rate"] = report["metrics"]["error_rate"]["avg"]
        
        if 'request_count' in report["metrics"]:
            report["summary"]["throughput"] = report["metrics"]["request_count"]["avg"] / 60  # per minute
        
        return report
    
    def log(self, message: str, level: str = "INFO"):
        """Log message"""
        print(f"[MonitoringService] {level}: {message}")

# Global monitoring service
_monitoring_service = None

def get_monitoring_service() -> MonitoringService:
    """Get global monitoring service instance"""
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService()
    return _monitoring_service

if __name__ == "__main__":
    # Test monitoring service
    async def test_monitoring():
        monitoring = get_monitoring_service()
        
        # Record some test metrics
        await monitoring.record_metric(Metric("response_time", 150.0, time.time(), {"endpoint": "/api/chat"}))
        await monitoring.record_metric(Metric("error_rate", 0.02, time.time(), {"service": "api"}))
        await monitoring.record_metric(Metric("memory_usage", 0.6, time.time(), {"service": "api"}))
        
        # Get health status
        health = await monitoring.get_health_status()
        print(f"Health Status: {health}")
        
        # Get performance report
        report = await monitoring.get_performance_report()
        print(f"Performance Report: {json.dumps(report, indent=2)}")
    
    import asyncio
    asyncio.run(test_monitoring())
