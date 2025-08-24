#!/usr/bin/env node

/**
 * Simple Documentation Scraper Test
 * Tests documentation scraping without Supabase dependency
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { setTimeout } from 'timers/promises';

async function scrapeUrl(url) {
  try {
    console.log(`🔍 Scraping: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Universal-AI-Tools Documentation Scraper 1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Remove script tags, style tags, and navigation elements
    $('script, style, nav, header, footer, .navigation, .sidebar').remove();
    
    // Extract main content
    let content = '';
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.documentation',
      '.docs-content',
      'article',
      '.markdown-body'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }
    
    // Fallback to body if no main content found
    if (!content) {
      content = $('body').text().trim();
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // Extract title
    let title = $('h1').first().text().trim();
    if (!title) {
      title = $('title').text().trim();
    }
    if (!title) {
      title = url.split('/').pop() || 'Documentation Page';
    }

    return {
      url,
      title,
      content: content.substring(0, 1000), // Show first 1000 chars for testing
      wordCount: content.split(' ').length,
      scrapedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Failed to scrape ${url}:`, error.message);
    return null;
  }
}

async function testScraping() {
  console.log('🧪 Testing Documentation Scraper...\n');
  
  const testUrls = [
    'https://react.dev/learn',
    'https://nextjs.org/docs',
    'https://fastapi.tiangolo.com/'
  ];
  
  for (const url of testUrls) {
    const result = await scrapeUrl(url);
    
    if (result) {
      console.log(`✅ Successfully scraped: ${result.title}`);
      console.log(`   📄 Word count: ${result.wordCount}`);
      console.log(`   📝 Content preview: ${result.content.substring(0, 200)}...`);
      console.log('');
    }
    
    // Respectful delay
    await setTimeout(2000);
  }
  
  console.log('🏆 Test complete!');
}

testScraping();