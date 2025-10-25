#!/usr/bin/env python3
"""
System Health Monitor
Continuous monitoring and self-healing for all services
"""

import time
import json
import subprocess
import threading
import requests
from datetime import datetime
from typing import Dict, List, Any
import os
import signal
import sys

class SystemHealthMonitor:
    def __init__(self):
        self.services = {
            "athena-gateway": {"port": 8080, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-athena-gateway.py"},
            "family-athena": {"port": 8081, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-family-athena.py"},
            "universal-ai": {"port": 9000, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-universal-ai.py"},
            "dspy-orchestrator": {"port": 8005, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-dspy.py"},
            "mlx-service": {"port": 8006, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-mlx.py"},
            "vision-service": {"port": 8007, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-vision.py"},
            "memory-service": {"port": 8008, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-memory.py"},
            "agent-service": {"port": 8009, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-agents.py"},
            "monitoring": {"port": 8010, "health_endpoint": "/health", "restart_command": "python3 /workspace/start-monitoring.py"}
        }
        
        self.health_status = {}
        self.restart_attempts = {}
        self.max_restart_attempts = 3
        self.monitoring_active = True
        self.log_file = "/workspace/system-health.log"
        
    def log_message(self, message: str, level: str = "INFO"):
        """Log messages with timestamp"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        with open(self.log_file, "a") as f:
            f.write(log_entry)
        
        print(f"[{level}] {message}")
    
    def check_service_health(self, service_name: str) -> bool:
        """Check if a service is healthy"""
        try:
            service = self.services[service_name]
            url = f"http://localhost:{service['port']}{service['health_endpoint']}"
            
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                self.health_status[service_name] = "healthy"
                return True
            else:
                self.health_status[service_name] = f"unhealthy (HTTP {response.status_code})"
                return False
                
        except Exception as e:
            self.health_status[service_name] = f"unhealthy ({str(e)})"
            return False
    
    def restart_service(self, service_name: str) -> bool:
        """Restart a failed service"""
        try:
            service = self.services[service_name]
            restart_command = service["restart_command"]
            
            # Kill any existing processes on the port
            self.kill_process_on_port(service["port"])
            
            # Wait a moment
            time.sleep(2)
            
            # Start the service
            subprocess.Popen(restart_command, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # Wait for service to start
            time.sleep(5)
            
            # Check if it's healthy now
            if self.check_service_health(service_name):
                self.log_message(f"Successfully restarted {service_name}")
                self.restart_attempts[service_name] = 0
                return True
            else:
                self.log_message(f"Failed to restart {service_name}", "ERROR")
                return False
                
        except Exception as e:
            self.log_message(f"Error restarting {service_name}: {e}", "ERROR")
            return False
    
    def kill_process_on_port(self, port: int):
        """Kill any process using the specified port"""
        try:
            # Find process using the port
            result = subprocess.run(f"lsof -ti:{port}", shell=True, capture_output=True, text=True)
            if result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    if pid:
                        subprocess.run(f"kill -9 {pid}", shell=True)
                        self.log_message(f"Killed process {pid} on port {port}")
        except Exception as e:
            self.log_message(f"Error killing process on port {port}: {e}", "WARN")
    
    def monitor_services(self):
        """Continuously monitor all services"""
        self.log_message("Starting service monitoring...")
        
        while self.monitoring_active:
            for service_name in self.services:
                is_healthy = self.check_service_health(service_name)
                
                if not is_healthy:
                    self.log_message(f"Service {service_name} is unhealthy: {self.health_status[service_name]}")
                    
                    # Attempt restart if we haven't exceeded max attempts
                    attempts = self.restart_attempts.get(service_name, 0)
                    if attempts < self.max_restart_attempts:
                        self.log_message(f"Attempting to restart {service_name} (attempt {attempts + 1})")
                        if self.restart_service(service_name):
                            self.log_message(f"Successfully recovered {service_name}")
                        else:
                            self.restart_attempts[service_name] = attempts + 1
                            if attempts + 1 >= self.max_restart_attempts:
                                self.log_message(f"Service {service_name} failed after {self.max_restart_attempts} restart attempts", "ERROR")
                    else:
                        self.log_message(f"Service {service_name} is down and max restart attempts exceeded", "ERROR")
                else:
                    # Reset restart attempts if service is healthy
                    self.restart_attempts[service_name] = 0
            
            # Wait before next check
            time.sleep(30)
    
    def generate_health_report(self) -> Dict[str, Any]:
        """Generate comprehensive health report"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "healthy",
            "services": {},
            "summary": {
                "total_services": len(self.services),
                "healthy_services": 0,
                "unhealthy_services": 0,
                "restart_attempts": dict(self.restart_attempts)
            }
        }
        
        for service_name in self.services:
            is_healthy = self.check_service_health(service_name)
            report["services"][service_name] = {
                "status": "healthy" if is_healthy else "unhealthy",
                "details": self.health_status.get(service_name, "unknown"),
                "port": self.services[service_name]["port"]
            }
            
            if is_healthy:
                report["summary"]["healthy_services"] += 1
            else:
                report["summary"]["unhealthy_services"] += 1
        
        # Determine overall status
        if report["summary"]["unhealthy_services"] > 0:
            report["overall_status"] = "degraded" if report["summary"]["healthy_services"] > 0 else "unhealthy"
        
        return report
    
    def save_health_report(self, report: Dict[str, Any]):
        """Save health report to file"""
        with open("/workspace/health-report.json", "w") as f:
            json.dump(report, f, indent=2)
    
    def start_monitoring(self):
        """Start the monitoring system"""
        self.log_message("System Health Monitor starting...")
        
        # Start monitoring in a separate thread
        monitor_thread = threading.Thread(target=self.monitor_services)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        # Generate periodic reports
        while self.monitoring_active:
            try:
                report = self.generate_health_report()
                self.save_health_report(report)
                
                # Log summary
                healthy = report["summary"]["healthy_services"]
                total = report["summary"]["total_services"]
                self.log_message(f"Health Check: {healthy}/{total} services healthy")
                
                time.sleep(300)  # Generate report every 5 minutes
                
            except KeyboardInterrupt:
                self.log_message("Monitoring stopped by user")
                self.monitoring_active = False
                break
            except Exception as e:
                self.log_message(f"Error in monitoring loop: {e}", "ERROR")
                time.sleep(60)
    
    def stop_monitoring(self):
        """Stop the monitoring system"""
        self.monitoring_active = False
        self.log_message("Stopping system health monitor...")

def main():
    monitor = SystemHealthMonitor()
    
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        monitor.stop_monitoring()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        monitor.start_monitoring()
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()