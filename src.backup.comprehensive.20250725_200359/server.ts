/**
 * Universal A.I Tools Service - Production Bootstrap Server* Comprehensive server with agent orchestration, authentication, and Web.Socket support*/

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
// Configuration and utilities
import { logger } from './utils/logger';
import { config } from './config/environment-clean';
// Middleware imports (with fallbacks)
// import { apiVersioning } from './middleware/api-versioning'
// import { jwtAuthService } from './middleware/auth-jwt'
// Router imports with fallback handling (start with working ones)
import { memoryRouter } from './routers/memory';
import { orchestrationRouter } from './routers/orchestration';
import { knowledgeRouter } from './routers/knowledge';
import { healthRouter } from './routers/health'// import { authRouter } from './routers/auth'// import { toolRouter } from './routers/tools'// import { speechRouter } from './routers/speech'// import { backupRouter } from './routers/backup'// import { chatRouter } from './routers/chat'// Service imports// import { dspyService } from './services/dspy-service';
import { UniversalAgentRegistry } from './agents/universal_agent_registry'// Constants;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)// Application setup;
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['G.E.T', 'PO.S.T']}})// Configuration;
const PORT = process.env.PORT || 9999;
const NODE_ENV = process.env.NODE_ENV || 'development'// Supabase client;
let supabase: any = null,
try {
  supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');
  logger.info('✅ Supabase client initialized')} catch (error) {
  logger.error('❌ Failed to initialize Supabase client:', error)}// J.W.T Auth Service (disabled for now);
const jwt.Auth.Service: any = null/*
if (supabase) {
  try {
    jwt.Auth.Service = new JWT.Auth.Service(supabase);
    logger.info('✅ J.W.T authentication service initialized')} catch (error) {
    logger.error('❌ Failed to initialize J.W.T auth service:', error)}}*/

// Redis service with fallback;
let redis.Service: any = null,
try {
  const { get.Redis.Service } = await import('./services/redis-service');
  redis.Service = get.Redis.Service();
  await redis.Serviceconnect();
  logger.info('✅ Redis service connected')} catch (error) {
  logger.warn('⚠️ Redis service not available, using fallback:', error)}// Agent Registry initialization;
let agent.Registry: any = null,
try {
  agent.Registry = new UniversalAgentRegistry(null, supabase);
  logger.info('✅ Universal Agent Registry initialized with agents')} catch (error) {
  logger.error('❌ Failed to initialize Agent Registry:', error)}// Basic middleware setup;
appuse(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true})),
appuse(express.json({ limit: '50mb' })),
appuse(express.urlencoded({ extended: true, limit: '50mb' }))// A.P.I versioning middleware (disabled for now)// appuse(api.Versioning)// Request logging middleware,
appuse((req, res, next) => {
  logger.info(`${reqmethod} ${reqpath}`, {
    user.Agent: reqget('User-Agent'),
    ip: reqip}),
  next()})// Authentication middleware for protected routes;
