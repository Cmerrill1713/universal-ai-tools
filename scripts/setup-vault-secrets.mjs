#!/usr/bin/env node

/**
 * Simple Vault Secrets Setup Script
 * Sets up basic secrets for development
 */

import crypto from 'crypto';

console.log('🔐 Setting up basic vault secrets...\n');

// Generate secure secrets
const jwtSecret = crypto.randomBytes(64).toString('hex');
const networkApiKey = crypto.randomBytes(32).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('📋 Generated secrets:');
console.log(`JWT_SECRET="${jwtSecret}"`);
console.log(`NETWORK_API_KEY="${networkApiKey}"`);
console.log(`ENCRYPTION_KEY="${encryptionKey}"\n`);

console.log('💡 Copy these values to your .env file');
console.log('🔒 Keep these secrets secure and never commit them to version control\n');

// For development, we'll use the generated secrets directly
console.log('🔧 For immediate testing, the system will use generated secrets');
console.log('📝 In production, use a proper secrets management system\n');

// Export for use in other scripts
export { jwtSecret, networkApiKey, encryptionKey };
