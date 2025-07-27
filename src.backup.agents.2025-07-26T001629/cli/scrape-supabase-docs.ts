/* eslint-disable no-undef */
#!/usr/bin/env node;
import { create.Client } from '@supabase/supabase-js';
import { config } from './config';
import { scrapeSupabase.Docs } from './services/supabase-docs-scraper';
import { logger } from './utils/logger';
import { program } from 'commander';
program;
  name('scrape-supabase-docs');
  description('Scrape Supabase documentation and store in database for LL.M access');
  option('--dry-run', 'Run without storing in database');
  option('--category <category>', 'Scrape only specific category');
  parse();
const options = programopts();
async function main() {
  try {
    loggerinfo('🚀 Starting Supabase documentation scraper.')// Initialize Supabase client;
    const supabase = create.Client(
      configdatabasesupabase.Url;
      configdatabasesupabaseService.Key || '')// Test database connection;
    const { error instanceof Error ? errormessage : String(error) ping.Error } = await supabase;
      from('ai_code_snippets');
      select('count');
      limit(1);
      single();
    if (ping.Error) {
      loggererror('Failed to connect to database:', ping.Error);
      processexit(1)};

    loggerinfo('✅ Database connection successful');
    if (optionsdry.Run) {
      loggerinfo('🔍 Running in dry-run mode (no data will be stored)')}// Run the scraper;
    await scrapeSupabase.Docs(supabase);
    loggerinfo('✨ Supabase documentation successfully scraped and stored!');
    loggerinfo('📚 LL.Ms can now access comprehensive Supabase documentation')// Show summary;
    const { count: snippet.Count } = await supabase;
      from('ai_code_snippets');
      select('*', { count: 'exact', head: true });
      eq('metadata->source', 'supabase_docs');
    const { count: example.Count } = await supabase;
      from('ai_code_examples');
      select('*', { count: 'exact', head: true });
      eq('metadata->source', 'supabase_docs');
    const { count: feature.Count } = await supabase;
      from('supabase_features');
      select('*', { count: 'exact', head: true });
    loggerinfo('\n📊 Summary:');
    loggerinfo(`  - Code snippets: ${snippet.Count || 0}`);
    loggerinfo(`  - Code examples: ${example.Count || 0}`);
    loggerinfo(`  - Feature docs: ${feature.Count || 0}`);
    processexit(0)} catch (error) {
    loggererror('❌ Error running scraper:', error instanceof Error ? errormessage : String(error) processexit(1);
  }}// Run the scraper;
main()catch(console.error instanceof Error ? errormessage : String(error);