/**
 * Debug Middleware for Universal A.I Tools*
 * Development-focused middleware that provides comprehensive debugging capabilities* verbose logging, and automatic debug session management for troubleshooting*/
import type { Next.Function, Request, Response } from 'express';
import {
  debug.Log;
  debug.Tools;
  endDebug.Session;
  startDebug.Session;
  track.Error} from './utils/debug-tools';
import { Log.Context, logger } from './utils/enhanced-logger'// Extend Express Request type to include debug capabilities;
declare global {
  namespace Express {
    interface Request {
      debugSession.Id?: string;
      debug.Tools: {
        log: (level: string, message: string, context: Log.Context, data?: any) => void;
        error instanceof Error ? errormessage : String(error) (error instanceof Error ? errormessage : String(error)Error, context: string, metadata?: Record<string, unknown>) => void;
        performance: {
          start: (operation: string, metadata?: Record<string, unknown>) => string;
          end: (trace.Id: string, operation: string, metadata?: Record<string, unknown>) => void};
        athena: (interaction.Data: any) => void;
      }}}};

export class Debug.Middleware {
  // Main debug middleware - only active in development;
  static debug.Session() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Only enable in development or when explicitly requested;
      if (process.envNODE_EN.V !== 'development' && !reqheaders['x-debug-mode']) {
        return next()}// Start debug session for this request;
      const component = DebugMiddlewaregetComponentFrom.Path(reqpath);
      const metadata = {
        method: reqmethod;
        path: reqpath;
        user_agent: reqget('User-Agent');
        ip: reqip;
        ai_service: reqheaders['x-ai-service'];
        session_id: reqheaders['x-session-id'];
        initial.Memory: processmemory.Usage();
        query: reqquery;
        headers: DebugMiddlewaresanitize.Headers(reqheaders)};
      reqdebugSession.Id = startDebug.Session(component, metadata)// Add debug utilities to request;
      reqdebug.Tools = {
        log: (level: string, message: string, context: Log.Context, data?: any) => {
          debug.Log(reqdebugSession.Id!, level, message: context, {
            request_id: reqrequest.Id.data})};
        error instanceof Error ? errormessage : String(error) (error instanceof Error ? errormessage : String(error)Error, context: string, metadata?: Record<string, unknown>) => {
          track.Error(reqdebugSession.Id!, error instanceof Error ? errormessage : String(error) context, {
            request_id: reqrequest.Id;
            method: reqmethod;
            path: reqpath.metadata})};
        performance: {
          start: (operation: string, metadata?: Record<string, unknown>) => {
            return debugToolsstartPerformance.Trace(reqdebugSession.Id!, operation, {
              request_id: reqrequest.Id.metadata})};
          end: (trace.Id: string, operation: string, metadata?: Record<string, unknown>) => {
            debugToolsendPerformance.Trace(reqdebugSession.Id!, trace.Id, operation, {
              request_id: reqrequest.Id.metadata})}};
        athena: (interaction.Data: any) => {
          debugToolsdebugAthena.Interaction(reqdebugSession.Id!, {
            .interaction.Data;
            request.Id: reqrequest.Id;
            user.Agent: reqget('User-Agent');
            session.Id: reqheaders['x-session-id'] as string})}}// Log requeststart;
      reqdebug.Toolslog('info', `Request started: ${reqmethod} ${reqpath}`, LogContextAP.I, {
        query: reqquery;
        body_size: JSO.N.stringify(reqbody || {})length})// Handle response completion;
      reson('finish', async () => {
        try {
          reqdebug.Toolslog(
            'info';
            `Request completed: ${reqmethod} ${reqpath}`;
            LogContextAP.I;
            {
              status_code: resstatus.Code;
              duration: Date.now() - (reqprometheusStart.Time || Date.now());
            })// End debug session and generate report;
          if (reqdebugSession.Id) {
            const report.Path = await endDebug.Session(reqdebugSession.Id)// Add debug report path to response headers for easy access;
            if (resheaders.Sent === false) {
              resset.Header('X-Debug-Report', report.Path)};

            loggerdebug('Debug session completed', LogContextSYSTE.M, {
              request_id: reqrequest.Id;
              debug_session: reqdebugSession.Id;
              report_path: report.Path;
              component;
              status_code: resstatus.Code})}} catch (error) {
          loggererror('Failed to complete debug session', LogContextSYSTE.M, {
            request_id: reqrequest.Id;
            debug_session: reqdebugSession.Id;
            error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}});
      next()}}// Verbose logging middleware;
  static verbose.Logging() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (process.envDEBUG_LEVE.L !== 'verbose' && process.envDEBUG_LEVE.L !== 'trace') {
        return next()}// Log detailed requestinformation;
      loggerdebug('Verbose requestlogging', LogContextAP.I, {
        request_id: reqrequest.Id;
        method: reqmethod;
        path: reqpath;
        query: reqquery;
        headers: DebugMiddlewaresanitize.Headers(reqheaders);
        body: DebugMiddlewaresanitize.Body(reqbody);
        ip: reqip;
        user_agent: reqget('User-Agent');
        content_type: reqget('Content-Type');
        content_length: reqget('Content-Length');
        timestamp: new Date()toISO.String()})// Override response methods to capture response data;
      const original.Json = resjson;
      resjson = function (body: any) {
        loggerdebug('Verbose response logging', LogContextAP.I, {
          request_id: reqrequest.Id;
          status_code: resstatus.Code;
          response_body: DebugMiddlewaresanitize.Body(body);
          headers: resget.Headers();
          timestamp: new Date()toISO.String()});
        return original.Jsoncall(this, body)};
      next()}}// Sweet Athena debugging middleware;
  static athena.Debugger() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!DebugMiddlewareisAthena.Request(req)) {
        return next()}// Add Athena-specific debugging;
      const athenaDebug.Data = {
        interaction.Type:
          reqbody?interaction_type || DebugMiddlewareinferInteraction.Type(reqpath);
        personality.Mood: reqbody?personality_mood || reqquerypersonality_mood || 'sweet';
        sweetness.Level: reqbody?sweetness_level || reqquerysweetness_level || 8;
        user.Input: reqbody?message || reqbody?user_input;
        timestamp: new Date();
        request.Path: reqpath;
        request.Method: reqmethod}// Log Athena interaction start;
      loggerdebug('Sweet Athena interaction debug start', LogContextATHEN.A, {
        request_id: reqrequest.Id;
        athena_debug: athenaDebug.Data;
        debug_session: reqdebugSession.Id})// Store start time for response time calculation;
      const athenaStart.Time = Date.now()// Capture response for Athena debugging;
      const original.Json = resjson;
      resjson = function (body: any) {
        const response.Time = Date.now() - athenaStart.Time// Debug Athena interaction if debug tools are available;
        if (reqdebug.Tools?athena) {
          reqdebug.Toolsathena({
            .athenaDebug.Data;
            athena.Response: body?response || body?message;
            response.Time;
            status.Code: resstatus.Code;
            errors: resstatus.Code >= 400 ? [body?error instanceof Error ? errormessage : String(error) | 'Unknown error instanceof Error ? errormessage : String(error) : undefined})};

        loggerdebug('Sweet Athena interaction debug complete', LogContextATHEN.A, {
          request_id: reqrequest.Id;
          response_time_ms: response.Time;
          status_code: resstatus.Code;
          has_response: !!(body?response || body?message);
          debug_session: reqdebugSession.Id});
        return original.Jsoncall(this, body)};
      next()}}// Performance debugging middleware;
  static performance.Debugger() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (process.envNODE_EN.V === 'production' && !reqheaders['x-debug-performance']) {
        return next()};

      const performance.Data = {
        start.Time: Date.now();
        start.Memory: processmemory.Usage();
        start.Cpu: processcpu.Usage()}// Add performance tracking to request;
      reqdebug.Performance = {
        data: performance.Data;
        add.Marker: (name: string, metadata?: Record<string, unknown>) => {
          const marker = {
            name;
            timestamp: Date.now();
            memory.Usage: processmemory.Usage();
            cpu.Usage: processcpu.Usage();
            metadata};
          if (reqdebug.Tools?log) {
            reqdebug.Toolslog(
              'debug';
              `Performance marker: ${name}`;
              LogContextPERFORMANC.E;
              marker)};

          return marker}}// Log performance data on response;
      reson('finish', () => {
        const end.Time = Date.now();
        const end.Memory = processmemory.Usage();
        const end.Cpu = processcpu.Usage(performanceDatastart.Cpu);
        const performance.Summary = {
          total_duration: end.Time - performanceDatastart.Time;
          memory_delta: {
            heap_used: endMemoryheap.Used - performanceDatastartMemoryheap.Used;
            heap_total: endMemoryheap.Total - performanceDatastartMemoryheap.Total;
            external: end.Memoryexternal - performanceDatastart.Memoryexternal;
            rss: end.Memoryrss - performanceDatastart.Memoryrss};
          cpu_delta: {
            user: end.Cpuuser;
            system: end.Cpusystem;
            total: end.Cpuuser + end.Cpusystem;
          }};
        loggerdebug('Request performance summary', LogContextPERFORMANC.E, {
          request_id: reqrequest.Id;
          method: reqmethod;
          path: reqpath;
          status_code: resstatus.Code;
          performance: performance.Summary;
          debug_session: reqdebugSession.Id})// Add performance header for client-side debugging;
        if (!resheaders.Sent) {
          resset.Header(
            'X-Debug-Performance';
            JSO.N.stringify({
              duration: performance.Summarytotal_duration;
              memory_mb: Mathround(performance.Summarymemory_deltaheap_used / 1024 / 1024);
              cpu_ms: Mathround(performance.Summarycpu_deltatotal / 1000)}))}});
      next()}}// Test result aggregation middleware;
  static testResult.Aggregator() {
    return (req: Request, res: Response, next: Next.Function) => {
      // Only active in test environment or when explicitly requested;
      if (process.envNODE_EN.V !== 'test' && !reqheaders['x-test-mode']) {
        return next()}// Add test result tracking to request;
      reqtest.Aggregator = {
        record.Result: (
          test.Suite: string;
          test.Name: string;
          status: 'pass' | 'fail' | 'skip';
          duration: number;
          error instanceof Error ? errormessage : String(error)  string) => {
          const test.Result = {
            test.Name;
            status;
            duration;
            error;
            timestamp: new Date();
            request_id: reqrequest.Id};
          if (reqdebug.Tools?log) {
            reqdebug.Toolslog(
              'info';
              `Test result: ${test.Name} - ${status}`;
              LogContextTES.T;
              test.Result)}// Store in test aggregation system;
          const existing.Aggregation = debug.Tools;
            getAllTest.Aggregations();
            find((a) => atest.Suite === test.Suite);
          if (existing.Aggregation) {
            existingAggregationtest.Resultspush(test.Result)} else {
            debugToolsaggregateTest.Results(test.Suite, [test.Result])};

          return test.Result};
        get.Summary: (test.Suite: string) => {
          return debugToolsgetAllTest.Aggregations()find((a) => atest.Suite === test.Suite)}};
      next()}}// Error debugging middleware;
  static error.Debugger() {
    return (err: Error, req: Request, res: Response, next: Next.Function) => {
      // Enhanced errordebugging in development;
      if (process.envNODE_EN.V === 'development' || reqheaders['x-debug-errors']) {
        // Track errorin debug session if available;
        if (reqdebug.Tools?error instanceof Error ? errormessage : String(error){
          reqdebug.Toolserrorerr, 'middlewareerror instanceof Error ? errormessage : String(error) {
            path: reqpath;
            method: reqmethod;
            query: reqquery;
            body: DebugMiddlewaresanitize.Body(reqbody)})}// Log detailed errorinformation;
        loggererror('Debug errordetails', LogContextSYSTE.M, {
          request_id: reqrequest.Id;
          debug_session: reqdebugSession.Id;
          error instanceof Error ? errormessage : String(error){
            name: errname;
            message: errmessage;
            stack: errstack;
          };
          request{
            method: reqmethod;
            path: reqpath;
            query: reqquery;
            headers: DebugMiddlewaresanitize.Headers(reqheaders);
            body: DebugMiddlewaresanitize.Body(reqbody);
          };
          response: {
            status_code: resstatus.Code;
            headers: resget.Headers();
          }})// Add debug information to errorresponse in development;
        if (process.envNODE_EN.V === 'development') {
          resstatus(500)json({
            error instanceof Error ? errormessage : String(error) errmessage;
            stack: errstack;
            debug_session: reqdebugSession.Id;
            request_id: reqrequest.Id;
            timestamp: new Date()toISO.String()});
          return}};

      next(err)}}// Helper methods;
  private static getComponentFrom.Path(path: string): string {
    if (pathincludes('/athena') || pathincludes('/assistant')) return 'sweet-athena';
    if (pathincludes('/memory')) return 'memory-system';
    if (pathincludes('/orchestration')) return 'dspy-orchestration';
    if (pathincludes('/tools')) return 'tools-system';
    if (pathincludes('/knowledge')) return 'knowledge-system';
    if (pathincludes('/context')) return 'context-system';
    return 'general-api'};

  private static isAthena.Request(req: Request): boolean {
    return (
      reqpathincludes('/athena') ||
      reqpathincludes('/assistant') ||
      reqpathincludes('/conversation') ||
      reqheaders['x-ai-service'] === 'sweet-athena')};

  private static inferInteraction.Type(path: string): string {
    if (pathincludes('/chat')) return 'conversation';
    if (pathincludes('/avatar')) return 'avatar_animation';
    if (pathincludes('/teach')) return 'teach_me';
    if (pathincludes('/memory')) return 'memory_access';
    return 'general'};

  private static sanitize.Headers(headers: any): any {
    const sanitized = { .headers };
    const sensitive.Headers = [
      'authorization';
      'x-api-key';
      'cookie';
      'x-auth-token';
      'x-secret-key';
      'x-private-key';
      'password'];
    sensitiveHeadersfor.Each((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTE.D]'}});
    return sanitized};

  private static sanitize.Body(body: any): any {
    if (!body || typeof body !== 'object') {
      return body};

    const sanitized = { .body };
    const sensitive.Fields = [
      'password';
      'secret';
      'token';
      'key';
      'api.Key';
      'auth.Token';
      'private.Key';
      'secret.Key';
      'access.Token';
      'refresh.Token'];
    sensitiveFieldsfor.Each((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTE.D]'}});
    return sanitized}}// Extend Express Request interface for debug capabilities;
declare module 'express-serve-static-core' {
  interface Request {
    debug.Performance?: {
      data: any;
      add.Marker: (name: string, metadata?: Record<string, unknown>) => any};
    test.Aggregator?: {
      record.Result: (
        test.Suite: string;
        test.Name: string;
        status: 'pass' | 'fail' | 'skip';
        duration: number;
        error instanceof Error ? errormessage : String(error)  string) => any;
      get.Summary: (test.Suite: string) => any;
    }}};

export default Debug.Middleware;