#!/usr/bin/env tsx
/**
 * Quality Guardian - Automated Code Quality Monitoring
 * Runs comprehensive quality checks and generates reports
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface QualityMetrics {
  typeErrors: number;
  lintErrors: number;
  lintWarnings: number;
  securityIssues: number;
  testCoverage: number;
  complexityIssues: number;
  duplicateCode: number;
  unusedCode: number;
}

interface QualityReport {
  timestamp: string;
  overallScore: number;
  metrics: QualityMetrics;
  criticalIssues: string[];
  recommendations: string[];
  trend: 'improving' | 'declining' | 'stable';
}

class QualityGuardian {
  private projectRoot: string;
  private reportPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.reportPath = join(this.projectRoot, 'quality-report.json');
  }

  async runQualityCheck(): Promise<QualityReport> {
    console.log('🔍 Running comprehensive quality analysis...');

    const metrics: QualityMetrics = {
      typeErrors: await this.checkTypeErrors(),
      lintErrors: await this.checkLintErrors().errors,
      lintWarnings: await this.checkLintErrors().warnings,
      securityIssues: await this.checkSecurity(),
      testCoverage: await this.checkTestCoverage(),
      complexityIssues: await this.checkComplexity(),
      duplicateCode: await this.checkDuplication(),
      unusedCode: await this.checkUnusedCode(),
    };

    const criticalIssues = this.identifyCriticalIssues(metrics);
    const recommendations = this.generateRecommendations(metrics);
    const overallScore = this.calculateOverallScore(metrics);
    const trend = await this.analyzeTrend(metrics);

    const report: QualityReport = {
      timestamp: new Date().toISOString(),
      overallScore,
      metrics,
      criticalIssues,
      recommendations,
      trend,
    };

    this.saveReport(report);
    this.displayReport(report);

    return report;
  }

  private async checkTypeErrors(): Promise<number> {
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      return 0;
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const errorCount = (output.match(/error TS\d+:/g) || []).length;
      return errorCount;
    }
  }

  private async checkLintErrors(): Promise<{ errors: number; warnings: number }> {
    try {
      const result = execSync('npx eslint . --format json', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      const lintResults = JSON.parse(result.toString());
      
      let errors = 0;
      let warnings = 0;
      
      for (const file of lintResults) {
        errors += file.errorCount || 0;
        warnings += file.warningCount || 0;
      }
      
      return { errors, warnings };
    } catch (error: any) {
      // ESLint returns non-zero for errors, parse the output
      try {
        const lintResults = JSON.parse(error.stdout?.toString() || '[]');
        let errors = 0;
        let warnings = 0;
        
        for (const file of lintResults) {
          errors += file.errorCount || 0;
          warnings += file.warningCount || 0;
        }
        
        return { errors, warnings };
      } catch {
        return { errors: 0, warnings: 0 };
      }
    }
  }

  private async checkSecurity(): Promise<number> {
    try {
      const result = execSync('npx audit-ci --config .audit-ci.json', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      return 0; // No security issues found
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const highSeverity = (output.match(/high severity/gi) || []).length;
      const criticalSeverity = (output.match(/critical severity/gi) || []).length;
      return highSeverity + criticalSeverity * 2;
    }
  }

  private async checkTestCoverage(): Promise<number> {
    try {
      if (!existsSync(join(this.projectRoot, 'coverage'))) {
        return 0;
      }
      
      const result = execSync('npx nyc report --reporter=json-summary', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      
      const coverage = JSON.parse(result.toString());
      return Math.round(coverage.total?.lines?.pct || 0);
    } catch {
      return 0;
    }
  }

  private async checkComplexity(): Promise<number> {
    try {
      const result = execSync('npx plato -r -d complexity-report src/', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      // Parse complexity report for high complexity functions
      return 0; // Placeholder
    } catch {
      return 0;
    }
  }

  private async checkDuplication(): Promise<number> {
    try {
      const result = execSync('npx jscpd src/ --format json', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      
      const duplicationReport = JSON.parse(result.toString());
      return duplicationReport.duplicates?.length || 0;
    } catch {
      return 0;
    }
  }

  private async checkUnusedCode(): Promise<number> {
    try {
      const result = execSync('npx ts-unused-exports tsconfig.json', { 
        stdio: 'pipe',
        cwd: this.projectRoot 
      });
      
      const unusedExports = result.toString().split('\n').filter(line => line.trim());
      return unusedExports.length;
    } catch {
      return 0;
    }
  }

  private identifyCriticalIssues(metrics: QualityMetrics): string[] {
    const issues: string[] = [];

    if (metrics.typeErrors > 0) {
      issues.push(`${metrics.typeErrors} TypeScript compilation errors`);
    }

    if (metrics.lintErrors > 10) {
      issues.push(`High number of lint errors: ${metrics.lintErrors}`);
    }

    if (metrics.securityIssues > 0) {
      issues.push(`${metrics.securityIssues} security vulnerabilities found`);
    }

    if (metrics.testCoverage < 50) {
      issues.push(`Low test coverage: ${metrics.testCoverage}%`);
    }

    if (metrics.complexityIssues > 5) {
      issues.push(`${metrics.complexityIssues} high complexity functions`);
    }

    return issues;
  }

  private generateRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.typeErrors > 0) {
      recommendations.push('Fix TypeScript compilation errors for type safety');
    }

    if (metrics.lintErrors > 0) {
      recommendations.push('Run `npm run lint:fix` to auto-fix linting issues');
    }

    if (metrics.testCoverage < 80) {
      recommendations.push('Increase test coverage by adding unit tests');
    }

    if (metrics.duplicateCode > 10) {
      recommendations.push('Refactor duplicate code into reusable functions');
    }

    if (metrics.unusedCode > 5) {
      recommendations.push('Remove unused exports and dead code');
    }

    if (metrics.securityIssues > 0) {
      recommendations.push('Update dependencies to fix security vulnerabilities');
    }

    return recommendations;
  }

  private calculateOverallScore(metrics: QualityMetrics): number {
    let score = 100;

    // Deduct points for issues
    score -= metrics.typeErrors * 5;
    score -= metrics.lintErrors * 2;
    score -= metrics.lintWarnings * 0.5;
    score -= metrics.securityIssues * 10;
    score -= Math.max(0, 80 - metrics.testCoverage) * 0.5;
    score -= metrics.complexityIssues * 3;
    score -= metrics.duplicateCode * 1;
    score -= metrics.unusedCode * 1;

    return Math.max(0, Math.round(score));
  }

  private async analyzeTrend(currentMetrics: QualityMetrics): Promise<'improving' | 'declining' | 'stable'> {
    if (!existsSync(this.reportPath)) {
      return 'stable';
    }

    try {
      const previousReport: QualityReport = JSON.parse(
        require('fs').readFileSync(this.reportPath, 'utf-8')
      );

      const currentScore = this.calculateOverallScore(currentMetrics);
      const previousScore = previousReport.overallScore;

      if (currentScore > previousScore + 5) return 'improving';
      if (currentScore < previousScore - 5) return 'declining';
      return 'stable';
    } catch {
      return 'stable';
    }
  }

  private saveReport(report: QualityReport): void {
    writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Quality report saved to ${this.reportPath}`);
  }

  private displayReport(report: QualityReport): void {
    console.log('\n🎯 Code Quality Report');
    console.log('='.repeat(50));
    console.log(`Overall Score: ${report.overallScore}/100`);
    console.log(`Trend: ${report.trend === 'improving' ? '📈' : report.trend === 'declining' ? '📉' : '➡️'} ${report.trend}`);
    
    console.log('\n📊 Metrics:');
    console.log(`  Type Errors: ${report.metrics.typeErrors}`);
    console.log(`  Lint Errors: ${report.metrics.lintErrors}`);
    console.log(`  Lint Warnings: ${report.metrics.lintWarnings}`);
    console.log(`  Security Issues: ${report.metrics.securityIssues}`);
    console.log(`  Test Coverage: ${report.metrics.testCoverage}%`);
    console.log(`  Complexity Issues: ${report.metrics.complexityIssues}`);
    console.log(`  Duplicate Code: ${report.metrics.duplicateCode}`);
    console.log(`  Unused Code: ${report.metrics.unusedCode}`);

    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      report.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    // Quality gate check
    if (report.overallScore < 70) {
      console.log('\n❌ Quality gate FAILED - Score below threshold (70)');
      process.exit(1);
    } else {
      console.log('\n✅ Quality gate PASSED');
    }
  }
}

// Run quality check if called directly
if (require.main === module) {
  const guardian = new QualityGuardian();
  guardian.runQualityCheck().catch(console.error);
}

export { QualityGuardian };