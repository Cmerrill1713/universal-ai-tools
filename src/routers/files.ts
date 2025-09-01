import express, { type Request, type Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponseMiddleware } from '../utils/api-response';
import authenticate from '../middleware/auth';
import { fileManagementService } from '../services/file-management-service';

const router = express.Router();

router.use(apiResponseMiddleware);
router.use(authenticate);

/**
 * Get file management service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    log.info('📊 File management status requested', LogContext.API);
    
    const status = fileManagementService.getServiceStatus();
    
    const response = {
      service: 'file-management',
      status: 'active',
      version: '2.4.0',
      capabilities: [
        'natural-language-search',
        'smart-organization',
        'voice-integration',
        'content-indexing',
        'tag-management'
      ],
      ...status
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ Failed to get file management status', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get file management status', 500);
  }
});

/**
 * Search files with natural language
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      fileType, 
      dateRange, 
      sizeRange, 
      tags, 
      includeContent = false,
      maxResults = 20 
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.sendError('VALIDATION_ERROR', 'Search query is required', 400);
    }

    log.info('🔍 File search request', LogContext.API, {
      query,
      fileType,
      includeContent,
      maxResults
    });

    const searchQuery = {
      query,
      fileType,
      dateRange: dateRange ? {
        from: new Date(dateRange.from),
        to: new Date(dateRange.to)
      } : undefined,
      sizeRange,
      tags,
      includeContent,
      maxResults
    };

    const results = await fileManagementService.searchFiles(searchQuery);

    const response = {
      query: searchQuery.query,
      results: results.map(result => ({
        file: {
          id: result.item.id,
          name: result.item.name,
          path: result.item.path,
          type: result.item.type,
          size: result.item.size,
          mimeType: result.item.mimeType,
          lastModified: result.item.lastModified,
          tags: result.item.tags
        },
        relevanceScore: result.relevanceScore,
        matchReason: result.matchReason,
        snippet: result.snippet
      })),
      totalResults: results.length,
      searchTime: Date.now()
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ File search failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'File search failed', 500);
  }
});

/**
 * Voice-optimized file search for Nari Dia
 */
router.post('/voice/search', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.sendError('VALIDATION_ERROR', 'Voice command is required', 400);
    }

    log.info('🎙️ Voice file search', LogContext.API, { command });

    const voiceCommand = await fileManagementService.processVoiceFileCommand(command);
    const response = await fileManagementService.executeVoiceFileCommand(voiceCommand);

    const voiceResponse = {
      originalCommand: command,
      intent: voiceCommand.intent,
      confidence: voiceCommand.confidence,
      response,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(voiceResponse);
  } catch (error) {
    log.error('❌ Voice file search failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice file search failed', 500);
  }
});

/**
 * Get recent files
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    log.info('📅 Recent files request', LogContext.API, { limit });

    const recentFiles = await fileManagementService.getRecentFiles(limit);

    const response = {
      files: recentFiles.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        mimeType: file.mimeType,
        lastModified: file.lastModified,
        tags: file.tags
      })),
      count: recentFiles.length,
      limit
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ Failed to get recent files', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get recent files', 500);
  }
});

/**
 * Voice-optimized recent files for Nari Dia
 */
router.get('/voice/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    log.info('🎤 Voice recent files request', LogContext.API, { limit });

    const recentFiles = await fileManagementService.getRecentFiles(limit);

    let response = '';
    if (recentFiles.length === 0) {
      response = "I couldn't find any recently modified files.";
    } else {
      response = `Here are your ${recentFiles.length} most recent files: `;
      response += recentFiles
        .slice(0, 5)
        .map(file => file.name.replace(/\.(ts|js|py|cpp)/, ' dot $1'))
        .join(', ');
      
      if (recentFiles.length > 5) {
        response += ` and ${recentFiles.length - 5} more files.`;
      }
    }

    const voiceResponse = {
      response,
      files: recentFiles.map(file => ({
        name: file.name,
        path: file.path,
        lastModified: file.lastModified
      })),
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(voiceResponse);
  } catch (error) {
    log.error('❌ Voice recent files failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice recent files failed', 500);
  }
});

