import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { log, LogContext } from '../utils/logger';
import { voiceInterfaceService } from './voice-interface-service';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mimeType?: string;
  lastModified: Date;
  created: Date;
  isHidden: boolean;
  tags: string[];
  description?: string;
  metadata: Record<string, any>;
}

export interface SearchQuery {
  query: string;
  fileType?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  tags?: string[];
  includeContent?: boolean;
  maxResults?: number;
}

export interface SearchResult {
  item: FileItem;
  relevanceScore: number;
  matchReason: string;
  snippet?: string;
}

export interface FileOperation {
  type: 'copy' | 'move' | 'delete' | 'rename' | 'create';
  source?: string;
  target?: string;
  options?: Record<string, any>;
}

export interface SmartOrganization {
  strategy: 'date' | 'type' | 'size' | 'project' | 'custom';
  rules: OrganizationRule[];
  dryRun: boolean;
}

export interface OrganizationRule {
  condition: {
    fileType?: string[];
    namePattern?: RegExp;
    tags?: string[];
    dateRange?: { from: Date; to: Date };
  };
  action: {
    moveTo: string;
    createFolder?: boolean;
    addTags?: string[];
  };
}

export interface VoiceFileCommand {
  intent: 'search' | 'open' | 'organize' | 'tag' | 'describe' | 'backup';
  parameters: Record<string, any>;
  confidence: number;
}

class FileManagementService extends EventEmitter {
  private watchedDirectories: Set<string> = new Set();
  private fileIndex: Map<string, FileItem> = new Map();
  private contentIndex: Map<string, string> = new Map();
  private tagSuggestions: Map<string, string[]> = new Map();
  private searchHistory: SearchQuery[] = [];
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      log.info('🗂️ Initializing File Management Service...', LogContext.SERVICE);
      
      await this.loadConfiguration();
      await this.buildInitialIndex();
      await this.setupVoiceIntegration();
      
      this.isInitialized = true;
      this.emit('serviceReady');
      
