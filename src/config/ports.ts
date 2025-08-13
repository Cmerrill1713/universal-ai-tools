/**
 * Centralized Port Configuration
 * Manages all service ports to avoid conflicts
 */

import net from 'net';

import { log,LogContext } from '../utils/logger';

export interface PortConfig {
  // Main services
  mainServer: number;

  // ML/AI services
  lfm2Server: number;
  lmStudio: number;
  ollama: number;

  // Python bridges
  dspyOrchestrator: number;
  mlxBridge: number;
  mlxProvider: number;
  pyVisionBridge: number;

  // Infrastructure
  redis: number;
  prometheus: number;
  grafana: number;

  // Development tools
  frontend: number;
  storybook: number;

  // Database
  postgres: number;
  supabaseStudio: number;
}

// Default port configuration
const DEFAULT_PORTS: PortConfig = {
  // Main services
  mainServer: parseInt(process.env.PORT || '9999', 10),

  // ML/AI services
  lfm2Server: parseInt(process.env.LFM2_PORT || '3031', 10),
  lmStudio: parseInt(process.env.LM_STUDIO_PORT || '1234', 10),
  ollama: parseInt(process.env.OLLAMA_PORT || '11434', 10),

  // Python bridges
  dspyOrchestrator: parseInt(process.env.DSPY_PORT || '8001', 10),
  mlxBridge: parseInt(process.env.MLX_BRIDGE_PORT || '8002', 10),
  mlxProvider: parseInt(process.env.MLX_PROVIDER_PORT || '8004', 10),
  pyVisionBridge: parseInt(process.env.PYVISION_PORT || '8003', 10),

  // Infrastructure
  redis: parseInt(process.env.REDIS_PORT || '6379', 10),
  prometheus: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
  grafana: parseInt(process.env.GRAFANA_PORT || '3001', 10),

  // Development tools
  frontend: parseInt(process.env.FRONTEND_PORT || '3000', 10),
  storybook: parseInt(process.env.STORYBOOK_PORT || '6006', 10),

  // Database
  postgres: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  supabaseStudio: parseInt(process.env.SUPABASE_STUDIO_PORT || '54323', 10),
};

/**
 * Check if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, () => {
      server.close();
      resolve(true);
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Auto-configure ports with conflict detection
 */
export async function autoConfigurePorts(): Promise<PortConfig> {
  const ports = { ...DEFAULT_PORTS };
  const usedPorts = new Set<number>();

  // Check and auto-assign ports if conflicts exist
  for (const [service, port] of Object.entries(ports)) {
    if (usedPorts.has(port)) {
      // Port conflict detected
      const newPort = await findAvailablePort(port + 1);
      log.warn(
        `Port conflict detected for ${service} on ${port}, using ${newPort}`,
        LogContext.CONFIG
      );
      Object.assign(ports, { [service]: newPort });
      usedPorts.add(newPort);
    } else if (!(await isPortAvailable(port))) {
      // Port already in use by another process
      const newPort = await findAvailablePort(port + 1);
      log.warn(`Port ${port} already in use for ${service}, using ${newPort}`, LogContext.CONFIG);
      Object.assign(ports, { [service]: newPort });
      usedPorts.add(newPort);
    } else {
      usedPorts.add(port);
    }
  }

  return ports;
}

/**
 * Get service URLs based on port configuration
 */
export function getServiceUrls(ports: PortConfig) {
  const host = process.env.HOST || 'localhost';

  return {
    // Main services
    mainServer: `http://${host}:${ports.mainServer}`,

    // ML/AI services
    lfm2Server: `http://${host}:${ports.lfm2Server}`,
    lmStudio: `http://${host}:${ports.lmStudio}`,
    ollama: `http://${host}:${ports.ollama}`,

    // Python bridges
    dspyOrchestrator: `http://${host}:${ports.dspyOrchestrator}`,
    mlxBridge: `http://${host}:${ports.mlxBridge}`,
    mlxProvider: `http://${host}:${ports.mlxProvider}`,
    pyVisionBridge: `http://${host}:${ports.pyVisionBridge}`,

    // Infrastructure
    redis: `redis://${host}:${ports.redis}`,
    prometheus: `http://${host}:${ports.prometheus}`,
    grafana: `http://${host}:${ports.grafana}`,

    // Development tools
    frontend: `http://${host}:${ports.frontend}`,
    storybook: `http://${host}:${ports.storybook}`,

    // Database
    postgres: `postgresql://${host}:${ports.postgres}`,
    supabaseStudio: `http://${host}:${ports.supabaseStudio}`,
  };
}

/**
 * Log port configuration
 */
export function logPortConfiguration(ports: PortConfig): void {
  log.info('🌐 Port Configuration:', LogContext.CONFIG, {
    mainServer: ports.mainServer,
    mlServices: {
      lfm2: ports.lfm2Server,
      lmStudio: ports.lmStudio,
      ollama: ports.ollama,
    },
    pythonBridges: {
      dspy: ports.dspyOrchestrator,
      mlx: ports.mlxBridge,
      mlxProvider: ports.mlxProvider,
      pyVision: ports.pyVisionBridge,
    },
    infrastructure: {
      redis: ports.redis,
      prometheus: ports.prometheus,
      grafana: ports.grafana,
    },
    development: {
      frontend: ports.frontend,
      storybook: ports.storybook,
    },
    database: {
      postgres: ports.postgres,
      supabaseStudio: ports.supabaseStudio,
    },
  });
}

// Export singleton configuration
let cachedPorts: PortConfig | null = null;

export async function getPorts(): Promise<PortConfig> {
  if (!cachedPorts) {
    cachedPorts = await autoConfigurePorts();
    logPortConfiguration(cachedPorts);
  }
  return cachedPorts;
}

// Export default configuration for immediate use
export const ports = DEFAULT_PORTS;
