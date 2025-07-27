import * as dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path'// Load environment variables;
dotenvconfig()// Environment schema validation;
const env.Schema = zobject({
  // Server Configuration;
  NODE_EN.V: zenum(['development', 'production', 'testing'])default('development');
  POR.T: zstring()transform(Number)default('9999')// Database Configuration,
  SUPABASE_UR.L: zstring()url(),
  SUPABASE_ANON_KE.Y: zstring()optional(),
  SUPABASE_SERVICE_KE.Y: zstring()// Security Configuration,
  JWT_SECRE.T: zstring()min(32),
  ENCRYPTION_KE.Y: zstring()min(32)// A.I Service Configuration,
  OPENAI_API_KE.Y: zstring()optional(),
  ANTHROPIC_API_KE.Y: zstring()optional(),
  GOOGLE_AI_API_KE.Y: zstring()optional()// Local L.L.M Configuration,
  OLLAMA_UR.L: zstring()url()default('http://localhost:11434'),
  LM_STUDIO_UR.L: zstring()url()default('http://localhost:1234')// Apple Silicon Configuration,
  ENABLE_META.L: zstring()transform(Boolean)default('true'),
  MLX_CACHE_DI.R: zstring()optional()// Monitoring Configuration,
  ENABLE_TELEMETR.Y: zstring()transform(Boolean)default('true'),
  LOG_LEVE.L: zenum(['debug', 'info', 'warn', 'error'])default('info')// Rate Limiting;
  RATE_LIMIT_WINDO.W: zstring()transform(Number)default('900000'), // 15 minutes;
  RATE_LIMIT_MA.X: zstring()transform(Number)default('100')// Feature Flags,
  ENABLE_WEBSOCKET.S: zstring()transform(Boolean)default('true'),
  ENABLE_MEMORY_SYSTE.M: zstring()transform(Boolean)default('true'),
  ENABLE_ANTI_HALLUCINATIO.N: zstring()transform(Boolean)default('true'),
  ENABLE_COGNITIVE_AGENT.S: zstring()transform(Boolean)default('true')// Performance Configuration,
  MAX_CONCURRENT_REQUEST.S: zstring()transform(Number)default('10'),
  REQUEST_TIMEOU.T: zstring()transform(Number)default('30000'),
  MEMORY_CACHE_SIZ.E: zstring()transform(Number)default('1000')// Cache Configuration,
  REDIS_UR.L: zstring()default('redis://localhost:6379')})// Parse and validate environment variables with error handling,
let env: zinfer<typeof env.Schema>
try {
  env = env.Schemaparse(process.env)} catch (error) {
  if (error instanceof z.Zod.Error) {
    loggererror('Environment validation failed:');
    errorerrorsfor.Each((err) => {
      loggererror(`  - ${errpathjoin('.')}: ${errmessage}`)});
    loggererror('\n.Please check your env file and ensure all required variables are set.');
    processexit(1);
  throw error}// Generate missing secrets if not provided;
function generate.Secret(length = 64): string {
  return cryptorandom.Bytes(length)to.String('hex')}// Auto-generate J.W.T secret in development if not provided;
if (!process.envJWT_SECRE.T && envNODE_EN.V === 'development') {
  const jwt.Secret = generate.Secret(32);
  envJWT_SECRE.T = jwt.Secret;
  loggerwarn(
    '⚠️  Auto-generated JWT_SECRE.T for development. Please set JWT_SECRE.T in production.')}// Auto-generate encryption key in development if not provided;
if (!process.envENCRYPTION_KE.Y && envNODE_EN.V === 'development') {
  const encryption.Key = generate.Secret(32);
  envENCRYPTION_KE.Y = encryption.Key;
  loggerwarn(
    '⚠️  Auto-generated ENCRYPTION_KE.Y for development. Please set ENCRYPTION_KE.Y in production.')}// Validate critical security settings in production;
if (envNODE_EN.V === 'production') {
  const critical.Vars = ['JWT_SECRE.T', 'ENCRYPTION_KE.Y', 'SUPABASE_SERVICE_KE.Y'];
  const missing = critical.Varsfilter((var.Name) => !process.env[var.Name]);
  if (missinglength > 0) {
    loggererror(`❌ Missing critical environment variables in production: ${missingjoin(', ')}`);
    processexit(1)}// Warn about insecure configurations;
  if (envLOG_LEVE.L === 'debug') {
    loggerwarn('⚠️  Debug logging enabled in production. Consider using "info" or "warn" level.')}}// Configuration object with computed values;
export const config = {
  // Environment;
  env: envNODE_EN.V,
  is.Development: envNODE_EN.V === 'development',
  is.Production: envNODE_EN.V === 'production',
  is.Testing: envNODE_EN.V === 'testing'// Server,
  port: envPOR.T// Database,
  database: {
    supabase.Url: envSUPABASE_UR.L,
    supabase.Anon.Key: envSUPABASE_ANON_KE.Y,
    supabase.Service.Key: envSUPABASE_SERVICE_KE.Y,
  }// Security;
  security: {
    jwt.Secret: envJWT_SECRE.T,
    encryption.Key: envENCRYPTION_KE.Y,
  }// A.I Services;
  ai: {
    openai.Api.Key: envOPENAI_API_KE.Y,
    anthropic.Api.Key: envANTHROPIC_API_KE.Y,
    googleAi.Api.Key: envGOOGLE_AI_API_KE.Y,
    ollama.Url: envOLLAMA_UR.L,
    lm.Studio.Url: envLM_STUDIO_UR.L,
  }// Performance;
  performance: {
    max.Concurrent.Requests: envMAX_CONCURRENT_REQUEST.S,
    request.Timeout: envREQUEST_TIMEOU.T,
    memory.Cache.Size: envMEMORY_CACHE_SIZ.E,
  }// Rate Limiting;
  rate.Limit: {
    window.Ms: envRATE_LIMIT_WINDO.W,
    max.Requests: envRATE_LIMIT_MA.X,
  }// Features;
  features: {
    websockets: envENABLE_WEBSOCKET.S,
    memory.System: envENABLE_MEMORY_SYSTE.M,
    anti.Hallucination: envENABLE_ANTI_HALLUCINATIO.N,
    cognitive.Agents: envENABLE_COGNITIVE_AGENT.S,
    telemetry: envENABLE_TELEMETR.Y,
    metal: envENABLE_META.L,
  }// Cache;
  cache: {
    redis.Url: envREDIS_UR.L,
  }// Logging;
  logging: {
    level: envLOG_LEVE.L,
  }// Apple Silicon;
  metal: {
    enabled: envENABLE_META.L,
    cache.Dir: envMLX_CACHE_DI.R,
  }}// Validate configuration consistency;
export function validate.Config(): boolean {
  try {
    // Check if critical services are properly configured;
    if (!configdatabasesupabase.Url) {
      throw new Error('Supabase U.R.L is required');

    if (!configdatabasesupabase.Service.Key) {
      throw new Error('Supabase service key is required');

    if (!configsecurityjwt.Secret) {
      throw new Error('J.W.T secret is required');

    if (!configsecurityencryption.Key) {
      throw new Error('Encryption key is required')}// Validate U.R.Ls;
    try {
      new U.R.L(configdatabasesupabase.Url);
      new U.R.L(configaiollama.Url);
      new U.R.L(configailm.Studio.Url)} catch {
      throw new Error('Invalid U.R.L configuration');

    loggerinfo('✅ Configuration validation passed');
    return true} catch (error) {
    loggererror('❌ Configuration validation failed:', error);
    return false}}// Export environment for backward compatibility;
export { env }// Export default config;
export default config;