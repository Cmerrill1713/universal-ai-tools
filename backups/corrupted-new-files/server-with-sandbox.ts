/**
 * Server with Sandboxed Execution;
 * 
 * Enhanced server that includes OrbStack sandboxed execution capability.
 * This addresses a critical gap identified in frontier AI systems research.
 */

import express from 'express'import cors from 'cors'import helmet from 'helmet'import { createServer  } from 'http'import { Server as SocketIOServer  } from 'socket?.ioimport { createClient  } from `@supabase/supabase-js`';
// Utilities;
import { LogContext, log  } from `'@/utils/logger`import { config  } from @/config/environment`import { globalErrorHandler  } from @/middleware/global-error-handler;';
// Services;
import { orbStackExecutionService  } from ``@/services/orbstack-execution-service;
// Routers;
import { sandboxedExecutionRouter  } from `@/routers/sandboxed-execution;
const app = express();
const server = createServer(app)`'';
const io = new SocketIOServer(server', { cors: { origi, n: '*','    methods: ['GET`, POST]});';

// Middleware;
app?.use(helmet());
app?.use(cors())
app?.use(express?.json({ limit: `'50mb')) }));'
// Request logging;
app?.use((req', res, next) => {'  log?.info(${req?.method)} ${req?.path}, LogContext?.API);`  next();'
})

// Initialize Supabase client;
const supabase = createClient();
  process?.env?.SUPABASE_URL || `http: //127?.0?.0., 1: 54321,   process?.env?.SUPABASE_SERVICE_KEY || process?.env?.SUPABASE_ANON_KEY || `)`
// Health check;
app?.get(/health, async (req, res) => {

  const poolStatus = orbStackExecutionService?.getPoolStatus();
  
  res?.json({ status: `'healthy','      version: '2?.0?.0-sandbox','     services: { sandboxedExecutio, n: `available,        containerPools: poolStatus);')
  }`,
      timestamp: new Date().toISOString()
  });
})

// Root endpoint;
app?.get(/, (req, res) => {

  res?.json({ name: `'Universal AI Tools - Sandboxed Execution Server','      version: '2?.0?.0-sandbox','      status: 'running'')
''
    endpoint,s: ['/health', '      '/api/v1/sandbox/execute', '      '/api/v1/sandbox/status', '      '/api/v1/sandbox/test],'    features: ['OrbStack containerized execution', '      '60% faster than Docker Desktop', '      'Multi-language support`,       `Resource limits and security]  '
)
})

// Mount sandboxed execution router;
app?.use(/api/v1/sandbox, sandboxedExecutionRouter)`
// 404 handler;
app?.use((req, res) => {

  res?.status(404).json({ success: false, error: `'`Endpoint not found,      path: req?.path);')
  })
});

// Global error handler;
app?.use(globalErrorHandler)

// Graceful shutdown;
process?.on(SIGTERM, async () => {
 log?.info(SIGTERM, received, shutting down gracefully``, LogContext?.SYSTEM)`
  
  // Cleanup OrbStack containers;
  await orbStackExecutionService?.cleanup()
  
  server?.close(() => {
    log?.info(Server, closed, LogContext?.SYSTEM) `    process?.exit(0)
);
});

// Start server;
const port = config?.port || 9999;
server?.listen(port`, () => {

  log?.info(Universal AI Tools Sandboxed Execution Server started`, LogContext?.SERVER, {`)
    port;
      environment: config?.environment, sandboxEnabled: true;
      timestam,p: new Date().toISOString()
  })

  log?.info(Test sandboxed execution with: `, LogContext?.SERVER, {)
    command: `curl -X POST, http: //localhos, t: ${port}/api/v1/sandbox/execute -H Content-Type: application/json -d {code: `'log?.log(\'Hello from 'sandbox!\)', language: `javascript` }`  });'
});

export { app, server };`;