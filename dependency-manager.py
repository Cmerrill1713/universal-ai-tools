#!/usr/bin/env python3
"""
Dependency Manager
Robust dependency and service management system
"""

import os
import json
import subprocess
import time
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

class DependencyManager:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.log_file = "/workspace/dependency-manager.log"
        self.dependencies = {
            "python": {
                "required_packages": [
                    "requests", "fastapi", "uvicorn", "pydantic",
                    "sqlalchemy", "psycopg2-binary", "redis",
                    "numpy", "pandas", "scikit-learn"
                ],
                "check_command": "python3 -c 'import sys; print(sys.version)'",
                "install_command": "pip install -r requirements.txt"
            },
            "node": {
                "required_packages": [
                    "express", "typescript", "@types/node", "jest",
                    "eslint", "prettier", "nodemon", "tsx"
                ],
                "check_command": "node --version",
                "install_command": "npm install"
            },
            "system": {
                "required_commands": [
                    "git", "curl", "wget", "tar", "gzip"
                ],
                "check_command": "which {command}",
                "install_command": "apt-get update && apt-get install -y {package}"
            }
        }
        
    def log_message(self, message: str, level: str = "INFO"):
        """Log dependency management activities"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        with open(self.log_file, "a") as f:
            f.write(log_entry)
        
        print(f"[{level}] {message}")
    
    def check_python_dependencies(self) -> Dict[str, Any]:
        """Check Python dependencies"""
        self.log_message("Checking Python dependencies...")
        
        results = {
            "python_version": None,
            "packages": {},
            "status": "unknown"
        }
        
        try:
            # Check Python version
            result = subprocess.run(["python3", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                results["python_version"] = result.stdout.strip()
                self.log_message(f"Python version: {results['python_version']}")
            else:
                self.log_message("Python not found", "ERROR")
                results["status"] = "error"
                return results
            
            # Check required packages
            missing_packages = []
            for package in self.dependencies["python"]["required_packages"]:
                try:
                    result = subprocess.run(
                        ["python3", "-c", f"import {package}"],
                        capture_output=True, text=True
                    )
                    if result.returncode == 0:
                        results["packages"][package] = "installed"
                    else:
                        results["packages"][package] = "missing"
                        missing_packages.append(package)
                except Exception as e:
                    results["packages"][package] = "error"
                    missing_packages.append(package)
            
            if missing_packages:
                results["status"] = "missing_packages"
                self.log_message(f"Missing packages: {', '.join(missing_packages)}", "WARN")
            else:
                results["status"] = "complete"
                self.log_message("All Python packages are installed")
            
        except Exception as e:
            self.log_message(f"Python dependency check error: {e}", "ERROR")
            results["status"] = "error"
        
        return results
    
    def check_node_dependencies(self) -> Dict[str, Any]:
        """Check Node.js dependencies"""
        self.log_message("Checking Node.js dependencies...")
        
        results = {
            "node_version": None,
            "npm_version": None,
            "packages": {},
            "status": "unknown"
        }
        
        try:
            # Check Node version
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                results["node_version"] = result.stdout.strip()
                self.log_message(f"Node version: {results['node_version']}")
            else:
                self.log_message("Node.js not found", "ERROR")
                results["status"] = "error"
                return results
            
            # Check NPM version
            result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                results["npm_version"] = result.stdout.strip()
                self.log_message(f"NPM version: {results['npm_version']}")
            
            # Check if package.json exists
            package_json = self.workspace / "package.json"
            if not package_json.exists():
                self.log_message("package.json not found", "WARN")
                results["status"] = "no_package_json"
                return results
            
            # Check if node_modules exists
            node_modules = self.workspace / "node_modules"
            if not node_modules.exists():
                self.log_message("node_modules not found - need to run npm install", "WARN")
                results["status"] = "missing_node_modules"
                return results
            
            # Check specific packages
            missing_packages = []
            for package in self.dependencies["node"]["required_packages"]:
                package_path = node_modules / package
                if package_path.exists():
                    results["packages"][package] = "installed"
                else:
                    results["packages"][package] = "missing"
                    missing_packages.append(package)
            
            if missing_packages:
                results["status"] = "missing_packages"
                self.log_message(f"Missing packages: {', '.join(missing_packages)}", "WARN")
            else:
                results["status"] = "complete"
                self.log_message("All Node.js packages are installed")
            
        except Exception as e:
            self.log_message(f"Node.js dependency check error: {e}", "ERROR")
            results["status"] = "error"
        
        return results
    
    def check_system_dependencies(self) -> Dict[str, Any]:
        """Check system dependencies"""
        self.log_message("Checking system dependencies...")
        
        results = {
            "commands": {},
            "status": "unknown"
        }
        
        try:
            missing_commands = []
            for command in self.dependencies["system"]["required_commands"]:
                result = subprocess.run(["which", command], capture_output=True, text=True)
                if result.returncode == 0:
                    results["commands"][command] = "available"
                else:
                    results["commands"][command] = "missing"
                    missing_commands.append(command)
            
            if missing_commands:
                results["status"] = "missing_commands"
                self.log_message(f"Missing commands: {', '.join(missing_commands)}", "WARN")
            else:
                results["status"] = "complete"
                self.log_message("All system commands are available")
            
        except Exception as e:
            self.log_message(f"System dependency check error: {e}", "ERROR")
            results["status"] = "error"
        
        return results
    
    def install_python_dependencies(self) -> bool:
        """Install Python dependencies"""
        self.log_message("Installing Python dependencies...")
        
        try:
            # Create requirements.txt if it doesn't exist
            requirements_file = self.workspace / "requirements.txt"
            if not requirements_file.exists():
                with open(requirements_file, "w") as f:
                    for package in self.dependencies["python"]["required_packages"]:
                        f.write(f"{package}\n")
                self.log_message("Created requirements.txt")
            
            # Install packages
            result = subprocess.run(
                ["pip", "install", "-r", "requirements.txt"],
                capture_output=True, text=True
            )
            
            if result.returncode == 0:
                self.log_message("Python dependencies installed successfully")
                return True
            else:
                self.log_message(f"Failed to install Python dependencies: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log_message(f"Python dependency installation error: {e}", "ERROR")
            return False
    
    def install_node_dependencies(self) -> bool:
        """Install Node.js dependencies"""
        self.log_message("Installing Node.js dependencies...")
        
        try:
            # Create package.json if it doesn't exist
            package_json = self.workspace / "package.json"
            if not package_json.exists():
                package_data = {
                    "name": "universal-ai-tools",
                    "version": "1.0.0",
                    "description": "Universal AI Tools Platform",
                    "scripts": {
                        "start": "node src/server.js",
                        "dev": "tsx watch src/server.ts",
                        "build": "tsc",
                        "test": "jest"
                    },
                    "dependencies": {
                        package: "latest" for package in self.dependencies["node"]["required_packages"]
                    },
                    "devDependencies": {
                        "@types/node": "latest",
                        "typescript": "latest",
                        "jest": "latest",
                        "eslint": "latest",
                        "prettier": "latest"
                    }
                }
                
                with open(package_json, "w") as f:
                    json.dump(package_data, f, indent=2)
                self.log_message("Created package.json")
            
            # Install packages
            result = subprocess.run(["npm", "install"], capture_output=True, text=True)
            
            if result.returncode == 0:
                self.log_message("Node.js dependencies installed successfully")
                return True
            else:
                self.log_message(f"Failed to install Node.js dependencies: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log_message(f"Node.js dependency installation error: {e}", "ERROR")
            return False
    
    def check_all_dependencies(self) -> Dict[str, Any]:
        """Check all dependencies"""
        self.log_message("Checking all dependencies...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "python": self.check_python_dependencies(),
            "node": self.check_node_dependencies(),
            "system": self.check_system_dependencies(),
            "overall_status": "unknown"
        }
        
        # Determine overall status
        statuses = [results["python"]["status"], results["node"]["status"], results["system"]["status"]]
        
        if all(status == "complete" for status in statuses):
            results["overall_status"] = "complete"
        elif any(status == "error" for status in statuses):
            results["overall_status"] = "error"
        else:
            results["overall_status"] = "incomplete"
        
        # Save results
        with open("/workspace/dependency-status.json", "w") as f:
            json.dump(results, f, indent=2)
        
        return results
    
    def auto_install_dependencies(self) -> bool:
        """Automatically install missing dependencies"""
        self.log_message("Auto-installing missing dependencies...")
        
        success = True
        
        # Install Python dependencies
        python_status = self.check_python_dependencies()
        if python_status["status"] in ["missing_packages", "error"]:
            if not self.install_python_dependencies():
                success = False
        
        # Install Node.js dependencies
        node_status = self.check_node_dependencies()
        if node_status["status"] in ["missing_packages", "missing_node_modules", "no_package_json"]:
            if not self.install_node_dependencies():
                success = False
        
        if success:
            self.log_message("All dependencies installed successfully")
        else:
            self.log_message("Some dependencies failed to install", "ERROR")
        
        return success

def main():
    manager = DependencyManager()
    
    # Check all dependencies
    results = manager.check_all_dependencies()
    
    print(f"\n📊 DEPENDENCY STATUS: {results['overall_status'].upper()}")
    print("=" * 50)
    
    # Python status
    python_status = results["python"]["status"]
    print(f"Python: {python_status.upper()}")
    if python_status != "complete":
        print(f"  Version: {results['python'].get('python_version', 'Unknown')}")
        missing = [pkg for pkg, status in results['python']['packages'].items() if status != 'installed']
        if missing:
            print(f"  Missing: {', '.join(missing)}")
    
    # Node.js status
    node_status = results["node"]["status"]
    print(f"Node.js: {node_status.upper()}")
    if node_status != "complete":
        print(f"  Node: {results['node'].get('node_version', 'Unknown')}")
        print(f"  NPM: {results['node'].get('npm_version', 'Unknown')}")
    
    # System status
    system_status = results["system"]["status"]
    print(f"System: {system_status.upper()}")
    
    # Auto-install if needed
    if results["overall_status"] != "complete":
        print("\n🔧 Auto-installing missing dependencies...")
        if manager.auto_install_dependencies():
            print("✅ Dependencies installed successfully!")
        else:
            print("❌ Some dependencies failed to install")

if __name__ == "__main__":
    main()