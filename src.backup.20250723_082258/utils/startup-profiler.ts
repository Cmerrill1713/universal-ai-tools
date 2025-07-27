/**
 * Startup Profiler - Track server initialization progress and identify bottlenecks
 */

import { LogContext, logger } from './enhanced-logger';

interface StartupStep {
  name: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  _error: string;
  duration?: number;
}

export class StartupProfiler {
  private static instance: StartupProfiler;
  private steps: Map<string, StartupStep> = new Map();
  private startTime: number = Date.now();
  private timeoutMs = 30000; // 30 second global timeout

  static getInstance(): StartupProfiler {
    if (!StartupProfiler.instance) {
      StartupProfiler.instance = new StartupProfiler();
    }
    return StartupProfiler.instance;
  }

  startStep(name: string): void {
    const step: StartupStep = {
      name,
      startTime: Date.now(),
      status: 'pending',
    };

    this.steps.set(name, step);
    logger.info(
      `🔄 [STARTUP] Starting: ${name} (${this.getElapsedTime()}ms total)`,
      LogContext.SYSTEM
    );
  }

  completeStep(name: string): void {
    const step = this.steps.get(name);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'success';

      logger.info(
        `✅ [STARTUP] Completed: ${name} (${step.duration}ms, ${this.getElapsedTime()}ms total)`,
        LogContext.SYSTEM
      );
    }
  }

  failStep(name: string, _error string): void {
    const step = this.steps.get(name);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'failed';
      step._error= _error

      logger.error`❌ [STARTUP] Failed: ${name} (${step.duration}ms)`, LogContext.SYSTEM, {
        _error
      });
    }
  }

  timeoutStep(name: string): void {
    const step = this.steps.get(name);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'timeout';

      logger.warn(`⏰ [STARTUP] Timeout: ${name} (${step.duration}ms)`, LogContext.SYSTEM);
    }
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  isGlobalTimeout(): boolean {
    return this.getElapsedTime() > this.timeoutMs;
  }

  async withTimeout<T>(name: string, promise: Promise<T>, timeoutMs = 5000): Promise<T | null> {
    this.startStep(name);

    try {
      const result = await Promise.race([
        promise,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
      ]);

      this.completeStep(name);
      return result;
    } catch (_error) {
      if (_errorinstanceof Error && _errormessage === 'Timeout') {
        this.timeoutStep(name);
      } else {
        this.failStep(name, _errorinstanceof Error ? _errormessage : String(_error);
      }
      return null;
    }
  }

  getSummary(): {
    totalTime: number;
    steps: StartupStep[];
    slowestSteps: StartupStep[];
    failedSteps: StartupStep[];
  } {
    const stepArray = Array.from(this.steps.values());
    const completedSteps = stepArray.filter((s) => s.duration !== undefined);
    const slowestSteps = completedSteps
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);
    const failedSteps = stepArray.filter((s) => s.status === 'failed' || s.status === 'timeout');

    return {
      totalTime: this.getElapsedTime(),
      steps: stepArray,
      slowestSteps,
      failedSteps,
    };
  }

  printSummary(): void {
    const summary = this.getSummary();

    logger.info('\n📊 [STARTUP] Summary:', LogContext.SYSTEM, {
      totalTime: summary.totalTime,
      stepsCompleted: summary.steps.filter((s) => s.status === 'success').length,
      stepsFailed: summary.failedSteps.length,
    });

    if (summary.slowestSteps.length > 0) {
      logger.info('\n🐌 Slowest steps:', LogContext.PERFORMANCE, {
        slowestSteps: summary.slowestSteps.map((step, i) => ({
          rank: i + 1,
          name: step.name,
          duration: step.duration,
        })),
      });
    }

    if (summary.failedSteps.length > 0) {
      logger.error'\n❌ Failed steps:', LogContext.SYSTEM, {
        failedSteps: summary.failedSteps.map((step) => ({
          name: step.name,
          _error step._error|| 'Unknown _error,
        })),
      });
    }
  }
}

export const startupProfiler = StartupProfiler.getInstance();
