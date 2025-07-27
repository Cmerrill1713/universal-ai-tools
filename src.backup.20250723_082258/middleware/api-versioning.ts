import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Extend Express Request type
declare module 'express' {
  interface Request {
    apiVersion?: string;
  }
}

// Version configuration schema
const VersionConfigSchema = z.object({
  version: z.string().regex(/^v\d+$/),
  active: z.boolean(),
  deprecated: z.boolean().default(false),
  deprecationDate: z.string().optional(),
  sunsetDate: z.string().optional(),
  changes: z.array(z.string()).optional(),
});

export interface ApiVersion {
  version: string;
  active: boolean;
  deprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  changes?: string[];
}

export interface VersionedRequest extends Request {
  apiVersion?: string;
  deprecationWarning?: string;
}

export class ApiVersioningMiddleware {
  private versions: Map<string, ApiVersion> = new Map();
  private defaultVersion = 'v1';
  private latestVersion = 'v1';

  constructor() {
    this.initializeVersions();
  }

  private initializeVersions() {
    // Define API versions
    const versions: ApiVersion[] = [
      {
        version: 'v1',
        active: true,
        deprecated: false,
        changes: ['Initial API version', 'All endpoints available under /api/v1/'],
      },
      // Future versions can be added here
      // {
      //   version: 'v2',
      //   active: false,
      //   deprecated: false,
      //   changes: [
      //     'Breaking change: Modified response format',
      //     'New feature: Advanced agent capabilities'
      //   ]
      // }
    ];

    versions.forEach((v) => {
      this.versions.set(v.version, v);
    });

    // Find latest active version
    const activeVersions = Array.from(this.versions.values())
      .filter((v) => v.active)
      .sort((a, b) => {
        const aNum = parseInt(a.version.slice(1, 10));
        const bNum = parseInt(b.version.slice(1, 10));
        return bNum - aNum;
      });

    if (activeVersions.length > 0) {
      this.latestVersion = activeVersions[0].version;
    }
  }

  /**
   * Version detection middleware
   * Extracts API version from URL path or headers
   */
  versionDetection() {
    return (req: VersionedRequest, res: Response, next: NextFunction) => {
      let version: string | undefined;

      // Check URL path for version
      const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
      if (pathMatch) {
        version = pathMatch[1];
      }

      // Check Accept header for version (API version in media type)
      const acceptHeader = req.get('Accept');
      if (!version && acceptHeader) {
        const versionMatch = acceptHeader.match(
          /application\/vnd\.universal-ai-tools\.(v\d+)\+json/
        );
        if (versionMatch) {
          version = versionMatch[1];
        }
      }

      // Check custom header for version
      if (!version) {
        const apiVersionHeader = req.get('X-API-Version');
        if (apiVersionHeader && apiVersionHeader.match(/^v\d+$/)) {
          version = apiVersionHeader;
        }
      }

      // Use default version if none specified
      if (!version) {
        version = this.defaultVersion;
      }

      // Validate version
      const versionInfo = this.versions.get(version);
      if (!versionInfo) {
        return res.status(400).json({
          success: false,
          _error {
            code: 'INVALID_API_VERSION',
            message: `API version ${version} is not supported`,
            supportedVersions: Array.from(this.versions.keys()),
            latestVersion: this.latestVersion,
          },
        });
      }

      if (!versionInfo.active) {
        return res.status(410).json({
          success: false,
          _error {
            code: 'VERSION_NOT_ACTIVE',
            message: `API version ${version} is no longer active`,
            latestVersion: this.latestVersion,
            sunsetDate: versionInfo.sunsetDate,
          },
        });
      }

      // Set version on request
      req.apiVersion = version;

      // Add deprecation warning if applicable
      if (versionInfo.deprecated) {
        const warning = `API version ${version} is deprecated and will be sunset on ${versionInfo.sunsetDate}. Please upgrade to ${this.latestVersion}.`;
        req.deprecationWarning = warning;
        res.set('X-API-Deprecation-Warning', warning);
        res.set('X-API-Sunset-Date', versionInfo.sunsetDate?.toISOString() || '');
      }

      // Add version headers to response
      res.set('X-API-Version', version);
      res.set('X-API-Latest-Version', this.latestVersion);

      next();
    };
  }

  /**
   * Version routing middleware
   * Routes requests to appropriate version handlers
   */
  versionRouter() {
    const router = Router();

    // Version info endpoint
    router.get('/versions', (req, res) => {
      const versions = Array.from(this.versions.values()).map((v) => ({
        version: v.version,
        active: v.active,
        deprecated: v.deprecated,
        deprecationDate: v.deprecationDate?.toISOString(),
        sunsetDate: v.sunsetDate?.toISOString(),
        changes: v.changes,
      }));

      res.json({
        success: true,
        currentVersion: req.apiVersion || this.defaultVersion,
        defaultVersion: this.defaultVersion,
        latestVersion: this.latestVersion,
        versions,
      });
    });

    return router;
  }

