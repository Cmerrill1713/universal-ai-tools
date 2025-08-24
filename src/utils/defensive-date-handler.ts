/**
 * Defensive Date Handling Utility
 * Provides safe date operations with proper error handling and validation
 */

export class DefensiveDateHandler {
  /**
   * Safely creates a Date object with validation
   */
  static safeDate(input?: string | number | Date): Date {
    try {
      const date = input ? new Date(input) : new Date();
      
      // Validate the date is not invalid
      if (isNaN(date.getTime())) {
        return new Date(); // Fallback to current date
      }
      
      // Check for reasonable date range (1970-2050)
      const year = date.getFullYear();
      if (year < 1970 || year > 2050) {
        return new Date(); // Fallback to current date
      }
      
      return date;
    } catch (error) {
      return new Date(); // Fallback to current date
    }
  }

  /**
   * Safely converts date to ISO string
   */
  static safeToISOString(input?: string | number | Date): string {
    try {
      const date = this.safeDate(input);
      return date.toISOString();
    } catch (error) {
      return new Date().toISOString(); // Fallback to current timestamp
    }
  }

  /**
   * Safely gets timestamp with validation
   */
  static safeTimestamp(input?: string | number | Date): number {
    try {
      const date = this.safeDate(input);
      return date.getTime();
    } catch (error) {
      return Date.now(); // Fallback to current timestamp
    }
  }

  /**
   * Safely gets Date.now() equivalent
   */
  static safeNow(): number {
    try {
      return Date.now();
    } catch (error) {
      return new Date().getTime(); // Fallback method
    }
  }

  /**
   * Validates if a date string is properly formatted ISO date
   */
  static isValidISOString(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return date.toISOString() === dateString;
    } catch {
      return false;
    }
  }

  /**
   * Calculates safe duration between two dates
   */
  static safeDuration(startTime: number, endTime?: number): number {
    try {
      const end = endTime || this.safeNow();
      const start = startTime || this.safeNow();
      const duration = Math.abs(end - start);
      
      // Sanity check: if duration is more than 24 hours, something is wrong
      const maxDuration = 24 * 60 * 60 * 1000; // 24 hours in ms
      return duration > maxDuration ? 0 : duration;
    } catch (error) {
      return 0; // Fallback to 0 duration
    }
  }

  /**
   * Creates a safe timestamp with metadata for logging
   */
  static createLogTimestamp(): { timestamp: string; timestampMs: number } {
    try {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        timestampMs: now.getTime()
      };
    } catch (error) {
      const fallback = new Date();
      return {
        timestamp: fallback.toISOString(),
        timestampMs: fallback.getTime()
      };
    }
  }
}

// Export individual functions for convenience
export const safeDate = DefensiveDateHandler.safeDate;
export const safeToISOString = DefensiveDateHandler.safeToISOString;
export const safeTimestamp = DefensiveDateHandler.safeTimestamp;
export const safeNow = DefensiveDateHandler.safeNow;
export const safeDuration = DefensiveDateHandler.safeDuration;
export const createLogTimestamp = DefensiveDateHandler.createLogTimestamp;