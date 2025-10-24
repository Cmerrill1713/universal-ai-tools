#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

interface BuildTestResult {
  command: string;
  duration: number;
  success: boolean;
  errorCount?: number;
  warningCount?: number;
  outputSize?: number;
}

class BuildPerformanceTester {
  private results: BuildTestResult[] = [];

  private async runBuildCommand(command: string, description: string): Promise<BuildTestResult> {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   Command: ${command}`);
    
    const startTime = performance.now();
    let success = false;
    let output = '';
    let errorCount = 0;
    let warningCount = 0;
    let outputSize = 0;

    try {
      output = execSync(command, { 
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000 // 2 minutes max
      });
      success = true;
      console.log(`   ✅ Success`);
    } catch (error: any) {
      output = error.stdout || error.stderr || error.message;
      console.log(`   ❌ Failed`);
      
      // Count errors and warnings
      errorCount = (output.match(/error/gi) || []).length;
      warningCount = (output.match(/warning/gi) || []).length;
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    // Check output size if dist folder exists
    try {
      if (fs.existsSync('dist')) {
        const distFiles = fs.readdirSync('dist', { recursive: true });
        outputSize = distFiles.length;
      }
    } catch (e) {
      // Ignore errors
    }

    console.log(`   ⏱️  Duration: ${duration}ms`);
    if (errorCount > 0) console.log(`   🚫 Errors: ${errorCount}`);
    if (warningCount > 0) console.log(`   ⚠️  Warnings: ${warningCount}`);
    if (outputSize > 0) console.log(`   📦 Output files: ${outputSize}`);

    const result: BuildTestResult = {
      command,
      duration,
      success,
      errorCount,
      warningCount,
      outputSize
    };

    this.results.push(result);
    return result;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private async runTests() {
    console.log('🚀 Build Performance Test Suite');
    console.log('===============================\n');

    // Clean before starting
    await this.runBuildCommand('npm run clean:cache', 'Clean cache and build artifacts');

    // Test different build approaches
    await this.runBuildCommand('npm run type-check:fast', 'Fast TypeScript type checking');
    await this.runBuildCommand('npm run validate:dev', 'Development validation');
    
    // Test parallel build if available
    try {
      await this.runBuildCommand('npm run build:parallel', 'Parallel build (Go + TypeScript + Rust)');
    } catch (e) {
      console.log('   ⚠️  Parallel build not available, testing individual builds');
      
      await this.runBuildCommand('npm run build:ts:incremental', 'Incremental TypeScript build');
      await this.runBuildCommand('npm run build:go', 'Go services build');
      
      // Test Rust build (may fail but we want to measure it)
      await this.runBuildCommand('npm run build:rust', 'Rust services build');
    }

    // Test development server startup time
    console.log('\n📊 Performance Analysis');
    console.log('======================');

    const fastestBuild = this.results
      .filter(r => r.success)
      .reduce((prev, current) => prev.duration < current.duration ? prev : current);

    const slowestBuild = this.results
      .reduce((prev, current) => prev.duration > current.duration ? prev : current);

    console.log(`\n⚡ Fastest successful build: ${this.formatDuration(fastestBuild.duration)} (${fastestBuild.command})`);
    console.log(`🐌 Slowest build: ${this.formatDuration(slowestBuild.duration)} (${slowestBuild.command})`);

    // Calculate improvement recommendations
    const successfulBuilds = this.results.filter(r => r.success);
    const averageBuildTime = successfulBuilds.reduce((sum, r) => sum + r.duration, 0) / successfulBuilds.length;
    
    console.log(`📈 Average successful build time: ${this.formatDuration(averageBuildTime)}`);
    console.log(`🎯 Success rate: ${successfulBuilds.length}/${this.results.length} (${Math.round(successfulBuilds.length / this.results.length * 100)}%)`);

    // Save detailed results
    const reportPath = path.join(process.cwd(), 'reports', `build-performance-${Date.now()}.json`);
    
    try {
      if (!fs.existsSync(path.dirname(reportPath))) {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      }
      
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: this.results.length,
          successfulBuilds: successfulBuilds.length,
          averageBuildTime: Math.round(averageBuildTime),
          fastestBuild: fastestBuild.duration,
          slowestBuild: slowestBuild.duration,
          successRate: Math.round(successfulBuilds.length / this.results.length * 100)
        },
        results: this.results,
        recommendations: this.generateRecommendations()
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📋 Detailed report saved: ${reportPath}`);
    } catch (e) {
      console.log(`\n⚠️  Could not save report: ${e}`);
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedBuilds = this.results.filter(r => !r.success);
    const slowBuilds = this.results.filter(r => r.duration > 30000); // > 30 seconds

    if (failedBuilds.length > 0) {
      recommendations.push('Fix failing builds to improve development velocity');
      
      const highErrorBuilds = failedBuilds.filter(r => (r.errorCount || 0) > 50);
      if (highErrorBuilds.length > 0) {
        recommendations.push('Address TypeScript errors - consider stricter tsconfig for development');
      }
    }

    if (slowBuilds.length > 0) {
      recommendations.push('Consider caching strategies for builds taking >30 seconds');
    }

    const successfulBuilds = this.results.filter(r => r.success);
    if (successfulBuilds.length > 0) {
      const avgDuration = successfulBuilds.reduce((sum, r) => sum + r.duration, 0) / successfulBuilds.length;
      if (avgDuration > 15000) {
        recommendations.push('Enable incremental builds and build caching');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Build performance looks good! Consider running benchmarks regularly.');
    }

    return recommendations;
  }

  async run() {
    try {
      await this.runTests();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run the performance test
const tester = new BuildPerformanceTester();
tester.run();