import type { Axios.Error, Axios.Response } from 'axios';
import axios from 'axios';
import { Event.Emitter } from 'events';
import { logger } from '././utils/logger';
import { performance } from 'perf_hooks';
export interface LoadTest.Config {
  base.Url: string;
  concurrent.Users: number;
  test.Duration: number// seconds;
  rampUp.Time: number// seconds;
  endpoints: Endpoint.Config[];
  headers?: Record<string, string>
  scenarios?: Test.Scenario[];
};

export interface Endpoint.Config {
  path: string;
  method: 'GE.T' | 'POS.T' | 'PU.T' | 'DELET.E';
  weight: number// percentage of requests to this endpoint;
  payload?: any;
  expected.Status?: number;
  timeout?: number;
};

export interface Test.Scenario {
  name: string;
  steps: Scenario.Step[];
  weight: number;
};

export interface Scenario.Step {
  endpoint: string;
  method: 'GE.T' | 'POS.T' | 'PU.T' | 'DELET.E';
  payload?: any;
  delay?: number// ms;
  expected.Status?: number;
};

export interface LoadTest.Metrics {
  total.Requests: number;
  successful.Requests: number;
  failed.Requests: number;
  averageResponse.Time: number;
  minResponse.Time: number;
  maxResponse.Time: number;
  requestsPer.Second: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  error.Rate: number;
  throughput: number;
  start.Time: number;
  end.Time: number;
  duration: number;
  concurrent.Users: number;
  statusCode.Distribution: Record<number, number>
  error.Details: Array<{
    timestamp: number;
    endpoint: string;
    error instanceof Error ? errormessage : String(error) string;
    status.Code?: number}>};

export interface Request.Metrics {
  start.Time: number;
  end.Time: number;
  response.Time: number;
  status.Code: number;
  endpoint: string;
  success: boolean;
  error instanceof Error ? errormessage : String(error)  string;
  size?: number;
};

export class LoadTest.Framework extends Event.Emitter {
  private config: LoadTest.Config;
  private metrics: Request.Metrics[] = [];
  private is.Running = false;
  private active.Requests = 0;
  private start.Time = 0;
  private end.Time = 0;
  constructor(config: LoadTest.Config) {
    super();
    thisconfig = config};

