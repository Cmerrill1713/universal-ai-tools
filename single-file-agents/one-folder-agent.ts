#!/usr/bin/env tsx
/**
 * One Folder Agent - Single File Agent (IndyDevDan style)
 * 
 * This agent does ONE thing really well: Intelligently manages files and folders
 * Analyzes directory structures, organizes files, monitors disk usage
 * Provides automated file operations with smart cleanup and categorization
 * 
 * Usage:
 *   npx tsx single-file-agents/one-folder-agent.ts --analyze ~/Downloads
 *   npx tsx single-file-agents/one-folder-agent.ts --organize ~/Downloads --dry-run
 *   npx tsx single-file-agents/one-folder-agent.ts --cleanup ~/Downloads --safe-mode
 */

import { readdir, stat, mkdir, copyFile, unlink, rename } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { homedir } from 'os';

// File analysis result structure
interface FileAnalysis {
  path: string;
  name: string;
  extension: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  type: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'other';
  category: string;
  duplicate?: boolean;
  duplicateOf?: string[];
}

interface DirectoryAnalysis {
  path: string;
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<string, number>;
  categories: Record<string, number>;
  duplicates: FileAnalysis[];
  largestFiles: FileAnalysis[];
  oldestFiles: FileAnalysis[];
  newestFiles: FileAnalysis[];
  recommendations: string[];
}

interface OrganizationPlan {
  moves: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
  deletions: Array<{
    file: string;
    reason: string;
  }>;
  summary: {
    filesAffected: number;
    spaceToSave: number;
    spaceToReorganize: number;
  };
}

/**
 * Determine file type based on extension
 */
function getFileType(extension: string): FileAnalysis['type'] {
  const ext = extension.toLowerCase();
  
  const types: Record<string, FileAnalysis['type']> = {
    // Documents
    '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document',
    '.rtf': 'document', '.odt': 'document', '.xls': 'document', '.xlsx': 'document',
    '.ppt': 'document', '.pptx': 'document', '.csv': 'document',
    
    // Images
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
    '.bmp': 'image', '.tiff': 'image', '.svg': 'image', '.webp': 'image',
    '.ico': 'image', '.heic': 'image', '.raw': 'image',
    
    // Videos
    '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.mov': 'video',
    '.wmv': 'video', '.flv': 'video', '.webm': 'video', '.m4v': 'video',
    '.mpg': 'video', '.mpeg': 'video',
    
    // Audio
    '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.aac': 'audio',
    '.ogg': 'audio', '.wma': 'audio', '.m4a': 'audio', '.opus': 'audio',
    
    // Archives
    '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive',
    '.gz': 'archive', '.bz2': 'archive', '.xz': 'archive', '.dmg': 'archive',
    
    // Code
    '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code',
    '.cpp': 'code', '.c': 'code', '.h': 'code', '.swift': 'code',
    '.go': 'code', '.rs': 'code', '.php': 'code', '.rb': 'code',
    '.css': 'code', '.html': 'code', '.json': 'code', '.xml': 'code'
  };
  
  return types[ext] || 'other';
}

/**
 * Get category for organization
 */
function getCategory(file: FileAnalysis): string {
  switch (file.type) {
    case 'document':
      if (file.extension === '.pdf') return 'PDFs';
      if (['.doc', '.docx'].includes(file.extension)) return 'Word Documents';
      if (['.xls', '.xlsx'].includes(file.extension)) return 'Spreadsheets';
      return 'Documents';
    case 'image':
      if (['.jpg', '.jpeg'].includes(file.extension)) return 'Photos';
      if (file.extension === '.png') return 'Screenshots';
      return 'Images';
    case 'video':
      return 'Videos';
    case 'audio':
      return 'Music';
    case 'archive':
      return 'Archives';
    case 'code':
      return 'Code Files';
    default:
      return 'Other Files';
  }
}

/**
 * Calculate file hash for duplicate detection (simple version)
 */