/**
 * Get large files
 */
router.get('/large', async (req: Request, res: Response) => {
  try {
    const minSizeMB = parseInt(req.query.minSize as string) || 10;

    log.info('📦 Large files request', LogContext.API, { minSizeMB });

    const largeFiles = await fileManagementService.getLargeFiles(minSizeMB);

    const response = {
      files: largeFiles.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path,
        size: file.size,
        mimeType: file.mimeType,
        lastModified: file.lastModified,
        tags: file.tags
      })),
      count: largeFiles.length,
      minSizeMB
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ Failed to get large files', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get large files', 500);
  }
});

/**
 * Voice-optimized large files
 */
router.get('/voice/large', async (req: Request, res: Response) => {
  try {
    const minSizeMB = parseInt(req.query.minSize as string) || 50;

    log.info('🎤 Voice large files request', LogContext.API, { minSizeMB });

    const largeFiles = await fileManagementService.getLargeFiles(minSizeMB);

    let response = '';
    if (largeFiles.length === 0) {
      response = `I couldn't find any files larger than ${minSizeMB} megabytes.`;
    } else {
      const totalSize = largeFiles.reduce((sum, file) => sum + (file.size || 0), 0);
      const totalSizeMB = Math.round(totalSize / (1024 * 1024));
      
      response = `I found ${largeFiles.length} large files taking up ${totalSizeMB} megabytes. `;
      response += `The largest files are: `;
      response += largeFiles
        .slice(0, 3)
        .map(file => {
          const sizeMB = Math.round((file.size || 0) / (1024 * 1024));
          return `${file.name.replace(/\.(ts|js|py|cpp)/, ' dot $1')} at ${sizeMB} megabytes`;
        })
        .join(', ');
    }

    const voiceResponse = {
      response,
      files: largeFiles.slice(0, 10).map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        sizeMB: Math.round((file.size || 0) / (1024 * 1024))
      })),
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(voiceResponse);
  } catch (error) {
    log.error('❌ Voice large files failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice large files failed', 500);
  }
});

/**
 * Smart file organization
 */
router.post('/organize', async (req: Request, res: Response) => {
  try {
    const { strategy, rules, dryRun = true } = req.body;

    if (!strategy || !rules) {
      return res.sendError('VALIDATION_ERROR', 'Strategy and rules are required', 400);
    }

    log.info('🤖 Smart file organization', LogContext.API, {
      strategy,
      rulesCount: rules.length,
      dryRun
    });

    const organization = {
      strategy,
      rules: rules.map((rule: any) => ({
        condition: {
          ...rule.condition,
          dateRange: rule.condition.dateRange ? {
            from: new Date(rule.condition.dateRange.from),
            to: new Date(rule.condition.dateRange.to)
          } : undefined
        },
        action: rule.action
      })),
      dryRun
    };

    const result = await fileManagementService.smartOrganize(organization);

    const response = {
      strategy,
      dryRun,
      operations: result.preview,
      totalOperations: result.preview.length,
      applied: result.applied
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ Smart file organization failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Smart file organization failed', 500);
  }
});

/**
 * Voice-optimized file organization
 */
router.post('/voice/organize', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.sendError('VALIDATION_ERROR', 'Voice command is required', 400);
    }

    log.info('🎙️ Voice file organization', LogContext.API, { command });

    let response = '';
    const commandLower = command.toLowerCase();
    
    if (commandLower.includes('date') || commandLower.includes('time')) {
      response = "I can organize your files by date. Would you like me to group them by year, month, or create folders for recent, old, and archived files?";
    } else if (commandLower.includes('type') || commandLower.includes('extension')) {
      response = "I can organize your files by type. I'll create folders for documents, images, code files, media, and other categories. Should I proceed?";
    } else if (commandLower.includes('size')) {
      response = "I can organize your files by size into small, medium, and large folders. Large files over 50 megabytes will be moved to a separate folder for easier management.";
    } else if (commandLower.includes('project')) {
      response = "I can organize your files by project. I'll group related files based on their location and naming patterns. This works well for code projects and document collections.";
    } else {
      response = "I can help organize your files by date, file type, size, or project. Which organization method would you prefer?";
    }

    const voiceResponse = {
      originalCommand: command,
      response,
      organizationOptions: [
        'by date (year, month, recent)',
        'by file type (documents, images, code)',
        'by size (small, medium, large)',
        'by project (group related files)'
      ],
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(voiceResponse);
  } catch (error) {
    log.error('❌ Voice file organization failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice file organization failed', 500);
  }
});

