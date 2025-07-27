/**
 * Task-Aware Temperature Controller* Dynamically adjusts temperature based on task type and performance metrics*/

import { logger } from './utils/logger';
import { Supabase.Service } from './supabase_service';
interface Temperature.Profile {
  task.Type: string,
  min.Temp: number,
  max.Temp: number,
  default.Temp: number,
  description: string,
}
interface Temperature.Adjustment {
  factor: string,
  adjustment: number,
  reason: string,
}
interface Task.Metrics {
  task.Type: string,
  success.Count: number,
  failure.Count: number,
  avg.Quality.Score: number,
  optimal.Temp: number,
  last.Updated: Date,
}
interface Generation.Params {
  temperature: number,
  top.P?: number;
  top.K?: number;
  repetition.Penalty?: number;
  presence.Penalty?: number;
  frequency.Penalty?: number;
}
export class Temperature.Controller {
  private supabase: Supabase.Service// Task-specific temperature profiles,
  private temperature.Profiles: Map<string, Temperature.Profile> = new Map([
    [
      'creative_writing';
      {
        task.Type: 'creative_writing',
        min.Temp: 0.7,
        max.Temp: 1.0,
        default.Temp: 0.85,
        description: 'High creativity for storytelling and creative content,
      }];
    [
      'code_generation';
      {
        task.Type: 'code_generation',
        min.Temp: 0.0,
        max.Temp: 0.3,
        default.Temp: 0.1,
        description: 'Low temperature for precise code generation',
      }];
    [
      'factual_qa';
      {
        task.Type: 'factual_qa',
        min.Temp: 0.0,
        max.Temp: 0.2,
        default.Temp: 0.1,
        description: 'Very low temperature for accurate factual responses',
      }];
    [
      'brainstorming';
      {
        task.Type: 'brainstorming',
        min.Temp: 0.6,
        max.Temp: 0.9,
        default.Temp: 0.75,
        description: 'High temperature for diverse idea generation',
      }];
    [
      '_analysis;
      {
        task.Type: '_analysis,
        min.Temp: 0.2,
        max.Temp: 0.4,
        default.Temp: 0.3,
        description: 'Moderate temperature for balanced _analysis,
      }];
    [
      'translation';
      {
        task.Type: 'translation',
        min.Temp: 0.0,
        max.Temp: 0.2,
        default.Temp: 0.1,
        description: 'Low temperature for accurate translations',
      }];
    [
      'summarization';
      {
        task.Type: 'summarization',
        min.Temp: 0.1,
        max.Temp: 0.3,
        default.Temp: 0.2,
        description: 'Low-moderate temperature for concise summaries',
      }];
    [
      'conversation';
      {
        task.Type: 'conversation',
        min.Temp: 0.4,
        max.Temp: 0.7,
        default.Temp: 0.55,
        description: 'Moderate temperature for natural conversation',
      }];
    [
      'technical_documentation';
      {
        task.Type: 'technical_documentation',
        min.Temp: 0.1,
        max.Temp: 0.3,
        default.Temp: 0.2,
        description: 'Low temperature for precise technical writing',
      }];
    [
      'general';
      {
        task.Type: 'general',
        min.Temp: 0.3,
        max.Temp: 0.7,
        default.Temp: 0.5,
        description: 'Balanced temperature for general tasks',
      }]])// Task performance metrics;
  private task.Metrics: Map<string, Task.Metrics> = new Map()// A/B testing configurations;
  private ab.Test.Configs = {
    enabled: true,
    sample.Rate: 0.1, // 10% of requests participate in A/B testing;
    variation.Range: 0.1, // Test within ±0.1 of optimal temperature;
  constructor() {
    thissupabase = Supabase.Serviceget.Instance();
    thisload.Task.Metrics();
    loggerinfo('🌡️ Task-Aware Temperature Controller initialized')}/**
   * Get optimal generation parameters for a task*/
  public async get.Optimal.Params(
    task.Type: string,
    context?: {
      complexity?: 'low' | 'medium' | 'high';
      user.Preference?: number;
      previous.Attempts?: number;
      quality.Requirement?: 'speed' | 'balanced' | 'quality';
    }): Promise<Generation.Params> {
    // Get base temperature profile;
    const profile = thisget.Temperature.Profile(task.Type);
    let temperature = profiledefault.Temp// Apply adjustments based on context;
    const adjustments: Temperature.Adjustment[] = []// Complexity adjustment,
    if (context?complexity) {
      const complexity.Adjustment = thisget.Complexity.Adjustment(contextcomplexity, task.Type);
      temperature += complexity.Adjustmentadjustment;
      adjustmentspush(complexity.Adjustment)}// User preference override;
    if (context?user.Preference !== undefined) {
      const user.Adjustment = thisgetUser.Preference.Adjustment(contextuser.Preference, profile);
      temperature = user.Adjustmentadjustment;
      adjustmentspush({
        factor: 'user_preference',
        adjustment: user.Adjustmentadjustment - profiledefault.Temp,
        reason: 'User-specified temperature preference'})}// Previous attempts adjustment (increase temp for retries),
    if (context?previous.Attempts && contextprevious.Attempts > 0) {
      const retry.Adjustment = thisget.Retry.Adjustment(contextprevious.Attempts);
      temperature += retry.Adjustmentadjustment;
      adjustmentspush(retry.Adjustment)}// Quality vs speed trade-off;
    if (context?quality.Requirement) {
      const quality.Adjustment = thisget.Quality.Adjustment(contextquality.Requirement, task.Type);
      temperature += quality.Adjustmentadjustment;
      adjustmentspush(quality.Adjustment)}// Apply learned optimizations;
    const learned.Temp = await thisget.Learned.Temperature(task.Type);
    if (learned.Temp !== null) {
      const diff = learned.Temp - temperature;
      if (Mathabs(diff) > 0.05) {
        temperature = temperature + diff * 0.5// Blend learned and calculated;
        adjustmentspush({
          factor: 'learned_optimization',
          adjustment: diff * 0.5,
          reason: `Applied learned optimization from ${thistask.Metricsget(task.Type)?success.Count || 0} successful generations`})}}// Ensure temperature is within bounds,
    temperature = Math.max(profilemin.Temp, Math.min(profilemax.Temp, temperature))// A/B testing variation;
    if (thisshouldRunA.B.Test()) {
      const variation = thisgetAB.Test.Variation(temperature, profile);
      adjustmentspush({
        factor: 'ab_testing',
        adjustment: variation - temperature,
        reason: 'A/B test variation for optimization'}),
      temperature = variation}// Calculate complementary parameters;
    const params = thiscalculate.Complementary.Params(temperature, task.Type);
    loggerinfo(
      `🎯 Temperature optimized for ${task.Type}: ${temperatureto.Fixed(3)} ` +
        `(${adjustmentslength} adjustments applied)`);
    return params}/**
   * Get temperature profile for task type*/
  private get.Temperature.Profile(task.Type: string): Temperature.Profile {
    // Check for exact match;
    if (thistemperature.Profileshas(task.Type)) {
      return thistemperature.Profilesget(task.Type)!}// Check for partial match;
    const lower.Task.Type = taskTypeto.Lower.Case();
    for (const [key, profile] of thistemperature.Profilesentries()) {
      if (lower.Task.Type.includes(key) || key.includes(lower.Task.Type)) {
        return profile}}// Default to general profile;
    return thistemperature.Profilesget('general')!}/**
   * Get complexity-based adjustment*/
  private get.Complexity.Adjustment(
    complexity: 'low' | 'medium' | 'high',
    task.Type: string): Temperature.Adjustment {
    const adjustments = {
      low: -0.05,
      medium: 0,
      high: 0.05}// Inverse for creative tasks (higher complexity needs more creativity),
    if (['creative_writing', 'brainstorming']includes(task.Type)) {
      adjustmentslow = 0.05;
      adjustmentshigh = -0.05;
}    return {
      factor: 'complexity',
      adjustment: adjustments[complexity],
      reason: `${complexity} complexity adjustment`}}/**
   * Get user preference adjustment*/
  private getUser.Preference.Adjustment(
    user.Preference: number,
    profile: Temperature.Profile): { adjustment: number } {
    // Clamp to profile bounds;
    return {
      adjustment: Math.max(profilemin.Temp, Math.min(profilemax.Temp, user.Preference))}}/**
   * Get retry adjustment (increase temperature for variety)*/
  private get.Retry.Adjustment(attempts: number): Temperature.Adjustment {
    const adjustment = Math.min(0.1, attempts * 0.02), // +0.02 per retry, max +0.1;
    return {
      factor: 'retry',
      adjustment;
      reason: `Retry attempt #${attempts} - increasing variety`}}/**
   * Get quality vs speed adjustment*/
  private get.Quality.Adjustment(
    requirement: 'speed' | 'balanced' | 'quality',
    task.Type: string): Temperature.Adjustment {
    const adjustments = {
      speed: -0.05, // Lower temp for faster, more deterministic output;
      balanced: 0,
      quality: 0.05, // Higher temp for more considered output}// Inverse for factual tasks;
    if (['factual_qa', 'code_generation', 'translation']includes(task.Type)) {
      adjustmentsspeed = 0;
      adjustmentsquality = -0.05, // Lower temp for higher quality in factual tasks;
}    return {
      factor: 'quality_requirement',
      adjustment: adjustments[requirement],
      reason: `Optimizing for ${requirement}`}}/**
   * Get learned temperature from historical performance*/
  private async get.Learned.Temperature(task.Type: string): Promise<number | null> {
    const metrics = thistask.Metricsget(task.Type);
    if (!metrics || metricssuccess.Count < 10) {
      return null// Not enough data;

    return metricsoptimal.Temp}/**
   * Calculate complementary parameters based on temperature*/
  private calculate.Complementary.Params(temperature: number, task.Type: string): Generation.Params {
    const params: Generation.Params = { temperature }// Top-p (nucleus sampling) - inverse relationship with temperature,
    paramstop.P = 0.95 - temperature * 0.2// Range: 0.75-0.95// Top-k - task-specific,
    if (['code_generation', 'factual_qa']includes(task.Type)) {
      paramstop.K = 10, // Very restrictive for factual tasks} else if (['creative_writing', 'brainstorming']includes(task.Type)) {
      paramstop.K = 50, // More options for creative tasks} else {
      paramstop.K = 30// Balanced}// Repetition penalty - higher for creative tasks;
    if (['creative_writing', 'brainstorming']includes(task.Type)) {
      paramsrepetition.Penalty = 1.15} else if (['code_generation']includes(task.Type)) {
      paramsrepetition.Penalty = 1.0, // No penalty for code (may need repetition)} else {
      paramsrepetition.Penalty = 1.1}// Presence and frequency penalties;
    if (temperature > 0.7) {
      paramspresence.Penalty = 0.1;
      paramsfrequency.Penalty = 0.1;
}    return params}/**
   * Should run A/B test for this request*/
  private shouldRunA.B.Test(): boolean {
    return thisab.Test.Configsenabled && Mathrandom() < thisabTest.Configssample.Rate}/**
   * Get A/B test temperature variation*/
  private getAB.Test.Variation(base.Temp: number, profile: Temperature.Profile): number {
    const variation = (Mathrandom() - 0.5) * 2 * thisabTest.Configsvariation.Range;
    const test.Temp = base.Temp + variation// Keep within profile bounds;
    return Math.max(profilemin.Temp, Math.min(profilemax.Temp, test.Temp))}/**
   * Record generation result for learning*/
  public async record.Result(
    task.Type: string,
    temperature: number,
    success: boolean,
    quality.Score?: number): Promise<void> {
    const profile.Key = thisget.Temperature.Profile(task.Type)task.Type;
    let metrics = thistask.Metricsget(profile.Key);
    if (!metrics) {
      metrics = {
        task.Type: profile.Key,
        success.Count: 0,
        failure.Count: 0,
        avg.Quality.Score: 0.7,
        optimal.Temp: thistemperature.Profilesget(profile.Key)!default.Temp,
        last.Updated: new Date(),
}      thistask.Metricsset(profile.Key, metrics)}// Update counts;
    if (success) {
      metricssuccess.Count++} else {
      metricsfailure.Count++}// Update quality score with exponential moving average;
    if (quality.Score !== undefined) {
      const alpha = 0.1// Learning rate;
      metricsavg.Quality.Score = alpha * quality.Score + (1 - alpha) * metricsavg.Quality.Score}// Update optimal temperature using gradient descent;
    if (success && quality.Score !== undefined) {
      const learning.Rate = 0.01;
      const gradient =
        (quality.Score - metricsavg.Quality.Score) * (temperature - metricsoptimal.Temp);
      metricsoptimal.Temp += learning.Rate * gradient// Keep within bounds;
      const profile = thistemperature.Profilesget(profile.Key)!
      metricsoptimal.Temp = Math.max(
        profilemin.Temp;
        Math.min(profilemax.Temp, metricsoptimal.Temp));

    metricslast.Updated = new Date()// Persist metrics;
    await thissave.Task.Metrics()}/**
   * Get temperature recommendations for all task types*/
  public get.Recommendations(): Array<{
    task.Type: string,
    description: string,
    recommended: number,
    range: { min: number, max: number ,
    learned?: number;
    performance?: {
      success.Rate: number,
      avg.Quality: number,
      total.Generations: number,
    }}> {
    const recommendations = [];
    for (const [task.Type, profile] of thistemperature.Profilesentries()) {
      const metrics = thistask.Metricsget(task.Type);
      const recommendation = {
        task.Type: profiletask.Type,
        description: profiledescription,
        recommended: profiledefault.Temp,
        range: { min: profilemin.Temp, max: profilemax.Temp ,
        learned: metrics?optimal.Temp,
        performance: undefined as any,
}      if (metrics) {
        const total = metricssuccess.Count + metricsfailure.Count;
        if (total > 0) {
          recommendationperformance = {
            success.Rate: metricssuccess.Count / total,
            avg.Quality: metricsavg.Quality.Score,
            total.Generations: total,
          }};

      recommendationspush(recommendation);
}    return recommendations}/**
   * Load task metrics from storage*/
  private async load.Task.Metrics(): Promise<void> {
    try {
      const { data, error } = await thissupabaseclientfrom('temperature_metrics')select('*');
      if (error instanceof Error ? error.message : String(error){
        loggererror('Failed to load temperature metrics:', error instanceof Error ? error.message : String(error);
        return;

      if (data) {
        datafor.Each((record) => {
          thistask.Metricsset(recordtask_type, {
            task.Type: recordtask_type,
            success.Count: recordsuccess_count,
            failure.Count: recordfailure_count,
            avg.Quality.Score: recordavg_quality_score,
            optimal.Temp: recordoptimal_temp,
            last.Updated: new Date(recordlast_updated)})})}} catch (error) {
      loggererror('Error loading temperature metrics:', error instanceof Error ? error.message : String(error)  }}/**
   * Save task metrics to storage*/
  private async save.Task.Metrics(): Promise<void> {
    try {
      const records = Arrayfrom(thistask.Metricsentries())map(([_, metrics]) => ({
        task_type: metricstask.Type,
        success_count: metricssuccess.Count,
        failure_count: metricsfailure.Count,
        avg_quality_score: metricsavg.Quality.Score,
        optimal_temp: metricsoptimal.Temp,
        last_updated: metricslastUpdatedtoIS.O.String()})),
      const { error instanceof Error ? error.message : String(error)  = await thissupabaseclient;
        from('temperature_metrics');
        upsert(records, { on.Conflict: 'task_type' }),
      if (error instanceof Error ? error.message : String(error){
        loggererror('Failed to save temperature metrics:', error instanceof Error ? error.message : String(error)  }} catch (error) {
      loggererror('Error saving temperature metrics:', error instanceof Error ? error.message : String(error)  }}/**
   * Singleton instance*/
  private static instance: Temperature.Controller,
  public static get.Instance(): Temperature.Controller {
    if (!Temperature.Controllerinstance) {
      Temperature.Controllerinstance = new Temperature.Controller();
    return Temperature.Controllerinstance};
