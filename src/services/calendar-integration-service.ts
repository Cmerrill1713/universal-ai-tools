/**
 * Calendar Integration Service
 * Integrates with various calendar services (Google Calendar, Outlook, iCal)
 * Provides smart scheduling, conflict detection, and event management
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: Attendee[];
  isAllDay: boolean;
  recurrence?: RecurrenceRule;
  reminders?: Reminder[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'public' | 'private' | 'confidential';
  source: 'google' | 'outlook' | 'icloud' | 'local';
  sourceId?: string; // Original ID from the source calendar
  metadata?: {
    meetingUrl?: string;
    conferenceData?: any;
    createdBy?: string;
    lastModified?: Date;
  };
}

export interface Attendee {
  email: string;
  name?: string;
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  isOrganizer?: boolean;
}

export interface Reminder {
  method: 'email' | 'popup' | 'notification';
  minutesBefore: number;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N frequency units
  daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday
  dayOfMonth?: number; // 1-31
  monthOfYear?: number; // 1-12
  endDate?: Date;
  count?: number; // Number of occurrences
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  conflictingEvents?: CalendarEvent[];
}

export interface SchedulingPreferences {
  workingHours: {
    start: number; // Hour in 24h format (e.g., 9 for 9 AM)
    end: number;   // Hour in 24h format (e.g., 17 for 5 PM)
  };
  workingDays: number[]; // 0 = Sunday, 6 = Saturday
  preferredMeetingDuration: number; // Minutes
  bufferTime: number; // Minutes between meetings
  timeZone: string;
  breakTimes: Array<{
    start: number; // Hour
    end: number;   // Hour
    days: number[]; // Days of week
  }>;
}

export interface CalendarProvider {
  name: string;
  type: 'google' | 'outlook' | 'icloud' | 'caldav';
  credentials: any;
  isConnected: boolean;
  lastSync?: Date;
}

export class CalendarIntegrationService extends EventEmitter {
  private providers: Map<string, CalendarProvider> = new Map();
  private events: Map<string, CalendarEvent> = new Map();
  private userPreferences: Map<string, SchedulingPreferences> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Load saved providers and preferences
      await this.loadProviders();
      await this.loadUserPreferences();
      
      // Set up automatic sync
      this.startSyncLoop();
      
      this.isInitialized = true;
      
      log.info('✅ Calendar Integration Service initialized', LogContext.AI, {
        providers: this.providers.size,
        events: this.events.size
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize Calendar Integration Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Add a calendar provider (Google, Outlook, etc.)
   */
  async addProvider(provider: Omit<CalendarProvider, 'isConnected' | 'lastSync'>): Promise<boolean> {
    try {
      const fullProvider: CalendarProvider = {
        ...provider,
        isConnected: false,
        lastSync: undefined
      };

      // Test connection
      const isConnected = await this.testConnection(fullProvider);
      fullProvider.isConnected = isConnected;

      this.providers.set(provider.name, fullProvider);
      
      if (isConnected) {
        // Initial sync
        await this.syncProvider(provider.name);
        
        log.info('✅ Calendar provider added and connected', LogContext.AI, {
          provider: provider.name,
          type: provider.type
        });
      } else {
        log.warn('⚠️ Calendar provider added but not connected', LogContext.AI, {
          provider: provider.name,
          type: provider.type
        });
      }

      this.emit('providerAdded', fullProvider);
      return isConnected;
      
    } catch (error) {
      log.error('❌ Failed to add calendar provider', LogContext.AI, {
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get events within a date range
   */
  async getEvents(startDate: Date, endDate: Date, providers?: string[]): Promise<CalendarEvent[]> {
    const filteredEvents: CalendarEvent[] = [];
    
    for (const [eventId, event] of this.events.entries()) {
      // Check date range
      if (event.startTime >= startDate && event.startTime <= endDate) {
        // Check provider filter
        if (!providers || providers.includes(event.source)) {
          filteredEvents.push(event);
        }
      }
    }
    
    // Sort by start time
    return filteredEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Create a new calendar event
   */
  async createEvent(event: Omit<CalendarEvent, 'id' | 'sourceId'>, providerName?: string): Promise<CalendarEvent | null> {
    try {
      const newEvent: CalendarEvent = {
        ...event,
        id: this.generateEventId(),
        source: event.source || 'local',
        status: event.status || 'confirmed',
        visibility: event.visibility || 'private',
        isAllDay: event.isAllDay ?? false
      };

      // Validate event
      if (!this.validateEvent(newEvent)) {
        throw new Error('Invalid event data');
      }

      // Check for conflicts
      const conflicts = await this.findConflicts(newEvent);
      if (conflicts.length > 0) {
        log.warn('📅 Event has scheduling conflicts', LogContext.AI, {
          eventTitle: newEvent.title,
          conflicts: conflicts.length
        });
        
        // Emit conflict event for handling
        this.emit('eventConflict', newEvent, conflicts);
      }

      // Create in provider if specified
      if (providerName && this.providers.has(providerName)) {
        const provider = this.providers.get(providerName)!;
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
      
    } catch (error) {
      log.error('❌ Failed to create calendar event', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Find available time slots for scheduling
   */
  async findAvailableSlots(
    startDate: Date,
    endDate: Date,
    duration: number, // minutes
    preferences?: Partial<SchedulingPreferences>
  ): Promise<TimeSlot[]> {
    const availableSlots: TimeSlot[] = [];
    const userPrefs = preferences || this.getDefaultPreferences();
    
    // Get all events in the date range
    const existingEvents = await this.getEvents(startDate, endDate);
    
    // Generate time slots for each day
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Check if this day is a working day
      if (userPrefs.workingDays && !userPrefs.workingDays.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Generate slots for the day
      const daySlots = this.generateDaySlots(currentDate, duration, userPrefs);
      
      // Check each slot against existing events
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
    
    // Filter to only available slots
    return availableSlots.filter(slot => slot.available);
  }

  /**
   * Smart scheduling - find the best time slot based on preferences and patterns
   */
  async smartSchedule(
    title: string,
    duration: number,
    participants?: string[],
    preferences?: {
      earliestTime?: Date;
      latestTime?: Date;
      preferredTimes?: Date[];
      allowWeekends?: boolean;
      priority?: 'high' | 'medium' | 'low';
    }
  ): Promise<{ suggestedSlots: TimeSlot[], reasoning: string }> {
    const startDate = preferences?.earliestTime || new Date();
    const endDate = preferences?.latestTime || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
    
    const availableSlots = await this.findAvailableSlots(startDate, endDate, duration);
    
    // Score slots based on various factors
    const scoredSlots = availableSlots.map(slot => {
      let score = 100; // Base score
      const hour = slot.start.getHours();
      
      // Prefer working hours
      if (hour >= 9 && hour <= 17) {
        score += 20;
      }
      
      // Prefer not too early or too late
      if (hour < 8 || hour > 18) {
        score -= 30;
      }
      
      // Prefer Tuesday-Thursday (prime meeting days)
      const dayOfWeek = slot.start.getDay();
      if (dayOfWeek >= 2 && dayOfWeek <= 4) {
        score += 10;
      }
      
      // Avoid Monday mornings and Friday afternoons
      if ((dayOfWeek === 1 && hour < 10) || (dayOfWeek === 5 && hour > 15)) {
        score -= 20;
      }
      
      // Prefer preferred times if specified
      if (preferences?.preferredTimes) {
        const matchesPreferred = preferences.preferredTimes.some(preferredTime => {
          const timeDiff = Math.abs(slot.start.getTime() - preferredTime.getTime());
          return timeDiff < 60 * 60 * 1000; // Within 1 hour
        });
        if (matchesPreferred) {
          score += 30;
        }
      }
      
      // Consider urgency
      if (preferences?.priority === 'high') {
        // For high priority, prefer sooner slots
        const daysFromNow = (slot.start.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        score += Math.max(0, 20 - daysFromNow * 2);
      }
      
      return { ...slot, score };
    });
    
    // Sort by score (highest first)
    const sortedSlots = scoredSlots.sort((a, b) => (b as any).score - (a as any).score);
    
    // Take top 5 suggestions
    const suggestedSlots = sortedSlots.slice(0, 5).map(({ score, ...slot }) => slot);
    
    const reasoning = this.generateSchedulingReasoning(suggestedSlots, preferences);
    
    return { suggestedSlots, reasoning };
  }

  /**
   * Set user preferences for scheduling
   */
  setUserPreferences(userId: string, preferences: SchedulingPreferences): void {
    this.userPreferences.set(userId, preferences);
    
    log.info('✅ User scheduling preferences updated', LogContext.AI, {
      userId,
      workingHours: preferences.workingHours
    });
    
    this.emit('preferencesUpdated', userId, preferences);
  }

  /**
   * Sync all connected providers
   */
  async syncAllProviders(): Promise<void> {
    for (const [name, provider] of this.providers.entries()) {
      if (provider.isConnected) {
        await this.syncProvider(name);
      }
    }
  }

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcomingEvents(limit?: number): Promise<CalendarEvent[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const events = await this.getEvents(now, nextWeek);
    return limit ? events.slice(0, limit) : events;
  }

  // Private helper methods
  
  private async testConnection(provider: CalendarProvider): Promise<boolean> {
    // Implementation would test actual connection to provider
    // For now, return true for demonstration
    log.info('🔗 Testing connection to calendar provider', LogContext.AI, {
      provider: provider.name,
      type: provider.type
    });
    
    // Simulate connection test
    return true;
  }

  private async syncProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.isConnected) return;
    
    try {
      log.info('🔄 Syncing calendar provider', LogContext.AI, { provider: providerName });
      
      // Implementation would sync with actual provider
      // For now, simulate sync
      provider.lastSync = new Date();
      
      this.emit('providerSynced', provider);
      
    } catch (error) {
      log.error('❌ Failed to sync calendar provider', LogContext.AI, {
        provider: providerName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async createEventInProvider(event: CalendarEvent, provider: CalendarProvider): Promise<string | null> {
    // Implementation would create event in actual provider
    // For now, return a mock ID
    return `${provider.type}_${Date.now()}`;
  }

  private generateDaySlots(date: Date, duration: number, preferences: Partial<SchedulingPreferences>): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const workingHours = preferences.workingHours || { start: 9, end: 17 };
    const bufferTime = preferences.bufferTime || 15; // 15 minutes between meetings
    
    // Generate slots throughout the working day
    const startHour = workingHours.start;
    const endHour = workingHours.end;
    const slotDuration = duration + bufferTime;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);
        
        // Don't add slots that extend beyond working hours
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

  private findConflictingEvents(slot: TimeSlot, events: CalendarEvent[]): CalendarEvent[] {
    return events.filter(event => {
      // Check if event overlaps with the slot
      return (event.startTime < slot.end && event.endTime > slot.start);
    });
  }

  private async findConflicts(event: CalendarEvent): Promise<CalendarEvent[]> {
    const existingEvents = await this.getEvents(
      new Date(event.startTime.getTime() - 24 * 60 * 60 * 1000), // Day before
      new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000)    // Day after
    );
    
    return existingEvents.filter(existing => {
      return existing.id !== event.id && 
             existing.startTime < event.endTime && 
             existing.endTime > event.startTime;
    });
  }

  private validateEvent(event: CalendarEvent): boolean {
    if (!event.title || !event.startTime || !event.endTime) {
      return false;
    }
    
    if (event.endTime <= event.startTime) {
      return false;
    }
    
    return true;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getDefaultPreferences(): SchedulingPreferences {
    return {
      workingHours: { start: 9, end: 17 },
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      preferredMeetingDuration: 30,
      bufferTime: 15,
      timeZone: 'UTC',
      breakTimes: [
        { start: 12, end: 13, days: [1, 2, 3, 4, 5] } // Lunch break
      ]
    };
  }

  private generateSchedulingReasoning(slots: TimeSlot[], preferences?: any): string {
    if (slots.length === 0) {
      return "No available time slots found in the specified range.";
    }
    
    let reasoning = `Found ${slots.length} optimal time slots. `;
    
    const firstSlot = slots[0];
    if (firstSlot) {
      const hour = firstSlot.start.getHours();
      
      if (hour >= 9 && hour <= 11) {
        reasoning += "Morning slots are preferred for better focus and energy. ";
      } else if (hour >= 14 && hour <= 16) {
        reasoning += "Early afternoon slots avoid post-lunch energy dips. ";
      }
      
      const dayOfWeek = firstSlot.start.getDay();
      if (dayOfWeek >= 2 && dayOfWeek <= 4) {
        reasoning += "Mid-week scheduling provides better availability for all participants.";
      }
    }
    
    return reasoning;
  }

  private startSyncLoop(): void {
    // Sync providers every 30 minutes
    this.syncInterval = setInterval(async () => {
      await this.syncAllProviders();
    }, 30 * 60 * 1000);
  }

  private async loadProviders(): Promise<void> {
    // Implementation would load providers from database/config
    // For now, set up some demo providers
    
    log.info('📅 Loading calendar providers', LogContext.AI);
  }

  private async loadUserPreferences(): Promise<void> {
    // Implementation would load user preferences from database
    // Set default preferences for now
    this.setUserPreferences('default', this.getDefaultPreferences());
  }

  // Public API methods
  
  public async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event) return false;
    
    const updatedEvent = { ...event, ...updates, updatedAt: new Date() };
    
    if (!this.validateEvent(updatedEvent)) {
      return false;
    }
    
    this.events.set(eventId, updatedEvent);
    
    // Update in provider if it has a source ID
    if (event.sourceId && event.source !== 'local') {
      // Implementation would update in external provider
    }
    
    this.emit('eventUpdated', updatedEvent);
    return true;
  }

  public async deleteEvent(eventId: string): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event) return false;
    
    // Delete from provider if needed
    if (event.sourceId && event.source !== 'local') {
      // Implementation would delete from external provider
    }
    
    this.events.delete(eventId);
    this.emit('eventDeleted', event);
    
    return true;
  }

  public getProviders(): CalendarProvider[] {
    return Array.from(this.providers.values());
  }

  public async getEventById(eventId: string): Promise<CalendarEvent | undefined> {
    return this.events.get(eventId);
  }

  public getUserPreferences(userId: string): SchedulingPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  public async analyzeBusyPatterns(userId: string, days: number = 30): Promise<{
    busiestDays: number[];
    busiestHours: number[];
    averageMeetingsPerDay: number;
    longestFreeBlocks: { start: Date; end: Date; duration: number }[];
  }> {
    // Implementation would analyze user's calendar patterns
    // For now, return mock analysis
    return {
      busiestDays: [1, 2, 3], // Monday, Tuesday, Wednesday
      busiestHours: [10, 11, 14, 15], // 10 AM, 11 AM, 2 PM, 3 PM
      averageMeetingsPerDay: 4.2,
      longestFreeBlocks: []
    };
  }
}

// Export singleton instance
export const calendarIntegrationService = new CalendarIntegrationService();
export default calendarIntegrationService;