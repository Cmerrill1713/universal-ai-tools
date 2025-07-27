/**
 * Application Performance Monitoring (AP.M) Service*
 * Comprehensive AP.M service for Universal A.I Tools with:
 * - Real-time performance monitoring* - Application insights and analytics* - Transaction tracing* - Error rate monitoring* - Resource utilization tracking* - Sweet Athena performance metrics* - Automatic anomaly detection* - Performance alerting*/

import { Event.Emitter } from 'events';
import { Performance.Observer, performance } from 'perf_hooks';
import { telemetry.Service } from './telemetry-service';
import { performance.Monitor } from './utils/performance-monitor';
import { Log.Context, logger } from './utils/enhanced-logger';
import type { Supabase.Client } from '@supabase/supabase-js';
import { create.Client } from '@supabase/supabase-js';
export interface APMConfig {
  enabled: boolean;
  sampling.Rate: number;
  max.Transactions: number;
  max.Spans: number;
  flush.Interval: number// ms;
  enableRealUser.Monitoring: boolean;
  enableSynthetic.Monitoring: boolean;
  enableResource.Monitoring: boolean;
  enableMemoryLeak.Detection: boolean;
  enablePerformance.Baseline: boolean;
  alert.Thresholds: {
    response.Time: number// ms;
    error.Rate: number// percentage;
    memory.Usage: number// M.B;
    cpu.Usage: number// percentage}};

export interface Transaction {
  id: string;
  name: string;
  type: 'request| 'task' | 'background' | 'athena';
  start.Time: number;
  end.Time?: number;
  duration?: number;
  result: 'success' | 'error instanceof Error ? errormessage : String(error) | 'timeout' | 'cancelled';
  spans: Span[];
  tags: Record<string, unknown>
  user?: {
    id: string;
    session.Id: string;
  };
  context: {
    trace.Id?: string;
    url?: string;
    method?: string;
    status.Code?: number;
    user.Agent?: string;
    ip?: string;
  };
  metrics: {
    memory.Used: number;
    cpu.Time: number;
    db.Queries: number;
    api.Calls: number;
  }};

export interface Span {
  id: string;
  transaction.Id: string;
  name: string;
  type: 'db' | 'http' | 'ai' | 'cache' | 'custom';
  start.Time: number;
  end.Time?: number;
  duration?: number;
  tags: Record<string, unknown>
  stack.Trace?: string[];
};

export interface PerformanceMetric {
  timestamp: Date;
  transaction.Type: string;
  name: string;
  value: number;
  unit: string;
  tags: Record<string, unknown>};

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  transaction.Id?: string;
  span.Id?: string;
  message: string;
  type: string;
  stack.Trace: string;
  handled: boolean;
  tags: Record<string, unknown>
  context: Record<string, unknown>
  fingerprint: string;
};

export interface APMReport {
  time.Range: {
    start: Date;
    end: Date;
  };
  overview: {
    total.Transactions: number;
    total.Errors: number;
    averageResponse.Time: number;
    error.Rate: number;
    throughput: number// transactions per minute};
  top.Transactions: Array<{
    name: string;
    count: number;
    average.Time: number;
    error.Rate: number}>
  top.Errors: Array<{
    fingerprint: string;
    message: string;
    count: number;
    last.Seen: Date}>
  performance: {
    responseTime.Percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    memory.Usage: {
      average: number;
      peak: number;
    };
    cpu.Usage: {
      average: number;
      peak: number;
    }};
  athena.Metrics?: {
    total.Interactions: number;
    averageResponse.Time: number;
    satisfaction.Score: number;
    top.Moods: Array<{
      mood: string;
      count: number;
      average.Time: number}>}};

export class APM.Service extends Event.Emitter {
  private config: APM.Config;
  private supabase: Supabase.Client;
  private is.Started = false;
  private transactions = new Map<string, Transaction>();
  private spans = new Map<string, Span>();
  private errors: Error.Event[] = [];
  private metrics: Performance.Metric[] = [];
  private performance.Observer?: Performance.Observer;
  private flush.Interval?: NodeJS.Timeout;
  private memory.Baseline?: NodeJSMemory.Usage;
  private lastGC.Time = Date.now();
  private transaction.Count = 0;
  constructor(supabase.Url: string, supabase.Key: string, config: Partial<APM.Config> = {}) {
    super();
    thissupabase = create.Client(supabase.Url, supabase.Key);
    thisconfig = {
      enabled: true;
      sampling.Rate: 1.0;
      max.Transactions: 1000;
      max.Spans: 10000;
      flush.Interval: 30000, // 30 seconds;
      enableRealUser.Monitoring: true;
      enableSynthetic.Monitoring: false;
      enableResource.Monitoring: true;
      enableMemoryLeak.Detection: true;
      enablePerformance.Baseline: true;
      alert.Thresholds: {
        response.Time: 2000, // 2 seconds;
        error.Rate: 5, // 5%;
        memory.Usage: 1024, // 1G.B;
        cpu.Usage: 80, // 80%}.config};
    thissetupError.Handling()}/**
   * Start AP.M monitoring*/
  async start(): Promise<void> {
    if (thisis.Started) {
      loggerwarn('AP.M service already started', LogContextPERFORMANC.E);
      return};

    if (!thisconfigenabled) {
      loggerinfo('AP.M service disabled', LogContextPERFORMANC.E);
      return};

    try {
      loggerinfo('Starting AP.M service', LogContextPERFORMANC.E, { config: thisconfig })// Initialize baseline metrics;
      if (thisconfigenablePerformance.Baseline) {
        thismemory.Baseline = processmemory.Usage()}// Setup performance monitoring;
      thissetupPerformance.Monitoring()// Setup resource monitoring;
      if (thisconfigenableResource.Monitoring) {
        thissetupResource.Monitoring()}// Setup memory leak detection;
      if (thisconfigenableMemoryLeak.Detection) {
        thissetupMemoryLeak.Detection()}// Start flush interval;
      thisflush.Interval = set.Interval(() => {
        thisflush.Metrics()}, thisconfigflush.Interval);
      thisis.Started = true;
      thisemit('started', { config: thisconfig });
      loggerinfo('AP.M service started successfully', LogContextPERFORMANC.E)} catch (error) {
      loggererror('Failed to start AP.M service', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error));
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Stop AP.M monitoring*/
  async stop(): Promise<void> {
    if (!thisis.Started) {
      loggerwarn('AP.M service not started', LogContextPERFORMANC.E);
      return};

    try {
      loggerinfo('Stopping AP.M service', LogContextPERFORMANC.E)// Clear intervals;
      if (thisflush.Interval) {
        clear.Interval(thisflush.Interval);
        thisflush.Interval = undefined}// Disconnect performance observer;
      if (thisperformance.Observer) {
        thisperformance.Observerdisconnect();
        thisperformance.Observer = undefined}// Final flush;
      await thisflush.Metrics();
      thisis.Started = false;
      thisemit('stopped');
      loggerinfo('AP.M service stopped successfully', LogContextPERFORMANC.E)} catch (error) {
      loggererror('Error stopping AP.M service', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error));
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Start a new transaction*/
  start.Transaction(
    name: string;
    type: Transaction['type'] = 'request;
    context: Partial<Transaction['context']> = {
}): string {
    const transaction.Id = thisgenerate.Id();
    const start.Time = performancenow();
    const transaction: Transaction = {
      id: transaction.Id;
      name;
      type;
      start.Time;
      result: 'success';
      spans: [];
      tags: {
};
      context: {
        trace.Id: telemetryServicegetCurrentTrace.Id().context;
      };
      metrics: {
        memory.Used: processmemory.Usage()heap.Used;
        cpu.Time: processcpu.Usage()user + processcpu.Usage()system;
        db.Queries: 0;
        api.Calls: 0;
      }};
    thistransactionsset(transaction.Id, transaction);
    thistransaction.Count++
    // Cleanup old transactions if we exceed limit;
    if (thistransactionssize > thisconfigmax.Transactions) {
      thiscleanupOld.Transactions()};

    loggerdebug('Started transaction', LogContextPERFORMANC.E, {
      transaction_id: transaction.Id;
      name;
      type;
      trace_id: transactioncontexttrace.Id});
    thisemit('transaction.Started', transaction);
    return transaction.Id}/**
   * End a transaction*/
  end.Transaction(
    transaction.Id: string;
    result: Transaction['result'] = 'success';
    tags: Record<string, unknown> = {}): void {
    const transaction = thistransactionsget(transaction.Id);
    if (!transaction) {
      loggerwarn('Transaction not found', LogContextPERFORMANC.E, {
        transaction_id: transaction.Id});
      return};

    const end.Time = performancenow();
    transactionend.Time = end.Time;
    transactionduration = end.Time - transactionstart.Time;
    transactionresult = result;
    transactiontags = { .transactiontags, .tags }// Update final metrics;
    const final.Memory = processmemory.Usage();
    const final.Cpu = processcpu.Usage();
    transactionmetrics = {
      .transactionmetrics;
      memory.Used: finalMemoryheap.Used - transactionmetricsmemory.Used;
      cpu.Time: final.Cpuuser + final.Cpusystem - transactionmetricscpu.Time;
    };
    loggerdebug('Ended transaction', LogContextPERFORMANC.E, {
      transaction_id: transaction.Id;
      duration_ms: transactionduration;
      result;
      memory_used: transactionmetricsmemory.Used;
      cpu_time: transactionmetricscpu.Time})// Check for performance alerts;
    thischeckPerformance.Alerts(transaction);
    thisemit('transaction.Ended', transaction)// Record performance metric;
    thisrecord.Metric('transaction_duration', transactionduration, 'ms', {
      transaction_name: transactionname;
      transaction_type: transactiontype;
      result: transactionresult})}/**
   * Start a span within a transaction*/
  start.Span(
    transaction.Id: string;
    name: string;
    type: Span['type'] = 'custom';
    tags: Record<string, unknown> = {}): string {
    const span.Id = thisgenerate.Id();
    const start.Time = performancenow();
    const span: Span = {
      id: span.Id;
      transaction.Id;
      name;
      type;
      start.Time;
      tags;
    };
    thisspansset(span.Id, span)// Add to transaction;
    const transaction = thistransactionsget(transaction.Id);
    if (transaction) {
      transactionspanspush(span)}// Cleanup old spans if we exceed limit;
    if (thisspanssize > thisconfigmax.Spans) {
      thiscleanupOld.Spans()};

    loggerdebug('Started span', LogContextPERFORMANC.E, {
      span_id: span.Id;
      transaction_id: transaction.Id;
      name;
      type});
    thisemit('span.Started', span);
    return span.Id}/**
   * End a span*/
  end.Span(span.Id: string, tags: Record<string, unknown> = {}): void {
    const span = thisspansget(span.Id);
    if (!span) {
      loggerwarn('Span not found', LogContextPERFORMANC.E, { span_id: span.Id });
      return};

    const end.Time = performancenow();
    spanend.Time = end.Time;
    spanduration = end.Time - spanstart.Time;
    spantags = { .spantags, .tags }// Update transaction metrics based on span type;
    const transaction = thistransactionsget(spantransaction.Id);
    if (transaction) {
      switch (spantype) {
        case 'db':
          transactionmetricsdb.Queries++
          break;
        case 'http':
          transactionmetricsapi.Calls++
          break}};

    loggerdebug('Ended span', LogContextPERFORMANC.E, {
      span_id: span.Id;
      transaction_id: spantransaction.Id;
      duration_ms: spanduration;
      type: spantype});
    thisemit('span.Ended', span)// Record span metric;
    thisrecord.Metric('span_duration', spanduration, 'ms', {
      span_name: spanname;
      span_type: spantype;
      transaction_id: spantransaction.Id})}/**
   * Record an error*/
  record.Error(
    error instanceof Error ? errormessage : String(error) Error;
    context: Record<string, unknown> = {};
    transaction.Id?: string;
    span.Id?: string): string {
    const error.Id = thisgenerate.Id();
    const fingerprint = thisgenerateError.Fingerprint(error instanceof Error ? errormessage : String(error);

    const error.Event: Error.Event = {
      id: error.Id;
      timestamp: new Date();
      transaction.Id;
      span.Id;
      message: errormessage;
      type: errorname;
      stack.Trace: errorstack || '';
      handled: true;
      tags: {
};
      context;
      fingerprint};
    thiserrorspush(error.Event)// Update transaction result if associated;
    if (transaction.Id) {
      const transaction = thistransactionsget(transaction.Id);
      if (transaction) {
        transactionresult = 'error instanceof Error ? errormessage : String(error)  }}// Keep only recent errors (last 1000);
    if (thiserrorslength > 1000) {
      thiserrors = thiserrorsslice(-1000)};

    loggererror('AP.M errorrecorded', LogContextPERFORMANC.E, {
      error_id: error.Id;
      transaction_id: transaction.Id;
      span_id: span.Id;
      fingerprint;
      message: errormessage});
    thisemit('error.Recorded', error.Event)// Record errormetric;
    thisrecord.Metric('error_count', 1, 'count', {
      error_type: errorname;
      fingerprint;
      transaction_id: transaction.Id});
    return error.Id}/**
   * Record Sweet Athena interaction*/
  recordAthena.Interaction(
    interaction.Type: string;
    personality.Mood: string;
    response.Time: number;
    satisfaction.Score?: number;
    session.Id?: string): void {
    const transaction.Id = thisstart.Transaction(`athena.${interaction.Type}`, 'athena', {
      url: `/athena/${interaction.Type}`})// Add Athena-specific tags;
    const transaction = thistransactionsget(transaction.Id);
    if (transaction) {
      transactiontags = {
        'athenainteraction_type': interaction.Type;
        'athenapersonality_mood': personality.Mood;
        'athenasession_id': session.Id || 'unknown';
        'athenasatisfaction_score': satisfaction.Score;
      };
      if (session.Id) {
        transactionuser = {
          id: 'athena_user';
          session.Id;
        }}}// Simulate transaction completion;
    set.Timeout(() => {
      thisend.Transaction(transaction.Id, 'success', {
        'athenaresponse_time': response.Time;
        'athenasatisfaction_score': satisfaction.Score})}, response.Time)// Record specific Athena metrics;
    thisrecord.Metric('athena_interaction_duration', response.Time, 'ms', {
      interaction_type: interaction.Type;
      personality_mood: personality.Mood;
      session_id: session.Id || 'unknown'});
    if (satisfaction.Score !== undefined) {
      thisrecord.Metric('athena_satisfaction_score', satisfaction.Score, 'score', {
        interaction_type: interaction.Type;
        personality_mood: personality.Mood;
        session_id: session.Id || 'unknown'})}}/**
   * Generate comprehensive AP.M report*/
  generate.Report(duration.Minutes = 60): APM.Report {
    const end.Time = new Date();
    const start.Time = new Date(endTimeget.Time() - duration.Minutes * 60 * 1000);
    const recent.Transactions = Arrayfrom(thistransactionsvalues())filter(
      (t) => tend.Time && new Date(tstart.Time) > start.Time);
    const recent.Errors = thiserrorsfilter((e) => etimestamp > start.Time);
    const recent.Metrics = thismetricsfilter((m) => mtimestamp > start.Time)// Calculate overview metrics;
    const total.Transactions = recent.Transactionslength;
    const total.Errors = recent.Errorslength;
    const completed.Transactions = recent.Transactionsfilter((t) => tduration !== undefined);
    const averageResponse.Time =
      completed.Transactionslength > 0? completed.Transactionsreduce((sum, t) => sum + (tduration || 0), 0) /
          completed.Transactionslength: 0;
    const error.Rate = total.Transactions > 0 ? (total.Errors / total.Transactions) * 100 : 0;
    const throughput = total.Transactions / duration.Minutes// Calculate top transactions;
    const transaction.Groups = new Map<string, Transaction[]>();
    recentTransactionsfor.Each((t) => {
      const key = `${ttype}:${tname}`;
      if (!transaction.Groupshas(key)) {
        transaction.Groupsset(key, [])};
      transaction.Groupsget(key)!push(t)});
    const top.Transactions = Arrayfrom(transaction.Groupsentries());
      map(([name, transactions]) => {
        const completed = transactionsfilter((t) => tduration !== undefined);
        const errors = transactionsfilter((t) => tresult === 'error instanceof Error ? errormessage : String(error) length;
        return {
          name;
          count: transactionslength;
          average.Time:
            completedlength > 0? completedreduce((sum, t) => sum + (tduration || 0), 0) / completedlength: 0;
          error.Rate: transactionslength > 0 ? (errors / transactionslength) * 100 : 0;
        }});
      sort((a, b) => bcount - acount);
      slice(0, 10)// Calculate top errors;
    const error.Groups = new Map<string, Error.Event[]>();
    recentErrorsfor.Each((e) => {
      if (!error.Groupshas(efingerprint)) {
        error.Groupsset(efingerprint, [])};
      error.Groupsget(efingerprint)!push(e)});
    const top.Errors = Arrayfrom(error.Groupsentries());
      map(([fingerprint, errors]) => ({
        fingerprint;
        message: errors[0]message;
        count: errorslength;
        last.Seen: new Date(Math.max(.errorsmap((e) => etimestampget.Time())))}));
      sort((a, b) => bcount - acount);
      slice(0, 10)// Calculate response time percentiles;
    const durations = completed.Transactionsmap((t) => tduration!)sort((a, b) => a - b);
    const responseTime.Percentiles = {
      p50: thiscalculate.Percentile(durations, 50);
      p95: thiscalculate.Percentile(durations, 95);
      p99: thiscalculate.Percentile(durations, 99)}// Calculate resource usage;
    const memory.Metrics = recent.Metricsfilter((m) => mname === 'memory_usage');
    const cpu.Metrics = recent.Metricsfilter((m) => mname === 'cpu_usage');
    const performance = {
      responseTime.Percentiles;
      memory.Usage: {
        average:
          memory.Metricslength > 0? memory.Metricsreduce((sum, m) => sum + mvalue, 0) / memory.Metricslength: 0;
        peak: memory.Metricslength > 0 ? Math.max(.memory.Metricsmap((m) => mvalue)) : 0};
      cpu.Usage: {
        average:
          cpu.Metricslength > 0? cpu.Metricsreduce((sum, m) => sum + mvalue, 0) / cpu.Metricslength: 0;
        peak: cpu.Metricslength > 0 ? Math.max(.cpu.Metricsmap((m) => mvalue)) : 0;
      }}// Calculate Athena metrics;
    const athena.Transactions = recent.Transactionsfilter((t) => ttype === 'athena');
    const athena.Metrics =
      athena.Transactionslength > 0? {
            total.Interactions: athena.Transactionslength;
            averageResponse.Time:
              athena.Transactionsreduce((sum, t) => sum + (tduration || 0), 0) /
              athena.Transactionslength;
            satisfaction.Score: thiscalculateAverageSatisfaction.Score(athena.Transactions);
            top.Moods: thiscalculateTop.Moods(athena.Transactions);
          }: undefined;
    return {
      time.Range: { start: start.Time, end: end.Time };
      overview: {
        total.Transactions;
        total.Errors;
        averageResponse.Time: Mathround(averageResponse.Time);
        error.Rate: Mathround(error.Rate * 100) / 100;
        throughput: Mathround(throughput * 100) / 100;
      };
      top.Transactions;
      top.Errors;
      performance;
      athena.Metrics}}/**
   * Get current metrics*/
  getCurrent.Metrics(): {
    active.Transactions: number;
    active.Spans: number;
    error.Count: number;
    memory.Usage: NodeJSMemory.Usage;
    uptime: number} {
    return {
      active.Transactions: Arrayfrom(thistransactionsvalues())filter((t) => !tend.Time)length;
      active.Spans: Arrayfrom(thisspansvalues())filter((s) => !send.Time)length;
      error.Count: thiserrorslength;
      memory.Usage: processmemory.Usage();
      uptime: processuptime();
    }}// Private methods;

  private setupError.Handling(): void {
    // Global errorhandling;
    processon('uncaught.Exception', (error instanceof Error ? errormessage : String(error)=> {
      thisrecord.Error(error instanceof Error ? errormessage : String(error) { source: 'uncaught.Exception' })});
    processon('unhandled.Rejection', (reason) => {
      const error instanceof Error ? errormessage : String(error)  reason instanceof Error ? reason : new Error(String(reason));
      thisrecord.Error(error instanceof Error ? errormessage : String(error) { source: 'unhandled.Rejection' })})};

  private setupPerformance.Monitoring(): void {
    thisperformance.Observer = new Performance.Observer((list) => {
      const entries = listget.Entries();
      entriesfor.Each((entry) => {
        thisrecord.Metric('performance_entry', entryduration, 'ms', {
          entry_type: entryentry.Type;
          name: entryname})})});
    thisperformance.Observerobserve({ entry.Types: ['measure', 'navigation', 'resource'] })};

  private setupResource.Monitoring(): void {
    set.Interval(() => {
      const mem.Usage = processmemory.Usage();
      const cpu.Usage = processcpu.Usage();
      thisrecord.Metric('memory_usage', memUsageheap.Used / 1024 / 1024, 'M.B', {
        type: 'heap_used'});
      thisrecord.Metric('memory_usage', mem.Usagerss / 1024 / 1024, 'M.B', {
        type: 'rss'});
      thisrecord.Metric('cpu_usage', (cpu.Usageuser + cpu.Usagesystem) / 1000, 'ms', {
        type: 'total'})}, 15000)// Every 15 seconds};

  private setupMemoryLeak.Detection(): void {
    set.Interval(() => {
      if (!thismemory.Baseline) return;
      const current.Memory = processmemory.Usage();
      const heap.Growth = currentMemoryheap.Used - thismemoryBaselineheap.Used// Check for significant memory growth;
      if (heap.Growth > 50 * 1024 * 1024) {
        // 50M.B;
        loggerwarn('Potential memory leak detected', LogContextPERFORMANC.E, {
          heap_growth_mb: Mathround(heap.Growth / 1024 / 1024);
          current_heap_mb: Mathround(currentMemoryheap.Used / 1024 / 1024);
          baseline_heap_mb: Mathround(thismemoryBaselineheap.Used / 1024 / 1024)});
        thisemit('memoryLeak.Detected', {
          heap.Growth;
          current.Memory;
          baseline: thismemory.Baseline})}// Update baseline periodically;
      if (Date.now() - thislastGC.Time > 300000) {
        // 5 minutes;
        if (globalgc) {
          globalgc();
          thismemory.Baseline = processmemory.Usage();
          thislastGC.Time = Date.now()}}}, 60000)// Every minute};

  private record.Metric(
    name: string;
    value: number;
    unit: string;
    tags: Record<string, unknown> = {}): void {
    const metric: Performance.Metric = {
      timestamp: new Date();
      transaction.Type: 'system';
      name;
      value;
      unit;
      tags;
    };
    thismetricspush(metric)// Keep only recent metrics (last 10000);
    if (thismetricslength > 10000) {
      thismetrics = thismetricsslice(-10000)};

    thisemit('metric.Recorded', metric)};

  private checkPerformance.Alerts(transaction: Transaction): void {
    const { alert.Thresholds } = thisconfig// Check response time;
    if (transactionduration && transactionduration > alertThresholdsresponse.Time) {
      thisemit('performance.Alert', {
        type: 'high_response_time';
        transaction;
        threshold: alertThresholdsresponse.Time;
        value: transactionduration})}// Check memory usage;
    const memoryM.B = transactionmetricsmemory.Used / 1024 / 1024;
    if (memoryM.B > alertThresholdsmemory.Usage) {
      thisemit('performance.Alert', {
        type: 'high_memory_usage';
        transaction;
        threshold: alertThresholdsmemory.Usage;
        value: memoryM.B})}};

  private async flush.Metrics(): Promise<void> {
    try {
      // Persist recent transactions to database;
      const recent.Transactions = Arrayfrom(thistransactionsvalues());
        filter((t) => tend.Time);
        slice(-100)// Last 100 completed transactions;
      if (recent.Transactionslength > 0) {
        await thissupabasefrom('apm_transactions')upsert(
          recent.Transactionsmap((t) => ({
            id: tid;
            name: tname;
            type: ttype;
            start_time: new Date(tstart.Time);
            end_time: tend.Time ? new Date(tend.Time) : null;
            duration: tduration;
            result: tresult;
            tags: ttags;
            context: tcontext;
            metrics: tmetrics})))}// Persist recent errors;
      const recent.Errors = thiserrorsslice(-50)// Last 50 errors;
      if (recent.Errorslength > 0) {
        await thissupabasefrom('apmerrors')upsert(
          recent.Errorsmap((e) => ({
            id: eid;
            timestamp: etimestamp;
            transaction_id: etransaction.Id;
            span_id: espan.Id;
            message: emessage;
            type: etype;
            stack_trace: estack.Trace;
            handled: ehandled;
            tags: etags;
            context: econtext;
            fingerprint: efingerprint})))};

      loggerdebug('AP.M metrics flushed', LogContextPERFORMANC.E, {
        transactions: recent.Transactionslength;
        errors: recent.Errorslength})} catch (error) {
      loggererror('Failed to flush AP.M metrics', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error) );
    }};

  private cleanupOld.Transactions(): void {
    const transactions = Arrayfrom(thistransactionsentries());
    const cutoff = performancenow() - 300000// 5 minutes ago;

    const to.Delete = transactions;
      filter(([_, t]) => tstart.Time < cutoff && tend.Time);
      slice(0, Mathfloor(thisconfigmax.Transactions * 0.1))// Delete 10%;
    toDeletefor.Each(([id, _]) => thistransactionsdelete(id))};

  private cleanupOld.Spans(): void {
    const spans = Arrayfrom(thisspansentries());
    const cutoff = performancenow() - 300000// 5 minutes ago;

    const to.Delete = spans;
      filter(([_, s]) => sstart.Time < cutoff && send.Time);
      slice(0, Mathfloor(thisconfigmax.Spans * 0.1))// Delete 10%;
    toDeletefor.Each(([id, _]) => thisspansdelete(id))};

  private generate.Id(): string {
    return (
      Mathrandom()to.String(36)substring(2, 15) + Mathrandom()to.String(36)substring(2, 15))};

  private generateError.Fingerprint(error instanceof Error ? errormessage : String(error) Error): string {
    // Create a fingerprint based on errortype and stack trace;
    const stack = errorstack || '';
    const lines = stacksplit('\n')slice(0, 3), // First 3 lines;
    return Bufferfrom(`${errorname}:${linesjoin('')}`);
      to.String('base64');
      substring(0, 16)};

  private calculate.Percentile(values: number[], percentile: number): number {
    if (valueslength === 0) return 0;
    const index = Mathceil((percentile / 100) * valueslength) - 1;
    return values[Math.max(0, index)] || 0};

  private calculateAverageSatisfaction.Score(transactions: Transaction[]): number {
    const scores = transactions;
      map((t) => ttags['athenasatisfaction_score']);
      filter((score) => typeof score === 'number');
    return scoreslength > 0 ? scoresreduce((sum, score) => sum + score, 0) / scoreslength : 0};

  private calculateTop.Moods(transactions: Transaction[]): Array<{
    mood: string;
    count: number;
    average.Time: number}> {
    const mood.Groups = new Map<string, Transaction[]>();
    transactionsfor.Each((t) => {
      const mood = ttags['athenapersonality_mood'];
      if (mood) {
        if (!mood.Groupshas(mood)) {
          mood.Groupsset(mood, [])};
        mood.Groupsget(mood)!push(t)}});
    return Arrayfrom(mood.Groupsentries());
      map(([mood, moods]) => ({
        mood;
        count: moodslength;
        average.Time: moodsreduce((sum, t) => sum + (tduration || 0), 0) / moodslength}));
      sort((a, b) => bcount - acount);
      slice(0, 5)}}// Create singleton instance;
let apm.Service: APM.Service | null = null;
export function getAPM.Service(
  supabase.Url?: string;
  supabase.Key?: string;
  config?: Partial<APM.Config>): APM.Service {
  if (!apm.Service) {
    if (!supabase.Url || !supabase.Key) {
      throw new Error('Supabase UR.L and key required to initialize AP.M service')};
    apm.Service = new APM.Service(supabase.Url, supabase.Key, config)};
  return apm.Service};

export default APM.Service;