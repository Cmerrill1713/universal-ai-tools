#!/usr/bin/env tsx

/**
 * Test SwiftUI Documentation Scraper
 * Quick test to verify the scraper works before full run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { LogContext, log } from '../utils/logger.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// TODO: Complete implementation


const supabase = createClient(supabaseUrl, supabaseKey);

async function testScraper() {
  try {
    log.info('Testing SwiftUI documentation scraper...', LogContext.SYSTEM);

    // Test scraping a single page
    const testUrl = 'https://developer.apple.com/documentation/swiftui';
    
    log.info(`Testing URL: ${testUrl}`, LogContext.SYSTEM);
    
    const response = await axios.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const title = $('h1').first().text().trim() || $('title').text().trim();
    
    log.info(`Successfully scraped: ${title}`, LogContext.SYSTEM);
    
    // Test database connection
    const { data, error } = await supabase
      .from('mcp_context')
      .select('id')
      .limit(1);
    
    if (error) {
      log.error('Database connection failed', LogContext.SYSTEM, { error });
      return false;
    }
    
    log.info('Database connection successful', LogContext.SYSTEM);
    
    // Test storing a simple entry
    const { error: insertError } = await supabase
      .from('mcp_context')
      .insert({
        content: JSON.stringify({
          test: 'SwiftUI scraper test',
          timestamp: new Date().toISOString()
        }),
        category: 'test_swiftui_scraper',
        metadata: { test: true },
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      log.error('Failed to insert test data', LogContext.SYSTEM, { error: insertError });
      return false;
    }
    
    log.info('Test data stored successfully', LogContext.SYSTEM);
    
    // Clean up test data
    const { error: deleteError } = await supabase
      .from('mcp_context')
      .delete()
      .eq('category', 'test_swiftui_scraper');
    
    if (deleteError) {
      log.warn('Failed to clean up test data', LogContext.SYSTEM, { error: deleteError });
    }
    
    return true;
  } catch (error) {
    log.error('Test failed', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

// Run the test
testScraper()
  .then((success) => {
    if (success) {
      log.info('SwiftUI scraper test passed! Ready to run full scraper.', LogContext.SYSTEM);
      process.exit(0);
    } else {
      log.error('SwiftUI scraper test failed', LogContext.SYSTEM);
      process.exit(1);
    }
  })
  .catch((error) => {
    log.error('Unexpected error', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });