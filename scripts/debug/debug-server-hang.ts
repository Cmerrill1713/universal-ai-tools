#!/usr/bin/env node

// Add detailed logging to trace the exact point of hang

const originalRequire = Module.prototype.require;
const importStack: string[] = [];

// Override require to log all module loads
Module.prototype.require = function (id: string) {
  const start = Date.now();
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`[REQUIRE] ${' '.repeat(importStack.length * 2)}Loading: ${id}`);
  importStack.push(id);

  try {
    const result = originalRequire.apply(this, arguments);
    const duration = Date.now() - start;
    importStack.pop();
    console.log(`[REQUIRE] ${' '.repeat(importStack.length * 2)}✓ Loaded: ${id} (${duration}ms)`);
    return result;
  } catch (error) {
    importStack.pop();
    console.log(`[REQUIRE] ${' '.repeat(importStack.length * 2)}✗ Failed: ${id}`, error.message);
    throw error;
  }
};

// Now import the server
console.log('Starting server with detailed module tracking...\n');

import('./src/server.ts')
  .then(() => {
    console.log('\nServer module loaded successfully!');
  })
  .catch((error) => {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('\nServer module failed to load:', error);
    process.exit(1);
  });

// Set a timeout to detect hangs
setTimeout(() => {
  console.error('\n\n❌ TIMEOUT: Process hung for 30 seconds');
  console.error('Last module being loaded:', importStack[importStack.length - 1]);
  console.error('\nFull import stack:');
  importStack.forEach((module, index) => {
    console.error(`  ${' '.repeat(index * 2)}${module}`);
  });
  process.exit(1);
}, 30000);
