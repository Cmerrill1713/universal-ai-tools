/**
 * Environmental Awareness Service
 * Provides contextual awareness of the user's environment and system state
 * Enables smart notifications, adaptive behavior, and proactive assistance
 * 
 * Features:
 * - System resource monitoring (CPU, memory, disk, network)
 * - Application state awareness (active apps, focused windows)
 * - Time and location context
 * - User activity patterns and presence detection
 * - Smart notification delivery based on context
 * - Environmental triggers for autonomous actions
 * - Adaptive system behavior based on conditions
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { promisify } from 'util';

import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';

const execAsync = promisify(exec);

export interface SystemResources {
  cpu: {
    usage: number; // Percentage
    temperature?: number; // Celsius
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // Bytes
    used: number; // Bytes
    available: number; // Bytes
    usagePercent: number;
  };
  disk: {
    total: number; // Bytes
    used: number; // Bytes
    available: number; // Bytes
    usagePercent: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
    connected: boolean;
  };
  battery?: {
    level: number; // Percentage
    isCharging: boolean;
    timeRemaining?: number; // Minutes
  };
}

export interface ApplicationState {
  activeApplications: {
    name: string;
    pid: number;
    cpuUsage: number;
    memoryUsage: number;
    windowCount: number;
  }[];
  focusedApplication: {
    name: string;
    windowTitle: string;
    pid: number;
  } | null;
  recentlyUsed: {
    name: string;
    lastUsed: Date;
    duration: number; // Seconds
  }[];
}

export interface UserContext {
  presence: 'active' | 'idle' | 'away' | 'do_not_disturb' | 'sleeping';
  idleTime: number; // Milliseconds
  currentActivity: {
    type: 'coding' | 'meeting' | 'browsing' | 'gaming' | 'media' | 'productivity' | 'unknown';
    confidence: number;
    details?: any;
  };
  location?: {
    timezone: string;
    country: string;
    city: string;
    coordinates?: { lat: number; lon: number };
  };
  schedule: {
    workingHours: { start: number; end: number };
    workingDays: number[];
    currentMeeting?: {
      title: string;
      startTime: Date;
      endTime: Date;
      participants: string[];
    };
    nextMeeting?: {
      title: string;
      startTime: Date;
      timeUntil: number; // Minutes
    };
  };
}

export interface EnvironmentalTrigger {
  id: string;
  name: string;
  description: string;
  condition: {
    type: 'system_resource' | 'application_state' | 'user_context' | 'time_based' | 'composite';
    rules: any[];
    operator: 'AND' | 'OR';
  };
  action: {
    type: 'notification' | 'autonomous_action' | 'system_adjustment' | 'user_prompt' | 'custom';
    parameters: any;
  };
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  cooldownMinutes?: number;
}

export interface SmartNotification {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  contextScore: number; // 0-1, how contextually appropriate this notification is
  deliveryMethod: 'immediate' | 'smart_timing' | 'batch' | 'defer';
  scheduledFor?: Date;
  delivered?: boolean;
  userInteracted?: boolean;
  metadata?: any;
}

export interface ContextualRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    presence?: string[];
    activity?: string[];
    timeRanges?: { start: number; end: number; days?: number[] }[];
    systemLoad?: { max: number };
    applications?: { running?: string[]; focused?: string[] };
  };
  actions: {
    allowNotifications?: boolean;
    adjustPerformance?: 'high' | 'balanced' | 'power_save';
    delayActions?: boolean;
    priority?: number;
  };
  enabled: boolean;
}

export class EnvironmentalAwarenessService extends EventEmitter {
  private systemResources: SystemResources | null = null;
  private applicationState: ApplicationState | null = null;
  private userContext: UserContext | null = null;
  private environmentalTriggers: Map<string, EnvironmentalTrigger> = new Map();
  private contextualRules: Map<string, ContextualRule> = new Map();
  private notificationQueue: SmartNotification[] = [];
  private supabase: any;
  private isInitialized = false;

  // Monitoring intervals
  private systemMonitorInterval: NodeJS.Timeout | null = null;
  private applicationMonitorInterval: NodeJS.Timeout | null = null;
  private userContextMonitorInterval: NodeJS.Timeout | null = null;
  private triggerCheckInterval: NodeJS.Timeout | null = null;
  private notificationProcessorInterval: NodeJS.Timeout | null = null;

  // State tracking
  private lastSystemCheck: Date | null = null;
  private presenceDetectionHistory: { presence: string; timestamp: Date }[] = [];
  private activityHistory: { activity: string; timestamp: Date; duration: number }[] = [];

  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Initialize Supabase for storing environmental data
      if (config.supabase.url && config.supabase.serviceKey) {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
      }

      // Load configuration and rules
      await this.loadEnvironmentalTriggers();
      await this.loadContextualRules();
      
      // Start monitoring
      this.startSystemMonitoring();
      this.startApplicationMonitoring();
      this.startUserContextMonitoring();
      this.startTriggerChecking();
      this.startNotificationProcessing();
      
      // Initial state gathering
      await this.gatherInitialState();
      
      this.isInitialized = true;
      
      log.info('✅ Environmental Awareness Service initialized', LogContext.AI, {
        triggers: this.environmentalTriggers.size,
        rules: this.contextualRules.size
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize Environmental Awareness Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // System Resource Monitoring

  private startSystemMonitoring(): void {
    this.systemMonitorInterval = setInterval(async () => {
      await this.updateSystemResources();
    }, 15000); // Every 15 seconds
  }

  private async updateSystemResources(): Promise<void> {
    try {
      const resources: SystemResources = {
        cpu: await this.getCPUInfo(),
        memory: await this.getMemoryInfo(),
        disk: await this.getDiskInfo(),
        network: await this.getNetworkInfo(),
        battery: await this.getBatteryInfo()
      };

      const previousResources = this.systemResources;
      this.systemResources = resources;
      this.lastSystemCheck = new Date();

      // Emit events for significant changes
      if (previousResources) {
        this.detectSystemChanges(previousResources, resources);
      }

      this.emit('systemResourcesUpdated', resources);
      
    } catch (error) {
      log.error('❌ Error updating system resources', LogContext.AI, { error });
    }
  }

  private async getCPUInfo(): Promise<SystemResources['cpu']> {
    try {
      // macOS specific commands
      const { stdout: cpuUsage } = await execAsync("ps -A -o %cpu | awk '{s+=$1} END {print s}'");
      const { stdout: loadAvg } = await execAsync('uptime | grep -oE "load averages: [0-9.,]+" | grep -oE "[0-9.]+"');
      const cores = parseInt((await execAsync('sysctl -n hw.ncpu')).stdout.trim());
      
      return {
        usage: parseFloat(cpuUsage.trim()),
        cores,
        loadAverage: loadAvg.trim().split('\n').map(l => parseFloat(l)).filter(n => !isNaN(n))
      };
    } catch (error) {
      return { usage: 0, cores: 1, loadAverage: [0, 0, 0] };
    }
  }

  private async getMemoryInfo(): Promise<SystemResources['memory']> {
    try {
      const { stdout } = await execAsync('vm_stat | grep -E "Pages (free|active|inactive|wired|compressed)" | grep -oE "[0-9]+"');
      const pages = stdout.trim().split('\n').map(n => parseInt(n));
      
      // Approximate memory calculation (pages are typically 4KB)
      const pageSize = 4096;
      const totalPages = pages.reduce((sum, p) => sum + p, 0);
      const total = totalPages * pageSize;
      const available = (pages[0] ?? 0) * pageSize; // Free pages
      const used = total - available;
      
      return {
        total,
        used,
        available,
        usagePercent: (used / total) * 100
      };
    } catch (error) {
      return { total: 0, used: 0, available: 0, usagePercent: 0 };
    }
  }

  private async getDiskInfo(): Promise<SystemResources['disk']> {
    try {
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      
      const total = this.parseSize(parts[1] ?? '0');
      const used = this.parseSize(parts[2] ?? '0');
      const available = this.parseSize(parts[3] ?? '0');
      
      return {
        total,
        used,
        available,
        usagePercent: (used / total) * 100
      };
    } catch (error) {
      return { total: 0, used: 0, available: 0, usagePercent: 0 };
    }
  }

  private async getNetworkInfo(): Promise<SystemResources['network']> {
    try {
      const { stdout } = await execAsync('netstat -ib | grep -E "en[0-9]" | head -1');
      const parts = stdout.trim().split(/\s+/);
      
      return {
        bytesReceived: parseInt(parts[6] ?? '0') || 0,
        bytesSent: parseInt(parts[9] ?? '0') || 0,
        packetsReceived: parseInt(parts[4] ?? '0') || 0,
        packetsSent: parseInt(parts[7] ?? '0') || 0,
        connected: true // Simplified
      };
    } catch (error) {
      return { bytesReceived: 0, bytesSent: 0, packetsReceived: 0, packetsSent: 0, connected: false };
    }
  }

  private async getBatteryInfo(): Promise<SystemResources['battery'] | undefined> {
    try {
      const { stdout } = await execAsync('pmset -g batt | grep -oE "[0-9]+%" | head -1');
      const level = parseInt(stdout.trim().replace('%', ''));
      
      const { stdout: charging } = await execAsync('pmset -g batt | grep -c "AC Power"');
      const isCharging = parseInt(charging.trim()) > 0;
      
      return { level, isCharging };
    } catch (error) {
      return undefined; // Not all systems have batteries
    }
  }

  // Application State Monitoring

  private startApplicationMonitoring(): void {
    this.applicationMonitorInterval = setInterval(async () => {
      await this.updateApplicationState();
    }, 10000); // Every 10 seconds
  }

  private async updateApplicationState(): Promise<void> {
    try {
      const state: ApplicationState = {
        activeApplications: await this.getActiveApplications(),
        focusedApplication: await this.getFocusedApplication(),
        recentlyUsed: await this.getRecentlyUsedApplications()
      };

      this.applicationState = state;
      this.emit('applicationStateUpdated', state);
      
    } catch (error) {
      log.error('❌ Error updating application state', LogContext.AI, { error });
    }
  }

  private async getActiveApplications(): Promise<ApplicationState['activeApplications']> {
    try {
      const { stdout } = await execAsync('ps -axo pid,pcpu,pmem,comm | grep -v grep | tail -n +2');
      const processes = stdout.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0] ?? '0'),
          cpuUsage: parseFloat(parts[1] ?? '0'),
          memoryUsage: parseFloat(parts[2] ?? '0'),
          name: parts.slice(3).join(' '),
          windowCount: 1 // Simplified
        };
      });

      return processes
        .filter(p => p.cpuUsage > 0.1 || p.memoryUsage > 0.1)
        .sort((a, b) => b.cpuUsage - a.cpuUsage)
        .slice(0, 20);
    } catch (error) {
      return [];
    }
  }

  private async getFocusedApplication(): Promise<ApplicationState['focusedApplication']> {
    try {
      // AppleScript to get focused application on macOS
      const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`);
      const appName = stdout.trim().replace(/"/g, '');
      
      const { stdout: windowTitle } = await execAsync(`osascript -e 'tell application "System Events" to get title of front window of first application process whose frontmost is true'`);
      
      return {
        name: appName,
        windowTitle: windowTitle.trim().replace(/"/g, ''),
        pid: 0 // Would need additional lookup
      };
    } catch (error) {
      return null;
    }
  }

  private async getRecentlyUsedApplications(): Promise<ApplicationState['recentlyUsed']> {
    // This would integrate with system logs or maintain internal tracking
    // For now, return empty array
    return [];
  }

  // User Context Monitoring

  private startUserContextMonitoring(): void {
    this.userContextMonitorInterval = setInterval(async () => {
      await this.updateUserContext();
    }, 30000); // Every 30 seconds
  }

  private async updateUserContext(): Promise<void> {
    try {
      const context: UserContext = {
        presence: await this.detectUserPresence(),
        idleTime: await this.getIdleTime(),
        currentActivity: await this.detectCurrentActivity(),
        location: await this.getLocationContext(),
        schedule: await this.getScheduleContext()
      };

      this.userContext = context;
      this.updatePresenceHistory(context.presence);
      this.emit('userContextUpdated', context);
      
    } catch (error) {
      log.error('❌ Error updating user context', LogContext.AI, { error });
    }
  }

  private async detectUserPresence(): Promise<UserContext['presence']> {
    try {
      const idleTime = await this.getIdleTime();
      
      if (idleTime < 30000) return 'active'; // Less than 30 seconds
      if (idleTime < 300000) return 'idle'; // Less than 5 minutes
      if (idleTime < 3600000) return 'away'; // Less than 1 hour
      
      // Check for DND or sleep modes
      try {
        const { stdout } = await execAsync('pmset -g | grep -i sleep');
        if (stdout.includes('sleep')) return 'sleeping';
      } catch {}
      
      return 'away';
    } catch (error) {
      return 'unknown' as any;
    }
  }

  private async getIdleTime(): Promise<number> {
    try {
      const { stdout } = await execAsync('ioreg -c IOHIDSystem | grep HIDIdleTime');
      const match = stdout.match(/HIDIdleTime"=(\d+)/);
      if (match && match[1]) {
        // Convert nanoseconds to milliseconds
        return Math.floor(parseInt(match[1]) / 1000000);
      }
    } catch (error) {
      // Fallback method
    }
    return 0;
  }

  private async detectCurrentActivity(): Promise<UserContext['currentActivity']> {
    const focusedApp = this.applicationState?.focusedApplication;
    if (!focusedApp) {
      return { type: 'unknown', confidence: 0 };
    }

    const appName = focusedApp.name.toLowerCase();
    const windowTitle = focusedApp.windowTitle.toLowerCase();

    // Pattern matching for activity detection
    if (appName.includes('code') || appName.includes('xcode') || appName.includes('terminal')) {
      return { type: 'coding', confidence: 0.9, details: { app: appName, title: windowTitle } };
    }
    
    if (appName.includes('zoom') || appName.includes('teams') || appName.includes('meet')) {
      return { type: 'meeting', confidence: 0.95, details: { app: appName } };
    }
    
    if (appName.includes('safari') || appName.includes('chrome') || appName.includes('firefox')) {
      return { type: 'browsing', confidence: 0.8, details: { app: appName, title: windowTitle } };
    }
    
    if (appName.includes('game') || windowTitle.includes('game')) {
      return { type: 'gaming', confidence: 0.85, details: { app: appName } };
    }
    
    if (appName.includes('vlc') || appName.includes('spotify') || appName.includes('music')) {
      return { type: 'media', confidence: 0.9, details: { app: appName } };
    }
    
    return { type: 'productivity', confidence: 0.6, details: { app: appName } };
  }

  public async getLocationContext(): Promise<UserContext['location'] | undefined> {
    try {
      // Get timezone
      const { stdout: timezone } = await execAsync('date +%Z');
      
      return {
        timezone: timezone.trim(),
        country: 'US', // Would use actual geolocation
        city: 'Unknown' // Would use actual geolocation
      };
    } catch (error) {
      return undefined;
    }
  }

  private async getScheduleContext(): Promise<UserContext['schedule']> {
    // Default schedule - would integrate with calendar service
    return {
      workingHours: { start: 9, end: 17 },
      workingDays: [1, 2, 3, 4, 5] // Monday to Friday
    };
  }

  // Environmental Triggers

  private startTriggerChecking(): void {
    this.triggerCheckInterval = setInterval(async () => {
      await this.checkEnvironmentalTriggers();
    }, 60000); // Every minute
  }

  private async checkEnvironmentalTriggers(): Promise<void> {
    for (const [id, trigger] of Array.from(this.environmentalTriggers.entries())) {
      if (!trigger.enabled) continue;
      
      // Check cooldown
      if (trigger.lastTriggered && trigger.cooldownMinutes) {
        const timeSince = Date.now() - trigger.lastTriggered.getTime();
        if (timeSince < trigger.cooldownMinutes * 60 * 1000) {
          continue;
        }
      }
      
      if (await this.evaluateTriggerCondition(trigger)) {
        await this.executeTriggerAction(trigger);
        trigger.lastTriggered = new Date();
        trigger.triggerCount++;
        
        log.info('🎯 Environmental trigger activated', LogContext.AI, {
          triggerId: id,
          name: trigger.name
        });
        
        this.emit('triggerActivated', trigger);
      }
    }
  }

  private async evaluateTriggerCondition(trigger: EnvironmentalTrigger): Promise<boolean> {
    const { condition } = trigger;
    const results: boolean[] = [];

    for (const rule of condition.rules) {
      let result = false;

      switch (condition.type) {
        case 'system_resource':
          result = this.evaluateSystemResourceRule(rule);
          break;
        case 'application_state':
          result = this.evaluateApplicationStateRule(rule);
          break;
        case 'user_context':
          result = this.evaluateUserContextRule(rule);
          break;
        case 'time_based':
          result = this.evaluateTimeBasedRule(rule);
          break;
        case 'composite':
          result = await this.evaluateCompositeRule(rule);
          break;
      }

      results.push(result);
    }

    return condition.operator === 'AND' 
      ? results.every(r => r) 
      : results.some(r => r);
  }

  private evaluateSystemResourceRule(rule: any): boolean {
    if (!this.systemResources) return false;

    switch (rule.metric) {
      case 'cpu_usage':
        return this.compareValue(this.systemResources.cpu.usage, rule.operator, rule.value);
      case 'memory_usage':
        return this.compareValue(this.systemResources.memory.usagePercent, rule.operator, rule.value);
      case 'disk_usage':
        return this.compareValue(this.systemResources.disk.usagePercent, rule.operator, rule.value);
      case 'battery_level':
        return this.systemResources.battery ? 
          this.compareValue(this.systemResources.battery.level, rule.operator, rule.value) : false;
      default:
        return false;
    }
  }

  private evaluateApplicationStateRule(rule: any): boolean {
    if (!this.applicationState) return false;

    switch (rule.type) {
      case 'focused_app':
        return this.applicationState.focusedApplication?.name.toLowerCase().includes(rule.value.toLowerCase()) || false;
      case 'running_app':
        return this.applicationState.activeApplications.some(app => 
          app.name.toLowerCase().includes(rule.value.toLowerCase()));
      case 'app_cpu_usage':
        const app = this.applicationState.activeApplications.find(a => 
          a.name.toLowerCase().includes(rule.appName.toLowerCase()));
        return app ? this.compareValue(app.cpuUsage, rule.operator, rule.value) : false;
      default:
        return false;
    }
  }

  private evaluateUserContextRule(rule: any): boolean {
    if (!this.userContext) return false;

    switch (rule.type) {
      case 'presence':
        return rule.values.includes(this.userContext.presence);
      case 'idle_time':
        return this.compareValue(this.userContext.idleTime, rule.operator, rule.value);
      case 'activity':
        return rule.values.includes(this.userContext.currentActivity.type);
      case 'working_hours':
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        return this.userContext.schedule.workingDays.includes(day) &&
               hour >= this.userContext.schedule.workingHours.start &&
               hour <= this.userContext.schedule.workingHours.end;
      default:
        return false;
    }
  }

  private evaluateTimeBasedRule(rule: any): boolean {
    const now = new Date();
    
    switch (rule.type) {
      case 'time_range':
        const hour = now.getHours();
        return hour >= rule.start && hour <= rule.end;
      case 'day_of_week':
        return rule.days.includes(now.getDay());
      case 'date_range':
        const time = now.getTime();
        return time >= new Date(rule.start).getTime() && time <= new Date(rule.end).getTime();
      default:
        return false;
    }
  }

  private async evaluateCompositeRule(rule: any): Promise<boolean> {
    // Evaluate multiple conditions with complex logic
    const results = await Promise.all(rule.conditions.map(async (condition: any) => {
      const trigger = { condition } as EnvironmentalTrigger;
      return await this.evaluateTriggerCondition(trigger);
    }));
    
    return rule.operator === 'AND' ? results.every(r => r) : results.some(r => r);
  }

  private compareValue(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case '>': return actual > expected;
      case '<': return actual < expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      default: return false;
    }
  }

  private async executeTriggerAction(trigger: EnvironmentalTrigger): Promise<void> {
    const { action } = trigger;

    switch (action.type) {
      case 'notification':
        await this.queueSmartNotification({
          title: action.parameters.title,
          message: action.parameters.message,
          priority: action.parameters.priority || 'medium',
          category: 'environmental_trigger'
        });
        break;
      
      case 'autonomous_action':
        this.emit('triggerAutonomousAction', {
          type: action.parameters.actionType,
          parameters: action.parameters.actionParameters,
          triggerId: trigger.id
        });
        break;
      
      case 'system_adjustment':
        await this.executeSystemAdjustment(action.parameters);
        break;
      
      case 'user_prompt':
        this.emit('userPromptRequested', {
          prompt: action.parameters.prompt,
          options: action.parameters.options,
          triggerId: trigger.id
        });
        break;
    }
  }

  // Smart Notifications

  private startNotificationProcessing(): void {
    this.notificationProcessorInterval = setInterval(async () => {
      await this.processNotificationQueue();
    }, 30000); // Every 30 seconds
  }

  async queueSmartNotification(notification: Omit<SmartNotification, 'id' | 'contextScore' | 'deliveryMethod'>): Promise<string> {
    const smartNotification: SmartNotification = {
      ...notification,
      id: this.generateId('notif'),
      contextScore: await this.calculateContextScore(notification),
      deliveryMethod: await this.determineDeliveryMethod(notification)
    };

    this.notificationQueue.push(smartNotification);
    
    log.info('📋 Smart notification queued', LogContext.AI, {
      notificationId: smartNotification.id,
      title: smartNotification.title,
      deliveryMethod: smartNotification.deliveryMethod,
      contextScore: smartNotification.contextScore
    });

    this.emit('notificationQueued', smartNotification);
    return smartNotification.id;
  }

  private async calculateContextScore(notification: Partial<SmartNotification>): Promise<number> {
    let score = 0.5; // Base score

    if (!this.userContext) return score;

    // Adjust based on user presence
    switch (this.userContext.presence) {
      case 'active': score += 0.3; break;
      case 'idle': score += 0.1; break;
      case 'away': score -= 0.2; break;
      case 'do_not_disturb': score -= 0.4; break;
      case 'sleeping': score -= 0.5; break;
    }

    // Adjust based on current activity
    if (this.userContext.currentActivity.type === 'meeting') {
      score -= 0.3;
    } else if (this.userContext.currentActivity.type === 'coding') {
      score += 0.1;
    }

    // Adjust based on priority
    switch (notification.priority) {
      case 'urgent': score += 0.4; break;
      case 'high': score += 0.2; break;
      case 'low': score -= 0.1; break;
    }

    return Math.max(0, Math.min(1, score));
  }

  private async determineDeliveryMethod(notification: Partial<SmartNotification>): Promise<SmartNotification['deliveryMethod']> {
    if (notification.priority === 'urgent') {
      return 'immediate';
    }

    if (!this.userContext) return 'smart_timing';

    // Use contextual rules to determine delivery
    const applicableRules = Array.from(this.contextualRules.values())
      .filter(rule => rule.enabled && this.doesRuleApply(rule));

    for (const rule of applicableRules) {
      if (rule.actions.delayActions) {
        return 'defer';
      }
      if (!rule.actions.allowNotifications) {
        return 'batch';
      }
    }

    return 'smart_timing';
  }

  private async processNotificationQueue(): Promise<void> {
    const now = new Date();
    const readyNotifications = this.notificationQueue.filter(notification => {
      if (notification.delivered) return false;
      
      switch (notification.deliveryMethod) {
        case 'immediate':
          return true;
        case 'smart_timing':
          return this.isOptimalNotificationTime();
        case 'batch':
          return now.getMinutes() === 0; // Top of the hour
        case 'defer':
          return notification.scheduledFor ? now >= notification.scheduledFor : false;
        default:
          return true;
      }
    });

    for (const notification of readyNotifications) {
      await this.deliverNotification(notification);
      notification.delivered = true;
      
      // Remove from queue after delivery
      const index = this.notificationQueue.indexOf(notification);
      if (index > -1) {
        this.notificationQueue.splice(index, 1);
      }
    }
  }

  private isOptimalNotificationTime(): boolean {
    if (!this.userContext) return true;

    // Don't notify if user is away, sleeping, or in DND
    if (['away', 'sleeping', 'do_not_disturb'].includes(this.userContext.presence)) {
      return false;
    }

    // Don't notify during meetings
    if (this.userContext.currentActivity.type === 'meeting') {
      return false;
    }

    // Optimal times are when user is active and not deeply focused
    return this.userContext.presence === 'active' && 
           !['coding', 'gaming'].includes(this.userContext.currentActivity.type);
  }

  private async deliverNotification(notification: SmartNotification): Promise<void> {
    log.info('📬 Delivering smart notification', LogContext.AI, {
      notificationId: notification.id,
      title: notification.title,
      priority: notification.priority
    });

    this.emit('notificationDelivered', notification);
  }

  // Utility methods

  private parseSize(sizeStr: string): number {
    const units = { 'K': 1024, 'M': 1024 * 1024, 'G': 1024 * 1024 * 1024, 'T': 1024 * 1024 * 1024 * 1024 };
    const match = sizeStr.match(/([0-9.]+)([KMGT])/);
    if (match && match[1] && match[2]) {
      return parseFloat(match[1]) * (units[match[2] as keyof typeof units] || 1);
    }
    return parseFloat(sizeStr) || 0;
  }

  private detectSystemChanges(previous: SystemResources, current: SystemResources): void {
    // Detect significant changes and emit events
    if (Math.abs(previous.cpu.usage - current.cpu.usage) > 20) {
      this.emit('significantCPUChange', { previous: previous.cpu.usage, current: current.cpu.usage });
    }
    
    if (Math.abs(previous.memory.usagePercent - current.memory.usagePercent) > 15) {
      this.emit('significantMemoryChange', { previous: previous.memory.usagePercent, current: current.memory.usagePercent });
    }
    
    if (previous.battery && current.battery) {
      if (previous.battery.level > 20 && current.battery.level <= 20) {
        this.emit('lowBattery', current.battery);
      }
    }
  }

  private updatePresenceHistory(presence: UserContext['presence']): void {
    this.presenceDetectionHistory.push({
      presence,
      timestamp: new Date()
    });
    
    // Keep only recent history (last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.presenceDetectionHistory = this.presenceDetectionHistory.filter(
      entry => entry.timestamp.getTime() > cutoff
    );
  }

  private async gatherInitialState(): Promise<void> {
    await Promise.all([
      this.updateSystemResources(),
      this.updateApplicationState(),
      this.updateUserContext()
    ]);
  }

  private async loadEnvironmentalTriggers(): Promise<void> {
    // Load from database or create default triggers
    const defaultTriggers: EnvironmentalTrigger[] = [
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage Alert',
        description: 'Alert when CPU usage exceeds 80%',
        condition: {
          type: 'system_resource',
          rules: [{ metric: 'cpu_usage', operator: '>', value: 80 }],
          operator: 'AND'
        },
        action: {
          type: 'notification',
          parameters: {
            title: 'High CPU Usage',
            message: 'System CPU usage is high. Consider closing some applications.',
            priority: 'medium'
          }
        },
        enabled: true,
        triggerCount: 0,
        cooldownMinutes: 15
      },
      {
        id: 'meeting_focus_mode',
        name: 'Meeting Focus Mode',
        description: 'Activate focus mode during meetings',
        condition: {
          type: 'user_context',
          rules: [{ type: 'activity', values: ['meeting'] }],
          operator: 'AND'
        },
        action: {
          type: 'system_adjustment',
          parameters: {
            adjustmentType: 'focus_mode',
            enabled: true
          }
        },
        enabled: true,
        triggerCount: 0
      }
    ];

    for (const trigger of defaultTriggers) {
      this.environmentalTriggers.set(trigger.id, trigger);
    }
  }

  private async loadContextualRules(): Promise<void> {
    // Load contextual rules for smart behavior
    const defaultRules: ContextualRule[] = [
      {
        id: 'meeting_quiet_mode',
        name: 'Meeting Quiet Mode',
        description: 'Limit notifications during meetings',
        conditions: {
          activity: ['meeting']
        },
        actions: {
          allowNotifications: false,
          delayActions: true
        },
        enabled: true
      },
      {
        id: 'focus_work_hours',
        name: 'Focus During Work Hours',
        description: 'Optimize for productivity during work hours',
        conditions: {
          timeRanges: [{ start: 9, end: 17, days: [1, 2, 3, 4, 5] }],
          activity: ['coding', 'productivity']
        },
        actions: {
          adjustPerformance: 'high',
          priority: 1
        },
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      this.contextualRules.set(rule.id, rule);
    }
  }

  private doesRuleApply(rule: ContextualRule): boolean {
    if (!this.userContext) return false;

    const {conditions} = rule;
    
    // Check presence
    if (conditions.presence && !conditions.presence.includes(this.userContext.presence)) {
      return false;
    }
    
    // Check activity
    if (conditions.activity && !conditions.activity.includes(this.userContext.currentActivity.type)) {
      return false;
    }
    
    // Check time ranges
    if (conditions.timeRanges) {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();
      
      const inTimeRange = conditions.timeRanges.some(range => {
        const inHours = hour >= range.start && hour <= range.end;
        const inDays = !range.days || range.days.includes(day);
        return inHours && inDays;
      });
      
      if (!inTimeRange) return false;
    }
    
    // Check system load
    if (conditions.systemLoad && this.systemResources) {
      if (this.systemResources.cpu.usage > conditions.systemLoad.max) {
        return false;
      }
    }
    
    return true;
  }

  private async executeSystemAdjustment(parameters: any): Promise<void> {
    log.info('⚙️ Executing system adjustment', LogContext.AI, { parameters });
    
    switch (parameters.adjustmentType) {
      case 'focus_mode':
        this.emit('focusModeToggled', parameters.enabled);
        break;
      case 'performance_mode':
        this.emit('performanceModeChanged', parameters.mode);
        break;
      case 'notification_settings':
        this.emit('notificationSettingsChanged', parameters.settings);
        break;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Public API methods

  public getSystemResources(): SystemResources | null {
    return this.systemResources;
  }

  public getApplicationState(): ApplicationState | null {
    return this.applicationState;
  }

  public getUserContext(): UserContext | null {
    return this.userContext;
  }

  public getEnvironmentalTriggers(): EnvironmentalTrigger[] {
    return Array.from(this.environmentalTriggers.values());
  }

  public getContextualRules(): ContextualRule[] {
    return Array.from(this.contextualRules.values());
  }

  public getPendingNotifications(): SmartNotification[] {
    return this.notificationQueue.filter(n => !n.delivered);
  }

  public async addEnvironmentalTrigger(trigger: Omit<EnvironmentalTrigger, 'id' | 'triggerCount'>): Promise<string> {
    const id = this.generateId('trigger');
    const fullTrigger: EnvironmentalTrigger = {
      ...trigger,
      id,
      triggerCount: 0
    };
    
    this.environmentalTriggers.set(id, fullTrigger);
    this.emit('triggerAdded', fullTrigger);
    
    return id;
  }

  public async removeEnvironmentalTrigger(triggerId: string): Promise<boolean> {
    const removed = this.environmentalTriggers.delete(triggerId);
    if (removed) {
      this.emit('triggerRemoved', triggerId);
    }
    return removed;
  }

  public async addContextualRule(rule: Omit<ContextualRule, 'id'>): Promise<string> {
    const id = this.generateId('rule');
    const fullRule: ContextualRule = { ...rule, id };
    
    this.contextualRules.set(id, fullRule);
    this.emit('ruleAdded', fullRule);
    
    return id;
  }

  public async updateTriggerEnabled(triggerId: string, enabled: boolean): Promise<boolean> {
    const trigger = this.environmentalTriggers.get(triggerId);
    if (trigger) {
      trigger.enabled = enabled;
      this.emit('triggerUpdated', trigger);
      return true;
    }
    return false;
  }

  public isOptimalTimeForAction(actionType: string): boolean {
    if (!this.userContext) return true;

    // Apply contextual rules
    const applicableRules = Array.from(this.contextualRules.values())
      .filter(rule => rule.enabled && this.doesRuleApply(rule));

    for (const rule of applicableRules) {
      if (rule.actions.delayActions) {
        return false;
      }
    }

    // Check user presence and activity
    if (['away', 'sleeping', 'do_not_disturb'].includes(this.userContext.presence)) {
      return false;
    }

    if (this.userContext.currentActivity.type === 'meeting') {
      return false;
    }

    return true;
  }

  public getEnvironmentalContext(): any {
    return {
      system: this.systemResources,
      applications: this.applicationState,
      user: this.userContext,
      timestamp: new Date(),
      isOptimalTime: this.isOptimalTimeForAction('general')
    };
  }

  // Additional public methods for router compatibility
  public getStatus(): { status: string; initialized: boolean; lastUpdate?: Date } {
    return {
      status: this.isInitialized ? 'active' : 'initializing',
      initialized: this.isInitialized,
      lastUpdate: this.lastSystemCheck || undefined
    };
  }

  public getCurrentContext(): any {
    return this.getEnvironmentalContext();
  }

  public getTimeContext(): any {
    const now = new Date();
    return {
      timestamp: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      isWorkingHours: this.userContext?.schedule ? 
        now.getHours() >= this.userContext.schedule.workingHours.start &&
        now.getHours() <= this.userContext.schedule.workingHours.end : true,
      isWorkingDay: this.userContext?.schedule ? 
        this.userContext.schedule.workingDays.includes(now.getDay()) : true
    };
  }

  public getDeviceContext(): any {
    return {
      system: this.systemResources,
      applications: this.applicationState?.activeApplications || [],
      focused: this.applicationState?.focusedApplication || null,
      lastUpdate: this.lastSystemCheck?.toISOString()
    };
  }

  public async updateActivity(activityType: string, metadata?: any): Promise<void> {
    if (this.userContext) {
      this.userContext.currentActivity = {
        type: activityType as any,
        confidence: 0.8,
        details: metadata
      };
      
      // Add to history
      this.activityHistory.push({
        activity: activityType,
        timestamp: new Date(),
        duration: 0
      });

      // Keep history manageable
      if (this.activityHistory.length > 100) {
        this.activityHistory = this.activityHistory.slice(-50);
      }

      this.emit('activityUpdated', this.userContext.currentActivity);
    }
  }

  public getContextualRecommendations(): any[] {
    const recommendations: any[] = [];
    
    if (!this.isInitialized || !this.systemResources || !this.userContext) {
      return recommendations;
    }

    // CPU usage recommendations
    if (this.systemResources.cpu.usage > 80) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'High CPU usage detected. Consider closing unused applications.',
        action: 'optimize_performance'
      });
    }

    // Memory usage recommendations
    if (this.systemResources.memory.usagePercent > 85) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Memory usage is high. Restart resource-heavy applications.',
        action: 'manage_memory'
      });
    }

    // Battery recommendations
    if (this.systemResources.battery && this.systemResources.battery.level < 20 && !this.systemResources.battery.isCharging) {
      recommendations.push({
        type: 'power',
        priority: 'high',
        message: 'Battery is low. Consider enabling power saving mode.',
        action: 'save_power'
      });
    }

    // Activity-based recommendations
    if (this.userContext.currentActivity.type === 'coding') {
      recommendations.push({
        type: 'productivity',
        priority: 'low',
        message: 'Take a break every hour to maintain focus.',
        action: 'take_break'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const environmentalAwarenessService = new EnvironmentalAwarenessService();
export default environmentalAwarenessService;