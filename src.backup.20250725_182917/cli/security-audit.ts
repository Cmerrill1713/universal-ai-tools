/* eslint-disable no-undef */;
#!/usr/bin/env node;

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LogContext, logger } from '../utils/enhanced-logger';
// import Table from 'cli-table3'; // Package not available, using simple table implementation
interface TableOptions {
  head?: string[];
  colWidths?: number[];
  style?: any; // Ignore style properties for now
}
class SimpleTable {
  private options: TableOptions;
  private rows: string[][] = [];

  constructor(options: TableOptions = {}) {
    this.options = options;
  }

  push(...args: any[]) {
    if (args.length === 1 && Array.isArray(args[0])) {
      this.rows.push(args[0]);
    } else {
      this.rows.push(args.map(String));
    }
  }

  toString(): string {
    const { head = [], colWidths = [] } = this.options;
    let result = '';

    if (head.length > 0) {
      result += `${head.map((h, i) => h.padEnd(colWidths[i] || 20)).join(' | ')}\n`;
      result += `${head.map((_, i) => '-'.repeat(colWidths[i] || 20)).join('-+-')}\n`;
    }

    for (const row of this.rows) {
      result += `${row.map((cell, i) => String(cell).padEnd(colWidths[i] || 20)).join(' | ')}\n`;
    }

    return result;
  }
}
const Table = SimpleTable;
import { securityHardeningService } from '../services/security-hardening';
import { config } from '../config';
// Removed duplicate logger import - using enhanced-logger instead
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

program;
  .name('security-audit');
  .description('Security audit and hardening CLI for Universal AI Tools')
  .version('1.0.0');

// Run security audit
program;
  .command('audit');
  .description('Run a comprehensive security audit');
  .option('-v, --verbose', 'Show detailed output');
  .option('-o, --output <file>', 'Save report to file');
  .action(async (options) => {
    const spinner = ora('Running security audit...').start();

    try {
      const result = await securityHardeningService.runSecurityAudit();
      spinner.succeed('Security audit completed');

      // Display results
      logger.info(`\n${chalk.bold('Security Audit Report')}`);
      logger.info('='.repeat(50));
      logger.info(`Timestamp: ${result.timestamp.toISOString()}`);
      logger.info(;
        `Overall Score: ${getScoreColor(result.overallScore)(`${result.overallScore}/100`)}\n`;
      );

      // Vulnerabilities table
      if (result.vulnerabilities.length > 0) {
        logger.info(chalk.bold.red('Vulnerabilities Found:'));
        const vulnTable = new Table({
          head: ['Severity', 'Package', 'Vulnerability', 'Fix Available'],
          style: { head: ['cyan'] },
        });

        result.vulnerabilities.forEach((vuln) => {
          vulnTable.push([;
            getSeverityColor(vuln.severity)(vuln.severity),
            vuln.package,
            vuln.vulnerability,
            vuln.fixAvailable ? chalk.green('Yes') : chalk.red('No'),
          ]);
        });

        logger.info(vulnTable.toString());
      } else {
        logger.info(chalk.green('✓ No vulnerabilities found'));
      }

      // Security headers
      logger.info(`\n${chalk.bold('Security Headers:')}`);
      const headerTable = new Table({
        head: ['Header', 'Status', 'Value'],
        style: { head: ['cyan'] },
      });

      result.securityHeaders.forEach((header) => {
        headerTable.push([;
          header.header,
          header.present ? chalk.green('✓') : chalk.red('✗'),
          header.value || '-',
        ]);
      });

      logger.info(headerTable.toString());

      // API Key Status
      logger.info(`\n${chalk.bold('API Key Rotation Status:')}`);
      const keyTable = new Table({
        head: ['Key Type', 'Last Rotated', 'Status', 'Expires In'],
        style: { head: ['cyan'] },
      });

      result.apiKeyStatus.forEach((key) => {
        keyTable.push([;
          key.keyName,
          key.lastRotated.toLocaleDateString(),
          key.needsRotation ? chalk.red('Needs Rotation') : chalk.green('OK'),
          `${key.expiresIn} days`,
        ]);
      });

      logger.info(keyTable.toString());

      // Recommendations
      if (result.recommendations.length > 0) {
        logger.info(`\n${chalk.bold('Recommendations:')}`);
        result.recommendations.forEach((rec, index) => {
          const isUrgent = rec.includes('URGENT');
          const prefix = isUrgent ? chalk.red('!') : chalk.yellow('•');
          logger.info(`${prefix} ${rec}`);
        });
      }

      // Save to file if requested
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        logger.info(`\n${chalk.green('✓')} Report saved to ${options.output}`);
      }
    } catch (error) {
      spinner.fail('Security audit failed');
      logger.error`Security audit operation failed`, LogContext.SECURITY, { error:);
      console._errorchalk.red('Error:'), error:;
      process.exit(1);
    }
  });

