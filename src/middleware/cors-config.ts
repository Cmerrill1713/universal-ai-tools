import cors from 'cors';
import { log, LogContext } from '../utils/logger';

// Allowed origins for CORS
const allowedOrigins: string[] = [];

// Only add development origins in development mode
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:9999',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:9999'
  );
}

// Add production URLs if defined and valid
if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('https://')) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.PRODUCTION_URL && process.env.PRODUCTION_URL.startsWith('https://')) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Only allow requests with no origin in development
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      } else {
        log.warn('Request with no origin blocked', LogContext.API);
        return callback(new Error('Origin required'));
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      log.warn('CORS request blocked', LogContext.API, { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],'
  allowedHeaders: [
    'Content-Type','
    'Authorization','
    'X-API-Key','
    'X-AI-Service','
    'X-Session-ID','
    'X-Conversation-ID','
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Current-Page', 'X-Per-Page'],'
  maxAge: 3600, // 1 hour for security
};

export const corsMiddleware = cors(corsOptions);

// Log CORS configuration on startup
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  log.error('No CORS origins configured for production!', LogContext.API);
}
