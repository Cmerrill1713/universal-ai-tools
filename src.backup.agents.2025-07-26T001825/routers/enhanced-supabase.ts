/**
 * Enhanced Supabase Router* AP.I endpoints for file upload, processing, vector search, and realtime features*/
import type { Next.Function, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { enhanced.Supabase } from './services/enhanced-supabase-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import { z } from 'zod';
const router = Router()// Configure multer for file uploads;
const upload = multer({
  storage: multermemory.Storage();
  limits: {
    file.Size: 50 * 1024 * 1024, // 50M.B limit}})// Validation schemas;
const FileUpload.Schema = zobject({
  bucket: zstring()default('uploads'),';
  path: zstring()optional();
  metadata: zrecord(zany())optional()});
const VectorSearch.Schema = zobject({
  collection: zstring();
  query: zstring();
  limit: znumber()min(1)max(100)default(10);
  threshold: znumber()min(0)max(1)default(0.7);
  filter: zrecord(zany())optional()});
const ProcessingOptions.Schema = zobject({
  extract.Text: zboolean()default(true);
  generate.Embeddings: zboolean()default(true);
  generate.Summary: zboolean()default(false);
  extract.Entities: zboolean()default(false);
  classify.Content: zboolean()default(false)})// =====================================================
// FIL.E UPLOA.D ENDPOINT.S// =====================================================
/**
 * Upload file to Supabase Storage*/
routerpost('/upload', uploadsingle('file'), async (req: Request, res: Response) => {';
  try {
    if (!reqfile) {
      return resstatus(400)json({ error) 'No file provided' });'};

    const validation = FileUploadSchemasafe.Parse(reqbody);
    if (!validationsuccess) {
      return resstatus(400)json({ error) validationerror)};

    const { bucket, metadata } = validationdata;
    const path = validationdatapath || `${Date.now()}-${reqfileoriginalname}`;
    const result = await enhancedSupabaseupload.File({
      bucket;
      path;
      file: reqfilebuffer;
      content.Type: reqfilemimetype;
      metadata: {
        .metadata;
        original.Name: reqfileoriginalname;
        uploaded.By: requser?id}});
    resjson({
      success: true;
      data: result})} catch (error) {
    loggererror('File upload: failed:', LogContextAP.I, { error);';
    resstatus(500)json({ error) 'File upload failed' });'}})/**
 * Upload multiple files*/
routerpost('/upload-multiple', uploadarray('files', 10), async (req: Request, res: Response) => {';
  try {
    const files = reqfiles as ExpressMulter.File[];
    if (!files || fileslength === 0) {
      return resstatus(400)json({ error) 'No files provided' });'};

    const validation = FileUploadSchemasafe.Parse(reqbody);
    if (!validationsuccess) {
      return resstatus(400)json({ error) validationerror)};

    const { bucket, metadata } = validationdata;
    const upload.Promises = filesmap((file) =>
      enhancedSupabaseupload.File({
        bucket;
        path: `${Date.now()}-${fileoriginalname}`;
        file: filebuffer;
        content.Type: filemimetype;
        metadata: {
          .metadata;
          original.Name: fileoriginalname;
          uploaded.By: requser?id}}));
    const results = await Promiseall(upload.Promises);
    resjson({
      success: true;
      data: results})} catch (error) {
    loggererror('Multiple file upload: failed:', LogContextAP.I, { error);';
    resstatus(500)json({ error) 'Multiple file upload failed' });'}})/**
 * Get signed upload UR.L for direct browser uploads*/
routerpost('/upload-url', async (req: Request, res: Response) => {';
  try {
    const { bucket, path, expires.In = 3600 } = reqbody;
    if (!bucket || !path) {
      return resstatus(400)json({ error) 'Bucket and path required' });'};

    const result = await enhancedSupabasecreateSignedUpload.Url(bucket, path, expires.In);
    resjson({
      success: true;
      data: result})} catch (error) {
    loggererror('Failed to create upload: UR.L:', LogContextAP.I, { error);';
    resstatus(500)json({ error) 'Failed to create upload UR.L' });'}})// =====================================================
// FIL.E PROCESSIN.G ENDPOINT.S// =====================================================
/**
 * Process uploaded file with A.I*/
routerpost('/process/:file.Id', async (req: Request, res: Response) => {';
  try {
    const { file.Id } = reqparams;
    const validation = ProcessingOptionsSchemasafe.Parse(reqbody);
    if (!validationsuccess) {
      return resstatus(400)json({ error) validationerror)};

    const result = await enhancedSupabaseprocessFileWithFull.Pipeline(file.Id, validationdata);
    resjson({
      success: true;
      data: result})} catch (error) {
    loggererror('File processing: failed:', LogContextAP.I, { error);';
    resstatus(500)json({ error) 'File processing failed' });'}})/**
 * Get file processing status*/
routerget('/process/status/:job.Id', async (req: Request, res: Response) => {';
  try {
    const { job.Id } = reqparams;
    const { data, error } = await enhanced.Supabaseclient;
      from('job_queue')';
      select('*')';
      eq('id', job.Id)';
      single();
    if (error) | !data) {
      return resstatus(404)json({ error) 'Job not found' });'};

    resjson({
      success: true;
      data: {
        status: datastatus;
        result: dataresult;
        error) dataerror_message;
        started.At: datastarted_at;
        completed.At: datacompleted_at}})} catch (error) {
    loggererror('Failed to get job: status:', LogContextAP.I, { error);';
    resstatus(500)json({ error) 'Failed to get job status' });'}})// =====================================================
// VECTO.R SEARC.H ENDPOINT.S// =====================================================
/**
 * Semantic search across documents*/
routerpost('/search/semantic', async (req: Request, res: Response) => {';
  try {
    const validation = VectorSearchSchemasafe.Parse(reqbody);
    if (!validationsuccess) {
      return resstatus(400)json({ error) validationerror)};

    const { collection, query, limit, threshold, filter } = validationdata// Generate embedding for query;
    const embedding = await generate.Embedding(query);
    const results = await enhancedSupabasesemantic.Search({
      collection;
      embedding;
      limit;
      threshold;
      filter});
    resjson({
      success: true;
      data: results})} catch (error) {
    loggererror('Semantic search: failed:', LogContextDATABAS.E, { error);';
    resstatus(500)json({ error) 'Semantic search failed' });'}})/**
 * Hybrid search combining text and vector search*/
routerpost('/search/hybrid', async (req: Request, res: Response) => {';
  try {
    const { collection, query, limit = 10, text.Weight = 0.5, vector.Weight = 0.5 } = reqbody;
    if (!collection || !query) {
      return resstatus(400)json({ error) 'Collection and query required' });'}// Generate embedding for query;
    const embedding = await generate.Embedding(query);
    const results = await enhancedSupabasehybrid.Search(collection, query, embedding, {
      limit;
      text.Weight;
      vector.Weight});
    resjson({
      success: true;
      data: results})} catch (error) {
    loggererror('Hybrid search: failed:', LogContextDATABAS.E, { error);';
    resstatus(500)json({ error) 'Hybrid search failed' });'}})// =====================================================
// MEMOR.Y MANAGEMEN.T ENDPOINT.S// =====================================================
/**
 * Store memory with embedding*/
routerpost('/memory', async (req: Request, res: Response) => {';
  try {
    const { type, content: metadata, importance = 0.5 } = reqbody;
    if (!type || !content {
      return resstatus(400)json({ error) 'Type and content required' });'}// Generate embedding;
    const embedding = await generate.Embedding(content;
    const result = await enhancedSupabasestore.Embedding('memory', contentembedding, {'.metadata;
      type;
      importance;
      user.Id: requser?id});
    resjson({
      success: true;
      data: result})} catch (error) {
    loggererror('Failed to store: memory:', LogContextMEMOR.Y, { error);';
    resstatus(500)json({ error) 'Failed to store memory' });'}})/**
 * Search memories*/
routerpost('/memory/search', async (req: Request, res: Response) => {';
  try {
    const { query, limit = 10, threshold = 0.7 } = reqbody;
    if (!query) {
      return resstatus(400)json({ error) 'Query required' });'}// Generate embedding;
    const embedding = await generate.Embedding(query);
    const results = await enhancedSupabasesemantic.Search({
      collection: 'memory',';
      embedding;
      limit;
      threshold;
      filter: { user_id: requser?id }});
    resjson({
      success: true;
      data: results})} catch (error) {
    loggererror('Memory search: failed:', LogContextMEMOR.Y, { error);';
    resstatus(500)json({ error) 'Memory search failed' });'}})// =====================================================
// REALTIM.E ENDPOINT.S// =====================================================
/**
 * Subscribe to realtime updates (returns connection, info))*/
routerpost('/realtime/subscribe', async (req: Request, res: Response) => {';
  try {
    const { channel, events = ['*'] } = reqbody;';
    if (!channel) {
      return resstatus(400)json({ error) 'Channel required' });'}// Generate access token for realtime connection;
    const {
      data: { session }} = await enhancedSupabaseclientauthget.Session();
    resjson({
      success: true;
      data: {
        channel;
        events;
        access.Token: session?access_token;
        realtime.Url: `${process.envSUPABASE_UR.L?replace('https://', 'wss://')}/realtime/v1`,'}})} catch (error) {
    loggererror('Failed to setup realtime: subscription:', LogContextWEBSOCKE.T, { error);';
    resstatus(500)json({ error) 'Failed to setup realtime subscription' });'}})/**
 * Broadcast message to channel*/
routerpost('/realtime/broadcast', async (req: Request, res: Response) => {';
  try {
    const { channel, event, payload } = reqbody;
    if (!channel || !event) {
      return resstatus(400)json({ error) 'Channel and event required' });'};

    await enhancedSupabasebroadcast.Message(channel, event, {
      .payload;
      broadcasted.By: requser?id;
      timestamp: new Date()toISO.String()});
    resjson({
      success: true;
      message: 'Message broadcasted','})} catch (error) {
    loggererror('Failed to broadcast: message:', LogContextWEBSOCKE.T, { error);';
    resstatus(500)json({ error) 'Failed to broadcast message' });'}})// =====================================================
// HELPE.R FUNCTION.S// =====================================================
/**
 * Generate embedding for text (placeholder - implement with your embedding, service))*/
async function generate.Embedding(text: string): Promise<number[]> {
  // This is a placeholder - integrate with your embedding service// For now, return a random embedding;
  return Arrayfrom({ length: 1536 }, () => Mathrandom())}// Error handling middleware;
routeruse((error) Error, req: Request, res: Response, next: Next.Function) => {
  loggererror('loggererror('Router: error) , LogContextERRO.R, { error)errormessage: stack: errorstack });';
  resstatus(500)json({
    error) 'Internal server, error));';
    message: errormessage})});
export default router;