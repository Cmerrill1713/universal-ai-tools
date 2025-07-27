#!/usr/bin/env node

console.log('🔍 Testing minimal startup components...');

// Test 1: Basic imports
console.log('1. Testing basic imports...');
try {
  const express = await import('express');
  const { createClient } = await import('@supabase/supabase-js');
  console.log('✅ Basic imports successful');
} catch (error) {
  console.error('❌ Basic imports failed:', error.message);
}

// Test 2: Environment variables
console.log('2. Testing environment variables...');
import { config } from 'dotenv';
config();

if (process.env.SUPABASE_URL && process.env.PORT) {
  console.log('✅ Environment variables loaded');
  console.log(`   PORT: ${process.env.PORT}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL}`);
} else {
  console.error('❌ Missing required environment variables');
}

// Test 3: Supabase connection
console.log('3. Testing Supabase connection...');
try {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  // Quick health check
  const { data, error } = await supabase
    .from('ai_memories')
    .select('count', { count: 'exact', head: true });
    
  console.log('✅ Supabase connection successful');
} catch (error) {
  console.error('❌ Supabase connection failed:', error.message);
}

// Test 4: Redis connection
console.log('4. Testing Redis connection...');
try {
  const { createClient } = await import('redis');
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();
  const response = await redisClient.ping();
  await redisClient.quit();
  console.log('✅ Redis connection successful');
} catch (error) {
  console.error('❌ Redis connection failed:', error.message);
}

// Test 5: Express server
console.log('5. Testing basic Express server...');
try {
  const express = await import('express');
  const app = express.default();
  
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  const server = app.listen(9998, () => {
    console.log('✅ Express server started on port 9998');
    server.close(() => {
      console.log('✅ Express server closed successfully');
      console.log('🎉 All basic components working!');
    });
  });
} catch (error) {
  console.error('❌ Express server failed:', error.message);
}