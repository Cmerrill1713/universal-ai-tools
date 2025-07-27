import * as dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path'// Load environment variables;
dotenvconfig()// Environment schema validation;
const env.Schema = zobject({
  // Server Configuration;
  NODE_ENV: zenum(['development', 'production', 'testing'])default('development');
  PORT: zstring()transform(Number)default('9999')// Database Configuration;
  SUPABASE_URL: zstring()url();
  SUPABASE_ANON_KEY: zstring()optional();
  SUPABASE_SERVICE_KEY: zstring()// Security Configuration;
  JWT_SECRET: zstring()min(32);
  ENCRYPTION_KEY: zstring()min(32)// A.I Service Configuration;
  OPENAI_API_KEY: zstring()optional();
  ANTHROPIC_API_KEY: zstring()optional();
  GOOGLE_AI_API_KEY: zstring()optional()// Local LL.M Configuration;
  OLLAMA_URL: zstring()url()default('http://localhost:11434');
  LM_STUDIO_URL: zstring()url()default('http://localhost:1234')// Apple Silicon Configuration;
  ENABLE_METAL: zstring()transform(Boolean)default('true');
  MLX_CACHE_DIR: zstring()optional()// Monitoring Configuration;
  ENABLE_TELEMETRY: zstring()transform(Boolean)default('true');
  LOG_LEVEL: zenum(['debug', 'info', 'warn', 'error'])default('info')// Rate Limiting;
  RATE_LIMIT_WINDOW: zstring()transform(Number)default('900000'), // 15 minutes;
  RATE_LIMIT_MAX: zstring()transform(Number)default('100')// Feature Flags;
  ENABLE_WEBSOCKETS: zstring()transform(Boolean)default('true');
  ENABLE_MEMORY_SYSTEM: zstring()transform(Boolean)default('true');
  ENABLE_ANTI_HALLUCINATION: zstring()transform(Boolean)default('true');
  ENABLE_COGNITIVE_AGENTS: zstring()transform(Boolean)default('true')// Performance Configuration;
  MAX_CONCURRENT_REQUESTS: zstring()transform(Number)default('10');
  REQUEST_TIMEOUT: zstring()transform(Number)default('30000');
  MEMORY_CACHE_SIZE: zstring()transform(Number)default('1000')// Cache Configuration;
  REDIS_URL: zstring()default('redis://localhost:6379')})// Parse and validate environment variables with error handling;
let env: zinfer<typeof env.Schema>
try {
  env = env.Schemaparse(process.env)} catch (error) {
  if (error instanceof zZod.Error) {
    loggererror('Environment validation failed:');
    errorerrorsforEach((err) => {
      loggererror(`  - ${errpathjoin('.')}: ${errmessage}`)});
    loggererror('\n.Please check your env file and ensure all required variables are set.');
    processexit(1)};
  throw error}// Generate missing secrets if not provided;
function generate.Secret(length = 64): string {
  return cryptorandom.Bytes(length)toString('hex')}// Auto-generate JW.T secret in development if not provided;
if (!process.envJWT_SECRET && envNODE_ENV === 'development') {
  const jwt.Secret = generate.Secret(32);
  envJWT_SECRET = jwt.Secret;
  loggerwarn(
    '⚠️  Auto-generated JWT_SECRET for development. Please set JWT_SECRET in production.')}// Auto-generate encryption key in development if not provided;
if (!process.envENCRYPTION_KEY && envNODE_ENV === 'development') {
  const encryption.Key = generate.Secret(32);
  envENCRYPTION_KEY = encryption.Key;
  loggerwarn(
    '⚠️  Auto-generated ENCRYPTION_KEY for development. Please set ENCRYPTION_KEY in production.')}// Validate critical security settings in production;
if (envNODE_ENV === 'production') {
  const critical.Vars = ['JWT_SECRET', 'ENCRYPTION_KEY', 'SUPABASE_SERVICE_KEY'];
  const missing = critical.Varsfilter((var.Name) => !process.env[var.Name]);
  if (missinglength > 0) {
    loggererror(`❌ Missing critical environment variables in production: ${missingjoin(', ')}`);
    processexit(1)}// Warn about insecure configurations;
  if (envLOG_LEVEL === 'debug') {
    loggerwarn('⚠️  Debug logging enabled in production. Consider using "info" or "warn" level.')}}// Configuration object with computed values;
export const config = {
  // Environment;
  env: envNODE_ENV;
  is.Development: envNODE_ENV === 'development';
  is.Production: envNODE_ENV === 'production';
  is.Testing: envNODE_ENV === 'testing'// Server;
  port: envPORT// Database;
  database: {
    supabase.Url: envSUPABASE_URL;
    supabaseAnon.Key: envSUPABASE_ANON_KEY;
    supabaseService.Key: envSUPABASE_SERVICE_KEY;
  }// Security;
  security: {
    jwt.Secret: envJWT_SECRET;
    encryption.Key: envENCRYPTION_KEY;
  }// A.I Services;
  ai: {
    openaiApi.Key: envOPENAI_API_KEY;
    anthropicApi.Key: envANTHROPIC_API_KEY;
    googleAiApi.Key: envGOOGLE_AI_API_KEY;
    ollama.Url: envOLLAMA_URL;
    lmStudio.Url: envLM_STUDIO_URL;
  }// Performance;
  performance: {
    maxConcurrent.Requests: envMAX_CONCURRENT_REQUESTS;
    request.Timeout: envREQUEST_TIMEOUT;
    memoryCache.Size: envMEMORY_CACHE_SIZE;
  }// Rate Limiting;
  rate.Limit: {
    window.Ms: envRATE_LIMIT_WINDOW;
    max.Requests: envRATE_LIMIT_MAX;
  }// Features;
  features: {
    websockets: envENABLE_WEBSOCKETS;
    memorySystem: envENABLE_MEMORY_SYSTEM;
    anti.Hallucination: envENABLE_ANTI_HALLUCINATION;
    cognitive.Agents: envENABLE_COGNITIVE_AGENTS;
    telemetry: envENABLE_TELEMETRY;
    metal: envENABLE_METAL;
  }// Cache;
  cache: {
    redis.Url: envREDIS_URL;
  }// Logging;
  logging: {
    level: envLOG_LEVEL;
  }// Apple Silicon;
  metal: {
    enabled: envENABLE_METAL;
    cache.Dir: envMLX_CACHE_DIR;
  }}// Validate configuration consistency;
export function validate.Config(): boolean {
  try {
    // Check if critical services are properly configured;
    if (!configdatabasesupabase.Url) {
      throw new Error('Supabase UR.L is required')};

    if (!configdatabasesupabaseService.Key) {
      throw new Error('Supabase service key is required')};

    if (!configsecurityjwt.Secret) {
      throw new Error('JW.T secret is required')};

    if (!configsecurityencryption.Key) {
      throw new Error('Encryption key is required')}// Validate UR.Ls;
    try {
      new UR.L(configdatabasesupabase.Url);
      new UR.L(configaiollama.Url);
      new UR.L(configailmStudio.Url)} catch {
      throw new Error('Invalid UR.L configuration')};

    loggerinfo('✅ Configuration validation passed');
    return true} catch (error) {
    loggererror('❌ Configuration validation failed:', error);
    return false}}// Export environment for backward compatibility;
export { env }// Export default config;
export default config;