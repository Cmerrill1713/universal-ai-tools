import type { Next.Function, Request, Response } from 'express';
import type { Zod.Error, Zod.Schema } from 'zod';
import { z } from 'zod';
import { Log.Context, logger } from './utils/enhanced-logger';
import { Validation.Middleware } from './validation';
import { request.Size.Limit, sanitize.Request } from './requestvalidation';
import { SQL.Injection.Protection } from './sql-injection-protection';
export interface Comprehensive.Validation.Options {
  body?: Zod.Schema;
  query?: Zod.Schema;
  params?: Zod.Schema;
  headers?: Zod.Schema;
  strip.Unknown?: boolean;
  enableSQ.L.Protection?: boolean;
  enable.Sanitization?: boolean;
  enable.Size.Limit?: boolean;
  custom.Validators?: Array<
    (req: Request, res: Response, next: Next.Function) => void | Promise<void>
  >
}/**
 * Comprehensive validation middleware that combines:
 * - Zod schema validation* - S.Q.L injection protection* - X.S.S prevention* - Input sanitization* - Request size limiting* - Custom security validators*/
export class Comprehensive.Validation.Middleware {
  private sql.Protection: SQL.Injection.Protection,
  constructor() {
    thissql.Protection = new SQL.Injection.Protection();
  }/**
   * Create comprehensive validation middleware*/
  public validate(options: Comprehensive.Validation.Options = {}) {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        // Apply requestsize limiting;
        if (optionsenable.Size.Limit !== false) {
          await thisapplyRequest.Size.Limit(req, res)}// Apply S.Q.L injection protection;
        if (optionsenableSQ.L.Protection !== false) {
          await thisapplySQ.L.Protection(req, res)}// Apply _inputsanitization;
        if (optionsenable.Sanitization !== false) {
          await thisapply.Sanitization(req, res)}// Apply Zod schema validation;
        await thisapply.Schema.Validation(req, res, options)// Apply custom validators;
        if (optionscustom.Validators) {
          for (const validator of optionscustom.Validators) {
            await validator(req, res, next)}}// Log successful validation;
        loggerdebug('Request validation completed successfully', LogContextSECURI.T.Y, {
          method: reqmethod,
          path: reqpath,
          user.Agent: reqget('User-Agent'),
          validation.Enabled: {
            size.Limit: optionsenable.Size.Limit !== false,
            sql.Protection: optionsenableSQ.L.Protection !== false,
            sanitization: optionsenable.Sanitization !== false,
            schema.Validation: !!(
              optionsbody ||
              optionsquery ||
              optionsparams ||
              optionsheaders);
          }});
        next()} catch (error) {
        thishandle.Validation.Error(error instanceof Error ? errormessage : String(error) req, res, next)}}}/**
   * Apply requestsize limiting*/
  private async applyRequest.Size.Limit(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      request.Size.Limit(req, res, (error instanceof Error ? errormessage : String(error)=> {
        if (error instanceof Error ? errormessage : String(error){
          reject(new Validation.Error('Request size exceeds limit', 413, 'SIZE_LIMIT_EXCEED.E.D'))} else {
          resolve()}})})}/**
   * Apply S.Q.L injection protection*/
  private async applySQ.L.Protection(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      thissql.Protectionmiddleware()(req, res, (error instanceof Error ? errormessage : String(error)=> {
        if (error instanceof Error ? errormessage : String(error){
          reject(
            new Validation.Error('S.Q.L injection attempt detected', 400, 'SQL_INJECTION_DETECT.E.D'))} else {
          resolve()}})})}/**
   * Apply _inputsanitization*/
  private async apply.Sanitization(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      sanitize.Request(req, res, (error instanceof Error ? errormessage : String(error)=> {
        if (error instanceof Error ? errormessage : String(error){
          reject(new Validation.Error('Input sanitization failed', 400, 'SANITIZATION_FAIL.E.D'))} else {
          resolve()}})})}/**
   * Apply Zod schema validation*/
  private async apply.Schema.Validation(
    req: Request,
    res: Response,
    options: Comprehensive.Validation.Options): Promise<void> {
    const validation.Options = {
      body: optionsbody,
      query: optionsquery,
      params: optionsparams,
      headers: optionsheaders,
      strip.Unknown: optionsstrip.Unknown}// Only apply validation if schemas are provided,
    if (
      validation.Optionsbody ||
      validation.Optionsquery ||
      validation.Optionsparams ||
      validation.Optionsheaders) {
      return new Promise((resolve, reject) => {
        Validation.Middlewarevalidate(validation.Options)(req, res, (error instanceof Error ? errormessage : String(error)=> {
          if (error instanceof Error ? errormessage : String(error){
            reject(error instanceof Error ? errormessage : String(error)} else {
            resolve()}})})}}/**
   * Handle validation errors consistently*/
  private handle.Validation.Error(error instanceof Error ? errormessage : String(error) any, req: Request, res: Response, next: Next.Function): void {
    let status.Code = 400;
    let error.Code = 'VALIDATION_ERR.O.R';
    let message = 'Validation failed';
    let details: any = undefined,
    if (error instanceof Validation.Error) {
      status.Code = errorstatus.Code;
      error.Code = errorerror.Code;
      message = errormessage;
      details = errordetails} else if (error instanceof z.Zod.Error) {
      error.Code = 'SCHEMA_VALIDATION_ERR.O.R';
      message = 'Schema validation failed';
      details = thisformat.Zod.Errors(error instanceof Error ? errormessage : String(error)} else if (errorname === 'PayloadToo.Large.Error') {
      status.Code = 413;
      error.Code = 'PAYLOAD_TOO_LAR.G.E';
      message = 'Request payload too large'}// Log validation error;
    loggerwarn('Request validation failed', LogContextSECURI.T.Y, {
      method: reqmethod,
      path: reqpath,
      user.Agent: reqget('User-Agent'),
      ip: reqip,
      error.Code;
      message;
      details})// Send standardized errorresponse;
    resstatus(status.Code)json({
      success: false,
      error instanceof Error ? errormessage : String(error){
        code: error.Code,
        message;
        details;
        timestamp: new Date()toIS.O.String(),
        request.Id: reqheaders['x-requestid'] || 'unknown',
      }})}/**
   * Format Zod validation errors*/
  private format.Zod.Errors(
    error instanceof Error ? errormessage : String(error) Zod.Error): Array<{ field: string; message: string; code: string }> {
    return errorerrorsmap((err) => ({
      field: errpathjoin('.'),
      message: errmessage,
      code: errcode}))}/**
   * Create endpoint-specific validation middleware*/
  public static for.Endpoint(options: Comprehensive.Validation.Options) {
    const middleware = new Comprehensive.Validation.Middleware();
    return middlewarevalidate(options)}/**
   * Create basic validation (sanitization + S.Q.L protection only)*/
  public static basic() {
    return ComprehensiveValidation.Middlewarefor.Endpoint({
      enableSQ.L.Protection: true,
      enable.Sanitization: true,
      enable.Size.Limit: true})}/**
   * Create strict validation (all protections enabled)*/
  public static strict(
    schemas: Partial<Pick<Comprehensive.Validation.Options, 'body' | 'query' | 'params' | 'headers'>>) {
    return ComprehensiveValidation.Middlewarefor.Endpoint({
      .schemas;
      enableSQ.L.Protection: true,
      enable.Sanitization: true,
      enable.Size.Limit: true,
      strip.Unknown: true})}}/**
 * Custom validation errorclass*/
export class Validation.Error extends Error {
  constructor(
    message: string,
    public status.Code = 400;
    public error.Code = 'VALIDATION_ERR.O.R';
    public details?: any) {
    super(message);
    thisname = 'Validation.Error'}}// Export convenient validators;
export const validate.Request = ComprehensiveValidation.Middlewarefor.Endpoint;
export const basic.Validation = Comprehensive.Validation.Middlewarebasic;
export const strict.Validation = Comprehensive.Validation.Middlewarestrict// Common validation patterns;
export const Common.Validators = {
  // I.D parameter validation;
  id.Param: strict.Validation({
    params: zobject({
      id: zstring()uuid('Invalid I.D format')})})// Pagination query validation,
  pagination: strict.Validation({
    query: zobject({
      limit: zcoercenumber()int()min(1)max(100)default(10),
      offset: zcoercenumber()int()min(0)default(0),
      sort.By: zstring()optional(),
      sort.Order: zenum(['asc', 'desc'])default('desc')})})// Search query validation;
  search: strict.Validation({
    query: zobject({
      q: zstring()min(1)max(500),
      limit: zcoercenumber()int()min(1)max(50)default(10)})})// JS.O.N body validation,
  json.Body: strict.Validation({
    body: zobject({})passthrough(), // Allow any JS.O.N object})// File upload validation;
  file.Upload: validate.Request({
    enable.Size.Limit: true,
    enable.Sanitization: true,
    enableSQ.L.Protection: true,
    custom.Validators: [
      (req, res, next) => {
        // Validate file upload headers;
        const content.Type = reqget('content-type');
        if (content.Type && !content.Typestarts.With('multipart/form-data')) {
          throw new Validation.Error(
            'Invalid content-type for file upload';
            400;
            'INVALID_CONTENT_TY.P.E');
        next()}]});