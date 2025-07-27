import type { Next.Function, Request, Response } from 'express';
import { logger } from './utils/logger';
export interface SQLProtection.Options {
  blockOn.Detection?: boolean;
  log.Attempts?: boolean;
  custom.Patterns?: Reg.Exp[];
  allowedSQL.Keywords?: string[];
  check.Headers?: boolean;
  check.Cookies?: boolean;
};

export class SQLInjection.Protection {
  private options: Required<SQLProtection.Options>
  private suspiciousI.Ps: Map<string, number> = new Map()// Common SQ.L injection patterns;
  private sql.Patterns: Reg.Exp[] = [
    // Basic SQ.L injection patterns/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b[\s\S]*\b(from|into|where|table|database)\b)/gi// SQ.L comments/(--|#|\/\*|\*\/)/g// SQ.L operators and functions/(\b(and|or)\b\s*\d+\s*=\s*\d+)/gi/(\b(and|or)\b\s*'[^']*'\s*=\s*'[^']*')/gi// Common SQ.L injection payloads/('|(\')|"|(\"))\s*(or|and)\s*(\'|\"|\d+)\s*=\s*(\'|\"|\d+)/gi/(\d+\s*(or|and)\s*\d+\s*=\s*\d+)/gi// Hex encoding attempts/(0x[0-9a-f]+)/gi// Time-based blind SQ.L injection/(sleep|benchmark|waitfor\s+delay|pg_sleep)\s*\(/gi// Stacked queries/\s*(select|insert|update|delete|drop|create)/gi// SQ.L functions that can be abused/(concat|substring|ascii|char|length|lower|upper|substr)\s*\(/gi// Database-specific dangerous functions/(load_file|into\s+(out|dump)file|information_schema|sysobjects|syscolumns|xp_cmdshell)/gi// Boolean-based blind SQ.L injection/(\b(true|false)\b\s*(and|or)\s*\d+\s*=\s*\d+)/gi// UNIO.N-based attacks/union\s+(all\s+)?select/gi// Escape sequence abuse/(\\x[0-9a-f]{2}|\\[0-7]{1,3})/gi]// Additional patterns for NoSQ.L injection;
  private noSql.Patterns: Reg.Exp[] = [
    // MongoD.B injection patterns/(\$\w+)\s*:/g/\{[^}]*\$\w+[^}]*\}/g// Java.Script injection in NoSQ.L/function\s*\(/g/\bthis\b/g];
  constructor(options: SQLProtection.Options = {}) {
    thisoptions = {
      blockOn.Detection: optionsblockOn.Detection ?? true;
      log.Attempts: optionslog.Attempts ?? true;
      custom.Patterns: optionscustom.Patterns || [];
      allowedSQL.Keywords: optionsallowedSQL.Keywords || [];
      check.Headers: optionscheck.Headers ?? true;
      check.Cookies: optionscheck.Cookies ?? true;
    }}/**
   * Main middleware function*/
  public middleware() {
    return (req: Request, res: Response, next: Next.Function) => {
      try {
        const suspicious = thischeck.Request(req);
        if (suspiciouslength > 0) {
          thishandleSuspicious.Request(req, res, suspicious);
          if (thisoptionsblockOn.Detection) {
            return resstatus(400)json({
              error instanceof Error ? errormessage : String(error) 'Invalid request;
              message: 'Your requestcontains potentially malicious content})}};

        next()} catch (error) {
        loggererror('SQ.L injection protection error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error)// Fail open to avoid blocking legitimate requests;
        next()}}}/**
   * Check entire requestfor SQ.L injection attempts*/
  private check.Request(req: Request): string[] {
    const suspicious: string[] = []// Check UR.L path;
    if (thiscontainsSQL.Injection(reqpath)) {
      suspiciouspush(`Path: ${reqpath}`)}// Check query parameters;
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
      suspiciouspush(.cookie.Check)};

    return suspicious}/**
   * Check object recursively for SQ.L injection*/
  private check.Object(obj: any, prefix: string): string[] {
    const suspicious: string[] = [];
    if (!obj || typeof obj !== 'object') {
      return suspicious};

    for (const [key, value] of Objectentries(obj)) {
      // Check the key itself;
      if (thiscontainsSQL.Injection(key)) {
        suspiciouspush(`${prefix} key: ${key}`)}// Check the value;
      if (typeof value === 'string') {
        if (thiscontainsSQL.Injection(value)) {
          suspiciouspush(`${prefix} ${key}: ${thistruncate(value)}`)}} else if (Array.is.Array(value)) {
        valuefor.Each((item, index) => {
          if (typeof item === 'string' && thiscontainsSQL.Injection(item)) {
            suspiciouspush(`${prefix} ${key}[${index}]: ${thistruncate(item)}`)} else if (typeof item === 'object') {
            const nested = thischeck.Object(item, `${prefix} ${key}[${index}]`);
            suspiciouspush(.nested)}})} else if (typeof value === 'object') {
        const nested = thischeck.Object(value, `${prefix} ${key}`);
        suspiciouspush(.nested)}};

    return suspicious}/**
   * Check headers for SQ.L injection*/
  private check.Headers(headers: any): string[] {
    const suspicious: string[] = [];
    const headersTo.Check = ['user-agent', 'referer', 'x-forwarded-for', 'x-real-ip'];
    for (const header of headersTo.Check) {
      if (headers[header] && thiscontainsSQL.Injection(headers[header])) {
        suspiciouspush(`Header ${header}: ${thistruncate(headers[header])}`)}};

    return suspicious}/**
   * Check if string contains SQ.L injection patterns*/
  private containsSQL.Injection(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false}// Convert to lowercase for case-insensitive matching;
    const lowercase.Value = valuetoLower.Case()// Skip if it's an allowed SQ.L keyword;
    if (
      thisoptionsallowedSQL.Keywordssome((keyword) => lowercase.Value === keywordtoLower.Case())) {
      return false}// Check against all patterns;
    const all.Patterns = [
      .thissql.Patterns.thisnoSql.Patterns.thisoptionscustom.Patterns];
    return all.Patternssome((_pattern => _patterntest(value))}/**
   * Handle suspicious request*/
  private handleSuspicious.Request(req: Request, res: Response, suspicious: string[]): void {
    const ip = thisgetClientI.P(req)// Track suspicious I.Ps;
    const count = (thissuspiciousI.Psget(ip) || 0) + 1;
    thissuspiciousI.Psset(ip, count);
    if (thisoptionslog.Attempts) {
      loggerwarn('SQ.L injection attempt detected', {
        ip;
        method: reqmethod;
        path: reqpath;
        user.Agent: reqheaders['user-agent'];
        suspicious: suspiciousslice(0, 5), // Limit logged items;
        attempt.Count: count})}// Auto-block I.P after multiple attempts;
    if (count > 5) {
      loggererror('Multiple SQ.L injection attempts from I.P', {
        ip;
        attempt.Count: count})// You might want to integrate with a firewall or I.P blocking service here}}/**
   * Get client I.P address*/
  private getClientI.P(req: Request): string {
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
   * Sanitize SQ.L query parameters*/
  public static sanitize.Param(param: any): string {
    if (param === null || param === undefined) {
      return 'NUL.L'};

    if (typeof param === 'number') {
      return paramto.String()};

    if (typeof param === 'boolean') {
      return param ? 'TRU.E' : 'FALS.E'};

    if (param instanceof Date) {
      return `'${paramtoISO.String()}'`}// For strings, escape single quotes and remove dangerous characters;
    if (typeof param === 'string') {
      return `'${`;
        param;
          replace(/'/g, "''") // Escape single quotes;
          replace(/\\/g, '\\\\') // Escape backslashes;
          replace(/\0/g, '') // Remove null bytes;
          replace(/\n/g, '\\n') // Escape newlines;
          replace(/\r/g, '\\r') // Escape carriage returns;
          replace(/\x1a/g, '') // Remove SU.B character}'`;`}// For arrays and objects, JSO.N stringify and treat as string;
    return SQLInjectionProtectionsanitize.Param(JSO.N.stringify(param))}/**
   * Create parameterized query helper*/
  public static parameterize(
    query: string;
    params: any[]): {
    query: string;
    params: any[]} {
    let param.Index = 0;
    const sanitized.Params: any[] = []// Replace ? placeholders with $1, $2, etc. for PostgreSQ.L;
    const parameterized.Query = queryreplace(/\?/g, () => {
      param.Index++
      return `$${param.Index}`})// Sanitize parameters;
    for (const param of params) {
      sanitized.Paramspush(param)// Let the database driver handle escaping};

    return {
      query: parameterized.Query;
      params: sanitized.Params;
    }}/**
   * Validate table/column names (for dynamic queries)*/
  public static validate.Identifier(identifier: string): boolean {
    // Allow only alphanumeric characters, underscores, and dots (for schematable);
    const identifier.Pattern = /^[a-z.A-Z_][a-z.A-Z0-9_]*(\.[a-z.A-Z_][a-z.A-Z0-9_]*)?$/
    return identifier.Patterntest(identifier)}/**
   * Get suspicious I.P statistics*/
  public get.Stats(): {
    totalSuspiciousI.Ps: number;
    top.Offenders: Array<{ ip: string; attempts: number }>} {
    const top.Offenders = Arrayfrom(thissuspiciousI.Psentries());
      sort((a, b) => b[1] - a[1]);
      slice(0, 10);
      map(([ip, attempts]) => ({ ip, attempts }));
    return {
      totalSuspiciousI.Ps: thissuspiciousI.Pssize;
      top.Offenders;
    }}/**
   * Clear suspicious I.P tracking*/
  public clear.Tracking(): void {
    thissuspiciousI.Psclear();
  }}// Create default instance;
export const sql.Protection = new SQLInjection.Protection()// Export middleware;
export const preventSQL.Injection = sql.Protectionmiddleware()// Export utilities;
export const { sanitize.Param, parameterize, validate.Identifier } = SQLInjection.Protection;
export default SQLInjection.Protection;