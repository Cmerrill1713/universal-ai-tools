#!/usr/bin/env tsx
/**
 * Memory Connection Builder Script
 * Creates intelligent connections between related knowledge entries
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../src/utils/enhanced-logger';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  logger.error('Missing SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface MemoryItem {
  id: string;
  content: string;
  memory_type: string;
  service_id: string;
  keywords: string[];
  metadata: any;
  importance_score: number;
}

interface ConnectionRule {
  name: string;
  condition: (mem1: MemoryItem, mem2: MemoryItem) => boolean;
  connectionType: string;
  strength: number;
  description: string;
}

// Define connection rules for different types of knowledge relationships
const connectionRules: ConnectionRule[] = [
  {
    name: 'Same Technology Stack',
    condition: (mem1, mem2) => {
      const tech1 = extractTechnology(mem1);
      const tech2 = extractTechnology(mem2);
      return tech1.length > 0 && tech2.length > 0 && 
             tech1.some(t => tech2.includes(t));
    },
    connectionType: 'technology_related',
    strength: 0.7,
    description: 'Memories related to the same technology or framework'
  },
  {
    name: 'Sequential Implementation',
    condition: (mem1, mem2) => {
      const isImplementation1 = mem1.memory_type.includes('implementation') || 
                               mem1.content.toLowerCase().includes('implement');
      const isImplementation2 = mem2.memory_type.includes('implementation') || 
                               mem2.content.toLowerCase().includes('implement');
      return isImplementation1 && isImplementation2 && 
             shareKeywords(mem1, mem2, 2);
    },
    connectionType: 'implementation_sequence',
    strength: 0.8,
    description: 'Implementation steps that follow each other'
  },
  {
    name: 'Problem-Solution',
    condition: (mem1, mem2) => {
      const isProblem1 = mem1.content.toLowerCase().includes('error') || 
                        mem1.content.toLowerCase().includes('issue') ||
                        mem1.content.toLowerCase().includes('problem');
      const isSolution2 = mem2.content.toLowerCase().includes('fix') || 
                         mem2.content.toLowerCase().includes('solution') ||
                         mem2.content.toLowerCase().includes('resolve');
      return (isProblem1 && isSolution2) || (isSolution2 && isProblem1);
    },
    connectionType: 'problem_solution',
    strength: 0.9,
    description: 'Problem and its corresponding solution'
  },
  {
    name: 'Best Practices',
    condition: (mem1, mem2) => {
      const isBestPractices1 = mem1.memory_type.includes('best_practices') ||
                              mem1.content.toLowerCase().includes('best practice');
      const isBestPractices2 = mem2.memory_type.includes('best_practices') ||
                              mem2.content.toLowerCase().includes('best practice');
      return isBestPractices1 && isBestPractices2 && 
             shareKeywords(mem1, mem2, 1);
    },
    connectionType: 'best_practices_group',
    strength: 0.6,
    description: 'Related best practices in the same domain'
  },
  {
    name: 'Agent Orchestration Chain',
    condition: (mem1, mem2) => {
      const isOrchestration1 = mem1.memory_type.includes('agent_orchestration') ||
                              mem1.service_id === 'agent-orchestration-system';
      const isOrchestration2 = mem2.memory_type.includes('agent_orchestration') ||
                              mem2.service_id === 'agent-orchestration-system';
      return isOrchestration1 && isOrchestration2;
    },
    connectionType: 'orchestration_workflow',
    strength: 0.8,
    description: 'Steps in agent orchestration workflow'
  },
  {
    name: 'Framework Components',
    condition: (mem1, mem2) => {
      const frameworks = ['dspy', 'graphql', 'supabase', 'apollo'];
      const hasFramework1 = frameworks.some(fw => 
        mem1.memory_type.toLowerCase().includes(fw) ||
        mem1.content.toLowerCase().includes(fw)
      );
      const hasFramework2 = frameworks.some(fw => 
        mem2.memory_type.toLowerCase().includes(fw) ||
        mem2.content.toLowerCase().includes(fw)
      );
      return hasFramework1 && hasFramework2 && 
             getCommonFramework(mem1, mem2) !== null;
    },
    connectionType: 'framework_components',
    strength: 0.7,
    description: 'Components belonging to the same framework'
  }
];

function extractTechnology(memory: MemoryItem): string[] {
  const technologies = ['supabase', 'graphql', 'apollo', 'dspy', 'typescript', 'react', 'node', 'postgres'];
  const found: string[] = [];
  
  const searchText = (memory.content + ' ' + memory.memory_type).toLowerCase();
  technologies.forEach(tech => {
    if (searchText.includes(tech)) {
      found.push(tech);
    }
  });
  
  return found;
}

function shareKeywords(mem1: MemoryItem, mem2: MemoryItem, minShared: number): boolean {
  const keywords1 = mem1.keywords || [];
  const keywords2 = mem2.keywords || [];
  
  const shared = keywords1.filter(k => keywords2.includes(k));
  return shared.length >= minShared;
}

function getCommonFramework(mem1: MemoryItem, mem2: MemoryItem): string | null {
  const frameworks = ['dspy', 'graphql', 'supabase', 'apollo'];
  
  for (const framework of frameworks) {
    const hasFramework1 = mem1.memory_type.toLowerCase().includes(framework) ||
                          mem1.content.toLowerCase().includes(framework);
    const hasFramework2 = mem2.memory_type.toLowerCase().includes(framework) ||
                          mem2.content.toLowerCase().includes(framework);
    
    if (hasFramework1 && hasFramework2) {
      return framework;
    }
  }
  
  return null;
}

async function loadMemories(): Promise<MemoryItem[]> {
  console.log('📥 Loading memories from database...');
  
  const { data: memories, error } = await supabase
    .from('ai_memories')
    .select('*')
    .order('importance_score', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to load memories: ${error.message}`);
  }
  
  console.log(`✅ Loaded ${memories?.length || 0} memories`);
  return memories || [];
}

async function createConnection(
  sourceId: string, 
  targetId: string, 
  connectionType: string, 
  strength: number,
  metadata: any = {}
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('memory_connections')
      .insert({
        source_memory_id: sourceId,
        target_memory_id: targetId,
        connection_type: connectionType,
        strength: strength,
        metadata: {
          ...metadata,
          created_by: 'connection_builder_script',
          timestamp: new Date().toISOString()
        }
      });
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return false; // Connection already exists
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to create connection:', error);
    return false;
  }
}

async function buildConnections(): Promise<void> {
  console.log('\n🔗 Building memory connections...\n');
  
  const memories = await loadMemories();
  let connectionsCreated = 0;
  let connectionsSkipped = 0;
  
  // Process connections by rule priority
  for (const rule of connectionRules) {
    console.log(`\n📋 Applying rule: ${rule.name}`);
    console.log(`   ${rule.description}`);
    
    let ruleConnections = 0;
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const mem1 = memories[i];
        const mem2 = memories[j];
        
        // Skip if memories are from the same exact content
        if (mem1.content === mem2.content) continue;
        
        // Apply connection rule
        if (rule.condition(mem1, mem2)) {
          const connectionMetadata = {
            rule_applied: rule.name,
            rule_description: rule.description,
            memory1_type: mem1.memory_type,
            memory2_type: mem2.memory_type,
            common_elements: getConnectionContext(mem1, mem2)
          };
          
          const created = await createConnection(
            mem1.id,
            mem2.id,
            rule.connectionType,
            rule.strength,
            connectionMetadata
          );
          
          if (created) {
            ruleConnections++;
            connectionsCreated++;
            console.log(`  ✅ Connected: ${mem1.memory_type} ↔ ${mem2.memory_type}`);
          } else {
            connectionsSkipped++;
          }
          
          // Also create reverse connection for bidirectional relationship
          if (created && rule.connectionType !== 'implementation_sequence') {
            await createConnection(
              mem2.id,
              mem1.id,
              rule.connectionType,
              rule.strength,
              connectionMetadata
            );
            connectionsCreated++;
          }
        }
      }
    }
    
    console.log(`   📊 Rule created ${ruleConnections} connections`);
  }
  
  console.log(`\n📈 Connection Building Complete:`);
  console.log(`   ✅ Connections created: ${connectionsCreated}`);
  console.log(`   ⏭️  Connections skipped (already exist): ${connectionsSkipped}`);
}

function getConnectionContext(mem1: MemoryItem, mem2: MemoryItem): any {
  return {
    shared_keywords: mem1.keywords?.filter(k => mem2.keywords?.includes(k)) || [],
    technology_overlap: extractTechnology(mem1).filter(t => extractTechnology(mem2).includes(t)),
    service_relationship: mem1.service_id === mem2.service_id ? 'same_service' : 'cross_service'
  };
}

async function generateConnectionReport(): Promise<void> {
  console.log('\n📊 Generating Connection Report...\n');
  
  // Count connections by type
  const { data: connectionStats, error: statsError } = await supabase
    .from('memory_connections')
    .select('connection_type')
    .order('connection_type');
  
  if (statsError) {
    logger.error('Failed to generate connection stats:', statsError);
    return;
  }
  
  const connectionCounts = new Map<string, number>();
  connectionStats?.forEach(conn => {
    const count = connectionCounts.get(conn.connection_type) || 0;
    connectionCounts.set(conn.connection_type, count + 1);
  });
  
  console.log('Connection Types:');
  connectionCounts.forEach((count, type) => {
    console.log(`  ${type}: ${count} connections`);
  });
  
  // Get highly connected memories
  const { data: hubMemories, error: hubError } = await supabase
    .rpc('get_memory_connection_stats')
    .limit(10);
  
  if (!hubError && hubMemories) {
    console.log('\n🌟 Most Connected Memories:');
    hubMemories.forEach((hub: any, index: number) => {
      console.log(`  ${index + 1}. ${hub.memory_type}: ${hub.connection_count} connections`);
    });
  }
  
  // Calculate network metrics
  const totalConnections = connectionStats?.length || 0;
  const totalMemories = (await supabase.from('ai_memories').select('id', { count: 'exact' })).count || 0;
  const connectivityRate = totalMemories > 0 ? (totalConnections / totalMemories).toFixed(2) : '0';
  
  console.log(`\n📈 Network Metrics:`);
  console.log(`   Total memories: ${totalMemories}`);
  console.log(`   Total connections: ${totalConnections}`);
  console.log(`   Connectivity rate: ${connectivityRate} connections per memory`);
}

// Helper function to create connection stats RPC if it doesn't exist
async function ensureConnectionStatsFunction(): Promise<void> {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION get_memory_connection_stats()
    RETURNS TABLE (
      memory_id uuid,
      memory_type text,
      connection_count bigint
    ) AS $$
    BEGIN
      RETURN QUERY
      WITH connection_counts AS (
        SELECT 
          source_memory_id as memory_id,
          COUNT(*) as outgoing_connections
        FROM memory_connections
        GROUP BY source_memory_id
        
        UNION ALL
        
        SELECT 
          target_memory_id as memory_id,
          COUNT(*) as incoming_connections
        FROM memory_connections
        GROUP BY target_memory_id
      ),
      total_counts AS (
        SELECT 
          memory_id,
          SUM(outgoing_connections) as connection_count
        FROM connection_counts
        GROUP BY memory_id
      )
      SELECT 
        tc.memory_id,
        m.memory_type,
        tc.connection_count
      FROM total_counts tc
      JOIN ai_memories m ON tc.memory_id = m.id
      ORDER BY tc.connection_count DESC;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql: functionSQL });
  if (error && !error.message.includes('already exists')) {
    logger.warn('Could not create connection stats function:', error.message);
  }
}

async function main(): Promise<void> {
  console.log('🔗 Starting Memory Connection Builder...\n');
  
  try {
    await ensureConnectionStatsFunction();
    await buildConnections();
    await generateConnectionReport();
    
    console.log('\n🎉 Memory connections built successfully!');
    
  } catch (error) {
    logger.error('Connection building failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});