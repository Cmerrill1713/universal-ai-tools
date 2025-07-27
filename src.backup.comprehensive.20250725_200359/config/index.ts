import { config, env, validate.Config } from './environment';
import {
  api.Key.Manager;
  environment.Secrets;
  mask.Secret;
  secrets.Manager;
  validate.Secret.Strength} from './secrets';
import { logger } from './utils/logger'// Initialize configuration;
export function initialize.Config(): void {
  try {
    // Validate configuration;
    validate.Config()// Initialize secrets for different environments;
    if (configserveris.Development) {
      setup.Development.Secrets()} else if (configserveris.Production) {
      setup.Production.Secrets();

    loggerinfo('Configuration initialized successfully', {
      environment: configserverenv,
      port: configserverport,
      features.Enabled: Objectentries(configfeatures),
        filter(([_, enabled]) => enabled);
        map(([feature]) => feature)})} catch (error) {
    loggererror('Configuration initialization failed:', error instanceof Error ? errormessage : String(error) processexit(1);
  }}// Development environment secrets;
function setup.Development.Secrets(): void {
  // Set up development A.P.I keys if they exist;
  if (envOPENAI_API_K.E.Y) {
    environment.Secretsset.Secret('openai_api_key', envOPENAI_API_K.E.Y);

  if (envANTHROPIC_API_K.E.Y) {
    environment.Secretsset.Secret('anthropic_api_key', envANTHROPIC_API_K.E.Y);

  if (envGOOGLE_AI_API_K.E.Y) {
    environment.Secretsset.Secret('google_ai_api_key', envGOOGLE_AI_API_K.E.Y)}// Development J.W.T secret;
  environment.Secretsset.Secret('jwt_secret', envJWT_SECR.E.T);
  loggerdebug('Development secrets configured')}// Production environment secrets;
function setup.Production.Secrets(): void {
  // In production, secrets should be managed more securely// This is a simplified example - use proper secret management services// Validate secret strength;
  const jwt.Validation = validate.Secret.Strength(envJWT_SECR.E.T);
  if (!jwt.Validationis.Strong) {
    loggerwarn('J.W.T secret is not strong enough for production:', {
      score: jwt.Validationscore,
      feedback: jwt.Validationfeedback}),

  const encryption.Validation = validate.Secret.Strength(envENCRYPTION_K.E.Y);
  if (!encryption.Validationis.Strong) {
    loggerwarn('Encryption key is not strong enough for production:', {
      score: encryption.Validationscore,
      feedback: encryption.Validationfeedback}),

  loggerinfo('Production secrets configured')}// Configuration getters with fallbacks;
export const app.Config = {
  // Server configuration;
  get server() {
    return {
      port: configserverport,
      environment: configserverenv,
      is.Development: configserveris.Development,
      is.Production: configserveris.Production,
      is.Testing: configserveris.Testing,
    }}// Database configuration;
  get database() {
    return {
      url: configdatabasesupabase.Url// Never expose keys in logs,
      has.Service.Key: !!configdatabasesupabase.Service.Key,
      has.Anon.Key: !!configdatabasesupabase.Anon.Key,
    }}// A.I service configuration;
  get ai() {
    return {
      openai: {
        enabled: configaiopenaienabled,
        key.Preview: configaiopenaiapi.Key ? mask.Secret(configaiopenaiapi.Key) : null,
}      anthropic: {
        enabled: configaianthropicenabled,
        key.Preview: configaianthropicapi.Key ? mask.Secret(configaianthropicapi.Key) : null,
}      google: {
        enabled: configaigoogleenabled,
        key.Preview: configaigoogleapi.Key ? mask.Secret(configaigoogleapi.Key) : null,
      }}}// Local L.L.M configuration;
  get localL.L.M() {
    return {
      ollama: {
        url: configlocalL.L.Mollamaurl,
        enabled: configlocalL.L.Mollamaenabled,
}      lm.Studio: {
        url: configlocalLL.Mlm.Studiourl,
        enabled: configlocalLL.Mlm.Studioenabled,
      }}}// Apple Silicon configuration;
  get metal() {
    return {
      enabled: configmetalenabled,
      cache.Dir: configmetalcache.Dir,
      is.Apple.Silicon: processplatform === 'darwin' && processarch === 'arm64',
    }}// Feature flags;
  get features() {
    return { .configfeatures }}// Performance settings;
  get performance() {
    return { .configperformance }}// Security settings (safe to expose);
  get security() {
    return {
      cors.Origins: configsecuritycors.Origins,
      has.Jwt.Secret: !!configsecurityjwt.Secret,
      has.Encryption.Key: !!configsecurityencryption.Key,
    }}// Rate limiting;
  get rate.Limiting() {
    return { .configrate.Limiting }}// Monitoring;
  get monitoring() {
    return { .configmonitoring }}}// Configuration validation utilities;
export function validateAP.I.Key(service: string, api.Key: string): boolean {
  const patterns = {
    openai: /^sk-[a-z.A-Z0-9]{48}$/
    anthropic: /^sk-ant-[a-z.A-Z0-9\-_]{95}$/
    google: /^[a-z.A-Z0-9\-_]{39}$/,
  const _pattern= patterns[service as keyof typeof patterns];
  return _pattern? _patterntest(api.Key) : false;

export function getConfig.For.Environment(environment: string) {
  return (
    {
      development: {
        log.Level: 'debug',
        enable.Cors: true,
        enable.Swagger: true,
        enable.Hot.Reload: true,
}      production: {
        log.Level: 'info',
        enable.Cors: false,
        enable.Swagger: false,
        enable.Hot.Reload: false,
}      testing: {
        log.Level: 'error instanceof Error ? errormessage : String(error),
        enable.Cors: true,
        enable.Swagger: false,
        enable.Hot.Reload: false,
      }}[environment] || {})}// Health check for configuration;
export function config.Health.Check(): {
  healthy: boolean,
  checks: Record<string, { status: 'ok' | 'warning' | 'error instanceof Error ? errormessage : String(error)  message: string }>} {
  const checks: Record<string, { status: 'ok' | 'warning' | 'error instanceof Error ? errormessage : String(error)  message: string }> = {}// Check database configuration,
  if (configdatabasesupabase.Url && configdatabasesupabase.Service.Key) {
    checksdatabase = { status: 'ok', message: 'Database configuration valid' }} else {
    checksdatabase = { status: 'error instanceof Error ? errormessage : String(error)  message: 'Missing database configuration' }}// Check A.I services,
  const ai.Services = Objectentries(configai)filter(([_, service]) => serviceenabled);
  if (ai.Serviceslength > 0) {
    checksai.Services = { status: 'ok', message: `${ai.Serviceslength} A.I services configured` }} else {
    checksai.Services = { status: 'warning', message: 'No A.I services configured' }}// Check security,
  if (configsecurityjwt.Secretlength >= 32 && configsecurityencryption.Keylength >= 32) {
    checkssecurity = { status: 'ok', message: 'Security configuration valid' }} else {
    checkssecurity = { status: 'error instanceof Error ? errormessage : String(error)  message: 'Security configuration insufficient' }}// Check feature flags,
  const enabled.Features = Objectentries(configfeatures)filter(([_, enabled]) => enabled);
  checksfeatures = {
    status: 'ok',
    message: `${enabled.Featureslength} features enabled: ${enabled.Featuresmap(([name]) => name)join(', ')}`;
  const healthy = Objectvalues(checks)every((check) => checkstatus !== 'error instanceof Error ? errormessage : String(error);
  return { healthy, checks }}// Export everything;
export {
  config;
  env;
  secrets.Manager;
  api.Key.Manager;
  environment.Secrets;
  mask.Secret;
  validate.Secret.Strength}// Export types;
export type App.Config = typeof app.Config;
export type Config.Health.Check = Return.Type<typeof config.Health.Check>