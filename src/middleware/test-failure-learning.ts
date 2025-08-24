/**
 * Test Failure Learning Middleware
 * Learns from test failures to improve system reliability
 */

import { Request, Response, NextFunction } from 'express';

export interface TestFailure {
  id: string;
  timestamp: Date;
  testName: string;
  error: string;
  stackTrace?: string;
  context: Record<string, any>;
  resolved: boolean;
}

export interface LearningPattern {
  pattern: string;
  frequency: number;
  commonCauses: string[];
  suggestedFixes: string[];
  confidence: number;
}

class TestFailureLearningService {
  private failures: TestFailure[] = [];
  private patterns: LearningPattern[] = [];
  private readonly maxFailures = 1000;

  /**
   * Record a test failure
   */
  recordFailure(failure: Omit<TestFailure, 'id' | 'timestamp' | 'resolved'>): void {
    const testFailure: TestFailure = {
      id: this.generateId(),
      timestamp: new Date(),
      resolved: false,
      ...failure
    };

    this.failures.push(testFailure);

    // Maintain failure history limit
    if (this.failures.length > this.maxFailures) {
      this.failures.shift();
    }

    this.analyzePatterns();
  }

  /**
   * Mark a failure as resolved
   */
  markResolved(failureId: string, resolution?: string): void {
    const failure = this.failures.find(f => f.id === failureId);
    if (failure) {
      failure.resolved = true;
      if (resolution) {
        failure.context.resolution = resolution;
      }
    }
  }

  /**
   * Get learning insights
   */
  getLearningInsights(): {
    totalFailures: number;
    resolvedFailures: number;
    topPatterns: LearningPattern[];
    recommendations: string[];
  } {
    const resolvedCount = this.failures.filter(f => f.resolved).length;
    const topPatterns = this.patterns
      .sort((a, b) => b.confidence * b.frequency - a.confidence * a.frequency)
      .slice(0, 5);

    const recommendations = this.generateRecommendations();

    return {
      totalFailures: this.failures.length,
      resolvedFailures: resolvedCount,
      topPatterns,
      recommendations
    };
  }

  /**
   * Get failures by pattern
   */
  getFailuresByPattern(pattern: string): TestFailure[] {
    return this.failures.filter(failure =>
      failure.error.toLowerCase().includes(pattern.toLowerCase()) ||
      failure.testName.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private analyzePatterns(): void {
    // Group failures by error patterns
    const errorGroups = this.failures.reduce((acc, failure) => {
      const errorKey = this.extractErrorPattern(failure.error);
      if (!acc[errorKey]) {acc[errorKey] = [];}
      acc[errorKey].push(failure);
      return acc;
    }, {} as Record<string, TestFailure[]>);

    // Create or update patterns
    for (const [pattern, failures] of Object.entries(errorGroups)) {
      if (failures.length >= 2) { // Minimum 2 occurrences
        const existingPattern = this.patterns.find(p => p.pattern === pattern);
        const commonCauses = this.extractCommonCauses(failures);
        const suggestedFixes = this.generateFixes(pattern, failures);
        const confidence = Math.min(0.95, failures.length * 0.1 + 0.3);

        if (existingPattern) {
          existingPattern.frequency = failures.length;
          existingPattern.commonCauses = commonCauses;
          existingPattern.suggestedFixes = suggestedFixes;
          existingPattern.confidence = confidence;
        } else {
          this.patterns.push({
            pattern,
            frequency: failures.length,
            commonCauses,
            suggestedFixes,
            confidence
          });
        }
      }
    }

    // Keep only top patterns
    this.patterns = this.patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  }

  private extractErrorPattern(error: string): string {
    // Extract common error patterns
    if (error.includes('TypeError')) {return 'TypeError';}
    if (error.includes('ReferenceError')) {return 'ReferenceError';}
    if (error.includes('Cannot find module')) {return 'Missing Module';}
    if (error.includes('Property') && error.includes('does not exist')) {return 'Property Access Error';}
    if (error.includes('timeout')) {return 'Timeout Error';}
    if (error.includes('network')) {return 'Network Error';}
    
    // Extract first significant part of error
    const firstLine = error.split('\n')[0];
    return firstLine.substring(0, 50).trim();
  }

  private extractCommonCauses(failures: TestFailure[]): string[] {
    const causes = new Set<string>();
    
    for (const failure of failures) {
      if (failure.error.includes('undefined')) {causes.add('Undefined variable or property');}
      if (failure.error.includes('null')) {causes.add('Null reference');}
      if (failure.error.includes('async') || failure.error.includes('await')) {causes.add('Async/await issue');}
      if (failure.error.includes('import') || failure.error.includes('require')) {causes.add('Module import issue');}
      if (failure.error.includes('type')) {causes.add('Type mismatch');}
    }

    return Array.from(causes);
  }

  private generateFixes(pattern: string, failures: TestFailure[]): string[] {
    const fixes: string[] = [];

    if (pattern.includes('TypeError')) {
      fixes.push('Add proper type checking');
      fixes.push('Validate input parameters');
    }

    if (pattern.includes('Missing Module')) {
      fixes.push('Install missing dependencies');
      fixes.push('Check import paths');
    }

    if (pattern.includes('Property Access Error')) {
      fixes.push('Add optional chaining (?.)', 'Check object structure');
    }

    if (pattern.includes('Timeout')) {
      fixes.push('Increase timeout values');
      fixes.push('Optimize async operations');
    }

    // Generic fixes based on resolved failures
    const resolvedFailures = failures.filter(f => f.resolved && f.context.resolution);
    for (const failure of resolvedFailures) {
      if (failure.context.resolution) {
        fixes.push(failure.context.resolution);
      }
    }

    return [...new Set(fixes)]; // Remove duplicates
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const unresolvedCount = this.failures.filter(f => !f.resolved).length;
    
    if (unresolvedCount > 5) {
      recommendations.push(`Focus on resolving ${unresolvedCount} unresolved test failures`);
    }

    const highFrequencyPatterns = this.patterns.filter(p => p.frequency > 3);
    if (highFrequencyPatterns.length > 0) {
      recommendations.push(`Address recurring patterns: ${highFrequencyPatterns.map(p => p.pattern).join(', ')}`);
    }

    if (this.failures.length > 50) {
      recommendations.push('Consider implementing more robust error handling');
    }

    return recommendations;
  }

  private generateId(): string {
    return `tf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

const testFailureLearningService = new TestFailureLearningService();

/**
 * Test Failure Learning Middleware
 */
export const testFailureLearning = (req: Request, res: Response, next: NextFunction): void => {
  // Add failure recording capability to request object
  (req as any).recordTestFailure = (failure: Omit<TestFailure, 'id' | 'timestamp' | 'resolved'>) => {
    testFailureLearningService.recordFailure(failure);
  };

  // Add learning insights to request object
  (req as any).getTestLearningInsights = () => {
    return testFailureLearningService.getLearningInsights();
  };

  next();
};

// Export middleware with multiple names for compatibility
export const testFailureLearningMiddleware = testFailureLearning;
export { testFailureLearningService };