/* eslint-disable no-undef */;
#!/usr/bin/env node;
/**;
 * Production Readiness CLI Tool;
 * Tests all critical backend services for production deployment;
 */;

import { createClient } from '@supabase/supabase-js';
import { ProductionReadinessService } from '../services/production-readiness-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import dotenv from 'dotenv';
// Load environment variables;
dotenvconfig();
async function main() {;
  try {;
    loggerinfo('🚀 Universal AI Tools - Production Readiness Check\n');
    // Initialize Supabase client;
    const supabaseUrl = processenvSUPABASE_URL;
    const supabaseKey = processenvSUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {;
      loggererror('Missing Supabase configuration', LogContextSYSTEM);
      consoleerror;
        '❌ Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY';
      );
      processexit(1);
    };

    const supabase = createClient(supabaseUrl, supabaseKey);
    const readinessService = new ProductionReadinessService(supabase);
    // Run comprehensive assessment;
    loggerinfo('Running comprehensive production readiness assessment...\n');
    const report = await readinessServicegenerateReport();
    loggerinfo(report);
    // Exit with appropriate code;
    const assessment = await readinessServiceassessProductionReadiness();
    processexit(assessmentoverallready ? 0 : 1);
  } catch (error) {;
    loggererror('Production readiness check failed', LogContextSYSTEM, { error instanceof Error ? errormessage : String(error));
    consoleerror instanceof Error ? errormessage : String(error) ❌ Production readiness check failed:', error instanceof Error ? errormessage : String(error) processexit(1);
  ;
};
};

if (requiremain === module) {;
  main();
};

export { main as runProductionReadinessCheck };