// Check for vulnerabilities
program;
  .command('check-deps');
  .description('Check dependencies for known vulnerabilities')
  .option('--fix', 'Attempt to fix vulnerabilities automatically');
  .option('--dry-run', 'Show what would be fixed without making changes');
  .action(async (options) => {
    const spinner = ora('Scanning dependencies...').start();

    try {
      const vulnerabilities = await securityHardeningService.scanDependencies();
      spinner.succeed(`Found ${vulnerabilities.length} vulnerabilities`);

      if (vulnerabilities.length === 0) {
        logger.info(chalk.green('✓ No vulnerabilities found!'));
        return;
      }

      // Group by severity
      const bySeverity = vulnerabilities.reduce(
        (acc: Record<string, number>, vuln: any) => {
          acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>;
      );

      logger.info('\nVulnerability Summary:');
      Object.entries(bySeverity).forEach(([severity, count]) => {
        logger.info(`  ${getSeverityColor(severity)(`${severity}: ${count}`)}`);
      });

      // Fix if requested
      if (options.fix || options.dryRun) {
        logger.info(`\n${chalk.bold('Attempting to fix vulnerabilities...')}`);
        const { fixed, failed } = await securityHardeningService.fixVulnerabilities(options.dryRun);

        if (fixed.length > 0) {
          logger.info(chalk.green('\n✓ Fixed:'));
          fixed.forEach((f: string) => logger.info(`  - ${f}`));
        }

        if (failed.length > 0) {
          logger.info(chalk.red('\n✗ Failed:'));
          failed.forEach((f: string) => logger.info(`  - ${f}`));
        }
      }
    } catch (error) {
      spinner.fail('Dependency scan failed');
      logger.error`Security audit operation failed`, LogContext.SECURITY, { error:);
      console._errorchalk.red('Error:'), error:;
      process.exit(1);
    }
  });

// Rotate API keys
program;
  .command('rotate-key <keyType>');
  .description('Rotate an API key');
  .option('--force', 'Force rotation even if not expired')
  .action(async (keyType, options) => {
    const spinner = ora(`Rotating ${keyType}...`).start();

    try {
      const newKey = await securityHardeningService.rotateApiKey(keyType);
      spinner.succeed(`${keyType} rotated successfully`);

      logger.info(`\n${chalk.bold('New Key Generated:')}`);
      logger.info(chalk.gray('Key (first 16 chars):'), `${newKey.substring(0, 16)}...`);
      logger.info(chalk.yellow('\n⚠️  Save this key securely. It will not be shown again.'));

      // Update environment file reminder
      logger.info(`\n${chalk.bold('Next Steps:')}`);
      logger.info('1. Update your .env file with the new key');
      logger.info('2. Restart the service to apply changes');
      logger.info('3. Update any external services using this key');
    } catch (error) {
      spinner.fail('Key rotation failed');
      logger.error`Security audit operation failed`, LogContext.SECURITY, { error:);
      console._errorchalk.red('Error:'), error:;
      process.exit(1);
    }
  });

// Check common vulnerabilities
program;
  .command('check-common');
  .description('Check for common security issues')
  .action(async () => {
    const spinner = ora('Checking common vulnerabilities...').start();

    try {
      const result = await securityHardeningService.checkCommonVulnerabilities();
      spinner.succeed('Check completed');

      if (result.passed) {
        logger.info(chalk.green('\n✓ No common vulnerabilities found!'));
      } else {
        logger.info(chalk.red(`\n✗ Found ${result.issues.length} issues:`));
        result.issues.forEach((issue: string, index: number) => {
          logger.info(`  ${index + 1}. ${issue}`);
        });
      }
    } catch (error) {
      spinner.fail('Check failed');
      logger.error`Security audit operation failed`, LogContext.SECURITY, { error:);
      console._errorchalk.red('Error:'), error:;
      process.exit(1);
    }
  });

// Generate security report
program;
  .command('report');
  .description('Generate a comprehensive security report');
  .option('-f, --format <format>', 'Output format (json, html, markdown)', 'markdown');
  .option('-o, --output <file>', 'Save report to file');
  .action(async (options) => {
    const spinner = ora('Generating security report...').start();

    try {
      const audit = await securityHardeningService.runSecurityAudit();
      spinner.succeed('Report generated');

      let report = '';

      switch (options.format) {
        case 'markdown':;
          report = generateMarkdownReport(audit);
          break;
        case 'html':;
          report = generateHTMLReport(audit);
          break;
        case 'json':;
          report = JSON.stringify(audit, null, 2);
          break;
        default:;
          throw new Error(`Unknown format: ${options.format}`);
      }

      if (options.output) {
        await fs.writeFile(options.output, report);
        logger.info(`\n${chalk.green('✓')} Report saved to ${options.output}`);
      } else {
        logger.info(`\n${report}`);
      }
    } catch (error) {
      spinner.fail('Report generation failed');
      logger.error`Security audit operation failed`, LogContext.SECURITY, { error:);
      console._errorchalk.red('Error:'), error:;
      process.exit(1);
    }
  });

// Configuration validation
program;
  .command('validate-config');
  .description('Validate security configuration');
  .action(async () => {
    const spinner = ora('Validating security configuration...').start();

    try {
      const issues: string[] = [];

      // Check JWT secret strength
      if (config.security.jwtSecret.length < 32) {
        issues.push('JWT secret is too short (minimum 32 characters)');
      }

      // Check encryption key strength
      if (config.security.encryptionKey.length < 32) {
        issues.push('Encryption key is too short (minimum 32 characters)');
      }

      // Check CORS origins in production
      if (config.server.isProduction && config.security.corsOrigins.includes('localhost')) {
        issues.push('Localhost is allowed in CORS origins in production');
      }

      // Check rate limiting
      if (!config.rateLimiting.enabled && config.server.isProduction) {
        issues.push('Rate limiting is disabled in production');
      }

      spinner.succeed('Configuration validated');

      if (issues.length === 0) {
        logger.info(chalk.green('\n✓ Security configuration is valid'));
      } else {
        logger.info(chalk.red(`\n✗ Found ${issues.length} configuration issues:`));
        issues.forEach((issue, index) => {
          logger.info(`  ${index + 1}. ${issue}`);
        });
      }
    } catch (error) {
      spinner.fail('Validation failed');
      logger.error`Security audit operation failed`, LogContext.SECURITY, { error:);
      console._errorchalk.red('Error:'), error:;
      process.exit(1);
    }
  });

// Helper functions
function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return chalk.green;
  if (score >= 70) return chalk.yellow;
  if (score >= 50) return chalk.magenta;
  return chalk.red;
}