  public async runLoad.Test(): Promise<LoadTest.Metrics> {
    loggerinfo('Starting load test.');
    thisemit('test-started', { config: thisconfig });
    thisis.Running = true;
    thisstart.Time = performancenow();
    thismetrics = [];
    try {
      await thisexecuteLoad.Test();
      thisend.Time = performancenow();
      const results = thiscalculate.Metrics();
      loggerinfo('Load test completed', results);
      thisemit('test-completed', results);
      return results} catch (error) {
      loggererror('Load test failed:', error instanceof Error ? errormessage : String(error);
      thisemit('test-failed', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)} finally {
      thisis.Running = false}};

  private async executeLoad.Test(): Promise<void> {
    const { concurrent.Users, test.Duration, rampUp.Time } = thisconfig;
    const rampUp.Increment = rampUp.Time > 0 ? (rampUp.Time * 1000) / concurrent.Users : 0// Create user simulation promises;
    const user.Promises: Promise<void>[] = [];
    for (let i = 0; i < concurrent.Users; i++) {
      const delay = rampUp.Increment * i;
      const user.Promise = thissimulate.User(delay, test.Duration * 1000);
      user.Promisespush(user.Promise)}// Wait for all users to complete;
    await Promiseall(user.Promises)};

  private async simulate.User(initial.Delay: number, duration: number): Promise<void> {
    // Wait for ramp-up delay;
    if (initial.Delay > 0) {
      await new Promise((resolve) => set.Timeout(resolve, initial.Delay))};

    const end.Time = Date.now() + duration;
    while (Date.now() < end.Time && thisis.Running) {
      try {
        if (thisconfigscenarios && thisconfigscenarioslength > 0) {
          await thisexecute.Scenario()} else {
          await thisexecuteRandom.Request()}} catch (error) {
        // Error already logged in individual requesthandlers}// Small delay between requests to avoid overwhelming;
      await new Promise((resolve) => set.Timeout(resolve, Mathrandom() * 100))}};

  private async execute.Scenario(): Promise<void> {
    const scenario = thisselectRandom.Scenario();
    for (const step of scenariosteps) {
      if (!thisis.Running) break;
      if (stepdelay) {
        await new Promise((resolve) => set.Timeout(resolve, stepdelay))};

      await thisexecute.Request(stependpoint, stepmethod, steppayload, stepexpected.Status)}};

  private async executeRandom.Request(): Promise<void> {
    const endpoint = thisselectRandom.Endpoint();
    await thisexecute.Request(
      endpointpath;
      endpointmethod;
      endpointpayload;
      endpointexpected.Status)};

  private async execute.Request(
    path: string;
    method: string;
    payload?: any;
    expected.Status?: number): Promise<void> {
    const url = `${thisconfigbase.Url}${path}`;
    const start.Time = performancenow();
    thisactive.Requests++
    try {
      const response: Axios.Response = await axios({
        method: method as any;
        url;
        data: payload;
        headers: thisconfigheaders;
        timeout: 30000;
        validate.Status: () => true, // Don't throw on any status code});
      const end.Time = performancenow();
      const response.Time = end.Time - start.Time;
      const metrics: Request.Metrics = {
        start.Time;
        end.Time;
        response.Time;
        status.Code: responsestatus;
        endpoint: path;
        success: expected.Status ? responsestatus === expected.Status : responsestatus < 400;
        size: JSO.N.stringify(responsedata)length;
      };
      if (!metricssuccess) {
        metricserror instanceof Error ? errormessage : String(error)  `Unexpected status code: ${responsestatus}`};

      thismetricspush(metrics);
      thisemit('requestcompleted', metrics)} catch (error) {
      const end.Time = performancenow();
      const response.Time = end.Time - start.Time;
      const axios.Error = erroras Axios.Error;
      const metrics: Request.Metrics = {
        start.Time;
        end.Time;
        response.Time;
        status.Code: axios.Errorresponse?status || 0;
        endpoint: path;
        success: false;
        error instanceof Error ? errormessage : String(error) axios.Errormessage || 'Unknown error instanceof Error ? errormessage : String(error);
      };
      thismetricspush(metrics);
      thisemit('requestfailed', metrics)} finally {
      thisactive.Requests--}};

  private selectRandom.Endpoint(): Endpoint.Config {
    const total.Weight = thisconfigendpointsreduce((sum, ep) => sum + epweight, 0);
    let random = Mathrandom() * total.Weight;
    for (const endpoint of thisconfigendpoints) {
      random -= endpointweight;
      if (random <= 0) {
        return endpoint}};

    return thisconfigendpoints[0]};

  private selectRandom.Scenario(): Test.Scenario {
    const total.Weight = thisconfigscenarios!reduce((sum, sc) => sum + scweight, 0);
    let random = Mathrandom() * total.Weight;
    for (const scenario of thisconfigscenarios!) {
      random -= scenarioweight;
      if (random <= 0) {
        return scenario}};

    return thisconfigscenarios![0]};

  private calculate.Metrics(): LoadTest.Metrics {
    const successful.Requests = thismetricsfilter((m) => msuccess);
    const failed.Requests = thismetricsfilter((m) => !msuccess);
    const response.Times = thismetricsmap((m) => mresponse.Time)// Sort response times for percentile calculations;
    response.Timessort((a, b) => a - b);
    const total.Duration = (thisend.Time - thisstart.Time) / 1000// Convert to seconds;
    const requestsPer.Second = thismetricslength / total.Duration// Calculate percentiles;
    const percentiles = {
      p50: thiscalculate.Percentile(response.Times, 50);
      p90: thiscalculate.Percentile(response.Times, 90);
      p95: thiscalculate.Percentile(response.Times, 95);
      p99: thiscalculate.Percentile(response.Times, 99)}// Status code distribution;
    const statusCode.Distribution: Record<number, number> = {};
    thismetricsfor.Each((m) => {
      statusCode.Distribution[mstatus.Code] = (statusCode.Distribution[mstatus.Code] || 0) + 1})// Error details;
    const error.Details = failed.Requestsmap((m) => ({
      timestamp: mstart.Time;
      endpoint: mendpoint;
      error instanceof Error ? errormessage : String(error) merror instanceof Error ? errormessage : String(error)| 'Unknown error instanceof Error ? errormessage : String(error);
      status.Code: mstatus.Code}));
    return {
      total.Requests: thismetricslength;
      successful.Requests: successful.Requestslength;
      failed.Requests: failed.Requestslength;
      averageResponse.Time: response.Timesreduce((sum, rt) => sum + rt, 0) / response.Timeslength;
      minResponse.Time: Math.min(.response.Times);
      maxResponse.Time: Math.max(.response.Times);
      requestsPer.Second;
      percentiles;
      error.Rate: (failed.Requestslength / thismetricslength) * 100;
      throughput: successful.Requestslength / total.Duration;
      start.Time: thisstart.Time;
      end.Time: thisend.Time;
      duration: total.Duration;
      concurrent.Users: thisconfigconcurrent.Users;
      statusCode.Distribution;
      error.Details;
    }};

  private calculate.Percentile(sorted.Array: number[], percentile: number): number {
    if (sorted.Arraylength === 0) return 0;
    const index = (percentile / 100) * (sorted.Arraylength - 1);
    const lower = Mathfloor(index);
    const upper = Mathceil(index);
    if (lower === upper) {
      return sorted.Array[lower]};

    return sorted.Array[lower] + (sorted.Array[upper] - sorted.Array[lower]) * (index - lower)};

  public stop(): void {
    thisis.Running = false;
    loggerinfo('Load test stopped');
    thisemit('test-stopped');
  };

  public getActive.Requests(): number {
    return thisactive.Requests};

  public get.Metrics(): Request.Metrics[] {
    return [.thismetrics]}}// Utility functions for creating test configurations;
export function createApiLoad.Test(base.Url: string): LoadTest.Config {
  return {
    base.Url;
    concurrent.Users: 10;
    test.Duration: 60;
    rampUp.Time: 10;
    endpoints: [
      { path: '/api/health', method: 'GE.T', weight: 20, expected.Status: 200 };
      { path: '/api/memories', method: 'GE.T', weight: 30, expected.Status: 200 };
      {
        path: '/api/memories';
        method: 'POS.T';
        weight: 25;
        payload: { content'Test memory', type: 'user' };
        expected.Status: 201;
      };
      { path: '/api/ollama/models', method: 'GE.T', weight: 15, expected.Status: 200 };
      { path: '/api/speech/voices', method: 'GE.T', weight: 10, expected.Status: 200 }]}};

export function createDatabaseLoad.Test(base.Url: string): LoadTest.Config {
  return {
    base.Url;
    concurrent.Users: 20;
    test.Duration: 120;
    rampUp.Time: 20;
    endpoints: [
      {
        path: '/api/memories/search';
        method: 'POS.T';
        weight: 40;
        payload: { query: 'test search', limit: 10 };
        expected.Status: 200;
      };
      {
        path: '/api/memories';
        method: 'POS.T';
        weight: 30;
        payload: { content'Load test memory', type: 'system' };
        expected.Status: 201;
      };
      { path: '/api/memories', method: 'GE.T', weight: 20, expected.Status: 200 };
      { path: '/api/backup/status', method: 'GE.T', weight: 10, expected.Status: 200 }]}};

export function createCacheLoad.Test(base.Url: string): LoadTest.Config {
  return {
    base.Url;
    concurrent.Users: 50;
    test.Duration: 60;
    rampUp.Time: 10;
    endpoints: [
      { path: '/api/memories/cached', method: 'GE.T', weight: 60, expected.Status: 200 };
      { path: '/api/ollama/models/cached', method: 'GE.T', weight: 25, expected.Status: 200 };
      { path: '/api/health/cache', method: 'GE.T', weight: 15, expected.Status: 200 }]}};

export function createWebSocketLoad.Test(): Test.Scenario[] {
  return [
    {
      name: 'Web.Socket Connection Scenario';
      weight: 100;
      steps: [
        { endpoint: '/socketio/', method: 'GE.T', expected.Status: 200 };
        {
          endpoint: '/api/realtime/connect';
          method: 'POS.T';
          payload: { type: 'test_client' };
          expected.Status: 200;
          delay: 1000;
        };
        {
          endpoint: '/api/realtime/disconnect';
          method: 'POS.T';
          payload: { type: 'test_client' };
          expected.Status: 200;
          delay: 5000;
        }]}]};
