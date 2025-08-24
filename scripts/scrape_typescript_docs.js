import React from 'react';
const axios = require('axios');
const cheerio = require('cheerio');
const { SupabaseService } = require('../dist/services/supabase_service');
const { logger } = require('../dist/utils/logger');

/**
 * TypeScript Documentation Scraper
 * Scrapes TypeScript documentation and stores it in Supabase for AI assistance
 */

class TypeScriptDocsScraper {
  constructor() {
    this.supabase = SupabaseService.getInstance();
    this.baseUrl = 'https://www.typescriptlang.org';
    this.processedUrls = new Set();
    this.errorPatterns = new Map();
  }

  /**
   * Main scraping function
   */
  async scrapeTypeScriptDocs() {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Starting TypeScript documentation scraping...');

    // Key documentation pages to scrape
    const keyPages = [
      '/docs/handbook/2/types-from-types.html',
      '/docs/handbook/2/generics.html',
      '/docs/handbook/2/type-inference.html',
      '/docs/handbook/2/type-compatibility.html',
      '/docs/handbook/interfaces.html',
      '/docs/handbook/classes.html',
      '/docs/handbook/modules.html',
      '/docs/handbook/declaration-files/introduction.html',
      '/docs/handbook/compiler-options.html',
      '/tsconfig',
    ];

    // Common TypeScript errors and their documentation
    const errorPages = [
      {
        code: 'TS2339',
        desc: 'Property does not exist on type',
        url: '/docs/handbook/2/understanding-errors.html',
      },
      {
        code: 'TS2345',
        desc: 'Argument not assignable to parameter',
        url: '/docs/handbook/2/understanding-errors.html',
      },
      {
        code: 'TS2322',
        desc: 'Type not assignable',
        url: '/docs/handbook/2/understanding-errors.html',
      },
      {
        code: 'TS7053',
        desc: 'Element implicitly has any type',
        url: '/docs/handbook/2/understanding-errors.html',
      },
      {
        code: 'TS2739',
        desc: 'Type is missing properties',
        url: '/docs/handbook/2/understanding-errors.html',
      },
    ];

    // Scrape handbook pages
    for (const page of keyPages) {
      await this.scrapePage(page, 'handbook');
    }

    // Store error patterns
    await this.storeErrorPatterns(errorPages);

    // Store common fixes for our specific errors
    await this.storeCommonFixes();

    console.log('✅ TypeScript documentation scraping completed!');
  }

