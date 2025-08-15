#!/usr/bin/env node

/**
 * RAG Content Indexing Script
 * 
 * Scans directories for relevant content and indexes it into the RAG system
 * Supports code files, documentation, text files, and more
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Local LLM server with RAG
  serverUrl: 'http://localhost:7456',
  
  // Directories to scan
  scanPaths: [
    '/Users/christianmerrill/Desktop',
    '/Volumes/External', // Common external drive mount point
    '/Volumes/Untitled', // Another common mount point
    // Add more paths as needed
  ],
  
  // File types to index
  fileTypes: {
    code: ['.js', '.ts', '.tsx', '.jsx', '.py', '.swift', '.cpp', '.c', '.h', '.java', '.go', '.rs', '.php', '.rb'],
    documentation: ['.md', '.txt', '.rst', '.adoc', '.doc', '.docx'],
    config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'],
    data: ['.csv', '.tsv', '.xml', '.sql'],
  },
  
  // Directories to skip
  skipDirs: [
    'node_modules', '.git', '.svn', 'dist', 'build', 'coverage', 
    '.nyc_output', 'tmp', 'temp', '.cache', '.DS_Store',
    'Library', 'System', 'Applications', '.Trash'
  ],
  
  // File size limits (in bytes)
  maxFileSize: 1024 * 1024, // 1MB
  maxFilesPerDir: 50,
  
  // Batch processing
  batchSize: 10,
  delay: 100, // ms between requests
};

class RAGIndexer {
  constructor() {
    this.indexedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Main indexing function
   */
  async indexContent() {
    console.log('🔍 Starting RAG content indexing...');
    console.log(`📂 Scanning paths: ${CONFIG.scanPaths.join(', ')}`);
    
    // Check if server is running
    const serverHealthy = await this.checkServer();
    if (!serverHealthy) {
      console.error('❌ Local LLM server not running on', CONFIG.serverUrl);
      console.log('💡 Please start the server with: npm run start:local-llm');
      process.exit(1);
    }

    console.log('✅ Server is healthy, starting content scan...\n');

    // Scan each path
    for (const scanPath of CONFIG.scanPaths) {
      if (await this.pathExists(scanPath)) {
        console.log(`📁 Scanning: ${scanPath}`);
        await this.scanDirectory(scanPath);
      } else {
        console.log(`⚠️  Path not found: ${scanPath}`);
      }
    }

    this.printSummary();
  }

  /**
   * Check if server is running
   */
  async checkServer() {
    try {
      const response = await fetch(`${CONFIG.serverUrl}/local/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if path exists
   */
  async pathExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Recursively scan directory
   */
  async scanDirectory(dirPath, depth = 0) {
    if (depth > 5) return; // Limit recursion depth

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip certain directories
          if (CONFIG.skipDirs.includes(entry.name) || entry.name.startsWith('.')) {
            continue;
          }
          
          // Recursively scan subdirectories
          await this.scanDirectory(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // Check if file should be indexed
          if (this.shouldIndexFile(entry.name, fullPath)) {
            files.push(fullPath);
          }
        }
      }

      // Process files in batches
      if (files.length > 0) {
        await this.processFileBatch(files.slice(0, CONFIG.maxFilesPerDir));
      }

    } catch (error) {
      console.error(`❌ Error scanning ${dirPath}:`, error.message);
    }
  }

  /**
   * Check if file should be indexed
   */
  shouldIndexFile(fileName, filePath) {
    const ext = path.extname(fileName).toLowerCase();
    const allTypes = [
      ...CONFIG.fileTypes.code,
      ...CONFIG.fileTypes.documentation,
      ...CONFIG.fileTypes.config,
      ...CONFIG.fileTypes.data
    ];
    
    return allTypes.includes(ext);
  }

  /**
   * Determine content type
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    
    if (CONFIG.fileTypes.code.includes(ext)) return 'code';
    if (CONFIG.fileTypes.documentation.includes(ext)) return 'documentation';
    if (CONFIG.fileTypes.config.includes(ext)) return 'code'; // Treat config as code
    if (CONFIG.fileTypes.data.includes(ext)) return 'general';
    
    return 'general';
  }

  /**
   * Process batch of files
   */
  async processFileBatch(files) {
    const batches = [];
    for (let i = 0; i < files.length; i += CONFIG.batchSize) {
      batches.push(files.slice(i, i + CONFIG.batchSize));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(file => this.indexFile(file)));
      
      // Small delay between batches
      if (CONFIG.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.delay));
      }
    }
  }

  /**
   * Index a single file
   */
  async indexFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      // Skip large files
      if (stats.size > CONFIG.maxFileSize) {
        this.skippedCount++;
        return;
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Skip empty files
      if (!content.trim()) {
        this.skippedCount++;
        return;
      }

      const fileName = path.basename(filePath);
      const contentType = this.getContentType(fileName);
      const projectPath = this.getProjectPath(filePath);

      // Prepare content with metadata
      const enrichedContent = this.enrichContent(content, filePath, stats);

      // Index in RAG system
      const response = await fetch(`${CONFIG.serverUrl}/local/rag/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: enrichedContent,
          contentType,
          projectPath,
          metadata: {
            fileName,
            filePath,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
            extension: path.extname(fileName),
            directory: path.dirname(filePath),
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.indexedCount++;
        
        console.log(`✅ Indexed: ${fileName} (${contentType}) - ${result.indexed?.entities || 0} entities`);
      } else {
        console.error(`❌ Failed to index ${fileName}: ${response.status}`);
        this.errorCount++;
      }

    } catch (error) {
      console.error(`❌ Error indexing ${filePath}:`, error.message);
      this.errorCount++;
    }
  }

  /**
   * Enrich content with metadata and context
   */
  enrichContent(content, filePath, stats) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const dir = path.dirname(filePath);
    
    const header = `File: ${fileName}
Path: ${filePath}
Type: ${ext}
Size: ${stats.size} bytes
Modified: ${stats.mtime.toISOString()}
Directory: ${dir}

Content:
`;

    return header + content;
  }

  /**
   * Extract project path from file path
   */
  getProjectPath(filePath) {
    // Try to find project root indicators
    const projectIndicators = [
      'package.json', 'Cargo.toml', 'requirements.txt', 
      '.git', 'README.md', 'Makefile', 'project.xcodeproj'
    ];
    
    let currentDir = path.dirname(filePath);
    
    while (currentDir !== path.dirname(currentDir)) {
      for (const indicator of projectIndicators) {
        const indicatorPath = path.join(currentDir, indicator);
        try {
          if (fs.access(indicatorPath)) {
            return currentDir;
          }
        } catch {
          // Continue searching
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to directory containing the file
    return path.dirname(filePath);
  }

  /**
   * Print indexing summary
   */
  printSummary() {
    const duration = Date.now() - this.startTime;
    const durationSec = (duration / 1000).toFixed(2);
    
    console.log('\n📊 Indexing Summary:');
    console.log('═'.repeat(50));
    console.log(`✅ Successfully indexed: ${this.indexedCount} files`);
    console.log(`❌ Errors: ${this.errorCount} files`);
    console.log(`⚠️  Skipped: ${this.skippedCount} files`);
    console.log(`⏱️  Duration: ${durationSec} seconds`);
    console.log(`🚀 Rate: ${(this.indexedCount / (duration / 1000)).toFixed(2)} files/sec`);
    
    if (this.indexedCount > 0) {
      console.log('\n🎉 RAG system populated successfully!');
      console.log('💡 You can now test enhanced responses with context from your files.');
    }
  }
}

// Special indexing for this project
async function indexCurrentProject() {
  const projectRoot = path.resolve(__dirname, '..');
  const indexer = new RAGIndexer();
  
  console.log('🔍 Indexing current Universal AI Tools project...');
  
  // Index key project files
  const importantPaths = [
    path.join(projectRoot, 'README.md'),
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'macOS-App'),
    path.join(projectRoot, 'docs'),
  ];

  for (const p of importantPaths) {
    if (await indexer.pathExists(p)) {
      const stats = await fs.stat(p);
      if (stats.isDirectory()) {
        await indexer.scanDirectory(p);
      } else {
        await indexer.indexFile(p);
      }
    }
  }
  
  return indexer;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--project-only')) {
    // Index only current project
    await indexCurrentProject();
  } else {
    // Full system scan
    const indexer = new RAGIndexer();
    await indexer.indexContent();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Indexing interrupted by user');
  console.log('📊 Partial results may be available in the RAG system');
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});