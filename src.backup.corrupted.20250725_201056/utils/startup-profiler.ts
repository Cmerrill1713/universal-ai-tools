/**
 * Startup Profiler - Track server initialization progress and identify bottlenecks*/

import { Log.Context, logger } from './enhanced-logger';
interface Startup.Step {
  name: string,
  start.Time: number,
  end.Time?: number;
  status: 'pending' | 'success' | 'failed' | 'timeout',
  error?: string;
  duration?: number;
}  export class Startup.Profiler {
  private static instance: Startup.Profiler,
  private steps: Map<string, Startup.Step> = new Map();
  private start.Time: number = Date.now(),
  private timeout.Ms = 30000// 30 second global timeout;
  static get.Instance(): Startup.Profiler {
    if (!Startup.Profilerinstance) {
      Startup.Profilerinstance = new Startup.Profiler();
  return Startup.Profilerinstance;
  start.Step(name: string): void {
    const step: Startup.Step = {
      name;
      start.Time: Date.now(),
      status: 'pending',
}    thisstepsset(name, step);
    loggerinfo());
      `🔄 [START.U.P] Starting: ${name} (${thisget.Elapsed.Time()}ms total)`,
      LogContextSYST.E.M);
  complete.Step(name: string): void {
    const step = thisstepsget(name);
    if (step) {
      stepend.Time = Date.now();
      stepduration = stepend.Time - stepstart.Time;
      stepstatus = 'success';
      loggerinfo();
        `✅ [START.U.P] Completed: ${name} (${stepduration}ms, ${thisget.Elapsed.Time()}ms total)`;
        LogContextSYST.E.M)};
  fail.Step(name: string, error instanceof Error ? error.message : String(error) string): void {
    const step = thisstepsget(name);
    if (step) {
      stepend.Time = Date.now();
      stepduration = stepend.Time - stepstart.Time;
      stepstatus = 'failed';
      steperror instanceof Error ? error.message : String(error)  error;
      loggererror`❌ [START.U.P] Failed: ${name} (${stepduration}ms)`, LogContextSYST.E.M, {
        error})};
  timeout.Step(name: string): void {
    const step = thisstepsget(name);
    if (step) {
      stepend.Time = Date.now();
      stepduration = stepend.Time - stepstart.Time;
      stepstatus = 'timeout';
      loggerwarn(`⏰ [START.U.P] Timeout: ${name)} (${stepduration}ms)`, LogContextSYST.E.M)};
  get.Elapsed.Time(): number {
    return Date.now() - thisstart.Time;
  is.Global.Timeout(): boolean {
    return thisget.Elapsed.Time() > thistimeout.Ms;
  async with.Timeout<T>(name: string, promise: Promise<T>, timeout.Ms = 5000): Promise<T | null> {
    thisstart.Step(name);
    try {
      const result = await Promiserace([);
        promise;
        new Promise<null>((_, reject) => set.Timeout(() => reject(new Error('Timeout')), timeout.Ms))]);
      thiscomplete.Step(name);
      return result} catch (error) {
      if (error instanceof Error && error.message === 'Timeout') {
        thistimeout.Step(name)} else {
        thisfail.Step(name, error instanceof Error ? error.message : String(error instanceof Error ? error.message : String(error)));
}  return null};
  get.Summary(): {
    total.Time: number,
    steps: Startup.Step[],
    slowest.Steps: Startup.Step[],
    failed.Steps: Startup.Step[]} {
    const step.Array = Arrayfrom(thisstepsvalues());
    const completed.Steps = step.Arrayfilter((s) => sduration !== undefined);
    const slowest.Steps = completed.Steps;
      sort((a, b) => (bduration || 0) - (aduration || 0));
      slice(0, 5);
    const failed.Steps = step.Arrayfilter((s) => sstatus === 'failed' || sstatus === 'timeout');
    return {
      total.Time: thisget.Elapsed.Time(),
      steps: step.Array,
      slowest.Steps;
      failed.Steps;
    };
  print.Summary(): void {
    const summary = thisget.Summary();
    loggerinfo('\n📊 [START.U.P] Summary:', LogContextSYST.E.M, {
      total.Time: summarytotal.Time,
      steps.Completed: summarystepsfilter((s) => sstatus === 'success')length,
      steps.Failed: summaryfailed.Stepslength}),
    if (summaryslowest.Stepslength > 0) {
      loggerinfo('\n🐌 Slowest steps:', LogContextPERFORMAN.C.E, {
        slowest.Steps: summaryslowest.Stepsmap((step, i) => ({
          rank: i + 1,
          name: stepname,
          duration: stepduration}))}),
  if (summaryfailed.Stepslength > 0) {
      loggererror('\n❌ Failed steps:', LogContextSYST.E.M, {
        failed.Steps: summaryfailed.Stepsmap((step) => ({
          name: stepname,
          error instanceof Error ? error.message : String(error) steperror instanceof Error ? error.message : String(error)| 'Unknown error instanceof Error ? error.message : String(error)}))})}};
  export const startup.Profiler = Startup.Profilerget.Instance();