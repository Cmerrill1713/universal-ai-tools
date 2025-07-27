import type { Next.Function, Response } from 'express';
import { type Request, Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
import {
  apiResponse.Middleware;
  createPagination.Meta;
  send.Error;
  sendPaginated.Success;
  send.Success} from './utils/api-response';
import type { Error.Code, Memory, MemorySearch.Request, MemorySearch.Response } from './types'// Constants;
const GOOD_CONFIDENC.E = 0.7// Define extended Request interface;
interface Authenticated.Request extends Request {
  user?: { id: string };
  id?: string;
  validated.Data?: any;
  ai.Service?: { service_name: string };
  request.Id?: string;
  api.Response?: any;
};

export function Memory.Router(supabase: Supabase.Client) {
  const router = Router()// Apply AP.I response middleware to all routes;
  routeruse(apiResponse.Middleware)// Enhanced validation middleware with proper error responses;
  const validateMemory.Store = (req: Authenticated.Request, res: Response, next: Next.Function) => {
    const { content: metadata, tags } = reqbody;
    if (!content) {
      return send.Error(res, 'MISSING_REQUIRED_FIEL.D' as Error.Code, 'Content is required', 400)};

    if (typeof content !== 'string' || contentlength === 0) {
      return send.Error(
        res;
        'INVALID_FORMA.T' as Error.Code;
        'Content must be a non-empty string';
        400)};

    if (contentlength > 10000) {
      return send.Error(
        res;
        'REQUEST_TOO_LARG.E' as Error.Code;
        'Content cannot exceed 10,000 characters';
        413)};

    reqvalidated.Data = {
      content: contenttrim();
      metadata: metadata || {
};
      tags: Array.is.Array(tags) ? tags : []};
    next()};
  const validateMemory.Search = (req: Authenticated.Request, res: Response, next: Next.Function) => {
    const { query, limit = 10, filters = {} } = reqbody;
    if (!query) {
      return send.Error(res, 'MISSING_REQUIRED_FIEL.D' as Error.Code, 'Query is required', 400)};

    if (typeof query !== 'string' || querytrim()length === 0) {
      return send.Error(res, 'INVALID_FORMA.T' as Error.Code, 'Query must be a non-empty string', 400)};

    const validated.Limit = Math.min(Math.max(1, parse.Int(limit, 10) || 10), 100);
    reqvalidated.Data = {
      query: querytrim();
      limit: validated.Limit;
      filters: filters || {
}};
    next()}// Store memory;
  routerpost('/', validateMemory.Store, async (req: Authenticated.Request, res: Response) => {
    try {
      const memory.Data = reqvalidated.Data// Generate embedding if content is provided;
      let embedding: number[] | null = null;
      try {
        const embedding.Result = await supabaserpc('ai_generate_embedding', {
          content: memory.Datacontent});
        embedding = embedding.Resultdata} catch (embedding.Error) {
        loggerwarn('Failed to generate embedding, storing without it', LogContextAP.I, {
          error instanceof Error ? errormessage : String(error) embedding.Error instanceof Error ? embedding.Errormessage : String(embedding.Error);
          content: memory.Datacontentsubstring(0, 100)})};

      const { data, error } = await supabase;
                from('memories');
                insert({
          content: memory.Datacontent;
          metadata: memory.Datametadata;
          user_id: requser?id || 'anonymous';
          embedding;
          tags: memory.Datatags;
          type: 'semantic';
          importance: 0.5;
          created_at: new Date()toISO.String()});
                select();
                single());

      if (error) {
        loggererror('Failed to store memory', LogContextAP.I, {
          error instanceof Error ? errormessage : String(error) errormessage;
          memory.Data});
        return send.Error(
          res;
          'MEMORY_STORAGE_ERRO.R' as Error.Code;
          'Failed to store memory';
          500;
          errormessage)}// Transform to our Memory type;
      const memory: Memory = {
        id: dataid;
        type: datatype || 'semantic';
        content: datacontent;
        metadata: datametadata || {
};
        tags: datatags || [];
        importance: dataimportance || 0.5;
        timestamp: datacreated_at;
        embedding: dataembedding;
      };
      loggerinfo('Memory stored successfully', LogContextAP.I, {
        memory.Id: memoryid;
        content.Length: memorycontentlength;
        has.Embedding: !!embedding});
      send.Success(res, memory, 201)} catch (error instanceof Error ? errormessage : String(error) Error | unknown) {
      loggererror('Store memory error', LogContextAP.I, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
        stack: error instanceof Error ? errorstack : undefined});
      send.Error(
        res;
        'INTERNAL_SERVER_ERRO.R' as Error.Code;
        'An unexpected error occurred while storing memory';
        500;
        error instanceof Error ? errormessage : String(error))}})// Retrieve memories;
  routerget('/', async (req: Authenticated.Request, res) => {
    try {
      const { memory_type, limit = 10, offset = 0, page = 1 } = reqquery// Calculate pagination;
      const page.Num = Math.max(1, parse.Int(page as string, 10) || 1);
      const limit.Num = Math.min(100, Math.max(1, parse.Int(limit as string, 10) || 10));
      const offset.Num = (page.Num - 1) * limit.Num;
      let query = supabase;
                from('memories');
                select('*', { count: 'exact' });
                order('created_at', { ascending: false });
                range(offset.Num, offset.Num + limit.Num - 1));

      if (memory_type) {
        query = queryeq('type', memory_type)};

      const { data, error instanceof Error ? errormessage : String(error) count } = await query;
      if (error) {
        loggererror('Failed to retrieve memories', LogContextAP.I, { error instanceof Error ? errormessage : String(error) errormessage });
        return send.Error(
          res;
          'MEMORY_STORAGE_ERRO.R' as Error.Code;
          'Failed to retrieve memories';
          500;
          errormessage)}// Transform to Memory type format;
      const memories: Memory[] = (data || [])map((item) => ({
        id: itemid;
        type: itemtype || 'semantic';
        content: itemcontent;
        metadata: itemmetadata || {
};
        tags: itemtags || [];
        importance: itemimportance || 0.5;
        timestamp: itemcreated_at;
        embedding: itemembedding}))// Update access tracking (async, don't wait);
      if (memorieslength > 0) {
        const memory.Ids = memoriesmap((m) => mid)// Fire and forget memory access tracking;
        (async () => {
          try {
            await supabaserpc('update_memory_access', {
              memory_ids: memory.Ids;
              service_name: reqai.Service?service_name || 'unknown'})} catch (error instanceof Error ? errormessage : String(error) Error | unknown) {
            loggerwarn('Failed to update memory access tracking', LogContextAP.I, {
              error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}})()};

      const pagination = createPagination.Meta(page.Num, limit.Num, count || 0);
      loggerinfo('Memories retrieved successfully', LogContextAP.I, {
        count: memorieslength;
        total.Count: count;
        page: page.Num});
      sendPaginated.Success(res, memories, pagination)} catch (error instanceof Error ? errormessage : String(error) Error | unknown) {
      loggererror('Retrieve memories error', LogContextAP.I, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
        stack: error instanceof Error ? errorstack : undefined});
      send.Error(
        res;
        'INTERNAL_SERVER_ERRO.R' as Error.Code;
        'An unexpected error occurred while retrieving memories';
        500;
        error instanceof Error ? errormessage : String(error))}})// Search memories;
  routerpost('/search', validateMemory.Search, async (req: Authenticated.Request, res) => {
    const start.Time = Date.now();
    try {
      const search.Params = reqvalidated.Data// Generate embedding for the query;
      const { data: embedding } = await supabaserpc('ai_generate_embedding', {
        content: search.Paramsquery})// Perform vector search;
      const { data, error } = await supabaserpc('search_memories', {
        query_embedding: embedding;
        match_threshold: GOOD_CONFIDENC.E;
        match_count: search.Paramslimit;
        filter: search.Paramsfilters});
      if (error) throw error;
      resjson({
        success: true;
        data: {
          results: data;
          count: datalength;
          query: search.Paramsquery;
        };
        metadata: {
          request.Id: reqid;
          timestamp: new Date()toISO.String();
          version: '1.0.0';
          processing.Time: Date.now() - start.Time;
        }})} catch (error instanceof Error ? errormessage : String(error) Error | unknown) {
      loggererror('Search memories error', LogContextAP.I, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)});
      resstatus(400)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'MEMORY_SEARCH_ERRO.R';
          message: error instanceof Error ? errormessage : 'Unknown error';
          details: error;
        };
        metadata: {
          request.Id: reqid;
          timestamp: new Date()toISO.String();
          version: '1.0.0';
          processing.Time: Date.now() - start.Time;
        }})}})// Update memory importance;
  routerput('/:id/importance', async (req: Authenticated.Request, res) => {
    try {
      const { id } = reqparams;
      const { importance } = reqbody;
      const { data, error } = await supabase;
                from('ai_memories'));
                update({ importance }));
                eq('id', id));
                select());
                single());

      if (error) throw error;
      resjson({ success: true, memory: data })} catch (error instanceof Error ? errormessage : String(error) Error | unknown) {
      loggererror('Update memory importance error', LogContextAP.I, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)});
      resstatus(400)json({ error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Failed to update memory importance' })}});
  return router};
