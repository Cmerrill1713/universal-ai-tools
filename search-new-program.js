import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function searchForNewIntelligentProgram() {
  try {
    console.log('🔍 SEARCHING FOR NEW INTELLIGENT PROGRAM');
    console.log('======================================');
    
    // Search ai_memories for entries from August 4-5, 2025
    const { data: memories, error: memError } = await supabase
      .from('ai_memories')
      .select('*')
      .gte('created_at', '2025-08-04T00:00:00Z')
      .lte('created_at', '2025-08-05T23:59:59Z')
      .or('content.ilike.%program%,content.ilike.%intelligent%,content.ilike.%mle-star%,content.ilike.%breakthrough%,content.ilike.%system%,content.ilike.%discovery%,content.ilike.%new%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!memError && memories && memories.length > 0) {
      console.log('📋 Found entries in ai_memories:');
      console.log('===============================');
      
      memories.forEach((memory, index) => {
        const date = new Date(memory.created_at).toLocaleString();
        console.log(`${index + 1}. [${date}] ${memory.agent_id}`);
        console.log(`   Content: ${memory.content.substring(0, 200)}...`);
        
        if (memory.metadata) {
          const keys = Object.keys(memory.metadata);
          console.log(`   Metadata keys: ${keys.join(', ')}`);
        }
        console.log('');
      });
    } else {
      console.log('No matching entries found in ai_memories');
    }

    // Look for MLE-STAR specifically
    const { data: mleEntries, error: mleError } = await supabase
      .from('ai_memories')
      .select('*')
      .or('content.ilike.%mle-star%,content.ilike.%machine learning engineering%,content.ilike.%autonomous%,content.ilike.%ml engineering%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!mleError && mleEntries && mleEntries.length > 0) {
      console.log('🧠 MLE-STAR or Advanced ML Systems Found:');
      console.log('=========================================');
      
      mleEntries.forEach((entry, index) => {
        const date = new Date(entry.created_at).toLocaleString();
        console.log(`${index + 1}. [${date}] ${entry.agent_id}`);
        console.log(`   ${entry.content.substring(0, 300)}...`);
        
        if (entry.metadata && entry.metadata.learning_tags) {
          console.log(`   Learning Tags: ${entry.metadata.learning_tags.join(', ')}`);
        }
        console.log('');
      });
    }

    console.log('🎯 SEARCH COMPLETE - Ready to analyze discovered programs');

  } catch (error) {
    console.error('Search failed:', error);
  }
}

searchForNewIntelligentProgram();