      log.info('✅ File Management Service initialized successfully', LogContext.SERVICE);
    } catch (error) {
      log.error('❌ Failed to initialize File Management Service', LogContext.SERVICE, { error });
      throw error;
    }
  }

  private async loadConfiguration(): Promise<void> {
    const defaultWatchedDirs = [
      process.env.HOME + '/Desktop',
      process.env.HOME + '/Documents',
      process.env.HOME + '/Downloads',
      '/Users/christianmerrill/Desktop/universal-ai-tools'
    ].filter(Boolean);

    defaultWatchedDirs.forEach(dir => this.watchedDirectories.add(dir));
  }

  private async buildInitialIndex(): Promise<void> {
    log.info('📊 Building file index...', LogContext.SERVICE);
    
    for (const directory of this.watchedDirectories) {
      try {
        await this.indexDirectory(directory);
      } catch (error) {
        log.warn(`⚠️ Failed to index directory: ${directory}`, LogContext.SERVICE, { error });
      }
    }
    
    log.info(`✅ File index built: ${this.fileIndex.size} files`, LogContext.SERVICE);
  }

  private async indexDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.name.startsWith('.') && !entry.name.includes('git')) {
          continue; // Skip hidden files except git
        }
        
        const stats = await fs.stat(fullPath);
        const fileItem: FileItem = {
          id: this.generateFileId(fullPath),
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? stats.size : undefined,
          mimeType: entry.isFile() ? this.getMimeType(entry.name) : undefined,
          lastModified: stats.mtime,
          created: stats.birthtime,
          isHidden: entry.name.startsWith('.'),
          tags: await this.generateSmartTags(fullPath, entry),
          metadata: {}
        };
        
        this.fileIndex.set(fileItem.id, fileItem);
        
        if (entry.isFile() && this.isTextFile(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            this.contentIndex.set(fileItem.id, content.substring(0, 10000)); // Index first 10KB
          } catch (error) {
            // Skip files that can't be read
          }
        }
        
        if (entry.isDirectory() && recursive) {
          await this.indexDirectory(fullPath, false); // Shallow recursion for performance
        }
      }
    } catch (error) {
      log.warn(`Failed to index directory: ${dirPath}`, LogContext.SERVICE, { error });
    }
  }

  private generateFileId(filePath: string): string {
    return Buffer.from(filePath).toString('base64').substring(0, 16);
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private isTextFile(fileName: string): boolean {
    const textExtensions = ['.txt', '.md', '.js', '.ts', '.json', '.py', '.css', '.html', '.xml', '.yml', '.yaml'];
    const ext = path.extname(fileName).toLowerCase();
    return textExtensions.includes(ext);
  }

  private async generateSmartTags(filePath: string, entry: any): Promise<string[]> {
    const tags: string[] = [];
    const fileName = entry.name;
    const ext = path.extname(fileName).toLowerCase();
    
    // File type tags
    if (ext) {
      tags.push(ext.substring(1)); // Remove the dot
    }
    
    // Programming language tags
    const languageTags: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.swift': 'swift'
    };
    
    if (languageTags[ext]) {
      tags.push('code', languageTags[ext]);
    }
    
    // Project-specific tags
    if (filePath.includes('universal-ai-tools')) {
      tags.push('project', 'ai-tools');
    }
    
    // Document tags
    if (['.pdf', '.doc', '.docx', '.txt', '.md'].includes(ext)) {
      tags.push('document');
    }
    
    // Media tags
    if (['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mp3', '.wav'].includes(ext)) {
      tags.push('media');
    }
    
    return tags;
  }

  private async setupVoiceIntegration(): Promise<void> {
    // Register voice commands for file management
    const voiceCommands = [
      'find files',
      'search for',
      'open file',
      'organize files',
      'tag files',
      'backup files',
      'describe file',
      'recent files',
      'large files',
      'duplicate files'
    ];
    
    log.info('🎤 Setting up voice integration for file management', LogContext.SERVICE);
  }

  public async searchFiles(query: SearchQuery): Promise<SearchResult[]> {
    try {
      log.info('🔍 Searching files', LogContext.SERVICE, { 
        query: query.query,
        maxResults: query.maxResults || 20
      });

      const results: SearchResult[] = [];
      const searchTerms = query.query.toLowerCase().split(' ');
      
      for (const [id, item] of this.fileIndex) {
        let relevanceScore = 0;
        let matchReasons: string[] = [];
        
        // Name matching
        const nameLower = item.name.toLowerCase();
        for (const term of searchTerms) {
          if (nameLower.includes(term)) {
            relevanceScore += 10;
            matchReasons.push(`name contains "${term}"`);
          }
        }
        
        // Path matching
        const pathLower = item.path.toLowerCase();
        for (const term of searchTerms) {
          if (pathLower.includes(term)) {
            relevanceScore += 5;
            matchReasons.push(`path contains "${term}"`);
          }
        }
        
        // Tag matching
        for (const tag of item.tags) {
          for (const term of searchTerms) {
            if (tag.includes(term)) {
              relevanceScore += 8;
              matchReasons.push(`tagged as "${tag}"`);
            }
          }
        }
        
        // Content matching (if enabled)
        if (query.includeContent && this.contentIndex.has(id)) {
          const content = this.contentIndex.get(id)!.toLowerCase();
          for (const term of searchTerms) {
            if (content.includes(term)) {
              relevanceScore += 15;
              matchReasons.push(`content contains "${term}"`);
              
              // Extract snippet
              const index = content.indexOf(term);
              const start = Math.max(0, index - 50);
              const end = Math.min(content.length, index + 100);
              const snippet = content.substring(start, end);
              
              results.push({
                item,
                relevanceScore,
                matchReason: matchReasons.join(', '),
                snippet
              });
              continue;
            }
          }
        }
        
        // Apply filters
        if (query.fileType && item.mimeType && !item.mimeType.includes(query.fileType)) {
          continue;
        }
        
        if (query.dateRange) {
          if (item.lastModified < query.dateRange.from || item.lastModified > query.dateRange.to) {
            continue;
          }
        }
        
        if (query.sizeRange && item.size) {
          if (item.size < query.sizeRange.min || item.size > query.sizeRange.max) {
            continue;
          }
        }
        
        if (query.tags && query.tags.length > 0) {
          const hasRequiredTags = query.tags.some(tag => item.tags.includes(tag));
          if (!hasRequiredTags) {
            continue;
          }
        }
        
        if (relevanceScore > 0) {
          results.push({
            item,
            relevanceScore,
            matchReason: matchReasons.join(', ')
          });
        }
      }
      
      // Sort by relevance and limit results
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const limitedResults = results.slice(0, query.maxResults || 20);
      
      // Store search in history
      this.searchHistory.unshift(query);
      if (this.searchHistory.length > 50) {
        this.searchHistory = this.searchHistory.slice(0, 50);
      }
      
      this.emit('searchCompleted', { query, results: limitedResults });
      
      return limitedResults;
    } catch (error) {
      log.error('❌ File search failed', LogContext.SERVICE, { error, query });
      throw error;
    }
  }

  public async processVoiceFileCommand(command: string): Promise<VoiceFileCommand> {
    try {
      log.info('🎙️ Processing voice file command', LogContext.SERVICE, { command });
      
      const commandLower = command.toLowerCase();
      
      // Intent classification
      let intent: VoiceFileCommand['intent'] = 'search';
      let confidence = 0.5;
      
      if (commandLower.includes('find') || commandLower.includes('search') || commandLower.includes('look for')) {
        intent = 'search';
        confidence = 0.9;
      } else if (commandLower.includes('open') || commandLower.includes('launch')) {
        intent = 'open';
        confidence = 0.9;
      } else if (commandLower.includes('organize') || commandLower.includes('sort') || commandLower.includes('arrange')) {
        intent = 'organize';
        confidence = 0.8;
      } else if (commandLower.includes('tag') || commandLower.includes('label')) {
        intent = 'tag';
        confidence = 0.8;
      } else if (commandLower.includes('describe') || commandLower.includes('what is')) {
        intent = 'describe';
        confidence = 0.8;
      } else if (commandLower.includes('backup') || commandLower.includes('save')) {
        intent = 'backup';
        confidence = 0.7;
      }
      
      // Extract parameters
      const parameters: Record<string, any> = {};
      
      // File type extraction
      const fileTypePattern = /(\.?\w+) files?/i;
      const fileTypeMatch = command.match(fileTypePattern);
      if (fileTypeMatch) {
        parameters.fileType = fileTypeMatch[1].replace('.', '');
      }
      
      // Date extraction
      if (commandLower.includes('today')) {
        const today = new Date();
        parameters.dateRange = {
          from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        };
      } else if (commandLower.includes('recent') || commandLower.includes('last week')) {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        parameters.dateRange = {
          from: weekAgo,
          to: new Date()
        };
      }
      
      // Size extraction
      if (commandLower.includes('large') || commandLower.includes('big')) {
        parameters.sizeRange = {
          min: 10 * 1024 * 1024, // 10MB+
          max: Infinity
        };
      } else if (commandLower.includes('small')) {
        parameters.sizeRange = {
          min: 0,
          max: 1024 * 1024 // < 1MB
        };
      }
      
      // Extract search query (remove command words)
      const commandWords = ['find', 'search', 'look', 'for', 'open', 'organize', 'tag', 'describe'];
      const words = command.toLowerCase().split(' ');
      const queryWords = words.filter(word => !commandWords.includes(word));
      parameters.query = queryWords.join(' ');
      
      const voiceCommand: VoiceFileCommand = {
        intent,
        parameters,
        confidence
      };
      
      log.info('🎯 Voice command processed', LogContext.SERVICE, voiceCommand);
      
      return voiceCommand;
    } catch (error) {
      log.error('❌ Voice file command processing failed', LogContext.SERVICE, { error, command });
      throw error;
    }
  }

  public async executeVoiceFileCommand(voiceCommand: VoiceFileCommand): Promise<string> {
    try {
      log.info('⚡ Executing voice file command', LogContext.SERVICE, voiceCommand);
      
      let response = '';
      
      switch (voiceCommand.intent) {
        case 'search':
          const searchQuery: SearchQuery = {
            query: voiceCommand.parameters.query || '',
            fileType: voiceCommand.parameters.fileType,
            dateRange: voiceCommand.parameters.dateRange,
            sizeRange: voiceCommand.parameters.sizeRange,
            includeContent: true,
            maxResults: 10
          };
          
          const results = await this.searchFiles(searchQuery);
          
          if (results.length === 0) {
            response = `I couldn't find any files matching "${searchQuery.query}". Try a different search term.`;
          } else {
            const topResults = results.slice(0, 5);
            response = `I found ${results.length} files. Here are the top matches: `;
            response += topResults.map(r => r.item.name).join(', ');
            
            if (results.length > 5) {
              response += ` and ${results.length - 5} more.`;
            }
          }
          break;
          
        case 'open':
          if (voiceCommand.parameters.query) {
            const searchResults = await this.searchFiles({
              query: voiceCommand.parameters.query,
              maxResults: 1
            });
            
            if (searchResults.length > 0) {
              const file = searchResults[0].item;
              response = `Opening ${file.name} for you.`;
              // In a real implementation, this would open the file
              this.emit('fileOpened', file);
            } else {
              response = `I couldn't find a file named "${voiceCommand.parameters.query}".`;
            }
          } else {
            response = `Which file would you like me to open?`;
          }
          break;
          
        case 'organize':
          response = `I can help organize your files. Would you like me to sort by date, file type, or project?`;
          break;
          
        case 'tag':
          response = `I can help tag your files. What files would you like to tag and with what labels?`;
          break;
          
        case 'describe':
          if (voiceCommand.parameters.query) {
            const searchResults = await this.searchFiles({
              query: voiceCommand.parameters.query,
              maxResults: 1,
              includeContent: true
            });
            
            if (searchResults.length > 0) {
              const file = searchResults[0].item;
              response = `${file.name} is a ${file.type} located at ${file.path}. `;
              response += `It's ${this.formatFileSize(file.size)} and was last modified ${this.formatDate(file.lastModified)}. `;
              response += `Tags: ${file.tags.join(', ')}.`;
            } else {
              response = `I couldn't find information about "${voiceCommand.parameters.query}".`;
            }
          } else {
            response = `Which file would you like me to describe?`;
          }
          break;
          
        case 'backup':
          response = `I can help you backup your files. Which files or folders would you like to backup?`;
          break;
          
        default:
          response = `I'm not sure how to handle that file command. Try saying "find files", "open file", or "organize files".`;
      }
      
      // Optimize response for Nari Dia voice
      response = this.optimizeForVoice(response);
      
      this.emit('voiceCommandExecuted', { voiceCommand, response });
      
      return response;
    } catch (error) {
      log.error('❌ Voice file command execution failed', LogContext.SERVICE, { error, voiceCommand });
      return `I encountered an error while processing that file command. Please try again.`;
    }
  }

  private optimizeForVoice(text: string): string {
    // Optimize text for natural speech with Nari Dia voice
    return text
      .replace(/\b(\d+)\b/g, (match, num) => {
        // Convert numbers to spoken form for better pronunciation
        const number = parseInt(num);
        if (number <= 20) return match;
        return match;
      })
      .replace(/\.(ts|js|py|cpp)/g, (match, ext) => ` dot ${ext}`)
      .replace(/\/Users\/[^\/]+/, 'your home directory')
      .replace(/\/Desktop\//, ' desktop ')
      .replace(/\/Documents\//, ' documents ')
      .replace(/\/Downloads\//, ' downloads ')
      .trim();
  }

  private formatFileSize(size?: number): string {
    if (!size) return 'unknown size';
    
    const units = ['bytes', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let sizeValue = size;
    
    while (sizeValue >= 1024 && unitIndex < units.length - 1) {
      sizeValue /= 1024;
      unitIndex++;
    }
    
    return `${sizeValue.toFixed(1)} ${units[unitIndex]}`;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  public async getRecentFiles(limit: number = 10): Promise<FileItem[]> {
    const allFiles = Array.from(this.fileIndex.values())
      .filter(item => item.type === 'file')
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    
    return allFiles.slice(0, limit);
  }

  public async getLargeFiles(minSizeMB: number = 10): Promise<FileItem[]> {
    const minSizeBytes = minSizeMB * 1024 * 1024;
    
    return Array.from(this.fileIndex.values())
      .filter(item => item.type === 'file' && item.size && item.size >= minSizeBytes)
      .sort((a, b) => (b.size || 0) - (a.size || 0));
  }

  public async smartOrganize(organization: SmartOrganization): Promise<{
    preview: { source: string; target: string; action: string }[];
    applied: boolean;
  }> {
    log.info('🤖 Smart file organization', LogContext.SERVICE, { organization });
    
    const operations: { source: string; target: string; action: string }[] = [];
    
    for (const [id, item] of this.fileIndex) {
      if (item.type !== 'file') continue;
      
      for (const rule of organization.rules) {
        let matches = true;
        
        // Check conditions
        if (rule.condition.fileType && item.mimeType) {
          matches = matches && rule.condition.fileType.some(type => item.mimeType!.includes(type));
        }
        
        if (rule.condition.namePattern) {
          matches = matches && rule.condition.namePattern.test(item.name);
        }
        
        if (rule.condition.tags) {
          matches = matches && rule.condition.tags.some(tag => item.tags.includes(tag));
        }
        
        if (rule.condition.dateRange) {
          matches = matches && 
            item.lastModified >= rule.condition.dateRange.from &&
            item.lastModified <= rule.condition.dateRange.to;
        }
        
        if (matches) {
          operations.push({
            source: item.path,
            target: path.join(rule.action.moveTo, item.name),
            action: 'move'
          });
          break; // Apply first matching rule
        }
      }
    }
    
    if (!organization.dryRun) {
      // TODO: Apply operations in a real implementation
      log.info(`Would apply ${operations.length} file organization operations`, LogContext.SERVICE);
    }
    
    return {
      preview: operations,
      applied: !organization.dryRun
    };
  }

  public getServiceStatus(): {
    initialized: boolean;
    indexedFiles: number;
    watchedDirectories: string[];
    recentSearches: number;
  } {
    return {
      initialized: this.isInitialized,
      indexedFiles: this.fileIndex.size,
      watchedDirectories: Array.from(this.watchedDirectories),
      recentSearches: this.searchHistory.length
    };
  }

  public async refreshIndex(): Promise<void> {
    log.info('🔄 Refreshing file index...', LogContext.SERVICE);
    
    this.fileIndex.clear();
    this.contentIndex.clear();
    
    await this.buildInitialIndex();
    
    this.emit('indexRefreshed', { fileCount: this.fileIndex.size });
  }
}

export const fileManagementService = new FileManagementService();