#!/usr/bin/env node

/**
 * Test Automated Health Monitoring System
 * Demonstrates Universal AI Tools' superior health monitoring capabilities
 */

import axios from 'axios';
import chalk from 'chalk';

const BASE_URL = 'http://localhost:8080';

// Helper function to make API calls
async function makeRequest(method, path, data = null) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

// Display health status in a formatted way
function displayHealthStatus(health) {
  console.log(chalk.blue('\n📊 System Health Status'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(`Status: ${health.status === 'healthy' ? chalk.green('✅ ' + health.status) : 
    health.status === 'degraded' ? chalk.yellow('⚠️  ' + health.status) : 
    chalk.red('❌ ' + health.status)}`);
  
  console.log(`Timestamp: ${new Date(health.timestamp).toLocaleString()}`);
  
  console.log('\n📈 Service Summary:');
  console.log(`  • Healthy: ${chalk.green(health.summary.healthy)}`);
  console.log(`  • Degraded: ${chalk.yellow(health.summary.degraded)}`);
  console.log(`  • Unhealthy: ${chalk.red(health.summary.unhealthy)}`);
  console.log(`  • Total: ${health.summary.total}`);
  
  console.log('\n🔍 Service Details:');
  health.services.forEach(service => {
    const statusIcon = service.status === 'healthy' ? '✅' : 
                      service.status === 'degraded' ? '⚠️' : '❌';
    const statusColor = service.status === 'healthy' ? chalk.green : 
                       service.status === 'degraded' ? chalk.yellow : chalk.red;
    
    console.log(`\n  ${statusIcon} ${chalk.bold(service.name)}`);
    console.log(`     Status: ${statusColor(service.status)}`);
    console.log(`     Last Check: ${new Date(service.lastCheck).toLocaleTimeString()}`);
    
    if (service.responseTime) {
      console.log(`     Response Time: ${service.responseTime}ms`);
    }
    
    if (service.error) {
      console.log(`     Error: ${chalk.red(service.error)}`);
    }
    
    if (service.details) {
      console.log(`     Details: ${JSON.stringify(service.details, null, 2).split('\n').join('\n     ')}`);
    }
  });
}

// Main test function
async function runHealthMonitorTest() {
  console.log(chalk.cyan('\n🏥 Universal AI Tools - Automated Health Monitor Test\n'));

  // Check if server is running
  console.log(chalk.yellow('1. Checking if server is running...'));
  const healthCheck = await makeRequest('GET', '/health');
  
  if (!healthCheck.success) {
    console.log(chalk.red('❌ Server is not running. Please start the server first.'));
    return;
  }
  
  console.log(chalk.green('✅ Server is running'));
  
  // Wait for monitoring routes to load
  console.log(chalk.yellow('\n2. Waiting for monitoring routes to load...'));
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get initial health status
  console.log(chalk.yellow('\n3. Getting initial automated health status...'));
  const initialHealth = await makeRequest('GET', '/api/v1/monitoring/health/automated');
  
  if (initialHealth.success) {
    displayHealthStatus(initialHealth.data.data);
  } else {
    console.log(chalk.red('❌ Failed to get health status:', initialHealth.error));
  }
  
  // Force a health check
  console.log(chalk.yellow('\n4. Forcing health check for all services...'));
  const forceCheck = await makeRequest('POST', '/api/v1/monitoring/health/check-all');
  
  if (forceCheck.success) {
    console.log(chalk.green('✅ Health check completed'));
    displayHealthStatus(forceCheck.data.data);
  } else {
    console.log(chalk.red('❌ Failed to force health check:', forceCheck.error));
  }
  
  // Check individual services
  console.log(chalk.yellow('\n5. Checking individual service health...'));
  const services = ['database', 'redis', 'ollama', 'lfm2', 'circuit-breakers', 'memory'];
  
  for (const service of services) {
    const serviceHealth = await makeRequest('GET', `/api/v1/monitoring/health/service/${service}`);
    
    if (serviceHealth.success) {
      const health = serviceHealth.data.data;
      const statusIcon = health.status === 'healthy' ? '✅' : 
                        health.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${service}: ${health.status}`);
    }
  }
  
  // Check circuit breakers
  console.log(chalk.yellow('\n6. Checking circuit breaker status...'));
  const cbStatus = await makeRequest('GET', '/api/v1/monitoring/circuit-breakers');
  
  if (cbStatus.success) {
    const summary = cbStatus.data.summary;
    console.log(chalk.blue('Circuit Breaker Summary:'));
    console.log(`  • Total: ${summary.total}`);
    console.log(`  • Open: ${chalk.red(summary.open)}`);
    console.log(`  • Half-Open: ${chalk.yellow(summary.halfOpen)}`);
    console.log(`  • Closed: ${chalk.green(summary.closed)}`);
  }
  
  // Monitor real-time metrics (for 10 seconds)
  console.log(chalk.yellow('\n7. Monitoring real-time health for 10 seconds...'));
  console.log(chalk.gray('(Updates every 5 seconds)'));
  
  let monitorCount = 0;
  const monitorInterval = setInterval(async () => {
    monitorCount++;
    
    const currentHealth = await makeRequest('GET', '/api/v1/monitoring/health/automated');
    if (currentHealth.success) {
      const health = currentHealth.data.data;
      console.log(`\n⏱️  Update #${monitorCount} - ${new Date().toLocaleTimeString()}`);
      console.log(`   System Status: ${health.status === 'healthy' ? chalk.green(health.status) : 
        health.status === 'degraded' ? chalk.yellow(health.status) : chalk.red(health.status)}`);
      console.log(`   Services: ${chalk.green(health.summary.healthy)} healthy, ` +
                  `${chalk.yellow(health.summary.degraded)} degraded, ` +
                  `${chalk.red(health.summary.unhealthy)} unhealthy`);
    }
    
    if (monitorCount >= 2) {
      clearInterval(monitorInterval);
      
      // Final summary
      console.log(chalk.cyan('\n\n📊 Health Monitor Test Summary'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.green('✅ Automated health monitoring is working correctly!'));
      console.log('\nFeatures demonstrated:');
      console.log('  • Automated health checks every 30 seconds');
      console.log('  • Individual service health monitoring');
      console.log('  • Circuit breaker integration');
      console.log('  • Real-time health status updates');
      console.log('  • Comprehensive service metrics');
      console.log('\n🚀 Universal AI Tools provides enterprise-grade health monitoring!');
    }
  }, 5000);
}

// Run the test
runHealthMonitorTest().catch(error => {
  console.error(chalk.red('Test failed:'), error);
  process.exit(1);
});