#!/usr/bin/env node

/**
 * Environment Variable Validator
 * Ensures all required environment variables are set
 */

const requiredEnvVars = [
  'NODE_ENV',
  // Add your required environment variables here
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('\x1b[31mError: Missing required environment variables:\x1b[0m');
  missingVars.forEach((varName) => {
    console.error(`  - ${varName}`);
  });
  process.exit(1);
}

process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('\x1b[32m✓ All required environment variables are set\x1b[0m');
