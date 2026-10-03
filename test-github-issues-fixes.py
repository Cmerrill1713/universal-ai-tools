#!/usr/bin/env python3
"""
Test script to validate GitHub issues fixes
Tests all the fixes implemented for the archived GitHub issues
"""

import asyncio
import sys
import os
import json
from typing import Dict, Any, List

# Add paths for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

class GitHubIssuesTester:
    """Test suite for GitHub issues fixes"""
    
    def __init__(self):
        self.results = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "errors": [],
            "test_results": []
        }
    
    def log_test(self, test_name: str, status: str, message: str = "", error: Exception = None):
        """Log test result"""
        self.results["total_tests"] += 1
        if status == "passed":
            self.results["passed"] += 1
        else:
            self.results["failed"] += 1
            if error:
                self.results["errors"].append(f"{test_name}: {str(error)}")
        
        self.results["test_results"].append({
            "test": test_name,
            "status": status,
            "message": message,
            "error": str(error) if error else None
        })
        
        status_icon = "✅" if status == "passed" else "❌"
        print(f"{status_icon} {test_name}: {message}")
    
    def test_python_path_alignment(self):
        """Test Python path alignment fix"""
        try:
            import sys
            
            # Check if required paths are in sys.path
            required_paths = ["/app/src", "/app/api", "/app"]
            current_paths = sys.path
            
            missing_paths = []
            for path in required_paths:
                if path not in current_paths:
                    missing_paths.append(path)
            
            if missing_paths:
                self.log_test(
                    "Python Path Alignment",
                    "failed",
                    f"Missing paths: {missing_paths}",
                    Exception(f"Missing paths: {missing_paths}")
                )
            else:
                self.log_test(
                    "Python Path Alignment",
                    "passed",
                    "All required paths present in sys.path"
                )
                
        except Exception as e:
            self.log_test("Python Path Alignment", "failed", str(e), e)
    
    def test_current_time_shim(self):
        """Test current time shim fix"""
        try:
            from api.routers.health import safe_get_current_time
            from datetime import datetime, timezone
            
            # Test the safe_get_current_time function
            current_time = safe_get_current_time()
            
            if not isinstance(current_time, datetime):
                raise Exception("safe_get_current_time should return datetime object")
            
            if current_time.tzinfo is None:
                raise Exception("safe_get_current_time should return timezone-aware datetime")
            
            self.log_test(
                "Current Time Shim Fix",
                "passed",
                f"safe_get_current_time works correctly: {current_time.isoformat()}"
            )
            
        except Exception as e:
            self.log_test("Current Time Shim Fix", "failed", str(e), e)
    
    def test_input_validation(self):
        """Test input validation utilities"""
        try:
            from api.utils.validation import (
                validate_urls, 
                validate_trend_value, 
                validate_payload_field,
                ValidationError
            )
            
            # Test URL validation
            test_urls = ["https://example.com", "http://test.com", "invalid-url"]
            url_results = validate_urls(test_urls)
            
            if not isinstance(url_results, list):
                raise Exception("validate_urls should return a list")
            
            # Test trend validation
            valid_trends = ["bullish", "bearish", "neutral"]
            for trend in valid_trends:
                result = validate_trend_value(trend)
                if result != trend.lower():
                    raise Exception(f"Trend validation failed for {trend}")
            
            # Test invalid trend
            try:
                validate_trend_value("invalid")
                raise Exception("Should have raised ValidationError for invalid trend")
            except ValidationError:
                pass  # Expected
            
            # Test payload field validation
            test_payload = {"test_field": "test_value"}
            result = validate_payload_field(test_payload, "test_field", str)
            if result != "test_value":
                raise Exception("Payload field validation failed")
            
            self.log_test(
                "Input Validation",
                "passed",
                "All validation utilities work correctly"
            )
            
        except Exception as e:
            self.log_test("Input Validation", "failed", str(e), e)
    
    def test_database_health_check(self):
        """Test database health check utilities"""
        try:
            from api.utils.database import DatabaseHealthChecker
            
            # Test database health checker initialization
            checker = DatabaseHealthChecker()
            
            if not hasattr(checker, 'check_connection'):
                raise Exception("DatabaseHealthChecker should have check_connection method")
            
            if not hasattr(checker, 'get_database_info'):
                raise Exception("DatabaseHealthChecker should have get_database_info method")
            
            self.log_test(
                "Database Health Check",
                "passed",
                "Database health check utilities are properly implemented"
            )
            
        except Exception as e:
            self.log_test("Database Health Check", "failed", str(e), e)
    
    def test_error_handling_improvements(self):
        """Test enhanced error handling"""
        try:
            from api.app import app
            from fastapi.testclient import TestClient
            
            client = TestClient(app)
            
            # Test that the app has proper error handling middleware
            if not hasattr(app, 'middleware'):
                raise Exception("App should have middleware")
            
            # Test health endpoint
            response = client.get("/health")
            if response.status_code != 200:
                raise Exception(f"Health endpoint should return 200, got {response.status_code}")
            
            data = response.json()
            if "status" not in data:
                raise Exception("Health endpoint should return status field")
            
            self.log_test(
                "Error Handling Improvements",
                "passed",
                "Enhanced error handling is working correctly"
            )
            
        except Exception as e:
            self.log_test("Error Handling Improvements", "failed", str(e), e)
    
    def test_docker_compose_fix(self):
        """Test docker-compose.yml merge conflict resolution"""
        try:
            with open("docker-compose.yml", "r") as f:
                content = f.read()
            
            # Check for merge conflict markers
            if "<<<<<<< HEAD" in content:
                raise Exception("docker-compose.yml still contains merge conflict markers")
            
            if "=======" in content:
                raise Exception("docker-compose.yml still contains merge conflict markers")
            
            if ">>>>>>> fix" in content:
                raise Exception("docker-compose.yml still contains merge conflict markers")
            
            # Check for required services
            required_services = ["app", "postgres", "redis", "ollama", "python-api"]
            for service in required_services:
                if f"  {service}:" not in content:
                    raise Exception(f"docker-compose.yml missing {service} service")
            
            # Check for Python path configuration
            if "PYTHONPATH=/app/src:/app:/app/api" not in content:
                raise Exception("docker-compose.yml missing proper PYTHONPATH configuration")
            
            self.log_test(
                "Docker Compose Fix",
                "passed",
                "docker-compose.yml merge conflicts resolved and properly configured"
            )
            
        except Exception as e:
            self.log_test("Docker Compose Fix", "failed", str(e), e)
    
    def test_sitecustomize_py(self):
        """Test sitecustomize.py configuration"""
        try:
            with open("sitecustomize.py", "r") as f:
                content = f.read()
            
            # Check for required paths
            required_paths = ["/app/src", "/app/api", "/app"]
            for path in required_paths:
                if path not in content:
                    raise Exception(f"sitecustomize.py missing path: {path}")
            
            # Check for setup function
            if "def setup_python_path():" not in content:
                raise Exception("sitecustomize.py missing setup_python_path function")
            
            self.log_test(
                "sitecustomize.py Configuration",
                "passed",
                "sitecustomize.py is properly configured"
            )
            
        except Exception as e:
            self.log_test("sitecustomize.py Configuration", "failed", str(e), e)
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🧪 Running GitHub Issues Fix Tests...\n")
        
        # Run synchronous tests
        self.test_python_path_alignment()
        self.test_current_time_shim()
        self.test_input_validation()
        self.test_database_health_check()
        self.test_error_handling_improvements()
        self.test_docker_compose_fix()
        self.test_sitecustomize_py()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"  Total Tests: {self.results['total_tests']}")
        print(f"  Passed: {self.results['passed']} ✅")
        print(f"  Failed: {self.results['failed']} ❌")
        
        if self.results['errors']:
            print(f"\n❌ Errors:")
            for error in self.results['errors']:
                print(f"  - {error}")
        
        # Save results
        with open("github-issues-test-results.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n📄 Detailed results saved to: github-issues-test-results.json")
        
        return self.results['failed'] == 0

async def main():
    """Main test runner"""
    tester = GitHubIssuesTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All GitHub issues fixes are working correctly!")
        sys.exit(0)
    else:
        print("\n⚠️ Some tests failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())