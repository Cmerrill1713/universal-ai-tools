import { promises as fs } from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/enhanced-logger';
import { agentCollaborationWS } from './agent-collaboration-websocket';
import { EventEmitter } from 'events';
import { SearXNGClient } from '../core/knowledge/searxng-client';
import axios from 'axios';
import * as cheerio from 'cheerio';

const execAsync = promisify(exec);

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  category: 'file' | 'code' | 'system' | 'analysis' | 'web';
  permissions?: string[];
}

export interface ToolExecutionRequest {
  tool: string;
  parameters: Record<string, any>;
  agentId?: string;
  requestId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  toolUsed: string;
}

export class ToolExecutionService extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private executionHistory: ToolExecutionResult[] = [];
  private workingDirectory: string;
  private searxngClient: SearXNGClient;

  constructor(workingDirectory: string = process.cwd()) {
    super();
    this.workingDirectory = workingDirectory;
    this.searxngClient = new SearXNGClient(process.env.SEARXNG_URL || 'http://localhost:8888');
    this.registerSystemTools();
  }

  private registerSystemTools(): void {
    // File operation tools
    this.registerTool({
      name: 'READ_FILE',
      description: 'Read contents of a file',
      inputSchema: {
        path: { type: 'string', required: true },
        encoding: { type: 'string', default: 'utf8' }
      },
      category: 'file';
    });

    this.registerTool({
      name: 'WRITE_FILE',
      description: 'Write content to a file',
      inputSchema: {
        path: { type: 'string', required: true },
        content: { type: 'string', required: true },
        encoding: { type: 'string', default: 'utf8' }
      },
      category: 'file';
    });

    this.registerTool({
      name: 'LIST_FILES',
      description: 'List files in a directory',
      inputSchema: {
        path: { type: 'string', required: true },
        recursive: { type: 'boolean', default: false }
      },
      category: 'file';
    });

    this.registerTool({
      name: 'CREATE_FILE',
      description: 'Create a new file with content',
      inputSchema: {
        path: { type: 'string', required: true },
        content: { type: 'string', required: true }
      },
      category: 'file';
    });

    this.registerTool({
      name: 'DELETE_FILE',
      description: 'Delete a file',
      inputSchema: {
        path: { type: 'string', required: true }
      },
      category: 'file';
    });

    this.registerTool({
      name: 'CREATE_DIRECTORY',
      description: 'Create a new directory',
      inputSchema: {
        path: { type: 'string', required: true },
        recursive: { type: 'boolean', default: true }
      },
      category: 'file';
    });

    // Code execution tools
    this.registerTool({
      name: 'EXECUTE_CODE',
      description: 'Execute code in various languages',
      inputSchema: {
        language: { type: 'string', required: true },
        code: { type: 'string', required: true },
        timeout: { type: 'number', default: 30000 }
      },
      category: 'code';
    });

    this.registerTool({
      name: 'EXECUTE_COMMAND',
      description: 'Execute a shell command',
      inputSchema: {
        command: { type: 'string', required: true },
        cwd: { type: 'string', default: process.cwd() },
        timeout: { type: 'number', default: 30000 }
      },
      category: 'system';
    });

    // Analysis tools
    this.registerTool({
      name: 'ANALYZE_CODE',
      description: 'Analyze code structure and quality',
      inputSchema: {
        path: { type: 'string', required: true },
        language: { type: 'string' }
      },
      category: 'analysis';
    });

    this.registerTool({
      name: 'SEARCH_FILES',
      description: 'Search for patterns in files',
      inputSchema: {
        pattern: { type: 'string', required: true },
        path: { type: 'string', default: '.' },
        fileTypes: { type: 'array', default: [] }
      },
      category: 'analysis';
    });

    // Web scraping and search tools
    this.registerTool({
      name: 'WEB_SEARCH',
      description: 'Search the web using SearXNG',
      inputSchema: {
        query: { type: 'string', required: true },
        engines: { type: 'string', default: 'duckduckgo,google' },
        category: { type: 'string', default: 'general' },
        limit: { type: 'number', default: 10 }
      },
      category: 'web';
    });

    this.registerTool({
      name: 'SCRAPE_WEBPAGE',
      description: 'Scrape content from a webpage',
      inputSchema: {
        url: { type: 'string', required: true },
        selector: { type: 'string' },
        extractType: { type: 'string', default: 'text' }
      },
      category: 'web';
    });

    this.registerTool({
      name: 'DISCOVER_TOOLS',
      description: 'Search for and discover new tools from the web',
      inputSchema: {
        query: { type: 'string', required: true },
        technology: { type: 'string' },
        toolType: { type: 'string' }
      },
      category: 'web';
    });

    this.registerTool({
      name: 'EXTRACT_STRUCTURED_DATA',
      description: 'Extract structured data from web content',
      inputSchema: {
        url: { type: 'string', required: true },
        schema: { type: 'object' }
      },
      category: 'web';
    });

    logger.info(`Registered ${this.tools.size} system tools`);
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.tools.get(request.tool);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${request.tool} not found`,
        executionTime: Date.now() - startTime,
        toolUsed: request.tool;
      };
    }

    // Notify UI about tool execution
    if (request.agentId) {
      agentCollaborationWS.updateAgentProgress(;
        request.agentId,
        `Executing ${request.tool}`,
        30;
      );
    }

    try {
      // Validate parameters
      const validationError = this.validateParameters(tool, request.parameters);
      if (validationError) {
        throw new Error(validationError);
      }

      // Execute the tool
      const result = await this.executeToolInternal(request.tool, request.parameters);

      const executionResult: ToolExecutionResult = {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        toolUsed: request.tool;
      };

      this.executionHistory.push(executionResult);
      this.emit('tool_executed', executionResult);

      return executionResult;
    } catch (error) {
      const executionResult: ToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        toolUsed: request.tool;
      };

      this.executionHistory.push(executionResult);
      this.emit('tool_failed', executionResult);

      return executionResult;
    }
  }

  private validateParameters(tool: ToolDefinition, parameters: Record<string, any>): string | null {
    for (const [key, schema] of Object.entries(tool.inputSchema)) {
      if (schema.required && !(key in parameters)) {
        return `Required parameter '${key}' missing for tool ${tool.name}`;
      }
    }
    return null;
  }

  private async executeToolInternal(toolName: string, params: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'READ_FILE':;
        return await this.readFile(params.path, params.encoding);

      case 'WRITE_FILE':;
        return await this.writeFile(params.path, params.content: params.encoding);

      case 'LIST_FILES':;
        return await this.listFiles(params.path, params.recursive);

      case 'CREATE_FILE':;
        return await this.createFile(params.path, params.content);

      case 'DELETE_FILE':;
        return await this.deleteFile(params.path);

      case 'CREATE_DIRECTORY':;
        return await this.createDirectory(params.path, params.recursive);

      case 'EXECUTE_CODE':;
        return await this.executeCode(params.language, params.code, params.timeout);

      case 'EXECUTE_COMMAND':;
        return await this.executeCommand(params.command, params.cwd, params.timeout);

      case 'ANALYZE_CODE':;
        return await this.analyzeCode(params.path, params.language);

      case 'SEARCH_FILES':;
        return await this.searchFiles(params.pattern, params.path, params.fileTypes);

      case 'WEB_SEARCH':;
        return await this.webSearch(params.query, params.engines, params.category, params.limit);

      case 'SCRAPE_WEBPAGE':;
        return await this.scrapeWebpage(params.url, params.selector, params.extractType);

      case 'DISCOVER_TOOLS':;
        return await this.discoverTools(params.query, params.technology, params.toolType);

      case 'EXTRACT_STRUCTURED_DATA':;
        return await this.extractStructuredData(params.url, params.schema);

      default:;
        throw new Error(`Tool ${toolName} not implemented`);
    }
  }

  // File operations
  private async readFile(filePath: string, encoding: string = 'utf8'): Promise<string> {
    const absolutePath = path.resolve(this.workingDirectory, filePath);
    this.validatePath(absolutePath);
    
    try {
      const content = await fs.readFile(absolutePath, encoding);
      logger.info(`Read file: ${absolutePath}`);
      return content;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  private async writeFile(filePath: string, content: string, encoding: string = 'utf8'): Promise<void> {
    const absolutePath = path.resolve(this.workingDirectory, filePath);
    this.validatePath(absolutePath);
    
    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(absolutePath, content: encoding);
    logger.info(`Wrote file: ${absolutePath}`);
  }

  private async listFiles(dirPath: string, recursive: boolean = false): Promise<string[]> {
    const absolutePath = path.resolve(this.workingDirectory, dirPath);
    this.validatePath(absolutePath);
    
    if (recursive) {
      return await this.listFilesRecursive(absolutePath);
    } else {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      return entries.map(entry => path.join(dirPath, entry.name));
    }
  }

  private async listFilesRecursive(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listFilesRecursive(fullPath));
      } else {
        files.push(path.relative(this.workingDirectory, fullPath));
      }
    }
    
    return files;
  }

  private async createFile(filePath: string, content: string): Promise<void> {
    const absolutePath = path.resolve(this.workingDirectory, filePath);
    this.validatePath(absolutePath);
    
    // Check if file already exists
    try {
      await fs.access(absolutePath);
      throw new Error(`File already exists: ${filePath}`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
    
    await this.writeFile(filePath, content);
  }

  private async deleteFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(this.workingDirectory, filePath);
    this.validatePath(absolutePath);
    
    await fs.unlink(absolutePath);
    logger.info(`Deleted file: ${absolutePath}`);
  }

  private async createDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
    const absolutePath = path.resolve(this.workingDirectory, dirPath);
    this.validatePath(absolutePath);
    
    await fs.mkdir(absolutePath, { recursive });
    logger.info(`Created directory: ${absolutePath}`);
  }

  // Code execution
  private async executeCode(language: string, code: string, timeout: number = 30000): Promise<string> {
    const supportedLanguages: Record<string, { ext: string; cmd: string }> = {
      javascript: { ext: 'js', cmd: 'node' },
      typescript: { ext: 'ts', cmd: 'tsx' },
      python: { ext: 'py', cmd: 'python3' },
      bash: { ext: 'sh', cmd: 'bash' },
      sh: { ext: 'sh', cmd: 'sh' }
    };

    const langConfig = supportedLanguages[language.toLowerCase()];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Create temporary file
    const tempFile = path.join(this.workingDirectory, `.temp_${Date.now()}.${langConfig.ext}`);
    
    try {
      await fs.writeFile(tempFile, code);
      const { stdout, stderr } = await execAsync(`${langConfig.cmd} ${tempFile}`, {
        timeout,
        cwd: this.workingDirectory;
      });
      
      if (stderr) {
        logger.warn(`Code execution stderr: ${stderr}`);
      }
      
      return stdout || stderr;
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        logger.warn(`Failed to clean up temp file: ${tempFile}`);
      }
    }
  }

  private async executeCommand(command: string, cwd: string = process.cwd(), timeout: number = 30000): Promise<string> {
    // Security check - prevent dangerous commands
    const dangerousCommands = ['rm -rf', 'format', 'del /f', 'sudo rm'];
    if (dangerousCommands.some(cmd => command.includes(cmd))) {
      throw new Error('Dangerous command blocked for security reasons');
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd: path.resolve(this.workingDirectory, cwd);
    });

    return stdout || stderr;
  }

  // Analysis tools
  private async analyzeCode(filePath: string, language?: string): Promise<any> {
    const content = await this.readFile(filePath);
    const lines = content.split('\n');
    const ext = path.extname(filePath).slice(1);
    const detectedLanguage = language || ext;

    return {
      file: filePath,
      language: detectedLanguage,
      lines: lines.length,
      size: content.length,
      hasTests: content.includes('test(') || content.includes('describe('),
      imports: this.extractImports(content: detectedLanguage),
      functions: this.extractFunctions(content: detectedLanguage),
      complexity: this.estimateComplexity(content);
    };
  }

  private async searchFiles(pattern: string, searchPath: string = '.', fileTypes: string[] = []): Promise<any[]> {
    const results: any[] = [];
    const files = await this.listFilesRecursive(path.resolve(this.workingDirectory, searchPath));
    
    for (const file of files) {
      // Filter by file type if specified
      if (fileTypes.length > 0) {
        const ext = path.extname(file).slice(1);
        if (!fileTypes.includes(ext)) continue;
      }

      try {
        const content = await this.readFile(file);
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes(pattern)) {
            results.push({
              file,
              line: index + 1,
              content: line.trim(),
              match: pattern;
            });
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return results;
  }

  // Self-healing capabilities
  async selfHeal(error: Error, context: ToolExecutionRequest): Promise<ToolExecutionResult | null> {
    logger.info('Attempting self-healing for error:', error.message);

    // Handle file not found errors
    if (error.message.includes('File not found') || error.message.includes('ENOENT')) {
      if (context.tool === 'READ_FILE' || context.tool === 'WRITE_FILE') {
        const filePath = context.parameters.path;
        const dir = path.dirname(filePath);
        
        // Try creating the directory
        try {
          await this.createDirectory(dir, true);
          logger.info(`Created missing directory: ${dir}`);
          
          // If writing, retry the operation
          if (context.tool === 'WRITE_FILE') {
            return await this.executeTool(context);
          }
        } catch (healError) {
          logger.error('Self-healing failed:', healError);
        }
      }
    }

    // Handle permission errors
    if (error.message.includes('EACCES') || error.message.includes('Permission denied')) {
      logger.warn('Permission denied - cannot self-heal permission errors');
      return {
        success: false,
        error: 'Permission denied. Please check file permissions.',
        executionTime: 0,
        toolUsed: context.tool;
      };
    }

    return null;
  }

  // Helper methods
  private validatePath(absolutePath: string): void {
    // Ensure path is within working directory (prevent directory traversal)
    const relative = path.relative(this.workingDirectory, absolutePath);
    if (relative.startsWith('..')) {
      throw new Error('Access denied: Path is outside working directory');
    }
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (language === 'javascript' || language === 'typescript') {
        const importMatch = line.match(/import .* from ['"](.+)['"]/);
        if (importMatch) imports.push(importMatch[1]);
      } else if (language === 'python') {
        const importMatch = line.match(/(?:from (.+) import|import (.+))/);
        if (importMatch) imports.push(importMatch[1] || importMatch[2]);
      }
    }
    
    return imports;
  }

  private extractFunctions(content: string, language: string): string[] {
    const functions: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (language === 'javascript' || language === 'typescript') {
        const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)|async)/);
        if (funcMatch) functions.push(funcMatch[1]);
      } else if (language === 'python') {
        const funcMatch = line.match(/def\s+(\w+)\s*\(/);
        if (funcMatch) functions.push(funcMatch[1]);
      }
    }
    
    return functions;
  }

  private estimateComplexity(content: string): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const conditions = (content.match(/if|else|switch|case|while|for/g) || []).length;
    const complexity = conditions / lines;
    
    if (complexity < 0.1) return 'low';
    if (complexity < 0.2) return 'medium';
    return 'high';
  }

  // Get available tools
  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // Get execution history
  getExecutionHistory(): ToolExecutionResult[] {
    return this.executionHistory;
  }

  // Web scraping and search methods
  private async webSearch(query: string, engines: string = 'duckduckgo,google', category: string = 'general', limit: number = 10): Promise<any> {
    try {
      const results = await this.searxngClient.search({
        q: query,
        engines,
        category,
        format: 'json';
      });

      // Return top results up to limit
      return {
        query,
        results: results.results.slice(0, limit).map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          engine: r.engine;
        })),
        total: results.number_of_results,
        suggestions: results.suggestions;
      };
    } catch (error) {
      logger.error('Web search failed:', error);
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async scrapeWebpage(url: string, selector?: string, extractType: string = 'text'): Promise<any> {
    try {
      // Fetch webpage content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UniversalAITools/1.0)';
        },
        timeout: 30000;
      });

      const html = response.data;
      const $ = cheerio.load(html);

      let content: any;
      
      switch (extractType) {
        case 'text':;
          if (selector) {
            content = $(selector).text().trim();
          } else {
            // Remove script and style elements
            $('script, style').remove();
            content = $('body').text().trim().replace(/\s+/g, ' ');
          }
          break;
          
        case 'html':;
          content = selector ? $(selector).html() : $.html();
          break;
          
        case 'links':;
          const links: string[] = [];
          $(selector || 'a').each((_, elem) => {
            const href = $(elem).attr('href');
            if (href) {
              // Convert relative URLs to absolute
              const absoluteUrl = new URL(href, url).toString();
              links.push(absoluteUrl);
            }
          });
          content = [...new Set(links)]; // Remove duplicates;
          break;
          
        case 'structured':;
          // Extract common structured data
          content = {
            title: $('title').text(),
            headings: {
              h1: $('h1').map((_, el) => $(el).text()).get(),
              h2: $('h2').map((_, el) => $(el).text()).get();
            },
            meta: {
              description: $('meta[name="description"]').attr('content'),
              keywords: $('meta[name="keywords"]').attr('content');
            },
            images: $('img').map((_, el) => $(el).attr('src')).get();
          };
          break;
          
        default:;
          content = html;
      }

      return {
        url,
        content,
        extractType,
        timestamp: new Date().toISOString();
      };
    } catch (error) {
      logger.error('Webpage scraping failed:', error);
      throw new Error(`Failed to scrape webpage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async discoverTools(query: string, technology?: string, toolType?: string): Promise<any> {
    try {
      // Build search query for finding tools
      let searchQuery = query;
      if (technology) searchQuery += ` ${technology}`;
      if (toolType) searchQuery += ` ${toolType}`;
      searchQuery += ' tool library package npm github';

      // Search for tools
      const searchResults = await this.webSearch(searchQuery, 'github,duckduckgo', 'general', 20);
      
      const discoveredTools: any[] = [];
      
      // Analyze each result for tool information
      for (const result of searchResults.results) {
        if (result.url.includes('github.com') || result.url.includes('npmjs.com')) {
          try {
            // Scrape tool information
            const pageData = await this.scrapeWebpage(result.url, undefined, 'structured');
            
            discoveredTools.push({
              name: result.title,
              url: result.url,
              description: result.content,
              source: result.url.includes('github.com') ? 'github' : 'npm',
              metadata: pageData.content;
            });
          } catch (error) {
            // Skip failed scrapes
            logger.warn(`Failed to scrape tool info from ${result.url}`);
          }
        }
      }

      // Also search specific package registries
      if (technology?.toLowerCase().includes('javascript') || technology?.toLowerCase().includes('node')) {
        const npmResults = await this.searchNpmForTools(query);
        discoveredTools.push(...npmResults);
      }

      return {
        query,
        technology,
        toolType,
        discoveredTools: discoveredTools.slice(0, 10), // Return top 10 tools;
        totalFound: discoveredTools.length;
      };
    } catch (error) {
      logger.error('Tool discovery failed:', error);
      throw new Error(`Failed to discover tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractStructuredData(url: string, schema?: any): Promise<any> {
    try {
      // First scrape the webpage
      const scraped = await this.scrapeWebpage(url, undefined, 'structured');
      const html = await this.scrapeWebpage(url, undefined, 'html');
      
      // Extract based on schema if provided
      if (schema) {
        const $ = cheerio.load(html.content);
        const extracted: any = {};
        
        for (const [key, selector] of Object.entries(schema)) {
          if (typeof selector === 'string') {
            extracted[key] = $(selector).text().trim();
          } else if (typeof selector === 'object' && selector.selector) {
            const elements = $(selector.selector);
            if (selector.multiple) {
              extracted[key] = elements.map((_, el) => $(el).text().trim()).get();
            } else {
              extracted[key] = elements.first().text().trim();
            }
          }
        }
        
        return {
          url,
          structured: scraped.content,
          extracted,
          timestamp: new Date().toISOString();
        };
      }
      
      return scraped;
    } catch (error) {
      logger.error('Structured data extraction failed:', error);
      throw new Error(`Failed to extract structured data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchNpmForTools(query: string): Promise<any[]> {
    try {
      // Search npm registry
      const response = await axios.get(`https://registry.npmjs.org/-/v1/search`, {
        params: {
          text: query,
          size: 10;
        },
        timeout: 10000;
      });

      return response.data.objects.map((pkg: any) => ({
        name: pkg.package.name,
        url: `https://www.npmjs.com/package/${pkg.package.name}`,
        description: pkg.package.description,
        source: 'npm',
        metadata: {
          version: pkg.package.version,
          keywords: pkg.package.keywords,
          links: pkg.package.links;
        }
      }));
    } catch (error) {
      logger.warn('NPM search failed:', error);
      return [];
    }
  }
}

// Export singleton instance
export const toolExecutionService = new ToolExecutionService();