/**
 * Startup Profiler - Track server initialization progress and identify bottlenecks*/

import { Log.Context, logger } from './enhanced-logger';
interface Startup.Step {
  name: string;
  start.Time: number;
  end.Time?: number;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  error?: string;
  duration?: number;
};
  export class Startup.Profiler {
  private static instance: Startup.Profiler;
  private steps: Map<string, Startup.Step> = new Map();
  private start.Time: number = Date.now();
  private timeout.Ms = 30000// 30 second global timeout;
  static get.Instance(): Startup.Profiler {
    if (!Startup.Profilerinstance) {
      Startup.Profilerinstance = new Startup.Profiler()};
  return Startup.Profilerinstance};
  start.Step(name: string): void {
    const step: Startup.Step = {
      name;
      start.Time: Date.now();
      status: 'pending';
    };
    thisstepsset(name, step);
    loggerinfo());
      `🔄 [STARTU.P] Starting: ${name} (${thisgetElapsed.Time()}ms total)`;
      LogContextSYSTE.M)};
  complete.Step(name: string): void {
    const step = thisstepsget(name);
    if (step) {
      stepend.Time = Date.now();
      stepduration = stepend.Time - stepstart.Time;
      stepstatus = 'success';
      loggerinfo();
        `✅ [STARTU.P] Completed: ${name} (${stepduration}ms, ${thisgetElapsed.Time()}ms total)`;
        LogContextSYSTE.M)}};
  fail.Step(name: string, error instanceof Error ? errormessage : String(error) string): void {
    const step = thisstepsget(name);
    if (step) {
      stepend.Time = Date.now();
      stepduration = stepend.Time - stepstart.Time;
      stepstatus = 'failed';
      steperror instanceof Error ? errormessage : String(error)  error;
      loggererror`❌ [STARTU.P] Failed: ${name} (${stepduration}ms)`, LogContextSYSTE.M, {
        error})}};
  timeout.Step(name: string): void {
    const step = thisstepsget(name);
    if (step) {
      stepend.Time = Date.now();
      stepduration = stepend.Time - stepstart.Time;
      stepstatus = 'timeout';
      loggerwarn(`⏰ [STARTU.P] Timeout: ${name)} (${stepduration}ms)`, LogContextSYSTE.M)}};
  getElapsed.Time(): number {
    return Date.now() - thisstart.Time};
  isGlobal.Timeout(): boolean {
    return thisgetElapsed.Time() > thistimeout.Ms};
  async with.Timeout<T>(name: string, promise: Promise<T>, timeout.Ms = 5000): Promise<T | null> {
    thisstart.Step(name);
    try {
      const result = await Promiserace([);
        promise;
        new Promise<null>((_, reject) => set.Timeout(() => reject(new Error('Timeout')), timeout.Ms))]);
      thiscomplete.Step(name);
      return result} catch (error) {
      if (error instanceof Error && errormessage === 'Timeout') {
        thistimeout.Step(name)} else {
        thisfail.Step(name, error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)));
      };
  return null}};
  get.Summary(): {
    total.Time: number;
    steps: Startup.Step[];
    slowest.Steps: Startup.Step[];
    failed.Steps: Startup.Step[]} {
    const step.Array = Arrayfrom(thisstepsvalues());
    const completed.Steps = step.Arrayfilter((s) => sduration !== undefined);
    const slowest.Steps = completed.Steps;
      sort((a, b) => (bduration || 0) - (aduration || 0));
      slice(0, 5);
    const failed.Steps = step.Arrayfilter((s) => sstatus === 'failed' || sstatus === 'timeout');
    return {
      total.Time: thisgetElapsed.Time();
      steps: step.Array;
      slowest.Steps;
      failed.Steps;
    }};
  print.Summary(): void {
    const summary = thisget.Summary();
    loggerinfo('\n📊 [STARTU.P] Summary:', LogContextSYSTE.M, {
      total.Time: summarytotal.Time;
      steps.Completed: summarystepsfilter((s) => sstatus === 'success')length;
      steps.Failed: summaryfailed.Stepslength});
    if (summaryslowest.Stepslength > 0) {
      loggerinfo('\n🐌 Slowest steps:', LogContextPERFORMANC.E, {
        slowest.Steps: summaryslowest.Stepsmap((step, i) => ({
          rank: i + 1;
          name: stepname;
          duration: stepduration}))})};
  if (summaryfailed.Stepslength > 0) {
      loggererror('\n❌ Failed steps:', LogContextSYSTE.M, {
        failed.Steps: summaryfailed.Stepsmap((step) => ({
          name: stepname;
          error instanceof Error ? errormessage : String(error) steperror instanceof Error ? errormessage : String(error)| 'Unknown error instanceof Error ? errormessage : String(error)}))})}}};
  export const startup.Profiler = StartupProfilerget.Instance();