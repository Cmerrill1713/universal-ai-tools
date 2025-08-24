#!/usr/bin/env node

/**
 * Desktop Content Indexer for RAG System
 * 
 * Intelligently indexes valuable documentation and technical content
 * from the desktop into the RAG knowledge base
 */

import fs from 'fs/promises';
import path from 'path';

const CONFIG = {
  serverUrl: 'http://localhost:7456',
  basePath: '/Users/christianmerrill/Desktop',
  
  // High-value documentation files to prioritize
  priorityFiles: [
    'API_DOCUMENTATION.md',
    'DEVELOPMENT_SETUP.md', 
    'PRODUCTION_DEPLOYMENT_GUIDE.md',
    'SECURITY.md',
    'PROJECT_STRUCTURE.md',
    'QUICK_START.md',
    'README.md',
    'CLAUDE.md',
    'MCP_SETUP_GUIDE.md',
    'TESTING_CHECKLIST.md',
    'PERFORMANCE_OPTIMIZATIONS.md',
    'IMPLEMENTATION_COMPLETE_SUMMARY.md',
    'EXECUTIVE_SUMMARY_PRODUCTION_READINESS.md'
  ],
  
  // Documentation directories to scan
  docDirectories: [
    'docs',
    'docs/guides',
    'docs/summaries',
    'docs/implementation'
  ],
  
  maxFileSize: 500 * 1024, // 500KB
  delay: 300 // ms between requests
};

class DesktopContentIndexer {
  constructor() {
    this.indexedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.startTime = Date.now();
  }

  async indexDesktopContent() {
    console.log('📄 Starting desktop content indexing...');
    
    // Check server health
    const serverHealthy = await this.checkServer();
    if (!serverHealthy) {
      console.error('❌ Local LLM server not running on', CONFIG.serverUrl);
      console.log('💡 Please start with: npm run start:local-llm');
      process.exit(1);
    }

    console.log('✅ Server healthy, indexing desktop content...\n');

    // 1. Index priority files from project root
    await this.indexPriorityFiles();
    
    // 2. Index documentation directories
    await this.indexDocumentationDirs();
    
    // 3. Index iOS app documentation
    await this.indexiOSDocumentation();

    this.printSummary();
  }

  async checkServer() {
    try {
      const response = await fetch(`${CONFIG.serverUrl}/local/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async indexPriorityFiles() {
    console.log('🎯 Indexing priority documentation files...\n');
    
    for (const fileName of CONFIG.priorityFiles) {
      const filePath = path.join(CONFIG.basePath, 'universal-ai-tools', fileName);
      await this.indexFileIfExists(filePath, 'documentation');
      await this.delay();
    }
  }

  async indexDocumentationDirs() {
    console.log('\n📚 Indexing documentation directories...\n');
    
    for (const dirName of CONFIG.docDirectories) {
      const dirPath = path.join(CONFIG.basePath, 'universal-ai-tools', dirName);
      await this.indexDirectory(dirPath);
    }
  }

  async indexiOSDocumentation() {
    console.log('\n📱 Indexing iOS app documentation...\n');
    
    const iOSPaths = [
      'iOS Working App/README.md',
      'UniversalAICompanion/INSTRUCTIONS.md',
      'UniversalAICompanion/INSTALL_LOCALLY.md',
      'UniversalAICompanion/QUICK_FIX.md',
      'UniversalAICompanion/TEST_NOW.md'
    ];

    for (const relativePath of iOSPaths) {
      const fullPath = path.join(CONFIG.basePath, relativePath);
      await this.indexFileIfExists(fullPath, 'documentation');
      await this.delay();
    }
  }

  async indexDirectory(dirPath) {
    try {
      const exists = await this.pathExists(dirPath);
      if (!exists) return;

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(dirPath, entry.name);
          await this.indexFileIfExists(filePath, 'documentation');
          await this.delay();
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${dirPath}:`, error.message);
    }
  }

  async indexFileIfExists(filePath, contentType = 'documentation') {
    try {
      const exists = await this.pathExists(filePath);
      if (!exists) {
        return;
      }

      const stats = await fs.stat(filePath);
      
      // Skip large files
      if (stats.size > CONFIG.maxFileSize) {
        console.log(`⚠️  Skipped (too large): ${path.basename(filePath)} (${Math.round(stats.size/1024)}KB)`);
        this.skippedCount++;
        return;
      }

      // Read and process file
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content.trim()) {
        this.skippedCount++;
        return;
      }

      const fileName = path.basename(filePath);
      const enrichedContent = this.enrichContent(content, filePath, stats);

      // Index via chat endpoint (since /rag/index isn't available)
      const response = await fetch(`${CONFIG.serverUrl}/local/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Please learn and remember this content: ${fileName}\n\n${enrichedContent}`,
          useRAG: true,
          sessionId: 'desktop-content-indexing',
          projectPath: '/Users/christianmerrill/Desktop/universal-ai-tools',
          provider: 'ollama',
          model: 'tinyllama:latest',
          temperature: 0.1,
          max_tokens: 50
        })
      });

      if (response.ok) {
        this.indexedCount++;
        console.log(`✅ Indexed: ${fileName} (${contentType})`);
      } else {
        this.errorCount++;
        console.log(`❌ Failed: ${fileName} - ${response.status}`);
      }

    } catch (error) {
      console.error(`❌ Error with ${path.basename(filePath)}:`, error.message);
      this.errorCount++;
    }
  }

  enrichContent(content, filePath, stats) {
    const fileName = path.basename(filePath);
    const relativePath = filePath.replace('/Users/christianmerrill/Desktop/', '');
    
    return `File: ${fileName}
Path: ${relativePath}
Size: ${stats.size} bytes
Modified: ${stats.mtime.toISOString()}
Type: Documentation

Content:
${content}`;
  }

  async pathExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async delay() {
    if (CONFIG.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.delay));
    }
  }

  printSummary() {
    const duration = Date.now() - this.startTime;
    const durationSec = (duration / 1000).toFixed(2);
    
    console.log('\n📊 Desktop Content Indexing Summary:');
    console.log('═'.repeat(50));
    console.log(`✅ Successfully indexed: ${this.indexedCount} files`);
    console.log(`❌ Errors: ${this.errorCount} files`);
    console.log(`⚠️  Skipped: ${this.skippedCount} files`);
    console.log(`⏱️  Duration: ${durationSec} seconds`);
    
    if (this.indexedCount > 0) {
      console.log('\n🎉 Desktop content successfully added to RAG system!');
      console.log('💡 The knowledge base now contains valuable project documentation.');
    }
  }
}

async function main() {
  const indexer = new DesktopContentIndexer();
  await indexer.indexDesktopContent();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Indexing interrupted by user');
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});