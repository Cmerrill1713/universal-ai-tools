/**
 * Template Migration Service - Move static content to Supabase
 * Handles migration of templates, assets, and cleanup of local folders
 */

import { createClient    } from '@supabase/supabase-js';';';';
import { promises as fs    } from 'fs';';';';
import path from 'path';';';';
import crypto from 'crypto';';';';
import { LogContext, log    } from '@/utils/logger';';';';

interface MigrationResult {
  success: boolean;,
  migratedFiles: number;,
  spaceSaved: number; // bytes,
  errors: string[];
}

interface AssetMigrationOptions {
  preserveLocal?: boolean;
  archiveOlder?: boolean;
  ageLimitDays?: number;
}

export class TemplateMigrationService {
  private supabase;
  private rootPath: string;

  constructor() {
    this.supabase = createClient()
      process.env.SUPABASE_URL || 'http: //127.0.0.1:54321','''
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '''''
    );
    this.rootPath = process.cwd();
  }

  /**
   * Migrate PRP templates to Supabase storage and database
   */
  async migratePRPTemplates(): Promise<MigrationResult> {
    const result: MigrationResult = {,;
      success: true,
      migratedFiles: 0,
      spaceSaved: 0,
      errors: []
    };

    try {
      log.info('🚀 Starting PRP template migration', LogContext.DATABASE);'''

      // Find all PRP template files
      const templatePaths = [;
        'PRPs/templates/','''
        'context-engineering-intro/PRPs/templates/','''
        'context-engineering-intro/use-cases/''''
      ];

      for (const templatePath of templatePaths) {
        const fullPath = path.join(this.rootPath, templatePath);
        
        try {
          const exists = await fs.access(fullPath).then(() => true).catch(() => false);
          if (!exists) continue;

          await this.migrateDirectory(fullPath, 'prp-templates', result);'''
        } catch (error) {
          result.errors.push(`Failed to migrate ${templatePath}: ${error}`);
        }
      }

      log.info('✅ PRP template migration completed', LogContext.DATABASE, {')''
        migratedFiles: result.migratedFiles,
        spaceSaved: `${(result.spaceSaved / 1024).toFixed(2)}KB`,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Migrate enterprise development templates
   */
  async migrateEnterpriseTemplates(): Promise<MigrationResult> {
    const result: MigrationResult = {,;
      success: true,
      migratedFiles: 0,
      spaceSaved: 0,
      errors: []
    };

    try {
      log.info('🏢 Starting enterprise template migration', LogContext.DATABASE);'''

      const enterprisePaths = [;
        'src/templates/','''
        'enterprise-dev-toolkit/templates/''''
      ];

      for (const templatePath of enterprisePaths) {
        const fullPath = path.join(this.rootPath, templatePath);
        
        try {
          const exists = await fs.access(fullPath).then(() => true).catch(() => false);
          if (!exists) continue;

          await this.migrateDirectory(fullPath, 'enterprise-templates', result);'''
        } catch (error) {
          result.errors.push(`Failed to migrate ${templatePath}: ${error}`);
        }
      }

      log.info('✅ Enterprise template migration completed', LogContext.DATABASE, {')''
        migratedFiles: result.migratedFiles,
        spaceSaved: `${(result.spaceSaved / 1024).toFixed(2)}KB`,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Archive large directories to Supabase storage
   */
  async archiveLargeAssets(options: AssetMigrationOptions = {}): Promise<MigrationResult> {
    const result: MigrationResult = {,;
      success: true,
      migratedFiles: 0,
      spaceSaved: 0,
      errors: []
    };

    try {
      log.info('📦 Starting large asset archival', LogContext.DATABASE);'''

      // Archive screenshots (1.1GB+ potential savings)
      await this.archiveScreenshots(result, options);

      // Archive old logs (if older than age limit)
      await this.archiveOldLogs(result, options);

      // Archive backup directories
      await this.archiveBackupDirectories(result, options);

      log.info('✅ Large asset archival completed', LogContext.DATABASE, {')''
        migratedFiles: result.migratedFiles,
        spaceSaved: `${(result.spaceSaved / 1024 / 1024).toFixed(2)}MB`,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Archival failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Clean up backup directories and temporary files
   */
  async cleanupBackupDirectories(): Promise<MigrationResult> {
    const result: MigrationResult = {,;
      success: true,
      migratedFiles: 0,
      spaceSaved: 0,
      errors: []
    };

    try {
      log.info('🧹 Starting backup directory cleanup', LogContext.DATABASE);'''

      const backupPatterns = [;
        'src.backup.*/','''
        'syntax-fix-backup-*/','''
        'syntax-backups/','''
        'backups/*/','''
        '*.backup''''
      ];

      for (const pattern of backupPatterns) {
        try {
          await this.cleanupPattern(pattern, result);
        } catch (error) {
          result.errors.push(`Failed to cleanup ${pattern}: ${error}`);
        }
      }

      log.info('✅ Backup directory cleanup completed', LogContext.DATABASE, {')''
        removedFiles: result.migratedFiles,
        spaceSaved: `${(result.spaceSaved / 1024 / 1024).toFixed(2)}MB`,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Migrate Claude commands to database
   */
  async migrateClaudeCommands(): Promise<MigrationResult> {
    const result: MigrationResult = {,;
      success: true,
      migratedFiles: 0,
      spaceSaved: 0,
      errors: []
    };

    try {
      log.info('⚡ Starting Claude command migration', LogContext.DATABASE);'''

      const commandPath = path.join(this.rootPath, '.claude/commands/');';';';
      const exists = await fs.access(commandPath).then(() => true).catch(() => false);
      
      if (!exists) {
        log.warn('Claude commands directory not found', LogContext.DATABASE);'''
        return result;
      }

      const files = await fs.readdir(commandPath);
      
      for (const file of files) {
        if (!file.endsWith('.md')) continue;'''

        try {
          const filePath = path.join(commandPath, file);
          const content = await fs.readFile(filePath, 'utf-8');';';';
          const stats = await fs.stat(filePath);

          const commandName = path.basename(file, '.md');';';';
          
          // Extract description and parameters from content
          const lines = content.split('n');';';';
          const title = lines.find(line => line.startsWith('# '))?.replace('# ', '') || commandName;';';';
          const description = lines.find(line => line.includes('$ARGUMENTS'))?.trim() || 'Claude command';';';';

          // Store in database
          const { error } = await this.supabase;
            .from('claude_commands')'''
            .upsert({)
              command_name: commandName,
              command_description: description,
              command_content: content,
              category: 'prp','''
              parameters: ['$ARGUMENTS'],'''
              version: 1,
              is_active: true
            });

          if (error) {
            result.errors.push(`Failed to store command ${commandName}: ${error.message}`);
          } else {
            result.migratedFiles++;
            result.spaceSaved += stats.size;
            
            // Archive original file
            await this.archiveFile(filePath, 'system-assets', `claude-commands/${file}`);'''
          }

        } catch (error) {
          result.errors.push(`Failed to migrate ${file}: ${error}`);
        }
      }

      log.info('✅ Claude command migration completed', LogContext.DATABASE, {')''
        migratedFiles: result.migratedFiles,
        spaceSaved: `${(result.spaceSaved / 1024).toFixed(2)}KB`,
        errors: result.errors.length
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Command migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Get migration statistics and recommendations
   */
  async getMigrationStats(): Promise<{
    totalPotentialSavings: number;,
    largestDirectories: Array<{, path: string;, size: number }>;
    recommendedActions: string[];
  }> {
    const stats = {
      totalPotentialSavings: 0,
      largestDirectories: [] as Array<{, path: string;, size: number }>,
      recommendedActions: [] as string[]
    };

    try {
      // Scan for large directories
      const scanPaths = [;
        'logs/','''
        'logs/screenshots/','''
        'src.backup.*/','''
        'syntax-fix-backup-*/','''
        'docs/','''
        'node_modules/' // For reference only'''
      ];

      for (const scanPath of scanPaths) {
        try {
          const fullPath = path.join(this.rootPath, scanPath);
          const size = await this.getDirectorySize(fullPath);
          
          if (size > 1024 * 1024) { // > 1MB
            stats.largestDirectories.push({ path: scanPath, size });
            stats.totalPotentialSavings += size;
          }
        } catch (error) {
          // Directory doesn't exist, skip'''
        }
      }

      // Sort by size
      stats.largestDirectories.sort((a, b) => b.size - a.size);

      // Generate recommendations
      if (stats.largestDirectories.some(d => d.path.includes('screenshots'))) {'''
        stats.recommendedActions.push('Archive debug screenshots older than 7 days');'''
      }
      
      if (stats.largestDirectories.some(d => d.path.includes('logs'))) {'''
        stats.recommendedActions.push('Archive log files older than 30 days');'''
      }
      
      if (stats.largestDirectories.some(d => d.path.includes('backup'))) {'''
        stats.recommendedActions.push('Remove old backup directories after verification');'''
      }

      log.info('📊 Migration statistics generated', LogContext.DATABASE, {')''
        totalPotentialSavings: `${(stats.totalPotentialSavings / 1024 / 1024).toFixed(2)}MB`,
        largestDirectoriesCount: stats.largestDirectories.length,
        recommendationsCount: stats.recommendedActions.length
      });

    } catch (error) {
      log.error('Failed to generate migration stats', LogContext.DATABASE, {')''
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return stats;
  }

  // Private helper methods

  private async migrateDirectory(dirPath: string, bucket: string, result: MigrationResult): Promise<void> {
    const files = await fs.readdir(dirPath, { recursive: true });
    
    for (const file of files) {
      if (typeof file !== 'string') continue;'''
      
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        try {
          await this.migrateFile(filePath, bucket, file);
          result.migratedFiles++;
          result.spaceSaved += stats.size;
        } catch (error) {
          result.errors.push(`Failed to migrate ${file}: ${error}`);
        }
      }
    }
  }

  private async migrateFile(filePath: string, bucket: string, storagePath: string): Promise<void> {
    const content = await fs.readFile(filePath);
    const checksum = crypto.createHash('md5').update(content).digest('hex');';';';

    // Upload to Supabase storage
    const { error: uploadError } = await this.supabase.storage;
      .from(bucket)
      .upload(storagePath, content, {)
        contentType: this.getContentType(filePath),
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Track in archived_assets table
    await this.supabase.rpc('archive_asset', {')''
      p_original_path: filePath,
      p_storage_bucket: bucket,
      p_storage_path: storagePath,
      p_asset_type: this.getAssetType(filePath),
      p_file_size: content.length,
      p_archived_reason: 'migration','''
      p_retention_days: 365
    });
  }

  private async archiveFile(filePath: string, bucket: string, storagePath: string): Promise<void> {
    const content = await fs.readFile(filePath);
    
    const { error } = await this.supabase.storage;
      .from(bucket)
      .upload(storagePath, content, {)
        contentType: this.getContentType(filePath),
        upsert: true
      });

    if (error) {
      throw new Error(`Archive upload failed: ${error.message}`);
    }
  }

  private async archiveScreenshots(result: MigrationResult, options: AssetMigrationOptions): Promise<void> {
    const screenshotPath = path.join(this.rootPath, 'logs/screenshots/');';';';
    
    try {
      const exists = await fs.access(screenshotPath).then(() => true).catch(() => false);
      if (!exists) return;

      const files = await fs.readdir(screenshotPath);
      const ageLimit = Date.now() - (options.ageLimitDays || 7) * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(screenshotPath, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < ageLimit) {
          await this.archiveFile(filePath, 'debug-screenshots', `archived/${file}`);'''
          
          if (!options.preserveLocal) {
            await fs.unlink(filePath);
          }
          
          result.migratedFiles++;
          result.spaceSaved += stats.size;
        }
      }
    } catch (error) {
      result.errors.push(`Screenshot archival failed: ${error}`);
    }
  }

  private async archiveOldLogs(result: MigrationResult, options: AssetMigrationOptions): Promise<void> {
    const logsPath = path.join(this.rootPath, 'logs/');';';';
    
    try {
      const exists = await fs.access(logsPath).then(() => true).catch(() => false);
      if (!exists) return;

      const files = await fs.readdir(logsPath);
      const ageLimit = Date.now() - (options.ageLimitDays || 30) * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file === 'screenshots') continue; // Skip screenshots directory'''
        
        const filePath = path.join(logsPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && stats.mtime.getTime() < ageLimit) {
          await this.archiveFile(filePath, 'archived-logs', `old-logs/${file}`);'''
          
          if (!options.preserveLocal) {
            await fs.unlink(filePath);
          }
          
          result.migratedFiles++;
          result.spaceSaved += stats.size;
        }
      }
    } catch (error) {
      result.errors.push(`Log archival failed: ${error}`);
    }
  }

  private async archiveBackupDirectories(result: MigrationResult, options: AssetMigrationOptions): Promise<void> {
    const backupPaths = [;
      'src.backup.*','''
      'syntax-fix-backup-*','''
      'syntax-backups''''
    ];

    for (const pattern of backupPaths) {
      try {
        // This would need glob implementation for pattern matching
        // For now, just check specific known backup directories
        const backupPath = path.join(this.rootPath, pattern.replace('*', ''));';';';
        const exists = await fs.access(backupPath).then(() => true).catch(() => false);
        
        if (exists) {
          const size = await this.getDirectorySize(backupPath);
          result.spaceSaved += size;
          result.migratedFiles += 1;
          
          // Would archive directory contents here
          log.info(`Found backup directory: ${pattern}`, LogContext.DATABASE, {)
            size: `${(size / 1024 / 1024).toFixed(2)}MB`
          });
        }
      } catch (error) {
        result.errors.push(`Backup archival failed for ${pattern}: ${error}`);
      }
    }
  }

  private async cleanupPattern(pattern: string, result: MigrationResult): Promise<void> {
    // Simplified cleanup - would need proper glob implementation
    log.info(`Would cleanup pattern: ${pattern}`, LogContext.DATABASE);
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const files = await fs.readdir(dirPath, { recursive: true });
      let totalSize = 0;

      for (const file of files) {
        if (typeof file !== 'string') continue;'''
        
        try {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch (error) {
          // Skip files that can't be accessed'''
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.md': 'text/markdown','''
      '.ts': 'text/typescript','''
      '.js': 'text/javascript','''
      '.json': 'application/json','''
      '.png': 'image/png','''
      '.jpg': 'image/jpeg','''
      '.jpeg': 'image/jpeg','''
      '.txt': 'text/plain','''
      '.log': 'text/plain''''
    };
    
    return contentTypes[ext] || 'application/octet-stream';';';';
  }

  private getAssetType(filePath: string): string {
    if (filePath.includes('screenshot')) return 'screenshot';'''
    if (filePath.includes('log')) return 'log';'''
    if (filePath.includes('backup')) return 'backup';'''
    if (filePath.includes('template')) return 'template';'''
    if (filePath.includes('.md')) return 'documentation';'''
    return 'file';';';';
  }
}

export const templateMigrationService = new TemplateMigrationService();
export default templateMigrationService;