  /**
   * Scrape a single page
   */
  async scrapePage(path, category) {
    const url = this.baseUrl + path;

    if (this.processedUrls.has(url)) {
      return;
    }

    try {
      console.log(`📄 Scraping: ${url}`);
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Extract main content
      const title = $('h1').first().text().trim() || $('title').text().trim();
      const content = $('article, .content, main').first().text().trim();

      // Extract code examples
      const codeExamples = [];
      $('pre code').each((i, elem) => {
        codeExamples.push($(elem).text().trim());
      });

      // Store in Supabase
      await this.storeInMemory({
        title,
        url,
        content: content.substring(0, 2000), // Limit content size
        codeExamples: codeExamples.slice(0, 5), // Store first 5 examples
        category,
        documentationType: 'typescript_reference',
      });

      this.processedUrls.add(url);

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`❌ Error scraping ${url}:`, error.message);
    }
  }

  /**
   * Store error patterns for quick lookup
   */
  async storeErrorPatterns(errorPages) {
    console.log('📝 Storing TypeScript error patterns...');

    for (const error of errorPages) {
      await this.storeInMemory({
        title: `TypeScript Error ${error.code}`,
        content: error.desc,
        errorCode: error.code,
        category: 'typescript_error',
        documentationType: 'error_reference',
        tags: ['typescript', 'error', error.code],
      });
    }
  }

  /**
   * Store common fixes for errors found in our codebase
   */
  async storeCommonFixes() {
    console.log('💡 Storing common TypeScript fixes...');

    const commonFixes = [
      {
        error: 'TS2339: Property does not exist on type',
        fixes: [
          'Add the property to the interface or type definition',
          'Use type assertion if you know the property exists: (obj as any).property',
          'Check if property name is spelled correctly',
          'Use optional chaining: obj?.property',
          'Define proper interface extending the base type',
        ],
        example: `
// Fix 1: Add to interface
interface MyType {
  existingProp: string;
  newProp?: string; // Add missing property
}

// Fix 2: Type assertion
const value = (myObject as any).dynamicProperty;

// Fix 3: Type guard
if ('property' in myObject) {
  console.log(myObject.property);
}`,
      },
      {
        error: 'TS2345: Argument of type X is not assignable to parameter of type Y',
        fixes: [
          'Ensure the argument matches the expected parameter type',
          'Add missing properties to the object',
          'Use type assertion if types are compatible',
          'Update function parameter type to accept the argument type',
          'Create a proper type that extends or implements required interface',
        ],
        example: `
// Fix 1: Match the expected type
interface ExpectedType {
  id: string;
  name: string;
}

const obj: ExpectedType = {
  id: '123',
  name: 'test' // Include all required properties
};

// Fix 2: Update parameter type
function myFunc(param: ExpectedType | PartialType) {
  // Handle both types
}`,
      },
      {
        error: 'TS2739: Type is missing the following properties',
        fixes: [
          'Add all missing properties to the object',
          'Use Partial<T> if properties are optional',
          'Spread existing object and add missing properties',
          'Create factory function that ensures all properties',
          'Use satisfies operator for better type inference',
        ],
        example: `
// Fix 1: Add missing properties
const obj: CompleteType = {
  ...existingObj,
  missingProp1: 'value',
  missingProp2: 123
};

// Fix 2: Use Partial for optional properties
function processData(data: Partial<CompleteType>) {
  // Handle partial data
}`,
      },
      {
        error: 'TS7053: Element implicitly has any type (index signature)',
        fixes: [
          'Add index signature to the type',
          'Use Record<string, type> for dynamic keys',
          'Check key exists before accessing',
          'Use Map instead of object for dynamic keys',
          'Define explicit keys with literal types',
        ],
        example: `
// Fix 1: Add index signature
interface MyType {
  [key: string]: unknown;
  // or more specific:
  // [key: string]: string | number;
}

// Fix 2: Use Record type
type MyRecord = Record<string, string>;

// Fix 3: Type guard
const key = 'dynamicKey';
if (key in obj) {
  const value = obj[key as keyof typeof obj];
}`,
      },
    ];

    for (const fix of commonFixes) {
      await this.storeInMemory({
        title: `Fix for ${fix.error}`,
        content: fix.fixes.join('\n'),
        codeExample: fix.example,
        category: 'typescript_fix',
        documentationType: 'solution',
        tags: ['typescript', 'fix', 'error', fix.error.split(':')[0]],
      });
    }
  }

  /**
   * Store content in Supabase memory
   */
  async storeInMemory(data) {
    try {
      const memory = {
        service_id: 'typescript_scraper',
        content: JSON.stringify(data),
        memory_type: data.documentationType || 'technical_documentation',
        metadata: {
          source_url: data.url || 'typescript_handbook',
          title: data.title,
          category: data.category,
          scraped_at: new Date().toISOString(),
        },
      };

      const { error } = await this.supabase.client.from('ai_memories').insert(memory);

      if (error) {
        console.error('Error storing memory:', error);
      } else {
        console.log(`✅ Stored: ${data.title}`);
      }
    } catch (error) {
      console.error('Error in storeInMemory:', error);
    }
  }
}

// Run the scraper
async function main() {
  const scraper = new TypeScriptDocsScraper();
  await scraper.scrapeTypeScriptDocs();

  console.log('\n📊 Scraping Summary:');
  console.log(`- Pages processed: ${scraper.processedUrls.size}`);
  console.log('- Categories: handbook, typescript_error, typescript_fix');
  console.log('\n💡 Use the stored knowledge to fix TypeScript errors!');
}

// Check if we have required dependencies
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

main().catch(console.error);
