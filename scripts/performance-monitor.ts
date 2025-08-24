#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import PerformanceMiddleware from '../src/middleware/performance';
import { logger } from '../src/utils/logger';
import { config } from '../src/config';

// Initialize configuration
import { initializeConfig } from '../src/config';
initializeConfig();

async function main() {
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🚀 Starting Performance Monitor for Universal AI Tools...\n');

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
      slowRequestThreshold: 1000, // 1 second
      memoryThreshold: 512, // 512MB
    });

    // Generate initial report
    console.log('📊 Generating initial performance report...\n');
    const initialReport = await performanceMiddleware.generatePerformanceReport();
    console.log(initialReport);

    // Start monitoring loop
    console.log('\n🔍 Starting continuous monitoring (press Ctrl+C to stop)...\n');

    let reportCount = 0;
    const monitoringInterval = setInterval(async () => {
      try {
        reportCount++;
        console.log(`\n📈 Performance Report #${reportCount} - ${new Date().toISOString()}`);
        console.log('='.repeat(60));

        const metrics = await performanceMiddleware.getMetrics();

        // Display key metrics
        console.log(
          `Memory Usage: ${metrics.performance.averageMemoryUsage.toFixed(2)}MB (Peak: ${metrics.performance.peakMemoryUsage}MB)`
        );
        console.log(
          `Response Time: ${metrics.performance.averageResponseTime.toFixed(2)}ms (Peak: ${metrics.performance.peakResponseTime}ms)`
        );
        console.log(`Cache Hit Rate: ${metrics.cache.hitRate.toFixed(2)}%`);
        console.log(
          `Database Queries: ${metrics.database.totalQueries} (${metrics.database.cachedQueries} cached)`
        );
        console.log(
          `Requests (5min): ${metrics.requests.last5Minutes.count} (${metrics.requests.last5Minutes.avgResponseTime.toFixed(2)}ms avg)`
        );
        console.log(`Error Rate: ${metrics.performance.errorRate.toFixed(2)}%`);

        // Check for performance issues
        const issues = [];
        if (metrics.performance.averageMemoryUsage > 800) {
          issues.push('⚠️  High memory usage detected');
        }
        if (metrics.performance.averageResponseTime > 2000) {
          issues.push('⚠️  High response times detected');
        }
        if (metrics.cache.hitRate < 70) {
          issues.push('⚠️  Low cache hit rate');
        }
        if (metrics.performance.errorRate > 5) {
          issues.push('⚠️  High error rate');
        }

        if (issues.length > 0) {
          console.log('\n🚨 Performance Issues:');
          issues.forEach((issue) => console.log(`   ${issue}`));
        } else {
          console.log('\n✅ All metrics within normal ranges');
        }

        // Generate detailed report every 10 minutes
        if (reportCount % 10 === 0) {
          console.log('\n📋 Generating detailed performance report...\n');
          const detailedReport = await performanceMiddleware.generatePerformanceReport();
          console.log(detailedReport);
        }
      } catch (error) {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Error during monitoring:', error);
      }
    }, 30000); // Every 30 seconds

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping performance monitor...');
      clearInterval(monitoringInterval);

      try {
        console.log('\n📊 Generating final performance report...\n');
        const finalReport = await performanceMiddleware.generatePerformanceReport();
        console.log(finalReport);

        await performanceMiddleware.close();
        console.log('\n✅ Performance monitor stopped gracefully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      await performanceMiddleware.close();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      await performanceMiddleware.close();
      process.exit(1);
    });

    // Keep the process running
    await new Promise(() => {});
  } catch (error) {
    console.error('Failed to start performance monitor:', error);
    process.exit(1);
  }
}

// Run the monitor
main().catch(console.error);
