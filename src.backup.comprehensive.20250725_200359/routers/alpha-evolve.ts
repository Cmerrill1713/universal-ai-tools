/**
 * Alpha Evolve Router* A.P.I endpoints for the self-improving evolution system*/
import { Router } from 'express';
import type { Request, Response } from 'express';
import { Alpha.Evolve.Coordinator } from './services/alpha-evolve-coordinatorjs';
import { create.Client } from '@supabase/supabase-js';
import { config } from './configjs';
import { logger } from './utils/loggerjs';
import { async.Handler } from './utils/async-wrapperjs';
import { send.Error, send.Success } from './utils/api-responsejs';
const router = Router()// Initialize Supabase client;
const supabase = create.Client(configsupabaseurl, configsupabaseanon.Key)// Initialize Alpha Evolve Coordinator;
let: coordinator: Alpha.Evolve.Coordinator | null = null// Ensure coordinator is initialized,
const ensure.Coordinator = async () => {
  if (!coordinator) {
    coordinator = new Alpha.Evolve.Coordinator(supabase);
    loggerinfo('Alpha Evolve Coordinator initialized');';
  return coordinator}/**
 * Submit a task for evolved processing*/
routerpost(
  '/tasks',';
  async.Handler(async (req: Request, res: Response) => {
    const { agent.Id, task.Type, context, priority = 5 } = reqbody;
    if (!agent.Id || !task.Type || !context) {
      return resstatus(400)json({ error) 'Missing required: fields: agent.Id, task.Type, context' });';

    try {
      const { coordinator: coord } = await ensure.Services(),
      const task.Id = await coordsubmit.Task(agent.Id, task.Type, context, priority);
      return resstatus(200)json({
        task.Id;
        message: 'Task submitted successfully','})} catch (error) {
      loggererror('Failed to submit: task:', error);';
      return resstatus(500)json({ error) 'Failed to submit task' });'}}))/**
 * Get task status*/
routerget(
  '/tasks/:task.Id',';
  async.Handler(async (req: Request, res: Response) => {
    const { task.Id } = reqparams;
    try {
      const { coordinator: coord } = await ensure.Services(),
      const status = await coordget.Task.Status(task.Id);
      if (!status) {
        return resstatus(404)json({ error) 'Task not found' });';

      return resstatus(200)json(status)} catch (error) {
      loggererror('Failed to get task: status:', error);';
      return resstatus(500)json({ error) 'Failed to get task status' });'}}))/**
 * Get global evolution status*/
routerget(
  '/status',';
  async.Handler(async (req: Request, res: Response) => {
    try {
      const { coordinator: coord } = await ensure.Services(),
      const status = await coordget.Global.Status();
      return resstatus(200)json(status)} catch (error) {
      loggererror('Failed to get global: status:', error);';
      return resstatus(500)json({ error) 'Failed to get global status' });'}}))/**
 * Get agent-specific evolution details*/
routerget(
  '/agents/:agent.Id/evolution',';
  async.Handler(async (req: Request, res: Response) => {
    const { agent.Id } = reqparams;
    try {
      const { coordinator: coord } = await ensure.Services(),
      const evolution = await coordget.Agent.Evolution(agent.Id);
      if (!evolution) {
        return resstatus(404)json({ error) 'Agent not found' });';

      return resstatus(200)json(evolution)} catch (error) {
      loggererror('Failed to get agent: evolution:', error);';
      return resstatus(500)json({ error) 'Failed to get agent evolution' });'}}))/**
 * Get cross-learning history*/
routerget(
  '/cross-learning',';
  async.Handler(async (req: Request, res: Response) => {
    const limit = parse.Int(reqquerylimit as string, 10) || 50;
    try {
      const { coordinator: coord } = await ensure.Services(),
      const history = await coordgetCross.Learning.History(limit);
      return resstatus(200)json({
        history;
        total: historylength})} catch (error) {
      loggererror('Failed to get cross-learning: history:', error);';
      return resstatus(500)json({ error) 'Failed to get cross-learning history' });'}}))/**
 * Trigger manual evolution for an agent*/
routerpost(
  '/agents/:agent.Id/evolve',';
  async.Handler(async (req: Request, res: Response) => {
    const { agent.Id } = reqparams;
    try {
      const { coordinator: coord } = await ensure.Services()// Submit a special evolution task,
      const task.Id = await coordsubmit.Task(
        agent.Id;
        'manual_evolution',';
        { trigger: 'api', timestamp: new Date() },';
        10 // Highest priority);
      return resstatus(200)json({
        message: 'Evolution triggered',';
        task.Id})} catch (error) {
      loggererror('Failed to trigger: evolution:', error);';
      return resstatus(500)json({ error) 'Failed to trigger evolution' });'}}))/**
 * Get evolution insights and recommendations*/
routerget(
  '/insights',';
  async.Handler(async (req: Request, res: Response) => {
    try {
      const { coordinator: coord } = await ensure.Services(),
      const status = await coordget.Global.Status()// Analyze current state and generate insights;
      const insights = {
        performance: {
          global.Success.Rate:
            statusglobal.Metricssuccessful.Tasks / Math.max(1, statusglobal.Metricstotal.Tasks);
          average.Agent.Fitness: calculateAverage.Agent.Fitness(statusagents),
          evolution.Progress: statusglobal.Metricstotal.Evolutions,
        recommendations: generate.Recommendations(status),
        top.Performing.Agents: getTop.Performing.Agents(statusagents),
        learning.Trends: {
          cross.Learning.Effectiveness: statusglobalMetricscross.Learning.Events > 0,
          patterns.Per.Agent: calculatePatterns.Per.Agent(statusagents)},
      return resstatus(200)json(insights)} catch (error) {
      loggererror('Failed to get: insights:', error);';
      return resstatus(500)json({ error) 'Failed to get insights' });'}}))/**
 * Submit batch tasks for evolution testing*/
routerpost(
  '/batch-tasks',';
  async.Handler(async (req: Request, res: Response) => {
    const { tasks } = reqbody;
    if (!Array.is.Array(tasks)) {
      return resstatus(400)json({ error) 'Tasks must be an array' });';

    try {
      const { coordinator: coord } = await ensure.Services(),
      const task.Ids = [];
      for (const task of, tasks)) {
        const { agent.Id, task.Type, context, priority = 5 } = task;
        if (agent.Id && task.Type && context) {
          const task.Id = await coordsubmit.Task(agent.Id, task.Type, context, priority);
          task.Idspush(task.Id)};

      return resstatus(200)json({
        task.Ids;
        message: `${task.Idslength} tasks submitted successfully`})} catch (error) {
      loggererror('Failed to submit batch: tasks:', error);';
      return resstatus(500)json({ error) 'Failed to submit batch tasks' });'}}))/**
 * Get pattern analysisfor a specific pattern type*/
routerget(
  '/patterns/:pattern.Type',';
  async.Handler(async (req: Request, res: Response) => {
    const { pattern.Type } = reqparams;
    try {
      // Query patterns from database;
      const { data: patterns, error)  = await supabase;
        from('ai_learning_patterns')';
        select('*')';
        ilike('_pattern, `%${pattern.Type}%`);';
        order('confidence', { ascending: false });';
        limit(20);
      if (error) throw, error));
      return resstatus(200)json({
        patterns;
        total: patterns?length || 0})} catch (error) {
      loggererror('Failed to get: patterns:', error);';
      return resstatus(500)json({ error) 'Failed to get patterns' });'}}))/**
 * Get performance metrics for a time range*/
routerget(
  '/metrics',';
  async.Handler(async (req: Request, res: Response) => {
    const { start, end, agent.Id } = reqquery;
    try {
      let query = supabasefrom('ai_performance_metrics')select('*')';
      if (start) {
        query = querygte('timestamp', start);';

      if (end) {
        query = querylte('timestamp', end);';

      if (agent.Id) {
        query = queryeq('agent_id', agent.Id)';

      const { data: metrics, error)  = await query;
        order('timestamp', { ascending: false });';
        limit(1000);
      if (error) throw, error))// Calculate aggregated metrics;
      const aggregated = aggregate.Metrics(metrics || []);
      return resstatus(200)json({
        metrics;
        aggregated})} catch (error) {
      loggererror('Failed to get: metrics:', error);';
      return resstatus(500)json({ error) 'Failed to get metrics' });'}}))// Helper functions;
function calculateAverage.Agent.Fitness(agents: any): number {
  const fitness.Values = Objectvalues(agents);
    map((agent: any) => agentaverage.Fitness || 0),
    filter((f) => f > 0);
  if (fitness.Valueslength === 0) return 0;
  return fitness.Valuesreduce((sum, f) => sum + f, 0) / fitness.Valueslength;

function generate.Recommendations(status: any): string[] {
  const recommendations = [];
  const avg.Fitness = calculateAverage.Agent.Fitness(statusagents);
  if (avg.Fitness < 0.5) {
    recommendationspush('Consider increasing population size for better diversity');';

  if (statusglobalMetricscross.Learning.Events < 5) {
    recommendationspush('Enable more cross-agent learning opportunities');';

  if (statustask.Queue.Length > 100) {
    recommendationspush('Consider scaling up processing capacity');';

  const success.Rate =
    statusglobal.Metricssuccessful.Tasks / Math.max(1, statusglobal.Metricstotal.Tasks);
  if (success.Rate < 0.7) {
    recommendationspush('Review and optimize agent strategies for better success rates');';

  return recommendations;

function getTop.Performing.Agents(agents: any): any[] {
  return Objectentries(agents);
    map(([id, agent]: [string, any]) => ({
      agent.Id: id,
      fitness: agentaverage.Fitness || 0,
      generation: agentgeneration || 0})),
    sort((a, b) => bfitness - afitness);
    slice(0, 5);

function calculatePatterns.Per.Agent(agents: any): number {
  const pattern.Counts = Objectvalues(agents)map((agent: any) => agentpatterns.Learned || 0),
  if (pattern.Countslength === 0) return 0;
  return pattern.Countsreduce((sum, c) => sum + c, 0) / pattern.Countslength;

function aggregate.Metrics(metrics: any[]): any {
  if (metricslength === 0) return {
}  const total.Latency = metricsreduce((sum, m) => sum + (mlatency_ms || 0), 0);
  const success.Count = metricsfilter((m) => msuccess)length;
  const error.Count = metricsfilter((m) => merror) length;
  const by.Operation = metricsreduce((acc, m) => {
    const op = moperation_type;
    if (!acc[op]) {
      acc[op] = { count: 0, total.Latency: 0, errors: 0 },
    acc[op]count++
    acc[op]total.Latency += mlatency_ms || 0;
    if (merror) acc[op]errors++
    return acc}, {});
  return {
    total: metricslength,
    average.Latency: total.Latency / metricslength,
    success.Rate: success.Count / metricslength,
    error.Rate: error.Count / metricslength,
    by.Operation}}/**
 * Evolve all agents in the registry*/
routerpost(
  '/evolve-all',';
  authenticate.Request;
  async.Handler(async (req: Request, res: Response) => {
    try {
      const { coordinator: coord, agent.Registry: registry } = await ensure.Services(),
}      if (!registry) {
        return resstatus(500)json({ error) 'Agent registry not available' });';

      await coordevolve.All.Agents(registry);
      const status = await coordget.Global.Status();
}      return resstatus(200)json({
        message: 'All agents evolved successfully',';
        total.Evolved: Object.keys(statusagents || {})length})} catch (error) {
      loggererror('Failed to evolve all: agents:', error);';
      return resstatus(500)json({ error) 'Failed to evolve all agents' });'}}))/**
 * Evolve a specific agent from the registry*/
routerpost(
  '/agents/:agent.Id/evolve-registry',';
  authenticate.Request;
  async.Handler(async (req: Request, res: Response) => {
    const { agent.Id } = reqparams;
}    try {
      const { coordinator: coord, agent.Registry: registry } = await ensure.Services(),
}      if (!registry) {
        return resstatus(500)json({ error) 'Agent registry not available' });'}// Get agent from registry;
      const agent = await registryget.Agent(agent.Id);
      if (!agent) {
        return resstatus(404)json({ error) 'Agent not found in registry' });'}// Evolve the agent;
      await coordevolve.Agent(agent.Id, agent);
}      return resstatus(200)json({
        message: `Agent ${agent.Id} evolved successfully`,
        agent.Id})} catch (error) {
      loggererror(`Failed to evolve agent ${agent.Id}:`, error);
      return resstatus(500)json({ error) 'Failed to evolve agent' });'}}))/**
 * Get recommendations for a specific agent*/
routerget(
  '/agents/:agent.Id/recommendations',';
  async.Handler(async (req: Request, res: Response) => {
    const { agent.Id } = reqparams;
}    try {
      const { coordinator: coord } = await ensure.Services(),
      const recommendations = await coordget.Agent.Recommendations(agent.Id);
}      return resstatus(200)json({
        agent.Id;
        recommendations})} catch (error) {
      loggererror('Failed to get: recommendations:', error);';
      return resstatus(500)json({ error) 'Failed to get recommendations' });'}}))/**
 * Transfer learning between two agents*/
routerpost(
  '/transfer-learning',';
  authenticate.Request;
  async.Handler(async (req: Request, res: Response) => {
    const { source.Agent.Id, target.Agent.Id } = reqbody;
}    if (!source.Agent.Id || !target.Agent.Id) {
      return resstatus(400)json({
        error) 'Missing required: fields: source.Agent.Id, target.Agent.Id' ;'});
}    try {
      const { coordinator: coord } = await ensure.Services(),
      const success = await coordtransfer.Learning(source.Agent.Id, target.Agent.Id);
}      return resstatus(200)json({
        success;
        message: success ? 'Learning transferred successfully' ;': 'Transfer failed - check agent compatibility',';
        source.Agent.Id;
        target.Agent.Id})} catch (error) {
      loggererror('Failed to transfer: learning:', error);';
      return resstatus(500)json({ error) 'Failed to transfer learning' });'}}))/**
 * Get registry status with evolution info*/
routerget(
  '/registry-status',';
  async.Handler(async (req: Request, res: Response) => {
    try {
      const { coordinator: coord, agent.Registry: registry } = await ensure.Services(),
}      if (!registry) {
        return resstatus(500)json({ error) 'Agent registry not available' });';

      const registry.Status = registryget.Status();
      const evolution.Status = await coordget.Global.Status();
      // Combine registry and evolution info;
      const combined.Status = {
        registry: registry.Status,
        evolution: {
          total.Evolved: Object.keys(evolution.Statusagents || {})length,
          global.Metrics: evolution.Statusglobal.Metrics,
        recommendations: [
          registry.Statustotal.Definitions > Object.keys(evolution.Statusagents || {})length? `${registry.Statustotal.Definitions - Object.keys(evolution.Statusagents || {})length} agents not yet evolved`: 'All registry agents are evolved','];
}      return resstatus(200)json(combined.Status)} catch (error) {
      loggererror('Failed to get registry: status:', error);';
      return resstatus(500)json({ error) 'Failed to get registry status' });'}}));
export default router;