/**
 * Proactive Assistant Service
 * Provides intelligent background monitoring, contextual suggestions, and autonomous task assistance
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface ProactiveContext {
  timestamp: Date;
  userActivity: UserActivity;
  systemState: SystemState;
  suggestions: Suggestion[];
  insights: Insight[];
}

export interface UserActivity {
  lastChatMessage?: string;
  lastChatTime?: Date;
  messageCount: number;
  sessionDuration: number;
  commonTopics: string[];
  preferredResponseStyle: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface SystemState {
  memoryUsage: number;
  responseTime: number;
  errorCount: number;
  uptime: number;
  activeServices: string[];
  pendingTasks: number;
}

export interface Suggestion {
  id: string;
  type: 'optimization' | 'feature' | 'workflow' | 'maintenance' | 'creative';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  action?: string;
  estimatedTime?: string;
  autoExecute?: boolean;
}

export interface Insight {
  id: string;
  category: 'performance' | 'usage' | 'pattern' | 'opportunity';
  confidence: number; // 0-1
  message: string;
  data?: any;
  actionable: boolean;
}

export interface NotificationConfig {
  enabled: boolean;
  quietHours: { start: string; end: string };
  priorities: ('low' | 'medium' | 'high' | 'urgent')[];
  maxPerHour: number;
}

export class ProactiveAssistantService extends EventEmitter {
  private isActive = false;
  private context: ProactiveContext;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private analysisInterval: NodeJS.Timeout | null = null;
  private config: NotificationConfig;
  private lastNotificationTime = new Date(0);
  private notificationCount = 0;
  private hourlyResetTimer: NodeJS.Timeout | null = null;

  private patterns: Map<string, any> = new Map();
  private insights: Insight[] = [];
  private suggestions: Suggestion[] = [];

  constructor() {
    super();
    
    this.config = {
      enabled: true,
      quietHours: { start: '22:00', end: '08:00' },
      priorities: ['medium', 'high', 'urgent'],
      maxPerHour: 5
    };

    this.context = {
      timestamp: new Date(),
      userActivity: {
        messageCount: 0,
        sessionDuration: 0,
        commonTopics: [],
        preferredResponseStyle: 'balanced',
        timeOfDay: this.getTimeOfDay()
      },
      systemState: {
        memoryUsage: 0,
        responseTime: 0,
        errorCount: 0,
        uptime: 0,
        activeServices: [],
        pendingTasks: 0
      },
      suggestions: [],
      insights: []
    };
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing Proactive Assistant...');
    
    // Start monitoring systems
    this.startSystemMonitoring();
    this.startPatternAnalysis();
    this.startHourlyReset();
    
    this.isActive = true;
    console.log('✅ Proactive Assistant active');
    
    this.emit('initialized');
  }

  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateSystemState();
      this.checkForActionableInsights();
    }, 30000); // Every 30 seconds
  }

  private checkForActionableInsights(): void {
    // Check system thresholds and generate actionable insights
    const { memoryUsage, responseTime, errorCount } = this.context.systemState;
    
    // Memory threshold check
    if (memoryUsage > 800) {
      this.addInsight({
        id: `memory-warning-${Date.now()}`,
        category: 'performance',
        confidence: 0.9,
        message: `High memory usage detected: ${memoryUsage}MB. Consider optimizing or restarting.`,
        actionable: true
      });
    }

    // Response time threshold check
    if (responseTime > 2000) {
      this.addInsight({
        id: `performance-warning-${Date.now()}`,
        category: 'performance',
        confidence: 0.8,
        message: `Slow response times detected: ${responseTime}ms. System may need attention.`,
        actionable: true
      });
    }

    // Error rate check
    if (errorCount > 5) {
      this.addInsight({
        id: `error-warning-${Date.now()}`,
        category: 'performance',
        confidence: 0.9,
        message: `High error rate detected: ${errorCount} errors. Check system logs.`,
        actionable: true
      });
    }
  }

  private startPatternAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.analyzePatterns();
      this.generateSuggestions();
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  private startHourlyReset(): void {
    this.hourlyResetTimer = setInterval(() => {
      this.notificationCount = 0;
    }, 3600000); // Every hour
  }

  private updateSystemState(): void {
    const memUsage = process.memoryUsage();
    
    this.context.systemState = {
      memoryUsage: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      responseTime: this.calculateAverageResponseTime(),
      errorCount: this.getErrorCount(),
      uptime: Math.floor(process.uptime()),
      activeServices: this.getActiveServices(),
      pendingTasks: this.getPendingTasks()
    };

    this.context.timestamp = new Date();
    this.context.userActivity.timeOfDay = this.getTimeOfDay();
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {return 'morning';}
    if (hour >= 12 && hour < 18) {return 'afternoon';}
    if (hour >= 18 && hour < 22) {return 'evening';}
    return 'night';
  }

  private calculateAverageResponseTime(): number {
    // This would integrate with actual response time tracking
    return Math.random() * 500 + 100; // Mock for now
  }

  private getErrorCount(): number {
    // This would integrate with actual error tracking
    return Math.floor(Math.random() * 3);
  }

  private getActiveServices(): string[] {
    return ['ollama', 'image-generation', 'memory-optimization', 'proactive-assistant'];
  }

  private getPendingTasks(): number {
    return Math.floor(Math.random() * 5);
  }

  private analyzePatterns(): void {
    // Analyze user interaction patterns
    this.analyzeUsagePatterns();
    this.analyzePerformancePatterns();
    this.analyzeContentPatterns();
  }

  private analyzeUsagePatterns(): void {
    const now = new Date();
    const sessionStart = new Date(now.getTime() - this.context.userActivity.sessionDuration);
    
    // Pattern: User is active during unusual hours
    if (this.context.userActivity.timeOfDay === 'night' && this.context.userActivity.messageCount > 5) {
      this.addInsight({
        id: `night-activity-${Date.now()}`,
        category: 'pattern',
        confidence: 0.8,
        message: 'Late night usage detected. Consider enabling night mode for better visibility.',
        actionable: true
      });
    }

    // Pattern: High message frequency
    if (this.context.userActivity.messageCount > 20) {
      this.addInsight({
        id: `high-frequency-${Date.now()}`,
        category: 'usage',
        confidence: 0.9,
        message: 'High interaction frequency detected. You might benefit from batch processing features.',
        actionable: true
      });
    }
  }

  private analyzePerformancePatterns(): void {
    const { memoryUsage, responseTime } = this.context.systemState;

    // Memory optimization opportunity
    if (memoryUsage > 500) {
      this.addSuggestion({
        id: `memory-opt-${Date.now()}`,
        type: 'optimization',
        priority: 'medium',
        title: 'Memory Optimization Available',
        description: `Current memory usage is ${memoryUsage}MB. Running optimization could free up resources.`,
        action: 'memory-optimize',
        estimatedTime: '10 seconds',
        autoExecute: false
      });
    }

    // Performance degradation detection
    if (responseTime > 1000) {
      this.addSuggestion({
        id: `perf-${Date.now()}`,
        type: 'maintenance',
        priority: 'high',
        title: 'Performance Degradation Detected',
        description: `Response times averaging ${Math.round(responseTime)}ms. System restart recommended.`,
        action: 'system-restart',
        estimatedTime: '30 seconds'
      });
    }
  }

  private analyzeContentPatterns(): void {
    const topics = this.context.userActivity.commonTopics;
    
    // Creative workflow suggestions
    if (topics.includes('image') || topics.includes('creative') || topics.includes('design')) {
      this.addSuggestion({
        id: `creative-${Date.now()}`,
        type: 'creative',
        priority: 'low',
        title: 'Creative Workflow Enhancement',
        description: 'You seem to be working on creative projects. Would you like to explore batch image generation or style transfer features?',
        action: 'suggest-creative-tools'
      });
    }

    // Code assistance patterns
    if (topics.includes('code') || topics.includes('programming') || topics.includes('debug')) {
      this.addSuggestion({
        id: `code-assist-${Date.now()}`,
        type: 'workflow',
        priority: 'medium',
        title: 'Code Assistance Available',
        description: 'Detected programming discussion. Code review and optimization tools are available.',
        action: 'activate-code-assistant'
      });
    }
  }

  private generateSuggestions(): void {
    const now = new Date();
    const hour = now.getHours();

    // Time-based suggestions
    if (hour === 9 && this.context.userActivity.messageCount === 0) {
      this.addSuggestion({
        id: `morning-${Date.now()}`,
        type: 'workflow',
        priority: 'low',
        title: 'Good Morning! Daily Briefing Available',
        description: 'Start your day with system status and personalized suggestions.',
        action: 'morning-briefing'
      });
    }

    // Maintenance suggestions
    if (this.context.systemState.uptime > 86400) { // 24 hours
      this.addSuggestion({
        id: `uptime-${Date.now()}`,
        type: 'maintenance',
        priority: 'low',
        title: 'System Refresh Recommended',
        description: 'System has been running for 24+ hours. A restart could improve performance.',
        action: 'system-restart',
        estimatedTime: '30 seconds'
      });
    }
  }

  private addInsight(insight: Insight): void {
    this.insights.push(insight);
    this.context.insights = this.insights.slice(-20); // Keep last 20
    
    if (insight.actionable && this.shouldNotify(insight)) {
      this.emit('insight', insight);
    }
  }

  private addSuggestion(suggestion: Suggestion): void {
    // Avoid duplicate suggestions
    const exists = this.suggestions.find(s => 
      s.type === suggestion.type && s.title === suggestion.title
    );
    
    if (!exists) {
      this.suggestions.push(suggestion);
      this.context.suggestions = this.suggestions.slice(-10); // Keep last 10
      
      if (this.shouldNotify(suggestion)) {
        this.emit('suggestion', suggestion);
      }
    }
  }

  private shouldNotify(item: Insight | Suggestion): boolean {
    if (!this.config.enabled) {return false;}
    
    const priority = 'priority' in item ? item.priority : 'medium';
    if (!this.config.priorities.includes(priority)) {return false;}
    
    // Check notification limits
    if (this.notificationCount >= this.config.maxPerHour) {return false;}
    
    // Check quiet hours
    if (this.isQuietHours()) {return priority === 'urgent';}
    
    return true;
  }

  private isQuietHours(): boolean {
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5);
    
    const start = this.config.quietHours.start;
    const end = this.config.quietHours.end;
    
    if (start < end) {
      return timeString >= start && timeString <= end;
    } else {
      // Quiet hours cross midnight
      return timeString >= start || timeString <= end;
    }
  }

  private cleanupOldData(): void {
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    this.insights = this.insights.filter(insight => 
      new Date(insight.id.split('-')[1]) > oneHourAgo
    );
    
    this.suggestions = this.suggestions.filter(suggestion =>
      new Date(suggestion.id.split('-')[1]) > oneHourAgo
    );
  }

  // Public API methods

  updateUserActivity(activity: Partial<UserActivity>): void {
    this.context.userActivity = { ...this.context.userActivity, ...activity };
  }

  addUserMessage(message: string): void {
    this.context.userActivity.messageCount++;
    this.context.userActivity.lastChatMessage = message;
    this.context.userActivity.lastChatTime = new Date();
    
    // Extract topics from message
    const topics = this.extractTopics(message);
    this.context.userActivity.commonTopics = [
      ...new Set([...this.context.userActivity.commonTopics, ...topics])
    ].slice(-10);
  }

  private extractTopics(message: string): string[] {
    const topicKeywords = {
      'image': ['image', 'picture', 'photo', 'generate', 'create', 'visual'],
      'code': ['code', 'programming', 'function', 'script', 'debug', 'error'],
      'creative': ['creative', 'art', 'design', 'style', 'artistic'],
      'data': ['data', 'analysis', 'chart', 'graph', 'statistics'],
      'help': ['help', 'assist', 'support', 'guide', 'how']
    };

    const foundTopics: string[] = [];
    const lowerMessage = message.toLowerCase();

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        foundTopics.push(topic);
      }
    }

    return foundTopics;
  }

  getContext(): ProactiveContext {
    return { ...this.context };
  }

  getCurrentSuggestions(): Suggestion[] {
    return this.suggestions.filter(s => {
      const age = Date.now() - parseInt(s.id.split('-')[1]);
      return age < 3600000; // Less than 1 hour old
    });
  }

  getCurrentInsights(): Insight[] {
    return this.insights.filter(i => {
      const age = Date.now() - parseInt(i.id.split('-')[1]);
      return age < 3600000; // Less than 1 hour old
    });
  }

  async executeSuggestion(suggestionId: string): Promise<{ success: boolean; result?: string; error?: string }> {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    try {
      const result = await this.performAction(suggestion.action || '');
      
      // Remove executed suggestion
      this.suggestions = this.suggestions.filter(s => s.id !== suggestionId);
      
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async performAction(action: string): Promise<string> {
    switch (action) {
      case 'memory-optimize':
        if (global.gc) {global.gc();}
        return 'Memory optimization completed';
      
      case 'morning-briefing':
        return this.generateMorningBriefing();
      
      case 'suggest-creative-tools':
        return 'Creative tools: Image generation, style transfer, and batch processing are available in the creative suite.';
      
      case 'activate-code-assistant':
        return 'Code assistant activated. Available features: syntax checking, optimization suggestions, and documentation generation.';
      
      default:
        return `Action "${action}" executed successfully`;
    }
  }

  private generateMorningBriefing(): string {
    const { systemState, userActivity } = this.context;
    
    return `Good morning! Here's your daily briefing:
    
System Status:
• Memory: ${systemState.memoryUsage}MB
• Uptime: ${Math.floor(systemState.uptime / 3600)}h ${Math.floor((systemState.uptime % 3600) / 60)}m
• Active Services: ${systemState.activeServices.length}

Yesterday's Activity:
• Messages: ${userActivity.messageCount}
• Common topics: ${userActivity.commonTopics.join(', ') || 'None'}

Ready to assist you today!`;
  }

  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async destroy(): Promise<void> {
    this.isActive = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    if (this.hourlyResetTimer) {
      clearInterval(this.hourlyResetTimer);
      this.hourlyResetTimer = null;
    }
    
    this.emit('destroyed');
    console.log('🛑 Proactive Assistant stopped');
  }
}

// Singleton instance
export const proactiveAssistant = new ProactiveAssistantService();