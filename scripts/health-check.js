#!/usr/bin/env node
/**
 * Universal AI Tools - Production Health Check Script
 * Used by Docker health checks and monitoring systems
 */

const http = require('http');
const process = require('process');

const HEALTH_ENDPOINT = 'http://localhost:9999/health';
const TIMEOUT = 10000; // 10 seconds

function healthCheck() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.get(HEALTH_ENDPOINT, { timeout: TIMEOUT }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const healthData = JSON.parse(data);
          
          if (res.statusCode === 200 && healthData.status === 'ok') {
            console.log(`✅ Health check passed (${responseTime}ms)`);
            console.log(`   Services: ${JSON.stringify(healthData.services)}`);
            resolve({ healthy: true, responseTime, data: healthData });
          } else {
            console.error(`❌ Health check failed: HTTP ${res.statusCode}`);
            console.error(`   Response: ${data}`);
            reject(new Error(`Health check failed: HTTP ${res.statusCode}`));
          }
        } catch (error) {
          console.error(`❌ Health check failed: Invalid JSON response`);
          console.error(`   Response: ${data}`);
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.error(`❌ Health check timeout after ${TIMEOUT}ms`);
      reject(new Error(`Health check timeout after ${TIMEOUT}ms`));
    });
    
    req.on('error', (error) => {
      console.error(`❌ Health check error: ${error.message}`);
      reject(error);
    });
    
    req.end();
  });
}

// Run health check
if (require.main === module) {
  healthCheck()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Health check failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { healthCheck };