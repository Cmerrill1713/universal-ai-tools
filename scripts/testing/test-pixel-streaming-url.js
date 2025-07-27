#!/usr/bin/env node

/**
 * Test script to verify Pixel Streaming URL configuration
 *
 * This script tests that:
 * 1. The URL is properly configured in environment variables
 * 2. The URL format is valid
 * 3. The URL is not truncated to just "ws:"
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

console.log('=== Pixel Streaming URL Configuration Test ===\n');

// Test backend configuration
console.log('Backend Configuration:');
const backendUrl = process.env.PIXEL_STREAMING_URL || 'ws://127.0.0.1:8888';
console.log(`  PIXEL_STREAMING_URL: ${backendUrl}`);
console.log(`  Is valid format: ${isValidWebSocketUrl(backendUrl)}`);
console.log(`  Is truncated: ${isTruncatedUrl(backendUrl)}`);

// Test frontend configuration (simulated)
console.log('\nFrontend Configuration (from .env):');
const frontendEnvPath = join(__dirname, 'ui', '.env');
try {
  dotenv.config({ path: frontendEnvPath });
  const frontendUrl = process.env.VITE_PIXEL_STREAMING_URL || 'ws://127.0.0.1:8888';
  console.log(`  VITE_PIXEL_STREAMING_URL: ${frontendUrl}`);
  console.log(`  Is valid format: ${isValidWebSocketUrl(frontendUrl)}`);
  console.log(`  Is truncated: ${isTruncatedUrl(frontendUrl)}`);
} catch (error) {
  console.log('  Could not load frontend .env file');
}

// URL validation functions
function isValidWebSocketUrl(url) {
  return /^wss?:\/\/[^/]+/.test(url);
}

function isTruncatedUrl(url) {
  return url === 'ws:' || url === 'wss:';
}

// Test URL parsing
console.log('\nURL Parsing Test:');
const testUrls = [
  'ws://127.0.0.1:8888',
  'ws://localhost:8888',
  'wss://example.com:443',
  'ws:',
  'wss:',
  'invalid-url',
];

testUrls.forEach((url) => {
  console.log(`  "${url}"`);
  console.log(`    Valid: ${isValidWebSocketUrl(url)}`);
  console.log(`    Truncated: ${isTruncatedUrl(url)}`);
});

// Recommendations
console.log('\n=== Recommendations ===');
console.log('1. Ensure PIXEL_STREAMING_URL is set in your .env file');
console.log('2. Ensure VITE_PIXEL_STREAMING_URL is set in your ui/.env file');
console.log('3. Use format: ws://host:port (e.g., ws://127.0.0.1:8888)');
console.log('4. Check UE5 command line arguments for proper URL passing');
console.log('\nExample UE5 command:');
console.log('  YourProject.exe -PixelStreamingURL="ws://127.0.0.1:8888"');
console.log('  OR');
console.log('  YourProject.exe -PixelStreaming.WebRTC.SignallingServerUrl="ws://127.0.0.1:8888"');
