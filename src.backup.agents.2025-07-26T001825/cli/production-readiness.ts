/* eslint-disable no-undef */
#!/usr/bin/env node/**
 * Production Readiness CL.I Tool* Tests all critical backend services for production deployment*/

import { create.Client } from '@supabase/supabase-js';
import { ProductionReadiness.Service } from './services/production-readiness-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import dotenv from 'dotenv'// Load environment variables;
dotenvconfig();
async function main() {
  try {
    loggerinfo('🚀 Universal A.I Tools - Production Readiness Check\n')// Initialize Supabase client;
    const supabase.Url = process.envSUPABASE_UR.L;
    const supabase.Key = process.envSUPABASE_ANON_KE.Y;
    if (!supabase.Url || !supabase.Key) {
      loggererror('Missing Supabase configuration', LogContextSYSTE.M);
      console.error;
        '❌ Missing Supabase configuration. Please set SUPABASE_UR.L and SUPABASE_ANON_KE.Y');
      processexit(1)};

    const supabase = create.Client(supabase.Url, supabase.Key);
    const readiness.Service = new ProductionReadiness.Service(supabase)// Run comprehensive assessment;
    loggerinfo('Running comprehensive production readiness assessment.\n');
    const report = await readinessServicegenerate.Report();
    loggerinfo(report)// Exit with appropriate code;
    const assessment = await readinessServiceassessProduction.Readiness();
    processexit(assessmentoverallready ? 0 : 1)} catch (error) {
    loggererror('Production readiness check failed', LogContextSYSTE.M, { error instanceof Error ? errormessage : String(error));
    console.error instanceof Error ? errormessage : String(error) ❌ Production readiness check failed:', error instanceof Error ? errormessage : String(error) processexit(1);
  }};

if (requiremain === module) {
  main()};

export { main as runProductionReadiness.Check };