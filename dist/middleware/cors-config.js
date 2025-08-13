import cors from 'cors';
const allowedOrigins = [];
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5173', 'http://localhost:9999', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:9999');
}
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.PRODUCTION_URL) {
    allowedOrigins.push(process.env.PRODUCTION_URL);
}
export const corsOptions = {
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            if (process.env.NODE_ENV !== 'production')
                return callback(null, true);
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
    maxAge: 86400,
};
export const corsMiddleware = cors(corsOptions);
//# sourceMappingURL=cors-config.js.map