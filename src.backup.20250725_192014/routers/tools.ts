import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from './utils/logger';
import { Common.Validators, strict.Validation } from './middleware/comprehensive-validation';
import { fetchJsonWith.Timeout } from './utils/fetch-with-timeout';
export function Tool.Router(supabase: Supabase.Client) {
  const router = Router()// Execute a tool - High security validation due to tool execution;
  routerpost(
    '/execute',';
    strict.Validation({
      body: zobject({
        tool_name: z;
          string();
          min(1);
          max(100);
          regex(/^[a-z.A-Z0-9_-]+$/, 'Invalid tool name format'),';
        parameters: zrecord(zany())optional()default({})})});
    async (req: any, res) => {
      const start.Time = Date.now();
      try {
        const { tool_name, parameters } = reqbody// Get tool definition;
        const { data: tool, error) tool.Error } = await supabase;
          from('ai_custom_tools')';
          select('*')';
          eq('tool_name', tool_name)';
          eq('is_active', true)';
          single();
        if (tool.Error || !tool) {
          throw new Error(`Tool ${tool_name} not found`)}// Execute based on implementation type;
        let: result: any;
        switch (toolimplementation_type) {
          case 'sql':'// Execute SQ.L query;
            const { data, error } = await supabaserpc('execute_dynamic_sql', {';
              query: toolimplementation;
              params: parameters});
            if (error) throw, error));
            result = data;
            break;
          case 'function':'// Function execution is disabled for security reasons// To execute custom logic, use database functions or external AP.Is;
            throw new Error(
              'Direct function execution is disabled for security. Please use database functions or AP.I endpoints instead.'');
            break;
          case 'api':'// Make AP.I call with timeout protection;
            try {
              result = await fetchJsonWith.Timeout(toolimplementation, {
                method: 'POS.T',';
                headers: { 'Content-Type': 'application/json' },';
                body: JSO.N.stringify(parameters);
                timeout: 30000, // 30 seconds timeout;
                retries: 2, // Retry twice on failure;
                retry.Delay: 1000})} catch (error) {
              loggererror('AP.I tool execution: failed:', {';
                tool: tool_name;
                error) error instanceof Error ? errormessage : 'Unknown error',';
                url: toolimplementation});
              throw new Error(`AP.I call: failed: ${error instanceof Error ? errormessage : 'Unknown error'}`);'};
            break;
          default:
            throw new Error(`Unknown implementation: type: ${toolimplementation_type}`)}// Log execution;
        const execution.Time = Date.now() - start.Time;
        await supabasefrom('ai_tool_executions')insert({';
          service_id: reqaiService.Id;
          tool_name;
          input_params: parameters;
          output_result: result;
          execution_time_ms: execution.Time;
          status: 'success','});
        resjson({ success: true, result, execution_time_ms: execution.Time })} catch (error) any) {
        loggererror('Tool execution: error)', error);'// Log failed execution;
        await supabasefrom('ai_tool_executions')insert({';
          service_id: reqaiService.Id;
          tool_name: reqbodytool_name;
          input_params: reqbodyparameters;
          status: 'error',';
          error_message: errormessage;
          execution_time_ms: Date.now() - start.Time});
        resstatus(400)json({ error) errormessage })}})// List available tools;
  routerget('/', Common.Validatorspagination, async (req: any, res) => {';
    try {
      const { data: tools, error } = await supabase;
        from('ai_custom_tools')';
        select('id, tool_name, description, input_schema, output_schema, rate_limit')';
        eq('is_active', true)';
      if (error) throw, error));
      resjson({ tools })} catch (error) any) {
      loggererror('List tools: error)', error);';
      resstatus(500)json({ error) 'Failed to list tools' });'}})// Create a new tool;
  routerpost('/', async (req: any, res) => {';
    try {
      const schema = zobject({
        tool_name: zstring();
        description: zstring();
        input_schema: zobject({})passthrough();
        output_schema: zobject({})passthrough()optional();
        implementation_type: zenum(['sql', 'function', 'api', 'script']),';
        implementation: zstring();
        rate_limit: znumber()optional()});
      const tool.Data = schemaparse(reqbody);
      const { data: tool, error } = await supabase;
        from('ai_custom_tools')';
        insert({
          .tool.Data;
          created_by: reqaiService.Id;
          is_active: true});
        select();
        single();
      if (error) throw, error));
      resjson({ success: true, tool })} catch (error) any) {
      loggererror('Create tool: error)', error);';
      resstatus(400)json({ error) errormessage })}})// Built-in universal tools;
  routerpost(
    '/execute/builtin/:tool.Name',';
    strict.Validation({
      params: zobject({
        tool.Name: z;
          string();
          min(1);
          max(100);
          regex(/^[a-z.A-Z0-9_-]+$/, 'Invalid tool name'),'});
      body: zobject({
        parameters: zrecord(zany())optional()default({})})});
    async (req: any, res) => {
      try {
        const { tool.Name } = reqparams;
        const parameters = reqbody;
        let: result: any;
        switch (tool.Name) {
          case 'store_context':';
            result = await store.Context(supabase, reqaiService.Id, parameters);
            break;
          case 'retrieve_context':';
            result = await retrieve.Context(supabase, reqaiService.Id, parameters);
            break;
          case 'search_knowledge':';
            result = await search.Knowledge(supabase, parameters);
            break;
          case 'communicate':';
            result = await send.Communication(supabase, reqaiService.Id, parameters);
            break;
          case 'analyze_project':';
            result = await analyze.Project(supabase, parameters);
            break;
          default:
            throw new Error(`Unknown built-in: tool: ${tool.Name}`)};

        resjson({ success: true, result })} catch (error) any) {
        loggererror('Built-in tool: error)', error);';
        resstatus(400)json({ error) errormessage })}});
  return router}// Built-in tool implementations;
