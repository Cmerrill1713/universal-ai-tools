#!/usr/bin/env python3
"""
Endpoint checker script
Tests all API endpoints and generates a pass/fail table
"""

import asyncio
import sys
from typing import List, Dict, Any
from datetime import datetime
import httpx


class EndpointChecker:
    """Check API endpoints and report results"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: List[Dict[str, Any]] = []
    
    async def check_endpoint(
        self,
        method: str,
        path: str,
        expected_status: int = 200,
        data: Dict = None,
        description: str = ""
    ) -> Dict[str, Any]:
        """Check a single endpoint"""
        url = f"{self.base_url}{path}"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if method.upper() == "GET":
                    response = await client.get(url)
                elif method.upper() == "POST":
                    response = await client.post(url, json=data or {})
                elif method.upper() == "PUT":
                    response = await client.put(url, json=data or {})
                elif method.upper() == "DELETE":
                    response = await client.delete(url)
                else:
                    return {
                        "method": method,
                        "path": path,
                        "status": "FAIL",
                        "error": f"Unknown method: {method}",
                        "description": description
                    }
                
                passed = response.status_code == expected_status
                
                return {
                    "method": method.upper(),
                    "path": path,
                    "expected_status": expected_status,
                    "actual_status": response.status_code,
                    "status": "PASS" if passed else "FAIL",
                    "response_time_ms": int(response.elapsed.total_seconds() * 1000),
                    "description": description,
                    "error": None if passed else f"Expected {expected_status}, got {response.status_code}"
                }
        
        except httpx.ConnectError as e:
            return {
                "method": method.upper(),
                "path": path,
                "expected_status": expected_status,
                "actual_status": None,
                "status": "FAIL",
                "response_time_ms": None,
                "description": description,
                "error": f"Connection error: {str(e)}"
            }
        except Exception as e:
            return {
                "method": method.upper(),
                "path": path,
                "expected_status": expected_status,
                "actual_status": None,
                "status": "FAIL",
                "response_time_ms": None,
                "description": description,
                "error": str(e)
            }
    
    async def run_checks(self) -> List[Dict[str, Any]]:
        """Run all endpoint checks"""
        endpoints = [
            # Health checks
            ("GET", "/health", 200, None, "Health check endpoint"),
            ("GET", "/api/health", 200, None, "API health check endpoint"),
            
            # Root
            ("GET", "/", 200, None, "Root endpoint"),
            
            # Users router
            ("GET", "/api/users/", 200, None, "List all users"),
            ("GET", "/api/users/1", 200, None, "Get user by ID (existing)"),
            ("GET", "/api/users/999", 404, None, "Get user by ID (non-existent)"),
            ("POST", "/api/users/", 200, {"id": 3, "name": "Charlie", "email": "charlie@example.com"}, "Create new user"),
            
            # Tasks router
            ("GET", "/api/tasks/", 200, None, "List all tasks"),
            ("GET", "/api/tasks/1", 200, None, "Get task by ID (existing)"),
            ("GET", "/api/tasks/999", 404, None, "Get task by ID (non-existent)"),
            ("POST", "/api/tasks/", 200, {"id": 3, "title": "Test task", "description": "Test description"}, "Create new task"),
            ("PUT", "/api/tasks/1/complete", 200, None, "Complete task"),
        ]
        
        print(f"🚀 Starting endpoint checks against {self.base_url}")
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 100)
        
        tasks = []
        for method, path, expected_status, data, description in endpoints:
            tasks.append(
                self.check_endpoint(method, path, expected_status, data, description)
            )
        
        self.results = await asyncio.gather(*tasks)
        return self.results
    
    def print_table(self):
        """Print results as a formatted table"""
        print("\n" + "=" * 100)
        print("ENDPOINT TEST RESULTS")
        print("=" * 100)
        
        # Header
        print(f"{'STATUS':<8} {'METHOD':<8} {'PATH':<35} {'EXPECTED':<10} {'ACTUAL':<10} {'TIME (ms)':<12} {'DESCRIPTION':<30}")
        print("-" * 100)
        
        # Results
        pass_count = 0
        fail_count = 0
        
        for result in self.results:
            status = result["status"]
            if status == "PASS":
                pass_count += 1
                status_icon = "✅ PASS"
            else:
                fail_count += 1
                status_icon = "❌ FAIL"
            
            method = result["method"]
            path = result["path"][:33]
            expected = result["expected_status"]
            actual = result.get("actual_status", "N/A")
            time_ms = result.get("response_time_ms", "N/A")
            description = result["description"][:28]
            
            print(f"{status_icon:<8} {method:<8} {path:<35} {expected:<10} {actual:<10} {time_ms:<12} {description:<30}")
            
            # Print error if present
            if result.get("error"):
                print(f"         └─ Error: {result['error']}")
        
        print("=" * 100)
        print(f"\n📊 SUMMARY: {pass_count} passed, {fail_count} failed, {pass_count + fail_count} total")
        print(f"✨ Success rate: {pass_count / (pass_count + fail_count) * 100:.1f}%\n")
        
        return pass_count, fail_count
    
    def print_failures(self):
        """Print detailed failure information"""
        failures = [r for r in self.results if r["status"] == "FAIL"]
        
        if not failures:
            print("🎉 No failures detected!")
            return
        
        print("\n" + "=" * 100)
        print("FAILURE DETAILS")
        print("=" * 100)
        
        for i, failure in enumerate(failures, 1):
            print(f"\n{i}. {failure['method']} {failure['path']}")
            print(f"   Description: {failure['description']}")
            print(f"   Expected Status: {failure['expected_status']}")
            print(f"   Actual Status: {failure.get('actual_status', 'N/A')}")
            print(f"   Error: {failure['error']}")
            
            # Suggest module import to check
            if "Connection error" in str(failure['error']):
                print(f"   💡 Suggestion: Server may not be running. Check docker logs or start server.")
            elif failure.get('actual_status') == 404:
                print(f"   💡 Suggestion: Endpoint not found. Check router registration in api/app.py")
            elif failure.get('actual_status') == 500:
                print(f"   💡 Suggestion: Server error. Check module imports: python -c \"import api; print('ok')\"")


async def main():
    """Main entry point"""
    # Get base URL from command line or use default
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    
    checker = EndpointChecker(base_url)
    
    try:
        await checker.run_checks()
        pass_count, fail_count = checker.print_table()
        checker.print_failures()
        
        # Exit with appropriate code
        sys.exit(0 if fail_count == 0 else 1)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Checks interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

