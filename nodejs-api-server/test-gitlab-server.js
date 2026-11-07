const express = require('express');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Import only the GitLab router
const gitlabRouter = require('./dist/routers/gitlab');

// Use GitLab router
app.use('/api/gitlab', gitlabRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gitlab: 'available'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Universal AI Tools - GitLab Integration Test Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      gitlab: '/api/gitlab',
      gitlabStatus: '/api/gitlab/status',
      gitlabProject: '/api/gitlab/project',
      gitlabIssues: '/api/gitlab/issues',
      gitlabAnalysis: '/api/gitlab/analysis'
    }
  });
});

const PORT = process.env.PORT || 9999;

app.listen(PORT, () => {
  console.log(`🚀 GitLab Integration Test Server running on port ${PORT}`);
  console.log(`🔗 GitLab API: http://localhost:${PORT}/api/gitlab`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;