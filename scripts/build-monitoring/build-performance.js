#!/usr/bin/env node

/**
 * Build Performance Monitoring Script
 * Tracks and analyzes build times, identifies bottlenecks, and suggests optimizations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildPerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      totalBuildTime: 0,
      npmInstallTime: 0,
      typescriptCompileTime: 0,
      dockerBuildTime: 0,
      testRunTime: 0,
      bundleSize: 0,
      dependencies: 0,
      devDependencies: 0,
      warnings: [],
      errors: [],
    };
    this.phases = [];
  }

  startPhase(name) {
    console.log(`\n📊 Starting phase: ${name}`);
    this.currentPhase = {
      name,
      startTime: Date.now(),
    };
  }

  endPhase() {
    if (this.currentPhase) {
      const duration = Date.now() - this.currentPhase.startTime;
      this.phases.push({
        ...this.currentPhase,
        duration,
        endTime: Date.now(),
      });
      console.log(`✅ Phase completed: ${this.currentPhase.name} (${duration}ms)`);
      this.currentPhase = null;
    }
  }

  async measureNpmInstall() {
    this.startPhase('npm install');
    try {
      const start = Date.now();
      execSync('npm ci', { stdio: 'inherit' });
      this.metrics.npmInstallTime = Date.now() - start;
    } catch (error) {
      this.metrics.errors.push(`npm install failed: ${error.message}`);
    }
    this.endPhase();
  }

  async measureTypeScriptCompile() {
    this.startPhase('TypeScript compilation');
    try {
      const start = Date.now();
      execSync('npm run type-check', { stdio: 'inherit' });
      this.metrics.typescriptCompileTime = Date.now() - start;
    } catch (error) {
      this.metrics.warnings.push(`TypeScript compilation failed: ${error.message}`);
    }
    this.endPhase();
  }

  async measureTests() {
    this.startPhase('test execution');
    try {
      const start = Date.now();
      execSync('npm run test:coverage', { stdio: 'inherit' });
      this.metrics.testRunTime = Date.now() - start;
    } catch (error) {
      this.metrics.warnings.push(`Tests failed: ${error.message}`);
    }
    this.endPhase();
  }

  analyzeDependencies() {
    this.startPhase('dependency analysis');
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      this.metrics.dependencies = Object.keys(packageJson.dependencies || {}).length;
      this.metrics.devDependencies = Object.keys(packageJson.devDependencies || {}).length;

      console.log(`📦 Dependencies: ${this.metrics.dependencies}`);
      console.log(`🔧 Dev Dependencies: ${this.metrics.devDependencies}`);

      // Analyze for heavy dependencies
      const heavyDeps = Object.entries(packageJson.dependencies || {})
        .filter(([name]) => ['typescript', 'webpack', 'babel'].some((tool) => name.includes(tool)))
        .map(([name]) => name);

      if (heavyDeps.length > 0) {
        this.metrics.warnings.push(`Heavy build dependencies detected: ${heavyDeps.join(', ')}`);
      }
    } catch (error) {
      this.metrics.errors.push(`Dependency analysis failed: ${error.message}`);
    }
    this.endPhase();
  }

  async runFullBuildAnalysis() {
    console.log('🚀 **BUILD PERFORMANCE ANALYSIS STARTED**');
    console.log('='.repeat(50));

    await this.measureNpmInstall();
    this.analyzeDependencies();
    await this.measureTypeScriptCompile();
    await this.measureTests();

    this.generateReport();
  }

  generateReport() {
    this.metrics.totalBuildTime = Date.now() - this.startTime;

    console.log('\n📊 **BUILD PERFORMANCE REPORT**');
    console.log('='.repeat(50));
    console.log(`⏱️  Total build time: ${this.metrics.totalBuildTime}ms`);
    console.log(`📦 npm install: ${this.metrics.npmInstallTime}ms`);
    console.log(`🔧 TypeScript: ${this.metrics.typescriptCompileTime}ms`);
    console.log(`🧪 Tests: ${this.metrics.testRunTime}ms`);
    console.log(`📦 Dependencies: ${this.metrics.dependencies}`);
    console.log(`🔧 Dev Dependencies: ${this.metrics.devDependencies}`);

    console.log('\n📈 **PHASE BREAKDOWN**');
    this.phases.forEach((phase) => {
      const percentage = ((phase.duration / this.metrics.totalBuildTime) * 100).toFixed(1);
      console.log(`  ${phase.name}: ${phase.duration}ms (${percentage}%)`);
    });

    if (this.metrics.warnings.length > 0) {
      console.log('\n⚠️  **WARNINGS**');
      this.metrics.warnings.forEach((warning) => console.log(`  • ${warning}`));
    }

    if (this.metrics.errors.length > 0) {
      console.log('\n❌ **ERRORS**');
      this.metrics.errors.forEach((error) => console.log(`  • ${error}`));
    }

    // Performance recommendations
    console.log('\n💡 **PERFORMANCE RECOMMENDATIONS**');

    if (this.metrics.npmInstallTime > 30000) {
      console.log('  • Consider using npm cache or switching to yarn for faster installs');
    }

    if (this.metrics.typescriptCompileTime > 10000) {
      console.log('  • Consider enabling incremental compilation with tsconfig incremental option');
    }

    if (this.metrics.testRunTime > 60000) {
      console.log('  • Consider running tests in parallel or using test caching');
    }

    if (this.metrics.dependencies > 50) {
      console.log('  • Consider dependency analysis to reduce bundle size');
    }

    // Save report to file
    const reportPath = path.join(process.cwd(), 'build-performance-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          metrics: this.metrics,
          phases: this.phases,
          recommendations: this.generateRecommendations(),
        },
        null,
        2
      )
    );

    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.metrics.totalBuildTime > 120000) {
      recommendations.push('Consider implementing build caching and parallel processing');
    }

    if (this.metrics.npmInstallTime > this.metrics.totalBuildTime * 0.3) {
      recommendations.push('Optimize dependency installation - consider using npm ci with caching');
    }

    if (this.metrics.testRunTime > this.metrics.totalBuildTime * 0.5) {
      recommendations.push(
        'Test suite is taking too long - consider test parallelization or selective test runs'
      );
    }

    return recommendations;
  }
}

// Run the analysis if this script is executed directly
if (require.main === module) {
  const monitor = new BuildPerformanceMonitor();
  monitor.runFullBuildAnalysis().catch((error) => {
    console.error('❌ Build performance analysis failed:', error);
    process.exit(1);
  });
}

module.exports = BuildPerformanceMonitor;
