const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const redis = require('redis');
const axios = require('axios');
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
    new winston.transports.File({ filename: '/var/log/knowledge-gateway/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/knowledge-gateway/combined.log' })
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

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ENABLE_CORS === 'true' ? true : false,
  credentials: true
}));
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Service URLs
const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';

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

// Knowledge search endpoint
app.post('/api/v1/search', async (req, res) => {
  try {
    const { query, limit = 10, filters = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    logger.info(`Knowledge search request: "${query}"`);

    // Search in Weaviate
    const weaviateQuery = {
      query: `
        {
          Get {
            Knowledge(query: "${query}", limit: ${limit}) {
              _additional {
                id
                score
              }
              title
              content
              source
              metadata
            }
          }
        }
      `
    };

    const weaviateResponse = await axios.post(`${WEAVIATE_URL}/v1/graphql`, weaviateQuery, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const results = weaviateResponse.data.data?.Get?.Knowledge || [];

    // Cache results in Redis
    if (redisClient && redisClient.isReady) {
      const cacheKey = `search:${Buffer.from(query).toString('base64')}`;
      await redisClient.setEx(cacheKey, 300, JSON.stringify(results)); // 5 minute cache
    }

    res.json({
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Knowledge search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Knowledge chat endpoint
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { message, user_id, session_id, use_knowledge = true } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message parameter is required' });
    }

    logger.info(`Knowledge chat request from user ${user_id}: "${message}"`);

    let context = [];
    let sources = [];

    if (use_knowledge) {
      // Search for relevant knowledge
      const searchResponse = await axios.post('http://localhost:8088/api/v1/search', {
        query: message,
        limit: 5
      });
      
      context = searchResponse.data.results || [];
      sources = context.map(item => ({
        id: item._additional?.id,
        title: item.title,
        content: item.content.substring(0, 200) + '...',
        source: item.source,
        relevance: item._additional?.score
      }));
    }

    // Forward to chat service with context
    const chatRequest = {
      message,
      user_id,
      session_id,
      context: context.map(item => item.content).join('\n\n'),
      use_knowledge: use_knowledge
    };

    const chatResponse = await axios.post('http://localhost:8010/chat', chatRequest, {
      timeout: 30000
    });

    res.json({
      answer: chatResponse.data.response,
      sources,
      context: context.map(item => ({
        title: item.title,
        source: item.source
      })),
      confidence: sources.length > 0 ? 0.8 : 0.6,
      metadata: {
        model: chatResponse.data.metadata?.model || 'unknown',
        processing_time: chatResponse.data.metadata?.processing_time || 0,
        knowledge_used: use_knowledge,
        sources_count: sources.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Knowledge chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add knowledge endpoint
app.post('/api/v1/knowledge', async (req, res) => {
  try {
    const { title, content, source, metadata = {} } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    logger.info(`Adding knowledge: "${title}"`);

    // Add to Weaviate
    const weaviateData = {
      title,
      content,
      source: source || 'manual',
      metadata: JSON.stringify(metadata),
      timestamp: new Date().toISOString()
    };

    const weaviateResponse = await axios.post(`${WEAVIATE_URL}/v1/objects`, {
      class: 'Knowledge',
      properties: weaviateData
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    // Invalidate search cache
    if (redisClient && redisClient.isReady) {
      const keys = await redisClient.keys('search:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    res.status(201).json({
      id: weaviateResponse.data.id,
      title,
      source,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Add knowledge error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get knowledge statistics
app.get('/api/v1/stats', async (req, res) => {
  try {
    const stats = {
      total_knowledge: 0,
      recent_additions: 0,
      cache_hits: 0,
      timestamp: new Date().toISOString()
    };

    // Get Weaviate stats
    try {
      const weaviateResponse = await axios.post(`${WEAVIATE_URL}/v1/graphql`, {
        query: `
          {
            Aggregate {
              Knowledge {
                meta {
                  count
                }
              }
            }
          }
        `
      });
      stats.total_knowledge = weaviateResponse.data.data?.Aggregate?.Knowledge?.[0]?.meta?.count || 0;
    } catch (error) {
      logger.error('Failed to get Weaviate stats:', error);
    }

    // Get Redis stats
    if (redisClient && redisClient.isReady) {
      try {
        const info = await redisClient.info('stats');
        const cacheHitsMatch = info.match(/keyspace_hits:(\d+)/);
        stats.cache_hits = cacheHitsMatch ? parseInt(cacheHitsMatch[1]) : 0;
      } catch (error) {
        logger.error('Failed to get Redis stats:', error);
      }
    }

    res.json(stats);
  } catch (error) {
    logger.error('Stats error:', error);
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
      logger.info(`Knowledge Gateway Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
      logger.info(`Weaviate URL: ${WEAVIATE_URL}`);
      logger.info(`Supabase URL: ${SUPABASE_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
