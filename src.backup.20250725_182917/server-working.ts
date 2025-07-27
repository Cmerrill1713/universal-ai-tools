/**
 * Universal AI Tools Service - Working Server
 * Progressive loading with error handling
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

// Configuration and utilities
import { logger } from "./utils/logger";
import { config } from "./config/environment-clean";

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Application setup
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configuration
const PORT = process.env.PORT || 9999;
const NODE_ENV = process.env.NODE_ENV || "development";

// Services tracking
const services: Record<string, boolean> = {
  core: true,
  websocket: true,
  auth: false,
  memory: false,
  orchestration: false,
  knowledge: false,
  redis: false,
  agents: false
};

// Basic middleware setup
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services,
    version: process.env.npm_package_version || "1.0.0"
  };
  res.json(health);
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Universal AI Tools",
    status: "running",
    version: "1.0.0",
    services: Object.entries(services)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name),
    endpoints: {
      health: "/health"
    }
  });
});

// Start server
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      logger.info(`🚀 Universal AI Tools Service running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📡 WebSocket server ready`);
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
