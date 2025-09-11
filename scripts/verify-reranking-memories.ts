import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function verifyMemories() {
  console.log('Verifying stored reranking memories...\n');

  // Fetch all reranking memories
  const { data: memories, error } = await supabase
    .from('ai_memories')
    .select('*')
    .eq('service_id', 'reranking-knowledge-base')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching memories:', error);
    return;
  }

  console.log(`Found ${memories?.length || 0} reranking memories:\n`);

  if (memories && memories.length > 0) {
    for (const memory of memories) {
      console.log(`ID: ${memory.id}`);
      console.log(`Type: ${memory.memory_type}`);
      console.log(`Category: ${memory.metadata?.memory_category || 'N/A'}`);
      console.log(`Keywords: ${memory.metadata?.keywords?.join(', ') || 'N/A'}`);
      console.log(`Content Preview: ${memory.content.substring(0, 200)}...`);
      console.log(`Importance: ${memory.metadata?.importance_score || 'N/A'}`);
      console.log('---\n');
    }

    // Check for connections
    const memoryIds = memories.map((m) => m.id);
    const { data: connections, error: connError } = await supabase
      .from('memory_connections')
      .select('*')
      .or(
        `source_memory_id.in.(${memoryIds.join(',')}),target_memory_id.in.(${memoryIds.join(',')})`
      );

    if (!connError && connections && connections.length > 0) {
      console.log(`\nFound ${connections.length} memory connections:`);
      for (const conn of connections) {
        console.log(`Connection: ${conn.source_memory_id} -> ${conn.target_memory_id}`);
        console.log(`Type: ${conn.connection_type}, Strength: ${conn.strength}`);
        console.log(`Metadata: ${JSON.stringify(conn.metadata)}`);
        console.log('---\n');
      }
    } else {
      console.log('\nNo memory connections found.');
    }
  }
}

// Run verification
verifyMemories().catch(console.error);
