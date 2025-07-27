import { fetchWith.Timeout } from './utils/fetch-with-timeout';
import { logger } from '././s././utils/logger';
import type { Browser.Agent } from './agent-pool';
import type { Page } from 'puppeteer';
import type { Page as Playwright.Page } from 'playwright';
import { Event.Emitter } from 'events';
export interface Performance.Metrics {
  timestamp: number;
  pageLoad.Time: number;
  firstContentful.Paint: number;
  largestContentful.Paint: number;
  cumulativeLayout.Shift: number;
  firstInput.Delay: number;
  timeTo.Interactive: number;
  totalBlocking.Time: number;
  memory.Usage: {
    usedJSHeap.Size: number;
    totalJSHeap.Size: number;
    jsHeapSize.Limit: number;
  };
  network.Requests: {
    total: number;
    successful: number;
    failed: number;
    total.Size: number;
    avgResponse.Time: number;
  };
  errors: string[];
};

export interface Performance.Report {
  agent.Id: string;
  browser: string;
  viewport: { width: number; height: number };
  metrics: Performance.Metrics;
  benchmarks: {
    pageLoad.Grade: 'A' | 'B' | 'C' | 'D' | 'F';
    performance.Score: number;
    recommendations: string[];
  }};

export class Performance.Monitor extends Event.Emitter {
  private readonly base.Url = 'http://localhost:5173';
  private readonly api.Url = 'http://localhost:9999';
  private metrics: Map<string, Performance.Metrics[]> = new Map();
  private is.Monitoring = false;
  private monitoring.Interval: NodeJS.Timeout | null = null;
  constructor() {
    super()};

