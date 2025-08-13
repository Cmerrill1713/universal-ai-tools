import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
export class UserBehaviorLearningService extends EventEmitter {
    userInteractions = new Map();
    userPreferences = new Map();
    behaviorPatterns = new Map();
    personalizationModels = new Map();
    recommendations = new Map();
    userSessions = new Map();
    activeSessions = new Map();
    abTests = new Map();
    learningInsights = new Map();
    supabase;
    isInitialized = false;
    learningConfig = {
        minInteractionsForPattern: 3,
        patternDecayFactor: 0.95,
        preferenceConfidenceThreshold: 0.7,
        modelRetrainingInterval: 24 * 60 * 60 * 1000,
        maxInteractionsPerUser: 10000,
        sessionTimeoutMinutes: 30
    };
    patternAnalysisInterval = null;
    modelTrainingInterval = null;
    recommendationGenerationInterval = null;
    insightGenerationInterval = null;
    constructor() {
        super();
        this.initializeService();
    }
    async initializeService() {
        try {
            if (config.supabase.url && config.supabase.serviceKey) {
                this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            }
            await this.loadUserData();
            this.startPatternAnalysis();
            this.startModelTraining();
            this.startRecommendationGeneration();
            this.startInsightGeneration();
            this.setupSessionManagement();
            this.isInitialized = true;
            log.info('✅ User Behavior Learning Service initialized', LogContext.AI, {
                users: this.userInteractions.size,
                totalInteractions: Array.from(this.userInteractions.values()).reduce((sum, interactions) => sum + interactions.length, 0),
                patterns: Array.from(this.behaviorPatterns.values()).reduce((sum, patterns) => sum + patterns.length, 0),
                activeTests: Array.from(this.abTests.values()).filter(test => test.status === 'running').length
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize User Behavior Learning Service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async recordInteraction(interaction) {
        const fullInteraction = {
            ...interaction,
            id: this.generateId('interaction'),
            timestamp: new Date()
        };
        if (!this.userInteractions.has(interaction.userId)) {
            this.userInteractions.set(interaction.userId, []);
        }
        const userInteractions = this.userInteractions.get(interaction.userId);
        userInteractions.push(fullInteraction);
        if (userInteractions.length > this.learningConfig.maxInteractionsPerUser) {
            userInteractions.shift();
        }
        const session = this.getActiveSession(interaction.sessionId);
        if (session) {
            session.interactions.push(fullInteraction);
        }
        await this.processImediateInteraction(fullInteraction);
        log.info('📊 User interaction recorded', LogContext.AI, {
            userId: interaction.userId,
            type: interaction.type,
            context: interaction.context.action || interaction.context.component
        });
        this.emit('interactionRecorded', fullInteraction);
        return fullInteraction.id;
    }
    async startSession(userId, context) {
        const session = {
            id: this.generateId('session'),
            userId,
            startTime: new Date(),
            interactions: [],
            context: context || {},
            goals: []
        };
        this.activeSessions.set(session.id, session);
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, []);
        }
        this.userSessions.get(userId).push(session);
        log.info('🎯 User session started', LogContext.AI, {
            userId,
            sessionId: session.id
        });
        this.emit('sessionStarted', session);
        return session.id;
    }
    async endSession(sessionId, outcomes) {
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        session.endTime = new Date();
        session.outcomes = outcomes;
        await this.analyzeSession(session);
        this.activeSessions.delete(sessionId);
        log.info('🏁 User session ended', LogContext.AI, {
            sessionId,
            userId: session.userId,
            duration: session.endTime.getTime() - session.startTime.getTime(),
            interactions: session.interactions.length
        });
        this.emit('sessionEnded', session);
    }
    async recordPreference(userId, category, key, value, source = 'learned', confidence = 0.8) {
        if (!this.userPreferences.has(userId)) {
            this.userPreferences.set(userId, new Map());
        }
        const userPrefs = this.userPreferences.get(userId);
        const prefKey = `${category}:${key}`;
        const existing = userPrefs.get(prefKey);
        const preference = {
            id: existing?.id || this.generateId('pref'),
            userId,
            category,
            key,
            value,
            confidence,
            source,
            lastUpdated: new Date(),
            updateCount: (existing?.updateCount || 0) + 1,
            metadata: existing?.metadata
        };
        userPrefs.set(prefKey, preference);
        log.info('🎨 User preference recorded', LogContext.AI, {
            userId,
            category,
            key,
            source,
            confidence
        });
        this.emit('preferenceUpdated', preference);
    }
    getUserPreferences(userId, category) {
        const userPrefs = this.userPreferences.get(userId);
        if (!userPrefs)
            return [];
        const preferences = Array.from(userPrefs.values());
        return category ? preferences.filter(p => p.category === category) : preferences;
    }
    async inferPreferencesFromInteractions(userId) {
        const interactions = this.userInteractions.get(userId) || [];
        const recentInteractions = interactions.slice(-100);
        const uiElements = recentInteractions
            .filter(i => i.context.component)
            .reduce((acc, i) => {
            acc[i.context.component] = (acc[i.context.component] || 0) + 1;
            return acc;
        }, {});
        for (const [component, count] of Object.entries(uiElements)) {
            if (count > 5) {
                await this.recordPreference(userId, 'ui', `preferred_${component}`, true, 'inferred', 0.6);
            }
        }
        const hourUsage = recentInteractions.reduce((acc, i) => {
            const hour = i.timestamp.getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});
        const mostActiveHours = Object.entries(hourUsage)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([hour]) => parseInt(hour));
        if (mostActiveHours.length > 0) {
            await this.recordPreference(userId, 'timing', 'preferred_hours', mostActiveHours, 'inferred', 0.7);
        }
    }
    startPatternAnalysis() {
        this.patternAnalysisInterval = setInterval(async () => {
            await this.analyzeUserPatterns();
        }, 5 * 60 * 1000);
    }
    async analyzeUserPatterns() {
        for (const [userId, interactions] of this.userInteractions.entries()) {
            if (interactions.length < this.learningConfig.minInteractionsForPattern)
                continue;
            await this.identifySequencePatterns(userId, interactions);
            await this.identifyUsagePatterns(userId, interactions);
            await this.identifyPreferencePatterns(userId, interactions);
        }
    }
    async identifySequencePatterns(userId, interactions) {
        const sequences = this.extractSequences(interactions, 3);
        for (const sequence of sequences) {
            const patternId = this.generatePatternId(sequence);
            if (!this.behaviorPatterns.has(userId)) {
                this.behaviorPatterns.set(userId, []);
            }
            const userPatterns = this.behaviorPatterns.get(userId);
            const existing = userPatterns.find(p => p.id === patternId);
            if (existing) {
                existing.frequency++;
                existing.confidence = Math.min(1, existing.confidence + 0.1);
                existing.lastSeen = new Date();
            }
            else {
                const pattern = {
                    id: patternId,
                    userId,
                    name: `Sequence: ${sequence.map(s => s.type).join(' → ')}`,
                    description: `User tends to ${sequence.map(s => s.context.action || s.type).join(', then ')}`,
                    pattern: {
                        trigger: sequence[0]?.context || {},
                        sequence,
                        outcome: sequence[sequence.length - 1]?.outcome
                    },
                    frequency: 1,
                    confidence: 0.5,
                    contexts: Array.from(new Set(sequence.map(s => s.context.page).filter(Boolean))),
                    variations: [],
                    firstSeen: new Date(),
                    lastSeen: new Date()
                };
                userPatterns.push(pattern);
                log.info('🔍 New behavior pattern identified', LogContext.AI, {
                    userId,
                    patternName: pattern.name
                });
                this.emit('patternIdentified', pattern);
            }
        }
    }
    async identifyUsagePatterns(userId, interactions) {
        const hourlyUsage = interactions.reduce((acc, i) => {
            const hour = i.timestamp.getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});
        const dailyUsage = interactions.reduce((acc, i) => {
            const day = i.timestamp.getDay();
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});
        const peakHours = Object.entries(hourlyUsage)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([hour]) => parseInt(hour));
        if (peakHours.length > 0) {
            await this.recordPreference(userId, 'timing', 'peak_hours', peakHours, 'inferred');
        }
    }
    async identifyPreferencePatterns(userId, interactions) {
        const successfulInteractions = interactions.filter(i => i.outcome === 'success');
        const featureUsage = successfulInteractions.reduce((acc, i) => {
            if (i.context.action) {
                acc[i.context.action] = (acc[i.context.action] || 0) + 1;
            }
            return acc;
        }, {});
        for (const [feature, count] of Object.entries(featureUsage)) {
            if (count > 10) {
                await this.recordPreference(userId, 'workflow', `prefers_${feature}`, true, 'inferred', Math.min(1, count / 20));
            }
        }
    }
    startModelTraining() {
        this.modelTrainingInterval = setInterval(async () => {
            await this.trainPersonalizationModels();
        }, 60 * 60 * 1000);
    }
    async trainPersonalizationModels() {
        for (const [userId] of this.userInteractions.entries()) {
            await this.trainUserModels(userId);
        }
    }
    async trainUserModels(userId) {
        const interactions = this.userInteractions.get(userId) || [];
        if (interactions.length < 50)
            return;
        await this.trainPreferencePredictionModel(userId, interactions);
        await this.trainBehaviorPredictionModel(userId, interactions);
        await this.trainRecommendationModel(userId, interactions);
    }
    async trainPreferencePredictionModel(userId, interactions) {
        const modelId = `${userId}_preference_prediction`;
        if (!this.personalizationModels.has(userId)) {
            this.personalizationModels.set(userId, []);
        }
        const userModels = this.personalizationModels.get(userId);
        let model = userModels.find(m => m.modelType === 'preference_prediction');
        if (!model) {
            model = {
                id: modelId,
                userId,
                modelType: 'preference_prediction',
                algorithm: 'decision_tree',
                features: ['interaction_type', 'context', 'time_of_day', 'day_of_week', 'outcome'],
                parameters: {},
                performance: {
                    lastEvaluated: new Date()
                },
                trainingData: {
                    samples: 0,
                    lastTrained: new Date(),
                    version: 1
                },
                status: 'training'
            };
            userModels.push(model);
        }
        const trainingData = this.prepareTrainingData(interactions);
        model.trainingData.samples = trainingData.length;
        model.trainingData.lastTrained = new Date();
        model.trainingData.version++;
        model.status = 'ready';
        log.info('🤖 Preference prediction model trained', LogContext.AI, {
            userId,
            samples: model.trainingData.samples,
            version: model.trainingData.version
        });
        this.emit('modelTrained', model);
    }
    async trainBehaviorPredictionModel(userId, interactions) {
        log.info('🎯 Training behavior prediction model', LogContext.AI, { userId });
    }
    async trainRecommendationModel(userId, interactions) {
        log.info('💡 Training recommendation model', LogContext.AI, { userId });
    }
    startRecommendationGeneration() {
        this.recommendationGenerationInterval = setInterval(async () => {
            await this.generateRecommendations();
        }, 30 * 60 * 1000);
    }
    async generateRecommendations() {
        for (const [userId] of this.userInteractions.entries()) {
            await this.generateUserRecommendations(userId);
        }
    }
    async generateUserRecommendations(userId) {
        const interactions = this.userInteractions.get(userId) || [];
        const preferences = this.getUserPreferences(userId);
        const patterns = this.behaviorPatterns.get(userId) || [];
        if (!this.recommendations.has(userId)) {
            this.recommendations.set(userId, []);
        }
        const userRecommendations = this.recommendations.get(userId);
        const workflowRecommendations = await this.generateWorkflowRecommendations(userId, patterns);
        const settingRecommendations = await this.generateSettingRecommendations(userId, preferences);
        const featureRecommendations = await this.generateFeatureRecommendations(userId, interactions);
        const allRecommendations = [
            ...workflowRecommendations,
            ...settingRecommendations,
            ...featureRecommendations
        ];
        for (const rec of allRecommendations) {
            if (!userRecommendations.some(r => r.title === rec.title && r.status === 'pending')) {
                userRecommendations.push(rec);
                log.info('💡 Recommendation generated', LogContext.AI, {
                    userId,
                    title: rec.title,
                    confidence: rec.confidence
                });
                this.emit('recommendationGenerated', rec);
            }
        }
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
        this.recommendations.set(userId, userRecommendations.filter(r => r.createdAt.getTime() > cutoff || r.status !== 'pending'));
    }
    async generateWorkflowRecommendations(userId, patterns) {
        const recommendations = [];
        const inefficientPatterns = patterns.filter(p => p.frequency > 5 &&
            p.pattern.sequence.length > 4 &&
            p.confidence > 0.7);
        for (const pattern of inefficientPatterns) {
            recommendations.push({
                id: this.generateId('rec'),
                userId,
                type: 'workflow',
                title: 'Optimize Your Workflow',
                description: `We noticed you frequently ${pattern.description.toLowerCase()}. We can create a shortcut for this.`,
                reasoning: `You've performed this sequence ${pattern.frequency} times. A shortcut could save time.`,
                confidence: pattern.confidence,
                priority: pattern.frequency > 10 ? 'high' : 'medium',
                category: 'efficiency',
                metadata: {
                    action: { type: 'create_shortcut', pattern: pattern.id },
                    expectedBenefit: 'Save time on repetitive tasks',
                    effort: 'low'
                },
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        }
        return recommendations;
    }
    async generateSettingRecommendations(userId, preferences) {
        const recommendations = [];
        const timingPrefs = preferences.filter(p => p.category === 'timing');
        for (const pref of timingPrefs) {
            if (pref.key === 'peak_hours' && pref.confidence > 0.7) {
                recommendations.push({
                    id: this.generateId('rec'),
                    userId,
                    type: 'setting',
                    title: 'Optimize Notification Timing',
                    description: `Based on your usage patterns, we can optimize when you receive notifications.`,
                    reasoning: `You're most active during ${pref.value.join(', ')}. Notifications during these times would be more effective.`,
                    confidence: pref.confidence,
                    priority: 'medium',
                    category: 'personalization',
                    metadata: {
                        action: { type: 'update_notification_settings', peakHours: pref.value },
                        expectedBenefit: 'More relevant notification timing',
                        effort: 'low'
                    },
                    status: 'pending',
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                });
            }
        }
        return recommendations;
    }
    async generateFeatureRecommendations(userId, interactions) {
        const recommendations = [];
        const usedFeatures = new Set(interactions
            .filter(i => i.context.action)
            .map(i => i.context.action));
        const availableFeatures = ['voice_commands', 'keyboard_shortcuts', 'automation', 'templates'];
        const unusedFeatures = availableFeatures.filter(f => !usedFeatures.has(f));
        for (const feature of unusedFeatures.slice(0, 2)) {
            recommendations.push({
                id: this.generateId('rec'),
                userId,
                type: 'feature',
                title: `Try ${feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                description: `Based on your usage patterns, you might find ${feature} helpful.`,
                reasoning: 'Users with similar patterns have found this feature valuable.',
                confidence: 0.6,
                priority: 'low',
                category: 'discovery',
                metadata: {
                    action: { type: 'show_feature_tour', feature },
                    expectedBenefit: 'Discover new capabilities',
                    effort: 'medium'
                },
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }
        return recommendations;
    }
    async createABTest(testData) {
        const test = {
            ...testData,
            id: this.generateId('ab_test'),
            status: 'draft',
            startDate: new Date(),
            participants: new Map()
        };
        this.abTests.set(test.id, test);
        log.info('🧪 A/B test created', LogContext.AI, {
            testId: test.id,
            name: test.name,
            variants: test.variants.length
        });
        this.emit('abTestCreated', test);
        return test.id;
    }
    async startABTest(testId) {
        const test = this.abTests.get(testId);
        if (!test)
            return false;
        test.status = 'running';
        test.startDate = new Date();
        log.info('🧪 A/B test started', LogContext.AI, {
            testId,
            name: test.name
        });
        this.emit('abTestStarted', test);
        return true;
    }
    getABTestVariant(testId, userId) {
        const test = this.abTests.get(testId);
        if (!test || test.status !== 'running')
            return null;
        if (test.participants.has(userId)) {
            return test.participants.get(userId);
        }
        let cumulative = 0;
        const random = Math.random() * 100;
        for (const variant of test.variants) {
            cumulative += variant.allocation;
            if (random <= cumulative) {
                test.participants.set(userId, variant.id);
                return variant.id;
            }
        }
        return test.variants[0]?.id || null;
    }
    startInsightGeneration() {
        this.insightGenerationInterval = setInterval(async () => {
            await this.generateInsights();
        }, 2 * 60 * 60 * 1000);
    }
    async generateInsights() {
        for (const [userId] of this.userInteractions.entries()) {
            await this.generateUserInsights(userId);
        }
    }
    async generateUserInsights(userId) {
        const interactions = this.userInteractions.get(userId) || [];
        const preferences = this.getUserPreferences(userId);
        const patterns = this.behaviorPatterns.get(userId) || [];
        if (!this.learningInsights.has(userId)) {
            this.learningInsights.set(userId, []);
        }
        const userInsights = this.learningInsights.get(userId);
        const recentInteractions = interactions.slice(-100);
        const oldInteractions = interactions.slice(-200, -100);
        if (oldInteractions.length > 0 && recentInteractions.length > 0) {
            const insight = await this.analyzeBehaviorChange(userId, oldInteractions, recentInteractions);
            if (insight) {
                userInsights.push(insight);
                this.emit('insightGenerated', insight);
            }
        }
        const preferenceInsight = await this.analyzePreferenceEvolution(userId, preferences);
        if (preferenceInsight) {
            userInsights.push(preferenceInsight);
            this.emit('insightGenerated', preferenceInsight);
        }
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        this.learningInsights.set(userId, userInsights.filter(i => i.discoveredAt.getTime() > cutoff));
    }
    async analyzeBehaviorChange(userId, oldInteractions, recentInteractions) {
        const oldFeatures = this.extractFeatureUsage(oldInteractions);
        const recentFeatures = this.extractFeatureUsage(recentInteractions);
        for (const [feature, recentCount] of Object.entries(recentFeatures)) {
            const oldCount = oldFeatures[feature] || 0;
            const changeRatio = oldCount > 0 ? recentCount / oldCount : recentCount;
            if (changeRatio > 2) {
                return {
                    id: this.generateId('insight'),
                    userId,
                    type: 'behavior_changed',
                    insight: `User has significantly increased usage of ${feature} (${Math.round(changeRatio * 100)}% increase)`,
                    evidence: [
                        { period: 'old', usage: oldCount },
                        { period: 'recent', usage: recentCount }
                    ],
                    confidence: 0.8,
                    actionable: true,
                    recommendedActions: [`Consider providing advanced ${feature} features`],
                    discoveredAt: new Date(),
                    applied: false
                };
            }
        }
        return null;
    }
    async analyzePreferenceEvolution(userId, preferences) {
        const recentlyUpdated = preferences.filter(p => Date.now() - p.lastUpdated.getTime() < 7 * 24 * 60 * 60 * 1000 &&
            p.updateCount > 5 &&
            p.confidence > 0.8);
        if (recentlyUpdated.length > 0) {
            const pref = recentlyUpdated[0];
            if (pref) {
                return {
                    id: this.generateId('insight'),
                    userId,
                    type: 'preference_discovered',
                    insight: `Strong preference discovered: ${pref.category}:${pref.key} = ${JSON.stringify(pref.value)}`,
                    evidence: [{ preference: pref }],
                    confidence: pref.confidence,
                    actionable: true,
                    recommendedActions: [`Optimize UI/UX based on this preference`],
                    discoveredAt: new Date(),
                    applied: false
                };
            }
        }
        return null;
    }
    async processImediateInteraction(interaction) {
        if (interaction.outcome === 'success' && interaction.context.action) {
            await this.recordPreference(interaction.userId, 'workflow', `successful_${interaction.context.action}`, true, 'learned', 0.6);
        }
        if (interaction.outcome === 'failure') {
            await this.recordPreference(interaction.userId, 'workflow', `avoid_${interaction.context.action || interaction.type}`, true, 'learned', 0.7);
        }
    }
    async analyzeSession(session) {
        if (session.interactions.length < 2)
            return;
        if (session.outcomes?.successful) {
            const successfulSequence = session.interactions.filter(i => i.outcome === 'success');
            if (successfulSequence.length > 1) {
                await this.recordSuccessfulWorkflow(session.userId, successfulSequence);
            }
        }
    }
    async recordSuccessfulWorkflow(userId, sequence) {
        log.info('✅ Successful workflow recorded', LogContext.AI, {
            userId,
            steps: sequence.length,
            actions: sequence.map(s => s.context.action).filter(Boolean)
        });
    }
    extractSequences(interactions, length) {
        const sequences = [];
        for (let i = 0; i <= interactions.length - length; i++) {
            sequences.push(interactions.slice(i, i + length));
        }
        return sequences;
    }
    generatePatternId(sequence) {
        const signature = sequence.map(s => `${s.type}:${s.context.action || s.context.component}`).join('->');
        return `pattern_${Buffer.from(signature).toString('base64').substring(0, 10)}`;
    }
    prepareTrainingData(interactions) {
        return interactions.map(interaction => ({
            type: interaction.type,
            context: interaction.context,
            hour: interaction.timestamp.getHours(),
            day: interaction.timestamp.getDay(),
            outcome: interaction.outcome,
            duration: interaction.duration
        }));
    }
    extractFeatureUsage(interactions) {
        return interactions
            .filter(i => i.context.action)
            .reduce((acc, i) => {
            acc[i.context.action] = (acc[i.context.action] || 0) + 1;
            return acc;
        }, {});
    }
    getActiveSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }
    setupSessionManagement() {
        setInterval(() => {
            const cutoff = Date.now() - this.learningConfig.sessionTimeoutMinutes * 60 * 1000;
            for (const [sessionId, session] of this.activeSessions.entries()) {
                const lastInteraction = session.interactions[session.interactions.length - 1];
                if (lastInteraction && lastInteraction.timestamp.getTime() < cutoff) {
                    this.endSession(sessionId);
                }
            }
        }, 5 * 60 * 1000);
    }
    async loadUserData() {
        log.info('📊 Loading user behavior data', LogContext.AI);
    }
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    getUserInteractions(userId, limit) {
        const interactions = this.userInteractions.get(userId) || [];
        return limit ? interactions.slice(-limit) : interactions;
    }
    getUserPatterns(userId) {
        return this.behaviorPatterns.get(userId) || [];
    }
    getUserRecommendations(userId, status) {
        const recommendations = this.recommendations.get(userId) || [];
        return status ? recommendations.filter(r => r.status === status) : recommendations;
    }
    getUserInsights(userId) {
        return this.learningInsights.get(userId) || [];
    }
    async respondToRecommendation(recommendationId, response) {
        for (const [userId, recommendations] of this.recommendations.entries()) {
            const rec = recommendations.find(r => r.id === recommendationId);
            if (rec) {
                rec.status = response;
                rec.respondedAt = new Date();
                if (response === 'accepted') {
                    await this.recordPreference(userId, 'content', `likes_${rec.type}_recommendations`, true, 'learned', 0.8);
                }
                else if (response === 'rejected') {
                    await this.recordPreference(userId, 'content', `dislikes_${rec.category}_recommendations`, true, 'learned', 0.7);
                }
                this.emit('recommendationResponded', rec);
                return true;
            }
        }
        return false;
    }
    async setUserGoals(userId, sessionId, goals) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.goals = goals;
        }
        for (const goal of goals) {
            await this.recordPreference(userId, 'behavior', `goal_${goal}`, true, 'explicit', 0.9);
        }
    }
    getPersonalizationData(userId) {
        return {
            interactions: this.getUserInteractions(userId, 100),
            preferences: this.getUserPreferences(userId),
            patterns: this.getUserPatterns(userId),
            recommendations: this.getUserRecommendations(userId, 'pending'),
            insights: this.getUserInsights(userId),
            models: this.personalizationModels.get(userId) || []
        };
    }
    getLearningStats() {
        return {
            totalUsers: this.userInteractions.size,
            totalInteractions: Array.from(this.userInteractions.values()).reduce((sum, interactions) => sum + interactions.length, 0),
            totalPatterns: Array.from(this.behaviorPatterns.values()).reduce((sum, patterns) => sum + patterns.length, 0),
            activeRecommendations: Array.from(this.recommendations.values()).reduce((sum, recs) => sum + recs.filter(r => r.status === 'pending').length, 0),
            runningTests: Array.from(this.abTests.values()).filter(test => test.status === 'running').length,
            recentInsights: Array.from(this.learningInsights.values()).reduce((sum, insights) => sum + insights.filter(i => Date.now() - i.discoveredAt.getTime() < 7 * 24 * 60 * 60 * 1000).length, 0)
        };
    }
}
export const userBehaviorLearningService = new UserBehaviorLearningService();
export default userBehaviorLearningService;
//# sourceMappingURL=user-behavior-learning-service.js.map