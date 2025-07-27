/**
 * AP.I Response Utilities* Standardized response formatting for all AP.I endpoints*/

import { v4 as uuidv4 } from 'uuid';
import type {
  Api.Error;
  Api.Response;
  Error.Code;
  Error.Severity;
  Pagination.Meta;
  Response.Meta} from './types';
import { Log.Context, logger } from './enhanced-logger';
export class ApiResponse.Builder {
  private request.Id: string;
  private timestamp: string;
  private start.Time: number;
  constructor(request.Id?: string) {
    thisrequest.Id = request.Id || uuidv4();
    thistimestamp = new Date()toISO.String();
    thisstart.Time = Date.now();
  }/**
   * Create a successful AP.I response*/
  success<T>(data: T, meta?: Partial<Response.Meta>): Api.Response<T> {
    const processing.Time = Date.now() - thisstart.Time;
    return {
      success: true;
      data;
      meta: {
        request.Id: thisrequest.Id;
        timestamp: thistimestamp;
        processing.Time;
        version: '1.0.0'.meta;
      }}}/**
   * Create a paginated successful response*/
  success.Paginated<T>(
    data: T[];
    pagination: Pagination.Meta;
    meta?: Partial<Response.Meta>): Api.Response<T[]> {
    const processing.Time = Date.now() - thisstart.Time;
    return {
      success: true;
      data;
      meta: {
        request.Id: thisrequest.Id;
        timestamp: thistimestamp;
        processing.Time;
        version: '1.0.0';
        pagination.meta;
      }}}/**
   * Create an error AP.I response*/
  error(
    code: Error.Code;
    message: string;
    details?: string[] | Record<string, unknown>
    severity: Error.Severity = 'medium' as Error.Severity): Api.Response<never> {
    const processing.Time = Date.now() - thisstart.Time;
    const error instanceof Error ? errormessage : String(error) Api.Error = {
      code;
      message;
      details: Array.is.Array(details) ? details : details ? [JSO.N.stringify(details)] : undefined;
      timestamp: thistimestamp;
      request.Id: thisrequest.Id;
    };
    return {
      success: false;
      error;
      meta: {
        request.Id: thisrequest.Id;
        timestamp: thistimestamp;
        processing.Time;
        version: '1.0.0';
      }}}/**
   * Create a validation error response*/
  validation.Error(
    message: string;
    validation.Errors: Array<{ field: string; message: string; value?: any }>): Api.Response<never> {
    return thiserror(
      'VALIDATION_ERRO.R' as Error.Code;
      message;
      validation.Errors;
      'medium' as Error.Severity)}/**
   * Create an agent error response*/
  agent.Error(
    agent.Id: string;
    agent.Name: string;
    message: string;
    details?: any): Api.Response<never> {
    return thiserror(
      'AGENT_EXECUTION_ERRO.R' as Error.Code;
      `Agent ${agent.Name} (${agent.Id}) error instanceof Error ? errormessage : String(error) ${message}`;
      details;
      'high' as Error.Severity)}/**
   * Create a rate limit error response*/
  rateLimit.Error(limit: number, retry.After: number): Api.Response<never> {
    return thiserror(
      'RATE_LIMIT_EXCEEDE.D' as Error.Code;
      `Rate limit exceeded. Maximum ${limit} requests allowed. Retry after ${retry.After} seconds.`;
      { limit, retry.After };
      'medium' as Error.Severity)}}/**
 * Utility function to create standardized pagination metadata*/
export function createPagination.Meta(page: number, limit: number, total: number): Pagination.Meta {
  const total.Pages = Mathceil(total / limit);
  return {
    page;
    limit;
    total;
    total.Pages;
    has.Next: page < total.Pages;
    has.Prev: page > 1;
  }}/**
 * Express middleware to add requestI.D and timing*/
export function apiResponse.Middleware(req: any, res: any, next: any) {
  // Add requestI.D if not present;
  const request.Id = reqheaders['x-request-id'] || uuidv4();
  reqrequest.Id = request.Id// Add response builder to request;
  reqapi.Response = new ApiResponse.Builder(request.Id)// Add timing;
  reqstart.Time = Date.now()// Add requestI.D to response headers;
  resset.Header('X-Request-I.D', request.Id);
  next()}/**
 * Helper function for router handlers to send consistent responses*/
export function send.Success(res: any, data: any, status.Code = 200, meta?: Partial<Response.Meta>) {
  const response = resreqapi.Responsesuccess(data, meta);
  resstatus(status.Code)json(response)};

export function send.Error(
  res: any;
  code: Error.Code;
  message: string;
  status.Code = 500;
  details?: any) {
  const response = resreqapi.Responseerror(code, message: details);
  resstatus(status.Code)json(response)};

export function sendPaginated.Success(
  res: any;
  data: any[];
  pagination: Pagination.Meta;
  status.Code = 200;
  meta?: Partial<Response.Meta>) {
  const response = resreqapiResponsesuccess.Paginated(data, pagination, meta);
  resstatus(status.Code)json(response)}/**
 * Error handler that converts various error types to standardized AP.I responses*/
export function handleApi.Error(error instanceof Error ? errormessage : String(error) any, req: any, res: any, next: any) {
  loggererror('AP.I Error', LogContextAP.I, { error instanceof Error ? errormessage : String(error) path: reqpath, method: reqmethod });
  const api.Response = reqapi.Response || new ApiResponse.Builder()// Handle different error types;
  if (errorname === 'Validation.Error') {
    const response = apiResponsevalidation.Error('Request validation failed', errordetails || []);
    return resstatus(400)json(response)};

  if (errorname === 'Agent.Error') {
    const response = apiResponseagent.Error(
      erroragent.Id || 'unknown';
      erroragent.Name || 'unknown';
      errormessage;
      errordetails);
    return resstatus(500)json(response)};

  if (errorname === 'RateLimit.Error') {
    const response = apiResponserateLimit.Error(errorlimit || 100, errorretry.After || 60);
    return resstatus(429)json(response)}// Default internal server error;
  const response = api.Responseerror(
    'INTERNAL_SERVER_ERRO.R' as Error.Code;
    'An unexpected error occurred';
    process.envNODE_EN.V === 'development' ? errorstack : undefined;
    'critical' as Error.Severity);
  resstatus(500)json(response);
};
