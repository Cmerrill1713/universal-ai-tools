/**
 * Knowledge Monitoring Router with Lazy Initialization* A.P.I endpoints for knowledge base health monitoring and management*/

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { initialize.With.Timeout } from './utils/timeout-utils'// Lazy-loaded services;
let knowledge.Manager: any = null,
let feedback.Service: any = null,
let update.Automation: any = null,
let knowledge.Scraper.Service: any = null,
let knowledge.Validation.Service: any = null,
let services.Initialized = false;
let initialization.Promise: Promise<boolean> | null = null,
async function initialize.Services(supabase: Supabase.Client): Promise<boolean> {
  if (services.Initialized) return true// Return existing promise if initialization is already in progress;
  if (initialization.Promise) return initialization.Promise;
  initialization.Promise = (async () => {
    try {
      loggerinfo('Lazy loading knowledge monitoring services.')// Import services;
      const [
        { DSPy.Knowledge.Manager ;
        { createKnowledge.Feedback.Service ;
        knowledge.Scraper.Module;
        { createKnowledge.Update.Automation ;
        knowledge.Validation.Module] = await Promiseall([
        import('./core/knowledge/dspy-knowledge-manager');
        import('./services/knowledge-feedback-service');
        import('./services/knowledge-scraper-service');
        import('./services/knowledge-update-automation');
        import('./services/knowledge-validation-service')]);
      knowledge.Scraper.Service = knowledgeScraperModuleknowledge.Scraper.Service;
      knowledge.Validation.Service = knowledgeValidationModuleknowledge.Validation.Service// Initialize services with timeout protection;
      knowledge.Manager = await initialize.With.Timeout(
        async () => new DSPy.Knowledge.Manager({});
        'DSPy.Knowledge.Manager';
        5000);
      feedback.Service = await initialize.With.Timeout(
        async () => createKnowledge.Feedback.Service(supabase, logger);
        'Knowledge.Feedback.Service';
        5000);
      if (knowledge.Manager && feedback.Service) {
        update.Automation = await initialize.With.Timeout(
          async () =>
            createKnowledge.Update.Automation(
              knowledge.Scraper.Service;
              knowledge.Validation.Service;
              feedback.Service;
              knowledge.Manager);
          'Knowledge.Update.Automation';
          5000);

      services.Initialized = !!(knowledge.Manager && feedback.Service && update.Automation);
      return services.Initialized} catch (error) {
      loggererror('Failed to initialize knowledge monitoring services:', {
        error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error)});
      return false}})();
  return initialization.Promise}// Helper function to ensure services are initialized;
async function ensure.Services.Initialized(
  supabase: Supabase.Client,
  res: Response): Promise<boolean> {
  if (!services.Initialized) {
    const initialized = await initialize.Services(supabase);
    if (!initialized) {
      resstatus(503)json({
        error instanceof Error ? errormessage : String(error) 'Knowledge monitoring services are not available';
        message: 'The service is still initializing or failed to start'}),
      return false};
  return true}// Time range helper;
function get.Time.Since(time.Range: string): Date {
  const now = new Date();
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000;
    '6h': 6 * 60 * 60 * 1000;
    '24h': 24 * 60 * 60 * 1000;
    '7d': 7 * 24 * 60 * 60 * 1000;
    '30d': 30 * 24 * 60 * 60 * 1000;
}  const offset = ranges[time.Range] || ranges['24h'];
  return new Date(nowget.Time() - offset);

export default function createKnowledge.Monitoring.Router(supabase: Supabase.Client) {
  const router = Router()/**
   * G.E.T /api/knowledge-monitoring/status* Get service initialization status*/
  routerget('/status', async (req: Request, res: Response) => {
    resjson({
      initialized: services.Initialized,
      services: {
        knowledge.Manager: !!knowledge.Manager,
        feedback.Service: !!feedback.Service,
        update.Automation: !!update.Automation,
      }})})/**
   * G.E.T /api/knowledge-monitoring/dashboard* Get comprehensive dashboard data*/
  routerget('/dashboard', async (req: Request, res: Response) => {
    if (!(await ensure.Services.Initialized(supabase, res))) return;
    try {
      const time.Range = (reqquerytime.Range as string) || '24h';
      const since = get.Time.Since(time.Range)// Fetch all dashboard data in parallel;
      const [
        overview;
        source.Health;
        validation.Metrics;
        usage.Analytics;
        performance.Metrics;
        active.Alerts;
        update.Queue;
        insights] = await Promiseall([
        feedbackServiceget.System.Overview(since);
        feedbackServicegetSource.Health.Metrics(since);
        knowledgeValidationServiceget.Validation.Metrics(since);
        feedbackServiceget.Usage.Analytics(since);
        knowledgeManagerget.Performance.Metrics();
        knowledgeValidationServiceget.Active.Alerts();
        updateAutomationget.Update.Queue();
        feedback.Servicegenerate.Insights()]);
      resjson({
        timestamp: new Date()toIS.O.String(),
        time.Range;
        overview;
        source.Health;
        validation.Metrics;
        usage.Analytics;
        performance.Metrics;
        active.Alerts;
        update.Queue;
        insights})} catch (error) {
      loggererror('Dashboard data fetch failed:', error);
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Failed to fetch dashboard data';
        details: error instanceof Error ? errormessage : 'Unknown error'})}})// Add other routes similarly with lazy initialization checks.
  // (Keeping the router small for this example, but all routes should follow this pattern;

  return router;
