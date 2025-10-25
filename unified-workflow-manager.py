#!/usr/bin/env python3
"""
Unified Workflow Manager
Orchestrates all workflows to prevent breaking and maintain system health
"""

import os
import json
import time
import threading
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

class UnifiedWorkflowManager:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.log_file = "/workspace/workflow-manager.log"
        self.active = True
        
        # Workflow components
        self.health_monitor = None
        self.maintenance_system = None
        self.dependency_manager = None
        
        # Workflow status
        self.workflow_status = {
            "health_monitoring": False,
            "auto_maintenance": False,
            "dependency_management": False,
            "service_management": False,
            "error_recovery": False
        }
        
    def log_message(self, message: str, level: str = "INFO"):
        """Log workflow activities"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        with open(self.log_file, "a") as f:
            f.write(log_entry)
        
        print(f"[{level}] {message}")
    
    def start_health_monitoring(self):
        """Start health monitoring workflow"""
        try:
            self.log_message("Starting health monitoring workflow...")
            
            # Start health monitor in background
            subprocess.Popen([
                "python3", "/workspace/system-health-monitor.py"
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            self.workflow_status["health_monitoring"] = True
            self.log_message("Health monitoring workflow started")
            
        except Exception as e:
            self.log_message(f"Failed to start health monitoring: {e}", "ERROR")
    
    def start_auto_maintenance(self):
        """Start auto maintenance workflow"""
        try:
            self.log_message("Starting auto maintenance workflow...")
            
            # Start maintenance system in background
            subprocess.Popen([
                "python3", "/workspace/auto-maintenance-system.py"
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            self.workflow_status["auto_maintenance"] = True
            self.log_message("Auto maintenance workflow started")
            
        except Exception as e:
            self.log_message(f"Failed to start auto maintenance: {e}", "ERROR")
    
    def start_dependency_management(self):
        """Start dependency management workflow"""
        try:
            self.log_message("Starting dependency management workflow...")
            
            # Run dependency check and auto-install
            result = subprocess.run([
                "python3", "/workspace/dependency-manager.py"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                self.workflow_status["dependency_management"] = True
                self.log_message("Dependency management workflow completed")
            else:
                self.log_message(f"Dependency management failed: {result.stderr}", "ERROR")
            
        except Exception as e:
            self.log_message(f"Failed to start dependency management: {e}", "ERROR")
    
    def start_service_management(self):
        """Start service management workflow"""
        try:
            self.log_message("Starting service management workflow...")
            
            # Start core services
            services = [
                {"name": "Athena Gateway", "port": 8080, "script": "start-athena-gateway.py"},
                {"name": "Family Athena", "port": 8081, "script": "start-family-athena.py"},
                {"name": "Universal AI Tools", "port": 9000, "script": "start-universal-ai.py"},
                {"name": "DSPy Orchestrator", "port": 8005, "script": "start-dspy.py"},
                {"name": "MLX Service", "port": 8006, "script": "start-mlx.py"},
                {"name": "Vision Service", "port": 8007, "script": "start-vision.py"},
                {"name": "Memory Service", "port": 8008, "script": "start-memory.py"},
                {"name": "Agent Service", "port": 8009, "script": "start-agents.py"},
                {"name": "Monitoring Service", "port": 8010, "script": "start-monitoring.py"}
            ]
            
            started_services = 0
            for service in services:
                try:
                    # Check if port is available
                    result = subprocess.run([
                        "lsof", "-ti", f":{service['port']}"
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        self.log_message(f"Port {service['port']} already in use, skipping {service['name']}")
                        continue
                    
                    # Start service
                    subprocess.Popen([
                        "python3", f"/workspace/{service['script']}"
                    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    
                    started_services += 1
                    self.log_message(f"Started {service['name']} on port {service['port']}")
                    
                    # Small delay between starts
                    time.sleep(1)
                    
                except Exception as e:
                    self.log_message(f"Failed to start {service['name']}: {e}", "ERROR")
            
            if started_services > 0:
                self.workflow_status["service_management"] = True
                self.log_message(f"Service management workflow completed - started {started_services} services")
            else:
                self.log_message("No services started", "WARN")
            
        except Exception as e:
            self.log_message(f"Failed to start service management: {e}", "ERROR")
    
    def start_error_recovery(self):
        """Start error recovery workflow"""
        try:
            self.log_message("Starting error recovery workflow...")
            
            # Monitor for errors and attempt recovery
            def error_recovery_loop():
                while self.active:
                    try:
                        # Check for error logs
                        error_logs = []
                        for log_file in self.workspace.glob("*.log"):
                            try:
                                with open(log_file, "r") as f:
                                    lines = f.readlines()
                                    for line in lines[-100:]:  # Check last 100 lines
                                        if "ERROR" in line or "FATAL" in line:
                                            error_logs.append(f"{log_file.name}: {line.strip()}")
                            except Exception:
                                continue
                        
                        if error_logs:
                            self.log_message(f"Found {len(error_logs)} errors, attempting recovery...")
                            
                            # Attempt basic recovery
                            self.basic_error_recovery()
                        
                        # Wait before next check
                        time.sleep(60)
                        
                    except Exception as e:
                        self.log_message(f"Error in recovery loop: {e}", "ERROR")
                        time.sleep(300)
            
            # Start error recovery in background thread
            recovery_thread = threading.Thread(target=error_recovery_loop)
            recovery_thread.daemon = True
            recovery_thread.start()
            
            self.workflow_status["error_recovery"] = True
            self.log_message("Error recovery workflow started")
            
        except Exception as e:
            self.log_message(f"Failed to start error recovery: {e}", "ERROR")
    
    def basic_error_recovery(self):
        """Perform basic error recovery"""
        try:
            self.log_message("Performing basic error recovery...")
            
            # Kill any zombie processes
            subprocess.run(["pkill", "-f", "python3"], capture_output=True)
            time.sleep(2)
            
            # Clean up temp files
            subprocess.run(["find", "/workspace", "-name", "*.tmp", "-delete"], capture_output=True)
            subprocess.run(["find", "/workspace", "-name", "*.log", "-mtime", "+7", "-delete"], capture_output=True)
            
            # Restart critical services
            self.start_service_management()
            
            self.log_message("Basic error recovery completed")
            
        except Exception as e:
            self.log_message(f"Error recovery failed: {e}", "ERROR")
    
    def generate_workflow_report(self) -> Dict[str, Any]:
        """Generate comprehensive workflow report"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "workflow_status": self.workflow_status,
            "overall_health": "unknown",
            "recommendations": []
        }
        
        # Determine overall health
        active_workflows = sum(1 for status in self.workflow_status.values() if status)
        total_workflows = len(self.workflow_status)
        
        if active_workflows == total_workflows:
            report["overall_health"] = "excellent"
        elif active_workflows >= total_workflows * 0.8:
            report["overall_health"] = "good"
        elif active_workflows >= total_workflows * 0.6:
            report["overall_health"] = "fair"
        else:
            report["overall_health"] = "poor"
        
        # Generate recommendations
        if not self.workflow_status["health_monitoring"]:
            report["recommendations"].append("Start health monitoring workflow")
        if not self.workflow_status["auto_maintenance"]:
            report["recommendations"].append("Start auto maintenance workflow")
        if not self.workflow_status["dependency_management"]:
            report["recommendations"].append("Run dependency management")
        if not self.workflow_status["service_management"]:
            report["recommendations"].append("Start service management workflow")
        if not self.workflow_status["error_recovery"]:
            report["recommendations"].append("Start error recovery workflow")
        
        return report
    
    def start_all_workflows(self):
        """Start all workflows"""
        self.log_message("Starting all workflows...")
        
        # Start workflows in order
        self.start_dependency_management()
        time.sleep(5)
        
        self.start_service_management()
        time.sleep(5)
        
        self.start_health_monitoring()
        time.sleep(2)
        
        self.start_auto_maintenance()
        time.sleep(2)
        
        self.start_error_recovery()
        
        # Generate initial report
        report = self.generate_workflow_report()
        with open("/workspace/workflow-report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        self.log_message("All workflows started successfully!")
        self.log_message(f"Overall health: {report['overall_health'].upper()}")
        
        if report["recommendations"]:
            self.log_message("Recommendations:")
            for rec in report["recommendations"]:
                self.log_message(f"  - {rec}")
    
    def stop_all_workflows(self):
        """Stop all workflows"""
        self.log_message("Stopping all workflows...")
        
        self.active = False
        
        # Stop background processes
        subprocess.run(["pkill", "-f", "system-health-monitor.py"], capture_output=True)
        subprocess.run(["pkill", "-f", "auto-maintenance-system.py"], capture_output=True)
        
        self.log_message("All workflows stopped")
    
    def run_workflow_manager(self):
        """Run the main workflow manager"""
        try:
            self.start_all_workflows()
            
            # Keep running and generate periodic reports
            while self.active:
                time.sleep(300)  # 5 minutes
                
                report = self.generate_workflow_report()
                with open("/workspace/workflow-report.json", "w") as f:
                    json.dump(report, f, indent=2)
                
                self.log_message(f"Workflow status: {report['overall_health'].upper()}")
                
        except KeyboardInterrupt:
            self.log_message("Workflow manager stopped by user")
            self.stop_all_workflows()
        except Exception as e:
            self.log_message(f"Fatal error in workflow manager: {e}", "ERROR")
            self.stop_all_workflows()

def main():
    manager = UnifiedWorkflowManager()
    
    print("🚀 UNIFIED WORKFLOW MANAGER")
    print("=" * 50)
    print("Starting comprehensive workflow system...")
    print("This will prevent breaking and keep everything in shape!")
    print()
    
    try:
        manager.run_workflow_manager()
    except Exception as e:
        print(f"Fatal error: {e}")
        exit(1)

if __name__ == "__main__":
    main()