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
    // Enhanced origin validation with security logging
    if (!origin) {
      // Allow requests with no Origin header (native apps, curl/Postman)
      // This does not weaken browser CORS, because browsers always send Origin
      return callback(null, true);
    }

    // Validate against allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Log CORS violations for security monitoring
      console.warn(`🚨 CORS violation: Origin '${origin}' not allowed`, {
        origin,
        allowedOrigins,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      });

      // In production, block unknown origins; in development, allow all
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️ Allowing origin '${origin}' in development mode`);
        return callback(null, true);
      }
      
      return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
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
    'X-CSRF-Token', // Add CSRF protection header
    'X-Client-Version', // Add client version tracking
    'User-Agent'
  ],
  exposedHeaders: [
    'X-Total-Count', 
    'X-Page-Count', 
    'X-Current-Page', 
    'X-Per-Page',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-Id'
  ],
  maxAge: process.env.NODE_ENV === 'production' ? 86400 : 600, // 24h prod, 10min dev
  optionsSuccessStatus: 204, // Some legacy browsers choke on 204
  preflightContinue: false
};

export const corsMiddleware = cors(corsOptions);
