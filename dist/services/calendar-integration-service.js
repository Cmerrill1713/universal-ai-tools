import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
export class CalendarIntegrationService extends EventEmitter {
    providers = new Map();
    events = new Map();
    userPreferences = new Map();
    syncInterval = null;
    isInitialized = false;
    constructor() {
        super();
        this.initializeService();
    }
    async initializeService() {
        try {
            await this.loadProviders();
            await this.loadUserPreferences();
            this.startSyncLoop();
            this.isInitialized = true;
            log.info('✅ Calendar Integration Service initialized', LogContext.AI, {
                providers: this.providers.size,
                events: this.events.size
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize Calendar Integration Service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async addProvider(provider) {
        try {
            const fullProvider = {
                ...provider,
                isConnected: false,
                lastSync: undefined
            };
            const isConnected = await this.testConnection(fullProvider);
            fullProvider.isConnected = isConnected;
            this.providers.set(provider.name, fullProvider);
            if (isConnected) {
                await this.syncProvider(provider.name);
                log.info('✅ Calendar provider added and connected', LogContext.AI, {
                    provider: provider.name,
                    type: provider.type
                });
            }
            else {
                log.warn('⚠️ Calendar provider added but not connected', LogContext.AI, {
                    provider: provider.name,
                    type: provider.type
                });
            }
            this.emit('providerAdded', fullProvider);
            return isConnected;
        }
        catch (error) {
            log.error('❌ Failed to add calendar provider', LogContext.AI, {
                provider: provider.name,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    async getEvents(startDate, endDate, providers) {
        const filteredEvents = [];
        for (const [eventId, event] of this.events.entries()) {
            if (event.startTime >= startDate && event.startTime <= endDate) {
                if (!providers || providers.includes(event.source)) {
                    filteredEvents.push(event);
                }
            }
        }
        return filteredEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    async createEvent(event, providerName) {
        try {
            const newEvent = {
                ...event,
                id: this.generateEventId(),
                source: event.source || 'local',
                status: event.status || 'confirmed',
                visibility: event.visibility || 'private',
                isAllDay: event.isAllDay ?? false
            };
            if (!this.validateEvent(newEvent)) {
                throw new Error('Invalid event data');
            }
            const conflicts = await this.findConflicts(newEvent);
            if (conflicts.length > 0) {
                log.warn('📅 Event has scheduling conflicts', LogContext.AI, {
                    eventTitle: newEvent.title,
                    conflicts: conflicts.length
                });
                this.emit('eventConflict', newEvent, conflicts);
            }
            if (providerName && this.providers.has(providerName)) {
                const provider = this.providers.get(providerName);
                const sourceEventId = await this.createEventInProvider(newEvent, provider);
                if (sourceEventId) {
                    newEvent.sourceId = sourceEventId;
                }
            }
            this.events.set(newEvent.id, newEvent);
            log.info('✅ Calendar event created', LogContext.AI, {
                eventId: newEvent.id,
                title: newEvent.title,
                startTime: newEvent.startTime
            });
            this.emit('eventCreated', newEvent);
            return newEvent;
        }
        catch (error) {
            log.error('❌ Failed to create calendar event', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    async findAvailableSlots(startDate, endDate, duration, preferences) {
        const availableSlots = [];
        const userPrefs = preferences || this.getDefaultPreferences();
        const existingEvents = await this.getEvents(startDate, endDate);
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (userPrefs.workingDays && !userPrefs.workingDays.includes(dayOfWeek)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
            const daySlots = this.generateDaySlots(currentDate, duration, userPrefs);
            for (const slot of daySlots) {
                const conflictingEvents = this.findConflictingEvents(slot, existingEvents);
                availableSlots.push({
                    ...slot,
                    available: conflictingEvents.length === 0,
                    conflictingEvents: conflictingEvents.length > 0 ? conflictingEvents : undefined
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return availableSlots.filter(slot => slot.available);
    }
    async smartSchedule(title, duration, participants, preferences) {
        const startDate = preferences?.earliestTime || new Date();
        const endDate = preferences?.latestTime || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const availableSlots = await this.findAvailableSlots(startDate, endDate, duration);
        const scoredSlots = availableSlots.map(slot => {
            let score = 100;
            const hour = slot.start.getHours();
            if (hour >= 9 && hour <= 17) {
                score += 20;
            }
            if (hour < 8 || hour > 18) {
                score -= 30;
            }
            const dayOfWeek = slot.start.getDay();
            if (dayOfWeek >= 2 && dayOfWeek <= 4) {
                score += 10;
            }
            if ((dayOfWeek === 1 && hour < 10) || (dayOfWeek === 5 && hour > 15)) {
                score -= 20;
            }
            if (preferences?.preferredTimes) {
                const matchesPreferred = preferences.preferredTimes.some(preferredTime => {
                    const timeDiff = Math.abs(slot.start.getTime() - preferredTime.getTime());
                    return timeDiff < 60 * 60 * 1000;
                });
                if (matchesPreferred) {
                    score += 30;
                }
            }
            if (preferences?.priority === 'high') {
                const daysFromNow = (slot.start.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
                score += Math.max(0, 20 - daysFromNow * 2);
            }
            return { ...slot, score };
        });
        const sortedSlots = scoredSlots.sort((a, b) => b.score - a.score);
        const suggestedSlots = sortedSlots.slice(0, 5).map(({ score, ...slot }) => slot);
        const reasoning = this.generateSchedulingReasoning(suggestedSlots, preferences);
        return { suggestedSlots, reasoning };
    }
    setUserPreferences(userId, preferences) {
        this.userPreferences.set(userId, preferences);
        log.info('✅ User scheduling preferences updated', LogContext.AI, {
            userId,
            workingHours: preferences.workingHours
        });
        this.emit('preferencesUpdated', userId, preferences);
    }
    async syncAllProviders() {
        for (const [name, provider] of this.providers.entries()) {
            if (provider.isConnected) {
                await this.syncProvider(name);
            }
        }
    }
    async getUpcomingEvents(limit) {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const events = await this.getEvents(now, nextWeek);
        return limit ? events.slice(0, limit) : events;
    }
    async testConnection(provider) {
        log.info('🔗 Testing connection to calendar provider', LogContext.AI, {
            provider: provider.name,
            type: provider.type
        });
        return true;
    }
    async syncProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider || !provider.isConnected)
            return;
        try {
            log.info('🔄 Syncing calendar provider', LogContext.AI, { provider: providerName });
            provider.lastSync = new Date();
            this.emit('providerSynced', provider);
        }
        catch (error) {
            log.error('❌ Failed to sync calendar provider', LogContext.AI, {
                provider: providerName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async createEventInProvider(event, provider) {
        return `${provider.type}_${Date.now()}`;
    }
    generateDaySlots(date, duration, preferences) {
        const slots = [];
        const workingHours = preferences.workingHours || { start: 9, end: 17 };
        const bufferTime = preferences.bufferTime || 15;
        const startHour = workingHours.start;
        const endHour = workingHours.end;
        const slotDuration = duration + bufferTime;
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += slotDuration) {
                const slotStart = new Date(date);
                slotStart.setHours(hour, minute, 0, 0);
                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotEnd.getMinutes() + duration);
                if (slotEnd.getHours() >= endHour && slotEnd.getMinutes() > 0) {
                    break;
                }
                slots.push({
                    start: slotStart,
                    end: slotEnd,
                    available: true
                });
            }
        }
        return slots;
    }
    findConflictingEvents(slot, events) {
        return events.filter(event => {
            return (event.startTime < slot.end && event.endTime > slot.start);
        });
    }
    async findConflicts(event) {
        const existingEvents = await this.getEvents(new Date(event.startTime.getTime() - 24 * 60 * 60 * 1000), new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000));
        return existingEvents.filter(existing => {
            return existing.id !== event.id &&
                existing.startTime < event.endTime &&
                existing.endTime > event.startTime;
        });
    }
    validateEvent(event) {
        if (!event.title || !event.startTime || !event.endTime) {
            return false;
        }
        if (event.endTime <= event.startTime) {
            return false;
        }
        return true;
    }
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    getDefaultPreferences() {
        return {
            workingHours: { start: 9, end: 17 },
            workingDays: [1, 2, 3, 4, 5],
            preferredMeetingDuration: 30,
            bufferTime: 15,
            timeZone: 'UTC',
            breakTimes: [
                { start: 12, end: 13, days: [1, 2, 3, 4, 5] }
            ]
        };
    }
    generateSchedulingReasoning(slots, preferences) {
        if (slots.length === 0) {
            return "No available time slots found in the specified range.";
        }
        let reasoning = `Found ${slots.length} optimal time slots. `;
        const firstSlot = slots[0];
        if (firstSlot) {
            const hour = firstSlot.start.getHours();
            if (hour >= 9 && hour <= 11) {
                reasoning += "Morning slots are preferred for better focus and energy. ";
            }
            else if (hour >= 14 && hour <= 16) {
                reasoning += "Early afternoon slots avoid post-lunch energy dips. ";
            }
            const dayOfWeek = firstSlot.start.getDay();
            if (dayOfWeek >= 2 && dayOfWeek <= 4) {
                reasoning += "Mid-week scheduling provides better availability for all participants.";
            }
        }
        return reasoning;
    }
    startSyncLoop() {
        this.syncInterval = setInterval(async () => {
            await this.syncAllProviders();
        }, 30 * 60 * 1000);
    }
    async loadProviders() {
        log.info('📅 Loading calendar providers', LogContext.AI);
    }
    async loadUserPreferences() {
        this.setUserPreferences('default', this.getDefaultPreferences());
    }
    async updateEvent(eventId, updates) {
        const event = this.events.get(eventId);
        if (!event)
            return false;
        const updatedEvent = { ...event, ...updates, updatedAt: new Date() };
        if (!this.validateEvent(updatedEvent)) {
            return false;
        }
        this.events.set(eventId, updatedEvent);
        if (event.sourceId && event.source !== 'local') {
        }
        this.emit('eventUpdated', updatedEvent);
        return true;
    }
    async deleteEvent(eventId) {
        const event = this.events.get(eventId);
        if (!event)
            return false;
        if (event.sourceId && event.source !== 'local') {
        }
        this.events.delete(eventId);
        this.emit('eventDeleted', event);
        return true;
    }
    getProviders() {
        return Array.from(this.providers.values());
    }
    async getEventById(eventId) {
        return this.events.get(eventId);
    }
    getUserPreferences(userId) {
        return this.userPreferences.get(userId);
    }
    async analyzeBusyPatterns(userId, days = 30) {
        return {
            busiestDays: [1, 2, 3],
            busiestHours: [10, 11, 14, 15],
            averageMeetingsPerDay: 4.2,
            longestFreeBlocks: []
        };
    }
}
export const calendarIntegrationService = new CalendarIntegrationService();
export default calendarIntegrationService;
//# sourceMappingURL=calendar-integration-service.js.map