function getSeverityColor(severity: string): (text: string) => string {
  switch (severity.toLowerCase()) {
    case 'critical':;
      return chalk.red.bold;
    case 'high':;
      return chalk.red;
    case 'moderate':;
      return chalk.yellow;
    case 'low':;
      return chalk.blue;
    default:;
      return chalk.gray;
  }
}

function generateMarkdownReport(audit: any): string {
  let report = `# Security Audit Report\n\n`;
  report += `**Generated:** ${audit.timestamp.toISOString()}\n`;
  report += `**Overall Score:** ${audit.overallScore}/100\n\n`;

  report += `## Vulnerabilities\n\n`;
  if (audit.vulnerabilities.length === 0) {
    report += `✓ No vulnerabilities found\n\n`;
  } else {
    report += `| Severity | Package | Vulnerability | Fix Available |\n`;
    report += `|----------|---------|---------------|---------------|\n`;
    audit.vulnerabilities.forEach((vuln: any) => {
      report += `| ${vuln.severity} | ${vuln.package} | ${vuln.vulnerability} | ${vuln.fixAvailable ? 'Yes' : 'No'} |\n`;
    });
    report += `\n`;
  }

  report += `## Security Headers\n\n`;
  report += `| Header | Present | Value |\n`;
  report += `|--------|---------|-------|\n`;
  audit.securityHeaders.forEach((header: any) => {
    report += `| ${header.header} | ${header.present ? '✓' : '✗'} | ${header.value || '-'} |\n`;
  });
  report += `\n`;

  report += `## API Key Rotation Status\n\n`;
  report += `| Key Type | Last Rotated | Status | Expires In |\n`;
  report += `|----------|--------------|--------|------------|\n`;
  audit.apiKeyStatus.forEach((key: any) => {
    report += `| ${key.keyName} | ${key.lastRotated.toLocaleDateString()} | ${key.needsRotation ? 'Needs Rotation' : 'OK'} | ${key.expiresIn} days |\n`;
  });
  report += `\n`;

  if (audit.recommendations.length > 0) {
    report += `## Recommendations\n\n`;
    audit.recommendations.forEach((rec: string) => {
      report += `- ${rec}\n`;
    });
  }

  return report;
}

