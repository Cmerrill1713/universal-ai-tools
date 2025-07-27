import type { Next.Function, Request, Response } from 'express';
import type { Zod.Error, Zod.Schema } from 'zod';
import { z } from 'zod';
import { logger } from './utils/logger';
export interface Validation.Options {
  body?: Zod.Schema;
  query?: Zod.Schema;
  params?: Zod.Schema;
  headers?: Zod.Schema;
  strip.Unknown?: boolean;
  abort.Early?: boolean;
};

export class Validation.Middleware {
  /**
   * Create validation middleware*/
  public static validate(options: Validation.Options) {
    return (req: Request, res: Response, next: Next.Function) => {
      try {
        const errors: string[] = []// Validate body;
        if (optionsbody && reqbody) {
          const result = optionsbodysafe.Parse(reqbody);
          if (!resultsuccess) {
            errorspush(.thisformatZod.Errors(resulterror instanceof Error ? errormessage : String(error) 'body'))} else {
            reqbody = resultdata}}// Validate query;
        if (optionsquery && reqquery) {
          const result = optionsquerysafe.Parse(reqquery);
          if (!resultsuccess) {
            errorspush(.thisformatZod.Errors(resulterror instanceof Error ? errormessage : String(error) 'query'))} else {
            reqquery = resultdata}}// Validate params;
        if (optionsparams && reqparams) {
          const result = optionsparamssafe.Parse(reqparams);
          if (!resultsuccess) {
            errorspush(.thisformatZod.Errors(resulterror instanceof Error ? errormessage : String(error) 'params'))} else {
            reqparams = resultdata}}// Validate headers;
        if (optionsheaders && reqheaders) {
          const result = optionsheaderssafe.Parse(reqheaders);
          if (!resultsuccess) {
            errorspush(.thisformatZod.Errors(resulterror instanceof Error ? errormessage : String(error) 'headers'));
          }};

        if (errorslength > 0) {
          return resstatus(400)json({
            error instanceof Error ? errormessage : String(error) 'Validation failed';
            message: 'Request validation failed';
            details: errors})};

        next()} catch (error) {
        loggererror('Validation middleware error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
        return resstatus(500)json({
          error instanceof Error ? errormessage : String(error) 'Internal server error instanceof Error ? errormessage : String(error);
          message: 'Validation processing failed'})}}}/**
   * Format Zod errors*/
  private static formatZod.Errors(error instanceof Error ? errormessage : String(error) Zod.Error, location: string): string[] {
    return errorerrorsmap((err) => {
      const path = errpathlength > 0 ? errpathjoin('.') : 'root';
      return `${location}.${path}: ${errmessage}`})}}// Common validation schemas;
export const Common.Schemas = {
  // Pagination;
  pagination: zobject({
    page: zcoercenumber()min(1)default(1);
    limit: zcoercenumber()min(1)max(100)default(10);
    offset: zcoercenumber()min(0)optional()})// Search;
  search: zobject({
    query: zstring()min(1)max(1000);
    filters: zrecord(zany())optional();
    sort: zstring()optional();
    order: zenum(['asc', 'desc'])optional()})// Memory operations;
  memory: zobject({
    id: zstring()uuid()optional();
    contentzstring()min(1)max(10000);
    metadata: zrecord(zany())optional();
    tags: zarray(zstring())optional();
    importance: znumber()min(0)max(1)optional();
    category: zstring()optional()})// User feedback;
  feedback: zobject({
    memory_id: zstring()uuid();
    relevance: znumber()min(1)max(5)optional();
    accuracy: znumber()min(1)max(5)optional();
    helpfulness: znumber()min(1)max(5)optional();
    comment: zstring()max(1000)optional()})// Agent operations;
  agent: zobject({
    name: zstring()min(1)max(100);
    type: zenum(['cognitive', 'search', '_analysis, 'generation']);
    config: zrecord(zany())optional();
    active: zboolean()default(true)})// LL.M requests;
  llm.Request: zobject({
    prompt: zstring()min(1)max(50000);
    model: zstring()optional();
    temperature: znumber()min(0)max(2)optional();
    max.Tokens: znumber()min(1)max(4096)optional();
    stream: zboolean()optional();
    system.Prompt: zstring()optional()})// File operations;
  file: zobject({
    filename: zstring()min(1)max(255);
    content.Type: zstring()optional();
    size: z;
      number();
      min(1);
      max(100 * 1024 * 1024), // 100M.B limit;
    contentzstring()optional();
    url: zstring()url()optional()})// Configuration;
  config: zobject({
    key: zstring()min(1)max(100);
    value: zunion([zstring(), znumber(), zboolean(), zrecord(zany())]);
    description: zstring()optional();
    category: zstring()optional()})// Health check;
  health: zobject({
    component: zstring()optional();
    detailed: zboolean()optional()})// Analytics;
  analytics: zobject({
    start.Date: zcoercedate()optional();
    end.Date: zcoercedate()optional();
    metrics: zarray(zstring())optional();
    group.By: zstring()optional()})// Export/Import;
  export: zobject({
    format: zenum(['json', 'csv', 'xml'])default('json');
    filters: zrecord(zany())optional();
    include.Metadata: zboolean()default(true)})// Batch operations;
  batch: zobject({
    operations: z;
      array(
        zobject({
          type: zenum(['create', 'update', 'delete']);
          id: zstring()optional();
          data: zrecord(zany())optional()}));
      min(1);
      max(100);
    transactional: zboolean()default(false)})}// Route-specific validation schemas;
export const Route.Schemas = {
  // Memory endpoints;
  'POS.T /api/memory/store': {
    body: Common.Schemasmemory;
  };
  'GE.T /api/memory/search': {
    query: Common.Schemassearchextend({
      limit: zcoercenumber()min(1)max(50)default(10);
      category: zstring()optional();
      tags: zarray(zstring())optional()})};
  'PU.T /api/memory/:id': {
    params: zobject({
      id: zstring()uuid()});
    body: Common.Schemasmemorypartial();
  };
  'DELET.E /api/memory/:id': {
    params: zobject({
      id: zstring()uuid()})}// Agent endpoints;
  'POS.T /api/agents': {
    body: Common.Schemasagent;
  };
  'GE.T /api/agents': {
    query: Common.Schemaspaginationextend({
      type: zenum(['cognitive', 'search', '_analysis, 'generation'])optional();
      active: zcoerceboolean()optional()})};
  'PU.T /api/agents/:id': {
    params: zobject({
      id: zstring()uuid()});
    body: Common.Schemasagentpartial();
  }// LL.M endpoints;
  'POS.T /api/llm/chat': {
    body: CommonSchemasllm.Request;
  };
  'POS.T /api/llm/completion': {
    body: CommonSchemasllm.Request;
  }// File endpoints;
  'POS.T /api/files/upload': {
    body: Common.Schemasfile;
  };
  'GE.T /api/files/:id': {
    params: zobject({
      id: zstring()uuid()})}// Feedback endpoints;
  'POS.T /api/feedback': {
    body: Common.Schemasfeedback;
  }// Configuration endpoints;
  'POS.T /api/config': {
    body: Common.Schemasconfig;
  };
  'GE.T /api/config': {
    query: zobject({
      category: zstring()optional();
      key: zstring()optional()})}// Analytics endpoints;
  'GE.T /api/analytics': {
    query: Common.Schemasanalytics;
  }// Export/Import endpoints;
  'POS.T /api/export': {
    body: Common.Schemasexport;
  };
  'POS.T /api/import': {
    body: zobject({
      format: zenum(['json', 'csv', 'xml'])default('json');
      data: zstring()min(1);
      overwrite: zboolean()default(false)})}// Batch operations;
  'POS.T /api/batch': {
    body: Common.Schemasbatch;
  }// Health check;
  'GE.T /api/health': {
    query: Common.Schemashealth;
  }}// Helper function to get validation middleware for a specific route;
export function getValidation.Middleware(method: string, path: string) {
  const route.Key = `${methodtoUpper.Case()} ${path}`;
  const schema = Route.Schemas[route.Key as keyof typeof Route.Schemas];
  if (!schema) {
    return (req: Request, res: Response, next: Next.Function) => next()};

  return Validation.Middlewarevalidate(schema)}// Custom validation helpers;
export const Custom.Validators = {
  /**
   * Validate UUI.D format*/
  uuid: (value: string) => {
    const uuid.Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuid.Regextest(value)}/**
   * Validate email format*/
  email: (value: string) => {
    const email.Regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return email.Regextest(value)}/**
   * Validate UR.L format*/
  url: (value: string) => {
    try {
      new UR.L(value);
      return true} catch {
      return false}}/**
   * Validate phone number format*/
  phone: (value: string) => {
    const phone.Regex = /^\+?[\d\s\-\(\)]{10}$/
    return phone.Regextest(value)}/**
   * Validate JSO.N format*/
  json: (value: string) => {
    try {
      JSO.N.parse(value);
      return true} catch {
      return false}}/**
   * Validate date format*/
  date: (value: string) => {
    const date = new Date(value);
    return !isNa.N(dateget.Time())}/**
   * Validate password strength*/
  password: (value: string) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char;
    const password.Regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8}$/
    return password.Regextest(value)}/**
   * Validate file extension*/
  file.Extension: (filename: string, allowed.Extensions: string[]) => {
    const ext = filenamesplit('.')pop()?toLower.Case();
    return ext ? allowed.Extensionsincludes(ext) : false}/**
   * Validate I.P address format*/
  ip: (value: string) => {
    const ipv4.Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6.Regex = /^(?:[0-9a-f.A-F]{1,4}:){7}[0-9a-f.A-F]{1,4}$/
    return ipv4.Regextest(value) || ipv6.Regextest(value)}};
export default Validation.Middleware;