#!/usr/bin/env node

/**
 * Code Quality Dashboard
 * Provides a comprehensive view of code quality metrics
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function runCommand(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return output;
  } catch (error) {
    return error.stdout || '';
  }
}

function countOccurrences(output, pattern) {
  const matches = output.match(pattern);
  return matches ? matches.length : 0;
}

async function generateQualityReport() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${colors.bright}${colors.cyan}🎯 Code Quality Dashboard${colors.reset}\n`);
  console.log(`Generated at: ${new Date().toLocaleString()}\n`);

  const metrics = {
    typescript: {
      errors: 0,
      warnings: 0,
      files: 0,
    },
    python: {
      errors: 0,
      warnings: 0,
      files: 0,
    },
    security: {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    },
    coverage: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
    complexity: {
      high: 0,
      medium: 0,
      low: 0,
    },
  };

  // TypeScript/JavaScript Analysis
  console.log(`${colors.yellow}📦 TypeScript/JavaScript Analysis${colors.reset}`);
  const eslintOutput = runCommand('npx eslint src tests --ext .ts,.tsx --format json', true);
  try {
    const eslintData = JSON.parse(eslintOutput);
    eslintData.forEach((file) => {
      if (file.messages.length > 0) {
        metrics.typescript.files++;
        file.messages.forEach((msg) => {
          if (msg.severity === 2) metrics.typescript.errors++;
          else metrics.typescript.warnings++;
        });
      }
    });
  } catch (e) {
    console.log('Could not parse ESLint output');
  }

  console.log(`  Files with issues: ${metrics.typescript.files}`);
  console.log(`  Errors: ${colors.red}${metrics.typescript.errors}${colors.reset}`);
  console.log(`  Warnings: ${colors.yellow}${metrics.typescript.warnings}${colors.reset}\n`);

  // Python Analysis
  console.log(`${colors.yellow}🐍 Python Analysis${colors.reset}`);
  const pythonFiles = execSync(
    'find . -name "*.py" -not -path "./node_modules/*" -not -path "./ui/*" | wc -l',
    { encoding: 'utf8' }
  ).trim();
  console.log(`  Total Python files: ${pythonFiles}`);

  const ruffOutput = runCommand(
    'ruff check . --exclude="node_modules,ui/node_modules,build,dist" --statistics',
    true
  );
  const pythonErrors = countOccurrences(ruffOutput, /\d+ errors?/g);
  console.log(`  Ruff issues: ${pythonErrors}\n`);

  // Security Analysis
  console.log(`${colors.yellow}🔒 Security Analysis${colors.reset}`);
  const auditOutput = runCommand('npm audit --json', true);
  try {
    const auditData = JSON.parse(auditOutput);
    metrics.security = auditData.metadata.vulnerabilities || metrics.security;
  } catch (e) {
    console.log('Could not parse npm audit output');
  }

  console.log(`  Critical: ${colors.red}${metrics.security.critical}${colors.reset}`);
  console.log(`  High: ${colors.red}${metrics.security.high}${colors.reset}`);
  console.log(`  Moderate: ${colors.yellow}${metrics.security.moderate}${colors.reset}`);
  console.log(`  Low: ${colors.green}${metrics.security.low}${colors.reset}\n`);

  // Test Coverage (if available)
  console.log(`${colors.yellow}📊 Test Coverage${colors.reset}`);
  const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  if (fs.existsSync(coverageFile)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
      metrics.coverage = coverage.total;
      console.log(`  Statements: ${metrics.coverage.statements.pct}%`);
      console.log(`  Branches: ${metrics.coverage.branches.pct}%`);
      console.log(`  Functions: ${metrics.coverage.functions.pct}%`);
      console.log(`  Lines: ${metrics.coverage.lines.pct}%`);
    } catch (e) {
      console.log('  No coverage data available');
    }
  } else {
    console.log('  No coverage report found. Run tests with coverage first.');
  }

  // Code Complexity
  console.log(`\n${colors.yellow}🧩 Code Complexity${colors.reset}`);
  console.log('  Run complexity analysis with: npm run complexity:analyze');

  // Recommendations
  console.log(`\n${colors.bright}${colors.green}📋 Recommendations:${colors.reset}`);

  if (metrics.typescript.errors > 0) {
    console.log(`  • Fix ${metrics.typescript.errors} TypeScript errors: npm run fix:all`);
  }

  if (metrics.security.critical > 0 || metrics.security.high > 0) {
    console.log(`  • Fix security vulnerabilities: npm audit fix`);
  }

  if (pythonErrors > 0) {
    console.log(`  • Fix Python issues: ruff check . --fix`);
  }

  console.log(
    `\n${colors.cyan}Run 'npm run clean:all' to automatically fix most issues.${colors.reset}`
  );
}

// Run the dashboard
generateQualityReport().catch(console.error);
