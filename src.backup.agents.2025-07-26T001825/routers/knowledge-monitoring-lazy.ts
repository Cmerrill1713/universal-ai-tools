/**
 * Knowledge Monitoring Router with Lazy Initialization* AP.I endpoints for knowledge base health monitoring and management*/

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { initializeWith.Timeout } from './utils/timeout-utils'// Lazy-loaded services;
let knowledge.Manager: any = null;
let feedback.Service: any = null;
let update.Automation: any = null;
let knowledgeScraper.Service: any = null;
let knowledgeValidation.Service: any = null;
let services.Initialized = false;
let initialization.Promise: Promise<boolean> | null = null;
async function initialize.Services(supabase: Supabase.Client): Promise<boolean> {
  if (services.Initialized) return true// Return existing promise if initialization is already in progress;
  if (initialization.Promise) return initialization.Promise;
  initialization.Promise = (async () => {
    try {
      loggerinfo('Lazy loading knowledge monitoring services.')// Import services;
      const [
        { DSPyKnowledge.Manager };
        { createKnowledgeFeedback.Service };
        knowledgeScraper.Module;
        { createKnowledgeUpdate.Automation };
        knowledgeValidation.Module] = await Promiseall([
        import('./core/knowledge/dspy-knowledge-manager');
        import('./services/knowledge-feedback-service');
        import('./services/knowledge-scraper-service');
        import('./services/knowledge-update-automation');
        import('./services/knowledge-validation-service')]);
      knowledgeScraper.Service = knowledgeScraperModuleknowledgeScraper.Service;
      knowledgeValidation.Service = knowledgeValidationModuleknowledgeValidation.Service// Initialize services with timeout protection;
      knowledge.Manager = await initializeWith.Timeout(
        async () => new DSPyKnowledge.Manager({});
        'DSPyKnowledge.Manager';
        5000);
      feedback.Service = await initializeWith.Timeout(
        async () => createKnowledgeFeedback.Service(supabase, logger);
        'KnowledgeFeedback.Service';
        5000);
      if (knowledge.Manager && feedback.Service) {
        update.Automation = await initializeWith.Timeout(
          async () =>
            createKnowledgeUpdate.Automation(
              knowledgeScraper.Service;
              knowledgeValidation.Service;
              feedback.Service;
              knowledge.Manager);
          'KnowledgeUpdate.Automation';
          5000)};

      services.Initialized = !!(knowledge.Manager && feedback.Service && update.Automation);
      return services.Initialized} catch (error) {
      loggererror('Failed to initialize knowledge monitoring services:', {
        error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error)});
      return false}})();
  return initialization.Promise}// Helper function to ensure services are initialized;
async function ensureServices.Initialized(
  supabase: Supabase.Client;
  res: Response): Promise<boolean> {
  if (!services.Initialized) {
    const initialized = await initialize.Services(supabase);
    if (!initialized) {
      resstatus(503)json({
        error instanceof Error ? errormessage : String(error) 'Knowledge monitoring services are not available';
        message: 'The service is still initializing or failed to start'});
      return false}};
  return true}// Time range helper;
function getTime.Since(time.Range: string): Date {
  const now = new Date();
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000;
    '6h': 6 * 60 * 60 * 1000;
    '24h': 24 * 60 * 60 * 1000;
    '7d': 7 * 24 * 60 * 60 * 1000;
    '30d': 30 * 24 * 60 * 60 * 1000;
  };
  const offset = ranges[time.Range] || ranges['24h'];
  return new Date(nowget.Time() - offset)};

export default function createKnowledgeMonitoring.Router(supabase: Supabase.Client) {
  const router = Router()/**
   * GE.T /api/knowledge-monitoring/status* Get service initialization status*/
  routerget('/status', async (req: Request, res: Response) => {
    resjson({
      initialized: services.Initialized;
      services: {
        knowledge.Manager: !!knowledge.Manager;
        feedback.Service: !!feedback.Service;
        update.Automation: !!update.Automation;
      }})})/**
   * GE.T /api/knowledge-monitoring/dashboard* Get comprehensive dashboard data*/
  routerget('/dashboard', async (req: Request, res: Response) => {
    if (!(await ensureServices.Initialized(supabase, res))) return;
    try {
      const time.Range = (reqquerytime.Range as string) || '24h';
      const since = getTime.Since(time.Range)// Fetch all dashboard data in parallel;
      const [
        overview;
        source.Health;
        validation.Metrics;
        usage.Analytics;
        performance.Metrics;
        active.Alerts;
        update.Queue;
        insights] = await Promiseall([
        feedbackServicegetSystem.Overview(since);
        feedbackServicegetSourceHealth.Metrics(since);
        knowledgeValidationServicegetValidation.Metrics(since);
        feedbackServicegetUsage.Analytics(since);
        knowledgeManagergetPerformance.Metrics();
        knowledgeValidationServicegetActive.Alerts();
        updateAutomationgetUpdate.Queue();
        feedbackServicegenerate.Insights()]);
      resjson({
        timestamp: new Date()toISO.String();
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

  return router};
