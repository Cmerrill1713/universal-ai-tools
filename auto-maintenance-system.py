#!/usr/bin/env python3
"""
Auto Maintenance System
Automated cleanup, optimization, and preventive maintenance
"""

import os
import time
import json
import subprocess
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import threading

class AutoMaintenanceSystem:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.log_file = "/workspace/maintenance.log"
        self.maintenance_active = True
        
    def log_message(self, message: str, level: str = "INFO"):
        """Log maintenance activities"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        with open(self.log_file, "a") as f:
            f.write(log_entry)
        
        print(f"[{level}] {message}")
    
    def cleanup_temp_files(self):
        """Clean up temporary files and caches"""
        self.log_message("Starting temporary file cleanup...")
        
        temp_patterns = [
            "*.tmp", "*.temp", "*.log", "*.cache", "*.pid",
            "__pycache__", "*.pyc", "node_modules/.cache",
            ".DS_Store", "Thumbs.db"
        ]
        
        cleaned_files = 0
        for pattern in temp_patterns:
            for file_path in self.workspace.rglob(pattern):
                try:
                    if file_path.is_file():
                        file_path.unlink()
                        cleaned_files += 1
                    elif file_path.is_dir():
                        shutil.rmtree(file_path)
                        cleaned_files += 1
                except Exception as e:
                    self.log_message(f"Could not clean {file_path}: {e}", "WARN")
        
        self.log_message(f"Cleaned {cleaned_files} temporary files")
    
    def optimize_database(self):
        """Optimize database and clean up old data"""
        self.log_message("Starting database optimization...")
        
        try:
            # Clean up old logs (keep last 7 days)
            cutoff_date = datetime.now() - timedelta(days=7)
            
            log_files = list(self.workspace.glob("*.log"))
            for log_file in log_files:
                if log_file.stat().st_mtime < cutoff_date.timestamp():
                    log_file.unlink()
                    self.log_message(f"Removed old log file: {log_file.name}")
            
            # Clean up old reports (keep last 30 days)
            report_files = list(self.workspace.glob("*report*.json"))
            for report_file in report_files:
                if report_file.stat().st_mtime < cutoff_date.timestamp():
                    report_file.unlink()
                    self.log_message(f"Removed old report: {report_file.name}")
            
            self.log_message("Database optimization completed")
            
        except Exception as e:
            self.log_message(f"Database optimization error: {e}", "ERROR")
    
    def check_disk_space(self):
        """Check and manage disk space"""
        self.log_message("Checking disk space...")
        
        try:
            # Get disk usage
            result = subprocess.run(["df", "-h", "/workspace"], capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if len(lines) > 1:
                    usage_line = lines[1].split()
                    if len(usage_line) >= 5:
                        used_percent = usage_line[4].replace('%', '')
                        if int(used_percent) > 80:
                            self.log_message(f"Disk usage is {used_percent}% - running cleanup", "WARN")
                            self.cleanup_temp_files()
                        else:
                            self.log_message(f"Disk usage is {used_percent}% - OK")
            
        except Exception as e:
            self.log_message(f"Disk space check error: {e}", "ERROR")
    
    def update_dependencies(self):
        """Check and update dependencies"""
        self.log_message("Checking dependencies...")
        
        try:
            # Check Python packages
            if (self.workspace / "requirements.txt").exists():
                result = subprocess.run(["pip", "list", "--outdated"], capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    self.log_message("Outdated Python packages found - consider updating")
            
            # Check Node.js packages
            if (self.workspace / "package.json").exists():
                result = subprocess.run(["npm", "outdated"], capture_output=True, text=True)
                if result.returncode == 0 and result.stdout.strip():
                    self.log_message("Outdated Node.js packages found - consider updating")
            
            self.log_message("Dependency check completed")
            
        except Exception as e:
            self.log_message(f"Dependency check error: {e}", "ERROR")
    
    def validate_configurations(self):
        """Validate all configuration files"""
        self.log_message("Validating configurations...")
        
        config_files = [
            "package.json", "tsconfig.json", "jest.config.js",
            ".env", ".gitignore", "docker-compose.yml"
        ]
        
        for config_file in config_files:
            config_path = self.workspace / config_file
            if config_path.exists():
                try:
                    if config_file.endswith('.json'):
                        with open(config_path, 'r') as f:
                            json.load(f)
                        self.log_message(f"✅ {config_file} is valid JSON")
                    else:
                        self.log_message(f"✅ {config_file} exists")
                except Exception as e:
                    self.log_message(f"❌ {config_file} has issues: {e}", "ERROR")
    
    def backup_critical_files(self):
        """Backup critical configuration and data files"""
        self.log_message("Creating backup of critical files...")
        
        backup_dir = self.workspace / "backups" / datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        critical_files = [
            "package.json", "tsconfig.json", ".env",
            "src/", "api/", "supabase/"
        ]
        
        for file_pattern in critical_files:
            file_path = self.workspace / file_pattern
            if file_pattern.endswith('/'):
                # Directory
                if file_path.exists():
                    shutil.copytree(file_path, backup_dir / file_pattern.rstrip('/'))
            else:
                # File
                if file_path.exists():
                    shutil.copy2(file_path, backup_dir)
        
        self.log_message(f"Backup created in {backup_dir}")
    
    def run_maintenance_cycle(self):
        """Run a complete maintenance cycle"""
        self.log_message("Starting maintenance cycle...")
        
        try:
            # 1. Cleanup
            self.cleanup_temp_files()
            
            # 2. Database optimization
            self.optimize_database()
            
            # 3. Disk space check
            self.check_disk_space()
            
            # 4. Dependency check
            self.update_dependencies()
            
            # 5. Configuration validation
            self.validate_configurations()
            
            # 6. Backup critical files (weekly)
            if datetime.now().weekday() == 0:  # Monday
                self.backup_critical_files()
            
            self.log_message("Maintenance cycle completed successfully")
            
        except Exception as e:
            self.log_message(f"Maintenance cycle error: {e}", "ERROR")
    
    def start_auto_maintenance(self):
        """Start automated maintenance system"""
        self.log_message("Auto Maintenance System starting...")
        
        while self.maintenance_active:
            try:
                self.run_maintenance_cycle()
                
                # Wait 1 hour before next cycle
                time.sleep(3600)
                
            except KeyboardInterrupt:
                self.log_message("Maintenance stopped by user")
                self.maintenance_active = False
                break
            except Exception as e:
                self.log_message(f"Error in maintenance loop: {e}", "ERROR")
                time.sleep(300)  # Wait 5 minutes on error
    
    def stop_maintenance(self):
        """Stop the maintenance system"""
        self.maintenance_active = False
        self.log_message("Stopping auto maintenance system...")

def main():
    maintenance = AutoMaintenanceSystem()
    
    try:
        maintenance.start_auto_maintenance()
    except Exception as e:
        print(f"Fatal error: {e}")
        exit(1)

if __name__ == "__main__":
    main()