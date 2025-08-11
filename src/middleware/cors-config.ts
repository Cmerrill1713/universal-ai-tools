import cors from 'cors';

// Allowed origins for CORS
const allowedOrigins: string[] = [];

// In non-production, allow localhost defaults for development
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:9999',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:9999'
  );
}

// Add environment-defined URLs (both dev and prod)
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Always allow requests with no Origin header (native apps, curl/Postman)
    // This does not weaken browser CORS, because browsers always send Origin
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In production, block unknown origins; in development, allow all
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-AI-Service',
    'X-Session-ID',
    'X-Conversation-ID',
    'X-Request-Id',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Current-Page', 'X-Per-Page'],
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);
