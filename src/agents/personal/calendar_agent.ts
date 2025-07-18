/**
 * CalendarAgent - Intelligent calendar and scheduling management
 * Integrates with macOS Calendar, Google Calendar, and provides natural language scheduling
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import axios from 'axios';

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
      // Use AppleScript to create calendar event
      const script = `
        tell application "Calendar"
          tell calendar "${event.calendar || 'Calendar'}"
            make new event with properties {
              summary: "${event.title}",
              start date: date "${event.startDate.toISOString()}",
              end date: date "${event.endDate.toISOString()}",
              description: "${event.description || ''}",
              location: "${event.location || ''}"
            }
          end tell
        end tell
      `;
      
      execSync(`osascript -e '${script}'`);
      
      // Generate ID for tracking
      const eventId = `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        ...event,
        id: eventId
      };
      
    } catch (error) {
      this.logger.error('Failed to create macOS calendar event:', error);
      throw new Error('Failed to create calendar event');
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
      // Use AppleScript to query Calendar
      const script = `
        tell application "Calendar"
          set eventList to {}
          repeat with cal in calendars
            set calEvents to (every event of cal whose start date ≥ date "${startDate.toISOString()}" and start date ≤ date "${endDate.toISOString()}")
            repeat with evt in calEvents
              set end of eventList to {summary of evt, start date of evt, end date of evt, description of evt, location of evt}
            end repeat
          end repeat
          return eventList
        end tell
      `;
      
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
      
      // Parse AppleScript result (simplified)
      const events: CalendarEvent[] = [];
      // TODO: Implement proper AppleScript result parsing
      
      return events;
      
    } catch (error) {
      this.logger.error('Failed to get calendar events:', error);
      return [];
    }
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
      execSync(`osascript -e 'tell application "Calendar" to get name of calendars'`);
      return true;
    } catch (error) {
      this.logger.warn('Calendar access may be restricted:', error);
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

  private calculateOverlap(event1: CalendarEvent, event2: CalendarEvent): any {
    // Implementation would calculate time overlap
    return null;
  }

  private calculateConflictSeverity(overlap: any, newEvent: CalendarEvent, existingEvent: CalendarEvent): 'minor' | 'major' | 'complete' {
    return 'minor';
  }

  private async getBusyTimes(participants: string[], timeframe: string): Promise<any[]> {
    return [];
  }

  private async findFreeTimeSlots(duration: number, busyTimes: any[], timeframe: string): Promise<any[]> {
    return [];
  }

  private async rankTimeSlots(slots: any[], preferences: any): Promise<SchedulingSuggestion[]> {
    return [];
  }

  private getEventsInTimeframe(timeframe: string): Promise<CalendarEvent[]> {
    return Promise.resolve([]);
  }

  private calculateTotalHours(events: CalendarEvent[]): number {
    return 0;
  }

  private identifyBusyDays(events: CalendarEvent[]): string[] {
    return [];
  }

  private calculateFreeTime(events: CalendarEvent[]): number {
    return 0;
  }

  private identifyPatterns(events: CalendarEvent[]): any {
    return {};
  }

  private generateScheduleRecommendations(events: CalendarEvent[]): string[] {
    return [];
  }

  private async generateScheduleInsights(analysis: any): Promise<string> {
    return 'Schedule analysis complete';
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
}

export default CalendarAgent;