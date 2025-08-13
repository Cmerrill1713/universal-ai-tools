import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
const execAsync = promisify(exec);
export class EnvironmentalAwarenessService extends EventEmitter {
    systemResources = null;
    applicationState = null;
    userContext = null;
    environmentalTriggers = new Map();
    contextualRules = new Map();
    notificationQueue = [];
    supabase;
    isInitialized = false;
    systemMonitorInterval = null;
    applicationMonitorInterval = null;
    userContextMonitorInterval = null;
    triggerCheckInterval = null;
    notificationProcessorInterval = null;
    lastSystemCheck = null;
    presenceDetectionHistory = [];
    activityHistory = [];
    constructor() {
        super();
        this.initializeService();
    }
    async initializeService() {
        try {
            if (config.supabase.url && config.supabase.serviceKey) {
                this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            }
            await this.loadEnvironmentalTriggers();
            await this.loadContextualRules();
            this.startSystemMonitoring();
            this.startApplicationMonitoring();
            this.startUserContextMonitoring();
            this.startTriggerChecking();
            this.startNotificationProcessing();
            await this.gatherInitialState();
            this.isInitialized = true;
            log.info('✅ Environmental Awareness Service initialized', LogContext.AI, {
                triggers: this.environmentalTriggers.size,
                rules: this.contextualRules.size
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize Environmental Awareness Service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    startSystemMonitoring() {
        this.systemMonitorInterval = setInterval(async () => {
            await this.updateSystemResources();
        }, 15000);
    }
    async updateSystemResources() {
        try {
            const resources = {
                cpu: await this.getCPUInfo(),
                memory: await this.getMemoryInfo(),
                disk: await this.getDiskInfo(),
                network: await this.getNetworkInfo(),
                battery: await this.getBatteryInfo()
            };
            const previousResources = this.systemResources;
            this.systemResources = resources;
            this.lastSystemCheck = new Date();
            if (previousResources) {
                this.detectSystemChanges(previousResources, resources);
            }
            this.emit('systemResourcesUpdated', resources);
        }
        catch (error) {
            log.error('❌ Error updating system resources', LogContext.AI, { error });
        }
    }
    async getCPUInfo() {
        try {
            const { stdout: cpuUsage } = await execAsync("ps -A -o %cpu | awk '{s+=$1} END {print s}'");
            const { stdout: loadAvg } = await execAsync('uptime | grep -oE "load averages: [0-9.,]+" | grep -oE "[0-9.]+"');
            const cores = parseInt((await execAsync('sysctl -n hw.ncpu')).stdout.trim());
            return {
                usage: parseFloat(cpuUsage.trim()),
                cores,
                loadAverage: loadAvg.trim().split('\n').map(l => parseFloat(l)).filter(n => !isNaN(n))
            };
        }
        catch (error) {
            return { usage: 0, cores: 1, loadAverage: [0, 0, 0] };
        }
    }
    async getMemoryInfo() {
        try {
            const { stdout } = await execAsync('vm_stat | grep -E "Pages (free|active|inactive|wired|compressed)" | grep -oE "[0-9]+"');
            const pages = stdout.trim().split('\n').map(n => parseInt(n));
            const pageSize = 4096;
            const totalPages = pages.reduce((sum, p) => sum + p, 0);
            const total = totalPages * pageSize;
            const available = (pages[0] ?? 0) * pageSize;
            const used = total - available;
            return {
                total,
                used,
                available,
                usagePercent: (used / total) * 100
            };
        }
        catch (error) {
            return { total: 0, used: 0, available: 0, usagePercent: 0 };
        }
    }
    async getDiskInfo() {
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
        }
        catch (error) {
            return { total: 0, used: 0, available: 0, usagePercent: 0 };
        }
    }
    async getNetworkInfo() {
        try {
            const { stdout } = await execAsync('netstat -ib | grep -E "en[0-9]" | head -1');
            const parts = stdout.trim().split(/\s+/);
            return {
                bytesReceived: parseInt(parts[6] ?? '0') || 0,
                bytesSent: parseInt(parts[9] ?? '0') || 0,
                packetsReceived: parseInt(parts[4] ?? '0') || 0,
                packetsSent: parseInt(parts[7] ?? '0') || 0,
                connected: true
            };
        }
        catch (error) {
            return { bytesReceived: 0, bytesSent: 0, packetsReceived: 0, packetsSent: 0, connected: false };
        }
    }
    async getBatteryInfo() {
        try {
            const { stdout } = await execAsync('pmset -g batt | grep -oE "[0-9]+%" | head -1');
            const level = parseInt(stdout.trim().replace('%', ''));
            const { stdout: charging } = await execAsync('pmset -g batt | grep -c "AC Power"');
            const isCharging = parseInt(charging.trim()) > 0;
            return { level, isCharging };
        }
        catch (error) {
            return undefined;
        }
    }
    startApplicationMonitoring() {
        this.applicationMonitorInterval = setInterval(async () => {
            await this.updateApplicationState();
        }, 10000);
    }
    async updateApplicationState() {
        try {
            const state = {
                activeApplications: await this.getActiveApplications(),
                focusedApplication: await this.getFocusedApplication(),
                recentlyUsed: await this.getRecentlyUsedApplications()
            };
            this.applicationState = state;
            this.emit('applicationStateUpdated', state);
        }
        catch (error) {
            log.error('❌ Error updating application state', LogContext.AI, { error });
        }
    }
    async getActiveApplications() {
        try {
            const { stdout } = await execAsync('ps -axo pid,pcpu,pmem,comm | grep -v grep | tail -n +2');
            const processes = stdout.trim().split('\n').map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parseInt(parts[0] ?? '0'),
                    cpuUsage: parseFloat(parts[1] ?? '0'),
                    memoryUsage: parseFloat(parts[2] ?? '0'),
                    name: parts.slice(3).join(' '),
                    windowCount: 1
                };
            });
            return processes
                .filter(p => p.cpuUsage > 0.1 || p.memoryUsage > 0.1)
                .sort((a, b) => b.cpuUsage - a.cpuUsage)
                .slice(0, 20);
        }
        catch (error) {
            return [];
        }
    }
    async getFocusedApplication() {
        try {
            const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`);
            const appName = stdout.trim().replace(/"/g, '');
            const { stdout: windowTitle } = await execAsync(`osascript -e 'tell application "System Events" to get title of front window of first application process whose frontmost is true'`);
            return {
                name: appName,
                windowTitle: windowTitle.trim().replace(/"/g, ''),
                pid: 0
            };
        }
        catch (error) {
            return null;
        }
    }
    async getRecentlyUsedApplications() {
        return [];
    }
    startUserContextMonitoring() {
        this.userContextMonitorInterval = setInterval(async () => {
            await this.updateUserContext();
        }, 30000);
    }
    async updateUserContext() {
        try {
            const context = {
                presence: await this.detectUserPresence(),
                idleTime: await this.getIdleTime(),
                currentActivity: await this.detectCurrentActivity(),
                location: await this.getLocationContext(),
                schedule: await this.getScheduleContext()
            };
            this.userContext = context;
            this.updatePresenceHistory(context.presence);
            this.emit('userContextUpdated', context);
        }
        catch (error) {
            log.error('❌ Error updating user context', LogContext.AI, { error });
        }
    }
    async detectUserPresence() {
        try {
            const idleTime = await this.getIdleTime();
            if (idleTime < 30000)
                return 'active';
            if (idleTime < 300000)
                return 'idle';
            if (idleTime < 3600000)
                return 'away';
            try {
                const { stdout } = await execAsync('pmset -g | grep -i sleep');
                if (stdout.includes('sleep'))
                    return 'sleeping';
            }
            catch { }
            return 'away';
        }
        catch (error) {
            return 'unknown';
        }
    }
    async getIdleTime() {
        try {
            const { stdout } = await execAsync('ioreg -c IOHIDSystem | grep HIDIdleTime');
            const match = stdout.match(/HIDIdleTime"=(\d+)/);
            if (match && match[1]) {
                return Math.floor(parseInt(match[1]) / 1000000);
            }
        }
        catch (error) {
        }
        return 0;
    }
    async detectCurrentActivity() {
        const focusedApp = this.applicationState?.focusedApplication;
        if (!focusedApp) {
            return { type: 'unknown', confidence: 0 };
        }
        const appName = focusedApp.name.toLowerCase();
        const windowTitle = focusedApp.windowTitle.toLowerCase();
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
    async getLocationContext() {
        try {
            const { stdout: timezone } = await execAsync('date +%Z');
            return {
                timezone: timezone.trim(),
                country: 'US',
                city: 'Unknown'
            };
        }
        catch (error) {
            return undefined;
        }
    }
    async getScheduleContext() {
        return {
            workingHours: { start: 9, end: 17 },
            workingDays: [1, 2, 3, 4, 5]
        };
    }
    startTriggerChecking() {
        this.triggerCheckInterval = setInterval(async () => {
            await this.checkEnvironmentalTriggers();
        }, 60000);
    }
    async checkEnvironmentalTriggers() {
        for (const [id, trigger] of Array.from(this.environmentalTriggers.entries())) {
            if (!trigger.enabled)
                continue;
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
    async evaluateTriggerCondition(trigger) {
        const { condition } = trigger;
        const results = [];
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
    evaluateSystemResourceRule(rule) {
        if (!this.systemResources)
            return false;
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
    evaluateApplicationStateRule(rule) {
        if (!this.applicationState)
            return false;
        switch (rule.type) {
            case 'focused_app':
                return this.applicationState.focusedApplication?.name.toLowerCase().includes(rule.value.toLowerCase()) || false;
            case 'running_app':
                return this.applicationState.activeApplications.some(app => app.name.toLowerCase().includes(rule.value.toLowerCase()));
            case 'app_cpu_usage':
                const app = this.applicationState.activeApplications.find(a => a.name.toLowerCase().includes(rule.appName.toLowerCase()));
                return app ? this.compareValue(app.cpuUsage, rule.operator, rule.value) : false;
            default:
                return false;
        }
    }
    evaluateUserContextRule(rule) {
        if (!this.userContext)
            return false;
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
    evaluateTimeBasedRule(rule) {
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
    async evaluateCompositeRule(rule) {
        const results = await Promise.all(rule.conditions.map(async (condition) => {
            const trigger = { condition };
            return await this.evaluateTriggerCondition(trigger);
        }));
        return rule.operator === 'AND' ? results.every(r => r) : results.some(r => r);
    }
    compareValue(actual, operator, expected) {
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
    async executeTriggerAction(trigger) {
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
    startNotificationProcessing() {
        this.notificationProcessorInterval = setInterval(async () => {
            await this.processNotificationQueue();
        }, 30000);
    }
    async queueSmartNotification(notification) {
        const smartNotification = {
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
    async calculateContextScore(notification) {
        let score = 0.5;
        if (!this.userContext)
            return score;
        switch (this.userContext.presence) {
            case 'active':
                score += 0.3;
                break;
            case 'idle':
                score += 0.1;
                break;
            case 'away':
                score -= 0.2;
                break;
            case 'do_not_disturb':
                score -= 0.4;
                break;
            case 'sleeping':
                score -= 0.5;
                break;
        }
        if (this.userContext.currentActivity.type === 'meeting') {
            score -= 0.3;
        }
        else if (this.userContext.currentActivity.type === 'coding') {
            score += 0.1;
        }
        switch (notification.priority) {
            case 'urgent':
                score += 0.4;
                break;
            case 'high':
                score += 0.2;
                break;
            case 'low':
                score -= 0.1;
                break;
        }
        return Math.max(0, Math.min(1, score));
    }
    async determineDeliveryMethod(notification) {
        if (notification.priority === 'urgent') {
            return 'immediate';
        }
        if (!this.userContext)
            return 'smart_timing';
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
    async processNotificationQueue() {
        const now = new Date();
        const readyNotifications = this.notificationQueue.filter(notification => {
            if (notification.delivered)
                return false;
            switch (notification.deliveryMethod) {
                case 'immediate':
                    return true;
                case 'smart_timing':
                    return this.isOptimalNotificationTime();
                case 'batch':
                    return now.getMinutes() === 0;
                case 'defer':
                    return notification.scheduledFor ? now >= notification.scheduledFor : false;
                default:
                    return true;
            }
        });
        for (const notification of readyNotifications) {
            await this.deliverNotification(notification);
            notification.delivered = true;
            const index = this.notificationQueue.indexOf(notification);
            if (index > -1) {
                this.notificationQueue.splice(index, 1);
            }
        }
    }
    isOptimalNotificationTime() {
        if (!this.userContext)
            return true;
        if (['away', 'sleeping', 'do_not_disturb'].includes(this.userContext.presence)) {
            return false;
        }
        if (this.userContext.currentActivity.type === 'meeting') {
            return false;
        }
        return this.userContext.presence === 'active' &&
            !['coding', 'gaming'].includes(this.userContext.currentActivity.type);
    }
    async deliverNotification(notification) {
        log.info('📬 Delivering smart notification', LogContext.AI, {
            notificationId: notification.id,
            title: notification.title,
            priority: notification.priority
        });
        this.emit('notificationDelivered', notification);
    }
    parseSize(sizeStr) {
        const units = { 'K': 1024, 'M': 1024 * 1024, 'G': 1024 * 1024 * 1024, 'T': 1024 * 1024 * 1024 * 1024 };
        const match = sizeStr.match(/([0-9.]+)([KMGT])/);
        if (match && match[1] && match[2]) {
            return parseFloat(match[1]) * (units[match[2]] || 1);
        }
        return parseFloat(sizeStr) || 0;
    }
    detectSystemChanges(previous, current) {
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
    updatePresenceHistory(presence) {
        this.presenceDetectionHistory.push({
            presence,
            timestamp: new Date()
        });
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.presenceDetectionHistory = this.presenceDetectionHistory.filter(entry => entry.timestamp.getTime() > cutoff);
    }
    async gatherInitialState() {
        await Promise.all([
            this.updateSystemResources(),
            this.updateApplicationState(),
            this.updateUserContext()
        ]);
    }
    async loadEnvironmentalTriggers() {
        const defaultTriggers = [
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
    async loadContextualRules() {
        const defaultRules = [
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
    doesRuleApply(rule) {
        if (!this.userContext)
            return false;
        const { conditions } = rule;
        if (conditions.presence && !conditions.presence.includes(this.userContext.presence)) {
            return false;
        }
        if (conditions.activity && !conditions.activity.includes(this.userContext.currentActivity.type)) {
            return false;
        }
        if (conditions.timeRanges) {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            const inTimeRange = conditions.timeRanges.some(range => {
                const inHours = hour >= range.start && hour <= range.end;
                const inDays = !range.days || range.days.includes(day);
                return inHours && inDays;
            });
            if (!inTimeRange)
                return false;
        }
        if (conditions.systemLoad && this.systemResources) {
            if (this.systemResources.cpu.usage > conditions.systemLoad.max) {
                return false;
            }
        }
        return true;
    }
    async executeSystemAdjustment(parameters) {
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
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    getSystemResources() {
        return this.systemResources;
    }
    getApplicationState() {
        return this.applicationState;
    }
    getUserContext() {
        return this.userContext;
    }
    getEnvironmentalTriggers() {
        return Array.from(this.environmentalTriggers.values());
    }
    getContextualRules() {
        return Array.from(this.contextualRules.values());
    }
    getPendingNotifications() {
        return this.notificationQueue.filter(n => !n.delivered);
    }
    async addEnvironmentalTrigger(trigger) {
        const id = this.generateId('trigger');
        const fullTrigger = {
            ...trigger,
            id,
            triggerCount: 0
        };
        this.environmentalTriggers.set(id, fullTrigger);
        this.emit('triggerAdded', fullTrigger);
        return id;
    }
    async removeEnvironmentalTrigger(triggerId) {
        const removed = this.environmentalTriggers.delete(triggerId);
        if (removed) {
            this.emit('triggerRemoved', triggerId);
        }
        return removed;
    }
    async addContextualRule(rule) {
        const id = this.generateId('rule');
        const fullRule = { ...rule, id };
        this.contextualRules.set(id, fullRule);
        this.emit('ruleAdded', fullRule);
        return id;
    }
    async updateTriggerEnabled(triggerId, enabled) {
        const trigger = this.environmentalTriggers.get(triggerId);
        if (trigger) {
            trigger.enabled = enabled;
            this.emit('triggerUpdated', trigger);
            return true;
        }
        return false;
    }
    isOptimalTimeForAction(actionType) {
        if (!this.userContext)
            return true;
        const applicableRules = Array.from(this.contextualRules.values())
            .filter(rule => rule.enabled && this.doesRuleApply(rule));
        for (const rule of applicableRules) {
            if (rule.actions.delayActions) {
                return false;
            }
        }
        if (['away', 'sleeping', 'do_not_disturb'].includes(this.userContext.presence)) {
            return false;
        }
        if (this.userContext.currentActivity.type === 'meeting') {
            return false;
        }
        return true;
    }
    getEnvironmentalContext() {
        return {
            system: this.systemResources,
            applications: this.applicationState,
            user: this.userContext,
            timestamp: new Date(),
            isOptimalTime: this.isOptimalTimeForAction('general')
        };
    }
    getStatus() {
        return {
            status: this.isInitialized ? 'active' : 'initializing',
            initialized: this.isInitialized,
            lastUpdate: this.lastSystemCheck || undefined
        };
    }
    getCurrentContext() {
        return this.getEnvironmentalContext();
    }
    getTimeContext() {
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
    getDeviceContext() {
        return {
            system: this.systemResources,
            applications: this.applicationState?.activeApplications || [],
            focused: this.applicationState?.focusedApplication || null,
            lastUpdate: this.lastSystemCheck?.toISOString()
        };
    }
    async updateActivity(activityType, metadata) {
        if (this.userContext) {
            this.userContext.currentActivity = {
                type: activityType,
                confidence: 0.8,
                details: metadata
            };
            this.activityHistory.push({
                activity: activityType,
                timestamp: new Date(),
                duration: 0
            });
            if (this.activityHistory.length > 100) {
                this.activityHistory = this.activityHistory.slice(-50);
            }
            this.emit('activityUpdated', this.userContext.currentActivity);
        }
    }
    getContextualRecommendations() {
        const recommendations = [];
        if (!this.isInitialized || !this.systemResources || !this.userContext) {
            return recommendations;
        }
        if (this.systemResources.cpu.usage > 80) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'High CPU usage detected. Consider closing unused applications.',
                action: 'optimize_performance'
            });
        }
        if (this.systemResources.memory.usagePercent > 85) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: 'Memory usage is high. Restart resource-heavy applications.',
                action: 'manage_memory'
            });
        }
        if (this.systemResources.battery && this.systemResources.battery.level < 20 && !this.systemResources.battery.isCharging) {
            recommendations.push({
                type: 'power',
                priority: 'high',
                message: 'Battery is low. Consider enabling power saving mode.',
                action: 'save_power'
            });
        }
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
export const environmentalAwarenessService = new EnvironmentalAwarenessService();
export default environmentalAwarenessService;
//# sourceMappingURL=environmental-awareness-service.js.map