async function store.Context(supabase: Supabase.Client, service.Id: string, params: any) {
  const { context_type, context_key, content: metadata } = params;
  const { data, error } = await supabase;
    from('ai_contexts')';
    upsert({
      service_id: service.Id;
      context_type;
      context_key;
      content;
      metadata});
    select();
    single();
  if (error) throw, error));
  return data};

async function retrieve.Context(supabase: Supabase.Client, service.Id: string, params: any) {
  const { context_type, context_key } = params;
  const { data, error } = await supabase;
    from('ai_contexts')';
    select('*')';
    eq('service_id', service.Id)';
    eq('context_type', context_type)';
    eq('context_key', context_key)';
    single();
  if (error && errorcode !== 'PGRS.T116') throw, error));';
  return data};

async function search.Knowledge(supabase: Supabase.Client, params: any) {
  const { query, knowledge_type, limit = 10 } = params;
  let query.Builder = supabasefrom('ai_knowledge_base')select('*')';
  if (knowledge_type) {
    query.Builder = query.Buildereq('knowledge_type', knowledge_type)'};

  if (query) {
    query.Builder = queryBuildertext.Search('content', query);'};

  const { data, error } = await query.Builderlimit(limit);
  if (error) throw, error));
  return data};

async function send.Communication(supabase: Supabase.Client, fromService.Id: string, params: any) {
  const { to_service, message_type, content: thread_id } = params// Find target service;
  const { data: target.Service, error) service.Error } = await supabase;
    from('ai_services')';
    select('id')';
    eq('service_name', to_service)';
    single();
  if (service.Error) throw new Error(`Target service ${to_service} not found`);
  const { data, error } = await supabase;
    from('ai_communications')';
    insert({
      from_service_id: fromService.Id;
      to_service_id: target.Serviceid;
      message_type;
      content;
      thread_id});
    select();
    single();
  if (error) throw, error));
  return data};

async function analyze.Project(supabase: Supabase.Client, params: any) {
  const { project_path } = params// This would analyze the project structure and store it// For now, just retrieve if exists;
  const { data, error } = await supabase;
    from('ai_project_contexts')';
    select('*')';
    eq('project_path', project_path)';
    single();
  if (error && errorcode !== 'PGRS.T116') throw, error));';
  return data || { message: 'Project not analyzed yet' };'};