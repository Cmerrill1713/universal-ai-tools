/**
 * Universal AI Tools - Configuration
 * Application configuration and environment variables
 */

export interface Config {
  server: {
    port: number;
    host: string;
    env: string;
  };
  database: {
    supabaseUrl: string;
    supabaseServiceKey: string;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  logging: {
    level: string;
    format: string;
  };
}

const getEnvVar = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  return value ? value.toLowerCase() === 'true' : defaultValue;
};

export const config: Config = {
  server: {
    port: getEnvNumber('PORT', 9999),
    host: getEnvVar('HOST', '0.0.0.0'),
    env: getEnvVar('NODE_ENV', 'development')
  },
  database: {
    supabaseUrl: getEnvVar('SUPABASE_URL', ''),
    supabaseServiceKey: getEnvVar('SUPABASE_SERVICE_KEY', '')
  },
  cors: {
    origin: getEnvVar('CORS_ORIGIN', '*'),
    credentials: getEnvBoolean('CORS_CREDENTIALS', true)
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    format: getEnvVar('LOG_FORMAT', 'json')
  }
};

export default config;