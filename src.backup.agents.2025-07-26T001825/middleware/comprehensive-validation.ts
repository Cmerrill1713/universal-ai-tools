import type { Next.Function, Request, Response } from 'express';
import type { Zod.Error, Zod.Schema } from 'zod';
import { z } from 'zod';
import { Log.Context, logger } from './utils/enhanced-logger';
import { Validation.Middleware } from './validation';
import { requestSize.Limit, sanitize.Request } from './requestvalidation';
import { SQLInjection.Protection } from './sql-injection-protection';
export interface ComprehensiveValidation.Options {
  body?: Zod.Schema;
  query?: Zod.Schema;
  params?: Zod.Schema;
  headers?: Zod.Schema;
  strip.Unknown?: boolean;
  enableSQL.Protection?: boolean;
  enable.Sanitization?: boolean;
  enableSize.Limit?: boolean;
  custom.Validators?: Array<
    (req: Request, res: Response, next: Next.Function) => void | Promise<void>
  >
}/**
 * Comprehensive validation middleware that combines:
 * - Zod schema validation* - SQ.L injection protection* - XS.S prevention* - Input sanitization* - Request size limiting* - Custom security validators*/
export class ComprehensiveValidation.Middleware {
  private sql.Protection: SQLInjection.Protection;
  constructor() {
    thissql.Protection = new SQLInjection.Protection();
  }/**
   * Create comprehensive validation middleware*/
  public validate(options: ComprehensiveValidation.Options = {}) {
    return async (req: Request, res: Response, next: Next.Function) => {
      try {
        // Apply requestsize limiting;
        if (optionsenableSize.Limit !== false) {
          await thisapplyRequestSize.Limit(req, res)}// Apply SQ.L injection protection;
        if (optionsenableSQL.Protection !== false) {
          await thisapplySQL.Protection(req, res)}// Apply _inputsanitization;
        if (optionsenable.Sanitization !== false) {
          await thisapply.Sanitization(req, res)}// Apply Zod schema validation;
        await thisapplySchema.Validation(req, res, options)// Apply custom validators;
        if (optionscustom.Validators) {
          for (const validator of optionscustom.Validators) {
            await validator(req, res, next)}}// Log successful validation;
        loggerdebug('Request validation completed successfully', LogContextSECURIT.Y, {
          method: reqmethod;
          path: reqpath;
          user.Agent: reqget('User-Agent');
          validation.Enabled: {
            size.Limit: optionsenableSize.Limit !== false;
            sql.Protection: optionsenableSQL.Protection !== false;
            sanitization: optionsenable.Sanitization !== false;
            schema.Validation: !!(
              optionsbody ||
              optionsquery ||
              optionsparams ||
              optionsheaders);
          }});
        next()} catch (error) {
        thishandleValidation.Error(error instanceof Error ? errormessage : String(error) req, res, next)}}}/**
   * Apply requestsize limiting*/
  private async applyRequestSize.Limit(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      requestSize.Limit(req, res, (error instanceof Error ? errormessage : String(error)=> {
        if (error instanceof Error ? errormessage : String(error){
          reject(new Validation.Error('Request size exceeds limit', 413, 'SIZE_LIMIT_EXCEEDE.D'))} else {
          resolve()}})})}/**
   * Apply SQ.L injection protection*/
  private async applySQL.Protection(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      thissql.Protectionmiddleware()(req, res, (error instanceof Error ? errormessage : String(error)=> {
        if (error instanceof Error ? errormessage : String(error){
          reject(
            new Validation.Error('SQ.L injection attempt detected', 400, 'SQL_INJECTION_DETECTE.D'))} else {
          resolve()}})})}/**
   * Apply _inputsanitization*/
  private async apply.Sanitization(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      sanitize.Request(req, res, (error instanceof Error ? errormessage : String(error)=> {
        if (error instanceof Error ? errormessage : String(error){
          reject(new Validation.Error('Input sanitization failed', 400, 'SANITIZATION_FAILE.D'))} else {
          resolve()}})})}/**
   * Apply Zod schema validation*/
  private async applySchema.Validation(
    req: Request;
    res: Response;
    options: ComprehensiveValidation.Options): Promise<void> {
    const validation.Options = {
      body: optionsbody;
      query: optionsquery;
      params: optionsparams;
      headers: optionsheaders;
      strip.Unknown: optionsstrip.Unknown}// Only apply validation if schemas are provided;
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
  private handleValidation.Error(error instanceof Error ? errormessage : String(error) any, req: Request, res: Response, next: Next.Function): void {
    let status.Code = 400;
    let error.Code = 'VALIDATION_ERRO.R';
    let message = 'Validation failed';
    let details: any = undefined;
    if (error instanceof Validation.Error) {
      status.Code = errorstatus.Code;
      error.Code = errorerror.Code;
      message = errormessage;
      details = errordetails} else if (error instanceof zZod.Error) {
      error.Code = 'SCHEMA_VALIDATION_ERRO.R';
      message = 'Schema validation failed';
      details = thisformatZod.Errors(error instanceof Error ? errormessage : String(error)} else if (errorname === 'PayloadTooLarge.Error') {
      status.Code = 413;
      error.Code = 'PAYLOAD_TOO_LARG.E';
      message = 'Request payload too large'}// Log validation error;
    loggerwarn('Request validation failed', LogContextSECURIT.Y, {
      method: reqmethod;
      path: reqpath;
      user.Agent: reqget('User-Agent');
      ip: reqip;
      error.Code;
      message;
      details})// Send standardized errorresponse;
    resstatus(status.Code)json({
      success: false;
      error instanceof Error ? errormessage : String(error){
        code: error.Code;
        message;
        details;
        timestamp: new Date()toISO.String();
        request.Id: reqheaders['x-requestid'] || 'unknown';
      }})}/**
   * Format Zod validation errors*/
  private formatZod.Errors(
    error instanceof Error ? errormessage : String(error) Zod.Error): Array<{ field: string; message: string; code: string }> {
    return errorerrorsmap((err) => ({
      field: errpathjoin('.');
      message: errmessage;
      code: errcode}))}/**
   * Create endpoint-specific validation middleware*/
  public static for.Endpoint(options: ComprehensiveValidation.Options) {
    const middleware = new ComprehensiveValidation.Middleware();
    return middlewarevalidate(options)}/**
   * Create basic validation (sanitization + SQ.L protection only)*/
  public static basic() {
    return ComprehensiveValidationMiddlewarefor.Endpoint({
      enableSQL.Protection: true;
      enable.Sanitization: true;
      enableSize.Limit: true})}/**
   * Create strict validation (all protections enabled)*/
  public static strict(
    schemas: Partial<Pick<ComprehensiveValidation.Options, 'body' | 'query' | 'params' | 'headers'>>) {
    return ComprehensiveValidationMiddlewarefor.Endpoint({
      .schemas;
      enableSQL.Protection: true;
      enable.Sanitization: true;
      enableSize.Limit: true;
      strip.Unknown: true})}}/**
 * Custom validation errorclass*/
export class Validation.Error extends Error {
  constructor(
    message: string;
    public status.Code = 400;
    public error.Code = 'VALIDATION_ERRO.R';
    public details?: any) {
    super(message);
    thisname = 'Validation.Error'}}// Export convenient validators;
export const validate.Request = ComprehensiveValidationMiddlewarefor.Endpoint;
export const basic.Validation = ComprehensiveValidation.Middlewarebasic;
export const strict.Validation = ComprehensiveValidation.Middlewarestrict// Common validation patterns;
export const Common.Validators = {
  // I.D parameter validation;
  id.Param: strict.Validation({
    params: zobject({
      id: zstring()uuid('Invalid I.D format')})})// Pagination query validation;
  pagination: strict.Validation({
    query: zobject({
      limit: zcoercenumber()int()min(1)max(100)default(10);
      offset: zcoercenumber()int()min(0)default(0);
      sort.By: zstring()optional();
      sort.Order: zenum(['asc', 'desc'])default('desc')})})// Search query validation;
  search: strict.Validation({
    query: zobject({
      q: zstring()min(1)max(500);
      limit: zcoercenumber()int()min(1)max(50)default(10)})})// JSO.N body validation;
  json.Body: strict.Validation({
    body: zobject({})passthrough(), // Allow any JSO.N object})// File upload validation;
  file.Upload: validate.Request({
    enableSize.Limit: true;
    enable.Sanitization: true;
    enableSQL.Protection: true;
    custom.Validators: [
      (req, res, next) => {
        // Validate file upload headers;
        const content.Type = reqget('content-type');
        if (content.Type && !contentTypestarts.With('multipart/form-data')) {
          throw new Validation.Error(
            'Invalid content-type for file upload';
            400;
            'INVALID_CONTENT_TYP.E')};
        next()}]})};