/**
 * Simple Clean Server;
 * Basic Express server for testing the build system;
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Basic middleware;
app?.use(helmet());
app?.use(cors());
app?.use(express?.json());

// Health endpoint;
app?.get('/health', (req, res) => {'
  res?.json({)
    status: 'healthy','
    version: '1?.0?.0','
    timestamp: new Date().toISOString()
  });
});

// Root endpoint;
app?.get('/', (req, res) => {'
  res?.json({)
    name: 'Universal AI Tools - Simple Server','
    version: '1?.0?.0','
    status: 'running''
  });
});

// Start server;
const port = process?.env?.PORT || 9999;
server?.listen(port, () => {
  console?.log(`🚀 Simple server running on port ${port)}`);
});

export { app, server };