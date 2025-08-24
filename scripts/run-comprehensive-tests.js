#!/usr/bin/env node

import { TestReportGenerator } from './generate-test-report.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

async function checkServerRunning() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${colors.blue}📡 Checking if server is running...${colors.reset}`);

  try {
    const response = await fetch('http://localhost:9999/api/health');
    if (response.ok) {
      console.log(`${colors.green}✅ Server is running${colors.reset}`);
      return true;
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Server not detected. Starting server...${colors.reset}`);
    return false;
  }
}

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log(`${colors.blue}🚀 Starting development server...${colors.reset}`);

    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
    });

    let serverStarted = false;
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 30000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') || output.includes('listening on')) {
        serverStarted = true;
        clearTimeout(timeout);
        console.log(`${colors.green}✅ Server started successfully${colors.reset}`);
        resolve(serverProcess);
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function runTestSequence() {
  console.log(
    `${colors.bold}${colors.cyan}🧪 Universal AI Tools - Comprehensive Test Runner${colors.reset}\n`
  );

  let serverProcess = null;

  try {
    // Check if server is running, start if needed
    const isRunning = await checkServerRunning();
    if (!isRunning) {
      serverProcess = await startServer();
      // Give server a moment to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`${colors.blue}📊 Generating comprehensive test report...${colors.reset}\n`);

    // Create and run test report generator
    const generator = new TestReportGenerator();
    await generator.runAllTests();
    const reportPaths = await generator.saveReports();

    generator.printSummary();

    console.log(`\n${colors.bold}📄 Reports Generated:${colors.reset}`);
    console.log(`• ${colors.green}Markdown:${colors.reset} ${reportPaths.markdown}`);
    console.log(`• ${colors.blue}JSON:${colors.reset} ${reportPaths.json}`);
    console.log(`• ${colors.magenta}HTML:${colors.reset} ${reportPaths.html}`);

    // Open HTML report if requested
    if (process.argv.includes('--open')) {
      const { spawn } = await import('child_process');
      spawn('open', [reportPaths.html], { stdio: 'ignore' });
      console.log(`${colors.cyan}🌐 Opening HTML report in browser...${colors.reset}`);
    }

    // Production readiness assessment
    const healthScore = generator.results.overallHealth;

    console.log(`\n${colors.bold}📋 Production Readiness Assessment:${colors.reset}`);

    if (healthScore >= 95) {
      console.log(
        `${colors.green}${colors.bold}🎉 EXCELLENT - Ready for production deployment!${colors.reset}`
      );
      console.log(`${colors.green}• Health Score: ${healthScore.toFixed(1)}%${colors.reset}`);
      console.log(`${colors.green}• All critical systems operational${colors.reset}`);
    } else if (healthScore >= 80) {
      console.log(`${colors.yellow}${colors.bold}⚠️  GOOD - Minor issues detected${colors.reset}`);
      console.log(`${colors.yellow}• Health Score: ${healthScore.toFixed(1)}%${colors.reset}`);
      console.log(`${colors.yellow}• Review recommendations before deployment${colors.reset}`);
    } else if (healthScore >= 60) {
      console.log(
        `${colors.yellow}${colors.bold}🔧 FAIR - Significant improvements needed${colors.reset}`
      );
      console.log(`${colors.yellow}• Health Score: ${healthScore.toFixed(1)}%${colors.reset}`);
      console.log(`${colors.yellow}• Address failing tests before deployment${colors.reset}`);
    } else {
      console.log(
        `${colors.red}${colors.bold}🚨 POOR - Critical issues must be resolved${colors.reset}`
      );
      console.log(`${colors.red}• Health Score: ${healthScore.toFixed(1)}%${colors.reset}`);
      console.log(`${colors.red}• DO NOT deploy to production${colors.reset}`);
    }

    // Phase 1 specific guidance
    const phase1Progress = generator.results.phase1Progress;
    console.log(
      `\n${colors.bold}📈 Phase 1 Progress: ${phase1Progress.toFixed(1)}%${colors.reset}`
    );

    if (phase1Progress >= 100) {
      console.log(`${colors.green}✅ Phase 1 complete - Ready for Phase 2${colors.reset}`);
    } else if (phase1Progress >= 80) {
      console.log(
        `${colors.yellow}🔄 Phase 1 nearly complete - Finish remaining items${colors.reset}`
      );
    } else {
      console.log(`${colors.red}🎯 Focus on Phase 1 completion before proceeding${colors.reset}`);
    }

    // Exit with appropriate code for CI/CD
    const exitCode = healthScore >= 80 ? 0 : 1;

    if (serverProcess) {
      console.log(`\n${colors.blue}🛑 Stopping development server...${colors.reset}`);
      serverProcess.kill();
    }

    process.exit(exitCode);
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`${colors.red}❌ Test execution failed: ${error.message}${colors.reset}`);

    if (serverProcess) {
      serverProcess.kill();
    }

    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bold}Universal AI Tools - Comprehensive Test Runner${colors.reset}

Usage: node scripts/run-comprehensive-tests.js [options]

Options:
  --help, -h     Show this help message
  --open         Open HTML report in browser after generation
  --no-server    Skip server startup (assume server is already running)

Examples:
  node scripts/run-comprehensive-tests.js
  node scripts/run-comprehensive-tests.js --open
  npm run report:full
  `);
  process.exit(0);
}

// Run the test sequence
runTestSequence().catch(console.error);
