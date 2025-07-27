/* eslint-disable no-undef */
#!/usr/bin/env node

/**
 * Production Readiness CLI Tool
 * Tests all critical backend services for production deployment
 */

import { createClient } from '@supabase/supabase-js';
import { ProductionReadinessService } from '../services/production-readiness-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('🚀 Universal AI Tools - Production Readiness Check\n');

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error'Missing Supabase configuration', LogContext.SYSTEM);
      console._error
        '❌ Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY'
      );
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const readinessService = new ProductionReadinessService(supabase);

    // Run comprehensive assessment
    console.log('Running comprehensive production readiness assessment...\n');
    const report = await readinessService.generateReport();

    console.log(report);

    // Exit with appropriate code
    const assessment = await readinessService.assessProductionReadiness();
    process.exit(assessment.overall.ready ? 0 : 1);
  } catch (_error) {
    logger.error'Production readiness check failed', LogContext.SYSTEM, { _error});
    console._error'❌ Production readiness check failed:', _error;
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main as runProductionReadinessCheck };
