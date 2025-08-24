/**
 * Documentation Scraper Service
 * Fetches and stores AI library documentation in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { marked } from 'marked';
import { logger } from '../utils/enhanced-logger.js';

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface LibraryInfo {
  name: string;
  display_name: string;
  category: string;
  language: string;
  description: string;
  homepage?: string;
  repository?: string;
  documentation_url?: string;
  stars?: number;
  downloads?: number;
  rating?: number;
  features?: string[];
  tags?: string[];
  installation?: Record<string, string>;
}

export interface DocumentationContent {
  doc_type: 'readme' | 'getting_started' | 'api_reference' | 'tutorial' | 'example' | 'changelog' | 'migration_guide' | 'configuration' | 'troubleshooting' | 'best_practices';
  title: string;
  content: string;
  markdown_content?: string;
  html_content?: string;
  url?: string;
  version?: string;
  language?: string;
}

export interface CodeExample {
  title: string;
  description?: string;
  code: string;
  language: string;
  category?: string;
  tags?: string[];
}

export class DocumentationScraper {
  private readonly githubToken: string | undefined;
  private readonly rateLimitDelay: number = 1000; // 1 second between requests

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  /**
   * Scrape documentation for a library
   */
  async scrapeLibraryDocumentation(library: LibraryInfo): Promise<void> {
    const startTime = Date.now();
    let scrapingLogId: string | null = null;

    try {
      // Check if library exists in database
      let { data: existingLibrary, error: fetchError } = await supabase
        .from('ai_libraries')
        .select('id')
        .eq('name', library.name)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let libraryId: string;

      if (!existingLibrary) {
        // Insert new library
        const { data: newLibrary, error: insertError } = await supabase
          .from('ai_libraries')
          .insert({
            name: library.name,
            display_name: library.display_name,
            category: library.category,
            language: library.language,
            description: library.description,
            homepage: library.homepage,
            repository: library.repository,
            documentation_url: library.documentation_url,
            stars: library.stars || 0,
            downloads: library.downloads || 0,
            rating: library.rating || 0,
            features: library.features || [],
            tags: library.tags || [],
            installation: library.installation || {},
            last_updated: new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        libraryId = newLibrary.id;
      } else {
        libraryId = existingLibrary.id;
      }

      // Create scraping log entry
      const { data: logEntry, error: logError } = await supabase
        .from('documentation_scraping_logs')
        .insert({
          library_id: libraryId,
          url: library.documentation_url || library.repository || '',
          status: 'in_progress',
          pages_scraped: 0,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (logError) throw logError;
      scrapingLogId = logEntry.id;

      let pagesScraped = 0;

      // Scrape README from GitHub if repository URL is provided
      if (library.repository && library.repository.includes('github.com')) {
        const readme = await this.scrapeGitHubReadme(library.repository);
        if (readme) {
          await this.storeDocumentation(libraryId, {
            doc_type: 'readme',
            title: `${library.display_name} README`,
            content: readme.content,
            markdown_content: readme.markdown,
            html_content: readme.html,
            url: `${library.repository}/blob/main/README.md`
          });
          pagesScraped++;
        }

        // Scrape examples from GitHub
        const examples = await this.scrapeGitHubExamples(library.repository);
        for (const example of examples) {
          await this.storeCodeExample(libraryId, example);
        }
        pagesScraped += examples.length;

        await this.delay(this.rateLimitDelay);
      }

      // Scrape documentation website if URL is provided
      if (library.documentation_url) {
        const docs = await this.scrapeDocumentationWebsite(library.documentation_url);
        for (const doc of docs) {
          await this.storeDocumentation(libraryId, doc);
          pagesScraped++;
          await this.delay(this.rateLimitDelay);
        }
      }

      // Update scraping log with success
      await supabase
        .from('documentation_scraping_logs')
        .update({
          status: 'completed',
          pages_scraped: pagesScraped,
          completed_at: new Date().toISOString(),
          metadata: {
            duration_ms: Date.now() - startTime
          }
        })
        .eq('id', scrapingLogId);

      logger.info(`Successfully scraped documentation for ${library.name}`, {
        libraryId,
        pagesScraped,
        duration: Date.now() - startTime
      });

    } catch (error) {
      logger.error(`Failed to scrape documentation for ${library.name}`, error);

      // Update scraping log with error
      if (scrapingLogId) {
        await supabase
          .from('documentation_scraping_logs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', scrapingLogId);
      }

      throw error;
    }
  }

  /**
   * Scrape README from GitHub repository
   */
  private async scrapeGitHubReadme(repoUrl: string): Promise<{ content: string; markdown: string; html: string } | null> {
    try {
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return null;

      const [, owner, repo] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3.raw'
      };

      if (this.githubToken) {
        headers['Authorization'] = `token ${this.githubToken}`;
      }

      const response = await axios.get(apiUrl, { headers });
      const markdown = response.data;
      const html = await marked(markdown);
      const content = this.extractTextFromHtml(html);

      return { content, markdown, html };
    } catch (error) {
      logger.error('Failed to scrape GitHub README', error);
      return null;
    }
  }

  /**
   * Scrape code examples from GitHub repository
   */
  private async scrapeGitHubExamples(repoUrl: string): Promise<CodeExample[]> {
    const examples: CodeExample[] = [];

    try {
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return examples;

      const [, owner, repo] = match;
      
      // Check for examples or samples directory
      const possiblePaths = ['examples', 'samples', 'Examples', 'Samples', 'demo', 'Demo'];
      
      for (const path of possiblePaths) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3+json'
        };

        if (this.githubToken) {
          headers['Authorization'] = `token ${this.githubToken}`;
        }

        try {
          const response = await axios.get(apiUrl, { headers });
          
          if (Array.isArray(response.data)) {
            for (const file of response.data) {
              if (file.type === 'file' && this.isCodeFile(file.name)) {
                const example = await this.fetchGitHubFile(file.download_url, file.name);
                if (example) {
                  examples.push(example);
                  if (examples.length >= 10) break; // Limit to 10 examples
                }
              }
            }
          }
        } catch (error) {
          // Directory doesn't exist, continue to next
          continue;
        }

        if (examples.length > 0) break;
      }
    } catch (error) {
      logger.error('Failed to scrape GitHub examples', error);
    }

    return examples;
  }

  /**
   * Fetch a single file from GitHub
   */
  private async fetchGitHubFile(url: string, filename: string): Promise<CodeExample | null> {
    try {
      const response = await axios.get(url);
      const code = response.data;
      const language = this.getLanguageFromFilename(filename);

      return {
        title: filename,
        description: `Example code from ${filename}`,
        code: typeof code === 'string' ? code : JSON.stringify(code, null, 2),
        language,
        category: 'example',
        tags: ['example', 'github']
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Scrape documentation from a website
   */
  private async scrapeDocumentationWebsite(url: string): Promise<DocumentationContent[]> {
    const docs: DocumentationContent[] = [];

    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Extract main documentation content
      const mainContent = this.extractMainContent($);
      if (mainContent) {
        docs.push({
          doc_type: 'getting_started',
          title: $('title').text() || 'Documentation',
          content: mainContent.text,
          html_content: mainContent.html,
          markdown_content: await this.htmlToMarkdown(mainContent.html),
          url
        });
      }

      // Look for API reference sections
      const apiSections = this.extractAPISections($);
      for (const section of apiSections) {
        docs.push({
          doc_type: 'api_reference',
          title: section.title,
          content: section.text,
          html_content: section.html,
          markdown_content: await this.htmlToMarkdown(section.html),
          url: section.url || url
        });
      }

      // Look for tutorial links
      const tutorialLinks = this.extractTutorialLinks($, url);
      for (const link of tutorialLinks.slice(0, 5)) { // Limit to 5 tutorials
        const tutorial = await this.scrapeTutorial(link);
        if (tutorial) {
          docs.push(tutorial);
        }
        await this.delay(this.rateLimitDelay);
      }

    } catch (error) {
      logger.error('Failed to scrape documentation website', error);
    }

    return docs;
  }

  /**
   * Extract main content from HTML
   */
  private extractMainContent($: cheerio.CheerioAPI): { text: string; html: string } | null {
    // Try common content selectors
    const selectors = [
      'main',
      '[role="main"]',
      '.content',
      '.documentation',
      '.markdown-body',
      '#content',
      'article',
      '.post-content'
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        return {
          text: element.text().trim(),
          html: element.html() || ''
        };
      }
    }

    // Fallback to body content
    const body = $('body');
    if (body.length > 0) {
      return {
        text: body.text().trim(),
        html: body.html() || ''
      };
    }

    return null;
  }

  /**
   * Extract API sections from documentation
   */
  private extractAPISections($: cheerio.CheerioAPI): Array<{ title: string; text: string; html: string; url?: string }> {
    const sections: Array<{ title: string; text: string; html: string; url?: string }> = [];

    // Look for API reference sections
    const apiSelectors = [
      '.api-reference',
      '#api',
      '[data-section="api"]',
      'h2:contains("API")',
      'h3:contains("API")'
    ];

    apiSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $element = $(element);
        const title = $element.text().trim();
        const content = $element.nextUntil('h2, h3').addBack();
        
        if (content.length > 0) {
          sections.push({
            title,
            text: content.text().trim(),
            html: content.html() || ''
          });
        }
      });
    });

    return sections;
  }

  /**
   * Extract tutorial links from documentation
   */
  private extractTutorialLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    const tutorialPatterns = /tutorial|guide|example|quickstart|getting.started/i;

    $('a').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text();

      if (href && tutorialPatterns.test(text)) {
        const absoluteUrl = new URL(href, baseUrl).toString();
        if (!links.includes(absoluteUrl)) {
          links.push(absoluteUrl);
        }
      }
    });

    return links;
  }

  /**
   * Scrape a tutorial page
   */
  private async scrapeTutorial(url: string): Promise<DocumentationContent | null> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      const content = this.extractMainContent($);
      if (!content) return null;

      return {
        doc_type: 'tutorial',
        title: $('title').text() || 'Tutorial',
        content: content.text,
        html_content: content.html,
        markdown_content: await this.htmlToMarkdown(content.html),
        url
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Store documentation in Supabase
   */
  private async storeDocumentation(libraryId: string, doc: DocumentationContent): Promise<void> {
    try {
      const { error } = await supabase
        .from('library_documentation')
        .upsert({
          library_id: libraryId,
          doc_type: doc.doc_type,
          title: doc.title,
          content: doc.content,
          markdown_content: doc.markdown_content,
          html_content: doc.html_content,
          url: doc.url,
          version: doc.version || 'latest',
          language: doc.language || 'en',
          scraped_at: new Date().toISOString()
        }, {
          onConflict: 'library_id,doc_type,version,language'
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to store documentation', error);
    }
  }

  /**
   * Store code example in Supabase
   */
  private async storeCodeExample(libraryId: string, example: CodeExample): Promise<void> {
    try {
      const { error } = await supabase
        .from('library_code_examples')
        .insert({
          library_id: libraryId,
          title: example.title,
          description: example.description,
          code: example.code,
          language: example.language,
          category: example.category,
          tags: example.tags || []
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to store code example', error);
    }
  }

  /**
   * Extract text from HTML
   */
  private extractTextFromHtml(html: string): string {
    const $ = cheerio.load(html);
    return $.text().trim();
  }

  /**
   * Convert HTML to Markdown
   */
  private async htmlToMarkdown(html: string): Promise<string> {
    // Simple HTML to Markdown conversion
    // In production, use a proper library like turndown
    const $ = cheerio.load(html);
    
    // Remove script and style tags
    $('script, style').remove();
    
    // Convert headers
    $('h1').each((_, el) => $(el).replaceWith(`# ${$(el).text()}\n\n`));
    $('h2').each((_, el) => $(el).replaceWith(`## ${$(el).text()}\n\n`));
    $('h3').each((_, el) => $(el).replaceWith(`### ${$(el).text()}\n\n`));
    
    // Convert links
    $('a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text();
      $el.replaceWith(`[${text}](${href})`);
    });
    
    // Convert code blocks
    $('pre code').each((_, el) => {
      const $el = $(el);
      const code = $el.text();
      const language = $el.attr('class')?.replace('language-', '') || '';
      $el.parent().replaceWith(`\`\`\`${language}\n${code}\n\`\`\`\n\n`);
    });
    
    // Convert inline code
    $('code').each((_, el) => {
      const $el = $(el);
      $el.replaceWith(`\`${$el.text()}\``);
    });
    
    // Convert lists
    $('ul li').each((_, el) => {
      const $el = $(el);
      $el.replaceWith(`- ${$el.text()}\n`);
    });
    
    $('ol li').each((i, el) => {
      const $el = $(el);
      $el.replaceWith(`${i + 1}. ${$el.text()}\n`);
    });
    
    // Convert paragraphs
    $('p').each((_, el) => {
      const $el = $(el);
      $el.replaceWith(`${$el.text()}\n\n`);
    });
    
    return $.text().trim();
  }

  /**
   * Check if filename is a code file
   */
  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.swift', '.kt', '.go', '.rs', '.rb', '.php', '.cs', '.scala',
      '.m', '.mm', '.vue', '.svelte', '.dart', '.r', '.jl', '.lua'
    ];
    
    return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  /**
   * Get programming language from filename
   */
  private getLanguageFromFilename(filename: string): string {
    const extensionMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.scala': 'scala',
      '.m': 'objectivec',
      '.mm': 'objectivec',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.dart': 'dart',
      '.r': 'r',
      '.jl': 'julia',
      '.lua': 'lua'
    };

    const ext = filename.match(/\.[^.]+$/)?.[0];
    return ext ? extensionMap[ext] || 'plaintext' : 'plaintext';
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Scrape all libraries from the AI libraries router
   */
  async scrapeAllLibraries(): Promise<void> {
    // Import library data from the router
    const aiLibrariesModule = await import('../routers/ai-libraries.js');
    let libraryList = aiLibrariesModule.AI_LIBRARIES_EXPORT || [];
    
    // Fall back to legacy exports if needed
    if (libraryList.length === 0) {
      const { swiftLibraries, aiFrameworks } = aiLibrariesModule;
      libraryList = [...(swiftLibraries || []), ...(aiFrameworks || [])];
    }

    const allLibraries: LibraryInfo[] = libraryList.map(lib => ({
      ...lib,
      category: lib.category as any
    }));

    logger.info(`Starting documentation scraping for ${allLibraries.length} libraries`);

    for (const library of allLibraries) {
      try {
        logger.info(`Scraping documentation for ${library.name}`);
        await this.scrapeLibraryDocumentation(library);
        await this.delay(2000); // 2 seconds between libraries
      } catch (error) {
        logger.error(`Failed to scrape ${library.name}`, error);
        // Continue with next library
      }
    }

    logger.info('Documentation scraping completed');
  }
}

// Export singleton instance
export const documentationScraper = new DocumentationScraper();