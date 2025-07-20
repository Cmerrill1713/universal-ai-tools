/**
 * Startup Profiler - Track server initialization progress and identify bottlenecks
 */

interface StartupStep {
  name: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  error?: string;
  duration?: number;
}

export class StartupProfiler {
  private static instance: StartupProfiler;
  private steps: Map<string, StartupStep> = new Map();
  private startTime: number = Date.now();
  private timeoutMs: number = 30000; // 30 second global timeout

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
      status: 'pending'
    };
    
    this.steps.set(name, step);
    console.log(`🔄 [STARTUP] Starting: ${name} (${this.getElapsedTime()}ms total)`);
  }

  completeStep(name: string): void {
    const step = this.steps.get(name);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'success';
      
      console.log(`✅ [STARTUP] Completed: ${name} (${step.duration}ms, ${this.getElapsedTime()}ms total)`);
    }
  }

  failStep(name: string, error: string): void {
    const step = this.steps.get(name);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'failed';
      step.error = error;
      
      console.log(`❌ [STARTUP] Failed: ${name} (${step.duration}ms, error: ${error})`);
    }
  }

  timeoutStep(name: string): void {
    const step = this.steps.get(name);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'timeout';
      
      console.log(`⏰ [STARTUP] Timeout: ${name} (${step.duration}ms)`);
    }
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  isGlobalTimeout(): boolean {
    return this.getElapsedTime() > this.timeoutMs;
  }

  async withTimeout<T>(name: string, promise: Promise<T>, timeoutMs: number = 5000): Promise<T | null> {
    this.startStep(name);
    
    try {
      const result = await Promise.race([
        promise,
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        )
      ]);
      
      this.completeStep(name);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'Timeout') {
        this.timeoutStep(name);
      } else {
        this.failStep(name, error instanceof Error ? error.message : String(error));
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
    const completedSteps = stepArray.filter(s => s.duration !== undefined);
    const slowestSteps = completedSteps
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);
    const failedSteps = stepArray.filter(s => s.status === 'failed' || s.status === 'timeout');

    return {
      totalTime: this.getElapsedTime(),
      steps: stepArray,
      slowestSteps,
      failedSteps
    };
  }

  printSummary(): void {
    const summary = this.getSummary();
    
    console.log('\n📊 [STARTUP] Summary:');
    console.log(`   Total time: ${summary.totalTime}ms`);
    console.log(`   Steps completed: ${summary.steps.filter(s => s.status === 'success').length}`);
    console.log(`   Steps failed: ${summary.failedSteps.length}`);
    
    if (summary.slowestSteps.length > 0) {
      console.log('\n🐌 Slowest steps:');
      summary.slowestSteps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step.name}: ${step.duration}ms`);
      });
    }
    
    if (summary.failedSteps.length > 0) {
      console.log('\n❌ Failed steps:');
      summary.failedSteps.forEach(step => {
        console.log(`   - ${step.name}: ${step.error || 'Unknown error'}`);
      });
    }
  }
}

export const startupProfiler = StartupProfiler.getInstance();