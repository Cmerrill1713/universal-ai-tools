# Universal AI Tools Load Test Report

**Generated**: 2025-07-20T03:48:15.164Z  
**Duration**: 19.46 seconds  
**Server**: http://localhost:3001

## Executive Summary


🎯 LOAD TEST SUMMARY:
   📊 Total Requests: 6750
   ✅ Success Rate: 100.00%
   ⚡ Avg Response Time: 90.91ms
   🔴 Redis Status: ✅ Redis performing well under load
   📈 Server Status: Stable under load


## Detailed Results

### Health Performance
- **Total Requests**: 1000
- **Success Rate**: 100.00%
- **Requests/sec**: 679.35
- **Avg Response Time**: 32.39ms
- **P95 Response Time**: 45.00ms
- **Concurrent Users**: 50

### Api Performance
#### API Documentation
- **Requests**: 500 (100.00% success)
- **Response Time**: 19.72ms avg, 24.00ms p95
- **Throughput**: 558.66 req/sec
#### Stats Endpoint
- **Requests**: 600 (100.00% success)
- **Response Time**: 22.14ms avg, 27.00ms p95
- **Throughput**: 588.81 req/sec
#### Performance Metrics
- **Requests**: 400 (100.00% success)
- **Response Time**: 16.98ms avg, 21.00ms p95
- **Throughput**: 518.81 req/sec

### Memory Performance
- **Total Requests**: 800
- **Success Rate**: 100.00%
- **Requests/sec**: 251.26
- **Avg Response Time**: 76.87ms
- **P95 Response Time**: 121.00ms
- **Concurrent Users**: 40

### Tools Performance
- **Total Requests**: 700
- **Success Rate**: 100.00%
- **Requests/sec**: 136.00
- **Avg Response Time**: 130.80ms
- **P95 Response Time**: 221.00ms
- **Concurrent Users**: 35

### Graphql Performance
- **Total Requests**: 500
- **Success Rate**: 100.00%
- **Requests/sec**: 129.23
- **Avg Response Time**: 98.93ms
- **P95 Response Time**: 168.00ms
- **Concurrent Users**: 25

### Concurrent Performance
#### health
- **Requests**: 1000 (100.00% success)
- **Response Time**: 94.06ms avg, 269.00ms p95
- **Throughput**: 342.00 req/sec
#### stats
- **Requests**: 750 (100.00% success)
- **Response Time**: 207.11ms avg, 285.00ms p95
- **Throughput**: 267.57 req/sec
#### memory
- **Requests**: 500 (100.00% success)
- **Response Time**: 210.12ms avg, 292.00ms p95
- **Throughput**: 175.01 req/sec

### Redis Performance
- **Connection**: healthy
- **Status**: ✅ Redis performing well under load
- **Write Operations**: 1000 operations completed
- **Read Operations**: 1000 operations completed


## Recommendations

- ✅ All tests performed well - system is ready for production load

## System Information

- **Node.js**: v22.16.0
- **Platform**: darwin (arm64)
- **Memory Usage**: 7.88MB heap

---

**Test Completed**: 2025-07-20T03:48:15.164Z  
**Status**: ✅ All Tests Passed
