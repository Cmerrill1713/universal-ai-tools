export function DocumentationRouter(supabase: SupabaseClient) {
  const router = Router();

  // Search code snippets
  router.post('/search/snippets', validateRequest(SearchDocsSchema), async (req: any, res) => {
    try {
      const { query, category, language, tags, limit } = req.validatedData;

      const { data, error} = await supabase.rpc('search_code_snippets', {
        search_query: query,
        filter_language: language,
        filter_category: category,
        filter_tags: tags,
        limit_count: limit,
      });

      if (error throw error

      // Increment usage count for returned snippets
      if (data && data.length > 0) {
        await Promise.all(
          data.map((snippet: any) =>
            supabase.rpc('increment_snippet_usage', { snippet_id: snippet.id })
          )
        );
      }

      res.json({
        success: true,
        data: {
          snippets: data || [],
          query,
          count: data?.length || 0,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error searching code snippets:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'SEARCH_ERROR',
          message: 'Failed to search code snippets',
          details: errormessage,
        },
      });
    }
  });

  // Get Supabase feature documentation
  router.get('/supabase/features', validateRequest(GetFeatureDocsSchema), async (req: any, res) => {
    try {
      const { category, includeExamples } = req.validatedData;

      const { data, error} = await supabase.rpc('get_supabase_feature_docs', {
        feature_category: category,
        include_examples: includeExamples,
      });

      if (error throw error

      res.json({
        success: true,
        data: {
          features: data || [],
          category,
          count: data?.length || 0,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching Supabase features:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch Supabase feature documentation',
          details: errormessage,
        },
      });
    }
  });

  // Get integration patterns
  router.get(
    '/integration-patterns',
    validateRequest(GetIntegrationPatternsSchema),
    async (req: any, res) => {
      try {
        const { language, framework, features } = req.validatedData;

        const { data, error} = await supabase.rpc('get_integration_patterns', {
          filter_language: language,
          filter_framework: framework,
          filter_features: features,
        });

        if (error throw error

        res.json({
          success: true,
          data: {
            patterns: data || [],
            filters: { language, framework, features },
            count: data?.length || 0,
          },
          metadata: {
            apiVersion: 'v1',
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error any) {
        logger.error(Error fetching integration patterns:', error;
        res.status(500).json({
          success: false,
          error {
            code: 'FETCH_ERROR',
            message: 'Failed to fetch integration patterns',
            details: errormessage,
          },
        });
      }
    }
  );

  // Get all available categories
  router.get('/categories', async (req, res) => {
    try {
      const { data: features, error featuresError } = await supabase
        .from('supabase_features')
        .select('category')
        .order('category');

      if (featuresError) throw featuresError;

      const categories = [...new Set(features?.map((f) => f.category) || [])];

      const { data: languages, error langError } = await supabase
        .from('ai_code_snippets')
        .select('language')
        .order('language');

      if (langError) throw langError;

      const uniqueLanguages = [...new Set(languages?.map((l) => l.language) || [])];

      res.json({
        success: true,
        data: {
          categories,
          languages: uniqueLanguages,
          frameworks: [
            'React',
            'Vue',
            'Angular',
            'Next.js',
            'Nuxt',
            'SvelteKit',
            'Flutter',
            'React Native',
          ],
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching categories:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch categories',
          details: errormessage,
        },
      });
    }
  });

  // Get specific code example
  router.get('/examples/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error} = await supabase
        .from('ai_code_examples')
        .select('*')
        .eq('id', id)
        .single();

      if (error {
        if (errorcode === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error {
              code: 'NOT_FOUND',
              message: 'Code example not found',
            },
          });
        }
        throw error
      }

      res.json({
        success: true,
        data: { example: data },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching code example:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch code example',
          details: errormessage,
        },
      });
    }
  });

  // Get popular snippets
  router.get('/snippets/popular', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const category = req.query.category as string;

      let query = supabase
        .from('ai_code_snippets')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error} = await query;

      if (error throw error

      res.json({
        success: true,
        data: {
          snippets: data || [],
          count: data?.length || 0,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching popular snippets:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch popular snippets',
          details: errormessage,
        },
      });
    }
  });

  // Submit new code snippet
  router.post('/snippets', async (req: any, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        language: z.string().min(1).max(50),
        code: z.string().min(1),
        category: z.string().optional(),
        subcategory: z.string().optional(),
        tags: z.array(z.string()).optional(),
      });

      const data = schema.parse(req.body);

      const { data: snippet, error} = await supabase
        .from('ai_code_snippets')
        .insert({
          ...data,
          metadata: {
            source: 'user_submission',
            submitted_by: req.aiServiceId,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error throw error

      res.json({
        success: true,
        data: { snippet },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error creating code snippet:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'CREATE_ERROR',
          message: 'Failed to create code snippet',
          details: errormessage,
        },
      });
    }
  });

  // Get Supabase quick start guide
  router.get('/quickstart/:feature', async (req, res) => {
    try {
      const { feature } = req.params;
      const { framework } = req.query;

      // Get feature documentation
      const { data: featureDocs, error featureError } = await supabase
        .from('supabase_features')
        .select('*')
        .eq('feature_name', feature)
        .single();

      if (featureError) {
        if (featureError.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error {
              code: 'NOT_FOUND',
              message: `Feature '${feature}' not found`,
            },
          });
        }
        throw featureError;
      }

      // Get relevant code snippets
      const { data: snippets } = await supabase
        .from('ai_code_snippets')
        .select('*')
        .eq('category', feature)
        .limit(5);

      // Get integration _patternif framework specified
      let _pattern= null;
      if (framework) {
        const { data: patterns } = await supabase
          .from('supabase_integration_patterns')
          .select('*')
          .contains('frameworks', [framework as string])
          .contains('features_used', [feature])
          .limit(1);

        _pattern= patterns?.[0] || null;
      }

      res.json({
        success: true,
        data: {
          feature: featureDocs,
          snippets: snippets || [],
          _pattern
          quickstart: {
            steps: featureDocs.setup_instructions,
            prerequisites: featureDocs.prerequisites,
            bestPractices: featureDocs.best_practices,
          },
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching quickstart guide:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch quickstart guide',
          details: errormessage,
        },
      });
    }
  });

  return router;
}
import type { Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { createClient } from '@supabase/supabase-js';
import { JWTAuthService } from '../middleware/auth-jwt';
import type { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { config } from '../config';
import { securityConfig } from '../config/security';

export class AuthRouter {
  private router: Router;
  private supabase;
  private jwtService: JWTAuthService;

  constructor() {
    this.router = Router();
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    this.jwtService = new JWTAuthService(this.supabase);
    this.setupRoutes();
    this.setupRateLimiting();
  }

  private setupRateLimiting() {
    // Rate limiting for authentication endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: {
        error 'Too many authentication attempts',
        message: 'Please try again later',
        retryAfter: 15 * 60, // 15 minutes in seconds
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Rate limit by IP and email if provided
        const email = req.body?.email || '';
        return `${req.ip}-${email}`;
      },
      skip: (req) => {
        // Skip rate limiting for whitelisted IPs
        return securityConfig.rateLimiting.whitelist.includes(req.ip || '');
      },
    });

    const registerLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 registrations per hour per IP
      message: {
        error 'Too many registration attempts',
        message: 'Please try again later',
        retryAfter: 60 * 60, // 1 hour in seconds
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    const refreshLimiter = rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 refresh attempts per 5 minutes
      message: {
        error 'Too many token refresh attempts',
        message: 'Please try again later',
        retryAfter: 5 * 60, // 5 minutes in seconds
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply rate limiting to specific routes
    this.router.use('/login', authLimiter);
    this.router.use('/register', registerLimiter);
    this.router.use('/refresh', refreshLimiter);
  }

  private setupRoutes() {
    // Input validation middleware
    const validateRegistration = [
      body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
      body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage(
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        ),
      body('firstName')
        .isLength({ min: 1, max: 50 })
        .trim()
        .escape()
        .withMessage('First name is required (max 50 characters)'),
      body('lastName')
        .isLength({ min: 1, max: 50 })
        .trim()
        .escape()
        .withMessage('Last name is required (max 50 characters)'),
    ];

    const validateLogin = [
      body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
      body('password').isLength({ min: 1 }).withMessage('Password is required'),
    ];

    const validateRefresh = [
      body('refreshToken').isLength({ min: 1 }).withMessage('Refresh token is required'),
    ];

    // Routes
    this.router.post('/register', validateRegistration, this.register.bind(this));
    this.router.post('/login', validateLogin, this.login.bind(this));
    this.router.post('/refresh', validateRefresh, this.refresh.bind(this));
    this.router.post(
      '/logout',
      this.jwtService.authenticate() as RequestHandler,
      this.logout.bind(this) as RequestHandler
    );
    this.router.post(
      '/logout-all',
      this.jwtService.authenticate() as RequestHandler,
      this.logoutAll.bind(this) as RequestHandler
    );
    this.router.get(
      '/sessions',
      this.jwtService.authenticate() as RequestHandler,
      this.getSessions.bind(this) as RequestHandler
    );
    this.router.delete(
      '/sessions/:tokenId',
      this.jwtService.authenticate() as RequestHandler,
      this.revokeSession.bind(this) as RequestHandler
    );
    this.router.get(
      '/security-info',
      this.jwtService.authenticate() as RequestHandler,
      this.getSecurityInfo.bind(this) as RequestHandler
    );
    this.router.post(
      '/change-password',
      this.jwtService.authenticate() as RequestHandler,
      this.changePassword.bind(this) as RequestHandler
    );
    this.router.get(
      '/profile',
      this.jwtService.authenticate() as RequestHandler,
      this.getProfile.bind(this) as RequestHandler
    );
  }

  /**
   * User registration
   */
  private async register(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password, firstName, lastName } = req.body;

      // Check rate limiting for this IP
      const rateLimitCheck = this.jwtService.isAuthRateLimited(req.ip || '');
      if (rateLimitCheck.limited) {
        return res.status(429).json({
          error 'Too many failed attempts',
          message: 'Please try again later',
          retryAfter: rateLimitCheck.retryAfter,
        });
      }

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        this.jwtService.recordAuthAttempt(req.ip || '', false);
        return res.status(409).json({
          error 'User already exists',
          message: 'An account with this email already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const { data: user, error} = await this.supabase
        .from('users')
        .insert({
          email,
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          role: 'user',
          is_active: true,
          email_verified: false,
          created_at: new Date(),
        })
        .select('id, email, role')
        .single();

      if (error|| !user) {
        logger.error(User registration failed:', error;
        this.jwtService.recordAuthAttempt(req.ip || '', false);
        return res.status(500).json({
          error 'Registration failed',
          message: 'Unable to create user account',
        });
      }

      // Generate token pair
      const tokens = await this.jwtService.generateTokenPair(user.id, user.email, user.role, req);

      this.jwtService.recordAuthAttempt(req.ip || '', true);

      // Set secure cookie for refresh token in production
      if (config.server.isProduction) {
        res.cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: config.server.isProduction ? undefined : tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });
    } catch (error) {
      logger.error(Registration error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Registration failed due to server error,
      });
    }
  }

  /**
   * User login
   */
  private async login(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Check rate limiting for this IP
      const rateLimitCheck = this.jwtService.isAuthRateLimited(req.ip || '');
      if (rateLimitCheck.limited) {
        return res.status(429).json({
          error 'Too many failed attempts',
          message: 'Please try again later',
          retryAfter: rateLimitCheck.retryAfter,
        });
      }

      // Get user
      const { data: user, error} = await this.supabase
        .from('users')
        .select('id, email, password_hash, role, is_active')
        .eq('email', email)
        .single();

      if (error|| !user) {
        this.jwtService.recordAuthAttempt(req.ip || '', false);
        return res.status(401).json({
          error 'Invalid credentials',
          message: 'Email or password is incorrect',
        });
      }

      if (!user.is_active) {
        this.jwtService.recordAuthAttempt(req.ip || '', false);
        return res.status(401).json({
          error 'Account disabled',
          message: 'Your account has been disabled',
        });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        this.jwtService.recordAuthAttempt(req.ip || '', false);
        return res.status(401).json({
          error 'Invalid credentials',
          message: 'Email or password is incorrect',
        });
      }

      // Generate token pair
      const tokens = await this.jwtService.generateTokenPair(user.id, user.email, user.role, req);

      this.jwtService.recordAuthAttempt(req.ip || '', true);

      // Update last login
      await this.supabase.from('users').update({ last_login: new Date() }).eq('id', user.id);

      // Set secure cookie for refresh token in production
      if (config.server.isProduction) {
        res.cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: config.server.isProduction ? undefined : tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });
    } catch (error) {
      logger.error(Login error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Login failed due to server error,
      });
    }
  }

  /**
   * Refresh access token
   */
  private async refresh(req: Request, res: Response) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error 'Validation failed',
          details: errors.array(),
        });
      }

      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error 'Refresh token required',
          message: 'No refresh token provided',
        });
      }

      // Refresh tokens
      const newTokens = await this.jwtService.refreshAccessToken(refreshToken, req);

      if (!newTokens) {
        return res.status(401).json({
          error 'Invalid refresh token',
          message: 'The refresh token is invalid or expired',
        });
      }

      // Set new secure cookie for refresh token in production
      if (config.server.isProduction) {
        res.cookie('refreshToken', newTokens.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }

      res.json({
        message: 'Token refreshed successfully',
        accessToken: newTokens.accessToken,
        refreshToken: config.server.isProduction ? undefined : newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      });
    } catch (error) {
      logger.error(Token refresh error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Token refresh failed due to server error,
      });
    }
  }

  /**
   * Logout (revoke current session)
   */
  private async logout(req: AuthRequest, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = this.jwtService.verifyAccessToken(token);

        if (payload && payload.jti) {
          await this.jwtService.revokeRefreshToken(req.user!.id, payload.jti);
        }
      }

      // Clear cookie in production
      if (config.server.isProduction) {
        res.clearCookie('refreshToken');
      }

      res.json({
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error(Logout error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Logout failed due to server error,
      });
    }
  }

  /**
   * Logout from all devices
   */
  private async logoutAll(req: AuthRequest, res: Response) {
    try {
      await this.jwtService.revokeAllUserTokens(req.user!.id);

      // Clear cookie in production
      if (config.server.isProduction) {
        res.clearCookie('refreshToken');
      }

      res.json({
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      logger.error(Logout all error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Logout failed due to server error,
      });
    }
  }

  /**
   * Get user sessions
   */
  private async getSessions(req: AuthRequest, res: Response) {
    try {
      const sessions = await this.jwtService.getUserSessions(req.user!.id);

      res.json({
        sessions: sessions.map((session) => ({
          id: session.tokenId,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          isCurrent: false, // You could implement current session detection
        })),
      });
    } catch (error) {
      logger.error(Get sessions error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Failed to retrieve sessions',
      });
    }
  }

  /**
   * Revoke specific session
   */
  private async revokeSession(req: AuthRequest, res: Response) {
    try {
      const { tokenId } = req.params;

      const success = await this.jwtService.revokeSession(req.user!.id, tokenId);

      if (success) {
        res.json({
          message: 'Session revoked successfully',
        });
      } else {
        res.status(404).json({
          error 'Session not found',
          message: 'The specified session could not be found',
        });
      }
    } catch (error) {
      logger.error(Revoke session error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Failed to revoke session',
      });
    }
  }

  /**
   * Get security information
   */
  private async getSecurityInfo(req: AuthRequest, res: Response) {
    try {
      const securityInfo = await this.jwtService.getUserSecurityInfo(req.user!.id);

      res.json({
        activeSessions: securityInfo.sessions.length,
        recentActivity: securityInfo.recentActivity,
        failedAttempts24h: securityInfo.failedAttempts,
        accountStatus: 'active', // You could implement account status logic
      });
    } catch (error) {
      logger.error(Get security info error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Failed to retrieve security information',
      });
    }
  }

  /**
   * Change password
   */
  private async changePassword(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error 'Validation failed',
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = (req as AuthRequest).user!;

      // Get current password hash
      const { data: userData, error} = await this.supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single();

      if (error|| !userData) {
        return res.status(404).json({
          error 'User not found',
          message: 'User account not found',
        });
      }

      // Verify current password
      const passwordValid = await bcrypt.compare(currentPassword, userData.password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          error 'Invalid password',
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      const { error updateError } = await this.supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', user.id);

      if (updateError) {
        logger.error(Password update failed:', updateError);
        return res.status(500).json({
          error 'Password update failed',
          message: 'Unable to update password',
        });
      }

      // Revoke all existing sessions for security
      await this.jwtService.revokeAllUserTokens(user.id);

      res.json({
        message: 'Password changed successfully',
        note: 'All sessions have been logged out for security',
      });
    } catch (error) {
      logger.error(Change password error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Password change failed due to server error,
      });
    }
  }

  /**
   * Get user profile
   */
  private async getProfile(req: AuthRequest, res: Response) {
    try {
      const { data: user, error} = await this.supabase
        .from('users')
        .select('id, email, first_name, last_name, role, created_at, last_login, is_active')
        .eq('id', req.user!.id)
        .single();

      if (error|| !user) {
        return res.status(404).json({
          error 'User not found',
          message: 'User profile not found',
        });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          isActive: user.is_active,
        },
      });
    } catch (error) {
      logger.error(Get profile error', error;
      res.status(500).json({
        error 'Internal server error,
        message: 'Failed to retrieve user profile',
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}

