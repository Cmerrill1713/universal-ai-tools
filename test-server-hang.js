#!/usr/bin/env node

console.log('📍 Starting server hang test...');

async function testImports() {
  try {
    console.log('📍 Testing express import...');
    const express = await import('express');
    console.log('✅ Express imported successfully');
    
    console.log('📍 Testing cors import...');
    const cors = await import('cors');
    console.log('✅ CORS imported successfully');
    
    console.log('📍 Testing @supabase/supabase-js import...');
    const { createClient } = await import('@supabase/supabase-js');
    console.log('✅ Supabase imported successfully');
    
    console.log('📍 Testing config import...');
    const { config } = await import('./dist/config/index.js');
    console.log('✅ Config imported successfully');
    
    console.log('📍 Testing logger import...');
    const { logger } = await import('./dist/utils/enhanced-logger.js');
    console.log('✅ Logger imported successfully');
    
    console.log('📍 Testing dspy-service import...');
    const { dspyService } = await import('./dist/services/dspy-service.js');
    console.log('✅ DSPy service imported successfully');
    
    console.log('📍 Testing security-hardening import...');
    const { securityHardeningService } = await import('./dist/services/security-hardening.js');
    console.log('✅ Security hardening service imported successfully');
    
    console.log('\n✅ All imports completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Set a timeout to detect hangs
const timeout = setTimeout(() => {
  console.error('\n❌ TIMEOUT: Import process hung for more than 10 seconds');
  process.exit(1);
}, 10000);

testImports().then(() => {
  clearTimeout(timeout);
});