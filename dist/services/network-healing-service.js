import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
class NetworkHealingService {
    isRunning = false;
    networkIssues = new Map();
    healingInterval = 60000;
    monitoringInterval = 30000;
    completedHealings = [];
    coreServices = [
        { name: 'backend-server', port: 8080, endpoint: 'http://localhost:8080/api/health' },
        { name: 'frontend-dev', port: 3000, endpoint: 'http://localhost:3000' },
        { name: 'vision-service', port: 9999, endpoint: 'http://localhost:9999/api/v1/vision/health' },
        { name: 'ollama', port: 11434, endpoint: 'http://localhost:11434/api/version' },
        { name: 'lm-studio', port: 1234, endpoint: 'http://localhost:1234/v1/models' },
        { name: 'redis', port: 6379, endpoint: 'redis://localhost:6379' },
        { name: 'supabase', port: 54321, endpoint: 'http://localhost:54321/rest/v1/' },
    ];
    constructor() {
        console.log('🌐 Network Healing Service initialized');
    }
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Network Healing Service is already running');
            return;
        }
        this.isRunning = true;
        console.log('🚀 Starting Network Healing Service...');
        setInterval(async () => {
            if (this.isRunning) {
                await this.monitorNetworkHealth();
            }
        }, this.monitoringInterval);
        setInterval(async () => {
            if (this.isRunning) {
                await this.runHealingCycle();
            }
        }, this.healingInterval);
        await this.monitorNetworkHealth();
        console.log('✅ Network Healing Service active - Monitoring network connectivity');
    }
    async monitorNetworkHealth() {
        console.log('🔍 Monitoring network health...');
        for (const service of this.coreServices) {
            await this.checkServiceHealth(service);
        }
        await this.checkProcessHealth();
        await this.analyzeLogs();
    }
    async checkServiceHealth(service) {
        try {
            const portCheck = await this.checkPort(service.port);
            if (!portCheck) {
                this.recordNetworkIssue({
                    id: `${service.name}-port-${service.port}`,
                    type: 'connection_refused',
                    service: service.name,
                    endpoint: service.endpoint,
                    port: service.port,
                    severity: service.name === 'backend-server' ? 'high' : 'medium',
                    description: `${service.name} not responding on port ${service.port}`,
                    lastSeen: new Date(),
                    count: 1,
                });
                return;
            }
            if (service.endpoint.startsWith('http')) {
                try {
                    const response = await fetch(service.endpoint, {
                        method: 'GET',
                        signal: AbortSignal.timeout(5000),
                    });
                    if (!response.ok) {
                        this.recordNetworkIssue({
                            id: `${service.name}-http-${response.status}`,
                            type: 'connection_refused',
                            service: service.name,
                            endpoint: service.endpoint,
                            port: service.port,
                            severity: 'medium',
                            description: `${service.name} HTTP health check failed with status ${response.status}`,
                            lastSeen: new Date(),
                            count: 1,
                        });
                    }
                }
                catch (fetchError) {
                    this.recordNetworkIssue({
                        id: `${service.name}-fetch-error`,
                        type: 'connection_refused',
                        service: service.name,
                        endpoint: service.endpoint,
                        port: service.port,
                        severity: 'high',
                        description: `${service.name} fetch failed: ${fetchError}`,
                        lastSeen: new Date(),
                        count: 1,
                    });
                }
            }
        }
        catch (error) {
            console.log(`Network check failed for ${service.name}: ${error}`);
        }
    }
    validatePort(port) {
        return Number.isInteger(port) && port > 0 && port <= 65535;
    }
    async executeSecureCommand(command, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            console.log(`🔒 Executing secure command: ${command} ${args.join(' ')}`);
            const child = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: options.timeout || 30000,
                cwd: options.cwd || process.cwd(),
                ...options,
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('close', (code) => {
                console.log(`🔒 Command completed with code: ${code}`);
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            child.on('error', (error) => {
                console.log(`🔒 Command execution error: ${error}`);
                reject(error);
            });
        });
    }
    async checkPort(port) {
        try {
            if (!this.validatePort(port)) {
                console.log(`🔒 Invalid port number: ${port}`);
                return false;
            }
            console.log(`🔒 Checking port ${port} using secure command execution`);
            if (process.platform === 'win32') {
                try {
                    const result = await this.executeSecureCommand('netstat', ['-an'], { timeout: 5000 });
                    return result.includes(`:${port}`) && result.includes('LISTENING');
                }
                catch (error) {
                    console.log(`🔒 Windows port check failed: ${error}`);
                    return false;
                }
            }
            else {
                try {
                    const result = await this.executeSecureCommand('lsof', ['-i', `:${port}`], {
                        timeout: 5000,
                    });
                    return result.trim().length > 0;
                }
                catch (lsofError) {
                    try {
                        const result = await this.executeSecureCommand('netstat', ['-ln'], { timeout: 5000 });
                        return result.includes(`:${port}`);
                    }
                    catch (netstatError) {
                        console.log(`🔒 Unix port check failed: lsof: ${lsofError}, netstat: ${netstatError}`);
                        return false;
                    }
                }
            }
        }
        catch (error) {
            console.log(`🔒 Port check failed for port ${port}: ${error}`);
            return false;
        }
    }
    async checkProcessHealth() {
        try {
            console.log('🔒 Checking process health using secure command execution');
            try {
                const psResult = await this.executeSecureCommand('ps', ['aux'], { timeout: 5000 });
                const grepResult = psResult
                    .split('\n')
                    .filter((line) => (line.includes('node') || line.includes('npm') || line.includes('tsx')) &&
                    !line.includes('grep'));
                for (const line of grepResult) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 3 && parts[2]) {
                        const cpuUsage = parseFloat(parts[2]);
                        if (!isNaN(cpuUsage) && cpuUsage > 80) {
                            console.log(`🔒 High CPU usage detected: ${cpuUsage}% in process: ${parts.slice(10).join(' ')}`);
                            this.recordNetworkIssue({
                                id: `high-cpu-${Date.now()}`,
                                type: 'timeout',
                                service: 'system',
                                endpoint: 'localhost',
                                port: 0,
                                severity: 'medium',
                                description: `High CPU usage detected: ${cpuUsage}%`,
                                lastSeen: new Date(),
                                count: 1,
                            });
                        }
                    }
                }
            }
            catch (error) {
                console.log('🔒 Process health check failed (ps command):', error);
            }
        }
        catch (error) {
            console.log('🔒 Process health check failed:', error);
        }
    }
    async analyzeLogs() {
        try {
            const logFiles = [
                'logs/adaptive-fixer.log',
                'logs/server.log',
                'logs/error.log',
                'npm-debug.log',
            ];
            for (const logFile of logFiles) {
                if (fs.existsSync(logFile)) {
                    const content = fs.readFileSync(logFile, 'utf8');
                    const connectionRefusedMatches = content.match(/ECONNREFUSED|connection refused|connect ECONNREFUSED/gi);
                    if (connectionRefusedMatches && connectionRefusedMatches.length > 0) {
                        this.recordNetworkIssue({
                            id: `log-connection-refused-${Date.now()}`,
                            type: 'connection_refused',
                            service: 'unknown',
                            endpoint: 'unknown',
                            port: 0,
                            severity: 'high',
                            description: `Found ${connectionRefusedMatches.length} connection refused errors in ${logFile}`,
                            lastSeen: new Date(),
                            count: connectionRefusedMatches.length,
                        });
                    }
                    const timeoutMatches = content.match(/timeout|ETIMEDOUT/gi);
                    if (timeoutMatches && timeoutMatches.length > 5) {
                        this.recordNetworkIssue({
                            id: `log-timeout-${Date.now()}`,
                            type: 'timeout',
                            service: 'unknown',
                            endpoint: 'unknown',
                            port: 0,
                            severity: 'medium',
                            description: `Found ${timeoutMatches.length} timeout errors in ${logFile}`,
                            lastSeen: new Date(),
                            count: timeoutMatches.length,
                        });
                    }
                }
            }
        }
        catch (error) {
            console.log('Log analysis failed:', error);
        }
    }
    recordNetworkIssue(issue) {
        const existing = this.networkIssues.get(issue.id);
        if (existing) {
            existing.count++;
            existing.lastSeen = new Date();
        }
        else {
            this.networkIssues.set(issue.id, issue);
            console.log(`🚨 Network issue detected: ${issue.description}`);
        }
    }
    async runHealingCycle() {
        const issues = Array.from(this.networkIssues.values()).sort((a, b) => {
            const severityOrder = { high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
        if (issues.length === 0) {
            console.log('💚 No network issues detected');
            return;
        }
        console.log(`🔧 Healing ${issues.length} network issues...`);
        for (const issue of issues.slice(0, 3)) {
            await this.healNetworkIssue(issue);
        }
    }
    async healNetworkIssue(issue) {
        console.log(`🩺 Healing network issue: ${issue.description}`);
        const strategies = this.getHealingStrategies(issue);
        for (const strategy of strategies) {
            try {
                console.log(`🔧 Trying healing strategy: ${strategy.name}`);
                const success = await strategy.execute();
                if (success) {
                    const result = {
                        issueId: issue.id,
                        success: true,
                        strategy: strategy.name,
                        changes: [`Applied ${strategy.name}`, strategy.description],
                        metrics: {
                            servicesRestarted: strategy.name.includes('restart') ? 1 : 0,
                            portsChecked: 1,
                            connectionsFixed: 1,
                        },
                    };
                    this.completedHealings.push(result);
                    this.networkIssues.delete(issue.id);
                    console.log(`✅ Successfully healed: ${issue.description} using ${strategy.name}`);
                    return;
                }
            }
            catch (error) {
                console.log(`❌ Healing strategy ${strategy.name} failed: ${error}`);
            }
        }
        console.log(`⚠️ All healing strategies failed for: ${issue.description}`);
    }
    getHealingStrategies(issue) {
        const strategies = [];
        switch (issue.type) {
            case 'connection_refused':
                strategies.push({
                    name: 'restart-service',
                    description: `Restart ${issue.service} service`,
                    execute: () => this.restartService(issue.service),
                    estimatedTime: 30000,
                }, {
                    name: 'check-and-start-service',
                    description: `Check if ${issue.service} is running and start if needed`,
                    execute: () => this.checkAndStartService(issue.service, issue.port),
                    estimatedTime: 15000,
                }, {
                    name: 'kill-port-process',
                    description: `Kill any process using port ${issue.port} and restart`,
                    execute: () => this.killPortProcess(issue.port),
                    estimatedTime: 10000,
                }, {
                    name: 'network-reset',
                    description: 'Reset network configuration',
                    execute: () => this.resetNetworkConfiguration(),
                    estimatedTime: 20000,
                });
                break;
            case 'timeout':
                strategies.push({
                    name: 'increase-timeout',
                    description: 'Increase service timeout settings',
                    execute: () => this.increaseTimeouts(),
                    estimatedTime: 5000,
                }, {
                    name: 'restart-high-cpu-processes',
                    description: 'Restart processes with high CPU usage',
                    execute: () => this.restartHighCpuProcesses(),
                    estimatedTime: 15000,
                });
                break;
            default:
                strategies.push({
                    name: 'generic-network-fix',
                    description: 'Apply generic network fixes',
                    execute: () => this.genericNetworkFix(),
                    estimatedTime: 10000,
                });
        }
        return strategies;
    }
    validateServiceName(serviceName) {
        const allowedServices = [
            'backend-server',
            'frontend-dev',
            'redis',
            'ollama',
            'supabase',
            'lm-studio',
            'vision-service',
        ];
        return allowedServices.includes(serviceName) && /^[a-zA-Z0-9\-_]+$/.test(serviceName);
    }
    async restartService(serviceName) {
        try {
            if (!this.validateServiceName(serviceName)) {
                console.log(`🔒 Invalid service name rejected: ${serviceName}`);
                return false;
            }
            console.log(`🔄 Restarting ${serviceName} service using secure commands...`);
            switch (serviceName) {
                case 'backend-server':
                    try {
                        console.log('🔒 Killing existing backend server processes');
                        await this.executeSecureCommand('pkill', ['-f', 'tsx.*server'], {
                            timeout: 5000,
                        }).catch(() => {
                            console.log('🔒 No tsx server processes found');
                        });
                        await this.executeSecureCommand('pkill', ['-f', 'node.*server'], {
                            timeout: 5000,
                        }).catch(() => {
                            console.log('🔒 No node server processes found');
                        });
                        await this.sleep(2000);
                        console.log('🔒 Starting backend server');
                        const serverProcess = spawn('npm', ['run', 'dev'], {
                            cwd: process.cwd(),
                            detached: true,
                            stdio: ['ignore', 'ignore', 'ignore'],
                        });
                        serverProcess.unref();
                    }
                    catch (error) {
                        console.log(`🔒 Backend server restart failed: ${error}`);
                        return false;
                    }
                    break;
                case 'frontend-dev':
                    try {
                        console.log('🔒 Killing existing frontend processes');
                        await this.executeSecureCommand('pkill', ['-f', 'vite'], { timeout: 5000 }).catch(() => {
                            console.log('🔒 No vite processes found');
                        });
                        await this.executeSecureCommand('pkill', ['-f', 'npm.*dev'], { timeout: 5000 }).catch(() => {
                            console.log('🔒 No npm dev processes found');
                        });
                        await this.sleep(2000);
                        console.log('🔒 Starting frontend dev server');
                        const frontendProcess = spawn('npm', ['run', 'dev'], {
                            cwd: path.join(process.cwd(), 'ui'),
                            detached: true,
                            stdio: ['ignore', 'ignore', 'ignore'],
                        });
                        frontendProcess.unref();
                    }
                    catch (error) {
                        console.log(`🔒 Frontend restart failed: ${error}`);
                        return false;
                    }
                    break;
                case 'redis':
                    try {
                        console.log('🔒 Restarting Redis service');
                        try {
                            await this.executeSecureCommand('brew', ['services', 'restart', 'redis'], {
                                timeout: 10000,
                            });
                        }
                        catch (brewError) {
                            try {
                                await this.executeSecureCommand('sudo', ['systemctl', 'restart', 'redis'], {
                                    timeout: 10000,
                                });
                            }
                            catch (systemctlError) {
                                console.log(`🔒 Redis restart failed: brew: ${brewError}, systemctl: ${systemctlError}`);
                                return false;
                            }
                        }
                    }
                    catch (error) {
                        console.log(`🔒 Redis restart failed: ${error}`);
                        return false;
                    }
                    break;
                case 'ollama':
                    try {
                        console.log('🔒 Restarting Ollama service');
                        await this.executeSecureCommand('pkill', ['ollama'], { timeout: 5000 }).catch(() => {
                            console.log('🔒 No ollama processes found');
                        });
                        await this.sleep(1000);
                        const ollamaProcess = spawn('ollama', ['serve'], {
                            detached: true,
                            stdio: ['ignore', 'ignore', 'ignore'],
                        });
                        ollamaProcess.unref();
                    }
                    catch (error) {
                        console.log(`🔒 Ollama restart failed: ${error}`);
                        return false;
                    }
                    break;
                default:
                    console.log(`🔒 No specific restart logic for ${serviceName}`);
                    return false;
            }
            await this.sleep(5000);
            const serviceConfig = this.coreServices.find((s) => s.name === serviceName);
            if (serviceConfig) {
                const isRunning = await this.checkPort(serviceConfig.port);
                console.log(`🔒 Service ${serviceName} restart ${isRunning ? 'successful' : 'failed'} - port ${serviceConfig.port} ${isRunning ? 'listening' : 'not listening'}`);
                return isRunning;
            }
            return true;
        }
        catch (error) {
            console.log(`🔒 Failed to restart ${serviceName}: ${error}`);
            return false;
        }
    }
    async checkAndStartService(serviceName, port) {
        try {
            const isRunning = await this.checkPort(port);
            if (isRunning) {
                console.log(`✅ ${serviceName} is already running on port ${port}`);
                return true;
            }
            console.log(`🚀 Starting ${serviceName} on port ${port}...`);
            return await this.restartService(serviceName);
        }
        catch (error) {
            console.log(`Failed to check/start ${serviceName}: ${error}`);
            return false;
        }
    }
    async killPortProcess(port) {
        try {
            if (!this.validatePort(port)) {
                console.log(`🔒 Invalid port number for kill operation: ${port}`);
                return false;
            }
            console.log(`🔒 Killing process on port ${port} using secure commands...`);
            if (process.platform === 'win32') {
                try {
                    const result = await this.executeSecureCommand('netstat', ['-ano'], { timeout: 5000 });
                    const lines = result.split('\n');
                    const portsToKill = [];
                    for (const line of lines) {
                        if (line.includes(`:${port}`)) {
                            const parts = line.trim().split(/\s+/);
                            if (parts.length >= 5) {
                                const pid = parts[4];
                                if (pid && /^\d+$/.test(pid) && this.validatePid(pid)) {
                                    portsToKill.push(pid);
                                }
                            }
                        }
                    }
                    for (const pid of portsToKill) {
                        try {
                            console.log(`🔒 Killing Windows process PID: ${pid}`);
                            await this.executeSecureCommand('taskkill', ['/PID', pid, '/F'], { timeout: 5000 });
                        }
                        catch (killError) {
                            console.log(`🔒 Failed to kill PID ${pid}: ${killError}`);
                        }
                    }
                }
                catch (error) {
                    console.log(`🔒 Windows port kill failed: ${error}`);
                    return false;
                }
            }
            else {
                try {
                    const result = await this.executeSecureCommand('lsof', ['-ti', `:${port}`], {
                        timeout: 5000,
                    });
                    const pids = result.split('\n').filter((pid) => pid.trim() && /^\d+$/.test(pid.trim()));
                    for (const pid of pids) {
                        if (this.validatePid(pid.trim())) {
                            try {
                                console.log(`🔒 Killing Unix process PID: ${pid.trim()}`);
                                await this.executeSecureCommand('kill', ['-9', pid.trim()], { timeout: 3000 });
                            }
                            catch (killError) {
                                console.log(`🔒 Failed to kill PID ${pid}: ${killError}`);
                            }
                        }
                    }
                }
                catch (lsofError) {
                    console.log(`🔒 Unix port kill failed (lsof): ${lsofError}`);
                    return false;
                }
            }
            await this.sleep(2000);
            const isPortFree = !(await this.checkPort(port));
            console.log(`🔒 Port ${port} is ${isPortFree ? 'now free' : 'still in use'}`);
            return isPortFree;
        }
        catch (error) {
            console.log(`🔒 Failed to kill process on port ${port}: ${error}`);
            return false;
        }
    }
    async resetNetworkConfiguration() {
        try {
            console.log('🔒 Resetting network configuration using secure commands...');
            if (process.platform === 'darwin') {
                try {
                    console.log('🔒 Flushing DNS cache on macOS');
                    await this.executeSecureCommand('sudo', ['dscacheutil', '-flushcache'], {
                        timeout: 5000,
                    });
                    console.log('🔒 Restarting mDNSResponder on macOS');
                    await this.executeSecureCommand('sudo', ['killall', '-HUP', 'mDNSResponder'], {
                        timeout: 5000,
                    });
                }
                catch (error) {
                    console.log(`🔒 macOS network reset failed: ${error}`);
                    return false;
                }
            }
            else if (process.platform === 'linux') {
                try {
                    console.log('🔒 Restarting network services on Linux');
                    try {
                        await this.executeSecureCommand('sudo', ['systemctl', 'restart', 'systemd-resolved'], {
                            timeout: 10000,
                        });
                    }
                    catch (systemdError) {
                        console.log('🔒 systemd-resolved restart failed, trying networking service');
                        try {
                            await this.executeSecureCommand('sudo', ['service', 'networking', 'restart'], {
                                timeout: 10000,
                            });
                        }
                        catch (networkingError) {
                            console.log(`🔒 Both network restart methods failed: systemd: ${systemdError}, service: ${networkingError}`);
                            return false;
                        }
                    }
                }
                catch (error) {
                    console.log(`🔒 Linux network reset failed: ${error}`);
                    return false;
                }
            }
            else {
                console.log(`🔒 Network reset not supported on platform: ${process.platform}`);
                return false;
            }
            console.log('🔒 Network configuration reset completed');
            return true;
        }
        catch (error) {
            console.log(`🔒 Network reset failed: ${error}`);
            return false;
        }
    }
    async increaseTimeouts() {
        try {
            console.log('⏱️ Increasing timeout settings...');
            process.env.HTTP_TIMEOUT = '30000';
            process.env.REQUEST_TIMEOUT = '30000';
            process.env.CONNECT_TIMEOUT = '10000';
            return true;
        }
        catch (error) {
            console.log(`Failed to increase timeouts: ${error}`);
            return false;
        }
    }
    validatePid(pid) {
        return /^\d+$/.test(pid) && parseInt(pid) > 0 && parseInt(pid) <= 4194304;
    }
    async restartHighCpuProcesses() {
        try {
            console.log('🔒 Restarting high CPU processes using secure commands...');
            try {
                const psResult = await this.executeSecureCommand('ps', ['aux'], { timeout: 5000 });
                const highCpuProcesses = [];
                const lines = psResult.split('\n').slice(1);
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 3) {
                        const cpuUsage = parseFloat(parts[2] || '0');
                        const pid = parts[1] || '';
                        if (!isNaN(cpuUsage) && cpuUsage > 50 && this.validatePid(pid)) {
                            highCpuProcesses.push({ pid, cpu: cpuUsage, command: parts.slice(10).join(' ') });
                        }
                    }
                }
                const processesToKill = highCpuProcesses.slice(0, 3);
                console.log(`🔒 Found ${highCpuProcesses.length} high CPU processes, killing top ${processesToKill.length}`);
                for (const proc of processesToKill) {
                    try {
                        console.log(`🔒 Terminating high CPU process PID: ${proc.pid} (${proc.cpu}% CPU) - ${proc.command}`);
                        await this.executeSecureCommand('kill', ['-TERM', proc.pid || ''], { timeout: 3000 });
                        await this.sleep(1000);
                        try {
                            await this.executeSecureCommand('kill', ['-0', proc.pid || ''], { timeout: 1000 });
                            console.log(`🔒 Process ${proc.pid} still running, force killing`);
                            await this.executeSecureCommand('kill', ['-9', proc.pid || ''], { timeout: 3000 });
                        }
                        catch (checkError) {
                            console.log(`🔒 Process ${proc.pid} terminated successfully`);
                        }
                    }
                    catch (error) {
                        console.log(`🔒 Failed to kill process ${proc.pid}: ${error}`);
                    }
                }
                return true;
            }
            catch (psError) {
                console.log(`🔒 Failed to get process list: ${psError}`);
                return false;
            }
        }
        catch (error) {
            console.log(`🔒 Failed to restart high CPU processes: ${error}`);
            return false;
        }
    }
    async genericNetworkFix() {
        try {
            console.log('🔒 Applying generic network fixes using secure commands...');
            if (process.platform === 'darwin') {
                try {
                    console.log('🔒 Flushing DNS cache for generic network fix');
                    await this.executeSecureCommand('sudo', ['dscacheutil', '-flushcache'], {
                        timeout: 5000,
                    });
                }
                catch (error) {
                    console.log(`🔒 DNS cache flush failed: ${error}`);
                    return false;
                }
            }
            else if (process.platform === 'linux') {
                try {
                    console.log('🔒 Flushing DNS cache on Linux');
                    await this.executeSecureCommand('sudo', ['systemctl', 'flush-dns'], { timeout: 5000 });
                }
                catch (error) {
                    console.log(`🔒 Linux DNS flush failed: ${error}`);
                }
            }
            console.log('🔒 Generic network fix completed');
            return true;
        }
        catch (error) {
            console.log(`🔒 Generic network fix failed: ${error}`);
            return false;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    getStatus() {
        const issues = Array.from(this.networkIssues.values());
        const criticalIssues = issues.filter((i) => i.severity === 'high');
        const recentHealings = this.completedHealings.slice(-10);
        return {
            isRunning: this.isRunning,
            activeIssues: issues.length,
            criticalIssues: criticalIssues.length,
            totalHealings: this.completedHealings.length,
            recentHealings: recentHealings.length,
            monitoredServices: this.coreServices.length,
            lastCheck: new Date().toISOString(),
            issues: issues.map((issue) => ({
                id: issue.id,
                type: issue.type,
                service: issue.service,
                severity: issue.severity,
                description: issue.description,
                count: issue.count,
                lastSeen: issue.lastSeen,
            })),
        };
    }
    stop() {
        this.isRunning = false;
        console.log('🛑 Network Healing Service stopped');
    }
}
export { NetworkHealingService };
//# sourceMappingURL=network-healing-service.js.map