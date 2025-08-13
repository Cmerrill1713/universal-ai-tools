import net from 'net';
import { log, LogContext } from '../utils/logger';
const DEFAULT_PORTS = {
    mainServer: parseInt(process.env.PORT || '9999', 10),
    lfm2Server: parseInt(process.env.LFM2_PORT || '3031', 10),
    lmStudio: parseInt(process.env.LM_STUDIO_PORT || '1234', 10),
    ollama: parseInt(process.env.OLLAMA_PORT || '11434', 10),
    dspyOrchestrator: parseInt(process.env.DSPY_PORT || '8001', 10),
    mlxBridge: parseInt(process.env.MLX_BRIDGE_PORT || '8002', 10),
    mlxProvider: parseInt(process.env.MLX_PROVIDER_PORT || '8004', 10),
    pyVisionBridge: parseInt(process.env.PYVISION_PORT || '8003', 10),
    redis: parseInt(process.env.REDIS_PORT || '6379', 10),
    prometheus: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    grafana: parseInt(process.env.GRAFANA_PORT || '3001', 10),
    frontend: parseInt(process.env.FRONTEND_PORT || '3000', 10),
    storybook: parseInt(process.env.STORYBOOK_PORT || '6006', 10),
    postgres: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    supabaseStudio: parseInt(process.env.SUPABASE_STUDIO_PORT || '54323', 10),
};
async function isPortAvailable(port) {
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
async function findAvailablePort(startPort, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available port found starting from ${startPort}`);
}
export async function autoConfigurePorts() {
    const ports = { ...DEFAULT_PORTS };
    const usedPorts = new Set();
    for (const [service, port] of Object.entries(ports)) {
        if (usedPorts.has(port)) {
            const newPort = await findAvailablePort(port + 1);
            log.warn(`Port conflict detected for ${service} on ${port}, using ${newPort}`, LogContext.CONFIG);
            ports[service] = newPort;
            usedPorts.add(newPort);
        }
        else if (!(await isPortAvailable(port))) {
            const newPort = await findAvailablePort(port + 1);
            log.warn(`Port ${port} already in use for ${service}, using ${newPort}`, LogContext.CONFIG);
            ports[service] = newPort;
            usedPorts.add(newPort);
        }
        else {
            usedPorts.add(port);
        }
    }
    return ports;
}
export function getServiceUrls(ports) {
    const host = process.env.HOST || 'localhost';
    return {
        mainServer: `http://${host}:${ports.mainServer}`,
        lfm2Server: `http://${host}:${ports.lfm2Server}`,
        lmStudio: `http://${host}:${ports.lmStudio}`,
        ollama: `http://${host}:${ports.ollama}`,
        dspyOrchestrator: `http://${host}:${ports.dspyOrchestrator}`,
        mlxBridge: `http://${host}:${ports.mlxBridge}`,
        mlxProvider: `http://${host}:${ports.mlxProvider}`,
        pyVisionBridge: `http://${host}:${ports.pyVisionBridge}`,
        redis: `redis://${host}:${ports.redis}`,
        prometheus: `http://${host}:${ports.prometheus}`,
        grafana: `http://${host}:${ports.grafana}`,
        frontend: `http://${host}:${ports.frontend}`,
        storybook: `http://${host}:${ports.storybook}`,
        postgres: `postgresql://${host}:${ports.postgres}`,
        supabaseStudio: `http://${host}:${ports.supabaseStudio}`,
    };
}
export function logPortConfiguration(ports) {
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
let cachedPorts = null;
export async function getPorts() {
    if (!cachedPorts) {
        cachedPorts = await autoConfigurePorts();
        logPortConfiguration(cachedPorts);
    }
    return cachedPorts;
}
export const ports = DEFAULT_PORTS;
//# sourceMappingURL=ports.js.map