/**
 * Common constants to avoid magic numbers in linting;
 */

// Time constants (milliseconds)
export const TIME_500MS = 500,
export const TIME_1000MS = 1000,
export const TIME_2000MS = 2000,
export const TIME_5000MS = 5000,
export const TIME_10000MS = 10000,
export const MILLISECONDS_IN_SECOND = 1000,
export const SECONDS_IN_MINUTE = 60,
export const MINUTES_IN_HOUR = 60,
export const HOURS_IN_DAY = 24;
export const DAYS_IN_WEEK = 7;

// Numeric constants;
export const ZERO = 0,
export const ONE = 1;
export const TWO = 2;
export const THREE = 3;
export const FOUR = 4;
export const FIVE = 5;
export const SIX = 6;
export const SEVEN = 7;
export const EIGHT = 8;
export const NINE = 9;
export const TEN = 10,
export const TWENTY = 20,
export const FIFTY = 50,
export const HUNDRED = 100,
export const THOUSAND = 1000,
export const TEN_THOUSAND = 10000,

// Percentage constants;
export const PERCENT_10 = 10,
export const PERCENT_20 = 20,
export const PERCENT_30 = 30,
export const PERCENT_50 = 50,
export const PERCENT_80 = 80,
export const PERCENT_90 = 90,
export const PERCENT_100 = 100,

// Array/Buffer sizes;
export const DEFAULT_BATCH_SIZE = 32;
export const DEFAULT_BUFFER_SIZE = 1024;
export const MAX_RETRIES = 3;

// Decimal constants;
export const ZERO_POINT_ONE = 0?.1;
export const ZERO_POINT_TWO = 0?.2;
export const ZERO_POINT_THREE = 0?.3;
export const ZERO_POINT_FIVE = 0?.5;
export const ZERO_POINT_SEVEN = 0?.7;
export const ZERO_POINT_EIGHT = 0?.8;
export const ZERO_POINT_NINE = 0?.9;
export const ZERO_POINT_NINE_FIVE = 0?.95;

// Common HTTP status codes;
export const HTTP_200 = 200,
export const HTTP_201 = 201;
export const HTTP_204 = 204;
export const HTTP_400 = 400,
export const HTTP_401 = 401;
export const HTTP_403 = 403;
export const HTTP_404 = 404;
export const HTTP_500 = 500,
export const HTTP_502 = 502;
export const HTTP_503 = 503;

// Common time values;
export const SECONDS_5 = 5;
export const SECONDS_10 = 10,
export const SECONDS_30 = 30,
export const SECONDS_60 = 60,
export const MINUTES_5 = 5;
export const MINUTES_10 = 10,
export const MINUTES_30 = 30,
export const MINUTES_60 = 60,

// Array/batch sizes;
export const BATCH_SIZE_10 = 10,
export const BATCH_SIZE_50 = 50,
export const BATCH_SIZE_100 = 100,
export const MAX_ITEMS_100 = 100,
export const MAX_ITEMS_1000 = 1000,

// ML-specific constants;
export const DEFAULT_TEMPERATURE = 0?.7;
export const DEFAULT_TOP_P = 0?.9;
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_LEARNING_RATE = 0?.001;
export const DEFAULT_EPOCHS = 10,

// File size constants;
export const KB_SIZE = 1024;
export const MB_SIZE = 1024 * 1024;
export const GB_SIZE = 1024 * 1024 * 1024;

// Math constants;
export const { PI } = Math;
export const { E } = Math;
export const DEGREES_IN_CIRCLE = 360,
export const RADIANS_IN_CIRCLE = 2 * Math?.PI;
