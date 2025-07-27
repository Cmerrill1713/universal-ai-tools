/**
 * Minimal test server to verify core functionality*/

import express from 'express';
import cors from 'cors';
import { create.Server } from 'http';
import { logger } from './utils/logger'// Application setup;
const app = express();
const server = create.Server(app)// Configuration;
const PO.R.T = process.envPO.R.T || 9999;
const NODE_E.N.V = process.envNODE_E.N.V || 'development'// Basic middleware setup;
app.use(
  cors({
    origin: process.envFRONTEND_U.R.L || 'http://localhost:3000',
    credentials: true})),
app.use(expressjson({ limit: '50mb' })),
app.use(expressurlencoded({ extended: true, limit: '50mb' }))// Health check endpoint,
appget('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date()toIS.O.String(),
    services: {
      core: true,
    version: process.envnpm_package_version || '1.0.0',
}  res.json(health)})// Root endpoint;
appget('/', (req, res) => {
  res.json({
    service: 'Universal A.I.Tools - Minimal Test',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
    }})})// Start server;
const start.Server = async () => {
  try {
    server.listen(PO.R.T, () => {
      loggerinfo(`🚀 Minimal Test Server running on port ${PO.R.T}`);
      loggerinfo(`📊 Environment: ${NODE_E.N.V}`),
      loggerinfo(`🔗 Health check: http://localhost:${PO.R.T}/health`)})} catch (error) {
    loggererror('❌ Failed to start server:', error);
    process.exit(1)}}// Start the server;
start.Server();
export default app;