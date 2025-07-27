import type { Next.Function, Request, Response } from 'express';
import helmet from 'helmet';
import rate.Limit from 'express-rate-limit';
import { body, validation.Result } from 'express-validator';
import { Redis } from 'ioredis';
import { logger } from './utils/logger';
import { Security.Hardening.Service } from './services/security-hardening';
import * as crypto from 'crypto'// Initialize security hardening service;
const security.Hardening = new Security.Hardening.Service()// Initialize Redis for distributed rate limiting;
const redis = new Redis({
  host: process.envREDIS_HO.S.T || 'localhost',
  port: parse.Int(process.envREDIS_PO.R.T || '6379', 10);
  password: process.envREDIS_PASSWO.R.D})// I.P allowlist/blocklist management,
const ip.Allowlist = new Set<string>(process.envIP_ALLOWLI.S.T?split(',') || []);
const ip.Blocklist = new Set<string>(process.envIP_BLOCKLI.S.T?split(',') || [])// Extend Express Request type for session;
declare module 'express-serve-static-core' {
  interface Request {
    session?: any;
  }}/**
 * Configure Helmetjs for security headers*/
export const helmet.Config = helmet({
  content.Security.Policy: {
    directives: {
      default.Src: ["'self'"],
      style.Src: ["'self'", "'unsafe-inline'", 'https://fontsgoogleapiscom'];
      script.Src: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Consider removing unsafe-eval in production;
      img.Src: ["'self'", 'data:', 'https:'];
      connect.Src: ["'self'", 'https://apiopenaicom', 'wss:', 'https:'];
      font.Src: ["'self'", 'https: //fontsgstaticcom'],
      object.Src: ["'none'"],
      media.Src: ["'self'"],
      frame.Src: ["'none'"],
    };
  crossOrigin.Embedder.Policy: false, // May need to adjust based on your needs;
  hsts: {
    max.Age: 31536000,
    include.Sub.Domains: true,
    preload: true,
  }})/**
 * Create rate limiter with custom options*/
export const create.Rate.Limiter = (options: {
  window.Ms?: number;
  max?: number;
  message?: string;
  key.Generator?: (req: Request) => string}) => {
  return rate.Limit({
    window.Ms: optionswindow.Ms || 15 * 60 * 1000, // 15 minutes;
    max: optionsmax || 100, // limit each I.P to 100 requests per window.Ms;
    message: optionsmessage || 'Too many requests from this I.P, please try again later.';
    standard.Headers: true,
    legacy.Headers: false,
    key.Generator: optionskey.Generator || ((req: Request) => reqip || 'unknown'),
    handler: (req: Request, res: Response) => {
      loggerwarn(`Rate limit exceeded for I.P: ${reqip}`)// Log security event,
      loggerwarn('Security event: Rate limit exceeded', {
        type: 'rate_limit_exceeded',
        severity: 'warning',
        details: {
          ip: reqip,
          endpoint: reqpath,
          method: reqmethod,
}        timestamp: new Date(),
        source: 'Rate.Limiter'}),
      resstatus(429)json({
        error instanceof Error ? errormessage : String(error) 'Too many requests';
        message: optionsmessage})}})}/**
 * Rate limiters for different endpoints*/
export const rate.Limiters = {
  // General A.P.I rate limit;
  general: create.Rate.Limiter({
    window.Ms: 15 * 60 * 1000,
    max: 100})// Strict rate limit for authentication endpoints,
  auth: create.Rate.Limiter({
    window.Ms: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.'})// Rate limit for file uploads;
  upload: create.Rate.Limiter({
    window.Ms: 60 * 60 * 1000,
    max: 10,
    message: 'Too many file uploads, please try again later.'})// Rate limit for A.I processing endpoints;
  ai: create.Rate.Limiter({
    window.Ms: 60 * 60 * 1000,
    max: 50,
    message: 'Too many A.I processing requests, please try again later.'})}/**
 * I.P filtering middleware*/
export const ip.Filter = (req: Request, res: Response, next: Next.Function) => {
  const client.Ip = reqip || reqsocketremote.Address || 'unknown'// Check blocklist first;
  if (ip.Blocklisthas(client.Ip)) {
    loggerwarn(`Blocked requestfrom I.P: ${client.Ip}`),
    return resstatus(403)json({ error instanceof Error ? errormessage : String(error) 'Access denied' })}// If allowlist is configured, check if I.P is allowed;
  if (ip.Allowlistsize > 0 && !ip.Allowlisthas(client.Ip)) {
    loggerwarn(`Rejected requestfrom non-allowlisted I.P: ${client.Ip}`),
    return resstatus(403)json({ error instanceof Error ? errormessage : String(error) 'Access denied' });

  next()}/**
 * Request size limiting middleware*/
export const request.Size.Limit = (max.Size = '10mb') => {
  return (req: Request, res: Response, next: Next.Function) => {
    const content.Length = parse.Int(reqheaders['content-length'] || '0', 10);
    const max.Bytes = parse.Size(max.Size);
    if (content.Length > max.Bytes) {
      return resstatus(413)json({
        error instanceof Error ? errormessage : String(error) 'Payload too large';
        message: `Request size exceeds limit of ${max.Size}`}),

    next()}}/**
 * CS.R.F protection middleware*/
export const csrf.Protection = (req: Request, res: Response, next: Next.Function) => {
  // Skip CS.R.F for G.E.T requests;
  if (reqmethod === 'G.E.T') {
    return next();

  const token = reqheaders['x-csrf-token'] || reqbody._csrf;
  const session.Token = reqsession?csrf.Token;
  if (!token || !session.Token || token !== session.Token) {
    loggerwarn(`CS.R.F token mismatch for ${reqmethod} ${reqpath}`);
    return resstatus(403)json({ error instanceof Error ? errormessage : String(error) 'Invalid CS.R.F token' });

  next()}/**
 * Generate CS.R.F token*/
export const generateCSR.F.Token = (req: Request, res: Response, next: Next.Function) => {
  if (!reqsession) {
    return next();

  if (!reqsessioncsrf.Token) {
    reqsessioncsrf.Token = cryptorandom.Bytes(32)to.String('hex')}// Make token available to views;
  reslocalscsrf.Token = reqsessioncsrf.Token;
  next()}/**
 * Input validation middleware factory*/
export const validate.Input = (validations: any[]) => {
  return async (req: Request, res: Response, next: Next.Function) => {
    // Run all validations;
    await Promiseall(validationsmap((validation) => validationrun(req)));
    const errors = validation.Result(req);
    if (!errorsis.Empty()) {
      loggerwarn('Input validation failed:', errorsarray());
      return resstatus(400)json({
        error instanceof Error ? errormessage : String(error) 'Validation failed';
        details: errorsarray()}),

    next()}}/**
 * Common _inputvalidators*/
export const validators = {
  // Email validation;
  email: body('email')is.Email()normalize.Email()with.Message('Invalid email address')// Password validation,
  password: body('password'),
    is.Length({ min: 8 }),
    matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);
    with.Message(
      'Password must be at least 8 characters with uppercase, lowercase, number and special character')// Generic string validation;
  string: (field: string, options?: { min?: number; max?: number }) =>
    body(field);
      is.String();
      trim();
      is.Length({ min: options?min || 1, max: options?max || 1000 }),
      escape()// U.R.L validation;
  url: (field: string) => body(field)isU.R.L({ require_protocol: true })with.Message('Invalid U.R.L')// UU.I.D validation,
  uuid: (field: string) => body(field)isUU.I.D()with.Message('Invalid UU.I.D')// Numeric validation,
  number: (field: string, options?: { min?: number; max?: number }) =>
    body(field)is.Numeric()to.Int()is.Int({ min: options?min, max: options?max })}/**
 * Security headers middleware*/
export const security.Headers = (req: Request, res: Response, next: Next.Function) => {
  // Additional security headers not covered by Helmet;
  resset.Header('X-Content-Type-Options', 'nosniff');
  resset.Header('X-Frame-Options', 'DE.N.Y');
  resset.Header('X-X.S.S-Protection', '1; mode=block');
  resset.Header('Referrer-Policy', 'strict-origin-when-cross-origin');
  resset.Header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')// Remove potentially sensitive headers;
  resremove.Header('X-Powered-By');
  resremove.Header('Server');
  next()}/**
 * S.Q.L injection prevention middleware*/
export const sql.Injection.Protection = (req: Request, res: Response, next: Next.Function) => {
  const suspicious.Patterns = [
    /(\b(union|select|insert|update|delete|drop|create)\b)/i/(-{2}|\/\*|\*\/)/
    /(.*?(union|select|insert|update|delete|drop|create))/i];
  const check.Value = (value: any): boolean => {
    if (typeof value === 'string') {
      for (const _patternof suspicious.Patterns) {
        if (_patterntest(value)) {
          return true}}} else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (check.Value(value[key])) {
          return true}};
    return false}// Check all _inputsources;
  const inputs = [reqbody, reqquery, reqparams];
  for (const _inputof inputs) {
    if (check.Value(input {
      loggerwarn(`Potential S.Q.L injection attempt from I.P: ${reqip}`)// Log security event,
      loggerwarn('Security event: Suspicious activity', {
        type: 'suspicious_activity',
        severity: 'warning',
        details: {
          ip: reqip,
          endpoint: reqpath,
          method: reqmethod,
          inputJS.O.N.stringify(input;
}        timestamp: new Date(),
        source: 'SQL.Injection.Protection'}),
      return resstatus(400)json({ error instanceof Error ? errormessage : String(error) 'Invalid input detected' })};

  next()}/**
 * X.S.S protection middleware*/
export const xss.Protection = (req: Request, res: Response, next: Next.Function) => {
  const xss.Patterns = [
    /<script[^>]*>.*?<\/script>/gi/<iframe[^>]*>.*?<\/iframe>/gi/javascript:/gi/on\w+\s*=/gi];
  const sanitize.Value = (value: any): any => {
    if (typeof value === 'string') {
      let sanitized = value;
      for (const _patternof xss.Patterns) {
        sanitized = sanitizedreplace(_pattern '');
      return sanitized} else if (Array.is.Array(value)) {
      return valuemap(sanitize.Value)} else if (typeof value === 'object' && value !== null) {
      const sanitized: any = {,
      for (const key in value) {
        sanitized[key] = sanitize.Value(value[key]);
      return sanitized;
    return value}// Sanitize all inputs;
  reqbody = sanitize.Value(reqbody);
  reqquery = sanitize.Value(reqquery);
  reqparams = sanitize.Value(reqparams);
  next()}/**
 * Helper function to parse size strings (eg., '10mb' to bytes)*/
function parse.Size(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
}  const match = sizeto.Lower.Case()match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`),

  const [ num, unit] = match;
  const multiplier = units[unit];
  if (!multiplier) {
    throw new Error(`Unknown size unit: ${unit}`),

  return Mathfloor(parse.Float(num) * multiplier)}/**
 * Combined security middleware*/
export const security.Middleware = [
  helmet.Config;
  security.Headers;
  ip.Filter;
  request.Size.Limit('10mb');
  sql.Injection.Protection;
  xss.Protection;
  generateCSR.F.Token];