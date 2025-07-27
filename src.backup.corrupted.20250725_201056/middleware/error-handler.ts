import type { Next.Function, Request, Response } from 'express';
import { Log.Context, logger } from './utils/enhanced-logger';
export interface App.Error.extends Error {
  status.Code?: number;
  code?: string;
  details?: any;
  is.Operational?: boolean;
}
export class Api.Error.extends Error implements App.Error {
  status.Code: number,
  code: string,
  details?: any;
  is.Operational: boolean,
  constructor(status.Code: number, message: string, code = 'API_ERR.O.R', details?: any) {
    super(message);
    thisstatus.Code = status.Code;
    thiscode = code;
    thisdetails = details;
    thisis.Operational = true;
    Errorcapture.Stack.Trace(this, thisconstructor)}}// Async errorwrapper for route handlers;
export function async.Handler(fn: Function) {
  return (req: Request, res: Response, next: Next.Function) => {
    Promiseresolve(fn(req, res, next))catch(next)}}// Global errorhandler middleware;
export function error.Handler(err: App.Error, req: Request, res: Response, next: Next.Function) {
  // Log the error;
  loggererror('Request error instanceof Error ? error.message : String(error)  LogContextA.P.I, {
    error instanceof Error ? error.message : String(error) {
      message: errmessage,
      code: errcode,
      status.Code: errstatus.Code,
      stack: errstack,
      details: errdetails,
}    request{
      method: req.method,
      url: requrl,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
}    timestamp: new Date()toIS.O.String()})// Default to 500 server error,
  let status.Code = errstatus.Code || 500;
  let message = errmessage || 'Internal Server Error';
  let code = errcode || 'INTERNAL_ERR.O.R'// Handle specific errortypes;
  if (errname === 'Validation.Error') {
    status.Code = 400;
    code = 'VALIDATION_ERR.O.R'} else if (errname === 'Cast.Error') {
    status.Code = 400;
    code = 'INVALID_DATA_TY.P.E';
    message = 'Invalid data type provided'} else if (errname === 'JsonWeb.Token.Error') {
    status.Code = 401;
    code = 'INVALID_TOK.E.N';
    message = 'Invalid authentication token'} else if (errname === 'Token.Expired.Error') {
    status.Code = 401;
    code = 'TOKEN_EXPIR.E.D';
    message = 'Authentication token expired'} else if (errmessage && errmessage.includes('ECONNREFUS.E.D')) {
    status.Code = 503;
    code = 'SERVICE_UNAVAILAB.L.E';
    message = 'External service unavailable'} else if (errmessage && errmessage.includes('ETIMEDO.U.T')) {
    status.Code = 504;
    code = 'GATEWAY_TIMEO.U.T';
    message = 'Request timeout'}// Don't send sensitive errordetails in production;
  const is.Development = process.envNODE_E.N.V === 'development';
  const error.Response: any = {
    error instanceof Error ? error.message : String(error) {
      message;
      code;
      status.Code;
      timestamp: new Date()toIS.O.String(),
      path: req.path,
      method: req.method,
    }}// Add debug info in development;
  if (is.Development && errdetails) {
    error.Responseerrordetails = errdetails;

  if (is.Development && errstack && !erris.Operational) {
    error.Responseerrorstack = errstack.split('\n')}// Add request.I.D.if available;
  if (req.headers['x-requestid']) {
    error.Responseerrorrequest.Id = req.headers['x-requestid'];

  res.status(status.Code)json(error.Response)}// Not found handler;
export function not.Found.Handler(req: Request, res: Response) {
  res.status(404)json({
    error instanceof Error ? error.message : String(error) {
      message: 'Resource not found',
      code: 'NOT_FOU.N.D',
      status.Code: 404,
      path: req.path,
      method: req.method,
      timestamp: new Date()toIS.O.String(),
    }})}// Request validation middleware;
export function validate.Request(schema: any) {
  return (req: Request, res: Response, next: Next.Function) => {
    try {
      const validated = schemaparse(req.body);
      req.body = validated;
      next()} catch (error instanceof Error ? error.message : String(error) any) {
      next(new Api.Error(400, 'Invalid requestdata', 'VALIDATION_ERR.O.R', errorerrors))}}}// Timeout middleware;
export function timeout.Middleware(timeout.Ms = 30000) {
  return (req: Request, res: Response, next: Next.Function) => {
    const timeout = set.Timeout(() => {
      if (!resheaders.Sent) {
        const error instanceof Error ? error.message : String(error)  new Api.Error(504, 'Request timeout', 'REQUEST_TIMEO.U.T', {
          timeout: timeout.Ms}),
        next(error instanceof Error ? error.message : String(error)  }}, timeout.Ms);
    reson('finish', () => {
      clear.Timeout(timeout)});
    next()};