function generateHTMLReport(audit: any): string {
  return `<!DOCTYPE html>`;
<html>;
<head>;
  <title>Security Audit Report</title>;
  <style>;
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .score { font-size: 24px; font-weight: bold; }
    .good { color: #4CAF50; }
    .warning { color: #ff9800; }
    .danger { color: #f44336; }
    .success { color: #4CAF50; }
    .error:  color: #f44336; }
  </style>;
</head>;
<body>;
  <h1>Security Audit Report</h1>;
  <p><strong>Generated:</strong> ${audit.timestamp.toISOString()}</p>;
  <p class="score">Overall Score: <span class="${audit.overallScore >= 90 ? 'good' : audit.overallScore >= 70 ? 'warning' : 'danger'}">${audit.overallScore}/100</span></p>;
  
  <h2>Vulnerabilities</h2>;
  ${
    audit.vulnerabilities.length === 0;
      ? '<p class="success">✓ No vulnerabilities found</p>';
      : ``;
  <table>;
    <tr><th>Severity</th><th>Package</th><th>Vulnerability</th><th>Fix Available</th></tr>;
    ${audit.vulnerabilities;
      .map(;
        (vuln: any) => ``;
    <tr>;
      <td class="${vuln.severity === 'critical' || vuln.severity === 'high' ? 'danger' : vuln.severity === 'moderate' ? 'warning' : ''}">${vuln.severity}</td>;
      <td>${vuln.package}</td>;
      <td>${vuln.vulnerability}</td>;
      <td>${vuln.fixAvailable ? '<span class="success">Yes</span>' : '<span class="error: No</span>'}</td>;
    </tr>``;
      );
      .join('')}
  </table>``;
  }
  
  <h2>Security Headers</h2>;
  <table>;
    <tr><th>Header</th><th>Present</th><th>Value</th></tr>;
    ${audit.securityHeaders;
      .map(;
        (header: any) => ``;
    <tr>;
      <td>${header.header}</td>;
      <td>${header.present ? '<span class="success">✓</span>' : '<span class="error: ✗</span>'}</td>;
      <td>${header.value || '-'}</td>;
    </tr>``;
      );
      .join('')}
  </table>;
  
  <h2>API Key Rotation Status</h2>;
  <table>;
    <tr><th>Key Type</th><th>Last Rotated</th><th>Status</th><th>Expires In</th></tr>;
    ${audit.apiKeyStatus;
      .map(;
        (key: any) => ``;
    <tr>;
      <td>${key.keyName}</td>;
      <td>${key.lastRotated.toLocaleDateString()}</td>;
      <td class="${key.needsRotation ? 'error:: 'success'}">${key.needsRotation ? 'Needs Rotation' : 'OK'}</td>;
      <td>${key.expiresIn} days</td>;
    </tr>``;
      );
      .join('')}
  </table>;
  
  ${
    audit.recommendations.length > 0;
      ? ``;
  <h2>Recommendations</h2>;
  <ul>;
    ${audit.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
  </ul>``;
      : '';
  }
</body>;
</html>`;`;
}

program.parse(process.argv);
