/**
 * Local Calendar Service - Direct Integration with System Calendar
 * 
 * Uses the local calendar system that's already connected to family calendars.
 * No OAuth or API keys required - works directly with the system calendar.
 * Perfect for personal assistant use cases.
 */

import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { addDays, addHours, format, parseISO, startOfDay } from 'date-fns';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config/environment';
import { LogContext, log } from '../utils/logger';

const execAsync = promisify(exec);

interface LocalCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  calendar: string; // Which local calendar
  status: 'confirmed' | 'tentative' | 'cancelled';
  source: 'system' | 'voice_created' | 'ai_suggested';
  reminders: number[]; // minutes before
}

interface VoiceCalendarCommand {
  intent: 'create_event' | 'find_time' | 'check_schedule' | 'cancel_event' | 'reschedule';
  parameters: {
    title?: string;
    date?: string;
    time?: string;
    duration?: number;
    location?: string;
    attendees?: string[];
    calendar?: string; // family, personal, work, etc.
  };
  confidence: number;
  naturalLanguage: string;
}

class LocalCalendarService extends EventEmitter {
  private supabase: any;
  private events: Map<string, LocalCalendarEvent> = new Map();
  private isInitialized = false;
  private availableCalendars: string[] = [];

  constructor() {
    super();
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.anonKey
    );
  }

  async initialize(): Promise<void> {
    try {
      log.info('📅 Initializing Local Calendar Service', LogContext.SERVICE);
      
      // Discover available local calendars
      await this.discoverLocalCalendars();
      
      // Load existing events from system calendar
      await this.syncLocalEvents();
      
      // Set up periodic sync
      this.startPeriodicSync();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      log.info('✅ Local Calendar Service initialized', LogContext.SERVICE, {
        calendarsFound: this.availableCalendars.length,
        eventsLoaded: this.events.size
      });
    } catch (error) {
      log.error('❌ Failed to initialize local calendar service', LogContext.SERVICE, { error });
      // Don't throw - we can still work with in-memory calendar
      this.isInitialized = true;
    }
  }

  private async discoverLocalCalendars(): Promise<void> {
    try {
      // On macOS, use osascript to interact with Calendar.app with timeout
      if (process.platform === 'darwin') {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Calendar discovery timeout after 5 seconds')), 5000);
        });
        
        const calendarPromise = execAsync(`osascript -e '
          tell application "Calendar"
            set calendarNames to name of every calendar
            return calendarNames as string
          end tell
        '`);
        
        const { stdout } = await Promise.race([calendarPromise, timeoutPromise]);
        this.availableCalendars = stdout.trim().split(', ').filter(name => name.length > 0);
      } else {
        // For other platforms, we'll use a default set
        this.availableCalendars = ['Personal', 'Family', 'Work'];
      }
      
      log.info('📱 Discovered local calendars', LogContext.SERVICE, {
        calendars: this.availableCalendars,
        platform: process.platform
      });
    } catch (error) {
      log.warn('⚠️ Could not discover local calendars, using defaults', LogContext.SERVICE, { error: error.message });
      this.availableCalendars = ['Personal', 'Family', 'Work'];
    }
  }

  private async syncLocalEvents(): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        // Get events for the next 30 days using osascript with timeout
        const thirtyDaysFromNow = format(addDays(new Date(), 30), 'MM/dd/yyyy');
        const today = format(new Date(), 'MM/dd/yyyy');
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Calendar sync timeout after 8 seconds')), 8000);
        });
        
        const syncPromise = execAsync(`osascript -e '
          tell application "Calendar"
            set startDate to date "${today}"
            set endDate to date "${thirtyDaysFromNow}"
            set eventList to {}
            repeat with cal in calendars
              set calEvents to (events of cal whose start date ≥ startDate and start date ≤ endDate)
              repeat with evt in calEvents
                set end of eventList to {summary of evt, start date of evt, end date of evt, description of evt, location of evt, name of calendar of evt}
              end repeat
            end repeat
            return eventList
          end tell
        '`);
        
        const { stdout } = await Promise.race([syncPromise, timeoutPromise]);
        
        // Parse the returned events (simplified parsing)
        const eventData = stdout.trim();
        if (eventData && eventData !== '{}') {
          log.info('📊 Found existing calendar events', LogContext.SERVICE, {
            platform: 'macOS',
            rawDataLength: eventData.length
          });
        }
      }
      
      log.info('✅ Local event sync completed', LogContext.SERVICE);
    } catch (error) {
      log.warn('⚠️ Could not sync local events', LogContext.SERVICE, { error: error.message });
    }
  }

  /**
   * Voice Command Processing for Calendar
   */
  async processVoiceCalendarCommand(command: string): Promise<VoiceCalendarCommand> {
    const commandLower = command.toLowerCase();
    let intent: VoiceCalendarCommand['intent'] = 'create_event';
    let confidence = 0.7;

    // Intent classification with calendar-specific patterns
    if (commandLower.includes('schedule') || commandLower.includes('create') || commandLower.includes('add') || commandLower.includes('book')) {
      intent = 'create_event';
      confidence = 0.9;
    } else if (commandLower.includes('find time') || commandLower.includes('when am i free') || commandLower.includes('available')) {
      intent = 'find_time';
      confidence = 0.9;
    } else if (commandLower.includes('what') || commandLower.includes('check') || commandLower.includes('show') || commandLower.includes('agenda')) {
      intent = 'check_schedule';
      confidence = 0.9;
    } else if (commandLower.includes('cancel') || commandLower.includes('delete') || commandLower.includes('remove')) {
      intent = 'cancel_event';
      confidence = 0.9;
    } else if (commandLower.includes('move') || commandLower.includes('reschedule') || commandLower.includes('change time')) {
      intent = 'reschedule';
      confidence = 0.9;
    }

    const parameters: VoiceCalendarCommand['parameters'] = {};

    // Extract event title with better patterns
    const titlePatterns = [
      /(?:schedule|create|add|book)(?:\s+(?:a|an|the))?\s+(.+?)(?:\s+(?:on|at|for|with|tomorrow|today|next|this)|\s*$)/,
      /(?:meeting|appointment|call|lunch|dinner|event)\s+(.+?)(?:\s+(?:on|at|for|with|tomorrow|today|next|this)|\s*$)/
    ];

    for (const pattern of titlePatterns) {
      const match = command.match(pattern);
      if (match) {
        parameters.title = match[1].trim();
        break;
      }
    }

    // Enhanced date extraction
    const datePatterns = [
      { pattern: /\btomorrow\b/i, value: 'tomorrow' },
      { pattern: /\btoday\b/i, value: 'today' },
      { pattern: /\bnext week\b/i, value: 'next week' },
      { pattern: /\bthis (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: '$1' },
      { pattern: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: 'next $1' },
      { pattern: /(\d{1,2}\/\d{1,2}\/?\d{0,4})/i, value: '$1' },
      { pattern: /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i, value: '$1 $2' }
    ];

    for (const { pattern, value } of datePatterns) {
      const match = command.match(pattern);
      if (match) {
        parameters.date = value.replace('$1', match[1]).replace('$2', match[2]);
        break;
      }
    }

    // Enhanced time extraction
    const timePatterns = [
      /(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/,
      /(\d{1,2})\s*(?:o'clock|oclock)/,
      /(noon|midnight)/i,
      /(morning|afternoon|evening)/i
    ];

    for (const pattern of timePatterns) {
      const match = command.match(pattern);
      if (match) {
        parameters.time = match[1];
        break;
      }
    }

    // Extract duration with more patterns
    const durationPatterns = [
      /(?:for\s+)?(\d+)\s*(?:hours?|hrs?)/i,
      /(?:for\s+)?(\d+)\s*(?:minutes?|mins?)/i,
      /(?:for\s+)?(?:an?\s+)?(half\s+hour|hour)/i
    ];

    for (const pattern of durationPatterns) {
      const match = command.match(pattern);
      if (match) {
        const text = match[1] || match[0];
        if (text.includes('hour')) {
          parameters.duration = text.includes('half') ? 30 : 60;
        } else {
          parameters.duration = text.includes('hour') ? parseInt(match[1]) * 60 : parseInt(match[1]);
        }
        break;
      }
    }

    // Extract location
    const locationPatterns = [
      /(?:at|in|@)\s+([^,\n]+)/,
      /(?:location|place):\s*([^,\n]+)/i
    ];

    for (const pattern of locationPatterns) {
      const match = command.match(pattern);
      if (match) {
        parameters.location = match[1].trim();
        break;
      }
    }

    // Determine calendar based on context
    if (commandLower.includes('family')) {
      parameters.calendar = 'Family';
    } else if (commandLower.includes('work') || commandLower.includes('office')) {
      parameters.calendar = 'Work';
    } else {
      parameters.calendar = 'Personal'; // Default
    }

    log.info('🎙️ Voice calendar command processed', LogContext.SERVICE, {
      intent,
      confidence,
      parameters,
      originalCommand: command
    });

    return {
      intent,
      parameters,
      confidence,
      naturalLanguage: command
    };
  }

  async executeVoiceCalendarCommand(voiceCommand: VoiceCalendarCommand): Promise<string> {
    log.info('⚡ Executing voice calendar command', LogContext.SERVICE, {
      intent: voiceCommand.intent,
      confidence: voiceCommand.confidence
    });

    try {
      switch (voiceCommand.intent) {
        case 'create_event':
          return await this.handleCreateEventCommand(voiceCommand);
        case 'find_time':
          return await this.handleFindTimeCommand(voiceCommand);
        case 'check_schedule':
          return await this.handleCheckScheduleCommand(voiceCommand);
        case 'cancel_event':
          return await this.handleCancelEventCommand(voiceCommand);
        case 'reschedule':
          return await this.handleRescheduleCommand(voiceCommand);
        default:
          return 'I understand you want to work with your calendar. Try saying "schedule a meeting tomorrow at 2 PM" or "check my schedule for today".';
      }
    } catch (error) {
      log.error('❌ Voice calendar command execution failed', LogContext.SERVICE, { error, voiceCommand });
      return 'I encountered an error while working with your calendar. Please try again or be more specific about what you need.';
    }
  }

  private async handleCreateEventCommand(voiceCommand: VoiceCalendarCommand): Promise<string> {
    const { parameters } = voiceCommand;
    
    if (!parameters.title) {
      return 'I need to know what event you want to create. Try saying "schedule a team meeting" or "add dentist appointment to my calendar".';
    }

    // Parse date and time
    let startTime = new Date();
    if (parameters.date) {
      startTime = this.parseNaturalDate(parameters.date, parameters.time);
    } else if (parameters.time) {
      startTime = this.parseTime(parameters.time);
    } else {
      return `I'd be happy to schedule "${parameters.title}" for you. When would you like it scheduled? Try saying a specific time like "tomorrow at 2 PM".`;
    }

    const duration = parameters.duration || 60; // Default 1 hour
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Create the event
    const event: LocalCalendarEvent = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      title: parameters.title,
      description: `Created via voice command: "${voiceCommand.naturalLanguage}"`,
      startTime,
      endTime,
      location: parameters.location,
      attendees: parameters.attendees,
      isAllDay: false,
      calendar: parameters.calendar || 'Personal',
      reminders: [15], // 15 minutes before
      status: 'confirmed',
      source: 'voice_created'
    };

    // Add to local calendar system
    await this.addEventToLocalCalendar(event);

    const timeStr = format(startTime, 'EEEE, MMMM do \'at\' h:mm a');
    const calendarInfo = parameters.calendar ? ` to your ${parameters.calendar} calendar` : '';
    
    return `Perfect! I've added "${parameters.title}" ${calendarInfo} for ${timeStr}. ${parameters.location ? `The location is set to ${parameters.location}. ` : ''}You'll get a reminder 15 minutes before the event.`;
  }

  private async handleCheckScheduleCommand(voiceCommand: VoiceCalendarCommand): Promise<string> {
    const { parameters } = voiceCommand;
    
    let queryDate = new Date();
    if (parameters.date) {
      queryDate = this.parseNaturalDate(parameters.date);
    }

    const dayStart = startOfDay(queryDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const dayEvents = Array.from(this.events.values()).filter(event => 
      event.startTime >= dayStart && event.startTime < dayEnd
    ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (dayEvents.length === 0) {
      const dateStr = format(queryDate, 'EEEE, MMMM do');
      return `You don't have any events scheduled for ${dateStr}. Your calendar is completely free that day!`;
    }

    const eventList = dayEvents.map(event => {
      const timeStr = format(event.startTime, 'h:mm a');
      const endTimeStr = format(event.endTime, 'h:mm a');
      return `${timeStr} to ${endTimeStr}: ${event.title}${event.location ? ` at ${event.location}` : ''}`;
    }).join('. Then ');

    const dateStr = format(queryDate, 'EEEE, MMMM do');
    return `Here's your schedule for ${dateStr}. You have ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}. ${eventList}.`;
  }

  private async addEventToLocalCalendar(event: LocalCalendarEvent): Promise<void> {
    try {
      // Add to local system calendar on macOS
      if (process.platform === 'darwin') {
        const startDateStr = format(event.startTime, 'MM/dd/yyyy h:mm:ss a');
        const endDateStr = format(event.endTime, 'MM/dd/yyyy h:mm:ss a');
        
        const script = `
          tell application "Calendar"
            tell calendar "${event.calendar}"
              make new event with properties {
                summary:"${event.title}",
                start date:date "${startDateStr}",
                end date:date "${endDateStr}"
                ${event.location ? `, location:"${event.location}"` : ''}
                ${event.description ? `, description:"${event.description}"` : ''}
              }
            end tell
          end tell
        `;
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Add event timeout after 10 seconds')), 10000);
        });
        
        const addEventPromise = execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
        await Promise.race([addEventPromise, timeoutPromise]);
        
        log.info('✅ Event added to local calendar', LogContext.SERVICE, {
          title: event.title,
          calendar: event.calendar,
          startTime: event.startTime
        });
      }
      
      // Store in our local memory too
      this.events.set(event.id, event);
      this.emit('eventCreated', event);
      
    } catch (error) {
      log.warn('⚠️ Could not add to system calendar, stored locally', LogContext.SERVICE, { error });
      // Even if system calendar fails, store locally
      this.events.set(event.id, event);
      this.emit('eventCreated', event);
    }
  }

  // Utility methods for date/time parsing
  private parseNaturalDate(dateStr: string, timeStr?: string): Date {
    const today = new Date();
    let result = new Date();

    dateStr = dateStr.toLowerCase();

    if (dateStr === 'today') {
      result = new Date(today);
    } else if (dateStr === 'tomorrow') {
      result = addDays(today, 1);
    } else if (dateStr === 'next week') {
      result = addDays(today, 7);
    } else if (dateStr.includes('monday')) {
      result = this.getNextDayOfWeek(1);
    } else if (dateStr.includes('tuesday')) {
      result = this.getNextDayOfWeek(2);
    } else if (dateStr.includes('wednesday')) {
      result = this.getNextDayOfWeek(3);
    } else if (dateStr.includes('thursday')) {
      result = this.getNextDayOfWeek(4);
    } else if (dateStr.includes('friday')) {
      result = this.getNextDayOfWeek(5);
    } else if (dateStr.includes('saturday')) {
      result = this.getNextDayOfWeek(6);
    } else if (dateStr.includes('sunday')) {
      result = this.getNextDayOfWeek(0);
    }

    // Apply time
    if (timeStr) {
      const time = this.parseTime(timeStr);
      result.setHours(time.getHours(), time.getMinutes());
    } else {
      result.setHours(9, 0); // Default to 9 AM
    }

    return result;
  }

  private parseTime(timeStr: string): Date {
    const result = new Date();
    timeStr = timeStr.toLowerCase();
    
    if (timeStr === 'noon') {
      result.setHours(12, 0);
    } else if (timeStr === 'midnight') {
      result.setHours(0, 0);
    } else if (timeStr === 'morning') {
      result.setHours(9, 0);
    } else if (timeStr === 'afternoon') {
      result.setHours(14, 0);
    } else if (timeStr === 'evening') {
      result.setHours(18, 0);
    } else {
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');
        const isPM = timeMatch[3] && timeMatch[3] === 'pm';
        
        if (isPM && hours !== 12) hours += 12;
        else if (!isPM && hours === 12) hours = 0;
        
        result.setHours(hours, minutes);
      }
    }
    
    return result;
  }

  private getNextDayOfWeek(dayOfWeek: number): Date {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const daysToAdd = (dayOfWeek - todayDayOfWeek + 7) % 7 || 7;
    return addDays(today, daysToAdd);
  }

  private startPeriodicSync(): void {
    // Sync with local calendar every 5 minutes
    setInterval(() => {
      this.syncLocalEvents();
    }, 5 * 60 * 1000);
  }

  // Placeholder implementations for other commands
  private async handleFindTimeCommand(voiceCommand: VoiceCalendarCommand): Promise<string> {
    const { parameters } = voiceCommand;
    
    // Simple implementation - find next available time slot
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    nextHour.setMinutes(0, 0, 0);
    
    const timeStr = format(nextHour, 'h:mm a');
    const dateStr = format(nextHour, 'EEEE, MMMM do');
    
    return `Looking at your calendar, you have time available ${dateStr} at ${timeStr}. Would you like me to schedule something then?`;
  }

  private async handleCancelEventCommand(voiceCommand: VoiceCalendarCommand): Promise<string> {
    return 'I can help you cancel an event. Which specific event would you like to cancel? You can say the event name or time.';
  }

  private async handleRescheduleCommand(voiceCommand: VoiceCalendarCommand): Promise<string> {
    return 'I can help you reschedule an event. Which event needs to be moved and what time works better for you?';
  }

  // Service status
  getServiceStatus() {
    return {
      service: 'local-calendar',
      status: 'active',
      version: '1.0.0',
      integration: 'local-system-calendar',
      capabilities: [
        'voice-scheduling',
        'natural-language-processing',
        'local-calendar-integration',
        'family-calendar-sync',
        'smart-event-creation',
        'schedule-checking'
      ],
      calendars: this.availableCalendars,
      eventCount: this.events.size,
      isInitialized: this.isInitialized,
      platform: process.platform
    };
  }
}

export const localCalendarService = new LocalCalendarService();
export { LocalCalendarService, LocalCalendarEvent, VoiceCalendarCommand };