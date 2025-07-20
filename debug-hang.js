// Simple debug script to find what's blocking

console.log('Starting debug...');

// Hook into require to see what's loading
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id.includes('supabase') || id.includes('knowledge')) {
    console.log(`[REQUIRE] ${id}`);
  }
  return originalRequire.apply(this, arguments);
};

// Try to run the server
require('./dist/server.js');