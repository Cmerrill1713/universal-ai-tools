#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import PerformanceMiddleware from '../src/middleware/performance';
import { logger } from '../src/utils/logger';
import { config } from '../src/config';
import { writeFileSync } from 'fs';
import path from 'path';

// Initialize configuration
import { initializeConfig } from '../src/config';
initializeConfig();

async function generateReport() {
  try {
    console.log('📊 Generating Performance Report for Universal AI Tools...\n');

    // Create Supabase client
    const supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceKey || ''
    );

    // Initialize performance middleware
    const performanceMiddleware = new PerformanceMiddleware(supabase, {
      enableRequestTiming: true,
      enableMemoryMonitoring: true,
      enableCacheMetrics: true,
      enableDatabaseOptimization: true,
    });

    // Wait a moment for metrics to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate comprehensive report
    const report = await performanceMiddleware.generatePerformanceReport();

    // Display report
    console.log(report);

    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(process.cwd(), 'logs', `performance-report-${timestamp}.txt`);

    try {
      writeFileSync(reportPath, report);
      console.log(`\n📄 Report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('Could not save report to file:', error);
    }

    // Get detailed metrics
    const metrics = await performanceMiddleware.getMetrics();

    // Generate optimization recommendations
    console.log('\n🔧 Optimization Recommendations:');
    console.log('='.repeat(50));

    const recommendations = [];

    // Memory optimization
    if (metrics.performance.averageMemoryUsage > 800) {
      recommendations.push({
        category: 'Memory',
        priority: 'High',
        issue: `High memory usage: ${metrics.performance.averageMemoryUsage.toFixed(2)}MB`,
        solution:
          'Consider implementing memory pooling, reducing model cache size, or increasing heap size',
      });
    }

    // Response time optimization
    if (metrics.performance.averageResponseTime > 1000) {
      recommendations.push({
        category: 'Response Time',
        priority: 'High',
        issue: `Slow response times: ${metrics.performance.averageResponseTime.toFixed(2)}ms`,
        solution: 'Optimize database queries, implement request caching, or scale horizontally',
      });
    }

    // Cache optimization
    if (metrics.cache.hitRate < 70) {
      recommendations.push({
        category: 'Caching',
        priority: 'Medium',
        issue: `Low cache hit rate: ${metrics.cache.hitRate.toFixed(2)}%`,
        solution: 'Review caching strategy, increase cache TTL, or implement cache warming',
      });
    }

    // Database optimization
    if (metrics.database.avgResponseTime > 500) {
      recommendations.push({
        category: 'Database',
        priority: 'Medium',
        issue: `Slow database queries: ${metrics.database.avgResponseTime.toFixed(2)}ms`,
        solution: 'Add database indexes, optimize queries, or implement query result caching',
      });
    }

    // Error rate optimization
    if (metrics.performance.errorRate > 5) {
      recommendations.push({
        category: 'Error Handling',
        priority: 'High',
        issue: `High error rate: ${metrics.performance.errorRate.toFixed(2)}%`,
        solution:
          'Implement better error handling, add request validation, or fix failing endpoints',
      });
    }

    // Bundle size optimization
    recommendations.push({
      category: 'Bundle Size',
      priority: 'Low',
      issue: 'Bundle size could be optimized',
      solution: 'Run `npm run build:analyze` to analyze bundle size and implement code splitting',
    });

    if (recommendations.length === 0) {
      console.log('✅ No optimization recommendations - system is performing well!');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.category}`);
        console.log(`   Issue: ${rec.issue}`);
        console.log(`   Solution: ${rec.solution}\n`);
      });
    }

    // Bundle analysis recommendation
    console.log('\n🔍 Bundle Analysis:');
    console.log('='.repeat(20));
    console.log('Run the following commands to analyze and optimize your bundle:');
    console.log('• npm run build:analyze  - Analyze bundle size and composition');
    console.log('• npm run build         - Build optimized production bundle');
    console.log('• npm run perf:monitor  - Start continuous performance monitoring');

    // Performance testing recommendations
    console.log('\n🧪 Performance Testing:');
    console.log('='.repeat(25));
    console.log('Consider running these performance tests:');
    console.log('• Load testing with tools like Apache Bench or k6');
    console.log('• Memory profiling with Node.js --inspect flag');
    console.log('• Database query analysis with Supabase logs');
    console.log('• Cache performance testing with Redis CLI');

    await performanceMiddleware.close();
    console.log('\n✅ Performance report generation completed');
  } catch (error) {
    console.error('Failed to generate performance report:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  format: 'console', // console, json, html
  output: null as string | null,
  watch: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--format' && i + 1 < args.length) {
    options.format = args[i + 1];
    i++;
  } else if (arg === '--output' && i + 1 < args.length) {
    options.output = args[i + 1];
    i++;
  } else if (arg === '--watch') {
    options.watch = true;
  } else if (arg === '--help') {
    console.log(`
Universal AI Tools Performance Report Generator

Usage: npm run perf:report [options]

Options:
  --format <format>  Output format (console, json, html) [default: console]
  --output <file>    Output file path [default: stdout]
  --watch           Watch mode - generate reports every 5 minutes
  --help            Show this help message

Examples:
  npm run perf:report
  npm run perf:report -- --format json --output performance.json
  npm run perf:report -- --watch
`);
    process.exit(0);
  }
}

// Run the report generator
if (options.watch) {
  console.log('🔄 Starting performance report generator in watch mode...');
  console.log('Press Ctrl+C to stop\n');

  generateReport();
  const interval = setInterval(generateReport, 300000); // 5 minutes

  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping performance report generator...');
    clearInterval(interval);
    process.exit(0);
  });
} else {
  generateReport().catch(console.error);
}