function calculateSimpleHash(file: FileAnalysis): string {
  // Simple hash based on size and name for demo
  // In production, would use actual file content hashing
  return `${file.size}_${file.name}`;
}

/**
 * Analyze a directory and all its files
 */
async function analyzeDirectory(directoryPath: string): Promise<DirectoryAnalysis> {
  console.log(`🔍 Analyzing directory: ${directoryPath}`);
  
  const files: FileAnalysis[] = [];
  const fileHashes = new Map<string, FileAnalysis[]>();
  
  async function processDirectory(path: string) {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        
        if (entry.isDirectory()) {
          // Skip system directories
          if (['.DS_Store', 'node_modules', '.git'].includes(entry.name)) {
            continue;
          }
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            const extension = extname(entry.name);
            const type = getFileType(extension);
            
            const fileAnalysis: FileAnalysis = {
              path: fullPath,
              name: entry.name,
              extension: extension,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              accessed: stats.atime,
              type: type,
              category: '',
            };
            
            fileAnalysis.category = getCategory(fileAnalysis);
            
            // Check for duplicates
            const hash = calculateSimpleHash(fileAnalysis);
            if (!fileHashes.has(hash)) {
              fileHashes.set(hash, []);
            }
            fileHashes.get(hash)!.push(fileAnalysis);
            
            files.push(fileAnalysis);
          } catch (error) {
            console.warn(`⚠️  Cannot analyze file: ${fullPath}`);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Cannot read directory: ${path}`);
    }
  }
  
  await processDirectory(directoryPath);
  
  // Mark duplicates
  const duplicates: FileAnalysis[] = [];
  for (const [hash, fileList] of fileHashes) {
    if (fileList.length > 1) {
      for (let i = 1; i < fileList.length; i++) {
        fileList[i].duplicate = true;
        fileList[i].duplicateOf = fileList.slice(0, i).map(f => f.path);
        duplicates.push(fileList[i]);
      }
    }
  }
  
  // Calculate statistics
  const totalFiles = files.length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  const fileTypes: Record<string, number> = {};
  const categories: Record<string, number> = {};
  
  for (const file of files) {
    fileTypes[file.type] = (fileTypes[file.type] || 0) + 1;
    categories[file.category] = (categories[file.category] || 0) + 1;
  }
  
  // Top files by size, age
  const largestFiles = files
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  const oldestFiles = files
    .sort((a, b) => a.modified.getTime() - b.modified.getTime())
    .slice(0, 10);
  
  const newestFiles = files
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .slice(0, 10);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (duplicates.length > 0) {
    const duplicateSize = duplicates.reduce((sum, f) => sum + f.size, 0);
    recommendations.push(`📄 Found ${duplicates.length} duplicate files wasting ${formatBytes(duplicateSize)}`);
  }
  
  if (largestFiles.length > 0 && largestFiles[0].size > 100 * 1024 * 1024) {
    recommendations.push(`📦 Large files detected - consider archiving files over 100MB`);
  }
  
  const documentsInRoot = files.filter(f => 
    dirname(f.path) === directoryPath && f.type === 'document'
  ).length;
  if (documentsInRoot > 10) {
    recommendations.push(`📂 ${documentsInRoot} documents in root - consider organizing into folders`);
  }
  
  const oldFiles = files.filter(f => {
    const monthsOld = (Date.now() - f.modified.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsOld > 12;
  }).length;
  if (oldFiles > 50) {
    recommendations.push(`🗓️  ${oldFiles} files older than 1 year - consider archiving or cleanup`);
  }
  
  return {
    path: directoryPath,
    totalFiles,
    totalSize,
    fileTypes,
    categories,
    duplicates,
    largestFiles,
    oldestFiles,
    newestFiles,
    recommendations
  };
}

/**
 * Create organization plan
 */
async function createOrganizationPlan(analysis: DirectoryAnalysis, options: {
  safeMode: boolean;
  organizeByType: boolean;
  removeDuplicates: boolean;
}): Promise<OrganizationPlan> {
  const plan: OrganizationPlan = {
    moves: [],
    deletions: [],
    summary: {
      filesAffected: 0,
      spaceToSave: 0,
      spaceToReorganize: 0
    }
  };
  
  const baseDir = analysis.path;
  
  // Plan folder organization
  if (options.organizeByType) {
    const categorizedFiles = new Map<string, FileAnalysis[]>();
    
    for (const file of analysis.duplicates.length > 0 ? 
         analysis.duplicates.filter(f => !f.duplicate) : 
         []) {
      if (!categorizedFiles.has(file.category)) {
        categorizedFiles.set(file.category, []);
      }
      categorizedFiles.get(file.category)!.push(file);
    }
    
    // Create moves for files that are in root directory
    for (const file of analysis.duplicates.filter(f => !f.duplicate)) {
      if (dirname(file.path) === baseDir) {
        const targetDir = join(baseDir, file.category);
        const targetPath = join(targetDir, file.name);
        
        plan.moves.push({
          from: file.path,
          to: targetPath,
          reason: `Organize ${file.type} files into ${file.category} folder`
        });
        
        plan.summary.spaceToReorganize += file.size;
      }
    }
  }
  
  // Plan duplicate removal
  if (options.removeDuplicates) {
    for (const duplicate of analysis.duplicates) {
      if (options.safeMode) {
        // In safe mode, move to trash folder instead of delete
        const trashDir = join(baseDir, '.duplicates');
        const trashPath = join(trashDir, duplicate.name);
        
        plan.moves.push({
          from: duplicate.path,
          to: trashPath,
          reason: `Move duplicate file to .duplicates folder`
        });
      } else {
        plan.deletions.push({
          file: duplicate.path,
          reason: `Duplicate of ${duplicate.duplicateOf?.[0] || 'unknown'}`
        });
      }
      
      plan.summary.spaceToSave += duplicate.size;
    }
  }
  
  plan.summary.filesAffected = plan.moves.length + plan.deletions.length;
  
  return plan;
}

/**
 * Execute organization plan
 */
async function executeOrganizationPlan(plan: OrganizationPlan, dryRun: boolean = false): Promise<void> {
  console.log(`\n📋 ${dryRun ? 'DRY RUN - ' : ''}Executing organization plan...`);
  
  if (dryRun) {
    console.log('\n📁 Planned moves:');
    for (const move of plan.moves) {
      console.log(`  ${move.from} → ${move.to}`);
      console.log(`    Reason: ${move.reason}`);
    }
    
    console.log('\n🗑️  Planned deletions:');
    for (const deletion of plan.deletions) {
      console.log(`  ${deletion.file}`);
      console.log(`    Reason: ${deletion.reason}`);
    }
    return;
  }
  
  // Execute moves
  for (const move of plan.moves) {
    try {
      // Create target directory if it doesn't exist
      await mkdir(dirname(move.to), { recursive: true });
      await rename(move.from, move.to);
      console.log(`✅ Moved: ${basename(move.from)} → ${dirname(move.to)}`);
    } catch (error) {
      console.error(`❌ Failed to move ${move.from}: ${error}`);
    }
  }
  
  // Execute deletions
  for (const deletion of plan.deletions) {
    try {
      await unlink(deletion.file);
      console.log(`🗑️  Deleted: ${basename(deletion.file)}`);
    } catch (error) {
      console.error(`❌ Failed to delete ${deletion.file}: ${error}`);
    }
  }
  
  console.log(`\n✅ Organization complete!`);
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Print analysis report
 */
function printAnalysisReport(analysis: DirectoryAnalysis): void {
  console.log('\n📊 DIRECTORY ANALYSIS REPORT');
  console.log('='.repeat(50));
  
  console.log('\n📈 Overall Statistics:');
  console.log(`  Total Files: ${analysis.totalFiles}`);
  console.log(`  Total Size: ${formatBytes(analysis.totalSize)}`);
  
  console.log('\n📂 File Types:');
  Object.entries(analysis.fileTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const percentage = Math.round(count / analysis.totalFiles * 100);
      console.log(`  ${type}: ${count} files (${percentage}%)`);
    });
  
  console.log('\n🗂️  Categories:');
  Object.entries(analysis.categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count} files`);
    });
  
  if (analysis.duplicates.length > 0) {
    const duplicateSize = analysis.duplicates.reduce((sum, f) => sum + f.size, 0);
    console.log('\n🔄 Duplicates:');
    console.log(`  Found: ${analysis.duplicates.length} files`);
    console.log(`  Wasted Space: ${formatBytes(duplicateSize)}`);
    
    console.log('\n  Sample Duplicates:');
    analysis.duplicates.slice(0, 5).forEach(dup => {
      console.log(`    ${dup.name} (${formatBytes(dup.size)})`);
    });
  }
  
  console.log('\n📏 Largest Files:');
  analysis.largestFiles.slice(0, 5).forEach((file, i) => {
    console.log(`  ${i + 1}. ${file.name} (${formatBytes(file.size)})`);
  });
  
  console.log('\n💡 Recommendations:');
  analysis.recommendations.forEach(rec => {
    console.log(`  ${rec}`);
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
One Folder Agent - Single File Agent (IndyDevDan style)
Usage:
  --analyze <path>           Analyze directory structure
  --organize <path>          Organize files in directory
  --cleanup <path>           Clean up duplicates and organize
  --dry-run                  Show what would happen without doing it
  --safe-mode               Move duplicates to trash instead of delete
  --help                    Show this help message

Examples:
  npx tsx single-file-agents/one-folder-agent.ts --analyze ~/Downloads
  npx tsx single-file-agents/one-folder-agent.ts --organize ~/Downloads --dry-run
  npx tsx single-file-agents/one-folder-agent.ts --cleanup ~/Downloads --safe-mode
    `);
    return;
  }
  
  // Parse arguments
  const command = args[0];
  const targetPath = args[1] || process.cwd();
  const options = {
    dryRun: args.includes('--dry-run'),
    safeMode: args.includes('--safe-mode'),
    organizeByType: true,
    removeDuplicates: command === '--cleanup'
  };
  
  // Expand ~ to home directory
  const resolvedPath = targetPath.startsWith('~') 
    ? join(homedir(), targetPath.slice(1)) 
    : targetPath;
  
  try {
    // Always analyze first
    const analysis = await analyzeDirectory(resolvedPath);
    
    if (command === '--analyze') {
      printAnalysisReport(analysis);
      return;
    }
    
    if (command === '--organize' || command === '--cleanup') {
      printAnalysisReport(analysis);
      
      // Create and execute organization plan
      const plan = await createOrganizationPlan(analysis, options);
      
      console.log('\n📋 Organization Plan:');
      console.log(`  Files to move: ${plan.moves.length}`);
      console.log(`  Files to delete: ${plan.deletions.length}`);
      console.log(`  Space to save: ${formatBytes(plan.summary.spaceToSave)}`);
      console.log(`  Space to reorganize: ${formatBytes(plan.summary.spaceToReorganize)}`);
      
      if (plan.summary.filesAffected === 0) {
        console.log('\n✨ Directory is already well organized!');
        return;
      }
      
      if (!options.dryRun) {
        console.log('\n⚠️  This will modify your files. Continue? (Press Ctrl+C to cancel)');
        // In a real implementation, you'd wait for user confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      await executeOrganizationPlan(plan, options.dryRun);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

// Run if called directly (IndyDevDan pattern) - ES module compatible
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// Export for use by other agents (IndyDevDan pattern)
export { 
  analyzeDirectory,
  createOrganizationPlan,
  executeOrganizationPlan,
  type FileAnalysis,
  type DirectoryAnalysis,
  type OrganizationPlan
};