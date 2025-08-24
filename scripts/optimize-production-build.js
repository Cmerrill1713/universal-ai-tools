#!/usr/bin/env node
/**
 * Production Build Optimization Script
 * Optimizes the TypeScript build output for production deployment
 * Focuses on memory efficiency and startup performance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\033[0;31m';
const GREEN = '\033[0;32m';
const YELLOW = '\033[1;33m';
const BLUE = '\033[0;34m';
const NC = '\033[0m'; // No Color

function printStatus(message) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${GREEN}✅ ${message}${NC}`);
}

function printWarning(message) {
    console.log(`${YELLOW}⚠️  ${message}${NC}`);
}

function printError(message) {
    console.log(`${RED}❌ ${message}${NC}`);
}

function printInfo(message) {
    console.log(`${BLUE}ℹ️  ${message}${NC}`);
}

// Configuration
const PROJECT_ROOT = path.dirname(__dirname);
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

async function optimizeJavaScriptFiles() {
    printInfo('Optimizing JavaScript files for production...');
    
    const jsFiles = [];
    
    function findJSFiles(dir) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                findJSFiles(filePath);
            } else if (file.endsWith('.js')) {
                jsFiles.push(filePath);
            }
        }
    }
    
    findJSFiles(DIST_DIR);
    
    for (const jsFile of jsFiles) {
        try {
            let content = fs.readFileSync(jsFile, 'utf8');
            
            // Remove debug statements
            content = content.replace(/console\.debug\([^)]*\);?/g, '');
            content = content.replace(/console\.trace\([^)]*\);?/g, '');
            
            // Optimize error handling (keep console.error for production monitoring)
            // Remove development-only imports
            content = content.replace(/import\s+.*from\s+['"].*\.test\.js['"];?\s*/g, '');
            content = content.replace(/import\s+.*from\s+['"].*\.spec\.js['"];?\s*/g, '');
            
            // Remove extra whitespace and empty lines
            content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
            content = content.replace(/\s+$/gm, '');
            
            fs.writeFileSync(jsFile, content);
        } catch (error) {
            printWarning(`Failed to optimize ${jsFile}: ${error.message}`);
        }
    }
    
    printStatus(`Optimized ${jsFiles.length} JavaScript files`);
}

async function createProductionConfigFiles() {
    printInfo('Creating production configuration files...');
    
    // Create optimized tsconfig for production
    const prodTsConfig = {
        extends: './tsconfig.json',
        compilerOptions: {
            removeComments: true,
            sourceMap: false,
            declaration: false,
            declarationMap: false,
            incremental: false,
            tsBuildInfoFile: null
        },
        exclude: [
            'src/**/*.test.ts',
            'src/**/*.spec.ts',
            'tests/**/*',
            '**/*.d.ts',
            'scripts/**/*'
        ]
    };
    
    fs.writeFileSync(
        path.join(PROJECT_ROOT, 'tsconfig.prod.json'),
        JSON.stringify(prodTsConfig, null, 2)
    );
    
    // Create Docker-optimized tsconfig
    const dockerTsConfig = {
        extends: './tsconfig.prod.json',
        compilerOptions: {
            outDir: './dist',
            rootDir: './src',
            strict: true,
            target: 'ES2022',
            module: 'ES2022',
            moduleResolution: 'node'
        }
    };
    
    fs.writeFileSync(
        path.join(PROJECT_ROOT, 'tsconfig.docker.json'),
        JSON.stringify(dockerTsConfig, null, 2)
    );
    
    printStatus('Production configuration files created');
}

async function optimizePackageJson() {
    printInfo('Optimizing package.json for production...');
    
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Create production package.json (for Docker)
    const prodPackageJson = {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        main: packageJson.main,
        type: packageJson.type,
        engines: packageJson.engines,
        scripts: {
            start: packageJson.scripts['start:prod'] || packageJson.scripts.start,
            'health:check': packageJson.scripts['health:check']
        },
        dependencies: packageJson.dependencies,
        keywords: packageJson.keywords,
        author: packageJson.author,
        license: packageJson.license
    };
    
    fs.writeFileSync(
        path.join(DIST_DIR, 'package.json'),
        JSON.stringify(prodPackageJson, null, 2)
    );
    
    printStatus('Production package.json created');
}

async function createStartupOptimizationScript() {
    printInfo('Creating startup optimization script...');
    
    const startupScript = `#!/usr/bin/env node
/**
 * Production Startup Script with Memory Optimization
 * Optimized for <1GB memory target
 */

// Memory optimization flags
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=512 --optimize-for-size';

// Production environment checks
if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.warn('⚠️  Starting in non-production mode');
}

// Memory monitoring
const initialMemory = process.memoryUsage();
console.log('🚀 Starting Universal AI Tools (Production)');
console.log(\`💾 Initial memory: \${(initialMemory.rss / 1024 / 1024).toFixed(1)}MB\`);

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('📡 Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📡 Received SIGINT, shutting down gracefully');
    process.exit(0);
});

// Memory leak detection
if (process.env.MEMORY_LEAK_DETECTION_ENABLED === 'true') {
    setInterval(() => {
        const usage = process.memoryUsage();
        const rssGB = usage.rss / 1024 / 1024 / 1024;
        
        if (rssGB > 0.8) { // 800MB threshold
            console.warn(\`⚠️  High memory usage: \${rssGB.toFixed(2)}GB\`);
        }
        
        if (global.gc && rssGB > 0.6) {
            global.gc();
            console.log('🧹 Garbage collection triggered');
        }
    }, parseInt(process.env.MEMORY_MONITORING_INTERVAL) || 60000);
}

// Start the main application
require('./server.js');
`;
    
    fs.writeFileSync(path.join(DIST_DIR, 'start.js'), startupScript);
    fs.chmodSync(path.join(DIST_DIR, 'start.js'), '755');
    
    printStatus('Startup optimization script created');
}

