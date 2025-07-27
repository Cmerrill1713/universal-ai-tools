/* eslint-disable no-undef */
#!/usr/bin/env node/**
 * Production Readiness C.L.I.Tool* Tests all critical backend services for production deployment*/

import { create.Client } from '@supabase/supabase-js';
import { Production.Readiness.Service } from './services/production-readiness-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import dotenv from 'dotenv'// Load environment variables;
dotenvconfig();
async function main() {
  try {
    loggerinfo('🚀 Universal A.I.Tools - Production Readiness Check\n')// Initialize Supabase client;
    const supabase.Url = process.envSUPABASE_U.R.L;
    const supabase.Key = process.envSUPABASE_ANON_K.E.Y;
    if (!supabase.Url || !supabase.Key) {
      loggererror('Missing Supabase configuration', LogContextSYST.E.M);
      console.error;
        '❌ Missing Supabase configuration. Please set SUPABASE_U.R.L.and SUPABASE_ANON_K.E.Y');
      process.exit(1);

    const supabase = create.Client(supabase.Url, supabase.Key);
    const readiness.Service = new Production.Readiness.Service(supabase)// Run comprehensive assessment;
    loggerinfo('Running comprehensive production readiness assessment.\n');
    const report = await readiness.Servicegenerate.Report();
    loggerinfo(report)// Exit with appropriate code;
    const assessment = await readinessServiceassess.Production.Readiness();
    process.exit(assessmentoverallready ? 0 : 1)} catch (error) {
    loggererror('Production readiness check failed', LogContextSYST.E.M, { error instanceof Error ? error.message : String(error));
    console.error.instanceof Error ? error.message : String(error) ❌ Production readiness check failed:', error instanceof Error ? error.message : String(error) process.exit(1);
  };

if (requiremain === module) {
  main();

export { main as runProduction.Readiness.Check ;