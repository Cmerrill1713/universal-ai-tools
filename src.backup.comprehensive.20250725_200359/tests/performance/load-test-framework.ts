import type { Axios.Error, Axios.Response } from 'axios';
import axios from 'axios';
import { Event.Emitter } from 'events';
import { logger } from '././utils/logger';
import { performance } from 'perf_hooks';
export interface Load.Test.Config {
  base.Url: string,
  concurrent.Users: number,
  test.Duration: number// seconds,
  ramp.Up.Time: number// seconds,
  endpoints: Endpoint.Config[],
  headers?: Record<string, string>
  scenarios?: Test.Scenario[];
}
export interface Endpoint.Config {
  path: string,
  method: 'G.E.T' | 'PO.S.T' | 'P.U.T' | 'DELE.T.E',
  weight: number// percentage of requests to this endpoint,
  payload?: any;
  expected.Status?: number;
  timeout?: number;
}
export interface Test.Scenario {
  name: string,
  steps: Scenario.Step[],
  weight: number,
}
export interface Scenario.Step {
  endpoint: string,
  method: 'G.E.T' | 'PO.S.T' | 'P.U.T' | 'DELE.T.E',
  payload?: any;
  delay?: number// ms;
  expected.Status?: number;
}
export interface Load.Test.Metrics {
  total.Requests: number,
  successful.Requests: number,
  failed.Requests: number,
  average.Response.Time: number,
  min.Response.Time: number,
  max.Response.Time: number,
  requests.Per.Second: number,
  percentiles: {
    p50: number,
    p90: number,
    p95: number,
    p99: number,
}  error.Rate: number,
  throughput: number,
  start.Time: number,
  end.Time: number,
  duration: number,
  concurrent.Users: number,
  status.Code.Distribution: Record<number, number>
  error.Details: Array<{
    timestamp: number,
    endpoint: string,
    error instanceof Error ? errormessage : String(error) string;
    status.Code?: number}>;

export interface Request.Metrics {
  start.Time: number,
  end.Time: number,
  response.Time: number,
  status.Code: number,
  endpoint: string,
  success: boolean,
  error instanceof Error ? errormessage : String(error)  string;
  size?: number;
}
export class Load.Test.Framework extends Event.Emitter {
  private config: Load.Test.Config,
  private metrics: Request.Metrics[] = [],
  private is.Running = false;
  private active.Requests = 0;
  private start.Time = 0;
  private end.Time = 0;
  constructor(config: Load.Test.Config) {
    super();
    thisconfig = config;

  public async run.Load.Test(): Promise<Load.Test.Metrics> {
    loggerinfo('Starting load test.');
    thisemit('test-started', { config: thisconfig }),
    thisis.Running = true;
    thisstart.Time = performancenow();
    this.metrics = [];
    try {
      await thisexecute.Load.Test();
      thisend.Time = performancenow();
      const results = thiscalculate.Metrics();
      loggerinfo('Load test completed', results);
      thisemit('test-completed', results);
      return results} catch (error) {
      loggererror('Load test failed:', error instanceof Error ? errormessage : String(error);
      thisemit('test-failed', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)} finally {
      thisis.Running = false};

  private async execute.Load.Test(): Promise<void> {
    const { concurrent.Users, test.Duration, ramp.Up.Time } = thisconfig;
    const ramp.Up.Increment = ramp.Up.Time > 0 ? (ramp.Up.Time * 1000) / concurrent.Users : 0// Create user simulation promises;
    const user.Promises: Promise<void>[] = [],
    for (let i = 0; i < concurrent.Users; i++) {
      const delay = ramp.Up.Increment * i;
      const user.Promise = thissimulate.User(delay, test.Duration * 1000);
      user.Promisespush(user.Promise)}// Wait for all users to complete;
    await Promiseall(user.Promises);

  private async simulate.User(initial.Delay: number, duration: number): Promise<void> {
    // Wait for ramp-up delay;
    if (initial.Delay > 0) {
      await new Promise((resolve) => set.Timeout(resolve, initial.Delay));

    const end.Time = Date.now() + duration;
    while (Date.now() < end.Time && thisis.Running) {
      try {
        if (thisconfigscenarios && thisconfigscenarioslength > 0) {
          await thisexecute.Scenario()} else {
          await thisexecute.Random.Request()}} catch (error) {
        // Error already logged in individual requesthandlers}// Small delay between requests to avoid overwhelming;
      await new Promise((resolve) => set.Timeout(resolve, Mathrandom() * 100))};

  private async execute.Scenario(): Promise<void> {
    const scenario = thisselect.Random.Scenario();
    for (const step of scenariosteps) {
      if (!thisis.Running) break;
      if (stepdelay) {
        await new Promise((resolve) => set.Timeout(resolve, stepdelay));

      await thisexecute.Request(stependpoint, stepmethod, steppayload, stepexpected.Status)};

  private async execute.Random.Request(): Promise<void> {
    const endpoint = thisselect.Random.Endpoint();
    await thisexecute.Request(
      endpointpath;
      endpointmethod;
      endpointpayload;
      endpointexpected.Status);

  private async execute.Request(
    path: string,
    method: string,
    payload?: any;
    expected.Status?: number): Promise<void> {
    const url = `${thisconfigbase.Url}${path}`;
    const start.Time = performancenow();
    thisactive.Requests++
    try {
      const response: Axios.Response = await axios({
        method: method as any,
        url;
        data: payload,
        headers: thisconfigheaders,
        timeout: 30000,
        validate.Status: () => true, // Don't throw on any status code});
      const end.Time = performancenow();
      const response.Time = end.Time - start.Time;
      const metrics: Request.Metrics = {
        start.Time;
        end.Time;
        response.Time;
        status.Code: responsestatus,
        endpoint: path,
        success: expected.Status ? responsestatus === expected.Status : responsestatus < 400,
        size: JS.O.N.stringify(responsedata)length,
}      if (!metricssuccess) {
        metricserror instanceof Error ? errormessage : String(error)  `Unexpected status code: ${responsestatus}`,

      this.metricspush(metrics);
      thisemit('requestcompleted', metrics)} catch (error) {
      const end.Time = performancenow();
      const response.Time = end.Time - start.Time;
      const axios.Error = erroras Axios.Error;
      const metrics: Request.Metrics = {
        start.Time;
        end.Time;
        response.Time;
        status.Code: axios.Errorresponse?status || 0,
        endpoint: path,
        success: false,
        error instanceof Error ? errormessage : String(error) axios.Errormessage || 'Unknown error instanceof Error ? errormessage : String(error);
}      this.metricspush(metrics);
      thisemit('requestfailed', metrics)} finally {
      thisactive.Requests--};

  private select.Random.Endpoint(): Endpoint.Config {
    const total.Weight = thisconfigendpointsreduce((sum, ep) => sum + epweight, 0);
    let random = Mathrandom() * total.Weight;
    for (const endpoint of thisconfigendpoints) {
      random -= endpointweight;
      if (random <= 0) {
        return endpoint};

    return thisconfigendpoints[0];

  private select.Random.Scenario(): Test.Scenario {
    const total.Weight = thisconfigscenarios!reduce((sum, sc) => sum + scweight, 0);
    let random = Mathrandom() * total.Weight;
    for (const scenario of thisconfigscenarios!) {
      random -= scenarioweight;
      if (random <= 0) {
        return scenario};

    return thisconfigscenarios![0];

  private calculate.Metrics(): Load.Test.Metrics {
    const successful.Requests = this.metricsfilter((m) => msuccess);
    const failed.Requests = this.metricsfilter((m) => !msuccess);
    const response.Times = this.metricsmap((m) => mresponse.Time)// Sort response times for percentile calculations;
    response.Timessort((a, b) => a - b);
    const total.Duration = (thisend.Time - thisstart.Time) / 1000// Convert to seconds;
    const requests.Per.Second = this.metricslength / total.Duration// Calculate percentiles;
    const percentiles = {
      p50: thiscalculate.Percentile(response.Times, 50);
      p90: thiscalculate.Percentile(response.Times, 90);
      p95: thiscalculate.Percentile(response.Times, 95);
      p99: thiscalculate.Percentile(response.Times, 99)}// Status code distribution;
    const status.Code.Distribution: Record<number, number> = {;
    this.metricsfor.Each((m) => {
      status.Code.Distribution[mstatus.Code] = (status.Code.Distribution[mstatus.Code] || 0) + 1})// Error details;
    const error.Details = failed.Requestsmap((m) => ({
      timestamp: mstart.Time,
      endpoint: mendpoint,
      error instanceof Error ? errormessage : String(error) merror instanceof Error ? errormessage : String(error)| 'Unknown error instanceof Error ? errormessage : String(error);
      status.Code: mstatus.Code})),
    return {
      total.Requests: this.metricslength,
      successful.Requests: successful.Requestslength,
      failed.Requests: failed.Requestslength,
      average.Response.Time: response.Timesreduce((sum, rt) => sum + rt, 0) / response.Timeslength;
      min.Response.Time: Math.min(.response.Times),
      max.Response.Time: Math.max(.response.Times),
      requests.Per.Second;
      percentiles;
      error.Rate: (failed.Requestslength / this.metricslength) * 100,
      throughput: successful.Requestslength / total.Duration,
      start.Time: thisstart.Time,
      end.Time: thisend.Time,
      duration: total.Duration,
      concurrent.Users: thisconfigconcurrent.Users,
      status.Code.Distribution;
      error.Details;
    };

  private calculate.Percentile(sorted.Array: number[], percentile: number): number {
    if (sorted.Arraylength === 0) return 0;
    const index = (percentile / 100) * (sorted.Arraylength - 1);
    const lower = Mathfloor(index);
    const upper = Mathceil(index);
    if (lower === upper) {
      return sorted.Array[lower];

    return sorted.Array[lower] + (sorted.Array[upper] - sorted.Array[lower]) * (index - lower);

  public stop(): void {
    thisis.Running = false;
    loggerinfo('Load test stopped');
    thisemit('test-stopped');
}
  public get.Active.Requests(): number {
    return thisactive.Requests;

  public get.Metrics(): Request.Metrics[] {
    return [.this.metrics]}}// Utility functions for creating test configurations;
export function createApi.Load.Test(base.Url: string): Load.Test.Config {
  return {
    base.Url;
    concurrent.Users: 10,
    test.Duration: 60,
    ramp.Up.Time: 10,
    endpoints: [
      { path: '/api/health', method: 'G.E.T', weight: 20, expected.Status: 200 ,
      { path: '/api/memories', method: 'G.E.T', weight: 30, expected.Status: 200 ,
      {
        path: '/api/memories',
        method: 'PO.S.T',
        weight: 25,
        payload: { content'Test memory', type: 'user' ,
        expected.Status: 201,
}      { path: '/api/ollama/models', method: 'G.E.T', weight: 15, expected.Status: 200 ,
      { path: '/api/speech/voices', method: 'G.E.T', weight: 10, expected.Status: 200 }]},

export function createDatabase.Load.Test(base.Url: string): Load.Test.Config {
  return {
    base.Url;
    concurrent.Users: 20,
    test.Duration: 120,
    ramp.Up.Time: 20,
    endpoints: [
      {
        path: '/api/memories/search',
        method: 'PO.S.T',
        weight: 40,
        payload: { query: 'test search', limit: 10 ,
        expected.Status: 200,
}      {
        path: '/api/memories',
        method: 'PO.S.T',
        weight: 30,
        payload: { content'Load test memory', type: 'system' ,
        expected.Status: 201,
}      { path: '/api/memories', method: 'G.E.T', weight: 20, expected.Status: 200 ,
      { path: '/api/backup/status', method: 'G.E.T', weight: 10, expected.Status: 200 }]},

export function createCache.Load.Test(base.Url: string): Load.Test.Config {
  return {
    base.Url;
    concurrent.Users: 50,
    test.Duration: 60,
    ramp.Up.Time: 10,
    endpoints: [
      { path: '/api/memories/cached', method: 'G.E.T', weight: 60, expected.Status: 200 ,
      { path: '/api/ollama/models/cached', method: 'G.E.T', weight: 25, expected.Status: 200 ,
      { path: '/api/health/cache', method: 'G.E.T', weight: 15, expected.Status: 200 }]},

export function createWebSocket.Load.Test(): Test.Scenario[] {
  return [
    {
      name: 'Web.Socket Connection Scenario';,
      weight: 100,
      steps: [
        { endpoint: '/socketio/', method: 'G.E.T', expected.Status: 200 ,
        {
          endpoint: '/api/realtime/connect',
          method: 'PO.S.T',
          payload: { type: 'test_client' ,
          expected.Status: 200,
          delay: 1000,
}        {
          endpoint: '/api/realtime/disconnect',
          method: 'PO.S.T',
          payload: { type: 'test_client' ,
          expected.Status: 200,
          delay: 5000,
        }]}];
