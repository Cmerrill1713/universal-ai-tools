/**
 * CalendarAgent - Intelligent calendar and scheduling management
 * Integrates with macOS Calendar, Google Calendar, and provides natural language scheduling
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import axios from 'axios';
import { logger } from '../../utils/logger';

interface CalendarEvent {
  id?: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  description?: string;
  attendees?: string[];
  calendar?: string;
  allDay?: boolean;
}

interface ScheduleConflict {
  conflictingEvent: CalendarEvent;
  overlapStart: Date;
  overlapEnd: Date;
  severity: 'minor' | 'major' | 'complete';
}

interface SchedulingSuggestion {
  suggestedTime: Date;
  confidence: number;
  reasoning: string;
  alternativeTimes: Date[];
}

export class CalendarAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private calendarPreferences: any = {};

  constructor(supabase: SupabaseClient) {
    const config: AgentConfig = {
      name: 'calendar_agent',
      description: 'Intelligent calendar management and scheduling assistant',
      priority: 8,
      capabilities: [
        {
          name: 'create_event',
          description: 'Create calendar events from natural language',
          inputSchema: {
            type: 'object',
            properties: {
              naturalLanguage: { type: 'string' },
              calendar: { type: 'string', optional: true }
            },
            required: ['naturalLanguage']
          },
          outputSchema: {
            type: 'object',
            properties: {
              event: { type: 'object' },
              conflicts: { type: 'array' }
            }
          }
        },
        {
          name: 'find_free_time',
          description: 'Find optimal meeting times',
          inputSchema: {
            type: 'object',
            properties: {
              duration: { type: 'number' },
              participants: { type: 'array' },
              timeframe: { type: 'string' },
              preferences: { type: 'object' }
            },
            required: ['duration']
          },
          outputSchema: {
            type: 'object',
            properties: {
              suggestions: { type: 'array' },
              conflicts: { type: 'array' }
            }
          }
        },
        {
          name: 'analyze_schedule',
          description: 'Analyze and optimize schedule patterns',
          inputSchema: {
            type: 'object',
            properties: {
              timeframe: { type: 'string' },
              analysisType: { type: 'string' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              insights: { type: 'object' },
              recommendations: { type: 'array' }
            }
          }
        }
      ],
      maxLatencyMs: 3000,
      retryAttempts: 2,
      dependencies: ['ollama_assistant'],
      memoryEnabled: true
    };

    super(config);
    this.supabase = supabase;
    this.logger = logger;
  }

  protected async onInitialize(): Promise<void> {
    // Load user calendar preferences
    await this.loadCalendarPreferences();
    
    // Check macOS Calendar access
    await this.checkCalendarAccess();
    
    this.logger.info('✅ CalendarAgent initialized with macOS Calendar integration');
  }

  protected async process(context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const { userRequest } = context;
    const startTime = Date.now();

    try {
      // Parse the user request to determine intent
      const intent = await this.parseCalendarIntent(userRequest);
      
      let result: any;
      
      switch (intent.action) {
        case 'create_event':
          result = await this.createEventFromNaturalLanguage(userRequest, intent);
          break;
          
        case 'find_time':
          result = await this.findOptimalMeetingTime(intent);
          break;
          
        case 'check_schedule':
          result = await this.analyzeSchedule(intent);
          break;
          
        case 'reschedule':
          result = await this.rescheduleEvent(intent);
          break;
          
        case 'get_events':
          result = await this.getUpcomingEvents(intent);
          break;
          
        default:
          result = await this.handleGeneralCalendarQuery(userRequest);
      }

      const confidence = this.calculateConfidence(intent, result);
      
      return {
        success: true,
        data: result,
        reasoning: this.buildCalendarReasoning(intent, result),
        confidence,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        nextActions: this.suggestNextActions(intent, result)
      };

    } catch (error) {
      this.logger.error('CalendarAgent processing error:', error);
      return {
        success: false,
        data: null,
        reasoning: `Calendar operation failed: ${(error as Error).message}`,
        confidence: 0.1,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        error: (error as Error).message
      };
    }
  }

  protected async onShutdown(): Promise<void> {
    // Save any pending calendar operations
    this.logger.info('CalendarAgent shutting down');
  }

  /**
   * Parse natural language to determine calendar intent
   */
  private async parseCalendarIntent(request: string): Promise<any> {
    const prompt = `Parse this calendar request and extract the intent:

Request: "${request}"

Determine:
1. Action (create_event, find_time, check_schedule, reschedule, get_events)
2. Event details (title, date, time, duration, location, attendees)
3. Constraints (availability, preferences)
4. Context (urgency, type of meeting)

Respond with JSON: {
  "action": "...",
  "eventDetails": {...},
  "constraints": {...},
  "context": {...}
}`;

    try {
      // Use Ollama for natural language parsing
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        format: 'json'
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      // Fallback to basic parsing
      return this.fallbackIntentParsing(request);
    }
  }

  /**
   * Create calendar event from natural language
   */
  private async createEventFromNaturalLanguage(request: string, intent: any): Promise<any> {
    const eventDetails = intent.eventDetails || {};
    
    // Parse date and time
    const dateTime = await this.parseDateTime(request);
    
    const event: CalendarEvent = {
      title: eventDetails.title || this.extractEventTitle(request),
      startDate: dateTime.startDate,
      endDate: dateTime.endDate,
      location: eventDetails.location,
      description: eventDetails.description,
      attendees: eventDetails.attendees || [],
      allDay: dateTime.allDay || false
    };

    // Check for conflicts
    const conflicts = await this.checkForConflicts(event);
    
    if (conflicts.length > 0 && this.hasSignificantConflicts(conflicts)) {
      return {
        event,
        conflicts,
        created: false,
        suggestion: await this.suggestAlternativeTime(event, conflicts)
      };
    }

    // Create the event
    const createdEvent = await this.createCalendarEvent(event);
    
    // Store in memory for future reference
    await this.storeEventMemory(createdEvent, request);
    
    return {
      event: createdEvent,
      conflicts,
      created: true,
      eventId: createdEvent.id
    };
  }

  /**
   * Find optimal meeting time
   */
  private async findOptimalMeetingTime(intent: any): Promise<any> {
    const duration = intent.duration || 60; // minutes
    const timeframe = intent.timeframe || 'next_week';
    const participants = intent.participants || [];
    
    // Get busy times for all participants
    const busyTimes = await this.getBusyTimes(participants, timeframe);
    
    // Find free slots
    const freeSlots = await this.findFreeTimeSlots(duration, busyTimes, timeframe);
    
    // Score and rank suggestions
    const suggestions = await this.rankTimeSlots(freeSlots, intent.preferences);
    
    return {
      suggestions: suggestions.slice(0, 5),
      participants,
      duration,
      timeframe,
      totalOptions: freeSlots.length
    };
  }

  /**
   * Analyze schedule patterns and provide insights
   */
  private async analyzeSchedule(intent: any): Promise<any> {
    const timeframe = intent.timeframe || 'this_week';
    const events = await this.getEventsInTimeframe(timeframe);
    
    const analysis = {
      totalEvents: events.length,
      totalHours: this.calculateTotalHours(events),
      busyDays: this.identifyBusyDays(events),
      freeTime: this.calculateFreeTime(events),
      patterns: this.identifyPatterns(events),
      recommendations: this.generateScheduleRecommendations(events)
    };
    
    return {
      timeframe,
      analysis,
      insights: await this.generateScheduleInsights(analysis)
    };
  }

  /**
   * Create calendar event using macOS Calendar
   */
  private async createCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    try {
      // Escape strings for AppleScript
      const escapeAppleScript = (str: string) => {
        return str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
      };

      // Format dates for AppleScript
      const formatDateForAppleScript = (date: Date) => {
        return `${date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })  } ${  date.toLocaleTimeString('en-US')}`;
      };

      // Use AppleScript to create calendar event with proper escaping
      const script = `
        tell application "Calendar"
          try
            tell calendar "${escapeAppleScript(event.calendar || 'Calendar')}"
              make new event with properties {
                summary: "${escapeAppleScript(event.title)}",
                start date: date "${formatDateForAppleScript(event.startDate)}",
                end date: date "${formatDateForAppleScript(event.endDate)}",
                description: "${escapeAppleScript(event.description || '')}",
                location: "${escapeAppleScript(event.location || '')}"
              }
            end tell
            return "success"
          on error errMsg
            return "error: " & errMsg
          end try
        end tell
      `;
      
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
      
      if (result.includes('error:')) {
        throw new Error(`AppleScript error: ${result}`);
      }
      
      // Generate ID for tracking
      const eventId = `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.logger.info(`Successfully created calendar event: ${event.title}`);
      
      return {
        ...event,
        id: eventId
      };
      
    } catch (error) {
      this.logger.error('Failed to create macOS calendar event:', error);
      throw new Error(`Failed to create calendar event: ${(error as Error).message}`);
    }
  }

  /**
   * Check for schedule conflicts
   */
  private async checkForConflicts(newEvent: CalendarEvent): Promise<ScheduleConflict[]> {
    try {
      // Get existing events in the time range
      const existingEvents = await this.getEventsInRange(
        new Date(newEvent.startDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        new Date(newEvent.endDate.getTime() + 24 * 60 * 60 * 1000)     // 1 day after
      );
      
      const conflicts: ScheduleConflict[] = [];
      
      for (const event of existingEvents) {
        const overlap = this.calculateOverlap(newEvent, event);
        if (overlap) {
          conflicts.push({
            conflictingEvent: event,
            overlapStart: overlap.start,
            overlapEnd: overlap.end,
            severity: this.calculateConflictSeverity(overlap, newEvent, event)
          });
        }
      }
      
      return conflicts;
      
    } catch (error) {
      this.logger.error('Conflict checking failed:', error);
      return [];
    }
  }

  /**
   * Get events from macOS Calendar in date range
   */
  private async getEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      // Format dates for AppleScript
      const formatDateForAppleScript = (date: Date) => {
        return `${date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })  } ${  date.toLocaleTimeString('en-US')}`;
      };

      // Use AppleScript to query Calendar with better formatting
      const script = `
        tell application "Calendar"
          set eventList to {}
          set startDateTime to date "${formatDateForAppleScript(startDate)}"
          set endDateTime to date "${formatDateForAppleScript(endDate)}"
          
          repeat with cal in calendars
            try
              set calEvents to (every event of cal whose start date ≥ startDateTime and start date ≤ endDateTime)
              repeat with evt in calEvents
                set eventRecord to {}
                set eventRecord to eventRecord & {"title:" & (summary of evt as string)}
                set eventRecord to eventRecord & {"start:" & (start date of evt as string)}
                set eventRecord to eventRecord & {"end:" & (end date of evt as string)}
                
                try
                  set eventRecord to eventRecord & {"description:" & (description of evt as string)}
                on error
                  set eventRecord to eventRecord & {"description:"}
                end try
                
                try
                  set eventRecord to eventRecord & {"location:" & (location of evt as string)}
                on error
                  set eventRecord to eventRecord & {"location:"}
                end try
                
                set end of eventList to (eventRecord as string)
              end repeat
            on error
              -- Skip calendar if access denied
            end try
          end repeat
          
          return eventList
        end tell
      `;
      
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
      
      return this.parseAppleScriptEventResult(result);
      
    } catch (error) {
      this.logger.error('Failed to get calendar events:', error);
      return [];
    }
  }

  /**
   * Parse AppleScript result into CalendarEvent objects
   */
  private parseAppleScriptEventResult(scriptResult: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    
    try {
      // Clean up the result string
      const cleanResult = scriptResult.trim();
      
      if (!cleanResult || cleanResult === '{}') {
        return events;
      }
      
      // Split individual event records
      // AppleScript returns format like: "title:Event Name, start:Monday, January 1, 2024 at 9:00:00 AM, end:..."
      const eventStrings = cleanResult.split(/(?=title:)/g).filter(str => str.trim());
      
      for (const eventStr of eventStrings) {
        try {
          const event = this.parseIndividualEvent(eventStr);
          if (event) {
            events.push(event);
          }
        } catch (error) {
          this.logger.warn('Failed to parse individual event:', eventStr, error);
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to parse AppleScript result:', error);
    }
    
    return events;
  }

  /**
   * Parse individual event from AppleScript output
   */
  private parseIndividualEvent(eventStr: string): CalendarEvent | null {
    try {
      const fields: Record<string, string> = {};
      
      // Extract fields using regex patterns
      const patterns = {
        title: /title:([^,]+?)(?=,\s*(?:start|end|description|location):|$)/,
        start: /start:([^,]+?)(?=,\s*(?:end|description|location):|$)/,
        end: /end:([^,]+?)(?=,\s*(?:description|location):|$)/,
        description: /description:([^,]+?)(?=,\s*location:|$)/,
        location: /location:([^,]+?)$/
      };
      
      for (const [field, pattern] of Object.entries(patterns)) {
        const match = eventStr.match(pattern);
        if (match) {
          fields[field] = match[1].trim();
        }
      }
      
      if (!fields.title || !fields.start || !fields.end) {
        return null;
      }
      
      // Parse dates
      const startDate = new Date(fields.start);
      const endDate = new Date(fields.end);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        this.logger.warn('Invalid date format in event:', fields);
        return null;
      }
      
      return {
        id: `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: fields.title,
        startDate,
        endDate,
        description: fields.description || '',
        location: fields.location || '',
        allDay: this.isAllDayEvent(startDate, endDate)
      };
      
    } catch (error) {
      this.logger.error('Error parsing individual event:', error);
      return null;
    }
  }

  /**
   * Determine if event is all-day based on times
   */
  private isAllDayEvent(startDate: Date, endDate: Date): boolean {
    const start = startDate.getHours() * 60 + startDate.getMinutes();
    const end = endDate.getHours() * 60 + endDate.getMinutes();
    
    // Consider all-day if starts at midnight and ends at midnight or spans 24+ hours
    return (start === 0 && end === 0) || (endDate.getTime() - startDate.getTime()) >= 24 * 60 * 60 * 1000;
  }

  /**
   * Parse date and time from natural language
   */
  private async parseDateTime(text: string): Promise<{ startDate: Date; endDate: Date; allDay?: boolean }> {
    // Enhanced date/time parsing with Ollama
    const prompt = `Parse date and time from this text:

Text: "${text}"

Extract:
1. Start date and time
2. End date and time (or calculate from duration)
3. Whether it's an all-day event
4. Time zone if specified

Current date/time: ${new Date().toISOString()}

Respond with JSON: {
  "startDate": "ISO string",
  "endDate": "ISO string", 
  "allDay": boolean,
  "timezone": "string"
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        format: 'json'
      });

      const parsed = JSON.parse(response.data.response);
      return {
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        allDay: parsed.allDay
      };
      
    } catch (error) {
      // Fallback to basic parsing
      return this.fallbackDateTimeParsing(text);
    }
  }

  /**
   * Load user calendar preferences
   */
  private async loadCalendarPreferences(): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('ai_contexts')
        .select('*')
        .eq('context_type', 'calendar_preferences')
        .eq('context_key', 'user_settings')
        .single();

      if (data) {
        this.calendarPreferences = data.content;
      } else {
        // Set default preferences
        this.calendarPreferences = {
          defaultCalendar: 'Calendar',
          workingHours: { start: '09:00', end: '17:00' },
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          defaultMeetingDuration: 60,
          bufferTime: 15
        };
      }
    } catch (error) {
      this.logger.error('Failed to load calendar preferences:', error);
    }
  }

  /**
   * Check macOS Calendar access
   */
  private async checkCalendarAccess(): Promise<boolean> {
    try {
      const script = `
        tell application "Calendar"
          try
            get name of calendars
            return "access_granted"
          on error errMsg
            return "access_denied: " & errMsg
          end try
        end tell
      `;
      
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
      
      if (result.includes('access_denied')) {
        this.logger.warn(`Calendar access denied: ${result}`);
        return false;
      }
      
      this.logger.info('Calendar access confirmed');
      return true;
    } catch (error) {
      this.logger.warn('Calendar access check failed:', error);
      return false;
    }
  }

  /**
   * Fallback intent parsing for when Ollama is unavailable
   */
  private fallbackIntentParsing(request: string): any {
    const requestLower = request.toLowerCase();
    
    if (requestLower.includes('create') || requestLower.includes('schedule') || requestLower.includes('book')) {
      return { action: 'create_event', eventDetails: {} };
    }
    
    if (requestLower.includes('free time') || requestLower.includes('available')) {
      return { action: 'find_time' };
    }
    
    if (requestLower.includes('busy') || requestLower.includes('schedule')) {
      return { action: 'check_schedule' };
    }
    
    return { action: 'get_events' };
  }

  /**
   * Fallback date/time parsing
   */
  private fallbackDateTimeParsing(text: string): { startDate: Date; endDate: Date; allDay?: boolean } {
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    return { startDate, endDate, allDay: false };
  }

  // Additional utility methods would be implemented here...
  private extractEventTitle(request: string): string {
    // Extract likely event title from request
    return request.replace(/create|schedule|book/gi, '').trim() || 'New Event';
  }

  private calculateConfidence(intent: any, result: any): number {
    if (!result.created && result.conflicts?.length > 0) return 0.6;
    if (result.created) return 0.9;
    return 0.7;
  }

  private buildCalendarReasoning(intent: any, result: any): string {
    return `Processed calendar ${intent.action} request with ${result.conflicts?.length || 0} conflicts found.`;
  }

  private suggestNextActions(intent: any, result: any): string[] {
    const actions = [];
    if (result.conflicts?.length > 0) {
      actions.push('Review conflicts and choose alternative time');
    }
    if (result.created) {
      actions.push('Add attendees if needed', 'Set reminders');
    }
    return actions;
  }

  private async storeEventMemory(event: CalendarEvent, originalRequest: string): Promise<void> {
    try {
      await this.supabase
        .from('ai_memories')
        .insert({
          service_id: 'calendar_agent',
          memory_type: 'event_creation',
          content: `Created event: ${event.title} at ${event.startDate.toISOString()}`,
          metadata: { event, originalRequest },
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      this.logger.error('Failed to store event memory:', error);
    }
  }

  // Placeholder implementations for complex methods
  private hasSignificantConflicts(conflicts: ScheduleConflict[]): boolean {
    return conflicts.some(c => c.severity === 'major' || c.severity === 'complete');
  }

  private async suggestAlternativeTime(event: CalendarEvent, conflicts: ScheduleConflict[]): Promise<any> {
    // Implementation would suggest alternative times
    return { suggestion: 'Consider scheduling 1 hour later' };
  }

  private calculateOverlap(event1: CalendarEvent, event2: CalendarEvent): { start: Date; end: Date } | null {
    const start1 = event1.startDate.getTime();
    const end1 = event1.endDate.getTime();
    const start2 = event2.startDate.getTime();
    const end2 = event2.endDate.getTime();
    
    // Check if there's any overlap
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    
    if (overlapStart < overlapEnd) {
      return {
        start: new Date(overlapStart),
        end: new Date(overlapEnd)
      };
    }
    
    return null;
  }

  private calculateConflictSeverity(overlap: { start: Date; end: Date }, newEvent: CalendarEvent, existingEvent: CalendarEvent): 'minor' | 'major' | 'complete' {
    const newEventDuration = newEvent.endDate.getTime() - newEvent.startDate.getTime();
    const overlapDuration = overlap.end.getTime() - overlap.start.getTime();
    const overlapPercentage = overlapDuration / newEventDuration;
    
    if (overlapPercentage >= 0.9) {
      return 'complete';
    } else if (overlapPercentage >= 0.5) {
      return 'major';
    } else {
      return 'minor';
    }
  }

  private async getBusyTimes(participants: string[], timeframe: string): Promise<any[]> {
    const busyTimes: any[] = [];
    const { startDate, endDate } = this.parseTimeframe(timeframe);
    
    // Get events for the specified timeframe
    const events = await this.getEventsInRange(startDate, endDate);
    
    // Add busy times from existing calendar events
    for (const event of events) {
      busyTimes.push({
        start: event.startDate,
        end: event.endDate,
        participant: 'user',
        eventTitle: event.title
      });
    }
    
    // TODO: Add logic to query other participants' calendars
    // This would require integration with their calendar systems
    
    return busyTimes;
  }

  private async findFreeTimeSlots(duration: number, busyTimes: any[], timeframe: string): Promise<any[]> {
    const freeSlots: any[] = [];
    const { startDate, endDate } = this.parseTimeframe(timeframe);
    const durationMs = duration * 60 * 1000; // Convert minutes to milliseconds
    
    // Sort busy times by start date
    const sortedBusyTimes = busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // Working hours (9 AM to 5 PM by default)
    const workingHours = this.calendarPreferences.workingHours || { start: '09:00', end: '17:00' };
    
    const currentTime = new Date(startDate);
    
    while (currentTime < endDate) {
      const dayStart = this.setTimeToWorkingHours(new Date(currentTime), workingHours.start);
      const dayEnd = this.setTimeToWorkingHours(new Date(currentTime), workingHours.end);
      
      // Skip weekends unless specifically requested
      if (currentTime.getDay() === 0 || currentTime.getDay() === 6) {
        currentTime.setDate(currentTime.getDate() + 1);
        continue;
      }
      
      let slotStart = dayStart;
      
      for (const busyTime of sortedBusyTimes) {
        const busyStart = new Date(busyTime.start);
        const busyEnd = new Date(busyTime.end);
        
        // Skip if busy time is not on current day
        if (busyStart.toDateString() !== currentTime.toDateString()) {
          continue;
        }
        
        // Check if there's a gap before this busy time
        const gapDuration = busyStart.getTime() - slotStart.getTime();
        
        if (gapDuration >= durationMs && slotStart < dayEnd) {
          freeSlots.push({
            start: new Date(slotStart),
            end: new Date(Math.min(busyStart.getTime(), dayEnd.getTime())),
            duration: gapDuration,
            date: currentTime.toDateString()
          });
        }
        
        // Move slot start to after this busy time
        slotStart = new Date(Math.max(busyEnd.getTime(), slotStart.getTime()));
      }
      
      // Check for time at end of day
      if (slotStart < dayEnd) {
        const remainingTime = dayEnd.getTime() - slotStart.getTime();
        if (remainingTime >= durationMs) {
          freeSlots.push({
            start: new Date(slotStart),
            end: new Date(dayEnd),
            duration: remainingTime,
            date: currentTime.toDateString()
          });
        }
      }
      
      // Move to next day
      currentTime.setDate(currentTime.getDate() + 1);
    }
    
    return freeSlots;
  }

  private async rankTimeSlots(slots: any[], preferences: any = {}): Promise<SchedulingSuggestion[]> {
    const suggestions: SchedulingSuggestion[] = [];
    
    for (const slot of slots) {
      let score = 0.5; // Base score
      let reasoning = 'Available time slot';
      
      // Prefer morning slots (9-11 AM)
      const hour = slot.start.getHours();
      if (hour >= 9 && hour <= 11) {
        score += 0.2;
        reasoning += ', morning preferred';
      }
      
      // Prefer Tuesday-Thursday
      const day = slot.start.getDay();
      if (day >= 2 && day <= 4) {
        score += 0.1;
        reasoning += ', mid-week preferred';
      }
      
      // Prefer longer slots for flexibility
      const slotDurationHours = slot.duration / (60 * 60 * 1000);
      if (slotDurationHours >= 2) {
        score += 0.1;
        reasoning += ', longer slot available';
      }
      
      // Apply user preferences
      if (preferences.preferredTimes) {
        for (const preferredTime of preferences.preferredTimes) {
          if (this.timeMatchesPreference(slot.start, preferredTime)) {
            score += 0.2;
            reasoning += ', matches user preference';
            break;
          }
        }
      }
      
      suggestions.push({
        suggestedTime: slot.start,
        confidence: Math.min(score, 1.0),
        reasoning,
        alternativeTimes: [slot.start] // Could add multiple options from same slot
      });
    }
    
    // Sort by confidence (highest first)
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async getEventsInTimeframe(timeframe: string): Promise<CalendarEvent[]> {
    const { startDate, endDate } = this.parseTimeframe(timeframe);
    return await this.getEventsInRange(startDate, endDate);
  }

  private calculateTotalHours(events: CalendarEvent[]): number {
    let totalMs = 0;
    for (const event of events) {
      totalMs += event.endDate.getTime() - event.startDate.getTime();
    }
    return totalMs / (60 * 60 * 1000); // Convert to hours
  }

  private identifyBusyDays(events: CalendarEvent[]): string[] {
    const dayHours: Record<string, number> = {};
    
    for (const event of events) {
      const date = event.startDate.toDateString();
      const duration = (event.endDate.getTime() - event.startDate.getTime()) / (60 * 60 * 1000);
      dayHours[date] = (dayHours[date] || 0) + duration;
    }
    
    // Consider days with 6+ hours of meetings as busy
    return Object.entries(dayHours)
      .filter(([date, hours]) => hours >= 6)
      .map(([date]) => date);
  }

  private calculateFreeTime(events: CalendarEvent[]): number {
    const totalHours = this.calculateTotalHours(events);
    const workingHours = 8; // Assume 8-hour work days
    const workingDays = 5; // Monday-Friday
    const totalWorkingHours = workingHours * workingDays;
    
    return Math.max(0, totalWorkingHours - totalHours);
  }

  private identifyPatterns(events: CalendarEvent[]): any {
    const patterns = {
      recurringMeetings: [] as string[],
      peakHours: {} as Record<string, number>,
      commonDurations: {} as Record<string, number>,
      meetingTypes: {} as Record<string, number>
    };
    
    // Analyze event timing patterns
    const hourCounts: Record<number, number> = {};
    const durationCounts: Record<number, number> = {};
    
    for (const event of events) {
      const hour = event.startDate.getHours();
      const duration = Math.round((event.endDate.getTime() - event.startDate.getTime()) / (60 * 1000)); // minutes
      
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      durationCounts[duration] = (durationCounts[duration] || 0) + 1;
      
      // Identify potential recurring meetings
      const title = event.title.toLowerCase();
      if (title.includes('standup') || title.includes('weekly') || title.includes('daily')) {
        patterns.recurringMeetings.push(event.title);
      }
    }
    
    // Find peak hours
    patterns.peakHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .reduce((obj, [hour, count]) => ({ ...obj, [hour]: count }), {});
    
    // Find common durations
    patterns.commonDurations = Object.entries(durationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .reduce((obj, [duration, count]) => ({ ...obj, [`${duration}min`]: count }), {});
    
    return patterns;
  }

  private generateScheduleRecommendations(events: CalendarEvent[]): string[] {
    const recommendations: string[] = [];
    const totalHours = this.calculateTotalHours(events);
    const busyDays = this.identifyBusyDays(events);
    
    if (totalHours > 40) {
      recommendations.push('Consider reducing meeting load - currently over 40 hours of meetings');
    }
    
    if (busyDays.length > 3) {
      recommendations.push('Too many busy days - try to distribute meetings more evenly');
    }
    
    // Check for back-to-back meetings
    const sortedEvents = events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    let backToBackCount = 0;
    
    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEnd = sortedEvents[i - 1].endDate;
      const currentStart = sortedEvents[i].startDate;
      
      if (currentStart.getTime() - prevEnd.getTime() < 15 * 60 * 1000) { // Less than 15 minutes
        backToBackCount++;
      }
    }
    
    if (backToBackCount > 5) {
      recommendations.push('Add buffer time between meetings to avoid fatigue');
    }
    
    // Check for early/late meetings
    const earlyMeetings = events.filter(e => e.startDate.getHours() < 9).length;
    const lateMeetings = events.filter(e => e.endDate.getHours() > 17).length;
    
    if (earlyMeetings > 2) {
      recommendations.push('Consider moving early meetings to standard working hours');
    }
    
    if (lateMeetings > 2) {
      recommendations.push('Try to end meetings before 5 PM for better work-life balance');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Your schedule looks well-balanced!');
    }
    
    return recommendations;
  }

  private async generateScheduleInsights(analysis: any): Promise<string> {
    const insights = [
      `Total of ${analysis.totalEvents} events scheduled`,
      `${analysis.totalHours.toFixed(1)} hours of meetings`,
      `${analysis.busyDays.length} busy days identified`,
      `${analysis.freeTime.toFixed(1)} hours of free time remaining`
    ];
    
    if (analysis.patterns.peakHours) {
      const peakHour = Object.keys(analysis.patterns.peakHours)[0];
      insights.push(`Most meetings scheduled at ${peakHour}:00`);
    }
    
    return `${insights.join('. ')  }.`;
  }

  private async rescheduleEvent(intent: any): Promise<any> {
    return { rescheduled: false };
  }

  private async getUpcomingEvents(intent: any): Promise<any> {
    return { events: [] };
  }

  private async handleGeneralCalendarQuery(request: string): Promise<any> {
    return { response: 'General calendar query processed' };
  }

  /**
   * Parse timeframe string into start and end dates
   */
  private parseTimeframe(timeframe: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (timeframe.toLowerCase()) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'tomorrow':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'next_week':
        const currentWeekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
        startDate = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      default:
        // Default to next 7 days
        startDate = new Date(now);
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    return { startDate, endDate };
  }

  /**
   * Set time to working hours
   */
  private setTimeToWorkingHours(date: Date, timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }

  /**
   * Check if time matches user preference
   */
  private timeMatchesPreference(time: Date, preference: any): boolean {
    // This would implement logic to match against user time preferences
    // For now, just check if it's within preferred hour range
    const hour = time.getHours();
    return hour >= (preference.startHour || 9) && hour <= (preference.endHour || 17);
  }
}

export default CalendarAgent;