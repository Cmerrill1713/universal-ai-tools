const { SupabaseService } = require('../dist/services/supabase_service');

/**
 * Search for TypeScript fixes in our knowledge base
 */
async function searchTypeScriptFixes(errorCode) {
  const supabase = SupabaseService.getInstance();

  console.log(`\n🔍 Searching for fixes for ${errorCode}...`);

  try {
    // Search for fixes stored earlier
    const { data, error } = await supabase.client
      .from('ai_memories')
      .select('*')
      .eq('service_id', 'typescript_scraper')
      .ilike('content', `%${errorCode}%`)
      .limit(5);

    if (error) {
      console.error('Error searching:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No fixes found in database.');
      return;
    }

    console.log(`\n✅ Found ${data.length} potential fixes:\n`);

    data.forEach((memory, index) => {
      try {
        const content = JSON.parse(memory.content);
        console.log(`${index + 1}. ${content.title || 'Fix'}`);
        console.log(`   Type: ${content.category || 'unknown'}`);

        if (content.content) {
          console.log(`\n   Fix:\n   ${content.content}\n`);
        }

        if (content.codeExample) {
          console.log(`   Example:\n${content.codeExample}\n`);
        }

        console.log('---\n');
      } catch (e) {
        console.log(`   Raw content: ${memory.content.substring(0, 200)}...\n`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Main execution
async function main() {
  // Most common errors from our analysis
  const topErrors = [
    'TS1240', // Decorator issues
    'TS2345', // Type assignment issues
    'TS2339', // Property doesn't exist
    'TS7053', // Index signature issues
    'TS2322', // Type not assignable
  ];

  for (const errorCode of topErrors) {
    await searchTypeScriptFixes(errorCode);
  }

  console.log('\n💡 Tip: Apply these fixes to resolve the TypeScript errors in your codebase!');
}

// Check environment
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

main().catch(console.error);
