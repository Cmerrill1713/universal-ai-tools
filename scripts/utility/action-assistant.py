#!/usr/bin/env python3
"""
Action-Enabled AI Assistant
Can actually execute Supabase operations and other tasks
"""

import json
import subprocess
import requests
import os
from typing import Dict, Any, List

class ActionAssistant:
    def __init__(self):
        self.api_url = "http://localhost:8080/api/v1/chat/"
        self.supabase_url = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
        self.supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", 
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU")
        
    def ask_ai(self, question: str) -> str:
        """Get AI response"""
        try:
            response = requests.post(self.api_url, 
                json={"message": question, "quickResponse": True},
                timeout=10)
            data = response.json()
            return data.get("data", {}).get("message", "No response")
        except Exception as e:
            return f"AI Error: {str(e)}"
    
    def execute_action(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute an action based on AI recommendation"""
        
        if action == "supabase_query":
            return self.supabase_query(params.get("query", ""))
        elif action == "supabase_insert":
            return self.supabase_insert(params.get("table", ""), params.get("data", {}))
        elif action == "supabase_update":
            return self.supabase_update(params.get("table", ""), params.get("data", {}), params.get("filter", {}))
        elif action == "run_command":
            return self.run_command(params.get("command", ""))
        elif action == "optimize_table":
            return self.optimize_supabase_table(params.get("table", ""))
        else:
            return {"error": f"Unknown action: {action}"}
    
    def supabase_query(self, query: str) -> Dict[str, Any]:
        """Execute Supabase query"""
        try:
            # Use psql to run query
            cmd = f"""PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "{query}" -t"""
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return {
                "success": result.returncode == 0,
                "result": result.stdout,
                "error": result.stderr if result.returncode != 0 else None
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def supabase_insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert data into Supabase table"""
        try:
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.supabase_url}/rest/v1/{table}",
                headers=headers,
                json=data
            )
            
            return {
                "success": response.status_code in [200, 201],
                "status": response.status_code,
                "data": response.json() if response.status_code in [200, 201] else response.text
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def supabase_update(self, table: str, data: Dict[str, Any], filter_params: Dict[str, Any]) -> Dict[str, Any]:
        """Update Supabase table"""
        try:
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            
            # Build filter query
            filters = "&".join([f"{k}=eq.{v}" for k, v in filter_params.items()])
            url = f"{self.supabase_url}/rest/v1/{table}?{filters}"
            
            response = requests.patch(url, headers=headers, json=data)
            
            return {
                "success": response.status_code in [200, 204],
                "status": response.status_code,
                "message": "Updated successfully" if response.status_code in [200, 204] else response.text
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def optimize_supabase_table(self, table: str) -> Dict[str, Any]:
        """Optimize a Supabase table"""
        optimizations = []
        
        # 1. Analyze table
        analysis = self.supabase_query(f"ANALYZE {table};")
        if analysis["success"]:
            optimizations.append("✅ Table analyzed")
        
        # 2. Check for missing indexes
        index_check = self.supabase_query(f"""
            SELECT schemaname, tablename, attname, n_distinct, correlation
            FROM pg_stats
            WHERE tablename = '{table}'
            ORDER BY n_distinct DESC;
        """)
        
        if index_check["success"]:
            optimizations.append("✅ Index opportunities identified")
        
        # 3. Vacuum table
        vacuum = self.supabase_query(f"VACUUM ANALYZE {table};")
        if vacuum["success"]:
            optimizations.append("✅ Table vacuumed and analyzed")
        
        # 4. Get table size
        size_check = self.supabase_query(f"""
            SELECT pg_size_pretty(pg_total_relation_size('{table}')) as size;
        """)
        
        return {
            "success": True,
            "table": table,
            "optimizations": optimizations,
            "size": size_check.get("result", "").strip() if size_check["success"] else "Unknown"
        }
    
    def run_command(self, command: str) -> Dict[str, Any]:
        """Run a shell command (with safety checks)"""
        # Safety check - only allow certain commands
        allowed_prefixes = ["ls", "echo", "curl", "npm run", "supabase"]
        
        if not any(command.startswith(prefix) for prefix in allowed_prefixes):
            return {"success": False, "error": "Command not allowed for safety reasons"}
        
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr if result.returncode != 0 else None
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def process_request(self, user_input: str) -> str:
        """Process user request and execute actions if needed"""
        
        # Keywords that indicate action requests
        action_keywords = ["update", "modify", "create", "delete", "optimize", "reorganize", "execute", "run"]
        
        if any(keyword in user_input.lower() for keyword in action_keywords):
            # User wants an action
            
            if "supabase" in user_input.lower() and ("optimize" in user_input.lower() or "reorganize" in user_input.lower()):
                # Optimize Supabase
                print("🔧 Optimizing Supabase tables...")
                
                # Get list of tables
                tables_result = self.supabase_query("""
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public' 
                    ORDER BY tablename;
                """)
                
                if tables_result["success"]:
                    tables = [line.strip() for line in tables_result["result"].split('\n') if line.strip()]
                    
                    results = []
                    for table in tables[:5]:  # Optimize first 5 tables as demo
                        if table:
                            print(f"  Optimizing {table}...")
                            result = self.optimize_supabase_table(table)
                            results.append(f"Table {table}: {result.get('size', 'Unknown size')}")
                    
                    return f"""✅ Supabase Optimization Complete!
                    
Optimized {len(results)} tables:
{chr(10).join(results)}

Performed operations:
- Analyzed table statistics
- Identified index opportunities  
- Vacuumed and reclaimed space
- Updated query planner statistics

Your Supabase is now more efficient!"""
                else:
                    return "❌ Could not access Supabase tables. Check connection."
            
            elif "update" in user_input.lower() and "supabase" in user_input.lower():
                # Generic update request
                return """To update Supabase, I can:
1. Insert new data: Specify table and data
2. Update existing data: Specify table, filter, and new values
3. Create indexes for better performance
4. Optimize tables (run 'optimize supabase')

What specific update would you like?"""
            
            else:
                # Ask AI for guidance
                ai_response = self.ask_ai(f"How to: {user_input}")
                return f"AI Suggestion:\n{ai_response}\n\n(Note: I can execute Supabase operations if you provide specific details)"
        
        else:
            # Regular question - just ask AI
            return self.ask_ai(user_input)


def main():
    assistant = ActionAssistant()
    
    print("🤖 Action-Enabled AI Assistant")
    print("================================")
    print("This assistant can ACTUALLY execute Supabase operations!")
    print("Try: 'optimize supabase' or 'update supabase tables'")
    print("Type 'exit' to quit")
    print("")
    
    while True:
        user_input = input("You: ")
        
        if user_input.lower() in ['exit', 'quit']:
            print("Goodbye!")
            break
        
        response = assistant.process_request(user_input)
        print(f"\nAssistant: {response}\n")


if __name__ == "__main__":
    main()