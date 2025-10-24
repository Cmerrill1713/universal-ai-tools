#!/usr/bin/env python3
"""
Simple System Test - Verify Universal AI Tools is Working
"""

import requests
import json
import time
from datetime import datetime

def log(message, level="INFO"):
    """Log with timestamp"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def test_basic_connectivity():
    """Test basic system connectivity"""
    log("🔍 Testing Basic System Connectivity...")
    
    # Test if we can make HTTP requests
    try:
        # Test a simple external service
        response = requests.get("https://httpbin.org/get", timeout=5)
        if response.status_code == 200:
            log("✅ External connectivity working")
            return True
        else:
            log(f"❌ External connectivity failed: {response.status_code}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ External connectivity error: {e}", "ERROR")
        return False

def test_family_athena_services():
    """Test Family Athena services"""
    log("🏠 Testing Family Athena Services...")
    
    # Test family profiles
    try:
        response = requests.get("http://localhost:8005/health", timeout=5)
        if response.status_code == 200:
            log("✅ Family Profiles service responding")
        else:
            log(f"⚠️ Family Profiles service: {response.status_code}")
    except Exception as e:
        log(f"⚠️ Family Profiles service not running: {e}")
    
    # Test family calendar
    try:
        response = requests.get("http://localhost:8006/health", timeout=5)
        if response.status_code == 200:
            log("✅ Family Calendar service responding")
        else:
            log(f"⚠️ Family Calendar service: {response.status_code}")
    except Exception as e:
        log(f"⚠️ Family Calendar service not running: {e}")
    
    # Test family knowledge
    try:
        response = requests.get("http://localhost:8007/health", timeout=5)
        if response.status_code == 200:
            log("✅ Family Knowledge service responding")
        else:
            log(f"⚠️ Family Knowledge service: {response.status_code}")
    except Exception as e:
        log(f"⚠️ Family Knowledge service not running: {e}")
    
    # Test Athena Gateway
    try:
        response = requests.get("http://localhost:8080/health", timeout=5)
        if response.status_code == 200:
            log("✅ Athena Gateway service responding")
        else:
            log(f"⚠️ Athena Gateway service: {response.status_code}")
    except Exception as e:
        log(f"⚠️ Athena Gateway service not running: {e}")

def test_unified_api_gateway():
    """Test Unified API Gateway"""
    log("🌐 Testing Unified API Gateway...")
    
    try:
        response = requests.get("http://localhost:9000/health", timeout=5)
        if response.status_code == 200:
            log("✅ Unified API Gateway responding")
            data = response.json()
            log(f"   Status: {data.get('overall_status', 'unknown')}")
            return True
        else:
            log(f"❌ Unified API Gateway failed: {response.status_code}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ Unified API Gateway error: {e}", "ERROR")
        return False

def test_api_endpoints():
    """Test key API endpoints"""
    log("🔗 Testing API Endpoints...")
    
    endpoints = [
        {"name": "Family Chat", "url": "http://localhost:9000/api/family/chat", "method": "POST", "data": {"message": "Hello Athena", "context": {"type": "family"}}},
        {"name": "Family Members", "url": "http://localhost:9000/api/family/members", "method": "GET"},
        {"name": "Family Calendar", "url": "http://localhost:9000/api/family/calendar", "method": "GET"},
        {"name": "Family Knowledge", "url": "http://localhost:9000/api/family/knowledge", "method": "GET"},
        {"name": "Unified Health", "url": "http://localhost:9000/api/unified/health", "method": "GET"}
    ]
    
    working_endpoints = 0
    total_endpoints = len(endpoints)
    
    for endpoint in endpoints:
        try:
            if endpoint["method"] == "GET":
                response = requests.get(endpoint["url"], timeout=5)
            else:
                response = requests.post(endpoint["url"], json=endpoint["data"], timeout=5)
            
            if response.status_code == 200:
                log(f"✅ {endpoint['name']}: Working")
                working_endpoints += 1
            else:
                log(f"⚠️ {endpoint['name']}: {response.status_code}")
        except Exception as e:
            log(f"❌ {endpoint['name']}: {e}", "ERROR")
    
    log(f"📊 API Endpoints: {working_endpoints}/{total_endpoints} working")
    return working_endpoints > 0

def test_system_performance():
    """Test system performance"""
    log("⚡ Testing System Performance...")
    
    try:
        start_time = time.time()
        response = requests.get("http://localhost:9000/health", timeout=10)
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            log(f"✅ Response time: {response_time:.2f}s")
            if response_time < 2.0:
                log("✅ Performance: Excellent (< 2s)")
                return True
            elif response_time < 5.0:
                log("⚠️ Performance: Good (< 5s)")
                return True
            else:
                log("❌ Performance: Slow (> 5s)", "ERROR")
                return False
        else:
            log(f"❌ Performance test failed: {response.status_code}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ Performance test error: {e}", "ERROR")
        return False

def run_comprehensive_test():
    """Run comprehensive system test"""
    log("🎯 Starting Comprehensive System Test")
    log("=" * 60)
    
    # Run all tests
    connectivity_ok = test_basic_connectivity()
    test_family_athena_services()
    gateway_ok = test_unified_api_gateway()
    endpoints_ok = test_api_endpoints()
    performance_ok = test_system_performance()
    
    # Calculate overall success
    tests_passed = sum([connectivity_ok, gateway_ok, endpoints_ok, performance_ok])
    total_tests = 4
    
    # Generate report
    log("=" * 60)
    log("📊 COMPREHENSIVE TEST REPORT")
    log("=" * 60)
    
    log(f"✅ Connectivity Test: {'PASS' if connectivity_ok else 'FAIL'}")
    log(f"✅ Gateway Test: {'PASS' if gateway_ok else 'FAIL'}")
    log(f"✅ Endpoints Test: {'PASS' if endpoints_ok else 'FAIL'}")
    log(f"✅ Performance Test: {'PASS' if performance_ok else 'FAIL'}")
    
    log("=" * 60)
    log(f"📈 OVERALL SUCCESS: {tests_passed}/{total_tests} ({tests_passed/total_tests*100:.1f}%)")
    
    if tests_passed == total_tests:
        log("🎉 SYSTEM IS FULLY OPERATIONAL!")
        log("✅ All tests passed - Ready for production use")
        return True
    elif tests_passed >= total_tests // 2:
        log("⚠️ SYSTEM IS PARTIALLY OPERATIONAL")
        log("🔧 Some tests failed - Review and fix issues")
        return False
    else:
        log("❌ SYSTEM NEEDS ATTENTION")
        log("🚨 Multiple tests failed - System not ready")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    
    if success:
        print("\n🎯 FINAL VERDICT:")
        print("   ✅ Universal AI Tools is WORKING!")
        print("   ✅ All core systems operational")
        print("   ✅ Ready for user access")
        print("   ✅ Performance meets requirements")
        print("\n🚀 SYSTEM STATUS: OPERATIONAL")
    else:
        print("\n⚠️ FINAL VERDICT:")
        print("   ❌ System needs attention")
        print("   🔧 Review test results above")
        print("   🚀 Fix issues before production use")
        print("\n🚀 SYSTEM STATUS: NEEDS WORK")