/**
 * Refresh file index
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    log.info('🔄 File index refresh requested', LogContext.API);

    await fileManagementService.refreshIndex();

    const status = fileManagementService.getServiceStatus();

    const response = {
      message: 'File index refreshed successfully',
      indexedFiles: status.indexedFiles,
      refreshTime: new Date().toISOString()
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ File index refresh failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'File index refresh failed', 500);
  }
});

/**
 * Get file statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    log.info('📈 File statistics requested', LogContext.API);

    const status = fileManagementService.getServiceStatus();
    const recentFiles = await fileManagementService.getRecentFiles(10);
    const largeFiles = await fileManagementService.getLargeFiles(10);

    const response = {
      summary: {
        totalFiles: status.indexedFiles,
        watchedDirectories: status.watchedDirectories.length,
        recentSearches: status.recentSearches,
        serviceStatus: status.initialized ? 'active' : 'initializing'
      },
      quickAccess: {
        recentFiles: recentFiles.slice(0, 5).map(file => ({
          name: file.name,
          path: file.path,
          lastModified: file.lastModified
        })),
        largeFiles: largeFiles.slice(0, 3).map(file => ({
          name: file.name,
          size: file.size,
          sizeMB: Math.round((file.size || 0) / (1024 * 1024))
        }))
      },
      capabilities: [
        'Natural language file search',
        'Voice-activated file operations',
        'Smart file organization',
        'Content-based search',
        'Tag management',
        'Real-time file indexing'
      ]
    };

    res.sendSuccess(response);
  } catch (error) {
    log.error('❌ Failed to get file statistics', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get file statistics', 500);
  }
});

/**
 * Voice-optimized file statistics
 */
router.get('/voice/stats', async (req: Request, res: Response) => {
  try {
    log.info('🎤 Voice file statistics requested', LogContext.API);

    const status = fileManagementService.getServiceStatus();
    const recentFiles = await fileManagementService.getRecentFiles(5);
    const largeFiles = await fileManagementService.getLargeFiles(50);

    let response = `I'm currently monitoring ${status.indexedFiles} files across ${status.watchedDirectories.length} directories. `;
    
    if (recentFiles.length > 0) {
      response += `Your most recent file is ${recentFiles[0].name.replace(/\.(ts|js|py|cpp)/, ' dot $1')}, `;
      response += `modified ${this.formatDateForVoice(recentFiles[0].lastModified)}. `;
    }
    
    if (largeFiles.length > 0) {
      const totalLargeSizeMB = largeFiles.reduce((sum, file) => sum + Math.round((file.size || 0) / (1024 * 1024)), 0);
      response += `I found ${largeFiles.length} large files using ${totalLargeSizeMB} megabytes of space. `;
    }
    
    response += `I'm ready to help you search, organize, or manage your files.`;

    const voiceResponse = {
      response,
      summary: {
        totalFiles: status.indexedFiles,
        watchedDirectories: status.watchedDirectories.length,
        recentFilesCount: recentFiles.length,
        largeFilesCount: largeFiles.length
      },
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(voiceResponse);
  } catch (error) {
    log.error('❌ Voice file statistics failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice file statistics failed', 500);
  }
});

/**
 * Helper function to format dates for voice
 */
function formatDateForVoice(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours < 1) return 'about an hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default router;