import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

interface SystemProblem {
  id: string;
  type: 'critical' | 'warning' | 'info';
  service: string;
  issue: string;
  description: string;
  failureCount: number;
  firstDetected: Date;
  lastAttempted: Date;
  autoHealAttempts: number;
  requiresHumanIntervention: boolean;
  suggestedFix?: string;
  errorDetails?: any;
  canAssistantHelp: boolean;
  assistantPrompt?: string;
}

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Map<string, ServiceStatus>;
  problems: SystemProblem[];
  recommendations: string[];
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  uptime?: number;
  errorRate?: number;
  responseTime?: number;
}

export class ProblemSurfacingService extends EventEmitter {
  private problems: Map<string, SystemProblem> = new Map();
  private healthStatus: HealthStatus;
  private alertFile = '/tmp/uat-autoheal/current-problems.json';
  private maxAutoHealAttempts = 3;

  constructor() {
    super();
    this.healthStatus = {
      overall: 'healthy',
      services: new Map(),
      problems: [],
      recommendations: []
    };
    
    // Start monitoring
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor auto-heal logs
    setInterval(() => this.checkAutoHealLogs(), 10000);
    
    // Monitor service health
    setInterval(() => this.checkServiceHealth(), 30000);
    
    // Update problem status
    setInterval(() => this.updateProblemStatus(), 15000);
  }

