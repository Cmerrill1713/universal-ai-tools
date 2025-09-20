const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');
const axios = require('axios');
const cron = require('node-cron');
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
    new winston.transports.File({ filename: '/var/log/knowledge-sync/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/knowledge-sync/combined.log' })
  ]
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Service URLs
const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SYNC_INTERVAL = process.env.SYNC_INTERVAL || '300s';

// Parse sync interval
const parseInterval = (interval) => {
  const match = interval.match(/(\d+)([smhd])/);
  if (!match) return 300000; // Default 5 minutes
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 300000;
  }
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sync state
let syncState = {
  isRunning: false,
  lastSync: null,
  nextSync: null,
  totalSynced: 0,
  errors: []
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      sync: {
        isRunning: syncState.isRunning,
        lastSync: syncState.lastSync,
        nextSync: syncState.nextSync,
        totalSynced: syncState.totalSynced
      },
      services: {
        weaviate: false,
        supabase: false
      }
    };

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

    // Service is healthy if Weaviate is working (Supabase is optional)
    const coreServicesHealthy = health.services.weaviate;
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

// Get sync status
app.get('/api/v1/sync/status', (req, res) => {
  res.json({
    ...syncState,
    timestamp: new Date().toISOString()
  });
});

// Trigger manual sync
app.post('/api/v1/sync', async (req, res) => {
  if (syncState.isRunning) {
    return res.status(409).json({
      error: 'Sync already running',
      message: 'A sync operation is currently in progress',
      timestamp: new Date().toISOString()
    });
  }

  try {
    logger.info('Manual sync triggered');
    await performSync();
    
    res.json({
      message: 'Sync completed successfully',
      synced: syncState.totalSynced,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Sync function
const performSync = async () => {
  syncState.isRunning = true;
  syncState.errors = [];
  
  try {
    logger.info('Starting knowledge sync...');

    // Get knowledge from Supabase
    const supabaseResponse = await axios.get(`${SUPABASE_URL}/rest/v1/knowledge`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY || 'your-anon-key',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || 'your-service-key'}`
      },
      timeout: 30000
    });

    const knowledgeItems = supabaseResponse.data || [];
    logger.info(`Found ${knowledgeItems.length} knowledge items in Supabase`);

    // Get existing knowledge from Weaviate
    const weaviateResponse = await axios.post(`${WEAVIATE_URL}/v1/graphql`, {
      query: `
        {
          Get {
            Knowledge {
              _additional {
                id
              }
              supabase_id
              title
              content
              source
              metadata
              updated_at
            }
          }
        }
      `
    });

    const existingItems = weaviateResponse.data.data?.Get?.Knowledge || [];
    const existingIds = new Set(existingItems.map(item => item.supabase_id));

    let synced = 0;
    let created = 0;
    let updated = 0;

    for (const item of knowledgeItems) {
      try {
        const weaviateData = {
          supabase_id: item.id,
          title: item.title,
          content: item.content,
          source: item.source || 'supabase',
          metadata: JSON.stringify(item.metadata || {}),
          created_at: item.created_at,
          updated_at: item.updated_at
        };

        if (existingIds.has(item.id.toString())) {
          // Update existing item
          const existingItem = existingItems.find(existing => existing.supabase_id === item.id.toString());
          if (existingItem && existingItem.updated_at !== item.updated_at) {
            await axios.patch(`${WEAVIATE_URL}/v1/objects/${existingItem._additional.id}`, {
              properties: weaviateData
            });
            updated++;
            logger.debug(`Updated knowledge item: ${item.title}`);
          }
        } else {
          // Create new item
          await axios.post(`${WEAVIATE_URL}/v1/objects`, {
            class: 'Knowledge',
            properties: weaviateData
          });
          created++;
          logger.debug(`Created knowledge item: ${item.title}`);
        }
        
        synced++;
      } catch (error) {
        logger.error(`Failed to sync item ${item.id}:`, error);
        syncState.errors.push({
          item_id: item.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    syncState.totalSynced = synced;
    syncState.lastSync = new Date().toISOString();
    syncState.nextSync = new Date(Date.now() + parseInterval(SYNC_INTERVAL)).toISOString();

    logger.info(`Sync completed: ${created} created, ${updated} updated, ${synced} total synced`);
    
    if (syncState.errors.length > 0) {
      logger.warn(`Sync completed with ${syncState.errors.length} errors`);
    }

  } catch (error) {
    logger.error('Sync failed:', error);
    syncState.errors.push({
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  } finally {
    syncState.isRunning = false;
  }
};

// Schedule automatic sync
const scheduleSync = () => {
  const intervalMs = parseInterval(SYNC_INTERVAL);
  syncState.nextSync = new Date(Date.now() + intervalMs).toISOString();
  
  logger.info(`Scheduling automatic sync every ${SYNC_INTERVAL}`);
  
  setInterval(async () => {
    if (!syncState.isRunning) {
      try {
        await performSync();
      } catch (error) {
        logger.error('Scheduled sync failed:', error);
      }
    }
  }, intervalMs);
};

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
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Knowledge Sync Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Sync interval: ${SYNC_INTERVAL}`);
      logger.info(`Weaviate URL: ${WEAVIATE_URL}`);
      logger.info(`Supabase URL: ${SUPABASE_URL}`);
      
      // Start scheduled sync
      scheduleSync();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
