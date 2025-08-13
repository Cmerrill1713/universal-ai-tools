import { EventEmitter } from 'events';
export interface SystemResources {
    cpu: {
        usage: number;
        temperature?: number;
        cores: number;
        loadAverage: number[];
    };
    memory: {
        total: number;
        used: number;
        available: number;
        usagePercent: number;
    };
    disk: {
        total: number;
        used: number;
        available: number;
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
        level: number;
        isCharging: boolean;
        timeRemaining?: number;
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
        duration: number;
    }[];
}
export interface UserContext {
    presence: 'active' | 'idle' | 'away' | 'do_not_disturb' | 'sleeping';
    idleTime: number;
    currentActivity: {
        type: 'coding' | 'meeting' | 'browsing' | 'gaming' | 'media' | 'productivity' | 'unknown';
        confidence: number;
        details?: any;
    };
    location?: {
        timezone: string;
        country: string;
        city: string;
        coordinates?: {
            lat: number;
            lon: number;
        };
    };
    schedule: {
        workingHours: {
            start: number;
            end: number;
        };
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
            timeUntil: number;
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
    contextScore: number;
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
        timeRanges?: {
            start: number;
            end: number;
            days?: number[];
        }[];
        systemLoad?: {
            max: number;
        };
        applications?: {
            running?: string[];
            focused?: string[];
        };
    };
    actions: {
        allowNotifications?: boolean;
        adjustPerformance?: 'high' | 'balanced' | 'power_save';
        delayActions?: boolean;
        priority?: number;
    };
    enabled: boolean;
}
export declare class EnvironmentalAwarenessService extends EventEmitter {
    private systemResources;
    private applicationState;
    private userContext;
    private environmentalTriggers;
    private contextualRules;
    private notificationQueue;
    private supabase;
    private isInitialized;
    private systemMonitorInterval;
    private applicationMonitorInterval;
    private userContextMonitorInterval;
    private triggerCheckInterval;
    private notificationProcessorInterval;
    private lastSystemCheck;
    private presenceDetectionHistory;
    private activityHistory;
    constructor();
    private initializeService;
    private startSystemMonitoring;
    private updateSystemResources;
    private getCPUInfo;
    private getMemoryInfo;
    private getDiskInfo;
    private getNetworkInfo;
    private getBatteryInfo;
    private startApplicationMonitoring;
    private updateApplicationState;
    private getActiveApplications;
    private getFocusedApplication;
    private getRecentlyUsedApplications;
    private startUserContextMonitoring;
    private updateUserContext;
    private detectUserPresence;
    private getIdleTime;
    private detectCurrentActivity;
    getLocationContext(): Promise<UserContext['location'] | undefined>;
    private getScheduleContext;
    private startTriggerChecking;
    private checkEnvironmentalTriggers;
    private evaluateTriggerCondition;
    private evaluateSystemResourceRule;
    private evaluateApplicationStateRule;
    private evaluateUserContextRule;
    private evaluateTimeBasedRule;
    private evaluateCompositeRule;
    private compareValue;
    private executeTriggerAction;
    private startNotificationProcessing;
    queueSmartNotification(notification: Omit<SmartNotification, 'id' | 'contextScore' | 'deliveryMethod'>): Promise<string>;
    private calculateContextScore;
    private determineDeliveryMethod;
    private processNotificationQueue;
    private isOptimalNotificationTime;
    private deliverNotification;
    private parseSize;
    private detectSystemChanges;
    private updatePresenceHistory;
    private gatherInitialState;
    private loadEnvironmentalTriggers;
    private loadContextualRules;
    private doesRuleApply;
    private executeSystemAdjustment;
    private generateId;
    getSystemResources(): SystemResources | null;
    getApplicationState(): ApplicationState | null;
    getUserContext(): UserContext | null;
    getEnvironmentalTriggers(): EnvironmentalTrigger[];
    getContextualRules(): ContextualRule[];
    getPendingNotifications(): SmartNotification[];
    addEnvironmentalTrigger(trigger: Omit<EnvironmentalTrigger, 'id' | 'triggerCount'>): Promise<string>;
    removeEnvironmentalTrigger(triggerId: string): Promise<boolean>;
    addContextualRule(rule: Omit<ContextualRule, 'id'>): Promise<string>;
    updateTriggerEnabled(triggerId: string, enabled: boolean): Promise<boolean>;
    isOptimalTimeForAction(actionType: string): boolean;
    getEnvironmentalContext(): any;
    getStatus(): {
        status: string;
        initialized: boolean;
        lastUpdate?: Date;
    };
    getCurrentContext(): any;
    getTimeContext(): any;
    getDeviceContext(): any;
    updateActivity(activityType: string, metadata?: any): Promise<void>;
    getContextualRecommendations(): any[];
}
export declare const environmentalAwarenessService: EnvironmentalAwarenessService;
export default environmentalAwarenessService;
//# sourceMappingURL=environmental-awareness-service.d.ts.map