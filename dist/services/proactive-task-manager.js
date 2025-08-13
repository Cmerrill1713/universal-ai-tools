import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
export class ProactiveTaskManager extends EventEmitter {
    supabase;
    tasks = new Map();
    goals = new Map();
    schedulingTimer = null;
    isInitialized = false;
    userPatterns = new Map();
    contextualTriggers = new Map();
    constructor() {
        super();
        this.initializeService();
    }
    async initializeService() {
        try {
            if (!config.supabase.url || !config.supabase.serviceKey) {
                throw new Error('Supabase configuration missing for Proactive Task Manager');
            }
            this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            await this.loadTasksFromDatabase();
            await this.loadGoalsFromDatabase();
            this.setupContextualTriggers();
            this.startSchedulingLoop();
            this.isInitialized = true;
            log.info('✅ Proactive Task Manager initialized', LogContext.AI, {
                loadedTasks: this.tasks.size,
                loadedGoals: this.goals.size
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize Proactive Task Manager', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async analyzeConversationForTasks(context) {
        if (!this.isInitialized)
            return [];
        const createdTasks = [];
        try {
            const analysis = await this.analyzeMessageIntent(context.userMessage || '');
            for (const intent of analysis.intents) {
                if (intent.confidence > 0.7 && intent.actionable) {
                    const task = await this.createTaskFromIntent(intent, context);
                    if (task) {
                        createdTasks.push(task);
                    }
                }
            }
            await this.checkForRecurringPatterns(context);
            await this.updateUserPatterns(context);
        }
        catch (error) {
            log.error('❌ Error analyzing conversation for tasks', LogContext.AI, { error });
        }
        return createdTasks;
    }
    async createTask(taskData, context) {
        const task = {
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
        this.tasks.set(task.id, task);
        await this.saveTaskToDatabase(task);
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
    async smartScheduleTask(task, userPreferences) {
        const userPatterns = await this.getUserActivityPatterns(task.userId || 'default');
        let optimalTime;
        switch (task.category) {
            case 'reminder':
                optimalTime = this.findOptimalReminderTime(userPatterns);
                break;
            case 'research':
                optimalTime = this.findOptimalFocusTime(userPatterns);
                break;
            case 'follow_up':
                optimalTime = this.calculateFollowUpTime(task);
                break;
            default:
                optimalTime = this.findGeneralOptimalTime(userPatterns);
        }
        if (task.priority === 'urgent') {
            optimalTime = new Date(Date.now() + 5 * 60 * 1000);
        }
        else if (task.priority === 'high') {
            optimalTime = new Date(Math.min(optimalTime.getTime(), Date.now() + 2 * 60 * 60 * 1000));
        }
        task.scheduledFor = optimalTime;
        task.updatedAt = new Date();
        await this.saveTaskToDatabase(task);
        this.scheduleTask(task);
        return optimalTime;
    }
    async executeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task)
            return false;
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
                if (task.recurringPattern) {
                    await this.createNextRecurrence(task);
                }
                log.info('✅ Task executed successfully', LogContext.AI, { taskId: task.id });
            }
            else {
                task.status = 'created';
                log.warn('❌ Task execution failed', LogContext.AI, { taskId: task.id });
            }
            await this.saveTaskToDatabase(task);
            this.emit('taskExecuted', task, success);
            return success;
        }
        catch (error) {
            log.error('❌ Error executing task', LogContext.AI, {
                taskId,
                error: error instanceof Error ? error.message : String(error)
            });
            task.status = 'created';
            await this.saveTaskToDatabase(task);
            return false;
        }
    }
    async createGoal(goalData) {
        const goal = {
            id: this.generateGoalId(),
            title: goalData.title || 'Untitled Goal',
            description: goalData.description || '',
            category: goalData.category || 'general',
            targetDate: goalData.targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
        await this.createTasksForGoal(goal);
        log.info('✅ Created goal', LogContext.AI, {
            goalId: goal.id,
            title: goal.title,
            targetDate: goal.targetDate
        });
        this.emit('goalCreated', goal);
        return goal;
    }
    async updateGoalProgress(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal)
            return;
        const relatedTasks = goal.relatedTasks
            .map(id => this.tasks.get(id))
            .filter(task => task);
        const completedTasks = relatedTasks.filter(task => task.status === 'completed');
        const progressFromTasks = relatedTasks.length > 0 ? completedTasks.length / relatedTasks.length : 0;
        const completedMilestones = goal.milestones.filter(m => m.completed);
        const progressFromMilestones = goal.milestones.length > 0 ? completedMilestones.length / goal.milestones.length : 0;
        goal.progress = (progressFromTasks * 0.6) + (progressFromMilestones * 0.4);
        goal.updatedAt = new Date();
        if (goal.progress >= 1.0 && goal.status === 'active') {
            goal.status = 'completed';
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
    async analyzeMessageIntent(message) {
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
    async createTaskFromIntent(intent, context) {
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
                    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
                    estimatedDuration: 30,
                    createdBy: 'conversation_analysis'
                }, context);
            default:
                return null;
        }
    }
    setupContextualTriggers() {
        this.contextualTriggers.set('timeBasedReminder', (context) => {
        });
        this.contextualTriggers.set('locationBasedTask', (context) => {
        });
        this.contextualTriggers.set('activityBasedSuggestion', (context) => {
        });
    }
    startSchedulingLoop() {
        this.schedulingTimer = setInterval(async () => {
            await this.checkScheduledTasks();
        }, 60 * 1000);
    }
    async checkScheduledTasks() {
        const now = new Date();
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.status === 'scheduled' &&
                task.scheduledFor &&
                task.scheduledFor <= now) {
                await this.executeTask(taskId);
            }
        }
    }
    scheduleTask(task) {
        if (!task.scheduledFor)
            return;
        const delay = task.scheduledFor.getTime() - Date.now();
        if (delay <= 0) {
            this.executeTask(task.id);
        }
        else {
            setTimeout(() => {
                this.executeTask(task.id);
            }, delay);
            task.status = 'scheduled';
        }
    }
    async sendNotification(task) {
        log.info('📢 Sending notification', LogContext.AI, {
            taskId: task.id,
            title: task.title
        });
        this.emit('notification', {
            type: 'task',
            title: task.title,
            description: task.description,
            priority: task.priority,
            taskId: task.id
        });
        return true;
    }
    async sendReminder(task) {
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
    async executeApiCall(task) {
        log.info('🔗 Executing API call', LogContext.AI, {
            taskId: task.id,
            apiDetails: task.actionDetails
        });
        return true;
    }
    async executeFileOperation(task) {
        log.info('📁 Executing file operation', LogContext.AI, {
            taskId: task.id,
            operation: task.actionDetails
        });
        return true;
    }
    async executeResearchTask(task) {
        log.info('🔍 Executing research task', LogContext.AI, {
            taskId: task.id,
            topic: task.actionDetails.researchTopic
        });
        return true;
    }
    async executeMultiStepTask(task) {
        log.info('📋 Executing multi-step task', LogContext.AI, {
            taskId: task.id,
            steps: task.actionDetails.steps
        });
        return true;
    }
    async loadTasksFromDatabase() {
        try {
            const { data, error } = await this.supabase
                .from('proactive_tasks')
                .select('*')
                .eq('status', 'scheduled')
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            for (const taskData of data || []) {
                const task = this.deserializeTask(taskData);
                this.tasks.set(task.id, task);
                if (task.scheduledFor) {
                    this.scheduleTask(task);
                }
            }
        }
        catch (error) {
            log.error('❌ Error loading tasks from database', LogContext.AI, { error });
        }
    }
    async saveTaskToDatabase(task) {
        try {
            const { error } = await this.supabase
                .from('proactive_tasks')
                .upsert(this.serializeTask(task));
            if (error)
                throw error;
        }
        catch (error) {
            log.error('❌ Error saving task to database', LogContext.AI, { error });
        }
    }
    async loadGoalsFromDatabase() {
    }
    async saveGoalToDatabase(goal) {
    }
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    generateGoalId() {
        return `goal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    serializeTask(task) {
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
    deserializeTask(data) {
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
    async getUserActivityPatterns(userId) {
        return { preferredHours: [9, 14, 16], focusHours: [10, 11, 15] };
    }
    findOptimalReminderTime(patterns) {
        return new Date(Date.now() + 60 * 60 * 1000);
    }
    findOptimalFocusTime(patterns) {
        return new Date(Date.now() + 2 * 60 * 60 * 1000);
    }
    findGeneralOptimalTime(patterns) {
        return new Date(Date.now() + 30 * 60 * 1000);
    }
    calculateFollowUpTime(task) {
        return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    async checkForRecurringPatterns(context) {
    }
    async updateUserPatterns(context) {
    }
    async createNextRecurrence(task) {
    }
    async createTasksForGoal(goal) {
    }
    async getTasks(filters) {
        return Array.from(this.tasks.values()).filter(task => {
            if (filters?.status && task.status !== filters.status)
                return false;
            if (filters?.category && task.category !== filters.category)
                return false;
            if (filters?.priority && task.priority !== filters.priority)
                return false;
            return true;
        });
    }
    async getGoals() {
        return Array.from(this.goals.values());
    }
    async completeTask(taskId, userFeedback) {
        const task = this.tasks.get(taskId);
        if (!task)
            return false;
        task.status = 'completed';
        task.completedAt = new Date();
        task.updatedAt = new Date();
        if (userFeedback) {
            task.userFeedback = userFeedback;
        }
        await this.saveTaskToDatabase(task);
        this.emit('taskCompleted', task);
        for (const [_, goal] of this.goals.entries()) {
            if (goal.relatedTasks.includes(taskId)) {
                await this.updateGoalProgress(goal.id);
            }
        }
        return true;
    }
    async deferTask(taskId, newScheduledTime) {
        const task = this.tasks.get(taskId);
        if (!task)
            return false;
        task.status = 'deferred';
        task.scheduledFor = newScheduledTime;
        task.updatedAt = new Date();
        await this.saveTaskToDatabase(task);
        this.scheduleTask(task);
        return true;
    }
    async cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task)
            return false;
        task.status = 'cancelled';
        task.updatedAt = new Date();
        await this.saveTaskToDatabase(task);
        this.emit('taskCancelled', task);
        return true;
    }
    getStatus() {
        const allTasks = Array.from(this.tasks.values());
        const activeTasks = allTasks.filter(t => ['created', 'scheduled', 'in_progress'].includes(t.status)).length;
        const completedTasks = allTasks.filter(t => t.status === 'completed').length;
        return {
            status: 'active',
            activeTasks,
            completedTasks
        };
    }
    async getUserTasks(userId) {
        const allTasks = Array.from(this.tasks.values());
        return allTasks.filter(task => task.triggerContext.conversationId?.includes(userId) ||
            task.userId === userId);
    }
    async updateTask(taskId, updates) {
        const task = this.tasks.get(taskId);
        if (!task)
            return false;
        const updatedTask = { ...task, ...updates, updatedAt: new Date() };
        this.tasks.set(taskId, updatedTask);
        await this.saveTaskToDatabase(updatedTask);
        this.emit('taskUpdated', updatedTask);
        return true;
    }
    async deleteTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task)
            return false;
        this.tasks.delete(taskId);
        this.emit('taskDeleted', task);
        return true;
    }
    async getTaskSuggestions(userId) {
        const suggestions = [];
        const userTasks = await this.getUserTasks(userId);
        const recentTasks = userTasks
            .filter(t => t.createdAt && new Date(t.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
            .slice(0, 10);
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
export const proactiveTaskManager = new ProactiveTaskManager();
export default proactiveTaskManager;
//# sourceMappingURL=proactive-task-manager.js.map