  async start(): Promise<void> {
    if (thisis.Monitoring) {
      return};

    thisis.Monitoring = true;
    loggerinfo('Starting Performance Monitor.')// Start continuous monitoring;
    thismonitoring.Interval = set.Interval(async () => {
      try {
        await thiscollectSystem.Metrics()} catch (error) {
        loggererror('Error collecting system metrics:', error instanceof Error ? errormessage : String(error)}}, 5000)// Collect metrics every 5 seconds;
    loggerinfo('Performance Monitor started')};

  async stop(): Promise<void> {
    thisis.Monitoring = false;
    if (thismonitoring.Interval) {
      clear.Interval(thismonitoring.Interval);
      thismonitoring.Interval = null};

    loggerinfo('Performance Monitor stopped')};

  async measure.Agent(agent: Browser.Agent): Promise<Performance.Report> {
    loggerinfo(`Measuring performance for agent ${agentid}`);
    const start.Time = Date.now();
    const metrics: Performance.Metrics = {
      timestamp: start.Time;
      pageLoad.Time: 0;
      firstContentful.Paint: 0;
      largestContentful.Paint: 0;
      cumulativeLayout.Shift: 0;
      firstInput.Delay: 0;
      timeTo.Interactive: 0;
      totalBlocking.Time: 0;
      memory.Usage: {
        usedJSHeap.Size: 0;
        totalJSHeap.Size: 0;
        jsHeapSize.Limit: 0;
      };
      network.Requests: {
        total: 0;
        successful: 0;
        failed: 0;
        total.Size: 0;
        avgResponse.Time: 0;
      };
      errors: [];
    };
    try {
      // Navigate to the app and measure performance;
      await thisnavigateAnd.Measure(agent, metrics)// Collect Web Vitals;
      await thiscollectWeb.Vitals(agent, metrics)// Collect memory usage;
      await thiscollectMemory.Usage(agent, metrics)// Collect network metrics;
      await thiscollectNetwork.Metrics(agent, metrics)// Store metrics;
      const agent.Metrics = thismetricsget(agentid) || [];
      agent.Metricspush(metrics);
      thismetricsset(agentid, agent.Metrics)// Generate performance report;
      const report: Performance.Report = {
        agent.Id: agentid;
        browser: agentbrowser;
        viewport: agentviewport;
        metrics;
        benchmarks: thisgenerate.Benchmarks(metrics);
      };
      loggerinfo(
        `Performance measurement complete for agent ${agentid}: Score ${reportbenchmarksperformance.Score}`);
      return report} catch (error) {
      loggererror(Performance measurement failed for agent ${agentid}:`, error instanceof Error ? errormessage : String(error);
      metricserrorspush(error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
      return {
        agent.Id: agentid;
        browser: agentbrowser;
        viewport: agentviewport;
        metrics;
        benchmarks: {
          pageLoad.Grade: 'F';
          performance.Score: 0;
          recommendations: ['Fix critical errors before performance optimization'];
        }}}};

  private async navigateAnd.Measure(
    agent: Browser.Agent;
    metrics: Performance.Metrics): Promise<void> {
    const start.Time = Date.now();
    if (agenttype === 'puppeteer') {
      const page = agentpage as Page// Enable performance monitoring;
      await pagesetCache.Enabled(false)// Navigate to the app;
      await pagegoto(thisbase.Url, { wait.Until: 'networkidle0' })// Measure page load time;
      metricspageLoad.Time = Date.now() - start.Time} else {
      const page = agentpage as Playwright.Page// Navigate to the app;
      await pagegoto(thisbase.Url, { wait.Until: 'networkidle' })// Measure page load time;
      metricspageLoad.Time = Date.now() - start.Time}};

  private async collectWeb.Vitals(agent: Browser.Agent, metrics: Performance.Metrics): Promise<void> {
    try {
      if (agenttype === 'puppeteer') {
        const page = agentpage as Page// Collect performance metrics from the browser;
        const performance.Metrics: any = await pageevaluate(() => {
          return new Promise((resolve) => {
            // Use Performance Observer AP.I to collect Web Vitals;
            const vitals: any = {}// Get paint timings;
            const paint.Entries = performancegetEntriesBy.Type('paint');
            paintEntriesfor.Each((entry) => {
              if (entryname === 'first-contentful-paint') {
                vitalsfirstContentful.Paint = entrystart.Time}})// Get LC.P using Performance Observer;
            try {
              const observer = new Performance.Observer((list) => {
                const entries = listget.Entries();
                if (entrieslength > 0) {
                  vitalslargestContentful.Paint = entries[entrieslength - 1]start.Time}});
              observerobserve({ entry.Types: ['largest-contentful-paint'] })} catch (e) {
              // LC.P not supported in this browser}// Get navigation timing;
            const navigation = performancegetEntriesBy.Type(
              'navigation')[0] as PerformanceNavigation.Timing;
            if (navigation) {
              vitalstimeTo.Interactive = navigationdom.Interactive - navigationfetch.Start}// Get memory usage if available;
            if ('memory' in performance) {
              vitalsmemory.Usage = (performance as any)memory};
;
            resolve(vitals)})})// Update metrics with collected data;
        if (performanceMetricsfirstContentful.Paint) {
          metricsfirstContentful.Paint = performanceMetricsfirstContentful.Paint};
        if (performanceMetricslargestContentful.Paint) {
          metricslargestContentful.Paint = performanceMetricslargestContentful.Paint};
        if (performanceMetricstimeTo.Interactive) {
          metricstimeTo.Interactive = performanceMetricstimeTo.Interactive};
        if (performanceMetricsmemory.Usage) {
          metricsmemory.Usage = performanceMetricsmemory.Usage}} else {
        const page = agentpage as Playwright.Page// Collect performance metrics from Playwright;
        const performance.Metrics: any = await pageevaluate(() => {
          const vitals: any = {}// Get paint timings;
          const paint.Entries = performancegetEntriesBy.Type('paint');
          paintEntriesfor.Each((entry) => {
            if (entryname === 'first-contentful-paint') {
              vitalsfirstContentful.Paint = entrystart.Time}})// Get navigation timing;
          const navigation = performancegetEntriesBy.Type(
            'navigation')[0] as PerformanceNavigation.Timing;
          if (navigation) {
            vitalstimeTo.Interactive = navigationdom.Interactive - navigationfetch.Start}// Get memory usage if available;
          if ('memory' in performance) {
            vitalsmemory.Usage = (performance as any)memory};
;
          return vitals})// Update metrics with collected data;
        if (performanceMetricsfirstContentful.Paint) {
          metricsfirstContentful.Paint = performanceMetricsfirstContentful.Paint};
        if (performanceMetricstimeTo.Interactive) {
          metricstimeTo.Interactive = performanceMetricstimeTo.Interactive};
        if (performanceMetricsmemory.Usage) {
          metricsmemory.Usage = performanceMetricsmemory.Usage}}} catch (error) {
      loggererror('Failed to collect Web Vitals:', error instanceof Error ? errormessage : String(error) metricserrorspush(
        `Web Vitals collection failed: ${error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)`);
    }};

  private async collectMemory.Usage(
    agent: Browser.Agent;
    metrics: Performance.Metrics): Promise<void> {
    try {
      if (agenttype === 'puppeteer') {
        const page = agentpage as Page// Get memory usage from the browser;
        const memory.Usage = await pageevaluate(() => {
          if ('memory' in performance) {
            return (performance as any)memory};
          return null});
        if (memory.Usage) {
          metricsmemory.Usage = memory.Usage}} else {
        const page = agentpage as Playwright.Page// Get memory usage from Playwright;
        const memory.Usage = await pageevaluate(() => {
          if ('memory' in performance) {
            return (performance as any)memory};
          return null});
        if (memory.Usage) {
          metricsmemory.Usage = memory.Usage}}} catch (error) {
      loggererror('Failed to collect memory usage:', error instanceof Error ? errormessage : String(error) metricserrorspush(
        `Memory usage collection failed: ${error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)`);
    }};

  private async collectNetwork.Metrics(
    agent: Browser.Agent;
    metrics: Performance.Metrics): Promise<void> {
    try {
      if (agenttype === 'puppeteer') {
        const page = agentpage as Page// Get network metrics from the browser;
        const network.Metrics = await pageevaluate(() => {
          const resource.Entries = performancegetEntriesBy.Type('resource');
          const total = resource.Entrieslength;
          let successful = 0;
          let failed = 0;
          let total.Size = 0;
          let totalResponse.Time = 0;
          resourceEntriesfor.Each((entry) => {
            const resource = entry as PerformanceResource.Timing;
            if (resourcetransfer.Size !== undefined) {
              total.Size += resourcetransfer.Size};

            const response.Time = resourceresponse.End - resourcerequest.Start;
            if (response.Time > 0) {
              totalResponse.Time += response.Time;
              successful++} else {
              failed++}});
          return {
            total;
            successful;
            failed;
            total.Size;
            avgResponse.Time: successful > 0 ? totalResponse.Time / successful : 0;
          }});
        metricsnetwork.Requests = network.Metrics} else {
        const page = agentpage as Playwright.Page// Get network metrics from Playwright;
        const network.Metrics = await pageevaluate(() => {
          const resource.Entries = performancegetEntriesBy.Type('resource');
          const total = resource.Entrieslength;
          let successful = 0;
          let failed = 0;
          let total.Size = 0;
          let totalResponse.Time = 0;
          resourceEntriesfor.Each((entry) => {
            const resource = entry as PerformanceResource.Timing;
            if (resourcetransfer.Size !== undefined) {
              total.Size += resourcetransfer.Size};

            const response.Time = resourceresponse.End - resourcerequest.Start;
            if (response.Time > 0) {
              totalResponse.Time += response.Time;
              successful++} else {
              failed++}});
          return {
            total;
            successful;
            failed;
            total.Size;
            avgResponse.Time: successful > 0 ? totalResponse.Time / successful : 0;
          }});
        metricsnetwork.Requests = network.Metrics}} catch (error) {
      loggererror('Failed to collect network metrics:', error instanceof Error ? errormessage : String(error) metricserrorspush(
        `Network metrics collection failed: ${error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)`);
    }};

  private generate.Benchmarks(metrics: Performance.Metrics): Performance.Report['benchmarks'] {
    const recommendations: string[] = [];
    let score = 100// Analyze page load time;
    if (metricspageLoad.Time > 3000) {
      score -= 20;
      recommendationspush(
        'Page load time is too slow (>3s). Consider optimizing bundle size and lazy loading.')} else if (metricspageLoad.Time > 1000) {
      score -= 10;
      recommendationspush('Page load time could be improved (<1s is optimal).')}// Analyze First Contentful Paint;
    if (metricsfirstContentful.Paint > 2000) {
      score -= 15;
      recommendationspush(
        'First Contentful Paint is too slow (>2s). Optimize critical rendering path.')} else if (metricsfirstContentful.Paint > 1000) {
      score -= 5;
      recommendationspush('First Contentful Paint could be improved (<1s is optimal).')}// Analyze Largest Contentful Paint;
    if (metricslargestContentful.Paint > 4000) {
      score -= 20;
      recommendationspush(
        'Largest Contentful Paint is too slow (>4s). Optimize images and critical resources.')} else if (metricslargestContentful.Paint > 2500) {
      score -= 10;
      recommendationspush('Largest Contentful Paint could be improved (<2.5s is optimal).')}// Analyze memory usage;
    if (metricsmemoryUsageusedJSHeap.Size > 50 * 1024 * 1024) {
      // 50M.B;
      score -= 15;
      recommendationspush('High memory usage detected (>50M.B). Check for memory leaks.')} else if (metricsmemoryUsageusedJSHeap.Size > 25 * 1024 * 1024) {
      // 25M.B;
      score -= 5;
      recommendationspush('Memory usage is moderate (>25M.B). Consider optimization.')}// Analyze network requests;
    if (metricsnetwork.Requestsfailed > 0) {
      score -= 25;
      recommendationspush(
        `${metricsnetwork.Requestsfailed} network requests failed. Check AP.I connectivity.`)};

    if (metricsnetworkRequestsavgResponse.Time > 1000) {
      score -= 15;
      recommendationspush(
        'Average AP.I response time is slow (>1s). Optimize backend performance.')} else if (metricsnetworkRequestsavgResponse.Time > 500) {
      score -= 5;
      recommendationspush('Average AP.I response time could be improved (<500ms is optimal).')}// Add errors penalty;
    if (metricserrorslength > 0) {
      score -= metricserrorslength * 10;
      recommendationspush(`${metricserrorslength} errors detected. Fix critical issues first.`)}// Ensure score is within bounds;
    score = Math.max(0, Math.min(100, score))// Determine grade;
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';
    return {
      pageLoad.Grade: grade;
      performance.Score: score;
      recommendations;
    }};

  private async collectSystem.Metrics(): Promise<void> {
    try {
      // Test AP.I health;
      const response = await fetchWith.Timeout(`${thisapi.Url}/health`, { timeout: 30000 });
      const health.Data = await responsejson()// Test AP.I performance;
      const apiStart.Time = Date.now();
      await fetch(`${thisapi.Url}/api/stats`, {
        headers: {
          'X-AP.I-Key': process.envDEV_API_KE.Y || '';
          'X-A.I-Service': 'local-ui';
        }});
      const apiResponse.Time = Date.now() - apiStart.Time;
      loggerdebug(
        `System metrics - AP.I Health: ${health.Datastatus}, Response Time: ${apiResponse.Time}ms`)} catch (error) {
      loggererror('Failed to collect system metrics:', error instanceof Error ? errormessage : String(error)  }};

  async run.Checks(): Promise<unknown> {
    const start.Time = Date.now();
    try {
      // Check U.I availability;
      const ui.Response = await fetchWith.Timeout(thisbase.Url, { timeout: 30000 });
      const ui.Available = ui.Responseok// Check AP.I availability;
      const api.Response = await fetchWith.Timeout(`${thisapi.Url}/health`, { timeout: 30000 });
      const api.Health = await api.Responsejson();
      const api.Available = api.Healthstatus === 'healthy'// Check AP.I performance;
      const apiStart.Time = Date.now();
      await fetch(`${thisapi.Url}/api/stats`, {
        headers: {
          'X-AP.I-Key': process.envDEV_API_KE.Y || '';
          'X-A.I-Service': 'local-ui';
        }});
      const apiResponse.Time = Date.now() - apiStart.Time;
      const checks = {
        duration: Date.now() - start.Time;
        ui: {
          available: ui.Available;
          url: thisbase.Url};
        api: {
          available: api.Available;
          response.Time: apiResponse.Time;
          url: thisapi.Url;
        };
        overall: ui.Available && api.Available;
      };
      loggerinfo(
        `Performance checks complete: U.I=${ui.Available}, AP.I=${api.Available}, Response Time=${apiResponse.Time}ms`);
      return checks} catch (error) {
      loggererror('Performance checks failed:', error instanceof Error ? errormessage : String(error);
      return {
        duration: Date.now() - start.Time;
        ui: { available: false, url: thisbase.Url };
        api: { available: false, response.Time: -1, url: thisapi.Url };
        overall: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
      }}};

  get.Metrics(agent.Id?: string): Performance.Metrics[] {
    if (agent.Id) {
      return thismetricsget(agent.Id) || []}// Return all metrics;
    const all.Metrics: Performance.Metrics[] = [];
    for (const agent.Metrics of thismetricsvalues()) {
      all.Metricspush(.agent.Metrics)};
    return all.Metrics};

  clear.Metrics(agent.Id?: string): void {
    if (agent.Id) {
      thismetricsdelete(agent.Id)} else {
      thismetricsclear()}};

  generate.Report(): string {
    const all.Metrics = thisget.Metrics();
    if (all.Metricslength === 0) {
      return 'No performance metrics available'};

    const avgPageLoad.Time =
      all.Metricsreduce((sum, m) => sum + mpageLoad.Time, 0) / all.Metricslength;
    const avgMemory.Usage =
      all.Metricsreduce((sum, m) => sum + mmemoryUsageusedJSHeap.Size, 0) / all.Metricslength;
    const total.Errors = all.Metricsreduce((sum, m) => sum + merrorslength, 0);
    return ``;
Performance Report:
- Average Page Load Time: ${avgPageLoadTimeto.Fixed(2)}ms- Average Memory Usage: ${(avgMemory.Usage / 1024 / 1024)to.Fixed(2)}M.B- Total Errors: ${total.Errors}- Metrics Collected: ${all.Metricslength}- Agents Monitored: ${thismetricssize};
    `trim();`}};
