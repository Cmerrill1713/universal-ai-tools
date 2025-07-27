import { Log.Context, logger } from './enhanced-logger';
export interface Timeout.Options {
  timeout: number;
  name: string;
  fallback.Value?: any;
  throwOn.Timeout?: boolean;
}/**
 * Wraps a promise with a timeout*/
export async function with.Timeout<T>(promise: Promise<T>, options: Timeout.Options): Promise<T> {
  const { timeout, name, fallback.Value, throwOn.Timeout = false } = options;
  const timeout.Promise = new Promise<T>((_, reject) => {
    set.Timeout(() => {
      const error = new Error(`${name} timed out after ${timeout}ms`);
      if (throwOn.Timeout) {
        reject(error)} else {
        loggerwarn(`${name} initialization timed out`, LogContextSYSTE.M, {
          timeout;
          fallback.Value})}}, timeout)});
  try {
    const result = await Promiserace([promise, timeout.Promise]);
    return result} catch (error) {
    if (!throwOn.Timeout && fallback.Value !== undefined) {
      return fallback.Value};
    throw error}}/**
 * Initialize a service with timeout protection*/
export async function initializeWith.Timeout<T>(
  init.Function: () => Promise<T>
  service.Name: string;
  timeout = 10000;
  options: { critical?: boolean; fallback.Value?: T } = {}): Promise<T | null> {
  const start.Time = Date.now();
  try {
    loggerinfo(`🔄 Initializing ${service.Name}.`);
    const result = await with.Timeout(init.Function(), {
      timeout;
      name: service.Name;
      fallback.Value: optionsfallback.Value;
      throwOn.Timeout: optionscritical});
    const duration = Date.now() - start.Time;
    loggerinfo(`✅ ${service.Name} initialized successfully in ${duration}ms`);
    return result} catch (error) {
    const duration = Date.now() - start.Time;
    const error.Message = error instanceof Error ? errormessage : String(error);
    if (optionscritical) {
      loggererror(`❌ Critical service ${service.Name} failed to initialize`, LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) error.Message;
        duration});
      throw error} else {
      loggerwarn(
        `⚠️  ${service.Name} failed to initialize, continuing without it`;
        LogContextSYSTE.M;
        {
          error instanceof Error ? errormessage : String(error) error.Message;
          duration;
        });
      return optionsfallback.Value || null}}}/**
 * Initialize multiple services in parallel with timeout protection*/
export async function initializeServices.Parallel(
  services: Array<{
    name: string;
    init: () => Promise<unknown>
    timeout?: number;
    critical?: boolean}>): Promise<Map<string, { success: boolean; result?: any; error?: string }>> {
  const results = new Map<string, { success: boolean; result?: any; error?: string }>();
  await Promiseall(
    servicesmap(async (service) => {
      try {
        const result = await initializeWith.Timeout(
          serviceinit;
          servicename;
          servicetimeout || 10000;
          { critical: servicecritical });
        resultsset(servicename, {
          success: true;
          result})} catch (error) {
        resultsset(servicename, {
          success: false;
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}}));
  return results}/**
 * Retry initialization with exponential backoff*/
export async function initializeWith.Retry<T>(
  init.Function: () => Promise<T>
  service.Name: string;
  options: {
    max.Retries?: number;
    initial.Delay?: number;
    max.Delay?: number;
    timeout?: number} = {}): Promise<T> {
  const { max.Retries = 3, initial.Delay = 1000, max.Delay = 10000, timeout = 10000 } = options;
  let last.Error: Error | null = null;
  let delay = initial.Delay;
  for (let attempt = 1; attempt <= max.Retries; attempt++) {
    try {
      loggerinfo(
        `🔄 Attempting to initialize ${service.Name} (attempt ${attempt}/${max.Retries}).`);
      const result = await with.Timeout(init.Function(), {
        timeout;
        name: service.Name;
        throwOn.Timeout: true});
      loggerinfo(`✅ ${service.Name} initialized successfully on attempt ${attempt}`);
      return result} catch (error) {
      last.Error = error instanceof Error ? error : new Error(String(error));
      loggerwarn(`Attempt ${attempt)} failed for ${service.Name}`, LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) last.Errormessage;
        nextRetry.In: attempt < max.Retries ? delay : 'none'});
      if (attempt < max.Retries) {
        await new Promise((resolve) => set.Timeout(resolve, delay));
        delay = Math.min(delay * 2, max.Delay)// Exponential backoff with max delay}}};
  throw last.Error || new Error(`Failed to initialize ${service.Name} after ${max.Retries} attempts`)};
