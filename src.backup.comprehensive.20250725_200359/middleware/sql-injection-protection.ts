import type { Next.Function, Request, Response } from 'express';
import { logger } from './utils/logger';
export interface SQL.Protection.Options {
  block.On.Detection?: boolean;
  log.Attempts?: boolean;
  custom.Patterns?: Reg.Exp[];
  allowedSQ.L.Keywords?: string[];
  check.Headers?: boolean;
  check.Cookies?: boolean;
}
export class SQL.Injection.Protection {
  private options: Required<SQL.Protection.Options>
  private suspicious.I.Ps: Map<string, number> = new Map()// Common S.Q.L injection patterns;
  private sql.Patterns: Reg.Exp[] = [
    // Basic S.Q.L injection patterns/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b[\s\S]*\b(from|into|where|table|database)\b)/gi// S.Q.L comments/(--|#|\/\*|\*\/)/g// S.Q.L operators and functions/(\b(and|or)\b\s*\d+\s*=\s*\d+)/gi/(\b(and|or)\b\s*'[^']*'\s*=\s*'[^']*')/gi// Common S.Q.L injection payloads/('|(\')|"|(\"))\s*(or|and)\s*(\'|\"|\d+)\s*=\s*(\'|\"|\d+)/gi/(\d+\s*(or|and)\s*\d+\s*=\s*\d+)/gi// Hex encoding attempts/(0x[0-9a-f]+)/gi// Time-based blind S.Q.L injection/(sleep|benchmark|waitfor\s+delay|pg_sleep)\s*\(/gi// Stacked queries/\s*(select|insert|update|delete|drop|create)/gi// S.Q.L functions that can be abused/(concat|substring|ascii|char|length|lower|upper|substr)\s*\(/gi// Database-specific dangerous functions/(load_file|into\s+(out|dump)file|information_schema|sysobjects|syscolumns|xp_cmdshell)/gi// Boolean-based blind S.Q.L injection/(\b(true|false)\b\s*(and|or)\s*\d+\s*=\s*\d+)/gi// UNI.O.N-based attacks/union\s+(all\s+)?select/gi// Escape sequence abuse/(\\x[0-9a-f]{2}|\\[0-7]{1,3})/gi]// Additional patterns for NoS.Q.L injection;
  private no.Sql.Patterns: Reg.Exp[] = [
    // Mongo.D.B injection patterns/(\$\w+)\s*:/g/\{[^}]*\$\w+[^}]*\}/g// Java.Script injection in NoS.Q.L/function\s*\(/g/\bthis\b/g];
  constructor(options: SQL.Protection.Options = {}) {
    thisoptions = {
      block.On.Detection: optionsblock.On.Detection ?? true,
      log.Attempts: optionslog.Attempts ?? true,
      custom.Patterns: optionscustom.Patterns || [],
      allowedSQ.L.Keywords: optionsallowedSQ.L.Keywords || [],
      check.Headers: optionscheck.Headers ?? true,
      check.Cookies: optionscheck.Cookies ?? true,
    }}/**
   * Main middleware function*/
  public middleware() {
    return (req: Request, res: Response, next: Next.Function) => {
      try {
        const suspicious = thischeck.Request(req);
        if (suspiciouslength > 0) {
          thishandle.Suspicious.Request(req, res, suspicious);
          if (thisoptionsblock.On.Detection) {
            return resstatus(400)json({
              error instanceof Error ? errormessage : String(error) 'Invalid request;
              message: 'Your requestcontains potentially malicious content})},

        next()} catch (error) {
        loggererror('S.Q.L injection protection error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error)// Fail open to avoid blocking legitimate requests;
        next()}}}/**
   * Check entire requestfor S.Q.L injection attempts*/
  private check.Request(req: Request): string[] {
    const suspicious: string[] = []// Check U.R.L path,
    if (thiscontainsSQ.L.Injection(reqpath)) {
      suspiciouspush(`Path: ${reqpath}`)}// Check query parameters,
    if (reqquery) {
      const query.Check = thischeck.Object(reqquery, 'Query');
      suspiciouspush(.query.Check)}// Check body;
    if (reqbody) {
      const body.Check = thischeck.Object(reqbody, 'Body');
      suspiciouspush(.body.Check)}// Check headers if enabled;
    if (thisoptionscheck.Headers && reqheaders) {
      const header.Check = thischeck.Headers(reqheaders);
      suspiciouspush(.header.Check)}// Check cookies if enabled;
    if (thisoptionscheck.Cookies && reqcookies) {
      const cookie.Check = thischeck.Object(reqcookies, 'Cookie');
      suspiciouspush(.cookie.Check);

    return suspicious}/**
   * Check object recursively for S.Q.L injection*/
  private check.Object(obj: any, prefix: string): string[] {
    const suspicious: string[] = [],
    if (!obj || typeof obj !== 'object') {
      return suspicious;

    for (const [key, value] of Objectentries(obj)) {
      // Check the key itself;
      if (thiscontainsSQ.L.Injection(key)) {
        suspiciouspush(`${prefix} key: ${key}`)}// Check the value,
      if (typeof value === 'string') {
        if (thiscontainsSQ.L.Injection(value)) {
          suspiciouspush(`${prefix} ${key}: ${thistruncate(value)}`)}} else if (Array.is.Array(value)) {
        valuefor.Each((item, index) => {
          if (typeof item === 'string' && thiscontainsSQ.L.Injection(item)) {
            suspiciouspush(`${prefix} ${key}[${index}]: ${thistruncate(item)}`)} else if (typeof item === 'object') {
            const nested = thischeck.Object(item, `${prefix} ${key}[${index}]`);
            suspiciouspush(.nested)}})} else if (typeof value === 'object') {
        const nested = thischeck.Object(value, `${prefix} ${key}`);
        suspiciouspush(.nested)};

    return suspicious}/**
   * Check headers for S.Q.L injection*/
  private check.Headers(headers: any): string[] {
    const suspicious: string[] = [],
    const headers.To.Check = ['user-agent', 'referer', 'x-forwarded-for', 'x-real-ip'];
    for (const header of headers.To.Check) {
      if (headers[header] && thiscontainsSQ.L.Injection(headers[header])) {
        suspiciouspush(`Header ${header}: ${thistruncate(headers[header])}`)};

    return suspicious}/**
   * Check if string contains S.Q.L injection patterns*/
  private containsSQ.L.Injection(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false}// Convert to lowercase for case-insensitive matching;
    const lowercase.Value = valueto.Lower.Case()// Skip if it's an allowed S.Q.L keyword;
    if (
      thisoptionsallowedSQ.L.Keywordssome((keyword) => lowercase.Value === keywordto.Lower.Case())) {
      return false}// Check against all patterns;
    const all.Patterns = [
      .thissql.Patterns.thisno.Sql.Patterns.thisoptionscustom.Patterns];
    return all.Patternssome((_pattern => _patterntest(value))}/**
   * Handle suspicious request*/
  private handle.Suspicious.Request(req: Request, res: Response, suspicious: string[]): void {
    const ip = thisgetClient.I.P(req)// Track suspicious I.Ps;
    const count = (thissuspicious.I.Psget(ip) || 0) + 1;
    thissuspicious.I.Psset(ip, count);
    if (thisoptionslog.Attempts) {
      loggerwarn('S.Q.L injection attempt detected', {
        ip;
        method: reqmethod,
        path: reqpath,
        user.Agent: reqheaders['user-agent'],
        suspicious: suspiciousslice(0, 5), // Limit logged items;
        attempt.Count: count})}// Auto-block I.P after multiple attempts,
    if (count > 5) {
      loggererror('Multiple S.Q.L injection attempts from I.P', {
        ip;
        attempt.Count: count})// You might want to integrate with a firewall or I.P blocking service here}}/**
   * Get client I.P address*/
  private getClient.I.P(req: Request): string {
    return (
      (reqheaders['x-forwarded-for'] as string) ||
      (reqheaders['x-real-ip'] as string) ||
      reqconnectionremote.Address ||
      reqsocketremote.Address ||
      'unknown');
      split(',')[0];
      trim()}/**
   * Truncate string for logging*/
  private truncate(str: string, length = 100): string {
    return strlength > length ? `${strsubstring(0, length)}.` : str}/**
   * Sanitize S.Q.L query parameters*/
  public static sanitize.Param(param: any): string {
    if (param === null || param === undefined) {
      return 'NU.L.L';

    if (typeof param === 'number') {
      return paramto.String();

    if (typeof param === 'boolean') {
      return param ? 'TR.U.E' : 'FAL.S.E';

    if (param instanceof Date) {
      return `'${paramtoIS.O.String()}'`}// For strings, escape single quotes and remove dangerous characters;
    if (typeof param === 'string') {
      return `'${`;
        param;
          replace(/'/g, "''") // Escape single quotes;
          replace(/\\/g, '\\\\') // Escape backslashes;
          replace(/\0/g, '') // Remove null bytes;
          replace(/\n/g, '\\n') // Escape newlines;
          replace(/\r/g, '\\r') // Escape carriage returns;
          replace(/\x1a/g, '') // Remove S.U.B character}'`;`}// For arrays and objects, JS.O.N stringify and treat as string;
    return SQLInjection.Protectionsanitize.Param(JS.O.N.stringify(param))}/**
   * Create parameterized query helper*/
  public static parameterize(
    query: string,
    params: any[]): {
    query: string,
    params: any[]} {
    let param.Index = 0;
    const sanitized.Params: any[] = []// Replace ? placeholders with $1, $2, etc. for PostgreS.Q.L;
    const parameterized.Query = queryreplace(/\?/g, () => {
      param.Index++
      return `$${param.Index}`})// Sanitize parameters;
    for (const param of params) {
      sanitized.Paramspush(param)// Let the database driver handle escaping;

    return {
      query: parameterized.Query,
      params: sanitized.Params,
    }}/**
   * Validate table/column names (for dynamic queries)*/
  public static validate.Identifier(identifier: string): boolean {
    // Allow only alphanumeric characters, underscores, and dots (for schematable);
    const identifier.Pattern = /^[a-z.A-Z_][a-z.A-Z0-9_]*(\.[a-z.A-Z_][a-z.A-Z0-9_]*)?$/
    return identifier.Patterntest(identifier)}/**
   * Get suspicious I.P statistics*/
  public get.Stats(): {
    totalSuspicious.I.Ps: number,
    top.Offenders: Array<{ ip: string; attempts: number }>} {
    const top.Offenders = Arrayfrom(thissuspicious.I.Psentries());
      sort((a, b) => b[1] - a[1]);
      slice(0, 10);
      map(([ip, attempts]) => ({ ip, attempts }));
    return {
      totalSuspicious.I.Ps: thissuspicious.I.Pssize,
      top.Offenders;
    }}/**
   * Clear suspicious I.P tracking*/
  public clear.Tracking(): void {
    thissuspicious.I.Psclear();
  }}// Create default instance;
export const sql.Protection = new SQL.Injection.Protection()// Export middleware;
export const preventSQ.L.Injection = sql.Protectionmiddleware()// Export utilities;
export const { sanitize.Param, parameterize, validate.Identifier } = SQL.Injection.Protection;
export default SQL.Injection.Protection;