/**
 * Proactive Task Manager Service
 * Creates, manages, and executes tasks autonomously based on context and user patterns
 * 
 * Features:
 * - Automatic task creation from conversations and context
 * - Smart scheduling and priority management
 * - Goal setting and progress tracking
 * - Proactive reminders and notifications
 * - Pattern-based task prediction
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';

export interface ProactiveTask {
  id: string;
  title: string;
  description?: string;
  category: 'reminder' | 'follow_up' | 'research' | 'action' | 'goal' | 'routine';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'created' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';
  
  // User and timestamps
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Scheduling
  scheduledFor?: Date;
  dueDate?: Date;
  estimatedDuration?: number; // minutes
  recurringPattern?: RecurringPattern;
  
  // Context and triggers
  triggerContext: {
    conversationId?: string;
    userMessage?: string;
    detectedIntent?: string;
    entities?: string[];
    confidence: number;
  };
  
  // Execution
  actionType: 'notification' | 'api_call' | 'file_operation' | 'reminder' | 'research' | 'multi_step';
  actionDetails: any;
  dependencies?: string[]; // Other task IDs this depends on
  
  // Learning and adaptation  
  userFeedback?: 'helpful' | 'not_helpful' | 'irrelevant';
  completionRate?: number; // 0-1, for recurring tasks
  adaptationHistory: AdaptationEvent[];
  
  // Metadata
  createdBy: 'user' | 'system' | 'conversation_analysis' | 'pattern_detection';
  completedAt?: Date;
}

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // e.g., every 2 days, every 3 weeks
  daysOfWeek?: number[]; // 0-6, Sunday to Saturday
  daysOfMonth?: number[]; // 1-31
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
  progress: number; // 0-1
  milestones: Milestone[];
  relatedTasks: string[]; // Task IDs
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

export class ProactiveTaskManager extends EventEmitter {
  private supabase: any;
  private tasks: Map<string, ProactiveTask> = new Map();
  private goals: Map<string, Goal> = new Map();
  private schedulingTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  // Pattern recognition
  private userPatterns: Map<string, any> = new Map();
  private contextualTriggers: Map<string, Function> = new Map();
  
  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Initialize Supabase
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing for Proactive Task Manager');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
      
      // Load existing tasks and goals
      await this.loadTasksFromDatabase();
      await this.loadGoalsFromDatabase();
      
      // Set up contextual triggers
      this.setupContextualTriggers();
      
      // Start scheduling loop
      this.startSchedulingLoop();
      
      this.isInitialized = true;
      
      log.info('✅ Proactive Task Manager initialized', LogContext.AI, {
        loadedTasks: this.tasks.size,
        loadedGoals: this.goals.size
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize Proactive Task Manager', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Analyze conversation context and proactively create tasks
   */
  async analyzeConversationForTasks(context: TaskCreationContext): Promise<ProactiveTask[]> {
    if (!this.isInitialized) {return [];}
    
    const createdTasks: ProactiveTask[] = [];
    
    try {
      // Analyze message for actionable items
      const analysis = await this.analyzeMessageIntent(context.userMessage || '');
      
      for (const intent of analysis.intents) {
        if (intent.confidence > 0.7 && intent.actionable) {
          const task = await this.createTaskFromIntent(intent, context);
          if (task) {
            createdTasks.push(task);
          }
        }
      }
      
      // Check for patterns that suggest recurring tasks
      await this.checkForRecurringPatterns(context);
      
      // Update user patterns
      await this.updateUserPatterns(context);
      
    } catch (error) {
      log.error('❌ Error analyzing conversation for tasks', LogContext.AI, { error });
    }
    
    return createdTasks;
  }

  /**
   * Create a new proactive task
   */
  async createTask(taskData: Partial<ProactiveTask>, context?: TaskCreationContext): Promise<ProactiveTask> {
    const task: ProactiveTask = {
      id: this.generateTaskId(),
      title: taskData.title || 'Untitled Task',
      description: taskData.description,
      category: taskData.category || 'action',
      priority: taskData.priority || 'medium',
      status: 'created',
      scheduledFor: taskData.scheduledFor,
      dueDate: taskData.dueDate,
      estimatedDuration: taskData.estimatedDuration,
      recurringPattern: taskData.recurringPattern,
      triggerContext: taskData.triggerContext || {
        conversationId: context?.conversationId,
        userMessage: context?.userMessage,
        confidence: 0.8
      },
      actionType: taskData.actionType || 'notification',
      actionDetails: taskData.actionDetails || {},
      dependencies: taskData.dependencies,
      adaptationHistory: [],
      createdBy: taskData.createdBy || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: context?.userPreferences?.userId
    };

    // Store task
    this.tasks.set(task.id, task);
    
    // Save to database
    await this.saveTaskToDatabase(task);
    
    // Schedule if needed
    if (task.scheduledFor) {
      this.scheduleTask(task);
    }
    
    log.info('✅ Created proactive task', LogContext.AI, {
      taskId: task.id,
      title: task.title,
      category: task.category,
      scheduledFor: task.scheduledFor
    });
    
    this.emit('taskCreated', task);
    
    return task;
  }

  /**
   * Smart scheduling based on user patterns and preferences
   */
  async smartScheduleTask(task: ProactiveTask, userPreferences?: any): Promise<Date> {
    // Analyze user's activity patterns
    const userPatterns = await this.getUserActivityPatterns(task.userId || 'default');
    
    let optimalTime: Date;
    
    switch (task.category) {
      case 'reminder':
        // Schedule reminders at high-attention times
        optimalTime = this.findOptimalReminderTime(userPatterns);
        break;
      
      case 'research':
        // Schedule research tasks during low-interruption periods
        optimalTime = this.findOptimalFocusTime(userPatterns);
        break;
      
      case 'follow_up':
        // Schedule follow-ups at appropriate intervals
        optimalTime = this.calculateFollowUpTime(task);
        break;
      
      default:
        optimalTime = this.findGeneralOptimalTime(userPatterns);
    }
    
    // Adjust for task priority
    if (task.priority === 'urgent') {
      optimalTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    } else if (task.priority === 'high') {
      optimalTime = new Date(Math.min(optimalTime.getTime(), Date.now() + 2 * 60 * 60 * 1000)); // Max 2 hours
    }
    
    task.scheduledFor = optimalTime;
    task.updatedAt = new Date();
    
    await this.saveTaskToDatabase(task);
    this.scheduleTask(task);
    
    return optimalTime;
  }

  /**
   * Execute a scheduled task
   */
  async executeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {return false;}
    
    try {
      task.status = 'in_progress';
      task.updatedAt = new Date();
      
      log.info('🚀 Executing proactive task', LogContext.AI, {
        taskId: task.id,
        title: task.title,
        actionType: task.actionType
      });
      
      let success = false;
      
      switch (task.actionType) {
        case 'notification':
          success = await this.sendNotification(task);
          break;
        
        case 'reminder':
          success = await this.sendReminder(task);
          break;
        
        case 'api_call':
          success = await this.executeApiCall(task);
          break;
        
        case 'file_operation':
          success = await this.executeFileOperation(task);
          break;
        
        case 'research':
          success = await this.executeResearchTask(task);
          break;
        
        case 'multi_step':
          success = await this.executeMultiStepTask(task);
          break;
        
        default:
          log.warn('Unknown task action type', LogContext.AI, { actionType: task.actionType });
          success = false;
      }
      
      if (success) {
        task.status = 'completed';
        task.completedAt = new Date();
        
        // Create next occurrence if recurring
        if (task.recurringPattern) {
          await this.createNextRecurrence(task);
        }
        
        log.info('✅ Task executed successfully', LogContext.AI, { taskId: task.id });
      } else {
        task.status = 'created'; // Reset to retry later
        log.warn('❌ Task execution failed', LogContext.AI, { taskId: task.id });
      }
      
      await this.saveTaskToDatabase(task);
      this.emit('taskExecuted', task, success);
      
      return success;
      
    } catch (error) {
      log.error('❌ Error executing task', LogContext.AI, {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      task.status = 'created';
      await this.saveTaskToDatabase(task);
      
      return false;
    }
  }

  /**
   * Create and manage goals
   */
  async createGoal(goalData: Partial<Goal>): Promise<Goal> {
    const goal: Goal = {
      id: this.generateGoalId(),
      title: goalData.title || 'Untitled Goal',
      description: goalData.description || '',
      category: goalData.category || 'general',
      targetDate: goalData.targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      progress: 0,
      milestones: goalData.milestones || [],
      relatedTasks: [],
      metrics: goalData.metrics || [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.goals.set(goal.id, goal);
    await this.saveGoalToDatabase(goal);
    
    // Create initial tasks to work towards this goal
    await this.createTasksForGoal(goal);
    
    log.info('✅ Created goal', LogContext.AI, {
      goalId: goal.id,
      title: goal.title,
      targetDate: goal.targetDate
    });
    
    this.emit('goalCreated', goal);
    
    return goal;
  }

  /**
   * Update goal progress and create related tasks
   */
  async updateGoalProgress(goalId: string): Promise<void> {
    const goal = this.goals.get(goalId);
    if (!goal) {return;}
    
    // Calculate progress based on completed related tasks
    const relatedTasks = goal.relatedTasks
      .map(id => this.tasks.get(id))
      .filter(task => task);
    
    const completedTasks = relatedTasks.filter(task => task!.status === 'completed');
    const progressFromTasks = relatedTasks.length > 0 ? completedTasks.length / relatedTasks.length : 0;
    
    // Calculate progress from milestones
    const completedMilestones = goal.milestones.filter(m => m.completed);
    const progressFromMilestones = goal.milestones.length > 0 ? completedMilestones.length / goal.milestones.length : 0;
    
    // Weighted average (tasks 60%, milestones 40%)
    goal.progress = (progressFromTasks * 0.6) + (progressFromMilestones * 0.4);
    goal.updatedAt = new Date();
    
    // Check if goal should be completed
    if (goal.progress >= 1.0 && goal.status === 'active') {
      goal.status = 'completed';
      
      // Create celebration/completion task
      await this.createTask({
        title: `🎉 Goal Completed: ${goal.title}`,
        description: `Congratulations! You've completed your goal: ${goal.title}`,
        category: 'reminder',
        priority: 'high',
        actionType: 'notification',
        actionDetails: {
          type: 'celebration',
          goalId: goal.id
        },
        createdBy: 'system'
      });
    }
    
    await this.saveGoalToDatabase(goal);
    this.emit('goalProgressUpdated', goal);
  }

  // Private helper methods
  
  private async analyzeMessageIntent(message: string): Promise<{
    intents: Array<{
      type: string;
      confidence: number;
      actionable: boolean;
      entities?: any[];
      suggestedAction?: string;
    }>;
  }> {
    // Simple pattern-based intent detection
    // In a real implementation, this would use NLP/ML
    const intents = [];
    
    const patterns = [
      {
        pattern: /remind me (to|about) (.+?) (in|at|on) (.+)/i,
        type: 'reminder',
        actionable: true
      },
      {
        pattern: /follow up (with|on) (.+?) (in|at|on) (.+)/i,
        type: 'follow_up',
        actionable: true
      },
      {
        pattern: /(research|look up|find out) (.+)/i,
        type: 'research',
        actionable: true
      },
      {
        pattern: /schedule (.+?) (for|at|on) (.+)/i,
        type: 'scheduling',
        actionable: true
      },
      {
        pattern: /goal|target|achieve|want to/i,
        type: 'goal_setting',
        actionable: true
      }
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern.pattern);
      if (match) {
        intents.push({
          type: pattern.type,
          confidence: 0.8,
          actionable: pattern.actionable,
          entities: match.slice(1),
          suggestedAction: match[0]
        });
      }
    }
    
    return { intents };
  }
  
  private async createTaskFromIntent(intent: any, context: TaskCreationContext): Promise<ProactiveTask | null> {
    switch (intent.type) {
      case 'reminder':
        return await this.createTask({
          title: `Reminder: ${intent.entities?.[1] || 'Task'}`,
          description: `Reminder created from conversation`,
          category: 'reminder',
          priority: 'medium',
          actionType: 'reminder',
          actionDetails: {
            reminderText: intent.entities?.[1] || 'Task',
            originalMessage: context.userMessage
          },
          triggerContext: {
            conversationId: context.conversationId,
            userMessage: context.userMessage,
            detectedIntent: intent.type,
            confidence: intent.confidence
          },
          createdBy: 'conversation_analysis'
        }, context);
      
      case 'follow_up':
        return await this.createTask({
          title: `Follow up: ${intent.entities?.[1] || 'Topic'}`,
          description: `Follow-up task created from conversation`,
          category: 'follow_up',
          priority: 'medium',
          actionType: 'reminder',
          actionDetails: {
            followUpTopic: intent.entities?.[1] || 'Topic',
            originalMessage: context.userMessage
          },
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          createdBy: 'conversation_analysis'
        }, context);
      
      case 'research':
        return await this.createTask({
          title: `Research: ${intent.entities?.[1] || 'Topic'}`,
          description: `Research task created from conversation`,
          category: 'research',
          priority: 'low',
          actionType: 'research',
          actionDetails: {
            researchTopic: intent.entities?.[1] || 'Topic',
            originalMessage: context.userMessage
          },
          estimatedDuration: 30, // 30 minutes
          createdBy: 'conversation_analysis'
        }, context);
      
      default:
        return null;
    }
  }

  private setupContextualTriggers(): void {
    // Set up triggers that fire based on context changes
    this.contextualTriggers.set('timeBasedReminder', (context: any) => {
      // Trigger time-based reminders
    });
    
    this.contextualTriggers.set('locationBasedTask', (context: any) => {
      // Trigger location-based tasks
    });
    
    this.contextualTriggers.set('activityBasedSuggestion', (context: any) => {
      // Suggest tasks based on current activity
    });
  }

  private startSchedulingLoop(): void {
    // Check for tasks to execute every minute
    this.schedulingTimer = setInterval(async () => {
      await this.checkScheduledTasks();
    }, 60 * 1000); // 1 minute
  }

  private async checkScheduledTasks(): Promise<void> {
    const now = new Date();
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'scheduled' && 
          task.scheduledFor && 
          task.scheduledFor <= now) {
        await this.executeTask(taskId);
      }
    }
  }

  private scheduleTask(task: ProactiveTask): void {
    if (!task.scheduledFor) {return;}
    
    const delay = task.scheduledFor.getTime() - Date.now();
    if (delay <= 0) {
      // Execute immediately if scheduled time has passed
      this.executeTask(task.id);
    } else {
      // Schedule for later
      setTimeout(() => {
        this.executeTask(task.id);
      }, delay);
      
      task.status = 'scheduled';
    }
  }

  private async sendNotification(task: ProactiveTask): Promise<boolean> {
    // Implementation would integrate with notification system
    log.info('📢 Sending notification', LogContext.AI, {
      taskId: task.id,
      title: task.title
    });
    
    // Emit event for UI to handle
    this.emit('notification', {
      type: 'task',
      title: task.title,
      description: task.description,
      priority: task.priority,
      taskId: task.id
    });
    
    return true;
  }

  private async sendReminder(task: ProactiveTask): Promise<boolean> {
    // Implementation would send actual reminders
    log.info('⏰ Sending reminder', LogContext.AI, {
      taskId: task.id,
      reminderText: task.actionDetails.reminderText
    });
    
    this.emit('reminder', {
      title: task.title,
      text: task.actionDetails.reminderText,
      originalMessage: task.actionDetails.originalMessage,
      taskId: task.id
    });
    
    return true;
  }

  private async executeApiCall(task: ProactiveTask): Promise<boolean> {
    // Implementation would make actual API calls
    log.info('🔗 Executing API call', LogContext.AI, {
      taskId: task.id,
      apiDetails: task.actionDetails
    });
    return true;
  }

  private async executeFileOperation(task: ProactiveTask): Promise<boolean> {
    // Implementation would perform file operations
    log.info('📁 Executing file operation', LogContext.AI, {
      taskId: task.id,
      operation: task.actionDetails
    });
    return true;
  }

  private async executeResearchTask(task: ProactiveTask): Promise<boolean> {
    // Implementation would perform research
    log.info('🔍 Executing research task', LogContext.AI, {
      taskId: task.id,
      topic: task.actionDetails.researchTopic
    });
    return true;
  }

  private async executeMultiStepTask(task: ProactiveTask): Promise<boolean> {
    // Implementation would execute multi-step workflows
    log.info('📋 Executing multi-step task', LogContext.AI, {
      taskId: task.id,
      steps: task.actionDetails.steps
    });
    return true;
  }

  // Database operations
  private async loadTasksFromDatabase(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('proactive_tasks')
        .select('*')
        .eq('status', 'scheduled')
        .order('created_at', { ascending: false });
      
      if (error) {throw error;}
      
      for (const taskData of data || []) {
        const task = this.deserializeTask(taskData);
        this.tasks.set(task.id, task);
        
        if (task.scheduledFor) {
          this.scheduleTask(task);
        }
      }
    } catch (error) {
      log.error('❌ Error loading tasks from database', LogContext.AI, { error });
    }
  }

  private async saveTaskToDatabase(task: ProactiveTask): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('proactive_tasks')
        .upsert(this.serializeTask(task));
      
      if (error) {throw error;}
    } catch (error) {
      log.error('❌ Error saving task to database', LogContext.AI, { error });
    }
  }

  private async loadGoalsFromDatabase(): Promise<void> {
    // Implementation for loading goals
  }

  private async saveGoalToDatabase(goal: Goal): Promise<void> {
    // Implementation for saving goals
  }

  // Utility methods
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateGoalId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private serializeTask(task: ProactiveTask): any {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: task.status,
      scheduled_for: task.scheduledFor,
      due_date: task.dueDate,
      estimated_duration: task.estimatedDuration,
      recurring_pattern: task.recurringPattern,
      trigger_context: task.triggerContext,
      action_type: task.actionType,
      action_details: task.actionDetails,
      dependencies: task.dependencies,
      user_feedback: task.userFeedback,
      completion_rate: task.completionRate,
      adaptation_history: task.adaptationHistory,
      created_by: task.createdBy,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      completed_at: task.completedAt,
      user_id: task.userId
    };
  }

  private deserializeTask(data: any): ProactiveTask {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: data.status,
      scheduledFor: data.scheduled_for ? new Date(data.scheduled_for) : undefined,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      estimatedDuration: data.estimated_duration,
      recurringPattern: data.recurring_pattern,
      triggerContext: data.trigger_context,
      actionType: data.action_type,
      actionDetails: data.action_details,
      dependencies: data.dependencies,
      userFeedback: data.user_feedback,
      completionRate: data.completion_rate,
      adaptationHistory: data.adaptation_history || [],
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      userId: data.user_id
    };
  }

  // Placeholder implementations for complex features
  private async getUserActivityPatterns(userId: string): Promise<any> {
    return { preferredHours: [9, 14, 16], focusHours: [10, 11, 15] };
  }

  private findOptimalReminderTime(patterns: any): Date {
    return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  }

  private findOptimalFocusTime(patterns: any): Date {
    return new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  }

  private findGeneralOptimalTime(patterns: any): Date {
    return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
  }

  private calculateFollowUpTime(task: ProactiveTask): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  }

  private async checkForRecurringPatterns(context: TaskCreationContext): Promise<void> {
    // Analyze patterns and create recurring tasks
  }

  private async updateUserPatterns(context: TaskCreationContext): Promise<void> {
    // Update user behavior patterns
  }

  private async createNextRecurrence(task: ProactiveTask): Promise<void> {
    // Create next occurrence of recurring task
  }

  private async createTasksForGoal(goal: Goal): Promise<void> {
    // Create initial tasks to work towards goal
  }

  // Public API methods
  public async getTasks(filters?: any): Promise<ProactiveTask[]> {
    return Array.from(this.tasks.values()).filter(task => {
      if (filters?.status && task.status !== filters.status) {return false;}
      if (filters?.category && task.category !== filters.category) {return false;}
      if (filters?.priority && task.priority !== filters.priority) {return false;}
      return true;
    });
  }

  public async getGoals(): Promise<Goal[]> {
    return Array.from(this.goals.values());
  }

  public async completeTask(taskId: string, userFeedback?: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {return false;}
    
    task.status = 'completed';
    task.completedAt = new Date();
    task.updatedAt = new Date();
    
    if (userFeedback) {
      task.userFeedback = userFeedback as any;
    }
    
    await this.saveTaskToDatabase(task);
    this.emit('taskCompleted', task);
    
    // Update related goal progress
    for (const [_, goal] of this.goals.entries()) {
      if (goal.relatedTasks.includes(taskId)) {
        await this.updateGoalProgress(goal.id);
      }
    }
    
    return true;
  }

  public async deferTask(taskId: string, newScheduledTime: Date): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {return false;}
    
    task.status = 'deferred';
    task.scheduledFor = newScheduledTime;
    task.updatedAt = new Date();
    
    await this.saveTaskToDatabase(task);
    this.scheduleTask(task);
    
    return true;
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {return false;}
    
    task.status = 'cancelled';
    task.updatedAt = new Date();
    
    await this.saveTaskToDatabase(task);
    this.emit('taskCancelled', task);
    
    return true;
  }

  // Additional public methods for router compatibility
  public getStatus(): { status: string; activeTasks: number; completedTasks: number } {
    const allTasks = Array.from(this.tasks.values());
    const activeTasks = allTasks.filter(t => ['created', 'scheduled', 'in_progress'].includes(t.status)).length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    
    return {
      status: 'active',
      activeTasks,
      completedTasks
    };
  }

  public async getUserTasks(userId: string): Promise<ProactiveTask[]> {
    // Filter tasks by userId if available in task context
    const allTasks = Array.from(this.tasks.values());
    return allTasks.filter(task => 
      task.triggerContext.conversationId?.includes(userId) || 
      task.userId === userId
    );
  }

  public async updateTask(taskId: string, updates: Partial<ProactiveTask>): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {return false;}

    const updatedTask = { ...task, ...updates, updatedAt: new Date() };
    this.tasks.set(taskId, updatedTask);
    
    await this.saveTaskToDatabase(updatedTask);
    this.emit('taskUpdated', updatedTask);
    
    return true;
  }

  public async deleteTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {return false;}

    this.tasks.delete(taskId);
    
    this.emit('taskDeleted', task);
    
    return true;
  }

  public async getTaskSuggestions(userId: string): Promise<any[]> {
    const suggestions = [];
    
    // Analyze user patterns and suggest tasks
    const userTasks = await this.getUserTasks(userId);
    const recentTasks = userTasks
      .filter(t => t.createdAt && new Date(t.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .slice(0, 10);

    // Suggest follow-ups for completed tasks
    const completedTasks = recentTasks.filter(t => t.status === 'completed');
    for (const task of completedTasks) {
      if (task.category === 'research') {
        suggestions.push({
          type: 'follow_up',
          title: `Follow up on ${task.title}`,
          description: `Create action items based on your research`,
          priority: 'medium',
          estimatedDuration: 15
        });
      }
    }

    // Suggest routine tasks based on patterns
    const routineTasks = recentTasks.filter(t => t.recurringPattern);
    if (routineTasks.length > 0) {
      suggestions.push({
        type: 'routine',
        title: 'Daily Check-in',
        description: 'Review progress and plan for today',
        priority: 'low',
        estimatedDuration: 10
      });
    }

    return suggestions;
  }
}

// Export singleton instance
export const proactiveTaskManager = new ProactiveTaskManager();
export default proactiveTaskManager;