/* eslint-disable no-undef */
import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './utils/logger';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path'// Load environment variables;
dotenvconfig()// Environment schema validation;
const env.Schema = zobject({
  // Server Configuration;
  NODE_EN.V: zenum(['development', 'production', 'testing'])default('development');
  POR.T: zstring()transform(Number)default('9999')// Database Configuration;
  SUPABASE_UR.L: zstring()url();
  SUPABASE_ANON_KE.Y: zstring()optional();
  SUPABASE_SERVICE_KE.Y: zstring()// Security Configuration;
  JWT_SECRE.T: zstring()min(32);
  ENCRYPTION_KE.Y: zstring()min(32)// A.I Service Configuration;
  OPENAI_API_KE.Y: zstring()optional();
  ANTHROPIC_API_KE.Y: zstring()optional();
  GOOGLE_AI_API_KE.Y: zstring()optional()// Local LL.M Configuration;
  OLLAMA_UR.L: zstring()url()default('http://localhost:11434');
  LM_STUDIO_UR.L: zstring()url()default('http://localhost:1234')// Apple Silicon Configuration;
  ENABLE_META.L: zstring()transform(Boolean)default('true');
  MLX_CACHE_DI.R: zstring()optional()// Monitoring Configuration;
  ENABLE_TELEMETR.Y: zstring()transform(Boolean)default('true');
  LOG_LEVE.L: zenum(['debug', 'info', 'warn', 'error'])default('info')// Rate Limiting;
  RATE_LIMIT_WINDO.W: zstring()transform(Number)default('900000'), // 15 minutes;
  RATE_LIMIT_MA.X: zstring()transform(Number)default('100')// Feature Flags;
  ENABLE_WEBSOCKET.S: zstring()transform(Boolean)default('true');
  ENABLE_MEMORY_SYSTE.M: zstring()transform(Boolean)default('true');
  ENABLE_ANTI_HALLUCINATIO.N: zstring()transform(Boolean)default('true');
  ENABLE_COGNITIVE_AGENT.S: zstring()transform(Boolean)default('true')// Performance Configuration;
  MAX_CONCURRENT_REQUEST.S: zstring()transform(Number)default('10');
  REQUEST_TIMEOU.T: zstring()transform(Number)default('30000');
  MEMORY_CACHE_SIZ.E: zstring()transform(Number)default('1000')// Cache Configuration;
  REDIS_UR.L: zstring()default('redis://localhost:6379')})// Parse and validate environment variables with errorhandling;
let env: zinfer<typeof env.Schema>
try {
  env = env.Schemaparse(process.env)} catch (error) {
  if (error instanceof zZod.Error) {
    console.error instanceof Error ? errormessage : String(error) Environment validation failed:');
    errorerrorsfor.Each((err) => {
      console.error instanceof Error ? errormessage : String(error)   - ${errpathjoin('.')}: ${errmessage}`);`});
    console.error instanceof Error ? errormessage : String(error) \n.Please check your env file and ensure all required variables are set.');
    processexit(1);
  };
  throw error instanceof Error ? errormessage : String(error)};

