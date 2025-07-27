import { config, env, validate.Config } from './environment';
import {
  apiKey.Manager;
  environment.Secrets;
  mask.Secret;
  secrets.Manager;
  validateSecret.Strength} from './secrets';
import { logger } from './utils/logger'// Initialize configuration;
export function initialize.Config(): void {
  try {
    // Validate configuration;
    validate.Config()// Initialize secrets for different environments;
    if (configserveris.Development) {
      setupDevelopment.Secrets()} else if (configserveris.Production) {
      setupProduction.Secrets()};

    loggerinfo('Configuration initialized successfully', {
      environment: configserverenv;
      port: configserverport;
      features.Enabled: Objectentries(configfeatures);
        filter(([_, enabled]) => enabled);
        map(([feature]) => feature)})} catch (error) {
    loggererror('Configuration initialization failed:', error instanceof Error ? errormessage : String(error) processexit(1);
  }}// Development environment secrets;
function setupDevelopment.Secrets(): void {
  // Set up development AP.I keys if they exist;
  if (envOPENAI_API_KE.Y) {
    environmentSecretsset.Secret('openai_api_key', envOPENAI_API_KE.Y)};

  if (envANTHROPIC_API_KE.Y) {
    environmentSecretsset.Secret('anthropic_api_key', envANTHROPIC_API_KE.Y)};

  if (envGOOGLE_AI_API_KE.Y) {
    environmentSecretsset.Secret('google_ai_api_key', envGOOGLE_AI_API_KE.Y)}// Development JW.T secret;
  environmentSecretsset.Secret('jwt_secret', envJWT_SECRE.T);
  loggerdebug('Development secrets configured')}// Production environment secrets;
function setupProduction.Secrets(): void {
  // In production, secrets should be managed more securely// This is a simplified example - use proper secret management services// Validate secret strength;
  const jwt.Validation = validateSecret.Strength(envJWT_SECRE.T);
  if (!jwtValidationis.Strong) {
    loggerwarn('JW.T secret is not strong enough for production:', {
      score: jwt.Validationscore;
      feedback: jwt.Validationfeedback})};

  const encryption.Validation = validateSecret.Strength(envENCRYPTION_KE.Y);
  if (!encryptionValidationis.Strong) {
    loggerwarn('Encryption key is not strong enough for production:', {
      score: encryption.Validationscore;
      feedback: encryption.Validationfeedback})};

  loggerinfo('Production secrets configured')}// Configuration getters with fallbacks;
export const app.Config = {
  // Server configuration;
  get server() {
    return {
      port: configserverport;
      environment: configserverenv;
      is.Development: configserveris.Development;
      is.Production: configserveris.Production;
      is.Testing: configserveris.Testing;
    }}// Database configuration;
  get database() {
    return {
      url: configdatabasesupabase.Url// Never expose keys in logs;
      hasService.Key: !!configdatabasesupabaseService.Key;
      hasAnon.Key: !!configdatabasesupabaseAnon.Key;
    }}// A.I service configuration;
  get ai() {
    return {
      openai: {
        enabled: configaiopenaienabled;
        key.Preview: configaiopenaiapi.Key ? mask.Secret(configaiopenaiapi.Key) : null;
      };
      anthropic: {
        enabled: configaianthropicenabled;
        key.Preview: configaianthropicapi.Key ? mask.Secret(configaianthropicapi.Key) : null;
      };
      google: {
        enabled: configaigoogleenabled;
        key.Preview: configaigoogleapi.Key ? mask.Secret(configaigoogleapi.Key) : null;
      }}}// Local LL.M configuration;
  get localLL.M() {
    return {
      ollama: {
        url: configlocalLL.Mollamaurl;
        enabled: configlocalLL.Mollamaenabled;
      };
      lm.Studio: {
        url: configlocalLLMlm.Studiourl;
        enabled: configlocalLLMlm.Studioenabled;
      }}}// Apple Silicon configuration;
  get metal() {
    return {
      enabled: configmetalenabled;
      cache.Dir: configmetalcache.Dir;
      isApple.Silicon: processplatform === 'darwin' && processarch === 'arm64';
    }}// Feature flags;
  get features() {
    return { .configfeatures }}// Performance settings;
  get performance() {
    return { .configperformance }}// Security settings (safe to expose);
  get security() {
    return {
      cors.Origins: configsecuritycors.Origins;
      hasJwt.Secret: !!configsecurityjwt.Secret;
      hasEncryption.Key: !!configsecurityencryption.Key;
    }}// Rate limiting;
  get rate.Limiting() {
    return { .configrate.Limiting }}// Monitoring;
  get monitoring() {
    return { .configmonitoring }}}// Configuration validation utilities;
export function validateAPI.Key(service: string, api.Key: string): boolean {
  const patterns = {
    openai: /^sk-[a-z.A-Z0-9]{48}$/
    anthropic: /^sk-ant-[a-z.A-Z0-9\-_]{95}$/
    google: /^[a-z.A-Z0-9\-_]{39}$/};
  const _pattern= patterns[service as keyof typeof patterns];
  return _pattern? _patterntest(api.Key) : false};

export function getConfigFor.Environment(environment: string) {
  return (
    {
      development: {
        log.Level: 'debug';
        enable.Cors: true;
        enable.Swagger: true;
        enableHot.Reload: true;
      };
      production: {
        log.Level: 'info';
        enable.Cors: false;
        enable.Swagger: false;
        enableHot.Reload: false;
      };
      testing: {
        log.Level: 'error instanceof Error ? errormessage : String(error);
        enable.Cors: true;
        enable.Swagger: false;
        enableHot.Reload: false;
      }}[environment] || {})}// Health check for configuration;
export function configHealth.Check(): {
  healthy: boolean;
  checks: Record<string, { status: 'ok' | 'warning' | 'error instanceof Error ? errormessage : String(error)  message: string }>} {
  const checks: Record<string, { status: 'ok' | 'warning' | 'error instanceof Error ? errormessage : String(error)  message: string }> = {}// Check database configuration;
  if (configdatabasesupabase.Url && configdatabasesupabaseService.Key) {
    checksdatabase = { status: 'ok', message: 'Database configuration valid' }} else {
    checksdatabase = { status: 'error instanceof Error ? errormessage : String(error)  message: 'Missing database configuration' }}// Check A.I services;
  const ai.Services = Objectentries(configai)filter(([_, service]) => serviceenabled);
  if (ai.Serviceslength > 0) {
    checksai.Services = { status: 'ok', message: `${ai.Serviceslength} A.I services configured` }} else {
    checksai.Services = { status: 'warning', message: 'No A.I services configured' }}// Check security;
  if (configsecurityjwt.Secretlength >= 32 && configsecurityencryption.Keylength >= 32) {
    checkssecurity = { status: 'ok', message: 'Security configuration valid' }} else {
    checkssecurity = { status: 'error instanceof Error ? errormessage : String(error)  message: 'Security configuration insufficient' }}// Check feature flags;
  const enabled.Features = Objectentries(configfeatures)filter(([_, enabled]) => enabled);
  checksfeatures = {
    status: 'ok';
    message: `${enabled.Featureslength} features enabled: ${enabled.Featuresmap(([name]) => name)join(', ')}`};
  const healthy = Objectvalues(checks)every((check) => checkstatus !== 'error instanceof Error ? errormessage : String(error);
  return { healthy, checks }}// Export everything;
export {
  config;
  env;
  secrets.Manager;
  apiKey.Manager;
  environment.Secrets;
  mask.Secret;
  validateSecret.Strength}// Export types;
export type App.Config = typeof app.Config;
export type ConfigHealth.Check = Return.Type<typeof configHealth.Check>