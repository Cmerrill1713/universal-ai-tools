#!/usr/bin/env python3
"""
Integrated Autonomous Assistant with Learning Capabilities
Combines all assistant systems and learns from interactions
"""

import subprocess
import json
import os
import sys
from datetime import datetime
import hashlib
import requests
from typing import Dict, Any, List, Optional
from pathlib import Path
import pickle

# Import our existing modules - fix import paths
import importlib.util
import sys

def import_module_from_path(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        print(f"Warning: Could not import {module_name}: {e}")
        return None

# Import modules with proper error handling
autonomous_agent_module = import_module_from_path("autonomous_agent", "autonomous-agent.py")
system_automation_module = import_module_from_path("system_automation", "system-automation.py") 
action_assistant_module = import_module_from_path("action_assistant", "action-assistant.py")

class IntegratedAssistant:
    def __init__(self):
        # Initialize all subsystems with error handling
        self.autonomous_agent = None
        self.system_automation = None
        self.action_assistant = None
        
        # Initialize subsystems if modules were loaded successfully
        if autonomous_agent_module and hasattr(autonomous_agent_module, 'AutonomousAgent'):
            try:
                self.autonomous_agent = autonomous_agent_module.AutonomousAgent()
            except Exception as e:
                print(f"Warning: Could not initialize autonomous agent: {e}")
        
        if system_automation_module and hasattr(system_automation_module, 'SystemAutomation'):
            try:
                self.system_automation = system_automation_module.SystemAutomation()
            except Exception as e:
                print(f"Warning: Could not initialize system automation: {e}")
                
        if action_assistant_module and hasattr(action_assistant_module, 'ActionAssistant'):
            try:
                self.action_assistant = action_assistant_module.ActionAssistant()
            except Exception as e:
                print(f"Warning: Could not initialize action assistant: {e}")
        
        # Learning storage
        self.learning_db_path = Path("learning_data")
        self.learning_db_path.mkdir(exist_ok=True)
        
        # Success patterns database
        self.patterns_file = self.learning_db_path / "success_patterns.json"
        self.workflows_file = self.learning_db_path / "workflows.json"
        self.preferences_file = self.learning_db_path / "user_preferences.json"
        
        # Load learned patterns
        self.success_patterns = self.load_patterns()
        self.workflows = self.load_workflows()
        self.user_preferences = self.load_preferences()
        
        # Supabase configuration for permanent storage
        self.supabase_url = "http://localhost:54321"
        self.supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
        
        # API Gateway integration
        self.api_gateway_url = "http://localhost:8080/api/v1"
        
        # Task history for learning
        self.task_history = []
        
    def load_patterns(self) -> Dict:
        """Load learned success patterns"""
        if self.patterns_file.exists():
            with open(self.patterns_file, 'r') as f:
                return json.load(f)
        return {
            "command_patterns": {},
            "success_rates": {},
            "optimization_hints": {}
        }
    
    def load_workflows(self) -> Dict:
        """Load saved workflows"""
        if self.workflows_file.exists():
            with open(self.workflows_file, 'r') as f:
                return json.load(f)
        return {
            "saved_workflows": [],
            "templates": []
        }
    
    def load_preferences(self) -> Dict:
        """Load user preferences"""
        if self.preferences_file.exists():
            with open(self.preferences_file, 'r') as f:
                return json.load(f)
        return {
            "default_calendar": "Home",
            "preferred_deployment": "vercel",
            "auto_optimize": True,
            "learning_enabled": True
        }
    
    def save_learning_data(self):
        """Save all learning data"""
        with open(self.patterns_file, 'w') as f:
            json.dump(self.success_patterns, f, indent=2)
        
        with open(self.workflows_file, 'w') as f:
            json.dump(self.workflows, f, indent=2)
        
        with open(self.preferences_file, 'w') as f:
            json.dump(self.user_preferences, f, indent=2)
        
        # Also save to Supabase for persistence
        self.sync_to_supabase()
    
    def sync_to_supabase(self):
        """Sync learning data to Supabase for permanent storage"""
        try:
            # Create or update learning data table
            cmd = f"""
            PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
                CREATE TABLE IF NOT EXISTS assistant_learning (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(50),
                    data JSONB,
                    success_rate FLOAT,
                    last_used TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW()
                );
                
                INSERT INTO assistant_learning (type, data)
                VALUES 
                    ('patterns', '{json.dumps(self.success_patterns)}'::jsonb),
                    ('workflows', '{json.dumps(self.workflows)}'::jsonb),
                    ('preferences', '{json.dumps(self.user_preferences)}'::jsonb)
                ON CONFLICT (type) DO UPDATE
                SET data = EXCLUDED.data,
                    last_used = NOW();
            "
            """
            subprocess.run(cmd, shell=True, capture_output=True)
        except Exception as e:
            print(f"Warning: Could not sync to Supabase: {e}")
    
    def analyze_command(self, command: str) -> Dict[str, Any]:
        """Analyze command and determine best execution path"""
        command_lower = command.lower()
        
        # Check learned patterns for similar commands
        pattern_match = self.find_pattern_match(command)
        if pattern_match:
            print(f"🧠 Using learned pattern from previous success")
            return pattern_match
        
        # Categorize command
        analysis = {
            "command": command,
            "category": None,
            "subsystem": None,
            "confidence": 0.0,
            "requires_interaction": False,
            "estimated_steps": 1
        }
        
        # Calendar/scheduling tasks
        if any(word in command_lower for word in ['calendar', 'schedule', 'meeting', 'appointment']):
            analysis["category"] = "calendar"
            analysis["subsystem"] = "system_automation"
            analysis["confidence"] = 0.95
        
        # Todo/reminder tasks
        elif any(word in command_lower for word in ['todo', 'task', 'reminder', 'remind']):
            analysis["category"] = "reminder"
            analysis["subsystem"] = "system_automation"
            analysis["confidence"] = 0.95
        
        # Database optimization
        elif any(word in command_lower for word in ['optimize', 'database', 'supabase', 'vacuum']):
            analysis["category"] = "database"
            analysis["subsystem"] = "action_assistant"
            analysis["confidence"] = 0.90
        
        # Website/deployment tasks
        elif any(word in command_lower for word in ['website', 'deploy', 'create site', 'web app']):
            analysis["category"] = "deployment"
            analysis["subsystem"] = "autonomous_agent"
            analysis["confidence"] = 0.85
            analysis["requires_interaction"] = True
            analysis["estimated_steps"] = 5
        
        # Project creation
        elif any(word in command_lower for word in ['create', 'build', 'make', 'generate']) and \
             any(word in command_lower for word in ['project', 'app', 'script', 'program']):
            analysis["category"] = "project"
            analysis["subsystem"] = "autonomous_agent"
            analysis["confidence"] = 0.80
            analysis["estimated_steps"] = 3
        
        # App interaction
        elif any(word in command_lower for word in ['open', 'launch', 'start']) and \
             any(word in command_lower for word in ['app', 'application', 'program']):
            analysis["category"] = "app_control"
            analysis["subsystem"] = "system_automation"
            analysis["confidence"] = 0.85
        
        # General AI query
        else:
            analysis["category"] = "general"
            analysis["subsystem"] = "api_gateway"
            analysis["confidence"] = 0.60
        
        return analysis
    
    def find_pattern_match(self, command: str) -> Optional[Dict]:
        """Find matching pattern from learned successes"""
        command_hash = hashlib.md5(command.lower().encode()).hexdigest()
        
        if command_hash in self.success_patterns.get("command_patterns", {}):
            pattern = self.success_patterns["command_patterns"][command_hash]
            if pattern.get("success_rate", 0) > 0.8:
                return pattern
        
        # Fuzzy matching for similar commands
        for stored_hash, pattern in self.success_patterns.get("command_patterns", {}).items():
            if self.similarity_score(command, pattern.get("original_command", "")) > 0.85:
                return pattern
        
        return None
    
    def similarity_score(self, cmd1: str, cmd2: str) -> float:
        """Calculate similarity between two commands"""
        words1 = set(cmd1.lower().split())
        words2 = set(cmd2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union)
    
    def execute_command(self, command: str) -> Dict[str, Any]:
        """Main execution with intelligent routing and learning"""
        
        # Analyze the command
        analysis = self.analyze_command(command)
        
        print(f"\n🤖 Integrated Assistant Processing")
        print(f"📊 Analysis: {analysis['category']} ({analysis['confidence']*100:.0f}% confidence)")
        print(f"🎯 Routing to: {analysis['subsystem']}")
        
        result = {"success": False, "message": "No action taken"}
        
        try:
            # Route to appropriate subsystem
            if analysis["subsystem"] == "system_automation":
                # Use system automation for calendar, reminders, apps
                if self.system_automation:
                    result = self.system_automation.execute_command(command)
                else:
                    result = {"success": False, "message": "System automation module not available"}
                
            elif analysis["subsystem"] == "action_assistant":
                # Use action assistant for database operations
                if self.action_assistant:
                    request = {"action": command, "quick_response": True}
                    result = self.action_assistant.process_request(request)
                else:
                    result = {"success": False, "message": "Action assistant module not available"}
                
            elif analysis["subsystem"] == "autonomous_agent":
                # Use autonomous agent for complex workflows
                if self.autonomous_agent:
                    if analysis["category"] == "deployment":
                        result = self.autonomous_agent.execute_workflow("website_deployment", command)
                    else:
                        result = self.autonomous_agent.process_command(command)
                else:
                    result = {"success": False, "message": "Autonomous agent module not available"}
                
            elif analysis["subsystem"] == "api_gateway":
                # Use API gateway for general queries
                result = self.query_api_gateway(command)
                
            else:
                # Fallback to best guess
                result = self.fallback_execution(command)
            
            # Learn from the execution
            if self.user_preferences.get("learning_enabled", True):
                self.learn_from_execution(command, analysis, result)
            
        except Exception as e:
            result = {
                "success": False,
                "error": str(e),
                "message": f"Error during execution: {e}"
            }
        
        # Save task to history
        self.task_history.append({
            "timestamp": datetime.now().isoformat(),
            "command": command,
            "analysis": analysis,
            "result": result
        })
        
        # Persist learning data
        if len(self.task_history) % 5 == 0:  # Save every 5 commands
            self.save_learning_data()
        
        return result
    
    def query_api_gateway(self, query: str) -> Dict[str, Any]:
        """Query the Go API Gateway"""
        try:
            response = requests.post(
                f"{self.api_gateway_url}/chat/",
                json={"message": query},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message": data.get("data", {}).get("message", "No response"),
                    "response": data
                }
            else:
                return {
                    "success": False,
                    "message": f"API returned status {response.status_code}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"API Gateway error: {e}"
            }
    
    def fallback_execution(self, command: str) -> Dict[str, Any]:
        """Fallback execution using bash script"""
        try:
            result = subprocess.run(
                ["./ask.sh", command],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                "success": result.returncode == 0,
                "message": result.stdout,
                "error": result.stderr if result.returncode != 0 else None
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Fallback execution failed: {e}"
            }
    
    def learn_from_execution(self, command: str, analysis: Dict, result: Dict):
        """Learn from command execution"""
        command_hash = hashlib.md5(command.lower().encode()).hexdigest()
        
        # Update success patterns
        if command_hash not in self.success_patterns["command_patterns"]:
            self.success_patterns["command_patterns"][command_hash] = {
                "original_command": command,
                "analysis": analysis,
                "executions": 0,
                "successes": 0,
                "success_rate": 0.0
            }
        
        pattern = self.success_patterns["command_patterns"][command_hash]
        pattern["executions"] += 1
        
        if result.get("success", False):
            pattern["successes"] += 1
            pattern["last_success"] = datetime.now().isoformat()
        
        pattern["success_rate"] = pattern["successes"] / pattern["executions"]
        
        # Learn optimization hints
        if analysis["category"] not in self.success_patterns["optimization_hints"]:
            self.success_patterns["optimization_hints"][analysis["category"]] = []
        
        if result.get("success", False) and result.get("optimization_hint"):
            self.success_patterns["optimization_hints"][analysis["category"]].append(
                result["optimization_hint"]
            )
        
        print(f"📈 Learning: Updated pattern (success rate: {pattern['success_rate']*100:.0f}%)")
    
    def create_workflow(self, name: str, steps: List[str]) -> Dict[str, Any]:
        """Create a reusable workflow"""
        workflow = {
            "name": name,
            "steps": steps,
            "created": datetime.now().isoformat(),
            "usage_count": 0
        }
        
        self.workflows["saved_workflows"].append(workflow)
        self.save_learning_data()
        
        return {
            "success": True,
            "message": f"Workflow '{name}' created with {len(steps)} steps"
        }
    
    def execute_workflow(self, name: str) -> Dict[str, Any]:
        """Execute a saved workflow"""
        for workflow in self.workflows["saved_workflows"]:
            if workflow["name"] == name:
                results = []
                for step in workflow["steps"]:
                    print(f"🔄 Executing step: {step}")
                    result = self.execute_command(step)
                    results.append(result)
                    
                    if not result.get("success", False):
                        return {
                            "success": False,
                            "message": f"Workflow failed at step: {step}",
                            "results": results
                        }
                
                workflow["usage_count"] += 1
                self.save_learning_data()
                
                return {
                    "success": True,
                    "message": f"Workflow '{name}' completed successfully",
                    "results": results
                }
        
        return {
            "success": False,
            "message": f"Workflow '{name}' not found"
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get learning and usage statistics"""
        stats = {
            "total_commands": len(self.task_history),
            "learned_patterns": len(self.success_patterns.get("command_patterns", {})),
            "saved_workflows": len(self.workflows.get("saved_workflows", [])),
            "categories": {},
            "success_rate": 0.0
        }
        
        # Calculate category distribution
        for task in self.task_history:
            category = task.get("analysis", {}).get("category", "unknown")
            stats["categories"][category] = stats["categories"].get(category, 0) + 1
        
        # Calculate overall success rate
        total_success = sum(
            1 for task in self.task_history 
            if task.get("result", {}).get("success", False)
        )
        
        if self.task_history:
            stats["success_rate"] = total_success / len(self.task_history)
        
        # Top patterns
        stats["top_patterns"] = sorted(
            self.success_patterns.get("command_patterns", {}).items(),
            key=lambda x: x[1].get("success_rate", 0),
            reverse=True
        )[:5]
        
        return stats


def main():
    assistant = IntegratedAssistant()
    
    if len(sys.argv) > 1:
        # Command line mode
        command = ' '.join(sys.argv[1:])
        
        # Check for special commands
        if command.lower() == "stats":
            stats = assistant.get_statistics()
            print("\n📊 Assistant Statistics")
            print("=" * 40)
            print(json.dumps(stats, indent=2))
        
        elif command.lower().startswith("workflow create"):
            # Create workflow mode
            name = input("Workflow name: ")
            steps = []
            print("Enter workflow steps (empty line to finish):")
            while True:
                step = input(f"Step {len(steps)+1}: ")
                if not step:
                    break
                steps.append(step)
            
            result = assistant.create_workflow(name, steps)
            print(result["message"])
        
        elif command.lower().startswith("workflow run"):
            # Run workflow
            parts = command.split()
            if len(parts) > 2:
                workflow_name = ' '.join(parts[2:])
                result = assistant.execute_workflow(workflow_name)
                print(result["message"])
            else:
                print("Usage: workflow run <name>")
        
        else:
            # Regular command execution
            result = assistant.execute_command(command)
            
            if result["success"]:
                print(f"\n✅ {result.get('message', 'Success')}")
            else:
                print(f"\n❌ {result.get('message', 'Failed')}")
                if result.get("error"):
                    print(f"Error: {result['error']}")
    
    else:
        # Interactive mode
        print("🤖 Integrated Autonomous Assistant")
        print("=" * 40)
        print("I can:")
        print("  • Execute any system task")
        print("  • Create and deploy websites")
        print("  • Manage your calendar and reminders")
        print("  • Optimize databases")
        print("  • Learn from interactions")
        print("")
        print("Special commands:")
        print("  'stats' - Show learning statistics")
        print("  'workflow create' - Create a reusable workflow")
        print("  'workflow run <name>' - Run a saved workflow")
        print("  'exit' - Quit")
        print("")
        
        while True:
            command = input("\n🎯 What would you like me to do? ")
            
            if command.lower() in ['exit', 'quit']:
                # Save learning data before exit
                assistant.save_learning_data()
                print("\n📊 Final Statistics:")
                stats = assistant.get_statistics()
                print(f"  • Processed {stats['total_commands']} commands")
                print(f"  • Learned {stats['learned_patterns']} patterns")
                print(f"  • Success rate: {stats['success_rate']*100:.1f}%")
                print("\n👋 Goodbye! I'm getting smarter every day!")
                break
            
            elif command.lower() == "stats":
                stats = assistant.get_statistics()
                print("\n📊 Learning Statistics")
                print("=" * 40)
                print(f"Total Commands: {stats['total_commands']}")
                print(f"Learned Patterns: {stats['learned_patterns']}")
                print(f"Saved Workflows: {stats['saved_workflows']}")
                print(f"Success Rate: {stats['success_rate']*100:.1f}%")
                print("\nCategory Distribution:")
                for category, count in stats['categories'].items():
                    print(f"  • {category}: {count}")
            
            elif command.lower().startswith("workflow"):
                if "create" in command.lower():
                    name = input("Workflow name: ")
                    steps = []
                    print("Enter workflow steps (empty line to finish):")
                    while True:
                        step = input(f"Step {len(steps)+1}: ")
                        if not step:
                            break
                        steps.append(step)
                    
                    result = assistant.create_workflow(name, steps)
                    print(result["message"])
                
                elif "run" in command.lower():
                    parts = command.split()
                    if len(parts) > 2:
                        workflow_name = ' '.join(parts[2:])
                        result = assistant.execute_workflow(workflow_name)
                        print(result["message"])
                    else:
                        print("Usage: workflow run <name>")
            
            else:
                result = assistant.execute_command(command)
                
                if result["success"]:
                    print(f"\n✅ {result.get('message', 'Success')}")
                else:
                    print(f"\n❌ {result.get('message', 'Failed')}")
                    if result.get("error"):
                        print(f"Error: {result['error']}")


if __name__ == "__main__":
    main()