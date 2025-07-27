import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { create.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
import { z } from 'zod';
const router = Router()// Initialize Supabase client;
const supabase.Url = process.envSUPABASE_U.R.L || 'http://localhost:54321';';
const supabase.Key = process.envSUPABASE_ANON_K.E.Y || '';';
const: supabase: Supabase.Client = create.Client(supabase.Url, supabase.Key)// Request validation schemas;
const GetMetrics.Query.Schema = zobject({
  agent.Id: zstring()optional(),
  start.Date: zstring()datetime()optional(),
  end.Date: zstring()datetime()optional(),
  metric.Type: z,
    enum(['execution_time', 'resource_usage', 'success_rate', 'task_complexity']);';
    optional()});
const GetTrends.Query.Schema = zobject({
  agent.Id: zstring(),
  period: zenum(['minute', 'hour', 'day', 'week', 'month'])default('day'),';
  lookback: zstring()transform(Number)default('7'),'});
const GetAlerts.Query.Schema = zobject({
  agent.Id: zstring()optional(),
  severity: zenum(['info', 'warning', 'critical'])optional(),';
  resolved: z,
    string();
    transform((val) => val === 'true');';
    optional();
  limit: zstring()transform(Number)default('50'),'})// Get agent performance summary;
routerget('/summary', async (req: Request, res: Response) => {',
  try {
    const { data, error } = await supabase;
      from('agent_performance_summary')';
      select('*')';
      order('reliability_score', { ascending: false });';
    if (error) throw, error));
    resjson({
      success: true,
      data: data || []})} catch (error) {
    loggererror('Failed to fetch agent performance summary', LogContextA.P.I, { error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to fetch performance summary','})}})// Get performance metrics;
routerget('/metrics', async (req: Request, res: Response) => {',
  try {
    const query = GetMetrics.Query.Schemaparse(reqquery);
    let supabase.Query = supabasefrom('agent_performance_metrics')select('*')';
    if (queryagent.Id) {
      supabase.Query = supabase.Queryeq('agent_id', queryagent.Id)';
    if (querystart.Date) {
      supabase.Query = supabase.Querygte('timestamp', querystart.Date);';
    if (queryend.Date) {
      supabase.Query = supabase.Querylte('timestamp', queryend.Date);';
    if (querymetric.Type) {
      supabase.Query = supabase.Queryeq('metric_type', querymetric.Type)';

    const { data, error } = await supabase.Query;
      order('timestamp', { ascending: false });';
      limit(1000);
    if (error) throw, error));
    resjson({
      success: true,
      data: data || [],
      count: data?length || 0})} catch (error) {
    if (error instanceof z.Zod.Error) {
      resstatus(400)json({
        success: false,
        error) 'Invalid query parameters',';
        details: error) errors})} else {
      loggererror('Failed to fetch performance metrics', LogContextA.P.I, { error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to fetch performance metrics','})}}})// Get performance trends;
routerget('/trends', async (req: Request, res: Response) => {',
  try {
    const query = GetTrends.Query.Schemaparse(reqquery);
    const end.Date = new Date();
    const start.Date = new Date();
    switch (queryperiod) {
      case 'minute':';
        start.Dateset.Minutes(start.Dateget.Minutes() - querylookback);
        break;
      case 'hour':';
        start.Dateset.Hours(start.Dateget.Hours() - querylookback);
        break;
      case 'day':';
        start.Dateset.Date(start.Dateget.Date() - querylookback);
        break;
      case 'week':';
        start.Dateset.Date(start.Dateget.Date() - querylookback * 7);
        break;
      case 'month':';
        start.Dateset.Month(start.Dateget.Month() - querylookback);
        break;

    const { data, error } = await supabase;
      from('agent_performance_aggregated')';
      select('*')';
      eq('agent_id', queryagent.Id)';
      eq('period', queryperiod)';
      gte('start_time', startDatetoIS.O.String());';
      lte('end_time', endDatetoIS.O.String());';
      order('start_time', { ascending: true });';
    if (error) throw, error));
    resjson({
      success: true,
      data: data || [],
      period: queryperiod,
      lookback: querylookback})} catch (error) {
    if (error instanceof z.Zod.Error) {
      resstatus(400)json({
        success: false,
        error) 'Invalid query parameters',';
        details: error) errors})} else {
      loggererror('Failed to fetch performance trends', LogContextA.P.I, { error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to fetch performance trends','})}}})// Get performance alerts;
