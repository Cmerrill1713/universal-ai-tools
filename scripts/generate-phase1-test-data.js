#!/usr/bin/env node

/**
 * Phase 1 Test Data Generator for Universal AI Tools
 * Generates comprehensive test data for Phase 1 development and testing
 *
 * Features:
 * - Sample agents (cognitive and personal types)
 * - Test memory records for the memory system
 * - Test user credentials and API keys
 * - Sample conversations and context data
 * - Test configuration data
 * - ES module compatible
 * - Cleanup functions for test reset
 *
 * Usage:
 *   node scripts/generate-phase1-test-data.js [command] [options]
 *
 * Commands:
 *   generate    - Generate all test data
 *   cleanup     - Remove all test data
 *   reset       - Cleanup and regenerate
 *   validate    - Validate existing test data
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

// Load environment configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load test environment configuration
dotenv.config({ path: join(projectRoot, '.env.test') });
dotenv.config({ path: join(projectRoot, '.env') });

// Configuration
const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  testData: {
    agentCount: 20,
    memoryCount: 100,
    userCount: 10,
    conversationCount: 25,
    contextCount: 50,
    toolCount: 15,
  },
  cleanup: {
    preserveSystem: true,
    confirmDelete: true,
  },
};

// Test data generators
class Phase1TestDataGenerator {
  constructor() {
    this.supabase = null;
    this.generatedData = {
      agents: [],
      memories: [],
      users: [],
      conversations: [],
      contexts: [],
      tools: [],
      apiKeys: [],
      sessions: [],
    };
    this.testPrefix = 'TEST_';
    this.batchSize = 10;
  }

  // Initialize Supabase client
  async initialize() {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Missing Supabase configuration. Please check .env.test file.');
    }

    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('✅ Supabase client initialized');

    // Test connection
    const { data, error } = await this.supabase.from('ai_memories').select('count').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }

    console.log('✅ Database connection verified');
  }

  // Generate unique test ID
  generateTestId(prefix = '') {
    return `${this.testPrefix}${prefix}${randomBytes(8).toString('hex')}`.toUpperCase();
  }

  // Generate realistic timestamps
  generateTimestamp(daysAgo = 0, hoursAgo = 0) {
    const now = new Date();
    now.setDate(now.getDate() - daysAgo);
    now.setHours(now.getHours() - hoursAgo);
    return now.toISOString();
  }

  // Generate cognitive agents
  generateCognitiveAgents() {
    const cognitiveTypes = [
      'devils_advocate',
      'enhanced_planner',
      'reflector',
      'resource_manager',
      'retriever',
      'synthesizer',
    ];

    const agents = [];

    cognitiveTypes.forEach((type, index) => {
      for (let i = 0; i < 2; i++) {
        agents.push({
          id: this.generateTestId('CAGENT_'),
          name: `${type}_agent_${i + 1}`,
          type: 'cognitive',
          category: type,
          status: ['active', 'inactive'][Math.floor(Math.random() * 2)],
          capabilities: this.generateCapabilities(type),
          config: this.generateAgentConfig(type),
          metrics: this.generateAgentMetrics(),
          created_at: this.generateTimestamp(Math.floor(Math.random() * 30)),
          updated_at: this.generateTimestamp(Math.floor(Math.random() * 7)),
        });
      }
    });

    return agents;
  }

  // Generate personal agents
  generatePersonalAgents() {
    const personalTypes = [
      'calendar',
      'tool_maker',
      'photo_organizer',
      'file_manager',
      'memory_assistant',
    ];

    const agents = [];

    personalTypes.forEach((type, index) => {
      for (let i = 0; i < 2; i++) {
        agents.push({
          id: this.generateTestId('PAGENT_'),
          name: `${type}_agent_${i + 1}`,
          type: 'personal',
          category: type,
          status: ['active', 'inactive', 'error'][Math.floor(Math.random() * 3)],
          capabilities: this.generateCapabilities(type),
          config: this.generateAgentConfig(type),
          metrics: this.generateAgentMetrics(),
          created_at: this.generateTimestamp(Math.floor(Math.random() * 60)),
          updated_at: this.generateTimestamp(Math.floor(Math.random() * 14)),
        });
      }
    });

    return agents;
  }

  // Generate agent capabilities
  generateCapabilities(agentType) {
    const baseCapabilities = ['natural_language', 'json_processing', 'error_handling'];
    const specificCapabilities = {
      devils_advocate: ['critical_thinking', 'argument_analysis', 'bias_detection'],
      enhanced_planner: ['task_decomposition', 'resource_planning', 'timeline_management'],
      reflector: ['self_analysis', 'performance_evaluation', 'learning_optimization'],
      resource_manager: ['memory_management', 'cpu_monitoring', 'load_balancing'],
      retriever: ['vector_search', 'semantic_matching', 'context_retrieval'],
      synthesizer: ['data_fusion', 'pattern_recognition', 'insight_generation'],
      calendar: ['calendar_integration', 'event_management', 'scheduling'],
      tool_maker: ['code_generation', 'api_creation', 'tool_validation'],
      photo_organizer: ['image_analysis', 'face_recognition', 'metadata_extraction'],
      file_manager: ['file_operations', 'pattern_matching', 'automation_rules'],
      memory_assistant: ['memory_storage', 'retrieval_optimization', 'context_management'],
    };

    return [...baseCapabilities, ...(specificCapabilities[agentType] || [])];
  }

  // Generate agent configuration
  generateAgentConfig(agentType) {
    const baseConfig = {
      maxTokens: Math.floor(Math.random() * 3000) + 1000,
      temperature: Math.random() * 0.8 + 0.2,
      model: ['gpt-4', 'claude-3', 'llama3.2:3b'][Math.floor(Math.random() * 3)],
      memory: true,
      tools: [],
    };

    const specificConfigs = {
      devils_advocate: {
        systemPrompt:
          'You are a critical thinking agent that challenges assumptions and identifies potential flaws in reasoning.',
        biasDetection: true,
        argumentStrength: 0.8,
      },
      enhanced_planner: {
        systemPrompt:
          'You are a strategic planning agent that breaks down complex tasks into manageable steps.',
        planningHorizon: 'long_term',
        resourceAware: true,
      },
      calendar: {
        calendarSources: ['google', 'outlook'],
        reminderLeadTime: 15,
        conflictDetection: true,
      },
      tool_maker: {
        allowedLanguages: ['javascript', 'python', 'bash'],
        securityLevel: 'high',
        testGeneration: true,
      },
    };

    return {
      ...baseConfig,
      ...(specificConfigs[agentType] || {}),
    };
  }

  // Generate agent metrics
  generateAgentMetrics() {
    return {
      totalRequests: Math.floor(Math.random() * 10000),
      successRate: Math.random() * 0.3 + 0.7, // 70-100%
      averageResponseTime: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
      lastUsed: this.generateTimestamp(Math.floor(Math.random() * 7)),
      memoryUsage: Math.floor(Math.random() * 512) + 128, // 128-640MB
    };
  }

  // Generate test memories
  generateMemories() {
    const memoryTypes = ['semantic', 'procedural', 'episodic'];
    const categories = [
      'user_preference',
      'system_knowledge',
      'conversation_history',
      'tool_usage',
      'error_pattern',
    ];
    const memories = [];

    for (let i = 0; i < config.testData.memoryCount; i++) {
      const type = memoryTypes[Math.floor(Math.random() * memoryTypes.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];

      memories.push({
        id: this.generateTestId('MEM_'),
        service_id: `test_service_${Math.floor(Math.random() * 5) + 1}`,
        memory_type: type,
        content: this.generateMemoryContent(type, category),
        metadata: this.generateMemoryMetadata(type, category),
        timestamp: this.generateTimestamp(Math.floor(Math.random() * 90)),
        expires_at: Math.random() > 0.7 ? this.generateTimestamp(-30) : null, // 30% have expiration
        memory_category: category,
        keywords: this.generateKeywords(category),
        importance_score: Math.random(),
        access_count: Math.floor(Math.random() * 50),
        last_accessed:
          Math.random() > 0.3 ? this.generateTimestamp(Math.floor(Math.random() * 7)) : null,
        related_entities: this.generateRelatedEntities(),
        embedding: this.generateEmbedding(), // Mock embedding vector
        embedding_model: 'text-embedding-ada-002',
      });
    }

    return memories;
  }

  // Generate memory content based on type
  generateMemoryContent(type, category) {
    const templates = {
      semantic: {
        user_preference:
          'User prefers dark mode interface with condensed view. Response style should be concise and technical.',
        system_knowledge:
          'The universal AI tools system uses Supabase for data persistence and Redis for caching.',
        conversation_history:
          'Previous conversation about TypeScript configuration and build optimization.',
        tool_usage:
          'User frequently uses the code analysis tool for JavaScript and TypeScript projects.',
        error_pattern:
          'Common error: Failed to connect to Redis cache, fallback to in-memory storage used.',
      },
      procedural: {
        user_preference:
          'Steps to configure user dashboard: 1. Set theme 2. Configure widgets 3. Save layout',
        system_knowledge:
          'To restart services: 1. Stop all processes 2. Clear cache 3. Reload configuration 4. Start services',
        conversation_history: 'Procedure discussed: How to backup and restore system configuration',
        tool_usage:
          'Tool execution sequence: validate input -> process data -> generate output -> store results',
        error_pattern:
          'Error recovery procedure: 1. Log error details 2. Attempt retry 3. Fallback to safe mode 4. Notify user',
      },
      episodic: {
        user_preference:
          'User session on 2024-01-15: Customized agent behaviors, showed preference for detailed explanations',
        system_knowledge:
          'System upgrade on 2024-01-10: Migrated to new vector database, performance improved by 40%',
        conversation_history:
          'Conversation thread about implementing new authentication system, lasted 2 hours',
        tool_usage:
          'Tool usage spike on weekend: Photo organizer processed 1000+ images successfully',
        error_pattern:
          'Critical error event: Database connection lost for 5 minutes, auto-recovery successful',
      },
    };

    return templates[type][category] + ` (Generated for testing - ID: ${this.generateTestId()})`;
  }

  // Generate memory metadata
  generateMemoryMetadata(type, category) {
    return {
      type,
      category,
      confidence: Math.random(),
      source: 'test_generator',
      version: '1.0.0',
      tags: this.generateKeywords(category).slice(0, 3),
      userId: `test_user_${Math.floor(Math.random() * config.testData.userCount) + 1}`,
      sessionId: this.generateTestId('SESSION_'),
      contextual: true,
      testData: true,
    };
  }

  // Generate keywords for memory
  generateKeywords(category) {
    const keywordSets = {
      user_preference: ['preference', 'setting', 'customization', 'ui', 'behavior'],
      system_knowledge: ['system', 'architecture', 'configuration', 'technical', 'infrastructure'],
      conversation_history: ['conversation', 'dialogue', 'discussion', 'interaction', 'chat'],
      tool_usage: ['tool', 'usage', 'execution', 'process', 'workflow'],
      error_pattern: ['error', 'exception', 'failure', 'recovery', 'debugging'],
    };

    const base = keywordSets[category] || ['general', 'test', 'data'];
    return base.concat(['test', 'phase1', 'generated']);
  }

  // Generate related entities
  generateRelatedEntities() {
    const entities = [];
    const entityCount = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < entityCount; i++) {
      entities.push({
        type: ['user', 'agent', 'tool', 'session'][Math.floor(Math.random() * 4)],
        id: this.generateTestId(),
        relevance: Math.random(),
      });
    }

    return entities;
  }

  // Generate mock embedding vector (1536 dimensions for OpenAI)
  generateEmbedding() {
    const dimensions = 1536;
    const embedding = [];

    for (let i = 0; i < dimensions; i++) {
      embedding.push((Math.random() - 0.5) * 2); // Random values between -1 and 1
    }

    return embedding;
  }

  // Generate test users
  generateUsers() {
    const users = [];

    for (let i = 0; i < config.testData.userCount; i++) {
      users.push({
        id: this.generateTestId('USER_'),
        email: `test.user.${i + 1}@example.com`,
        name: `Test User ${i + 1}`,
        role: ['admin', 'user', 'developer'][Math.floor(Math.random() * 3)],
        preferences: {
          theme: ['light', 'dark'][Math.floor(Math.random() * 2)],
          language: 'en',
          notifications: Math.random() > 0.5,
          aiPersonality: ['professional', 'friendly', 'casual'][Math.floor(Math.random() * 3)],
        },
        permissions: this.generateUserPermissions(),
        rateLimits: {
          requests_per_minute: 100,
          memory_operations_per_hour: 1000,
          file_uploads_per_day: 50,
        },
        created_at: this.generateTimestamp(Math.floor(Math.random() * 180)),
        last_login: this.generateTimestamp(Math.floor(Math.random() * 30)),
      });
    }

    return users;
  }

  // Generate user permissions
  generateUserPermissions() {
    const allPermissions = [
      'read_memories',
      'write_memories',
      'delete_memories',
      'use_agents',
      'create_agents',
      'modify_agents',
      'access_tools',
      'create_tools',
      'admin_tools',
      'view_metrics',
      'export_data',
      'system_admin',
    ];

    const permissionCount = Math.floor((Math.random() * allPermissions.length) / 2) + 3;
    return allPermissions.sort(() => 0.5 - Math.random()).slice(0, permissionCount);
  }

  // Generate API keys for testing
  generateApiKeys() {
    const keys = [];

    for (let i = 0; i < config.testData.userCount; i++) {
      keys.push({
        id: this.generateTestId('KEY_'),
        key_hash: createHash('sha256').update(this.generateTestId('APIKEY_')).digest('hex'),
        user_id: `test_user_${i + 1}`,
        name: `Test API Key ${i + 1}`,
        permissions: this.generateUserPermissions(),
        rate_limit: 1000,
        expires_at: this.generateTimestamp(-30), // Expires in 30 days
        last_used:
          Math.random() > 0.3 ? this.generateTimestamp(Math.floor(Math.random() * 7)) : null,
        created_at: this.generateTimestamp(Math.floor(Math.random() * 90)),
        is_active: Math.random() > 0.1, // 90% active
      });
    }

    return keys;
  }

  // Generate conversation data
  generateConversations() {
    const conversations = [];

    for (let i = 0; i < config.testData.conversationCount; i++) {
      const messageCount = Math.floor(Math.random() * 20) + 5;
      const messages = [];

      for (let j = 0; j < messageCount; j++) {
        messages.push({
          role: j % 2 === 0 ? 'user' : 'assistant',
          content: this.generateConversationMessage(j % 2 === 0 ? 'user' : 'assistant', j),
          timestamp: this.generateTimestamp(0, -j * 5), // 5 minutes apart
          metadata: {
            tokens: Math.floor(Math.random() * 500) + 50,
            model: 'gpt-4',
            confidence: Math.random(),
          },
        });
      }

      conversations.push({
        id: this.generateTestId('CONV_'),
        user_id: `test_user_${Math.floor(Math.random() * config.testData.userCount) + 1}`,
        title: `Test Conversation ${i + 1}`,
        messages,
        metadata: {
          total_messages: messageCount,
          duration_minutes: messageCount * 5,
          agents_used: this.generatedData.agents
            .slice(0, Math.floor(Math.random() * 3) + 1)
            .map((a) => a.id),
          topic: ['coding', 'planning', 'analysis', 'research'][Math.floor(Math.random() * 4)],
        },
        created_at: this.generateTimestamp(Math.floor(Math.random() * 30)),
        updated_at: this.generateTimestamp(Math.floor(Math.random() * 7)),
      });
    }

    return conversations;
  }

  // Generate conversation messages
  generateConversationMessage(role, index) {
    const userMessages = [
      'Can you help me analyze this code?',
      "What's the best way to implement authentication?",
      'How do I optimize database queries?',
      'Explain the agent coordination system',
      'Generate a test plan for the memory system',
    ];

    const assistantMessages = [
      "I'd be happy to help you analyze the code. Let me examine the structure and identify potential improvements.",
      'For authentication, I recommend implementing JWT tokens with proper refresh mechanisms and role-based access control.',
      'Database query optimization involves proper indexing, query analysis, and connection pooling. Let me show you specific techniques.',
      'The agent coordination system uses a message broker pattern with Redis for state management and task distribution.',
      "Here's a comprehensive test plan covering unit tests, integration tests, and performance benchmarks for the memory system.",
    ];

    if (role === 'user') {
      return userMessages[index % userMessages.length] + ` (Test message ${index + 1})`;
    } else {
      return (
        assistantMessages[index % assistantMessages.length] + ` (Generated response ${index + 1})`
      );
    }
  }

  // Generate context data
  generateContexts() {
    const contexts = [];
    const contextTypes = ['conversation', 'document', 'system'];

    for (let i = 0; i < config.testData.contextCount; i++) {
      const type = contextTypes[Math.floor(Math.random() * contextTypes.length)];

      contexts.push({
        id: this.generateTestId('CTX_'),
        type,
        content: this.generateContextContent(type, i),
        metadata: {
          source: 'test_generator',
          category: type,
          importance: Math.random(),
          tags: this.generateKeywords(type),
          testData: true,
        },
        timestamp: this.generateTimestamp(Math.floor(Math.random() * 60)),
        weight: Math.random(),
        user_id: `test_user_${Math.floor(Math.random() * config.testData.userCount) + 1}`,
      });
    }

    return contexts;
  }

  // Generate context content
  generateContextContent(type, index) {
    const templates = {
      conversation: `Previous conversation context about system architecture and implementation details. Discussed performance optimization and scaling strategies. Context ${index + 1}`,
      document: `Technical documentation reference: API endpoints, configuration options, and best practices for system integration. Document ${index + 1}`,
      system: `System state information: current load, active agents, memory usage, and performance metrics at timestamp. System context ${index + 1}`,
    };

    return templates[type] || `Generic context content for testing purposes. Item ${index + 1}`;
  }

  // Generate custom tools
  generateTools() {
    const tools = [];
    const toolTypes = ['javascript', 'python', 'bash', 'sql', 'api'];

    for (let i = 0; i < config.testData.toolCount; i++) {
      const type = toolTypes[Math.floor(Math.random() * toolTypes.length)];

      tools.push({
        id: this.generateTestId('TOOL_'),
        tool_name: `test_tool_${type}_${i + 1}`,
        description: `Test ${type} tool for Phase 1 testing - performs ${type} operations`,
        implementation_type: type,
        implementation: this.generateToolImplementation(type),
        input_schema: this.generateToolSchema('input', type),
        output_schema: this.generateToolSchema('output', type),
        metadata: {
          version: '1.0.0',
          author: 'test_generator',
          category: type,
          testTool: true,
        },
        created_by: `test_user_${Math.floor(Math.random() * config.testData.userCount) + 1}`,
        is_active: Math.random() > 0.2, // 80% active
        rate_limit: Math.floor(Math.random() * 100) + 10,
        created_at: this.generateTimestamp(Math.floor(Math.random() * 90)),
        updated_at: this.generateTimestamp(Math.floor(Math.random() * 14)),
      });
    }

    return tools;
  }

  // Generate tool implementation
  generateToolImplementation(type) {
    const implementations = {
      javascript: `
function testTool(input) {
  console.log('Test tool processing:', input);
  return { result: 'processed', data: input, timestamp: new Date().toISOString() };
}
module.exports = { testTool };`,
      python: `
def test_tool(input_data):
    print(f"Test tool processing: {input_data}")
    return {"result": "processed", "data": input_data, "timestamp": "2024-01-01T00:00:00Z"}`,
      bash: `#!/bin/bash
echo "Test tool processing: $1"
echo '{"result": "processed", "data": "'$1'", "timestamp": "'$(date -Iseconds)'"}'`,
      sql: `SELECT 'processed' as result, $1 as data, NOW() as timestamp;`,
      api: `{
  "endpoint": "/api/test-tool",
  "method": "POST",
  "headers": {"Content-Type": "application/json"},
  "response": {"result": "processed", "status": "success"}
}`,
    };

    return implementations[type] || 'console.log("Generic test tool");';
  }

  // Generate tool schema
  generateToolSchema(direction, type) {
    const inputSchemas = {
      javascript: { type: 'object', properties: { input: { type: 'string' } } },
      python: { type: 'object', properties: { input_data: { type: 'any' } } },
      bash: { type: 'string' },
      sql: { type: 'object', properties: { query_param: { type: 'string' } } },
      api: { type: 'object', properties: { endpoint_data: { type: 'object' } } },
    };

    const outputSchemas = {
      javascript: {
        type: 'object',
        properties: { result: { type: 'string' }, data: { type: 'any' } },
      },
      python: { type: 'object', properties: { result: { type: 'string' }, data: { type: 'any' } } },
      bash: { type: 'string' },
      sql: { type: 'object', properties: { result: { type: 'string' }, data: { type: 'string' } } },
      api: {
        type: 'object',
        properties: { result: { type: 'string' }, status: { type: 'string' } },
      },
    };

    return direction === 'input' ? inputSchemas[type] : outputSchemas[type];
  }

  // Store data in batches to database
  async storeData(tableName, data, idField = 'id') {
    if (!data || data.length === 0) {
      console.log(`⚠️  No data to store for ${tableName}`);
      return { success: true, count: 0 };
    }

    console.log(`📊 Storing ${data.length} records in ${tableName}...`);
    let stored = 0;

    try {
      // Process in batches
      for (let i = 0; i < data.length; i += this.batchSize) {
        const batch = data.slice(i, i + this.batchSize);

        const { error } = await this.supabase.from(tableName).insert(batch);

        if (error) {
          console.error(`❌ Error storing batch in ${tableName}:`, error.message);
          // Continue with next batch
        } else {
          stored += batch.length;
        }
      }

      console.log(`✅ Stored ${stored}/${data.length} records in ${tableName}`);
      return { success: true, count: stored };
    } catch (error) {
      console.error(`❌ Failed to store data in ${tableName}:`, error.message);
      return { success: false, error: error.message, count: stored };
    }
  }

  // Generate all test data
  async generateAllData() {
    console.log('🚀 Generating Phase 1 test data...\n');

    // Generate data in dependency order
    console.log('1. Generating agents...');
    this.generatedData.agents = [
      ...this.generateCognitiveAgents(),
      ...this.generatePersonalAgents(),
    ];
    console.log(`   Generated ${this.generatedData.agents.length} agents`);

    console.log('2. Generating memories...');
    this.generatedData.memories = this.generateMemories();
    console.log(`   Generated ${this.generatedData.memories.length} memories`);

    console.log('3. Generating users...');
    this.generatedData.users = this.generateUsers();
    console.log(`   Generated ${this.generatedData.users.length} users`);

    console.log('4. Generating API keys...');
    this.generatedData.apiKeys = this.generateApiKeys();
    console.log(`   Generated ${this.generatedData.apiKeys.length} API keys`);

    console.log('5. Generating conversations...');
    this.generatedData.conversations = this.generateConversations();
    console.log(`   Generated ${this.generatedData.conversations.length} conversations`);

    console.log('6. Generating contexts...');
    this.generatedData.contexts = this.generateContexts();
    console.log(`   Generated ${this.generatedData.contexts.length} contexts`);

    console.log('7. Generating tools...');
    this.generatedData.tools = this.generateTools();
    console.log(`   Generated ${this.generatedData.tools.length} tools`);

    console.log('\n📊 Test data generation complete!');
    this.printSummary();
  }

  // Store all generated data to database
  async storeAllData() {
    console.log('\n💾 Storing test data to database...\n');

    const results = {};

    // Store in dependency order
    console.log('Storing memories...');
    results.memories = await this.storeData('ai_memories', this.generatedData.memories);

    console.log('Storing custom tools...');
    results.tools = await this.storeData('ai_custom_tools', this.generatedData.tools);

    console.log('Storing contexts...');
    results.contexts = await this.storeData('ai_contexts', this.generatedData.contexts);

    // Note: Users, API keys, conversations might need different tables or handling
    // For now, we'll store them as JSON in metadata or skip them
    console.log('Storing additional test metadata...');
    const metadata = {
      users: this.generatedData.users,
      apiKeys: this.generatedData.apiKeys,
      conversations: this.generatedData.conversations,
      agents: this.generatedData.agents,
      generation_timestamp: new Date().toISOString(),
      config: config.testData,
    };

    // Store metadata in ai_contexts table
    const metadataContext = {
      id: this.generateTestId('META_'),
      context_type: 'test_metadata',
      context_key: 'phase1_test_data',
      content: metadata,
    };

    results.metadata = await this.storeData('ai_contexts', [metadataContext]);

    console.log('\n✅ Data storage complete!');
    this.printStorageResults(results);

    return results;
  }

  // Clean up test data
  async cleanup() {
    console.log('🧹 Cleaning up test data...\n');

    if (config.cleanup.confirmDelete) {
      // In a real implementation, you might want to add confirmation
      console.log('⚠️  This will delete all test data. Proceeding...');
    }

    const results = {};

    try {
      // Delete memories
      console.log('Deleting test memories...');
      const { error: memError, count: memCount } = await this.supabase
        .from('ai_memories')
        .delete()
        .like('service_id', 'test_%');

      results.memories = { success: !memError, count: memCount, error: memError?.message };

      // Delete tools
      console.log('Deleting test tools...');
      const { error: toolError, count: toolCount } = await this.supabase
        .from('ai_custom_tools')
        .delete()
        .like('tool_name', 'test_%');

      results.tools = { success: !toolError, count: toolCount, error: toolError?.message };

      // Delete contexts
      console.log('Deleting test contexts...');
      const { error: ctxError, count: ctxCount } = await this.supabase
        .from('ai_contexts')
        .delete()
        .eq('context_type', 'test_metadata');

      results.contexts = { success: !ctxError, count: ctxCount, error: ctxError?.message };

      console.log('\n✅ Cleanup complete!');
      this.printCleanupResults(results);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      results.error = error.message;
    }

    return results;
  }

  // Validate existing test data
  async validateData() {
    console.log('🔍 Validating existing test data...\n');

    const validation = {
      memories: { exists: false, count: 0, valid: false },
      tools: { exists: false, count: 0, valid: false },
      contexts: { exists: false, count: 0, valid: false },
      overall: { valid: false, score: 0 },
    };

    try {
      // Check memories
      const { data: memories, error: memError } = await this.supabase
        .from('ai_memories')
        .select('count')
        .like('service_id', 'test_%');

      validation.memories.exists = !memError && memories;
      validation.memories.count = memories?.length || 0;
      validation.memories.valid = validation.memories.count >= 10;

      // Check tools
      const { data: tools, error: toolError } = await this.supabase
        .from('ai_custom_tools')
        .select('count')
        .like('tool_name', 'test_%');

      validation.tools.exists = !toolError && tools;
      validation.tools.count = tools?.length || 0;
      validation.tools.valid = validation.tools.count >= 5;

      // Check contexts
      const { data: contexts, error: ctxError } = await this.supabase
        .from('ai_contexts')
        .select('count')
        .eq('context_type', 'test_metadata');

      validation.contexts.exists = !ctxError && contexts;
      validation.contexts.count = contexts?.length || 0;
      validation.contexts.valid = validation.contexts.count >= 1;

      // Calculate overall score
      const validCount = [
        validation.memories.valid,
        validation.tools.valid,
        validation.contexts.valid,
      ].filter(Boolean).length;

      validation.overall.score = (validCount / 3) * 100;
      validation.overall.valid = validation.overall.score >= 66; // 2/3 valid

      console.log('📊 Validation Results:');
      console.log(
        `   Memories: ${validation.memories.count} records (${validation.memories.valid ? '✅' : '❌'})`
      );
      console.log(
        `   Tools: ${validation.tools.count} records (${validation.tools.valid ? '✅' : '❌'})`
      );
      console.log(
        `   Contexts: ${validation.contexts.count} records (${validation.contexts.valid ? '✅' : '❌'})`
      );
      console.log(
        `   Overall: ${validation.overall.score.toFixed(1)}% (${validation.overall.valid ? '✅' : '❌'})`
      );
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      validation.error = error.message;
    }

    return validation;
  }

  // Print generation summary
  printSummary() {
    console.log('\n📈 Generation Summary:');
    console.log(
      `   Cognitive Agents: ${this.generatedData.agents.filter((a) => a.type === 'cognitive').length}`
    );
    console.log(
      `   Personal Agents: ${this.generatedData.agents.filter((a) => a.type === 'personal').length}`
    );
    console.log(`   Memory Records: ${this.generatedData.memories.length}`);
    console.log(`   Test Users: ${this.generatedData.users.length}`);
    console.log(`   API Keys: ${this.generatedData.apiKeys.length}`);
    console.log(`   Conversations: ${this.generatedData.conversations.length}`);
    console.log(`   Context Items: ${this.generatedData.contexts.length}`);
    console.log(`   Custom Tools: ${this.generatedData.tools.length}`);
  }

  // Print storage results
  printStorageResults(results) {
    console.log('\n📊 Storage Results:');
    Object.entries(results).forEach(([key, result]) => {
      const status = result.success ? '✅' : '❌';
      const message = result.success ? `${result.count} records stored` : `Failed: ${result.error}`;
      console.log(`   ${key}: ${status} ${message}`);
    });
  }

  // Print cleanup results
  printCleanupResults(results) {
    console.log('\n📊 Cleanup Results:');
    Object.entries(results).forEach(([key, result]) => {
      if (key === 'error') return;
      const status = result.success ? '✅' : '❌';
      const message = result.success
        ? `${result.count || 0} records deleted`
        : `Failed: ${result.error}`;
      console.log(`   ${key}: ${status} ${message}`);
    });
  }

  // Save generated data to file
  async saveToFile() {
    const filename = `phase1-test-data-${Date.now()}.json`;
    const filepath = join(projectRoot, 'test-data', filename);

    try {
      // Ensure test-data directory exists
      await fs.mkdir(join(projectRoot, 'test-data'), { recursive: true });

      const output = {
        metadata: {
          generated_at: new Date().toISOString(),
          generator_version: '1.0.0',
          config: config.testData,
        },
        data: this.generatedData,
      };

      await fs.writeFile(filepath, JSON.stringify(output, null, 2));
      console.log(`💾 Test data saved to: ${filepath}`);
    } catch (error) {
      console.error('❌ Failed to save test data file:', error.message);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'generate';
  const options = args.slice(1);

  console.log('🧪 Universal AI Tools - Phase 1 Test Data Generator\n');

  const generator = new Phase1TestDataGenerator();

  try {
    await generator.initialize();

    switch (command) {
      case 'generate':
        await generator.generateAllData();
        await generator.storeAllData();
        await generator.saveToFile();
        break;

      case 'cleanup':
        await generator.cleanup();
        break;

      case 'reset':
        await generator.cleanup();
        await generator.generateAllData();
        await generator.storeAllData();
        await generator.saveToFile();
        break;

      case 'validate':
        await generator.validateData();
        break;

      case 'generate-only':
        await generator.generateAllData();
        await generator.saveToFile();
        break;

      case 'store-only':
        // Load from file if exists, otherwise generate
        await generator.generateAllData();
        await generator.storeAllData();
        break;

      default:
        console.log('❌ Unknown command. Available commands:');
        console.log('   generate     - Generate and store all test data');
        console.log('   cleanup      - Remove all test data');
        console.log('   reset        - Cleanup and regenerate');
        console.log('   validate     - Validate existing test data');
        console.log("   generate-only - Generate data but don't store");
        console.log('   store-only   - Store previously generated data');
        process.exit(1);
    }

    console.log('\n🎉 Phase 1 test data generator completed successfully!');
  } catch (error) {
    console.error('\n❌ Test data generator failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Export for programmatic use
export { Phase1TestDataGenerator, config };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
