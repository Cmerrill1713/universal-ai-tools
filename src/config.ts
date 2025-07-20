import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  database: {
    supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  },
  
  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  },
  
  server: {
    port: parseInt(process.env.PORT || '9999'),
    host: process.env.HOST || 'localhost',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production'
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production environment');
      }
      console.warn('JWT_SECRET not set, using insecure default. Set JWT_SECRET for production.');
      return 'dev-only-insecure-jwt-secret-' + Date.now();
    })(),
    encryptionKey: process.env.ENCRYPTION_KEY || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY is required in production environment');
      }
      console.warn('ENCRYPTION_KEY not set, using insecure default. Set ENCRYPTION_KEY for production.');
      return 'dev-only-insecure-encryption-key-' + Date.now();
    })(),
    corsOrigins: process.env.NODE_ENV === 'production' 
      ? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:9999']
  },

  // Validate production environment requirements
  ...(process.env.NODE_ENV === 'production' && (() => {
    const requiredEnvVars = [
      'JWT_SECRET',
      'ENCRYPTION_KEY', 
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'CORS_ORIGINS'
    ];
    
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
    
    return {};
  })()),
  
  backup: {
    encryptionPassword: process.env.BACKUP_ENCRYPTION_PASSWORD,
    encryptionSalt: process.env.BACKUP_ENCRYPTION_SALT,
    path: process.env.BACKUP_PATH || './backups'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  rateLimit: {
    default: parseInt(process.env.DEFAULT_RATE_LIMIT || '1000'),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '3600000')
  },
  
  rateLimiting: {
    enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_RATE_LIMITING === 'true'
  }
};

export default config;