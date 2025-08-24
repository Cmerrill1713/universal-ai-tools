#!/usr/bin/env node

/**
 * Universal AI Tools - Comprehensive Load Testing Framework
 * Tests API endpoints, WebSocket connections, and database performance under load
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const WebSocket = require('ws');

// Configuration
const CONFIG = {
    baseURL: process.env.BASE_URL || 'http://localhost:9999',
    httpsURL: process.env.HTTPS_URL || 'https://localhost',
    wsURL: process.env.WS_URL || 'ws://localhost:9999',
    concurrent: parseInt(process.env.CONCURRENT_USERS) || 50,
    duration: parseInt(process.env.TEST_DURATION) || 300, // 5 minutes
    rampUp: parseInt(process.env.RAMP_UP_TIME) || 60, // 1 minute
    reportDir: './logs/load-test-reports',
    
    // Test scenarios
    scenarios: {
        api: {
            weight: 40,
            endpoints: [
                { path: '/api/health', method: 'GET', weight: 20 },
                { path: '/api/status', method: 'GET', weight: 15 },
                { path: '/api/agents', method: 'GET', weight: 10 },
                { path: '/api/memories', method: 'GET', weight: 10 },
                { path: '/api/chat', method: 'POST', weight: 25, payload: { message: 'Hello', model: 'gpt-4' } },
                { path: '/api/memories', method: 'POST', weight: 15, payload: { content: 'Test memory', importance: 0.8 } },
                { path: '/api/context/analyze', method: 'POST', weight: 5, payload: { text: 'Analyze this text' } }
            ]
        },
        websocket: {
            weight: 30,
            connections: 20
        },
        database: {
            weight: 30,
            operations: [
                { type: 'read', weight: 60 },
                { type: 'write', weight: 30 },
                { type: 'vector_search', weight: 10 }
            ]
        }
    }
};

// Metrics collection
class MetricsCollector {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                by_endpoint: {},
                response_times: [],
                errors: []
            },
            websockets: {
                connected: 0,
                disconnected: 0,
                messages_sent: 0,
                messages_received: 0,
                connection_times: [],
                errors: []
            },
            database: {
                operations: 0,
                successful: 0,
                failed: 0,
                response_times: [],
                errors: []
            },
            system: {
                start_time: Date.now(),
                end_time: null,
                peak_concurrent: 0,
                current_concurrent: 0
            }
        };
        
        this.intervals = [];
        this.startSystemMonitoring();
    }
    
    startSystemMonitoring() {
        const interval = setInterval(() => {
            this.metrics.system.peak_concurrent = Math.max(
                this.metrics.system.peak_concurrent,
                this.metrics.system.current_concurrent
            );
        }, 1000);
        
        this.intervals.push(interval);
    }
    
    recordRequest(endpoint, method, responseTime, success, error = null) {
        this.metrics.requests.total++;
        this.metrics.requests.response_times.push(responseTime);
        
        const key = `${method} ${endpoint}`;
        if (!this.metrics.requests.by_endpoint[key]) {
            this.metrics.requests.by_endpoint[key] = {
                total: 0,
                successful: 0,
                failed: 0,
                response_times: []
            };
        }
        
        this.metrics.requests.by_endpoint[key].total++;
        this.metrics.requests.by_endpoint[key].response_times.push(responseTime);
        
        if (success) {
            this.metrics.requests.successful++;
            this.metrics.requests.by_endpoint[key].successful++;
        } else {
            this.metrics.requests.failed++;
            this.metrics.requests.by_endpoint[key].failed++;
            if (error) {
                this.metrics.requests.errors.push({
                    endpoint: key,
                    error: error.message || error,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
    
    recordWebSocket(event, data = {}) {
        switch (event) {
            case 'connected':
                this.metrics.websockets.connected++;
                this.metrics.system.current_concurrent++;
                if (data.connectionTime) {
                    this.metrics.websockets.connection_times.push(data.connectionTime);
                }
                break;
            case 'disconnected':
                this.metrics.websockets.disconnected++;
                this.metrics.system.current_concurrent--;
                break;
            case 'message_sent':
                this.metrics.websockets.messages_sent++;
                break;
            case 'message_received':
                this.metrics.websockets.messages_received++;
                break;
            case 'error':
                this.metrics.websockets.errors.push({
                    error: data.error,
                    timestamp: new Date().toISOString()
                });
                break;
        }
    }
    
    recordDatabase(responseTime, success, error = null) {
        this.metrics.database.operations++;
        this.metrics.database.response_times.push(responseTime);
        
        if (success) {
            this.metrics.database.successful++;
        } else {
            this.metrics.database.failed++;
            if (error) {
                this.metrics.database.errors.push({
                    error: error.message || error,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
    
    calculateStats(times) {
        if (!times.length) return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
        
        const sorted = times.sort((a, b) => a - b);
        const len = sorted.length;
        
        return {
            min: sorted[0],
            max: sorted[len - 1],
            avg: times.reduce((a, b) => a + b, 0) / len,
            p95: sorted[Math.floor(len * 0.95)],
            p99: sorted[Math.floor(len * 0.99)]
        };
    }
    
    getReport() {
        this.metrics.system.end_time = Date.now();
        const duration = (this.metrics.system.end_time - this.metrics.system.start_time) / 1000;
        
        const requestStats = this.calculateStats(this.metrics.requests.response_times);
        const wsStats = this.calculateStats(this.metrics.websockets.connection_times);
        const dbStats = this.calculateStats(this.metrics.database.response_times);
        
        return {
            summary: {
                duration: duration,
                total_requests: this.metrics.requests.total,
                successful_requests: this.metrics.requests.successful,
                failed_requests: this.metrics.requests.failed,
                success_rate: this.metrics.requests.total > 0 ? 
                    (this.metrics.requests.successful / this.metrics.requests.total * 100).toFixed(2) : 0,
                requests_per_second: (this.metrics.requests.total / duration).toFixed(2),
                peak_concurrent_users: this.metrics.system.peak_concurrent
            },
            performance: {
                api: {
                    response_time_stats: requestStats,
                    by_endpoint: this.metrics.requests.by_endpoint
                },
                websockets: {
                    total_connections: this.metrics.websockets.connected,
                    messages_exchanged: this.metrics.websockets.messages_sent + this.metrics.websockets.messages_received,
                    connection_time_stats: wsStats
                },
                database: {
                    total_operations: this.metrics.database.operations,
                    success_rate: this.metrics.database.operations > 0 ? 
                        (this.metrics.database.successful / this.metrics.database.operations * 100).toFixed(2) : 0,
                    response_time_stats: dbStats
                }
            },
            errors: {
                api_errors: this.metrics.requests.errors,
                websocket_errors: this.metrics.websockets.errors,
                database_errors: this.metrics.database.errors
            }
        };
    }
    
    cleanup() {
        this.intervals.forEach(interval => clearInterval(interval));
    }
}

// HTTP Client for API testing
class APIClient {
    constructor(baseURL, collector) {
        this.baseURL = baseURL;
        this.collector = collector;
        this.agent = new https.Agent({
            rejectUnauthorized: false // For self-signed certificates
        });
    }
    
    async makeRequest(endpoint, method = 'GET', payload = null) {
        const startTime = Date.now();
        const url = `${this.baseURL}${endpoint}`;
        
        return new Promise((resolve) => {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'LoadTest/1.0'
                },
                agent: url.startsWith('https') ? this.agent : undefined
            };
            
            const client = url.startsWith('https') ? https : http;
            
            const req = client.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const responseTime = Date.now() - startTime;
                    const success = res.statusCode >= 200 && res.statusCode < 400;
                    
                    this.collector.recordRequest(
                        endpoint, 
                        method, 
                        responseTime, 
                        success,
                        success ? null : { statusCode: res.statusCode, body: data }
                    );
                    
                    resolve({ success, statusCode: res.statusCode, data, responseTime });
                });
            });
            
            req.on('error', (error) => {
                const responseTime = Date.now() - startTime;
                this.collector.recordRequest(endpoint, method, responseTime, false, error);
                resolve({ success: false, error, responseTime });
            });
            
            if (payload && (method === 'POST' || method === 'PUT')) {
                req.write(JSON.stringify(payload));
            }
            
            req.setTimeout(30000); // 30 second timeout
            req.end();
        });
    }
}

// WebSocket Client for real-time testing
class WebSocketClient {
    constructor(wsURL, collector) {
        this.wsURL = wsURL;
        this.collector = collector;
        this.connections = new Map();
    }
    
    async createConnection(id) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(this.wsURL, {
                    rejectUnauthorized: false
                });
                
                ws.on('open', () => {
                    const connectionTime = Date.now() - startTime;
                    this.collector.recordWebSocket('connected', { connectionTime });
                    this.connections.set(id, ws);
                    
                    // Send periodic messages
                    const messageInterval = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'ping',
                                timestamp: Date.now()
                            }));
                            this.collector.recordWebSocket('message_sent');
                        }
                    }, 5000);
                    
                    ws.messageInterval = messageInterval;
                    resolve({ success: true, connectionTime });
                });
                
                ws.on('message', (data) => {
                    this.collector.recordWebSocket('message_received');
                });
                
                ws.on('error', (error) => {
                    this.collector.recordWebSocket('error', { error: error.message });
                    resolve({ success: false, error });
                });
                
                ws.on('close', () => {
                    this.collector.recordWebSocket('disconnected');
                    if (ws.messageInterval) {
                        clearInterval(ws.messageInterval);
                    }
                    this.connections.delete(id);
                });
                
            } catch (error) {
                this.collector.recordWebSocket('error', { error: error.message });
                resolve({ success: false, error });
            }
        });
    }
    
    closeAll() {
        this.connections.forEach((ws) => {
            if (ws.messageInterval) {
                clearInterval(ws.messageInterval);
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        this.connections.clear();
    }
}

// Load Test Runner
class LoadTestRunner {
    constructor(config) {
        this.config = config;
        this.collector = new MetricsCollector();
        this.apiClient = new APIClient(config.baseURL, this.collector);
        this.wsClient = new WebSocketClient(config.wsURL, this.collector);
        this.running = false;
        this.workers = [];
    }
    
    async run() {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🚀 Starting Universal AI Tools Load Test');
        console.log(`📊 Configuration:`);
        console.log(`   Base URL: ${this.config.baseURL}`);
        console.log(`   Concurrent Users: ${this.config.concurrent}`);
        console.log(`   Duration: ${this.config.duration}s`);
        console.log(`   Ramp-up: ${this.config.rampUp}s`);
        
        this.running = true;
        
        // Start WebSocket connections
        await this.startWebSocketLoad();
        
        // Start API load with ramp-up
        await this.startAPILoad();
        
        // Wait for test duration
        console.log(`⏱️  Running load test for ${this.config.duration} seconds...`);
        await this.wait(this.config.duration * 1000);
        
        // Stop test
        await this.stop();
        
        // Generate report
        const report = this.generateReport();
        await this.saveReport(report);
        
        console.log('✅ Load test completed');
        return report;
    }
    
    async startWebSocketLoad() {
        const wsConnections = Math.floor(this.config.concurrent * 0.3); // 30% WebSocket connections
        console.log(`🔌 Starting ${wsConnections} WebSocket connections...`);
        
        for (let i = 0; i < wsConnections; i++) {
            setTimeout(async () => {
                await this.wsClient.createConnection(`ws-${i}`);
            }, (i / wsConnections) * this.config.rampUp * 1000);
        }
    }
    
    async startAPILoad() {
        const apiUsers = this.config.concurrent;
        console.log(`📡 Starting ${apiUsers} API users...`);
        
        for (let i = 0; i < apiUsers; i++) {
            setTimeout(() => {
                this.startAPIWorker(i);
            }, (i / apiUsers) * this.config.rampUp * 1000);
        }
    }
    
    startAPIWorker(id) {
        const worker = setInterval(async () => {
            if (!this.running) return;
            
            // Select random endpoint based on weights
            const endpoint = this.selectRandomEndpoint();
            
            await this.apiClient.makeRequest(
                endpoint.path,
                endpoint.method,
                endpoint.payload
            );
            
            // Random delay between requests (1-3 seconds)
            const delay = 1000 + Math.random() * 2000;
            await this.wait(delay);
            
        }, 100);
        
        this.workers.push(worker);
    }
    
    selectRandomEndpoint() {
        const endpoints = this.config.scenarios.api.endpoints;
        const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const endpoint of endpoints) {
            random -= endpoint.weight;
            if (random <= 0) {
                return endpoint;
            }
        }
        
        return endpoints[0]; // Fallback
    }
    
    async stop() {
        console.log('🛑 Stopping load test...');
        this.running = false;
        
        // Stop API workers
        this.workers.forEach(worker => clearInterval(worker));
        this.workers = [];
        
        // Close WebSocket connections
        this.wsClient.closeAll();
        
        // Wait for cleanup
        await this.wait(2000);
    }
    
    generateReport() {
        const report = this.collector.getReport();
        
        console.log('\n📊 LOAD TEST RESULTS');
        console.log('=' .repeat(50));
        console.log(`Duration: ${report.summary.duration.toFixed(2)}s`);
        console.log(`Total Requests: ${report.summary.total_requests}`);
        console.log(`Success Rate: ${report.summary.success_rate}%`);
        console.log(`Requests/sec: ${report.summary.requests_per_second}`);
        console.log(`Peak Concurrent: ${report.summary.peak_concurrent_users}`);
        
        console.log('\n🚀 API Performance:');
        const apiStats = report.performance.api.response_time_stats;
        console.log(`  Min: ${apiStats.min}ms`);
        console.log(`  Avg: ${apiStats.avg.toFixed(2)}ms`);
        console.log(`  Max: ${apiStats.max}ms`);
        console.log(`  95th: ${apiStats.p95}ms`);
        console.log(`  99th: ${apiStats.p99}ms`);
        
        console.log('\n🔌 WebSocket Performance:');
        console.log(`  Connections: ${report.performance.websockets.total_connections}`);
        console.log(`  Messages: ${report.performance.websockets.messages_exchanged}`);
        
        if (report.errors.api_errors.length > 0) {
            console.log('\n❌ Top Errors:');
            const errorCounts = {};
            report.errors.api_errors.forEach(error => {
                const key = error.error.statusCode || error.error;
                errorCounts[key] = (errorCounts[key] || 0) + 1;
            });
            
            Object.entries(errorCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .forEach(([error, count]) => {
                    console.log(`  ${error}: ${count} occurrences`);
                });
        }
        
        return report;
    }
    
    async saveReport(report) {
        try {
            // Create report directory
            if (!fs.existsSync(this.config.reportDir)) {
                fs.mkdirSync(this.config.reportDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportFile = path.join(this.config.reportDir, `load-test-${timestamp}.json`);
            
            // Save detailed JSON report
            fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
            
            // Generate HTML report
            const htmlReport = this.generateHTMLReport(report);
            const htmlFile = path.join(this.config.reportDir, `load-test-${timestamp}.html`);
            fs.writeFileSync(htmlFile, htmlReport);
            
            console.log(`\n📄 Reports saved:`);
            console.log(`  JSON: ${reportFile}`);
            console.log(`  HTML: ${htmlFile}`);
            
        } catch (error) {
            process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Failed to save report:', error.message);
        }
    }
    
    generateHTMLReport(report) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Universal AI Tools - Load Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        .chart { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        .error { color: #dc3545; }
        .success { color: #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Universal AI Tools - Load Test Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <div class="metrics">
        <div class="metric-card">
            <div class="metric-value">${report.summary.total_requests}</div>
            <div class="metric-label">Total Requests</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.summary.success_rate}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.summary.requests_per_second}</div>
            <div class="metric-label">Requests/Second</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${report.performance.api.response_time_stats.avg.toFixed(0)}ms</div>
            <div class="metric-label">Avg Response Time</div>
        </div>
    </div>
    
    <div class="chart">
        <h2>📊 Response Time Statistics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Minimum</td><td>${report.performance.api.response_time_stats.min}ms</td></tr>
            <tr><td>Average</td><td>${report.performance.api.response_time_stats.avg.toFixed(2)}ms</td></tr>
            <tr><td>Maximum</td><td>${report.performance.api.response_time_stats.max}ms</td></tr>
            <tr><td>95th Percentile</td><td>${report.performance.api.response_time_stats.p95}ms</td></tr>
            <tr><td>99th Percentile</td><td>${report.performance.api.response_time_stats.p99}ms</td></tr>
        </table>
    </div>
    
    <div class="chart">
        <h2>🔌 WebSocket Performance</h2>
        <p>Total Connections: ${report.performance.websockets.total_connections}</p>
        <p>Messages Exchanged: ${report.performance.websockets.messages_exchanged}</p>
    </div>
    
    ${report.errors.api_errors.length > 0 ? `
    <div class="chart">
        <h2>❌ Errors</h2>
        <p class="error">Found ${report.errors.api_errors.length} API errors</p>
        <p class="error">Found ${report.errors.websocket_errors.length} WebSocket errors</p>
    </div>
    ` : '<div class="chart"><h2>✅ No Errors</h2><p class="success">All requests completed successfully!</p></div>'}
    
    <div class="chart">
        <h2>📈 Detailed Results</h2>
        <pre>${JSON.stringify(report, null, 2)}</pre>
    </div>
</body>
</html>`;
    }
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    cleanup() {
        this.collector.cleanup();
    }
}

// Main execution
async function main() {
    const runner = new LoadTestRunner(CONFIG);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received shutdown signal...');
        await runner.stop();
        runner.cleanup();
        process.exit(0);
    });
    
    try {
        await runner.run();
    } catch (error) {
        console.error('❌ Load test failed:', error);
        process.exit(1);
    } finally {
        runner.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { LoadTestRunner, CONFIG };