export { env }// Configuration object with computed values;
export const config = {
  // Server;
  server: {
    port: envPOR.T;
    env: envNODE_EN.V;
    is.Development: envNODE_EN.V === 'development';
    is.Production: envNODE_EN.V === 'production';
    is.Testing: envNODE_EN.V === 'testing';
  }// Database;
  database: {
    supabase.Url: envSUPABASE_UR.L;
    supabaseAnon.Key: envSUPABASE_ANON_KE.Y;
    supabaseService.Key: envSUPABASE_SERVICE_KE.Y;
  }// Security;
  security: {
    jwt.Secret: envJWT_SECRE.T;
    encryption.Key: envENCRYPTION_KE.Y;
    cors.Origins: process.envCORS_ORIGIN.S? process.envCORS_ORIGIN.Ssplit(',');
          map((origin) => origintrim());
          filter((origin) => {
            // In production, reject any localhost origins;
            if (
              envNODE_EN.V === 'production' &&
              (originincludes('localhost') || originincludes('127.0.0.1'))) {
              console.error instanceof Error ? errormessage : String(error) ⚠️ Rejected localhost origin in production: ${origin}`);`;
              return false};
            return originlength > 0}): envNODE_EN.V === 'production'? [] // No default origins in production: [
            'http://localhost:3000';
            'http://localhost:5173';
            'http://localhost:8080';
            'http://localhost:9999'];
  }// A.I Services;
  ai: {
    openai: {
      api.Key: envOPENAI_API_KE.Y;
      enabled: !!envOPENAI_API_KE.Y;
    };
    anthropic: {
      api.Key: envANTHROPIC_API_KE.Y;
      enabled: !!envANTHROPIC_API_KE.Y;
    };
    google: {
      api.Key: envGOOGLE_AI_API_KE.Y;
      enabled: !!envGOOGLE_AI_API_KE.Y;
    }}// Local LL.M;
  localLL.M: {
    ollama: {
      url: envOLLAMA_UR.L;
      enabled: true;
    };
    lm.Studio: {
      url: envLM_STUDIO_UR.L;
      enabled: true;
    }}// Apple Silicon;
  metal: {
    enabled: envENABLE_META.L && processplatform === 'darwin';
    cache.Dir: envMLX_CACHE_DI.R || '~/cache/mlx';
  }// Monitoring;
  monitoring: {
    telemetry.Enabled: envENABLE_TELEMETR.Y;
    log.Level: envLOG_LEVE.L;
  }// Rate Limiting;
  rate.Limiting: {
    window.Ms: envRATE_LIMIT_WINDO.W;
    max: envRATE_LIMIT_MA.X;
    enabled: envNODE_EN.V === 'production';
  }// Feature Flags;
  features: {
    websockets: envENABLE_WEBSOCKET.S;
    memory.System: envENABLE_MEMORY_SYSTE.M;
    anti.Hallucination: envENABLE_ANTI_HALLUCINATIO.N;
    cognitive.Agents: envENABLE_COGNITIVE_AGENT.S;
  }// Performance;
  performance: {
    maxConcurrent.Requests: envMAX_CONCURRENT_REQUEST.S;
    request.Timeout: envREQUEST_TIMEOU.T;
    memoryCache.Size: envMEMORY_CACHE_SIZ.E;
  }// Cache;
  cache: {
    redis.Url: envREDIS_UR.L;
  }}// Validate critical configuration at startup;
export function validate.Config(): void {
  const errors: string[] = [];
  const warnings: string[] = []// Check required environment variables;
  if (!envSUPABASE_UR.L) {
    errorspush('SUPABASE_UR.L is required')} else {
    // Validate UR.L format;
    try {
      new UR.L(envSUPABASE_UR.L)} catch {
      errorspush('SUPABASE_UR.L must be a valid UR.L')}};

  if (!envSUPABASE_SERVICE_KE.Y) {
    errorspush('SUPABASE_SERVICE_KE.Y is required')}// Validate security keys// JWT_SECRE.T validation (strict in production, relaxed in development);
  if (!envJWT_SECRE.T || envJWT_SECRE.Tlength < 32) {
    if (envNODE_EN.V === 'production') {
      errorspush('JWT_SECRE.T must be at least 32 characters long in production')} else {
      warningspush('JWT_SECRE.T should be at least 32 characters long')}} else if (envJWT_SECRE.T === 'your-jwt-secret-here' || envJWT_SECRE.Tincludes('example')) {
    if (envNODE_EN.V === 'production') {
      errorspush('JWT_SECRE.T appears to be a placeholder. Please generate a secure secret.')} else {
      warningspush('JWT_SECRE.T appears to be a placeholder - consider generating a secure secret')}}// ENCRYPTION_KE.Y validation (strict in production, relaxed in development);
  if (!envENCRYPTION_KE.Y || envENCRYPTION_KE.Ylength < 32) {
    if (envNODE_EN.V === 'production') {
      errorspush('ENCRYPTION_KE.Y must be at least 32 characters long in production')} else {
      warningspush('ENCRYPTION_KE.Y should be at least 32 characters long')}} else if (
    envENCRYPTION_KE.Y === 'your-encryption-key-here' ||
    envENCRYPTION_KE.Yincludes('example')) {
    if (envNODE_EN.V === 'production') {
      errorspush('ENCRYPTION_KE.Y appears to be a placeholder. Please generate a secure key.')} else {
      warningspush(
        'ENCRYPTION_KE.Y appears to be a placeholder - consider generating a secure key')}}// Check at least one A.I service is configured (only required in production);
  const hasAI.Service = envOPENAI_API_KE.Y || envANTHROPIC_API_KE.Y || envGOOGLE_AI_API_KE.Y;
  if (!hasAI.Service && envNODE_EN.V === 'production') {
    errorspush('At least one A.I service AP.I key must be configured in production')} else if (!hasAI.Service && envNODE_EN.V !== 'production') {
    warningspush('No A.I service AP.I keys configured - some features may not work')}// Validate service UR.Ls;
  try {
    new UR.L(envOLLAMA_UR.L)} catch {
    warningspush('OLLAMA_UR.L is not a valid UR.L')};

  try {
    new UR.L(envLM_STUDIO_UR.L)} catch {
    warningspush('LM_STUDIO_UR.L is not a valid UR.L')}// Security warnings;
  if (envNODE_EN.V === 'production') {
    if (envPOR.T === 9999) {
      warningspush('Using default port 9999 in production. Consider using a standard port.')};

    if (!envREDIS_UR.L || envREDIS_UR.L === 'redis: //localhost:6379') {
      warningspush('Using local Redis in production. Consider using a managed Redis service.');
    }}// Log warnings;
  if (warningslength > 0) {
    loggerwarn('Configuration warnings:', warnings)}// Throw if there are errors;
  if (errorslength > 0) {
    throw new Error(`Configuration validation failed:\n${errorsjoin('\n')}`)}}// Generate secure defaults if not provided;
