import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function checkStartupContext() {
  try {
    // Check for startup-related context
    const { data: memories, error } = await supabase
      .from('ai_memories')
      .select('*')
      .or('content.ilike.%startup%,content.ilike.%clean%,content.ilike.%server%,content.ilike.%operational%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching memories:', error);
      return;
    }

    console.log('🔍 STARTUP CONTEXT IN SUPABASE:');
    console.log('===============================');
    
    if (!memories || memories.length === 0) {
      console.log('No startup-related context found.');
      return;
    }

    memories.forEach((memory, index) => {
      const date = new Date(memory.created_at).toLocaleString();
      console.log(`${index + 1}. [${date}] ${memory.agent_id}`);
      console.log(`   ${memory.content.substring(0, 200)}...`);
      
      if (memory.metadata && memory.metadata.server_status) {
        console.log(`   Server Status: ${memory.metadata.server_status}`);
      }
      
      if (memory.metadata && memory.metadata.completion_status) {
        console.log(`   Completion: ${memory.metadata.completion_status}`);
      }
      console.log('');
    });

    // Also check for recent operational status
    const { data: recent, error: recentError } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('agent_id', 'claude_code_agent')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!recentError && recent && recent.length > 0) {
      console.log('📋 RECENT SYSTEM STATUS:');
      console.log('========================');
      
      recent.forEach((memory, index) => {
        const date = new Date(memory.created_at).toLocaleString();
        console.log(`${index + 1}. [${date}]`);
        console.log(`   ${memory.content.substring(0, 250)}...`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Failed to check startup context:', error);
  }
}

checkStartupContext();