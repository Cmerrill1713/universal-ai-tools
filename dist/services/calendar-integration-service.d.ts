import { EventEmitter } from 'events';
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
    sourceId?: string;
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
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: Date;
    count?: number;
}
export interface TimeSlot {
    start: Date;
    end: Date;
    available: boolean;
    conflictingEvents?: CalendarEvent[];
}
export interface SchedulingPreferences {
    workingHours: {
        start: number;
        end: number;
    };
    workingDays: number[];
    preferredMeetingDuration: number;
    bufferTime: number;
    timeZone: string;
    breakTimes: Array<{
        start: number;
        end: number;
        days: number[];
    }>;
}
export interface CalendarProvider {
    name: string;
    type: 'google' | 'outlook' | 'icloud' | 'caldav';
    credentials: any;
    isConnected: boolean;
    lastSync?: Date;
}
export declare class CalendarIntegrationService extends EventEmitter {
    private providers;
    private events;
    private userPreferences;
    private syncInterval;
    private isInitialized;
    constructor();
    private initializeService;
    addProvider(provider: Omit<CalendarProvider, 'isConnected' | 'lastSync'>): Promise<boolean>;
    getEvents(startDate: Date, endDate: Date, providers?: string[]): Promise<CalendarEvent[]>;
    createEvent(event: Omit<CalendarEvent, 'id' | 'sourceId'>, providerName?: string): Promise<CalendarEvent | null>;
    findAvailableSlots(startDate: Date, endDate: Date, duration: number, preferences?: Partial<SchedulingPreferences>): Promise<TimeSlot[]>;
    smartSchedule(title: string, duration: number, participants?: string[], preferences?: {
        earliestTime?: Date;
        latestTime?: Date;
        preferredTimes?: Date[];
        allowWeekends?: boolean;
        priority?: 'high' | 'medium' | 'low';
    }): Promise<{
        suggestedSlots: TimeSlot[];
        reasoning: string;
    }>;
    setUserPreferences(userId: string, preferences: SchedulingPreferences): void;
    syncAllProviders(): Promise<void>;
    getUpcomingEvents(limit?: number): Promise<CalendarEvent[]>;
    private testConnection;
    private syncProvider;
    private createEventInProvider;
    private generateDaySlots;
    private findConflictingEvents;
    private findConflicts;
    private validateEvent;
    private generateEventId;
    private getDefaultPreferences;
    private generateSchedulingReasoning;
    private startSyncLoop;
    private loadProviders;
    private loadUserPreferences;
    updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<boolean>;
    deleteEvent(eventId: string): Promise<boolean>;
    getProviders(): CalendarProvider[];
    getEventById(eventId: string): Promise<CalendarEvent | undefined>;
    getUserPreferences(userId: string): SchedulingPreferences | undefined;
    analyzeBusyPatterns(userId: string, days?: number): Promise<{
        busiestDays: number[];
        busiestHours: number[];
        averageMeetingsPerDay: number;
        longestFreeBlocks: {
            start: Date;
            end: Date;
            duration: number;
        }[];
    }>;
}
export declare const calendarIntegrationService: CalendarIntegrationService;
export default calendarIntegrationService;
//# sourceMappingURL=calendar-integration-service.d.ts.map