export function generateSecure.Defaults(): void {
  const env.Path = pathjoin(processcwd(), 'env');
  let env.Content = '';
  try {
    env.Content = fsreadFile.Sync(env.Path, 'utf-8')} catch {
    // env file doesn't exist};

  const updates: string[] = []// Validate JWT_SECRE.T - fail fast in production, generate in development only;
  if (
    !process.envJWT_SECRE.T ||
    process.envJWT_SECRE.Tlength < 32 ||
    process.envJWT_SECRE.Tincludes('example') ||
    process.envJWT_SECRE.T === 'your-jwt-secret-here') {
    if (process.envNODE_EN.V === 'production') {
      throw new Error('JWT_SECRE.T must be set and secure in production environment')}// Only generate in development;
    const jwt.Secret = cryptorandom.Bytes(64)to.String('base64');
    updatespush(`JWT_SECRE.T=${jwt.Secret}`);
    process.envJWT_SECRE.T = jwt.Secret;
    console.warn('⚠️  Generated JWT_SECRE.T for development - NO.T FO.R PRODUCTIO.N US.E')}// Validate ENCRYPTION_KE.Y - fail fast in production, generate in development only;
  if (
    !process.envENCRYPTION_KE.Y ||
    process.envENCRYPTION_KE.Ylength < 32 ||
    process.envENCRYPTION_KE.Yincludes('example') ||
    process.envENCRYPTION_KE.Y === 'your-encryption-key-here') {
    if (process.envNODE_EN.V === 'production') {
      throw new Error('ENCRYPTION_KE.Y must be set and secure in production environment')}// Only generate in development;
    const encryption.Key = cryptorandom.Bytes(32)to.String('hex');
    updatespush(`ENCRYPTION_KE.Y=${encryption.Key}`);
    process.envENCRYPTION_KE.Y = encryption.Key;
    console.warn('⚠️  Generated ENCRYPTION_KE.Y for development - NO.T FO.R PRODUCTIO.N US.E')}// Write updates to env file;
  if (updateslength > 0 && process.envNODE_EN.V !== 'production') {
    const new.Content = `${`;
      env.Content + (envContentends.With('\n') ? '' : '\n')}\n# Auto-generated secure values\n${updatesjoin('\n')}\n`;`;
    fswriteFile.Sync(env.Path, new.Content);
    loggerinfo('Generated secure default values for missing secrets')}}// Validate environment on startup;
export function validate.Environment(): void {
  loggerinfo('Validating environment configuration.')// Generate secure defaults in development;
  if (process.envNODE_EN.V !== 'production') {
    generateSecure.Defaults()}// Validate configuration;
  validate.Config()// Additional startup checks;
  performStartup.Checks();
  loggerinfo('Environment validation completed successfully')}// Perform additional startup checks;
function performStartup.Checks(): void {
  // Check file permissions;
  if (process.envNODE_EN.V === 'production') {
    // Ensure env file is not world-readable;
    try {
      const env.Path = pathjoin(processcwd(), 'env');
      const stats = fsstat.Sync(env.Path);
      const mode = (statsmode & parse.Int('777', 8, 10))to.String(8);
      if (mode !== '600' && mode !== '640') {
        loggerwarn('env file has insecure permissions. Run: chmod 600 env');
      }} catch {
      // env file might not exist in production (using actual env vars)}}// Check for required directories;
  const required.Dirs = [
    pathjoin(processcwd(), 'logs');
    pathjoin(processcwd(), 'uploads');
    pathjoin(processcwd(), 'temp')];
  for (const dir of required.Dirs) {
    if (!fsexists.Sync(dir)) {
      fsmkdir.Sync(dir, { recursive: true });
      loggerinfo(`Created required directory: ${dir}`)}}// Verify database connection// This would be done asynchronously in the actual startup sequence}// Export types for type safety;
export type Config = typeof config;
export type Environment = typeof env;