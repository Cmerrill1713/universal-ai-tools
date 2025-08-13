import { EventEmitter } from 'events';
export interface ProactiveTask {
    id: string;
    title: string;
    description?: string;
    category: 'reminder' | 'follow_up' | 'research' | 'action' | 'goal' | 'routine';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'created' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';
    userId?: string;
    createdAt: Date;
    updatedAt: Date;
    scheduledFor?: Date;
    dueDate?: Date;
    estimatedDuration?: number;
    recurringPattern?: RecurringPattern;
    triggerContext: {
        conversationId?: string;
        userMessage?: string;
        detectedIntent?: string;
        entities?: string[];
        confidence: number;
    };
    actionType: 'notification' | 'api_call' | 'file_operation' | 'reminder' | 'research' | 'multi_step';
    actionDetails: any;
    dependencies?: string[];
    userFeedback?: 'helpful' | 'not_helpful' | 'irrelevant';
    completionRate?: number;
    adaptationHistory: AdaptationEvent[];
    createdBy: 'user' | 'system' | 'conversation_analysis' | 'pattern_detection';
    completedAt?: Date;
}
export interface RecurringPattern {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval: number;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    endDate?: Date;
    maxOccurrences?: number;
}
export interface AdaptationEvent {
    timestamp: Date;
    change: string;
    reason: string;
    previousValue: any;
    newValue: any;
}
export interface TaskCreationContext {
    conversationId?: string;
    userMessage?: string;
    detectedEntities?: any[];
    currentContext?: any;
    userPreferences?: any;
    timestamp: Date;
}
export interface Goal {
    id: string;
    title: string;
    description: string;
    category: string;
    targetDate: Date;
    progress: number;
    milestones: Milestone[];
    relatedTasks: string[];
    metrics: GoalMetric[];
    status: 'active' | 'completed' | 'paused' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
}
export interface Milestone {
    id: string;
    title: string;
    targetDate: Date;
    completed: boolean;
    completedAt?: Date;
}
export interface GoalMetric {
    name: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    lastUpdated: Date;
}
export declare class ProactiveTaskManager extends EventEmitter {
    private supabase;
    private tasks;
    private goals;
    private schedulingTimer;
    private isInitialized;
    private userPatterns;
    private contextualTriggers;
    constructor();
    private initializeService;
    analyzeConversationForTasks(context: TaskCreationContext): Promise<ProactiveTask[]>;
    createTask(taskData: Partial<ProactiveTask>, context?: TaskCreationContext): Promise<ProactiveTask>;
    smartScheduleTask(task: ProactiveTask, userPreferences?: any): Promise<Date>;
    executeTask(taskId: string): Promise<boolean>;
    createGoal(goalData: Partial<Goal>): Promise<Goal>;
    updateGoalProgress(goalId: string): Promise<void>;
    private analyzeMessageIntent;
    private createTaskFromIntent;
    private setupContextualTriggers;
    private startSchedulingLoop;
    private checkScheduledTasks;
    private scheduleTask;
    private sendNotification;
    private sendReminder;
    private executeApiCall;
    private executeFileOperation;
    private executeResearchTask;
    private executeMultiStepTask;
    private loadTasksFromDatabase;
    private saveTaskToDatabase;
    private loadGoalsFromDatabase;
    private saveGoalToDatabase;
    private generateTaskId;
    private generateGoalId;
    private serializeTask;
    private deserializeTask;
    private getUserActivityPatterns;
    private findOptimalReminderTime;
    private findOptimalFocusTime;
    private findGeneralOptimalTime;
    private calculateFollowUpTime;
    private checkForRecurringPatterns;
    private updateUserPatterns;
    private createNextRecurrence;
    private createTasksForGoal;
    getTasks(filters?: any): Promise<ProactiveTask[]>;
    getGoals(): Promise<Goal[]>;
    completeTask(taskId: string, userFeedback?: string): Promise<boolean>;
    deferTask(taskId: string, newScheduledTime: Date): Promise<boolean>;
    cancelTask(taskId: string): Promise<boolean>;
    getStatus(): {
        status: string;
        activeTasks: number;
        completedTasks: number;
    };
    getUserTasks(userId: string): Promise<ProactiveTask[]>;
    updateTask(taskId: string, updates: Partial<ProactiveTask>): Promise<boolean>;
    deleteTask(taskId: string): Promise<boolean>;
    getTaskSuggestions(userId: string): Promise<any[]>;
}
export declare const proactiveTaskManager: ProactiveTaskManager;
export default proactiveTaskManager;
//# sourceMappingURL=proactive-task-manager.d.ts.map