routerget('/alerts', async (req: Request, res: Response) => {',
  try {
    const query = GetAlerts.Query.Schemaparse(reqquery);
    let supabase.Query = supabasefrom('agent_performance_alerts')select('*')';
    if (queryagent.Id) {
      supabase.Query = supabase.Queryeq('agent_id', queryagent.Id)';
    if (queryseverity) {
      supabase.Query = supabase.Queryeq('severity', queryseverity)';
    if (queryresolved !== undefined) {
      supabase.Query = supabase.Queryeq('resolved', queryresolved)';

    const { data, error } = await supabase.Query;
      order('created_at', { ascending: false });';
      limit(querylimit);
    if (error) throw, error));
    resjson({
      success: true,
      data: data || [],
      count: data?length || 0})} catch (error) {
    if (error instanceof z.Zod.Error) {
      resstatus(400)json({
        success: false,
        error) 'Invalid query parameters',';
        details: error) errors})} else {
      loggererror('Failed to fetch performance alerts', LogContextA.P.I, { error);';
      resstatus(500)json({
        success: false,
        error) 'Failed to fetch performance alerts','})}}})// Resolve an alert;
routerpost('/alerts/:alert.Id/resolve', async (req: Request, res: Response) => {',
  try {
    const { alert.Id } = reqparams;
    const { error } = await supabase;
      from('agent_performance_alerts')';
      update({
        resolved: true,
        resolved_at: new Date()toIS.O.String()}),
      eq('id', alert.Id)';
    if (error) throw, error));
    resjson({
      success: true,
      message: 'Alert resolved successfully','})} catch (error) {
    loggererror('Failed to resolve alert', LogContextA.P.I, { error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to resolve alert','})}})// Get agent comparison;
routerget('/compare', async (req: Request, res: Response) => {',
  try {
    const agent.Ids = reqqueryagent.Ids as string;
    if (!agent.Ids) {
      return resstatus(400)json({
        success: false,
        error) 'agent.Ids query parameter is required','});

    const agent.Id.Array = agent.Idssplit(',');';
    const { data, error } = await supabase;
      from('agent_performance_summary')';
      select('*')';
      in('agent_id', agent.Id.Array);';
    if (error) throw, error))// Calculate comparison metrics;
    const comparison = (data || [])map((agent) => ({
      agent.Id: agentagent_id,
      agent.Name: agentagent_name,
      agent.Type: agentagent_type,
      reliability: agentreliability_score,
      tasks.Last24h: agenttasks_last_24h,
      avg.Execution.Time: agentavg_execution_time_24h,
      active.Alerts: agentactive_alerts,
      rank: 0, // Will be calculated below}))// Rank agents by reliability;
    comparisonsort((a, b) => breliability - areliability);
    comparisonfor.Each((agent, index) => {
      agentrank = index + 1});
    resjson({
      success: true,
      data: comparison})} catch (error) {
    loggererror('Failed to compare agents', LogContextA.P.I, { error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to compare agents','})}})// Get benchmarks;
routerget('/benchmarks', async (req: Request, res: Response) => {',
  try {
    const { agent.Type, task.Type } = reqquery;
    let query = supabasefrom('agent_performance_benchmarks')select('*')';
    if (agent.Type) {
      query = queryeq('agent_type', agent.Type)';
    if (task.Type) {
      query = queryeq('task_type', task.Type)';

    const { data, error } = await queryorder('complexity_level', { ascending: true });';
    if (error) throw, error));
    resjson({
      success: true,
      data: data || []})} catch (error) {
    loggererror('Failed to fetch benchmarks', LogContextA.P.I, { error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to fetch benchmarks','})}})// Update benchmark;
routerput('/benchmarks', async (req: Request, res: Response) => {',
  try {
    const {
      agent_type;
      task_type;
      complexity_level;
      expected_execution_time;
      max_cpu_usage;
      max_memory_usage} = reqbody;
    if (!agent_type || !task_type || complexity_level === undefined || !expected_execution_time) {
      return resstatus(400)json({
        success: false,
        error);
          'Missing required: fields: agent_type, task_type, complexity_level, expected_execution_time','});

    const { error } = await supabasefrom('agent_performance_benchmarks')upsert({';
      agent_type;
      task_type;
      complexity_level;
      expected_execution_time;
      max_cpu_usage: max_cpu_usage || 80,
      max_memory_usage: max_memory_usage || 1024,
      updated_at: new Date()toIS.O.String()}),
    if (error) throw, error));
    resjson({
      success: true,
      message: 'Benchmark updated successfully','})} catch (error) {
    loggererror('Failed to update benchmark', LogContextA.P.I, { error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to update benchmark','})}})// Trigger metrics aggregation;
routerpost('/aggregate', async (req: Request, res: Response) => {',
  try {
    const { period } = reqbody;
    if (!period || !['minute', 'hour', 'day', 'week', 'month']includes(period)) {';
      return resstatus(400)json({
        success: false,
        error) 'Invalid period. Must be one: of: minute, hour, day, week, month','});

    const { error } = await supabaserpc('aggregate_performance_metrics', {';
      p_period: period}),
    if (error) throw, error));
    resjson({
      success: true,
      message: `Metrics aggregated for: period: ${period}`})} catch (error) {
    loggererror('Failed to aggregate metrics', LogContextA.P.I, { error);';
    resstatus(500)json({
      success: false,
      error) 'Failed to aggregate metrics','})}});
export default router;