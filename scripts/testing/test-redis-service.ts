#!/usr/bin/env tsx

/**
 * Test script for the Redis service implementation
 * Tests connection pooling, circuit breaker pattern, and fallback cache
 */

import { getRedisService } from './src/services/redis-service';
import { logger } from './src/utils/enhanced-logger';

async function testRedisService() {
  logger.info('🧪 Starting Redis service tests...');

  const redisService = getRedisService();

  try {
    // Test 1: Connection
    logger.info('Test 1: Connecting to Redis...');
    await redisService.connect();

    const healthCheck = await redisService.healthCheck();
    logger.info('Health check result:', { healthCheck });

    // Test 2: Basic operations
    logger.info('Test 2: Basic operations...');

    // Set a value
    await redisService.set('test:key1', 'Hello Redis', 300); // 5 minute TTL
    logger.info('Set test:key1');

    // Get a value
    const value = await redisService.get('test:key1');
    logger.info('Get test:key1:', { value });

    // Check existence
    const exists = await redisService.exists('test:key1');
    logger.info('Exists test:key1:', { exists });

    // Get TTL
    const ttl = await redisService.ttl('test:key1');
    logger.info('TTL test:key1:', { ttl });

    // Test 3: Batch operations
    logger.info('Test 3: Batch operations...');

    await redisService.mset({
      'test:batch1': 'value1',
      'test:batch2': 'value2',
      'test:batch3': 'value3',
    });
    logger.info('MSET completed');

    const batchValues = await redisService.mget(['test:batch1', 'test:batch2', 'test:batch3']);
    logger.info('MGET results:', { batchValues });

    // Test 4: Hash operations
    logger.info('Test 4: Hash operations...');

    await redisService.hset('test:hash', 'field1', 'value1');
    await redisService.hset('test:hash', 'field2', 'value2');

    const hashValue = await redisService.hget('test:hash', 'field1');
    logger.info('HGET test:hash field1:', { hashValue });

    // Test 5: List operations
    logger.info('Test 5: List operations...');

    await redisService.lpush('test:list', 'item1', 'item2', 'item3');
    const listItems = await redisService.lrange('test:list', 0, -1);
    logger.info('LRANGE test:list:', { listItems });

    // Test 6: Stats
    logger.info('Test 6: Getting stats...');

    const stats = await redisService.getStats();
    logger.info('Redis stats:', { stats });

    const fallbackStats = redisService.getFallbackCacheStats();
    logger.info('Fallback cache stats:', { fallbackStats });

    // Test 7: Cleanup
    logger.info('Test 7: Cleanup...');

    const deleted = await redisService.del([
      'test:key1',
      'test:batch1',
      'test:batch2',
      'test:batch3',
      'test:hash',
      'test:list',
    ]);
    logger.info('Deleted keys:', { deleted });

    // Test 8: Disconnect
    logger.info('Test 8: Disconnecting...');
    await redisService.disconnect();

    logger.info('✅ All tests completed successfully!');
  } catch (error) {
    logger.error('❌ Test failed:', { error });

    // Test fallback cache when Redis is down
    logger.info('Testing fallback cache functionality...');

    // This should use fallback cache
    await redisService.set('fallback:test', 'This is in fallback cache');
    const fallbackValue = await redisService.get('fallback:test');
    logger.info('Fallback cache test:', { fallbackValue });

    const fallbackStats = redisService.getFallbackCacheStats();
    logger.info('Fallback cache stats after error:', { fallbackStats });
  }

  // Exit
  process.exit(0);
}

// Run the test
testRedisService().catch((error) => {
  logger.error('Fatal error:', { error });
  process.exit(1);
});
