#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { scrapeSupabaseDocs } from '../services/supabase-docs-scraper';
import { logger } from '../utils/logger';
import { program } from 'commander';

program
  .name('scrape-supabase-docs')
  .description('Scrape Supabase documentation and store in database for LLM access')
  .option('--dry-run', 'Run without storing in database')
  .option('--category <category>', 'Scrape only specific category')
  .parse();

const options = program.opts();

async function main() {
  try {
    logger.info('🚀 Starting Supabase documentation scraper...');

    // Initialize Supabase client
    const supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceKey || ''
    );

    // Test database connection
    const { error: pingError } = await supabase
      .from('ai_code_snippets')
      .select('count')
      .limit(1)
      .single();

    if (pingError) {
      logger.error('Failed to connect to database:', pingError);
      process.exit(1);
    }

    logger.info('✅ Database connection successful');

    if (options.dryRun) {
      logger.info('🔍 Running in dry-run mode (no data will be stored)');
    }

    // Run the scraper
    await scrapeSupabaseDocs(supabase);

    logger.info('✨ Supabase documentation successfully scraped and stored!');
    logger.info('📚 LLMs can now access comprehensive Supabase documentation');

    // Show summary
    const { count: snippetCount } = await supabase
      .from('ai_code_snippets')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->source', 'supabase_docs');

    const { count: exampleCount } = await supabase
      .from('ai_code_examples')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->source', 'supabase_docs');

    const { count: featureCount } = await supabase
      .from('supabase_features')
      .select('*', { count: 'exact', head: true });

    logger.info('\n📊 Summary:');
    logger.info(`  - Code snippets: ${snippetCount || 0}`);
    logger.info(`  - Code examples: ${exampleCount || 0}`);
    logger.info(`  - Feature docs: ${featureCount || 0}`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error running scraper:', error);
    process.exit(1);
  }
}

// Run the scraper
main().catch(console.error);