  private async checkAutoHealLogs(): Promise<void> {
    try {
      // Check for repeated failures in monitor log
      const logPath = '/tmp/uat-autoheal/monitor.log';
      if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf-8');
        const lines = logs.split('\n').slice(-100); // Last 100 lines
        
        // Detect patterns
        this.detectProblems(lines);
      }
    } catch (error) {
      console.error('Error checking auto-heal logs:', error);
    }
  }

  private detectProblems(logLines: string[]): void {
    // Pattern: Go API Gateway repeatedly failing
    const apiGatewayFailures = logLines.filter(line => 
      line.includes('Go API Gateway unhealthy')
    ).length;
    
    if (apiGatewayFailures >= 3) {
      this.addProblem({
        id: 'api-gateway-health-check-404',
        type: 'critical',
        service: 'go-api-gateway',
        issue: 'Health endpoint returning 404',
        description: 'The /api/health endpoint is not found. The route may not be configured correctly.',
        failureCount: apiGatewayFailures,
        firstDetected: new Date(),
        lastAttempted: new Date(),
        autoHealAttempts: apiGatewayFailures,
        requiresHumanIntervention: true,
        suggestedFix: 'Add health check route to Go API Gateway at /api/health',
        canAssistantHelp: true,
        assistantPrompt: 'I need help fixing the Go API Gateway health endpoint. It\'s returning 404. Can you help me add the /api/health route?'
      });
    }

    // Pattern: Service not starting
    const rustAiCoreDown = logLines.filter(line => 
      line.includes('Port 8083: DOWN')
    ).length;
    
    if (rustAiCoreDown >= 5) {
      this.addProblem({
        id: 'rust-ai-core-not-starting',
        type: 'warning',
        service: 'rust-ai-core',
        issue: 'Service not starting',
        description: 'Rust AI Core service is not running on port 8083.',
        failureCount: rustAiCoreDown,
        firstDetected: new Date(),
        lastAttempted: new Date(),
        autoHealAttempts: 0,
        requiresHumanIntervention: true,
        suggestedFix: 'Check if rust-ai-core is built and has correct dependencies',
        canAssistantHelp: true,
        assistantPrompt: 'The Rust AI Core service isn\'t starting. Can you help me check the build configuration and start it?'
      });
    }

    // Pattern: Memory issues
    const memoryWarnings = logLines.filter(line => 
      line.includes('High memory usage')
    ).length;
    
    if (memoryWarnings >= 2) {
      this.addProblem({
        id: 'high-memory-usage',
        type: 'warning',
        service: 'system',
        issue: 'High memory usage detected',
        description: 'System memory usage is above threshold.',
        failureCount: memoryWarnings,
        firstDetected: new Date(),
        lastAttempted: new Date(),
        autoHealAttempts: memoryWarnings,
        requiresHumanIntervention: false,
        suggestedFix: 'Run memory optimization or restart services',
        canAssistantHelp: true,
        assistantPrompt: 'System memory is running high. Should I optimize memory usage or restart some services?'
      });
    }
  }

  private addProblem(problem: SystemProblem): void {
    const existing = this.problems.get(problem.id);
    
    if (existing) {
      // Update existing problem
      existing.failureCount = problem.failureCount;
      existing.lastAttempted = new Date();
      existing.autoHealAttempts++;
      
      // Escalate if exceeded max attempts
      if (existing.autoHealAttempts >= this.maxAutoHealAttempts) {
        existing.requiresHumanIntervention = true;
        existing.type = 'critical';
        
        // Emit event for frontend
        this.emit('critical-problem', existing);
      }
    } else {
      // Add new problem
      this.problems.set(problem.id, problem);
      this.emit('new-problem', problem);
    }
    
    // Update health status
    this.updateHealthStatus();
    
    // Save to file for API access
    this.saveProblemsToDisk();
  }

  private updateHealthStatus(): void {
    const problems = Array.from(this.problems.values());
    
    // Determine overall status
    const criticalCount = problems.filter(p => p.type === 'critical').length;
    const warningCount = problems.filter(p => p.type === 'warning').length;
    
    if (criticalCount > 0) {
      this.healthStatus.overall = 'critical';
    } else if (warningCount > 0) {
      this.healthStatus.overall = 'degraded';
    } else {
      this.healthStatus.overall = 'healthy';
    }
    
    this.healthStatus.problems = problems;
    
    // Generate recommendations
    this.healthStatus.recommendations = this.generateRecommendations(problems);
  }

  private generateRecommendations(problems: SystemProblem[]): string[] {
    const recommendations: string[] = [];
    
    for (const problem of problems) {
      if (problem.requiresHumanIntervention) {
        if (problem.canAssistantHelp) {
          recommendations.push(`🤖 Ask assistant: "${problem.assistantPrompt}"`);
        } else {
          recommendations.push(`👨‍💻 Manual fix required: ${problem.suggestedFix}`);
        }
      } else {
        recommendations.push(`🔧 Auto-healing in progress for ${problem.service}`);
      }
    }
    
    return recommendations;
  }

  private saveProblemsToDisk(): void {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        status: this.healthStatus.overall,
        problems: Array.from(this.problems.values()),
        recommendations: this.healthStatus.recommendations
      };
      
      fs.writeFileSync(this.alertFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving problems to disk:', error);
    }
  }

  private async checkServiceHealth(): Promise<void> {
    const services = [
      { name: 'go-api-gateway', port: 8080, healthUrl: 'http://localhost:8080/api/health' },
      { name: 'rust-llm-router', port: 8082, healthUrl: 'http://localhost:8082/health' },
      { name: 'rust-ai-core', port: 8083, healthUrl: 'http://localhost:8083/health' }
    ];
    
    for (const service of services) {
      const status = await this.checkService(service);
      this.healthStatus.services.set(service.name, status);
    }
  }

  private async checkService(service: any): Promise<ServiceStatus> {
    // Simple port check (in production, would do actual HTTP check)
    const isRunning = await this.isPortOpen(service.port);
    
    return {
      name: service.name,
      status: isRunning ? 'running' : 'stopped',
      lastCheck: new Date()
    };
  }

  private async isPortOpen(port: number): Promise<boolean> {
    // This would check if port is open
    // For now, return mock based on known state
    return port === 8080 || port === 8082;
  }

  private updateProblemStatus(): void {
    // Age out old problems that have been resolved
    for (const [id, problem] of this.problems) {
      const ageMinutes = (Date.now() - problem.lastAttempted.getTime()) / 60000;
      
      // Remove resolved problems after 10 minutes
      if (ageMinutes > 10 && problem.failureCount === 0) {
        this.problems.delete(id);
        this.emit('problem-resolved', problem);
      }
    }
    
    this.updateHealthStatus();
  }

  // Public API for frontend/API access
  public getHealthStatus(): HealthStatus {
    return this.healthStatus;
  }

  public getProblems(): SystemProblem[] {
    return Array.from(this.problems.values());
  }

  public getCriticalProblems(): SystemProblem[] {
    return Array.from(this.problems.values())
      .filter(p => p.type === 'critical');
  }

  public getAssistantTasks(): string[] {
    return Array.from(this.problems.values())
      .filter(p => p.canAssistantHelp)
      .map(p => p.assistantPrompt || p.suggestedFix || '');
  }

  public acknowledgeProblem(problemId: string): void {
    const problem = this.problems.get(problemId);
    if (problem) {
      problem.requiresHumanIntervention = false;
      this.emit('problem-acknowledged', problem);
      this.updateHealthStatus();
    }
  }

  public resolveProblem(problemId: string): void {
    const problem = this.problems.get(problemId);
    if (problem) {
      this.problems.delete(problemId);
      this.emit('problem-resolved', problem);
      this.updateHealthStatus();
    }
  }
}

// Export singleton
export const problemSurfacing = new ProblemSurfacingService();

// Start if run directly
if (require.main === module) {
  console.log('🔍 Problem Surfacing Service started');
  console.log('Monitoring for issues that need human intervention...');
  
  // Log problems to console
  problemSurfacing.on('critical-problem', (problem) => {
    console.error('🚨 CRITICAL PROBLEM DETECTED:');
    console.error(`  Service: ${problem.service}`);
    console.error(`  Issue: ${problem.issue}`);
    console.error(`  Action needed: ${problem.assistantPrompt || problem.suggestedFix}`);
  });
  
  problemSurfacing.on('new-problem', (problem) => {
    console.warn(`⚠️ New problem detected: ${problem.issue}`);
  });
  
  // Periodically show status
  setInterval(() => {
    const status = problemSurfacing.getHealthStatus();
    const tasks = problemSurfacing.getAssistantTasks();
    
    if (tasks.length > 0) {
      console.log('\n📋 Assistant can help with:');
      tasks.forEach(task => console.log(`  • ${task}`));
    }
    
    if (status.overall !== 'healthy') {
      console.log(`\n🔴 System Status: ${status.overall.toUpperCase()}`);
      console.log(`Problems: ${status.problems.length}`);
    }
  }, 60000); // Every minute
}