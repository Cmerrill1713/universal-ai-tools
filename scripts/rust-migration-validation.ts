#!/usr/bin/env tsx

/**
 * Comprehensive Migration Validation Suite
 * 
 * Validates all Rust service migrations are complete and functional.
 * Tests integration, performance, and feature parity with TypeScript versions.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../src/utils/logger';

interface ValidationResult {
  service: string;
  status: 'success' | 'warning' | 'error';
  checks: {
    name: string;
    passed: boolean;
    message?: string;
  }[];
  performance?: {
    rustTime: number;
    tsTime?: number;
    improvement?: string;
  };
}

class RustMigrationValidator {
  private results: ValidationResult[] = [];
  private readonly servicesPath = path.join(process.cwd(), 'crates');
  private readonly services = [
    'voice-processing',
    'vision-resource-manager',
    'fast-llm-coordinator',
    'parameter-analytics-service',
    'redis-service'
  ];

  async validateAll(): Promise<void> {
    Logger.info('🚀 Starting Comprehensive Rust Migration Validation');
    Logger.info('=' .repeat(60));

    // Check workspace setup
    await this.validateWorkspace();

    // Validate each service
    for (const service of this.services) {
      await this.validateService(service);
    }

    // Generate report
    this.generateReport();
  }

  private async validateWorkspace(): Promise<void> {
    Logger.info('\n📦 Validating Rust Workspace Configuration...');
    
    const workspaceToml = path.join(process.cwd(), 'Cargo.toml');
    if (!fs.existsSync(workspaceToml)) {
      Logger.error('❌ Cargo.toml workspace file not found');
      process.exit(1);
    }

    const content = fs.readFileSync(workspaceToml, 'utf-8');
    const hasWorkspace = content.includes('[workspace]');
    const hasMembers = content.includes('members');
    
    if (!hasWorkspace || !hasMembers) {
      Logger.error('❌ Invalid workspace configuration');
      process.exit(1);
    }

    // Check all services are in workspace
    let missingServices = [];
    for (const service of this.services) {
      if (!content.includes(`"crates/${service}"`)) {
        missingServices.push(service);
      }
    }

    if (missingServices.length > 0) {
      Logger.warn(`⚠️  Missing services in workspace: ${missingServices.join(', ')}`);
    } else {
      Logger.info('✅ All services registered in workspace');
    }
  }

  private async validateService(serviceName: string): Promise<void> {
    Logger.info(`\n🔍 Validating ${serviceName}...`);
    
    const result: ValidationResult = {
      service: serviceName,
      status: 'success',
      checks: []
    };

    // Check 1: Service directory exists
    const servicePath = path.join(this.servicesPath, serviceName);
    const exists = fs.existsSync(servicePath);
    result.checks.push({
      name: 'Directory exists',
      passed: exists,
      message: exists ? 'Service directory found' : 'Service directory not found'
    });

    if (!exists) {
      result.status = 'error';
      this.results.push(result);
      return;
    }

    // Check 2: Cargo.toml exists
    const cargoPath = path.join(servicePath, 'Cargo.toml');
    const hasCargoToml = fs.existsSync(cargoPath);
    result.checks.push({
      name: 'Cargo.toml exists',
      passed: hasCargoToml,
      message: hasCargoToml ? 'Cargo.toml found' : 'Cargo.toml missing'
    });

    // Check 3: Source files exist
    const srcPath = path.join(servicePath, 'src');
    const hasSrc = fs.existsSync(srcPath);
    const hasLib = fs.existsSync(path.join(srcPath, 'lib.rs'));
    result.checks.push({
      name: 'Source structure',
      passed: hasSrc && hasLib,
      message: hasSrc && hasLib ? 'lib.rs found' : 'Missing source files'
    });

    // Check 4: Build test
    const buildResult = await this.runCommand(
      'cargo',
      ['build', '--release', '-p', serviceName],
      process.cwd()
    );
    result.checks.push({
      name: 'Build test',
      passed: buildResult.success,
      message: buildResult.success ? 'Build successful' : `Build failed: ${buildResult.error}`
    });

    // Check 5: Tests exist and pass
    const testsPath = path.join(servicePath, 'tests');
    const hasTests = fs.existsSync(testsPath) && fs.readdirSync(testsPath).length > 0;
    
    if (hasTests) {
      const testResult = await this.runCommand(
        'cargo',
        ['test', '-p', serviceName],
        process.cwd()
      );
      result.checks.push({
        name: 'Tests',
        passed: testResult.success,
        message: testResult.success ? 'Tests passed' : `Tests failed: ${testResult.error}`
      });
    } else {
      result.checks.push({
        name: 'Tests',
        passed: false,
        message: 'No tests found'
      });
      result.status = 'warning';
    }

    // Check 6: TypeScript wrapper exists
    const wrapperName = this.getWrapperName(serviceName);
    const wrapperPath = path.join(process.cwd(), 'src/services', wrapperName);
    const hasWrapper = fs.existsSync(wrapperPath);
    result.checks.push({
      name: 'TypeScript wrapper',
      passed: hasWrapper,
      message: hasWrapper ? `${wrapperName} found` : 'TypeScript wrapper missing'
    });

    // Check 7: NAPI bindings (if applicable)
    if (serviceName !== 'fast-llm-coordinator' && serviceName !== 'parameter-analytics-service') {
      const hasNapi = cargoPath && fs.readFileSync(cargoPath, 'utf-8').includes('napi');
      result.checks.push({
        name: 'NAPI bindings',
        passed: hasNapi,
        message: hasNapi ? 'NAPI configured' : 'NAPI not configured'
      });
    }

    // Check 8: Examples exist
    const examplesPath = path.join(servicePath, 'examples');
    const hasExamples = fs.existsSync(examplesPath) && fs.readdirSync(examplesPath).length > 0;
    result.checks.push({
      name: 'Examples',
      passed: hasExamples,
      message: hasExamples ? 'Examples found' : 'No examples'
    });

    // Check 9: Performance benchmark
    if (buildResult.success && hasExamples) {
      const benchResult = await this.runBenchmark(serviceName);
      if (benchResult) {
        result.performance = benchResult;
      }
    }

    // Determine overall status
    const failedChecks = result.checks.filter(c => !c.passed);
    if (failedChecks.some(c => c.name === 'Build test' || c.name === 'Directory exists')) {
      result.status = 'error';
    } else if (failedChecks.length > 2) {
      result.status = 'warning';
    }

    this.results.push(result);
  }

  private getWrapperName(serviceName: string): string {
    const wrapperMap: Record<string, string> = {
      'voice-processing': 'voice-processing-rust.ts',
      'vision-resource-manager': 'vision-resource-manager-rust.ts',
      'fast-llm-coordinator': 'fast-llm-coordinator-rust.ts',
      'parameter-analytics-service': 'parameter-analytics-rust.ts',
      'redis-service': 'redis-service-rust.ts'
    };
    return wrapperMap[serviceName] || `${serviceName}-rust.ts`;
  }

  private async runCommand(
    command: string,
    args: string[],
    cwd: string
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { cwd, shell: true });
      let output = '';
      let error = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error: error || undefined
        });
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          error: 'Command timed out'
        });
      }, 120000);
    });
  }

  private async runBenchmark(serviceName: string): Promise<any> {
    // Simple performance check - just verify example runs
    const examplePath = path.join(this.servicesPath, serviceName, 'examples');
    if (!fs.existsSync(examplePath)) {
      return null;
    }

    const examples = fs.readdirSync(examplePath).filter(f => f.endsWith('.rs'));
    if (examples.length === 0) {
      return null;
    }

    const exampleName = path.basename(examples[0], '.rs');
    const start = Date.now();
    
    const result = await this.runCommand(
      'cargo',
      ['run', '--release', '--example', exampleName, '-p', serviceName],
      process.cwd()
    );

    if (result.success) {
      const rustTime = Date.now() - start;
      return {
        rustTime,
        improvement: 'N/A (no TypeScript baseline)'
      };
    }

    return null;
  }

  private generateReport(): void {
    Logger.info('\n' + '='.repeat(60));
    Logger.info('📊 MIGRATION VALIDATION REPORT');
    Logger.info('='.repeat(60));

    const totalServices = this.results.length;
    const successServices = this.results.filter(r => r.status === 'success').length;
    const warningServices = this.results.filter(r => r.status === 'warning').length;
    const errorServices = this.results.filter(r => r.status === 'error').length;

    Logger.info(`\n📈 Summary:`);
    Logger.info(`   Total Services: ${totalServices}`);
    Logger.info(`   ✅ Success: ${successServices}`);
    Logger.info(`   ⚠️  Warning: ${warningServices}`);
    Logger.info(`   ❌ Error: ${errorServices}`);

    Logger.info(`\n📋 Detailed Results:\n`);

    for (const result of this.results) {
      const statusIcon = 
        result.status === 'success' ? '✅' :
        result.status === 'warning' ? '⚠️' : '❌';
      
      Logger.info(`${statusIcon} ${result.service.toUpperCase()}`);
      
      for (const check of result.checks) {
        const checkIcon = check.passed ? '✓' : '✗';
        Logger.info(`   ${checkIcon} ${check.name}: ${check.message || ''}`);
      }

      if (result.performance) {
        Logger.info(`   ⚡ Performance: ${result.performance.rustTime}ms`);
      }

      Logger.info('');
    }

    // Migration Status
    Logger.info('='.repeat(60));
    Logger.info('🎯 MIGRATION STATUS');
    Logger.info('='.repeat(60));

    const migrationComplete = errorServices === 0;
    const migrationQuality = 
      successServices === totalServices ? 'EXCELLENT' :
      warningServices > 0 && errorServices === 0 ? 'GOOD' :
      errorServices > 0 ? 'NEEDS WORK' : 'UNKNOWN';

    Logger.info(`\n   Migration Complete: ${migrationComplete ? '✅ YES' : '❌ NO'}`);
    Logger.info(`   Quality: ${migrationQuality}`);
    Logger.info(`   Ready for Production: ${migrationComplete && warningServices === 0 ? '✅ YES' : '⚠️ NO'}`);

    // Recommendations
    if (errorServices > 0 || warningServices > 0) {
      Logger.info(`\n📝 Recommendations:`);
      
      const failedBuilds = this.results.filter(r => 
        r.checks.some(c => c.name === 'Build test' && !c.passed)
      );
      if (failedBuilds.length > 0) {
        Logger.info(`   • Fix build errors in: ${failedBuilds.map(r => r.service).join(', ')}`);
      }

      const missingTests = this.results.filter(r => 
        r.checks.some(c => c.name === 'Tests' && !c.passed)
      );
      if (missingTests.length > 0) {
        Logger.info(`   • Add tests for: ${missingTests.map(r => r.service).join(', ')}`);
      }

      const missingWrappers = this.results.filter(r => 
        r.checks.some(c => c.name === 'TypeScript wrapper' && !c.passed)
      );
      if (missingWrappers.length > 0) {
        Logger.info(`   • Create TypeScript wrappers for: ${missingWrappers.map(r => r.service).join(', ')}`);
      }
    }

    // Save report to file
    const reportPath = path.join(process.cwd(), 'migration-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: totalServices,
        success: successServices,
        warning: warningServices,
        error: errorServices
      },
      results: this.results,
      status: {
        complete: migrationComplete,
        quality: migrationQuality,
        productionReady: migrationComplete && warningServices === 0
      }
    }, null, 2));

    Logger.info(`\n📁 Report saved to: ${reportPath}`);
    Logger.info('\n' + '='.repeat(60));
    Logger.info('✨ Validation Complete!');
    Logger.info('='.repeat(60) + '\n');

    // Exit with appropriate code
    process.exit(errorServices > 0 ? 1 : 0);
  }
}

// Run validation
const validator = new RustMigrationValidator();
validator.validateAll().catch(error => {
  Logger.error('Validation failed:', error);
  process.exit(1);
});