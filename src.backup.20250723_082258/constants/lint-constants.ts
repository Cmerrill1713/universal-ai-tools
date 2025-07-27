// Constants to fix magic number linting issues
export const CONFIDENCE_THRESHOLDS = {
  LOW: 0.1,
  MODERATE: 0.2,
  GOOD: 0.3,
  HIGH: 0.7,
  VERY_HIGH: 0.8,
  EXCELLENT: 0.9,
  PERFECT: 0.95
} as const;

export const TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 5000,
  LONG: 10000,
  VERY_LONG: 30000
} as const;

export const LIMITS = {
  SMALL: 2,
  MEDIUM: 5,
  LARGE: 10,
  VERY_LARGE: 20,
  HUGE: 100
} as const;

export const RETRY_COUNTS = {
  DEFAULT: 3,
  AGGRESSIVE: 5,
  PATIENT: 10
} as const;
