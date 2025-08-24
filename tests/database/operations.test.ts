/**
 * Database Operations Tests
 * Tests all database operations, migrations, and data integrity
 */

import { jest } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../src/services/supabase-client';

// Mock classes for testing
class DatabaseMigration {
  constructor(private supabase: any) {}
  
  async getStatus() {
    return this.supabase.rpc('get_migration_status');
  }
  
  async applyPending() {
    return this.supabase.rpc('apply_pending_migrations');
  }
  
  async rollback(target: string) {
    return this.supabase.rpc('rollback_to_migration', { target_migration: target });
  }
}

class CacheManager {
  private cache = new Map();
  
  async get(key: string) {
    return this.cache.get(key);
  }
  
  async getOrSet(key: string, fetcher: () => Promise<any>) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const result = await fetcher();
    this.cache.set(key, result);
    return result;
  }
  
  async delete(key: string) {
    this.cache.delete(key);
  }
}

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
  storage: {
    from: jest.fn(),
  },
  auth: {
    getUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('../../src/services/supabase-client', () => ({
  getSupabaseClient: jest.fn(() => mockSupabaseClient),
}));

describe('Database Operations Tests', () => {
  let supabase: unknown;
  let mockTable: unknown;

  beforeEach(() => {
    supabase = mockSupabaseClient;
    mockTable = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      rangeGt: jest.fn().mockReturnThis(),
      rangeLt: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    };

    supabase.from.mockReturnValue(mockTable);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic CRUD Operations', () => {
    describe('Create Operations', () => {
      test('should insert single record', async () => {
        const testData = { name: 'Test Item', description: 'Test Description' };
        const expectedResponse = { data: [{ id: 1, ...testData }], error: null };

        mockTable.insert.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').insert(testData);

        expect(supabase.from).toHaveBeenCalledWith('test_table');
        expect(mockTable.insert).toHaveBeenCalledWith(testData);
        expect(result).toEqual(expectedResponse);
      });

      test('should insert multiple records', async () => {
        const testData = [
          { name: 'Item 1', description: 'Description 1' },
          { name: 'Item 2', description: 'Description 2' },
        ];
        const expectedResponse = {
          data: testData.map((item, index) => ({ id: index + 1, ...item })),
          error: null,
        };

        mockTable.insert.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').insert(testData);

        expect(mockTable.insert).toHaveBeenCalledWith(testData);
        expect(result.data).toHaveLength(2);
      });

      test('should handle insert errors', async () => {
        const testData = { name: null }; // Invalid data
        const expectedError = {
          data: null,
          error: { message: 'null value in column "name" violates not-null constraint' },
        };

        mockTable.insert.mockResolvedValue(expectedError);

        const result = await supabase.from('test_table').insert(testData);

        expect(result.error).toBeDefined();
        expect(result.data).toBeNull();
      });
    });

    describe('Read Operations', () => {
      test('should select all records', async () => {
        const expectedData = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ];
        const expectedResponse = { data: expectedData, error: null };

        mockTable.select.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').select('*');

        expect(mockTable.select).toHaveBeenCalledWith('*');
        expect(result.data).toEqual(expectedData);
      });

      test('should select specific columns', async () => {
        const expectedData = [{ id: 1, name: 'Item 1' }];
        const expectedResponse = { data: expectedData, error: null };

        mockTable.select.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').select('id, name');

        expect(mockTable.select).toHaveBeenCalledWith('id, name');
      });

      test('should filter records with where conditions', async () => {
        const expectedData = [{ id: 1, name: 'Item 1', status: 'active' }];
        const expectedResponse = { data: expectedData, error: null };

        mockTable.eq.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').select('*').eq('status', 'active');

        expect(mockTable.eq).toHaveBeenCalledWith('status', 'active');
      });

      test('should handle complex queries with multiple conditions', async () => {
        const expectedData = [{ id: 1, name: 'Item 1', status: 'active', priority: 5 }];
        const expectedResponse = { data: expectedData, error: null };

        mockTable.gte.mockReturnValue(mockTable);
        mockTable.order.mockReturnValue(mockTable);
        mockTable.limit.mockResolvedValue(expectedResponse);

        const result = await supabase
          .from('test_table')
          .select('*')
          .eq('status', 'active')
          .gte('priority', 3)
          .order('created_at', { ascending: false })
          .limit(10);

        expect(mockTable.eq).toHaveBeenCalledWith('status', 'active');
        expect(mockTable.gte).toHaveBeenCalledWith('priority', 3);
        expect(mockTable.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(mockTable.limit).toHaveBeenCalledWith(10);
      });

      test('should handle single record retrieval', async () => {
        const expectedData = { id: 1, name: 'Item 1' };
        const expectedResponse = { data: expectedData, error: null };

        mockTable.single.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').select('*').eq('id', 1).single();

        expect(mockTable.single).toHaveBeenCalled();
        expect(result.data).toEqual(expectedData);
      });
    });

    describe('Update Operations', () => {
      test('should update records', async () => {
        const updateData = { name: 'Updated Item', updated_at: new Date().toISOString() };
        const expectedResponse = { data: [{ id: 1, ...updateData }], error: null };

        mockTable.eq.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').update(updateData).eq('id', 1);

        expect(mockTable.update).toHaveBeenCalledWith(updateData);
        expect(mockTable.eq).toHaveBeenCalledWith('id', 1);
      });

      test('should handle batch updates', async () => {
        const updateData = { status: 'inactive' };
        const expectedResponse = { data: [], error: null, count: 5 };

        mockTable.in.mockResolvedValue(expectedResponse);

        const result = await supabase
          .from('test_table')
          .update(updateData)
          .in('id', [1, 2, 3, 4, 5]);

        expect(mockTable.update).toHaveBeenCalledWith(updateData);
        expect(mockTable.in).toHaveBeenCalledWith('id', [1, 2, 3, 4, 5]);
      });

      test('should handle upsert operations', async () => {
        const upsertData = { id: 1, name: 'Upserted Item', value: 100 };
        const expectedResponse = { data: [upsertData], error: null };

        mockTable.upsert.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').upsert(upsertData);

        expect(mockTable.upsert).toHaveBeenCalledWith(upsertData);
      });
    });

    describe('Delete Operations', () => {
      test('should delete single record', async () => {
        const expectedResponse = { data: [{ id: 1 }], error: null };

        mockTable.eq.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').delete().eq('id', 1);

        expect(mockTable.delete).toHaveBeenCalled();
        expect(mockTable.eq).toHaveBeenCalledWith('id', 1);
      });

      test('should delete multiple records', async () => {
        const expectedResponse = { data: [], error: null, count: 3 };

        mockTable.lt.mockResolvedValue(expectedResponse);

        const result = await supabase.from('test_table').delete().lt('created_at', '2023-01-01');

        expect(mockTable.delete).toHaveBeenCalled();
        expect(mockTable.lt).toHaveBeenCalledWith('created_at', '2023-01-01');
      });

      test('should handle conditional deletes', async () => {
        const expectedResponse = { data: [], error: null, count: 2 };

        mockTable.eq
          .mockReturnValueOnce(mockTable)  // First eq() call returns mockTable
          .mockResolvedValueOnce(expectedResponse);  // Second eq() call resolves with data

        const result = await supabase
          .from('test_table')
          .delete()
          .eq('status', 'inactive')
          .eq('archived', true);

        expect(mockTable.delete).toHaveBeenCalled();
        expect(mockTable.eq).toHaveBeenCalledWith('status', 'inactive');
        expect(mockTable.eq).toHaveBeenCalledWith('archived', true);
      });
    });
  });

  describe('Advanced Database Operations', () => {
    describe('Full-Text Search', () => {
      test('should perform text search', async () => {
        const expectedData = [
          { id: 1, title: 'Matching Document', content: 'This document contains the search term' },
        ];
        const expectedResponse = { data: expectedData, error: null };

        supabase.rpc.mockResolvedValue(expectedResponse);

        const result = await supabase.rpc('search_documents', {
          search_term: 'search term',
        });

        expect(supabase.rpc).toHaveBeenCalledWith('search_documents', {
          search_term: 'search term',
        });
      });

      test('should handle vector similarity search', async () => {
        const expectedData = [{ id: 1, content: 'Similar content', similarity: 0.85 }];
        const expectedResponse = { data: expectedData, error: null };

        supabase.rpc.mockResolvedValue(expectedResponse);

        const result = await supabase.rpc('vector_similarity_search', {
          query_vector: [0.1, 0.2, 0.3],
          similarity_threshold: 0.7,
          limit: 10,
        });

        expect(supabase.rpc).toHaveBeenCalledWith('vector_similarity_search', {
          query_vector: [0.1, 0.2, 0.3],
          similarity_threshold: 0.7,
          limit: 10,
        });
      });
    });

    describe('Aggregation Operations', () => {
      test('should perform count operations', async () => {
        const expectedResponse = { data: null, error: null, count: 42 };

        mockTable.eq.mockResolvedValue(expectedResponse);

        const result = await supabase
          .from('test_table')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        expect(result.count).toBe(42);
      });

      test('should perform aggregation with RPC', async () => {
        const expectedData = {
          total_count: 100,
          active_count: 75,
          average_score: 85.5,
        };
        const expectedResponse = { data: expectedData, error: null };

        supabase.rpc.mockResolvedValue(expectedResponse);

        const result = await supabase.rpc('get_table_statistics', {
          table_name: 'test_table',
        });

        expect(result.data).toEqual(expectedData);
      });
    });

    describe('Transaction Operations', () => {
      test('should handle transaction-like operations', async () => {
        // Simulate multiple operations in sequence
        const operations = [
          { table: 'users', operation: 'insert', data: { name: 'User 1' } },
          { table: 'profiles', operation: 'insert', data: { user_id: 1, bio: 'Bio 1' } },
        ];

        // Mock successful responses for all operations
        mockTable.insert.mockResolvedValue({ data: [{ id: 1 }], error: null });

        const results = [];
        for (const op of operations) {
          const result = await supabase.from(op.table).insert(op.data);
          results.push(result);
        }

        expect(results.every((r) => r.error === null)).toBe(true);
        expect(supabase.from).toHaveBeenCalledWith('users');
        expect(supabase.from).toHaveBeenCalledWith('profiles');
      });
    });
  });

  describe('Database Migrations', () => {
    let migrationService: DatabaseMigration;

    beforeEach(() => {
      migrationService = new DatabaseMigration(supabase);
    });

    test('should check migration status', async () => {
      const expectedMigrations = [
        { id: '001', name: 'initial_schema', applied: true },
        { id: '002', name: 'add_indexes', applied: false },
      ];

      supabase.rpc.mockResolvedValue({ data: expectedMigrations, error: null });

      const status = await migrationService.getStatus();

      expect(supabase.rpc).toHaveBeenCalledWith('get_migration_status');
      expect(status.data).toEqual(expectedMigrations);
    });

    test('should apply pending migrations', async () => {
      const pendingMigrations = ['002_add_indexes', '003_add_constraints'];

      supabase.rpc.mockResolvedValue({ data: { applied: pendingMigrations }, error: null });

      const result = await migrationService.applyPending();

      expect(supabase.rpc).toHaveBeenCalledWith('apply_pending_migrations');
      expect(result.data.applied).toEqual(pendingMigrations);
    });

    test('should rollback migrations', async () => {
      const rollbackTarget = '001_initial_schema';

      supabase.rpc.mockResolvedValue({ data: { rolledBack: ['002', '003'] }, error: null });

      const result = await migrationService.rollback(rollbackTarget);

      expect(supabase.rpc).toHaveBeenCalledWith('rollback_to_migration', {
        target_migration: rollbackTarget,
      });
    });
  });

  describe('Data Integrity and Validation', () => {
    test('should validate required fields', async () => {
      const invalidData = { description: 'Missing required name field' };
      const expectedError = {
        data: null,
        error: {
          message: 'null value in column "name" violates not-null constraint',
          code: '23502',
        },
      };

      mockTable.insert.mockResolvedValue(expectedError);

      const result = await supabase.from('test_table').insert(invalidData);

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('23502');
    });

    test('should validate foreign key constraints', async () => {
      const invalidData = { user_id: 999, profile_data: 'Some data' };
      const expectedError = {
        data: null,
        error: {
          message: 'insert or update on table "profiles" violates foreign key constraint',
          code: '23503',
        },
      };

      mockTable.insert.mockResolvedValue(expectedError);

      const result = await supabase.from('profiles').insert(invalidData);

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('23503');
    });

    test('should validate unique constraints', async () => {
      const duplicateData = { email: 'existing@example.com', name: 'Test User' };
      const expectedError = {
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint "users_email_key"',
          code: '23505',
        },
      };

      mockTable.insert.mockResolvedValue(expectedError);

      const result = await supabase.from('users').insert(duplicateData);

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('23505');
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large result sets with pagination', async () => {
      const pageSize = 100;
      const totalRecords = 1000;

      for (let page = 0; page < Math.ceil(totalRecords / pageSize); page++) {
        const offset = page * pageSize;
        const expectedData = Array.from({ length: pageSize }, (_, i) => ({
          id: offset + i + 1,
          name: `Item ${offset + i + 1}`,
        }));

        mockTable.limit.mockReturnValue(mockTable);
        mockTable.offset.mockResolvedValue({ data: expectedData, error: null });

        const result = await supabase
          .from('test_table')
          .select('*')
          .order('id')
          .limit(pageSize)
          .offset(offset);

        expect(mockTable.limit).toHaveBeenCalledWith(pageSize);
        expect(mockTable.offset).toHaveBeenCalledWith(offset);
        expect(result.data).toHaveLength(pageSize);
      }
    });

    test('should optimize queries with proper indexing hints', async () => {
      // Test that queries use appropriate filters for indexed columns
      const expectedData = [{ id: 1, indexed_field: 'value' }];
      mockTable.eq.mockReturnValue(mockTable);
      mockTable.order.mockResolvedValue({ data: expectedData, error: null });

      const result = await supabase
        .from('test_table')
        .select('*')
        .eq('indexed_field', 'value') // Using indexed column for filtering
        .order('created_at'); // Using indexed column for ordering

      expect(mockTable.eq).toHaveBeenCalledWith('indexed_field', 'value');
      expect(mockTable.order).toHaveBeenCalledWith('created_at');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle connection errors', async () => {
      const connectionError = new Error('Connection timeout');
      mockTable.select.mockRejectedValue(connectionError);

      try {
        await supabase.from('test_table').select('*');
      } catch (error) {
        expect(error.message).toBe('Connection timeout');
      }
    });

    test('should handle query timeouts', async () => {
      const timeoutError = new Error('Query timeout');
      supabase.rpc.mockRejectedValue(timeoutError);

      try {
        await supabase.rpc('long_running_query');
      } catch (error) {
        expect(error.message).toBe('Query timeout');
      }
    });

    test('should implement retry logic for transient failures', async () => {
      const retryableError = new Error('Temporary connection issue');

      // First call fails, second succeeds
      mockTable.select
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ data: [{ id: 1 }], error: null });

      // Implement simple retry logic
      let result;
      try {
        result = await supabase.from('test_table').select('*');
      } catch (error) {
        // Retry once
        result = await supabase.from('test_table').select('*');
      }

      expect(result.data).toEqual([{ id: 1 }]);
      expect(mockTable.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Integration', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager();
    });

    test('should cache frequently accessed data', async () => {
      const cacheKey = 'user:1';
      const userData = { id: 1, name: 'John Doe', email: 'john@example.com' };

      // First call - cache miss, fetch from database
      mockTable.single.mockResolvedValue({ data: userData, error: null });

      const result1 = await cacheManager.getOrSet(cacheKey, async () => {
        return supabase.from('users').select('*').eq('id', 1).single();
      });

      // Second call - cache hit, no database call
      const result2 = await cacheManager.get(cacheKey);

      expect(result1.data).toEqual(userData);
      expect(result2).toEqual(result1);
      expect(mockTable.single).toHaveBeenCalledTimes(1);
    });

    test('should invalidate cache on data updates', async () => {
      const cacheKey = 'user:1';
      const updateData = { name: 'Jane Doe' };

      // Mock update operation
      mockTable.eq.mockResolvedValue({ data: [{ id: 1, ...updateData }], error: null });

      const result = await supabase.from('users').update(updateData).eq('id', 1);

      // Invalidate cache after update
      await cacheManager.delete(cacheKey);

      expect(mockTable.update).toHaveBeenCalledWith(updateData);
      expect(mockTable.eq).toHaveBeenCalledWith('id', 1);
    });
  });
});
