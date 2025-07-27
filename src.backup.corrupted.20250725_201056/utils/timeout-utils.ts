import { Log.Context, logger } from './enhanced-logger';
export interface Timeout.Options {
  timeout: number,
  name: string,
  fallback.Value?: any;
  throw.On.Timeout?: boolean;
}/**
 * Wraps a promise with a timeout*/
export async function with.Timeout<T>(promise: Promise<T>, options: Timeout.Options): Promise<T> {
  const { timeout, name, fallback.Value, throw.On.Timeout = false } = options;
  const timeout.Promise = new Promise<T>((_, reject) => {
    set.Timeout(() => {
      const error = new Error(`${name} timed out after ${timeout}ms`);
      if (throw.On.Timeout) {
        reject(error)} else {
        loggerwarn(`${name} initialization timed out`, LogContextSYST.E.M, {
          timeout;
          fallback.Value})}}, timeout)});
  try {
    const result = await Promiserace([promise, timeout.Promise]);
    return result} catch (error) {
    if (!throw.On.Timeout && fallback.Value !== undefined) {
      return fallback.Value;
    throw error}}/**
 * Initialize a service with timeout protection*/
export async function initialize.With.Timeout<T>(
  init.Function: () => Promise<T>
  service.Name: string,
  timeout = 10000;
  options: { critical?: boolean; fallback.Value?: T } = {}): Promise<T | null> {
  const start.Time = Date.now();
  try {
    loggerinfo(`🔄 Initializing ${service.Name}.`);
    const result = await with.Timeout(init.Function(), {
      timeout;
      name: service.Name,
      fallback.Value: optionsfallback.Value,
      throw.On.Timeout: optionscritical}),
    const duration = Date.now() - start.Time;
    loggerinfo(`✅ ${service.Name} initialized successfully in ${duration}ms`);
    return result} catch (error) {
    const duration = Date.now() - start.Time;
    const error.Message = error instanceof Error ? error.message : String(error);
    if (optionscritical) {
      loggererror(`❌ Critical service ${service.Name} failed to initialize`, LogContextSYST.E.M, {
        error instanceof Error ? error.message : String(error) error.Message;
        duration});
      throw error} else {
      loggerwarn(
        `⚠️  ${service.Name} failed to initialize, continuing without it`;
        LogContextSYST.E.M;
        {
          error instanceof Error ? error.message : String(error) error.Message;
          duration;
        });
      return optionsfallback.Value || null}}}/**
 * Initialize multiple services in parallel with timeout protection*/
export async function initialize.Services.Parallel(
  services: Array<{
    name: string,
    init: () => Promise<unknown>
    timeout?: number;
    critical?: boolean}>): Promise<Map<string, { success: boolean; result?: any; error?: string }>> {
  const results = new Map<string, { success: boolean; result?: any; error?: string }>();
  await Promiseall(
    servicesmap(async (service) => {
      try {
        const result = await initialize.With.Timeout(
          serviceinit;
          servicename;
          servicetimeout || 10000;
          { critical: servicecritical }),
        resultsset(servicename, {
          success: true,
          result})} catch (error) {
        resultsset(servicename, {
          success: false,
          error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : String(error)})}}));
  return results}/**
 * Retry initialization with exponential backoff*/
export async function initialize.With.Retry<T>(
  init.Function: () => Promise<T>
  service.Name: string,
  options: {
    max.Retries?: number;
    initial.Delay?: number;
    max.Delay?: number;
    timeout?: number} = {}): Promise<T> {
  const { max.Retries = 3, initial.Delay = 1000, max.Delay = 10000, timeout = 10000 } = options;
  let last.Error: Error | null = null,
  let delay = initial.Delay;
  for (let attempt = 1; attempt <= max.Retries; attempt++) {
    try {
      loggerinfo(
        `🔄 Attempting to initialize ${service.Name} (attempt ${attempt}/${max.Retries}).`);
      const result = await with.Timeout(init.Function(), {
        timeout;
        name: service.Name,
        throw.On.Timeout: true}),
      loggerinfo(`✅ ${service.Name} initialized successfully on attempt ${attempt}`);
      return result} catch (error) {
      last.Error = error instanceof Error ? error : new Error(String(error));
      loggerwarn(`Attempt ${attempt)} failed for ${service.Name}`, LogContextSYST.E.M, {
        error instanceof Error ? error.message : String(error) last.Errormessage;
        next.Retry.In: attempt < max.Retries ? delay : 'none'}),
      if (attempt < max.Retries) {
        await new Promise((resolve) => set.Timeout(resolve, delay));
        delay = Math.min(delay * 2, max.Delay)// Exponential backoff with max delay}};
  throw last.Error || new Error(`Failed to initialize ${service.Name} after ${max.Retries} attempts`);
