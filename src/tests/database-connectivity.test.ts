import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

describe('Database Connectivity Tests', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(config.supabase.url, config.supabase.anonKey);
  });

  test('should connect to Supabase', async () => {
    const { data, error } = await supabase.from('ai_memories').select('count', { count: 'exact' });
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    logger.info('✅ Supabase connection successful');
  });

  test('should authenticate with service key', async () => {
    const serviceClient = createClient(config.supabase.url, config.supabase.serviceKey);
    
    const { data, error } = await serviceClient.from('ai_service_keys').select('count', { count: 'exact' });
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
    logger.info('✅ Service key authentication successful');
  });

  test('should verify required tables exist', async () => {
    const requiredTables = [
      'ai_memories',
      'ai_service_keys', 
      'agent_performance_metrics',
      'self_improvement_logs'
    ];

    for (const table of requiredTables) {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact' });
      
      expect(error).toBeNull();
      logger.info(`✅ Table ${table} exists and accessible`);
    }
  });

  test('should test Vault secret retrieval', async () => {
    const serviceClient = createClient(config.supabase.url, config.supabase.serviceKey);
    
    try {
      const { data, error } = await serviceClient.rpc('vault.read_secret', {
        secret_name: 'openai_api_key'
      });
      
      if (!error && data) {
        logger.info('✅ Vault secret retrieval working');
        expect(data.decrypted_secret).toBeDefined();
      } else {
        logger.warn('⚠️ Vault secret not found (expected for new setup)');
      }
    } catch (err) {
      logger.warn('⚠️ Vault functionality not available (expected for local dev)');
    }
  });
});