  /**
   * URL rewriting middleware
   * Rewrites non-versioned API paths to include version prefix
   */
  urlRewriter() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip if already has version in path
      if (req.path.match(/^\/api\/v\d+\//)) {
        return next();
      }

      // Skip non-API paths
      if (!req.path.startsWith('/api/')) {
        return next();
      }

      // Skip special endpoints that should not be versioned
      const unversionedPaths = [
        '/api/docs',
        '/api/register',
        '/api/versions',
        '/api/health',
        '/api/config',
        '/api/config/health',
        '/metrics',
      ];

      if (unversionedPaths.includes(req.path)) {
        return next();
      }

      // Rewrite URL to include version
      const version = (req as VersionedRequest).apiVersion || this.defaultVersion;
      const newPath = req.path.replace(/^\/api/, `/api/${version}`);

      logger.debug(`Rewriting API path from ${req.path} to ${newPath}`);
      req.url = newPath + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');

      next();
    };
  }

  /**
   * Version compatibility middleware
   * Handles backward compatibility between versions
   */
  compatibilityHandler() {
    return (req: VersionedRequest, res: Response, next: NextFunction) => {
      const version = req.apiVersion || this.defaultVersion;

      // Add response transformation based on version
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        // Transform response based on API version
        const transformedData = transformResponse(data, version);

        // Add metadata
        if (typeof transformedData === 'object' && !Array.isArray(transformedData)) {
          transformedData.metadata = {
            ...transformedData.metadata,
            apiVersion: version,
            timestamp: new Date().toISOString(),
          };

          // Add deprecation warning to response if applicable
          if (req.deprecationWarning) {
            transformedData.metadata.deprecationWarning = req.deprecationWarning;
          }
        }

        return originalJson(transformedData);
      };

      next();
    };
  }

  /**
   * Version negotiation middleware
   * Handles _contentnegotiation for API versions
   */
  contentNegotiation() {
    return (req: VersionedRequest, res: Response, next: NextFunction) => {
      const acceptHeader = req.get('Accept');

      if (acceptHeader && acceptHeader.includes('application/vnd.universal-ai-tools')) {
        // Set appropriate _contenttype based on version
        const version = req.apiVersion || this.defaultVersion;
        res.type(`application/vnd.universal-ai-tools.${version}+json`);
      } else {
        res.type('application/json');
      }

      next();
    };
  }

  /**
   * Get version information
   */
  getVersionInfo(version: string): ApiVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Add a new version
   */
  addVersion(version: ApiVersion): void {
    const validated = VersionConfigSchema.parse(version);
    this.versions.set(validated.version, {
      ...validated,
      deprecationDate: validated.deprecationDate ? new Date(validated.deprecationDate) : undefined,
      sunsetDate: validated.sunsetDate ? new Date(validated.sunsetDate) : undefined,
    });

    // Update latest version if needed
    if (validated.active) {
      const currentLatestNum = parseInt(this.latestVersion.slice(1, 10));
      const newVersionNum = parseInt(validated.version.slice(1, 10));
      if (newVersionNum > currentLatestNum) {
        this.latestVersion = validated.version;
      }
    }
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(version: string, sunsetDate: Date): void {
    const versionInfo = this.versions.get(version);
    if (versionInfo) {
      versionInfo.deprecated = true;
      versionInfo.deprecationDate = new Date();
      versionInfo.sunsetDate = sunsetDate;
      logger.warn(
        `API version ${version} has been deprecated. Sunset date: ${sunsetDate.toISOString()}`
      );
    }
  }

  /**
   * Deactivate a version
   */
  deactivateVersion(version: string): void {
    const versionInfo = this.versions.get(version);
    if (versionInfo) {
      versionInfo.active = false;
      logger.warn(`API version ${version} has been deactivated`);
    }
  }
}

/**
 * Transform response data based on API version
 * This function handles backward compatibility transformations
 */
function transformResponse(data: any, version: string): any {
  // V1 is the base version, no transformation needed
  if (version === 'v1') {
    return data;
  }

  // Future version transformations would go here
  // Example for v2:
  // if (version === 'v2') {
  //   // Transform v1 response to v2 format
  //   if (data.memories) {
  //     data.memoryItems = data.memories;
  //     delete data.memories;
  //   }
  // }

  return data;
}

/**
 * Create versioned router wrapper
 * Wraps existing routers to support versioning
 */
export function createVersionedRouter(baseRouter: Router, version = 'v1'): Router {
  const versionedRouter = Router();

  // Mount base router under version path
  versionedRouter.use(`/${version}`, baseRouter);

  return versionedRouter;
}

/**
 * Version-specific _errorhandler
 */
export function versionedErrorHandler(version: string) {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error`API ${version} _error`, err);

    const errorResponse: any = {
      success: false,
      _error {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An internal _erroroccurred' : err.message,
      },
      metadata: {
        apiVersion: version,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-_requestid'] || 'unknown',
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      errorResponse._errorstack = err.stack;
    }

    res.status(500).json(errorResponse);
  };
}

// Export singleton instance
export const apiVersioning = new ApiVersioningMiddleware();
