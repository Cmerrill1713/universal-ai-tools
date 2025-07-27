import { Socket, create.Server } from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, read.File, write.File } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import Event.Emitter from 'events';
import { Log.Context, logger } from './enhanced-logger';
import { BATCH_SI.Z.E_10', HT.T.P_200, HT.T.P_400, HT.T.P_401, HT.T.P_404, HT.T.P_500, MAX_ITE.M.S_100, PERCE.N.T_10, PERCE.N.T_100, PERCE.N.T_20, PERCE.N.T_30, PERCE.N.T_50, PERCE.N.T_80, PERCE.N.T_90, TIME_10000.M.S, TIME_1000.M.S, TIME_2000.M.S, TIME_5000.M.S, TIME_500.M.S, ZERO_POINT_EIG.H.T, ZERO_POINT_FI.V.E, ZERO_POINT_NI.N.E } from "./utils/common-constants";
const exec.Async = promisify(exec)// Service configuration types;
export interface Service.Config {
  name: string,
  default.Port: number,
  fallback.Ports: number[],
  health.Check.Path?: string;
  is.Required: boolean,
  service.Type: 'web' | 'database' | 'ai' | 'cache',
  protocol?: 'http' | 'https' | 'tcp';
  timeout?: number;
}  export interface Port.Status {
  port: number,
  available: boolean,
  service?: string;
  pid?: number;
  last.Checked: Date,
  health.Status?: 'healthy' | 'unhealthy' | 'unknown';
}  export interface Port.Configuration {
  services: Record<string, number>
  last.Updated: Date,
  conflicts: Array<{ service: string; port: number; resolved.To: number }>}// Port range definitions,
const PORT_RANG.E.S = {
  web: { start: 3000, end: 3999, secondary: { start: 8000, end: 8999 } ,
  database: { start: 5000, end: 5999, secondary: { start: 6000, end: 6999 } ,
  ai: { start: 11000, end: 11999 ,
  cache: { start: 6300, end: 6399 ,
  development: [3000, 5173, 8080, 9999]}// Default service configurations;
const DEFAULT_SERVIC.E.S: Service.Config[] = [
  {
    name: 'universal-ai-tools';,
    default.Port: 9999,
    fallback.Ports: [9998, 9997, 9996];
    health.Check.Path: '/health',
    is.Required: true,
    service.Type: 'web',
    protocol: 'http',
}  {
    name: 'ollama';,
    default.Port: 11434,
    fallback.Ports: [11435, 11436, 11437];
    health.Check.Path: '/api/tags',
    is.Required: false,
    service.Type: 'ai',
    protocol: 'http',
}  {
    name: 'lm-studio';,
    default.Port: 1234,
    fallback.Ports: [1235, 1236, 1237];
    health.Check.Path: '/v1/models',
    is.Required: false,
    service.Type: 'ai',
    protocol: 'http',
}  {
    name: 'supabase';,
    default.Port: 54321,
    fallback.Ports: [54322, 54323, 54324];
    health.Check.Path: '/rest/v1/',
    is.Required: false,
    service.Type: 'database',
    protocol: 'http',
}  {
    name: 'redis';,
    default.Port: 6379,
    fallback.Ports: [6380, 6381, 6382];
    is.Required: false,
    service.Type: 'cache',
    protocol: 'tcp',
}  {
    name: 'frontend';,
    default.Port: 3000,
    fallback.Ports: [5173, 3001, 3002];
    health.Check.Path: '/',
    is.Required: false,
    service.Type: 'web',
    protocol: 'http',
  }];
export class Smart.Port.Manager extends Event.Emitter {
  private services: Map<string, Service.Config>
  private port.Cache: Map<number, Port.Status>
  private config.Path: string,
  private monitoring.Interval?: NodeJ.S.Timeout;
  private platform: NodeJ.S.Platform,
  constructor(custom.Services?: Service.Config[]) {
    super();
    thisservices = new Map();
    thisport.Cache = new Map();
    thisplatform = processplatform;
    this.config.Path = join(homedir(), 'universal-ai-tools', 'port-configjson')// Initialize with default services;
    const all.Services = [.DEFAULT_SERVIC.E.S, .(custom.Services || [])];
    all.Servicesfor.Each((service) => {
      thisservicesset(servicename, service)})}/**
   * Find an available port starting from preferred port*/
  async find.Available.Port(
    preferred.Port: number,
    range?: { start: number; end: number }): Promise<number> {
    // First check the preferred port;
    if (await thischeck.Port.Availability(preferred.Port)) {
      return preferred.Port}// If range is provided, scan within range;
    if (range) {
      const available.Ports = await thisscan.Port.Range(rangestart, rangeend);
      if (available.Portslength > 0) {
        return available.Ports[0]}}// Fallback to finding next available port;
    let port = preferred.Port + 1;
    const max.Port = range?end || preferred.Port + 100;
    while (port <= max.Port) {
      if (await thischeck.Port.Availability(port)) {
        return port;
      port++;
    throw new Error(`No available ports found starting from ${preferred.Port}`)}/**
   * Scan a range of ports and return available ones*/
  async scan.Port.Range(start.Port: number, end.Port: number): Promise<number[]> {
    const available.Ports: number[] = [],
    const batch.Size = 50// Process in batches for performance;
    for (let i = start.Port; i <= end.Port; i += batch.Size) {
      const batch = [];
      const batch.End = Math.min(i + batch.Size - 1, end.Port);
      for (let port = i; port <= batch.End; port++) {
        batchpush();
          thischeck.Port.Availability(port)then((available) => {
            if (available) available.Portspush(port)}));
      await Promiseall(batch);
    return available.Portssort((a, b) => a - b)}/**
   * Check if a specific port is available*/
  async check.Port.Availability(port: number): Promise<boolean> {
    // Check cache first;
    const cached = thisport.Cacheget(port);
    if (cached && Date.now() - cachedlast.Checkedget.Time() < 5000) {
      return cachedavailable;

    return new Promise((resolve) => {
      const server = create.Server();
      const on.Error = () => {
        serverclose();
        thisupdate.Port.Cache(port, false);
        resolve(false);
      const on.Listening = () => {
        serverclose();
        thisupdate.Port.Cache(port, true);
        resolve(true);
      serveronce('error', on.Error);
      serveronce('listening', on.Listening);
      serverlisten(port, '0.0.0.0')})}/**
   * Resolve port conflicts automatically*/
  async resolve.Port.Conflict(service: string, requested.Port: number): Promise<number> {
    const service.Config = thisservicesget(service);
    if (!service.Config) {
      throw new Error(`Unknown service: ${service}`)}// Check if requested port is available,
    if (await thischeck.Port.Availability(requested.Port)) {
      return requested.Port;

    loggerinfo(
      `Port ${requested.Port} is unavailable for ${service}, finding alternative.`;
      LogContextSYST.E.M)// Try fallback ports;
    for (const fallback.Port of service.Configfallback.Ports) {
      if (await thischeck.Port.Availability(fallback.Port)) {
        loggerinfo(`Resolved to fallback port ${fallback.Port)} for ${service}`, LogContextSYST.E.M);
        thisemit('port.Conflict.Resolved', {
          service;
          original: requested.Port,
          resolved: fallback.Port}),
        return fallback.Port}}// Try to find port in appropriate range;
    const range = thisgetPortRangeFor.Service.Type(service.Configservice.Type);
    const available.Port = await thisfind.Available.Port(rangestart, range);
    loggerinfo(`Resolved to port ${available.Port)} for ${service}`, LogContextSYST.E.M);
    thisemit('port.Conflict.Resolved', {
      service;
      original: requested.Port,
      resolved: available.Port}),
    return available.Port}/**
   * Discover running services and their ports*/
  async discover.Services(): Promise<Map<string, Port.Status>> {
    const discovered.Services = new Map<string, Port.Status>();
    for (const [service.Name, config] of thisservices) {
      const status = await thisget.Service.Status(service.Name);
      if (statushealth.Status === 'healthy') {
        discovered.Servicesset(service.Name, status)}}// Platform-specific service discovery;
    if (thisplatform === 'darwin' || thisplatform === 'linux') {
      await thisdiscover.Unix.Services(discovered.Services)} else if (thisplatform === 'win32') {
      await thisdiscover.Windows.Services(discovered.Services);

    return discovered.Services}/**
   * Get status of a specific service*/
  async get.Service.Status(service: string): Promise<Port.Status> {
    const config = thisservicesget(service);
    if (!config) {
      throw new Error(`Unknown service: ${service}`)}// Check default port first,
    const port = configdefault.Port;
    const available = await thischeck.Port.Availability(port);
    if (!available) {
      // Check if service is actually running on this port;
      const is.Running = await thisvalidate.Service.Connection(service, port);
      if (is.Running) {
        const health.Status = await thischeck.Service.Health(config, port);
        return {
          port;
          available: false,
          service;
          last.Checked: new Date(),
          health.Status;
        }}}// Check fallback ports;
    for (const fallback.Port of configfallback.Ports) {
      const is.Running = await thisvalidate.Service.Connection(service, fallback.Port);
      if (is.Running) {
        const health.Status = await thischeck.Service.Health(config, fallback.Port);
        return {
          port: fallback.Port,
          available: false,
          service;
          last.Checked: new Date(),
          health.Status;
        }};

    return {
      port;
      available: true,
      service;
      last.Checked: new Date(),
      health.Status: 'unknown',
    }}/**
   * Validate service connection*/
  async validate.Service.Connection(service: string, port: number): Promise<boolean> {
    const config = thisservicesget(service);
    if (!config) return false;
    if (configprotocol === 'http' || configprotocol === 'https') {
      return thisvalidate.Http.Connection(port, confighealth.Check.Path)} else {
      return thisvalidate.Tcp.Connection(port)}}/**
   * Health check all configured ports*/
  async healthCheck.All.Ports(): Promise<Map<string, Port.Status>> {
    const results = new Map<string, Port.Status>();
    const checks = Arrayfrom(thisserviceskeys())map(async (service) => {
      try {
        const status = await thisget.Service.Status(service);
        resultsset(service, status)} catch (error) {
        loggererror(`Health check failed for ${service)}`, LogContextSYST.E.M, { error });
        const config = thisservicesget(service)!
        resultsset(service, {
          port: configdefault.Port,
          available: false,
          service;
          last.Checked: new Date(),
          health.Status: 'unhealthy'})}}),
    await Promiseall(checks);
    return results}/**
   * Get detailed port status*/
  async get.Port.Status(port: number): Promise<Port.Status> {
    const available = await thischeck.Port.Availability(port);
    const status: Port.Status = {
      port;
      available;
      last.Checked: new Date(),
}    if (!available) {
      // Try to identify what's using the port;
      const service.Info = await thisidentify.Port.Service(port);
      if (service.Info) {
        statusservice = service.Infoservice;
        statuspid = service.Infopid};
}    return status}/**
   * Monitor port changes in real-time*/
  monitor.Port.Changes(interval = 30000): void {
    if (thismonitoring.Interval) {
      clear.Interval(thismonitoring.Interval);

    thismonitoring.Interval = set.Interval(async () => {
      const health.Status = await thishealthCheck.All.Ports();
      for (const [service, status] of health.Status) {
        const previous.Status = thisport.Cacheget(statusport);
        if (previous.Status && previous.Statushealth.Status !== statushealth.Status) {
          thisemit('port.Status.Changed', {
            service;
            port: statusport,
            previous.Status: previous.Statushealth.Status,
            new.Status: statushealth.Status})}}}, interval);
    loggerinfo(`Port monitoring started with ${interval)}ms interval`, LogContextSYST.E.M)}/**
   * Stop monitoring port changes*/
  stop.Monitoring(): void {
    if (thismonitoring.Interval) {
      clear.Interval(thismonitoring.Interval);
      thismonitoring.Interval = undefined;
      loggerinfo('Port monitoring stopped', LogContextSYST.E.M)}}/**
   * Generate optimal port configuration*/
  async generateOptimal.Port.Config(): Promise<Port.Configuration> {
    const config: Port.Configuration = {
      services: {
}      last.Updated: new Date(),
      conflicts: [],
}    for (const [service.Name, service.Config] of thisservices) {
      try {
        const assigned.Port = await thisresolve.Port.Conflict(service.Name, service.Configdefault.Port);
        configservices[service.Name] = assigned.Port;
        if (assigned.Port !== service.Configdefault.Port) {
          configconflictspush({
            service: service.Name,
            port: service.Configdefault.Port,
            resolved.To: assigned.Port})}} catch (error) {
        loggererror(`Failed to assign port for ${service.Name)}`, LogContextSYST.E.M, { error })// Use default port anyway for configuration;
        configservices[service.Name] = service.Configdefault.Port};

    return config}/**
   * Save port configuration*/
  async save.Port.Configuration(config: Port.Configuration): Promise<void> {
    try {
      const dir = join(homedir(), 'universal-ai-tools');
      await mkdir(dir, { recursive: true }),
      await write.File(this.config.Path, JS.O.N.stringify(config, null, 2));
      loggerinfo('Port configuration saved', LogContextSYST.E.M)} catch (error) {
      loggererror('Failed to save port configuration', LogContextSYST.E.M, { error });
      throw error}}/**
   * Load saved port configuration*/
  async load.Port.Configuration(): Promise<Port.Configuration | null> {
    try {
      const data = await read.File(this.config.Path, 'utf-8');
      return JS.O.N.parse(data)} catch {
      loggerdebug('No existing port configuration found', LogContextSYST.E.M);
      return null}}// Private helper methods;

  private update.Port.Cache(port: number, available: boolean): void {
    thisport.Cacheset(port, {
      port;
      available;
      last.Checked: new Date()}),

  private getPortRangeFor.Service.Type(service.Type: string): { start: number; end: number } {
    switch (service.Type) {
      case 'web':
        return PORT_RANG.E.Sweb;
      case 'database':
        return PORT_RANG.E.Sdatabase;
      case 'ai':
        return PORT_RANG.E.Sai;
      case 'cache':
        return PORT_RANG.E.Scache;
      default:
        return { start: 3000, end: 9999 }},
  private async validate.Http.Connection(port: number, health.Path?: string): Promise<boolean> {
    try {
      const url = `http://localhost:${port}${health.Path || '/'}`;
      const response = await fetch(url, {
        method: 'G.E.T',
        signal: Abort.Signaltimeout(3000)}),
      return responseok} catch {
      return false};

  private async validate.Tcp.Connection(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const timeout = set.Timeout(() => {
        socketdestroy();
        resolve(false)}, 3000);
      socketconnect(port, 'localhost', () => {
        clear.Timeout(timeout);
        socketend();
        resolve(true)});
      socketon('error', () => {
        clear.Timeout(timeout);
        resolve(false)})});

  private async check.Service.Health(
    config: Service.Config,
    port: number): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    try {
      if (configprotocol === 'http' && confighealth.Check.Path) {
        const url = `http://localhost:${port}${confighealth.Check.Path}`// Create custom timeout with Abort.Controller;
        const controller = new Abort.Controller();
        const timeout.Id = set.Timeout(() => controllerabort(), TIME_5000.M.S);
        try {
          const response = await fetch(url, {
            method: 'G.E.T',
            signal: controllersignal}),
          clear.Timeout(timeout.Id);
          return responseok ? 'healthy' : 'unhealthy'} catch (fetch.Error: any) {
          clear.Timeout(timeout.Id);
          if (fetch.Errorname === 'Abort.Error') {
            return 'unhealthy'// Timeout;
          throw fetch.Error}} else if (configprotocol === 'tcp') {
        const connected = await thisvalidate.Tcp.Connection(port);
        return connected ? 'healthy' : 'unhealthy';
      return 'unknown'} catch {
      return 'unhealthy'};

  private async identify.Port.Service(
    port: number): Promise<{ service: string; pid?: number } | null> {
    try {
      if (thisplatform === 'darwin' || thisplatform === 'linux') {
        const { stdout } = await exec.Async(`lsof -i :${port} -P -n | grep LIST.E.N | head -1`);
        if (stdout) {
          const parts = stdouttrim()split(/\s+/);
          return {
            service: parts[0],
            pid: parse.Int(parts[1], 10)}}} else if (thisplatform === 'win32') {
        const { stdout } = await exec.Async(`netstat -ano | findstr :${port}`);
        if (stdout) {
          const parts = stdouttrim()split(/\s+/);
          const pid = parse.Int(parts[partslength - 1], 10);
          const { stdout: process.Info } = await exec.Async(`tasklist /F.I "P.I.D eq ${pid}" /F.O C.S.V`),
          const process.Name = process.Infosplit(',')[0]replace(/"/g, '');
          return {
            service: process.Name,
            pid;
          }}}} catch {
      // Command failed, port might be available;
    return null;

  private async discover.Unix.Services(discovered: Map<string, Port.Status>): Promise<void> {
    try {
      // Get all listening ports;
      const { stdout } = await exec.Async('lsof -i -P -n | grep LIST.E.N');
      const lines = stdoutsplit('\n')filter((line) => linetrim());
      for (const line of lines) {
        const parts = linesplit(/\s+/);
        const port.Match = parts[8]?match(/:(\d+)$/);
        if (port.Match) {
          const port = parse.Int(port.Match[1], 10);
          const service.Name = parts[0]// Check if this matches any of our configured services;
          for (const [name, config] of thisservices) {
            if (configdefault.Port === port || configfallback.Portsincludes(port)) {
              const health.Status = await thischeck.Service.Health(config, port);
              discoveredset(name, {
                port;
                available: false,
                service: service.Name,
                pid: parse.Int(parts[1], 10);
                last.Checked: new Date(),
                health.Status})}}}}} catch {
      // lsof might not be available or might fail};

  private async discover.Windows.Services(discovered: Map<string, Port.Status>): Promise<void> {
    try {
      const { stdout } = await exec.Async('netstat -ano | findstr LISTENI.N.G');
      const lines = stdoutsplit('\n')filter((line) => linetrim());
      for (const line of lines) {
        const parts = linetrim()split(/\s+/);
        const address.Parts = parts[1]?split(':');
        if (address.Parts && address.Partslength > 1) {
          const port = parse.Int(address.Parts[address.Partslength - 1], 10);
          const pid = parse.Int(parts[partslength - 1], 10)// Get process name;
          try {
            const { stdout: process.Info } = await exec.Async(`tasklist /F.I "P.I.D eq ${pid}" /F.O C.S.V`),
            const process.Name = process.Infosplit('\n')[1]?split(',')[0]?replace(/"/g, '')// Check if this matches any of our configured services;
            for (const [name, config] of thisservices) {
              if (configdefault.Port === port || configfallback.Portsincludes(port)) {
                const health.Status = await thischeck.Service.Health(config, port);
                discoveredset(name, {
                  port;
                  available: false,
                  service: process.Name || 'unknown',
                  pid;
                  last.Checked: new Date(),
                  health.Status})}}} catch {
            // Process info might fail}}}} catch {
      // netstat might fail}}}// Export singleton instance for convenience;
export const port.Manager = new Smart.Port.Manager()// Export utility functions;
export async function quick.Port.Check(port: number): Promise<boolean> {
  return portManagercheck.Port.Availability(port);

export async function find.Free.Port(start.Port = 3000): Promise<number> {
  return portManagerfind.Available.Port(start.Port);

export async function auto.Configure.Ports(): Promise<Port.Configuration> {
  const config = await portManagergenerateOptimal.Port.Config();
  await portManagersave.Port.Configuration(config);
  return config;