const auth.Middleware = (req: any, res: any, next: any) => {
  const auth.Header = reqheadersauthorization;
  const api.Key = reqheaders['x-api-key']// Skip auth for health checks and public endpoints;
  if (reqpath === '/health' || reqpath === '/api/health' || reqpath === '/') {
    return next();

  if (api.Key) {
    // A.P.I Key authentication;
    reqapi.Key = api.Key;
    reqai.Service = { service_name: reqheaders['x-ai-service'] || 'default' ,
    return next();

  if (auth.Header && auth.Headerstarts.With('Bearer ')) {
    const token = auth.Headersubstring(7);
    try {
      const decoded = jwtverify(token, process.envJWT_SECR.E.T || 'fallback-secret');
      requser = decoded;
      return next()} catch (error) {
      return resstatus(401)json({ error instanceof Error ? errormessage : String(error) 'Invalid token' })}}// For development, allow unauthenticated requests;
  if (NODE_ENV === 'development') {
    requser = { id: 'dev-user' ,
    return next();

  return resstatus(401)json({ error instanceof Error ? errormessage : String(error) 'Authentication required' })}// Health check endpoint;
appget('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date()toIS.O.String(),
    services: {
      supabase: !!supabase,
      redis: !!redis.Service,
      agent.Registry: !!agent.Registry,
      dspy: true, // dspyService is always available;
    agents: agent.Registry ? agentRegistryget.Available.Agents() : [],
    version: process.envnpm_package_version || '1.0.0',
}  resjson(health)})// Root endpoint;
appget('/', (req, res) => {
  resjson({
    service: 'Universal A.I Tools',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: {
        memory: '/api/v1/memory',
        orchestration: '/api/v1/orchestration',
        knowledge: '/api/v1/knowledge',
        auth: '/api/v1/auth',
        tools: '/api/v1/tools',
        speech: '/api/v1/speech',
        backup: '/api/v1/backup',
      }}})})// A.P.I Routes with error handling;
function safe.Router.Setup(path: string, router.Factory: any, description: string) {
  try {
    if (supabase && router.Factory) {
      const router = router.Factory(supabase);
      appuse(path, auth.Middleware, router);
      logger.info(`✅ ${description} router mounted at ${path}`)}} catch (error) {
    logger.error(`❌ Failed to mount ${description} router:`, error)}}// Mount routers;
safe.Router.Setup('/api/v1/memory', Memory.Router, 'Memory');
safe.Router.Setup('/api/v1/orchestration', Orchestration.Router, 'Orchestration');
safe.Router.Setup('/api/v1/knowledge', knowledgeRouter, 'Knowledge')// safe.Router.Setup('/api/v1/tools', toolRouter, 'Tools')// safe.Router.Setup('/api/v1/speech', speechRouter, 'Speech')// safe.Router.Setup('/api/v1/backup', backupRouter, 'Backup')// safe.Router.Setup('/api/v1/chat', chatRouter, 'Chat')// Health router;
try {
  if (healthRouter && supabase) {
    appuse('/api/health', healthRouter(supabase));
    logger.info('✅ Health router mounted at /api/health')}} catch (error) {
  logger.error('❌ Failed to mount Health router:', error)}// Auth router (disabled for now)/*
try {
  if (authRouter) {
    const auth.Router = new authRouter();
    appuse('/api/v1/auth', auth.Routerrouter);
    logger.info('✅ Auth router mounted at /api/v1/auth')}} catch (error) {
  logger.error('❌ Failed to mount Auth router:', error)}*/

// Agent orchestration endpoint;
apppost('/api/v1/agents/execute', auth.Middleware, async (req, res) => {
  try {
    const { agent.Name, task, context = {} } = reqbody;
    if (!agent.Name || !task) {
      return resstatus(400)json({
        error instanceof Error ? errormessage : String(error) 'Agent name and task are required'});

    if (!agent.Registry) {
      return resstatus(503)json({
        error instanceof Error ? errormessage : String(error) 'Agent registry not available'});

    const agent = await agent.Registryget.Agent(agent.Name);
    if (!agent) {
      return resstatus(404)json({
        error instanceof Error ? errormessage : String(error) `Agent '${agent.Name}' not found`});

    const result = await agentexecute({
      task;
      context: {
        .context;
        user.Id: requser?id,
        request.Id: Mathrandom()to.String(36)substr(2, 9)}});
    resjson({
      success: true,
      agent: agent.Name,
      result;
      timestamp: new Date()toIS.O.String()})} catch (error) {
    logger.error('Agent execution error instanceof Error ? errormessage : String(error)', error);
    resstatus(500)json({
      error instanceof Error ? errormessage : String(error) 'Agent execution failed';
      message: error instanceof Error ? errormessage : 'Unknown error'})}})// List available agents,
appget('/api/v1/agents', auth.Middleware, (req, res) => {
  try {
    if (!agent.Registry) {
      return resstatus(503)json({
        error instanceof Error ? errormessage : String(error) 'Agent registry not available'});

    const agents = agentRegistryget.Available.Agents();
    resjson({
      success: true,
      agents;
      total.Count: agentslength})} catch (error) {
    logger.error('Error listing agents:', error);
    resstatus(500)json({
      error instanceof Error ? errormessage : String(error) 'Failed to list agents'})}})// Web.Socket handling;
ioon('connection', (socket) => {
  logger.info(`Web.Socket client connected: ${socketid}`),
  socketon('disconnect', () => {
    logger.info(`Web.Socket client disconnected: ${socketid}`)})// Agent communication,
  socketon('agent:execute', async (data) => {
    try {
      const { agent.Name, task, context = {} } = data;
      if (!agent.Registry) {
        socketemit('agent:error', { error instanceof Error ? errormessage : String(error) 'Agent registry not available' });
        return;

      const agent = await agent.Registryget.Agent(agent.Name);
      if (!agent) {
        socketemit('agent:error', { error instanceof Error ? errormessage : String(error) `Agent '${agent.Name}' not found` });
        return;

      const result = await agentexecute({ task, context });
      socketemit('agent:result', { agent.Name, result })} catch (error) {
      socketemit('agent:error', {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error'})}})})// Error handling middleware;
appuse((error instanceof Error ? errormessage : String(error) any, req: any, res: any, next: any) => {
  logger.error('Unhandled error instanceof Error ? errormessage : String(error)', error);
  resstatus(500)json({
    error instanceof Error ? errormessage : String(error) 'Internal server error';
    message: NODE_ENV === 'development' ? errormessage : 'Something went wrong'})})// 404 handler,
appuse((req, res) => {
  resstatus(404)json({
    error instanceof Error ? errormessage : String(error) 'Not found';
    message: `Path ${reqpath} not found`})})// Graceful shutdown,
async function graceful.Shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully.`);
  try {
    // Close HT.T.P server;
    serverclose(() => {
      logger.info('HT.T.P server closed')})// Close Web.Socket connections;
    ioclose()// Shutdown D.S.Py service (disabled for now)// if (dspyService) {
    //   await dspyServiceshutdown()// }// Close Redis connection;
    if (redis.Service) {
      await redis.Servicedisconnect()}// Close Supabase connections (if needed)// supabase client doesn't need explicit closing;

    logger.info('Graceful shutdown completed');
    processexit(0)} catch (error) {
    logger.error('Error during shutdown:', error);
    processexit(1)}}// Signal handlers;
processon('SIGTE.R.M', () => graceful.Shutdown('SIGTE.R.M'));
processon('SIGI.N.T', () => graceful.Shutdown('SIGI.N.T'))// Error handlers;
processon('uncaught.Exception', (error) => {
  logger.error('Uncaught Exception:', error);
  graceful.Shutdown('uncaught.Exception')});
processon('unhandled.Rejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  graceful.Shutdown('unhandled.Rejection')})// Start server;
const start.Server = async () => {
  try {
    // Initialize D.S.Py service (disabled for now)// await dspyServiceinitialize()// logger.info('✅ D.S.Py service initialized')// Initialize agent collaboration Web.Socket (disabled for now)// if (typeof agentCollaboration.W.S !== 'undefined') {
    //   agentCollaboration.W.Sinitialize(server)// ;

    serverlisten(PORT, () => {
      logger.info(`🚀 Universal A.I Tools Service running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`),
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`),
      logger.info(`📡 Web.Socket server ready`);
      logger.info(`🤝 Agent collaboration Web.Socket ready at /ws/agent-collaboration`);
      if (agent.Registry) {
        const agents = agentRegistryget.Available.Agents();
        logger.info(
          `🤖 ${agentslength} agents available: ${agentsmap((a) => aname)join(', ')}`)}})} catch (error) {
    logger.error('❌ Failed to start server:', error);
    processexit(1)}}// Start the server;
start.Server();
export default app;