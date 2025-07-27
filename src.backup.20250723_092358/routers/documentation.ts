import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { validateRequest } from '../schemas/api-schemas';

// Request schemas
const SearchDocsSchema = z.object({
  query: z.string().min(1).max(500),
  category: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(10),
});

const GetFeatureDocsSchema = z.object({
  category: z.string().optional(),
  includeExamples: z.boolean().default(true),
});

const GetIntegrationPatternsSchema = z.object({
  language: z.string().optional(),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
});

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

      if (error: throw error;

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
    } catch (error: any) {
      logger.error('Error searching code snippets:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'Failed to search code snippets',
          details: error.message,
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

      if (error: throw error;

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
    } catch (error: any) {
      logger.error('Error fetching Supabase features:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch Supabase feature documentation',
          details: error.message,
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

        if (error: throw error;

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
      } catch (error: any) {
        logger.error('Error fetching integration patterns:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: 'Failed to fetch integration patterns',
            details: error.message,
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
    } catch (error: any) {
      logger.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch categories',
          details: error.message,
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

      if (error: {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Code example not found',
            },
          });
        }
        throw error;
      }

      res.json({
        success: true,
        data: { example: data },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching code example:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch code example',
          details: error.message,
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

      if (error: throw error;

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
    } catch (error: any) {
      logger.error('Error fetching popular snippets:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch popular snippets',
          details: error.message,
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

      if (error: throw error;

      res.json({
        success: true,
        data: { snippet },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Error creating code snippet:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create code snippet',
          details: error.message,
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
            error: {
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
    } catch (error: any) {
      logger.error('Error fetching quickstart guide:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch quickstart guide',
          details: error.message,
        },
      });
    }
  });

  return router;
}
