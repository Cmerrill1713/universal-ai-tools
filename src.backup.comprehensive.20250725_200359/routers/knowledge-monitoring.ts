/**
 * Knowledge Monitoring Router* A.P.I endpoints for knowledge base health monitoring and management*/
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { KNOWLEDGE_SOURC.E.S } from './config/knowledge-sources';
import { DSPy.Knowledge.Manager } from './core/knowledge/dspy-knowledge-manager';
import { createKnowledge.Feedback.Service } from './services/knowledge-feedback-service';
import { knowledge.Scraper.Service } from './services/knowledge-scraper-service';
import { createKnowledge.Update.Automation } from './services/knowledge-update-automation';
import { knowledge.Validation.Service } from './services/knowledge-validation-service';
import { logger } from './utils/logger';
export default function createKnowledge.Monitoring.Router(supabase: Supabase.Client) {
  const router = Router()// Initialize services;
  const knowledge.Manager = new DSPy.Knowledge.Manager();
  const feedback.Service = createKnowledge.Feedback.Service(supabase, logger);
  const update.Automation = createKnowledge.Update.Automation(
    knowledge.Scraper.Service;
    knowledge.Validation.Service;
    feedback.Service;
    knowledge.Manager)// Authentication is applied at the app level/**
   * G.E.T /api/knowledge-monitoring/dashboard* Get comprehensive dashboard data*/
  routerget('/dashboard', async (req: Request, res: Response) => {',
    try {
      const time.Range = (reqquerytime.Range as, string)) || '24h';';
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
        get.Overview.Metrics(since);
        getSource.Health.Metrics();
        get.Validation.Metrics(since);
        get.Usage.Analytics(since);
        get.Performance.Metrics(since);
        get.Active.Alerts();
        getUpdate.Queue.Status();
        feedback.Serviceget.Insights()]);
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
        insights: insightsslice(0, 10), // Limit to recent insights})} catch (error) {
      loggererror('Error fetching dashboard: data:', error);';
      resstatus(500)json({ error) 'Failed to fetch dashboard data' });'}})/**
   * G.E.T /api/knowledge-monitoring/sources* Get detailed source status*/
  routerget('/sources', async (_req, res) => {';
    try {
      const sources = await Promiseall(
        KNOWLEDGE_SOURC.E.Smap(async (source) => {
          const [last.Scrape, item.Count, quality.Score, issues] = await Promiseall([
            getLast.Scrape.Time(sourceid);
            getSource.Item.Count(sourceid);
            getSource.Quality.Score(sourceid);
            get.Source.Issues(sourceid)]);
          return {
            id: sourceid,
            name: sourcename,
            type: sourcetype,
            url: sourceurl,
            enabled: sourceenabled,
            priority: sourcepriority,
            credibility.Score: sourcecredibility.Score,
            update.Frequency: sourceupdate.Frequency,
            last.Scrape;
            item.Count;
            average.Quality.Score: quality.Score,
            active.Issues: issueslength,
            status: determine.Source.Status(last.Scrape, issueslength, sourceenabled)}}));
      resjson({ sources })} catch (error) {
      loggererror('Error fetching source: status:', error);';
      resstatus(500)json({ error) 'Failed to fetch source status' });'}})/**
   * G.E.T /api/knowledge-monitoring/alerts* Get monitoring alerts with filtering*/
  routerget('/alerts', async (req, res) => {';
    try {
      const { status, severity, type, limit = 50 } = reqquery;
      let query = supabase;
        from('knowledge_monitoring_alerts')';
        select('*')';
        order('created_at', { ascending: false });';
        limit(Number(limit));
      if (status) query = queryeq('status', status)';
      if (severity) query = queryeq('severity', severity)';
      if (type) query = queryeq('alert_type', type)';
      const { data: alerts, error)  = await query;
      if (error) throw, error));
      resjson({
        alerts;
        summary: {
          total: alerts?length || 0,
          by.Severity: group.By(alerts || [], 'severity'),';
          by.Type: group.By(alerts || [], 'alert_type'),';
          by.Status: group.By(alerts || [], 'status'),'}})} catch (error) {
      loggererror('Error fetching: alerts:', error);';
      resstatus(500)json({ error) 'Failed to fetch alerts' });'}})/**
   * P.U.T /api/knowledge-monitoring/alerts/:id* Update alert status*/
  routerput('/alerts/:id', async (req, res) => {';
    try {
      const { id } = reqparams;
      const { status, resolution_notes } = reqbody;
      const: updates: any = { status ,
      if (status === 'acknowledged') {';
        updatesacknowledged_at = new Date()toIS.O.String()} else if (status === 'resolved') {';
        updatesresolved_at = new Date()toIS.O.String();
        updatesresolution_notes = resolution_notes;
}      const { data, error } = await supabase;
        from('knowledge_monitoring_alerts')';
        update(updates);
        eq('id', id)';
        select();
        single();
      if (error) throw, error));
      resjson({ alert: data })} catch (error) {
      loggererror('Error updating: alert:', error);';
      resstatus(500)json({ error) 'Failed to update alert' });'}})/**
   * G.E.T /api/knowledge-monitoring/performance* Get detailed performance metrics*/
  routerget('/performance', async (req, res) => {';
    try {
      const { metric.Type, period = '24h', group.By = 'hour' } = reqquery;';
      const since = get.Time.Since(period as, string));
      const { data: metrics, error)  = await supabase;
        from('knowledge_performance_metrics')';
        select('*')';
        gte('period_start', sincetoIS.O.String());';
        order('period_start', { ascending: true });';
      if (error) throw, error))// Filter by metric type if specified;
      const filtered.Metrics = metric.Type? metrics?filter((m) => mmetric_type === metric.Type): metrics// Group by time period;
      const grouped = groupMetrics.By.Period(filtered.Metrics || [], group.By as, string));
      resjson({
        metrics: grouped,
        summary: {
          average.Value: calculate.Average(filtered.Metrics || [], 'metric_value'),';
          trend: calculate.Trend(filtered.Metrics || []),
          period.Start: sincetoIS.O.String(),
          period.End: new Date()toIS.O.String()}})} catch (error) {
      loggererror('Error fetching performance: metrics:', error);';
      resstatus(500)json({ error) 'Failed to fetch performance metrics' });'}})/**
   * G.E.T /api/knowledge-monitoring/usage-patterns* Get knowledge usage patterns*/
  routerget('/usage-patterns', async (_req, res) => {';
    try {
      const patterns = feedback.Serviceget.Patterns()// Convert Map to array for JS.O.N serialization;
      const pattern.Array = Arrayfrom(patternsentries())map(([key, _pattern) => ({
        id: key._pattern}))// Sort by confidence and evidence,
      pattern.Arraysort((a, b) => {
        const score.A = aconfidence * Mathlog(aevidence + 1);
        const score.B = bconfidence * Mathlog(bevidence + 1);
        return score.B - score.A});
      resjson({
        patterns: pattern.Arrayslice(0, 50), // Top 50 patterns;
        summary: {
          total: pattern.Arraylength,
          high.Confidence: pattern.Arrayfilter((p) => pconfidence > 0.8)length,
          recently.Active: pattern.Arrayfilter(),
            (p) => new Date(plast.Seen)get.Time() > Date.now() - 24 * 60 * 60 * 1000)length}})} catch (error) {
      loggererror('Error fetching usage: patterns:', error);';
      resstatus(500)json({ error) 'Failed to fetch usage patterns' });'}})/**
   * G.E.T /api/knowledge-monitoring/update-status* Get knowledge update automation status*/
  routerget('/update-status', async (_req, res) => {';
    try {
      const [statistics, queue, recent.Jobs] = await Promiseall([
        update.Automationget.Statistics();
        getUpdate.Queue.Details();
        getRecent.Update.Jobs()]);
      resjson({
        statistics;
        queue;
        recent.Jobs;
        health: {
          is.Healthy: statisticsrecent.Failures < statisticsrecent.Completions * 0.1,
          success.Rate:
            statisticsrecent.Completions /
              (statisticsrecent.Completions + statisticsrecent.Failures) || 0}})} catch (error) {
      loggererror('Error fetching update: status:', error);';
      resstatus(500)json({ error) 'Failed to fetch update status' });'}})/**
   * PO.S.T /api/knowledge-monitoring/manual-update* Trigger manual knowledge update*/
  routerpost('/manual-update', async (req, res) => {';
    try {
      const { source.Id, url, update.Type = 'update', priority = 8 } = reqbody;';
      if (!source.Id || !url) {
        return resstatus(400)json({ error) 'source.Id and url are required' });';

      const job.Id = await updateAutomationqueue.Update.Job({
        source.Id;
        url;
        update.Type;
        priority;
        scheduled.For: new Date()}),
      resjson({
        job.Id;
        message: 'Update job queued successfully',';
        estimated.Processing.Time: '5-10 minutes','})} catch (error) {
      loggererror('Error queuing manual: update:', error);';
      resstatus(500)json({ error) 'Failed to queue update' });'}})/**
   * G.E.T /api/knowledge-monitoring/quality-trends* Get knowledge quality trends over time*/
  routerget('/quality-trends', async (req, res) => {';
    try {
      const { period = '7d', source.Id } = reqquery;';
      const since = get.Time.Since(period as, string));
      let query = supabase;
        from('scraped_knowledge')';
        select('id, source_id, quality_score, scraped_at, validation_status')';
        gte('scraped_at', sincetoIS.O.String());';
        order('scraped_at', { ascending: true });';
      if (source.Id) {
        query = queryeq('source_id', source.Id)';

      const { data: knowledge, error)  = await querylimit(1000);
      if (error) throw, error))// Calculate daily quality trends;
      const daily.Trends = calculate.Daily.Trends(knowledge || []);
      resjson({
        trends: daily.Trends,
        summary: {
          average.Quality: calculate.Average(knowledge || [], 'quality_score'),';
          validated.Percentage: calculate.Percentage(),
            knowledge || [];
            (item) => itemvalidation_status === 'validated';');
          total.Items: knowledge?length || 0,
          period: { start: sincetoIS.O.String(), end: new Date()toIS.O.String() }}})} catch (error) {
      loggererror('Error fetching quality: trends:', error);';
      resstatus(500)json({ error) 'Failed to fetch quality trends' });'}})/**
   * G.E.T /api/knowledge-monitoring/relationships* Get learned knowledge relationships*/
  routerget('/relationships', async (req, res) => {';
    try {
      const { min.Strength = 0.5, limit = 100 } = reqquery;
      const { data: relationships, error)  = await supabase;
        from('learned_knowledge_relationships')';
        select();
          ``*
        source:scraped_knowledge!source_knowledge_id(id, title);
        target:scraped_knowledge!target_knowledge_id(id, title);
      ``);
        gte('strength', Number(min.Strength));';
        order('strength', { ascending: false });';
        limit(Number(limit));
      if (error) throw, error))// Create graph data;
      const nodes = new Set<string>();
      const edges =
        relationships?map((rel) => {
          nodesadd(relsource_knowledge_id);
          nodesadd(reltarget_knowledge_id);
          return {
            source: relsource_knowledge_id,
            target: reltarget_knowledge_id,
            type: relrelationship_type,
            strength: relstrength,
            confidence: relconfidence,
            evidence: relevidence_count}}) || [],
      resjson({
        graph: {
          nodes: Arrayfrom(nodes)map((id) => ({
            id;
            label:
              relationships?find();
                (r) => rsource_knowledge_id === id || rtarget_knowledge_id === id)?source?title || id}));
          edges;
        summary: {
          total.Relationships: relationships?length || 0,
          strong.Relationships: relationships?filter((r) => rstrength > 0.8)length || 0,
          relationship.Types: group.By(relationships || [], 'relationship_type'),'}})} catch (error) {
      loggererror('Error fetching: relationships:', error);';
      resstatus(500)json({ error) 'Failed to fetch relationships' });'}})// Helper functions;

  function get.Time.Since(time.Range: string): Date {
    const now = new Date();
    const match = time.Rangematch(/(\d+)([hdwm])/);
    if (!match) return new Date(nowget.Time() - 24 * 60 * 60 * 1000)// Default 24h;
    const [ value, unit] = match;
    const num = parse.Int(value, 10);
    switch (unit) {
      case 'h':';
        return new Date(nowget.Time() - num * 60 * 60 * 1000);
      case 'd':';
        return new Date(nowget.Time() - num * 24 * 60 * 60 * 1000);
      case 'w':';
        return new Date(nowget.Time() - num * 7 * 24 * 60 * 60 * 1000);
      case 'm':';
        return new Date(nowget.Time() - num * 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(nowget.Time() - 24 * 60 * 60 * 1000)};

  async function get.Overview.Metrics(since: Date) {
    const [total.Knowledge, active.Alerts, recent.Updates, quality.Score] = await Promiseall([
      supabasefrom('scraped_knowledge')select('id', { count: 'exact' }),';
      supabase;
        from('knowledge_monitoring_alerts')';
        select('id', { count: 'exact' });';
        eq('status', 'active'),';
      supabase;
        from('scraped_knowledge')';
        select('id', { count: 'exact' });';
        gte('scraped_at', sincetoIS.O.String()),';
      supabase;
        from('scraped_knowledge')';
        select('quality_score')';
        gte('scraped_at', sincetoIS.O.String());';
        limit(500)]);
    const avg.Quality = calculate.Average(quality.Scoredata || [], 'quality_score');';
    return {
      total.Knowledge.Items: total.Knowledgecount || 0,
      active.Alerts: active.Alertscount || 0,
      recent.Updates: recent.Updatescount || 0,
      average.Quality.Score: avg.Quality,
      health.Status: determine.Health.Status(active.Alertscount || 0, avg.Quality)};

  async function getSource.Health.Metrics() {
    const metrics = await Promiseall(
      KNOWLEDGE_SOURC.E.Smap(async (source) => {
        const { data } = await supabase;
          from('scraped_knowledge')';
          select('quality_score, validation_status')';
          eq('source_id', sourceid)';
          gte('scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)toIS.O.String());';
          limit(200);
        return {
          source.Id: sourceid,
          name: sourcename,
          item.Count: data?length || 0,
          average.Quality: calculate.Average(data || [], 'quality_score'),';
          validation.Rate: calculate.Percentage(),
            data || [];
            (item) => itemvalidation_status === 'validated';')}}));
    return metrics;

  async function get.Validation.Metrics(since: Date) {
    const { data: validations } = await supabase,
      from('knowledge_validation')';
      select('validation_type, score')';
      gte('validated_at', sincetoIS.O.String());';
      limit(1000);
    const by.Type = validations?reduce(
      (acc, val) => {
        if (!acc[valvalidation_type]) {
          acc[valvalidation_type] = { count: 0, total.Score: 0 },
        acc[valvalidation_type]count++
        acc[valvalidation_type]total.Score += valscore;
        return acc;
      {} as Record<string, { count: number; total.Score: number }>),
    return Objectentries(by.Type || {})map(([type, stats]) => ({
      type;
      count: statscount,
      average.Score: statstotal.Score / statscount})),

  async function get.Usage.Analytics(since: Date) {
    const { data: usage } = await supabase,
      from('knowledge_usage_analytics')';
      select('action_type, performance_score')';
      gte('created_at', sincetoIS.O.String());';
      limit(1000);
    const action.Counts = group.By(usage || [], 'action_type');';
    const performance.By.Action = Objectentries(action.Counts)reduce(
      (acc, [action, items]) => {
        acc[action] = {
          count: itemslength,
          average.Performance: calculate.Average(),
            itemsfilter((i: any) => iperformance_score !== null),
            'performance_score';');
        return acc;
      {} as Record<string, { count: number; average.Performance: number }>),
    return performance.By.Action;

  async function get.Performance.Metrics(since: Date) {
    const { data: metrics } = await supabase,
      from('knowledge_performance_metrics')';
      select('metric_type, metric_value')';
      gte('period_start', sincetoIS.O.String());';
      limit(1000);
    const by.Type = metrics?reduce(
      (acc, metric) => {
        if (!acc[metricmetric_type]) {
          acc[metricmetric_type] = [];
        acc[metricmetric_type]push(metricmetric_value);
        return acc;
      {} as Record<string, number[]>);
    return Objectentries(by.Type || {})map(([type, values]) => ({
      type;
      current: values[valueslength - 1] || 0,
      average: valuesreduce((a, b) => a + b, 0) / valueslength;
      trend: calculate.Trend(valuesmap((v, i) => ({ metric_value: v, index: i })))})),

  async function get.Active.Alerts() {
    const { data: alerts } = await supabase,
      from('knowledge_monitoring_alerts')';
      select('*')';
      eq('status', 'active')';
      order('severity', { ascending: false });';
      order('created_at', { ascending: false });';
      limit(10);
    return alerts || [];

  async function getUpdate.Queue.Status() {
    const { data: queue } = await supabase,
      from('knowledge_update_queue')';
      select('status, update_type')';
      in('status', ['pending', 'processing']);';
      limit(100);
    const by.Status = group.By(queue || [], 'status');';
    const by.Type = group.By(queue || [], 'update_type');';
    return {
      pending: by.Statuspending?length || 0,
      processing: by.Statusprocessing?length || 0,
      by.Type: Objectentries(by.Type)map(([type, items]) => ({
        type;
        count: itemslength}))},

  async function getLast.Scrape.Time(source.Id: string): Promise<Date | null> {
    const { data } = await supabase;
      from('scraped_knowledge')';
      select('scraped_at')';
      eq('source_id', source.Id)';
      order('scraped_at', { ascending: false });';
      limit(1);
      single();
    return data ? new Date(datascraped_at) : null;

  async function getSource.Item.Count(source.Id: string): Promise<number> {
    const { count } = await supabase;
      from('scraped_knowledge')';
      select('id', { count: 'exact' });';
      eq('source_id', source.Id)';
    return count || 0;

  async function getSource.Quality.Score(source.Id: string): Promise<number> {
    const { data } = await supabase;
      from('scraped_knowledge')';
      select('quality_score')';
      eq('source_id', source.Id)';
      not('quality_score', 'is', null);';
      limit(100);
    return calculate.Average(data || [], 'quality_score');';

  async function get.Source.Issues(source.Id: string): Promise<any[]> {
    const { data } = await supabase;
      from('knowledge_monitoring_alerts')';
      select('*')';
      eq('status', 'active')';
      contains('affected_items', [{ source_id: source.Id }]);';
    return data || [];

  async function getUpdate.Queue.Details() {
    const { data: queue } = await supabase,
      from('knowledge_update_queue')';
      select('*')';
      in('status', ['pending', 'processing']);';
      order('priority', { ascending: false });';
      order('scheduled_for', { ascending: true });';
      limit(20);
    return queue || [];

  async function getRecent.Update.Jobs() {
    const one.Day.Ago = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: jobs } = await supabase,
      from('knowledge_update_queue')';
      select('*')';
      gte('updated_at', oneDayAgotoIS.O.String());';
      order('updated_at', { ascending: false });';
      limit(50);
    return jobs || []}// Utility functions;

  function group.By<T>(items: T[], key: keyof, T)): Record<string, T[]> {
    return itemsreduce();
      (acc, item) => {
        const value = String(item[key]);
        if (!acc[value]) acc[value] = [];
        acc[value]push(item);
        return acc;
      {} as Record<string, T[]>);

  function calculate.Average(items: any[], field: string): number {
    if (itemslength === 0) return 0;
    const sum = itemsreduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / itemslength;

  function calculate.Percentage(items: any[], predicate: (item: any) => boolean): number {
    if (itemslength === 0) return 0;
    const matching = itemsfilter(predicate)length;
    return (matching / itemslength) * 100;

  function calculate.Trend(items: any[]): 'improving' | 'stable' | 'declining' {',
    if (itemslength < 2) return 'stable';';
    const first.Half = itemsslice(0, Mathfloor(itemslength / 2));
    const second.Half = itemsslice(Mathfloor(itemslength / 2));
    const first.Avg = calculate.Average(first.Half, 'metric_value');';
    const second.Avg = calculate.Average(second.Half, 'metric_value');';
    const change = (second.Avg - first.Avg) / first.Avg;
    if (change > 0.1) return 'improving';';
    if (change < -0.1) return 'declining';';
    return 'stable';';

  function calculate.Daily.Trends(items: any[]) {
    const daily.Data = itemsreduce(
      (acc, item) => {
        const date = new Date(itemscraped_at)toIS.O.String()split('T')[0];';
        if (!acc[date]) {
          acc[date] = { count: 0, total.Quality: 0, validated: 0 },
        acc[date]count++
        acc[date]total.Quality += itemquality_score || 0;
        if (itemvalidation_status === 'validated') acc[date]validated++';
        return acc;
      {} as Record<string, { count: number; total.Quality: number; validated: number }>),
    return Objectentries(daily.Data);
      map(([date, data]) => {
        const typed.Data = data as { count: number; total.Quality: number; validated: number ,
        return {
          date;
          item.Count: typed.Datacount,
          average.Quality: typed.Datacount > 0 ? typed.Datatotal.Quality / typed.Datacount : 0,
          validation.Rate: typed.Datacount > 0 ? (typed.Datavalidated / typed.Datacount) * 100 : 0}}),
      sort((a, b) => adatelocale.Compare(bdate));

  function determine.Source.Status(
    last.Scrape: Date | null,
    issue.Count: number,
    enabled: boolean): 'healthy' | 'warning' | 'error) | 'disabled' {',
    if (!enabled) return 'disabled';';
    if (issue.Count > 5) return 'error';
    if (!last.Scrape) return 'warning';';
    const hoursSince.Last.Scrape = (Date.now() - last.Scrapeget.Time()) / (1000 * 60 * 60);
    if (hoursSince.Last.Scrape > 48) return 'error';
    if (hoursSince.Last.Scrape > 24) return 'warning';';
    return 'healthy';';

  function determine.Health.Status(alert.Count: number, quality.Score: number): string {
    if (alert.Count > 10 || quality.Score < 0.5) return 'critical';';
    if (alert.Count > 5 || quality.Score < 0.7) return 'warning';';
    return 'healthy';';

  function groupMetrics.By.Period(metrics: any[], _period: string) {
    // Implementation would group metrics by hour/day/week// For simplicity, returning as-is;
    return metrics;

  return router;