async function bundleHealthChecks() {
    printInfo('Creating health check utilities...');
    
    const healthCheckScript = `#!/usr/bin/env node
/**
 * Production Health Check Script
 * Validates all critical services are operational
 */

const http = require('http');
const https = require('https');

const HEALTH_ENDPOINTS = [
    { name: 'API Health', url: 'http://localhost:9999/health' },
    { name: 'API Status', url: 'http://localhost:9999/api/health' }
];

async function checkEndpoint(endpoint) {
    return new Promise((resolve) => {
        const protocol = endpoint.url.startsWith('https') ? https : http;
        const timeout = setTimeout(() => {
            resolve({ name: endpoint.name, status: 'timeout', error: 'Request timeout' });
        }, 5000);
        
        const req = protocol.get(endpoint.url, (res) => {
            clearTimeout(timeout);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    name: endpoint.name,
                    status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
                    statusCode: res.statusCode,
                    response: data.substring(0, 200)
                });
            });
        });
        
        req.on('error', (error) => {
            clearTimeout(timeout);
            resolve({ name: endpoint.name, status: 'error', error: error.message });
        });
    });
}

async function runHealthChecks() {
    console.log('🔍 Running production health checks...');
    
    const results = await Promise.all(
        HEALTH_ENDPOINTS.map(endpoint => checkEndpoint(endpoint))
    );
    
    let allHealthy = true;
    
    for (const result of results) {
        const status = result.status === 'healthy' ? '✅' : '❌';
        console.log(\`\${status} \${result.name}: \${result.status}\`);
        
        if (result.error) {
            console.log(\`   Error: \${result.error}\`);
        }
        
        if (result.status !== 'healthy') {
            allHealthy = false;
        }
    }
    
    if (allHealthy) {
        console.log('🎉 All health checks passed!');
        process.exit(0);
    } else {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('💥 Some health checks failed!');
        process.exit(1);
    }
}

runHealthChecks().catch(error => {
    console.error('💥 Health check failed:', error);
    process.exit(1);
});
`;
    
    fs.writeFileSync(path.join(DIST_DIR, 'health-check.js'), healthCheckScript);
    fs.chmodSync(path.join(DIST_DIR, 'health-check.js'), '755');
    
    printStatus('Health check utilities created');
}

async function generateBuildInfo() {
    printInfo('Generating build information...');
    
    const buildInfo = {
        version: require(path.join(PROJECT_ROOT, 'package.json')).version,
        buildTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        optimization: 'production',
        memoryTarget: '<1GB',
        features: {
            memoryOptimization: true,
            serviceConsolidation: true,
            distributedTracing: true,
            authentication: 'JWT',
            monitoring: 'Prometheus + Grafana'
        },
        environment: {
            nodeEnv: 'production',
            dockerOptimized: true,
            healthChecks: true,
            gracefulShutdown: true
        }
    };
    
    fs.writeFileSync(
        path.join(DIST_DIR, 'build-info.json'),
        JSON.stringify(buildInfo, null, 2)
    );
    
    printStatus('Build information generated');
    return buildInfo;
}

async function displayBuildSummary(buildInfo) {
    console.log(`${BLUE}📊 Production Build Summary${NC}`);
    console.log('================================');
    console.log(`Version: ${buildInfo.version}`);
    console.log(`Build Time: ${buildInfo.buildTime}`);
    console.log(`Node Version: ${buildInfo.nodeVersion}`);
    console.log(`Memory Target: ${buildInfo.memoryTarget}`);
    console.log(`Optimization: ${buildInfo.optimization}`);
    console.log('');
    console.log('✅ Build optimizations applied:');
    console.log('   • JavaScript minification and cleanup');
    console.log('   • Production TypeScript configuration');
    console.log('   • Memory-optimized startup script');
    console.log('   • Health check utilities');
    console.log('   • Docker-optimized package.json');
    console.log('');
    printStatus('Production build optimization completed!');
}

// Main execution
async function main() {
    try {
        console.log(`${BLUE}🔧 Universal AI Tools - Production Build Optimization${NC}`);
        console.log('================================================================');
        
        // Ensure dist directory exists
        if (!fs.existsSync(DIST_DIR)) {
            printError('Dist directory not found. Run TypeScript compilation first.');
            process.exit(1);
        }
        
        // Run optimization steps
        await createProductionConfigFiles();
        await optimizeJavaScriptFiles();
        await optimizePackageJson();
        await createStartupOptimizationScript();
        await bundleHealthChecks();
        const buildInfo = await generateBuildInfo();
        
        // Display summary
        await displayBuildSummary(buildInfo);
        
    } catch (error) {
        printError(`Build optimization failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Execute if called directly
if (require.main === module) {
    main();
}

module.exports = { main };