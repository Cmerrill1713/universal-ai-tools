const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const redis = require('redis');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/var/log/knowledge-context/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/knowledge-context/combined.log' })
  ]
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Redis client
let redisClient;
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });
    
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
};

// Service URLs
const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const CONTEXT_TTL = parseInt(process.env.CONTEXT_TTL || '3600'); // 1 hour default
const MAX_CONTEXT_SIZE = parseInt(process.env.MAX_CONTEXT_SIZE || '8192'); // 8KB default

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        redis: false,
        weaviate: false,
        supabase: false
      },
      config: {
        context_ttl: CONTEXT_TTL,
        max_context_size: MAX_CONTEXT_SIZE
      }
    };

    // Check Redis
    if (redisClient && redisClient.isReady) {
      try {
        await redisClient.ping();
        health.services.redis = true;
      } catch (error) {
        logger.error('Redis health check failed:', error);
      }
    }

    // Check Weaviate
    try {
      const weaviateResponse = await axios.get(`${WEAVIATE_URL}/v1/meta`, { timeout: 5000 });
      health.services.weaviate = weaviateResponse.status === 200;
    } catch (error) {
      logger.error('Weaviate health check failed:', error);
    }

    // Check Supabase - more tolerant health check
    try {
      const supabaseResponse = await axios.get(`${SUPABASE_URL}/health`, { timeout: 5000 });
      health.services.supabase = supabaseResponse.status === 200;
    } catch (error) {
      // Supabase Kong returns 404 for /health, which is expected
      if (error.response && error.response.status === 404) {
        health.services.supabase = true; // Consider 404 as healthy for Supabase
      } else {
        logger.error('Supabase health check failed:', error);
      }
    }

    // Service is healthy if Redis and Weaviate are working (Supabase is optional)
    const coreServicesHealthy = health.services.redis && health.services.weaviate;
    res.status(coreServicesHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create or update conversation context
app.post('/api/v1/context', async (req, res) => {
  try {
    const { session_id, user_id, message, response, metadata = {} } = req.body;
    
    if (!session_id || !user_id || !message) {
      return res.status(400).json({ 
        error: 'session_id, user_id, and message are required' 
      });
    }

    logger.info(`Updating context for session ${session_id}`);

    // Get existing context
    const contextKey = `context:${session_id}`;
    let context = {};

    if (redisClient && redisClient.isReady) {
      try {
        const existingContext = await redisClient.get(contextKey);
        if (existingContext) {
          context = JSON.parse(existingContext);
        }
      } catch (error) {
        logger.error('Failed to get existing context:', error);
      }
    }

    // Add new message to context
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const messageEntry = {
      id: messageId,
      timestamp,
      user_id,
      message,
      response: response || null,
      metadata
    };

    if (!context.messages) {
      context.messages = [];
    }

    context.messages.push(messageEntry);
    context.last_updated = timestamp;
    context.user_id = user_id;

    // Limit context size
    if (JSON.stringify(context).length > MAX_CONTEXT_SIZE) {
      // Remove oldest messages to fit within size limit
      while (JSON.stringify(context).length > MAX_CONTEXT_SIZE && context.messages.length > 1) {
        context.messages.shift();
      }
    }

    // Store updated context
    if (redisClient && redisClient.isReady) {
      try {
        await redisClient.setEx(contextKey, CONTEXT_TTL, JSON.stringify(context));
      } catch (error) {
        logger.error('Failed to store context:', error);
      }
    }

    res.json({
      session_id,
      message_id: messageId,
      context_size: context.messages.length,
      context_length: JSON.stringify(context).length,
      timestamp
    });

  } catch (error) {
    logger.error('Context update error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get conversation context
app.get('/api/v1/context/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { limit = 10 } = req.query;

    logger.info(`Getting context for session ${session_id}`);

    let context = {};

    if (redisClient && redisClient.isReady) {
      try {
        const contextKey = `context:${session_id}`;
        const contextData = await redisClient.get(contextKey);
        
        if (contextData) {
          context = JSON.parse(contextData);
          
          // Apply limit if requested
          if (limit && context.messages) {
            context.messages = context.messages.slice(-parseInt(limit));
          }
        }
      } catch (error) {
        logger.error('Failed to get context:', error);
      }
    }

    res.json({
      session_id,
      context,
      found: Object.keys(context).length > 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Context retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear conversation context
app.delete('/api/v1/context/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    logger.info(`Clearing context for session ${session_id}`);

    if (redisClient && redisClient.isReady) {
      try {
        const contextKey = `context:${session_id}`;
        await redisClient.del(contextKey);
      } catch (error) {
        logger.error('Failed to clear context:', error);
      }
    }

    res.json({
      session_id,
      cleared: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Context clear error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get context statistics
app.get('/api/v1/context/stats', async (req, res) => {
  try {
    let stats = {
      active_sessions: 0,
      total_messages: 0,
      average_context_size: 0,
      timestamp: new Date().toISOString()
    };

    if (redisClient && redisClient.isReady) {
      try {
        const keys = await redisClient.keys('context:*');
        stats.active_sessions = keys.length;
        
        let totalMessages = 0;
        let totalSize = 0;
        
        for (const key of keys) {
          const contextData = await redisClient.get(key);
          if (contextData) {
            const context = JSON.parse(contextData);
            if (context.messages) {
              totalMessages += context.messages.length;
            }
            totalSize += contextData.length;
          }
        }
        
        stats.total_messages = totalMessages;
        stats.average_context_size = keys.length > 0 ? Math.round(totalSize / keys.length) : 0;
      } catch (error) {
        logger.error('Failed to get context stats:', error);
      }
    }

    res.json(stats);
  } catch (error) {
    logger.error('Context stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search context by message content
app.post('/api/v1/context/search', async (req, res) => {
  try {
    const { query, session_id, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    logger.info(`Searching context for: "${query}"`);

    const results = [];

    if (redisClient && redisClient.isReady) {
      try {
        const searchKeys = session_id ? [`context:${session_id}`] : await redisClient.keys('context:*');
        
        for (const key of searchKeys) {
          const contextData = await redisClient.get(key);
          if (contextData) {
            const context = JSON.parse(contextData);
            if (context.messages) {
              for (const message of context.messages) {
                if (message.message.toLowerCase().includes(query.toLowerCase()) ||
                    (message.response && message.response.toLowerCase().includes(query.toLowerCase()))) {
                  results.push({
                    session_id: key.replace('context:', ''),
                    message_id: message.id,
                    timestamp: message.timestamp,
                    message: message.message,
                    response: message.response,
                    metadata: message.metadata
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error('Failed to search context:', error);
      }
    }

    // Sort by timestamp and apply limit
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedResults = results.slice(0, parseInt(limit));

    res.json({
      query,
      results: limitedResults,
      total: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Context search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (redisClient && redisClient.isReady) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (redisClient && redisClient.isReady) {
    await redisClient.quit();
  }
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    await initRedis();
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Knowledge Context Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
      logger.info(`Context TTL: ${CONTEXT_TTL} seconds`);
      logger.info(`Max context size: ${MAX_CONTEXT_SIZE} bytes`);
      logger.info(`Weaviate URL: ${WEAVIATE_URL}`);
      logger.info(`Supabase URL: ${SUPABASE_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
