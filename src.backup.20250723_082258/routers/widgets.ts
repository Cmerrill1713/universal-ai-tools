/* eslint-disable no-undef */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { getValidationMiddleware } from '../middleware/validation';
import type { SupabaseClient } from '@supabase/supabase-js';

export const WidgetsRouter = (supabase: SupabaseClient) => {
  const router = Router();

  // Widget schema for validation
  const WidgetSchema = z.object({
    metadata: z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500),
      tags: z.array(z.string()).default([]),
      version: z
        .string()
        .regex(/^\d+\.\d+\.\d+$/)
        .default('1.0.0'),
      author: z.string().optional(),
    }),
    code: z.string().min(1),
    dependencies: z.record(z.string()).default({}),
    props: z.record(z.any()).default({}),
  });

  const WidgetUpdateSchema = WidgetSchema.partial();

  // Get all widgets (with pagination and filtering)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        limit = '20',
        search = '',
        tags = '',
        isPublic = 'false',
        isTemplate = 'false',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('widgets')
        .select('*, user:auth.users(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (tags) {
        const tagArray = (tags as string).split(',').filter((t) => t);
        if (tagArray.length > 0) {
          query = query.contains('tags', tagArray);
        }
      }

      if (isPublic === 'true') {
        query = query.eq('is_public', true);
      }

      if (isTemplate === 'true') {
        query = query.eq('is_template', true);
      }

      const { data, _error count } = await query;

      if (_error {
        throw _error;
      }

      res.json({
        widgets: data || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (_error) {
      console._error'Error fetching widgets:', _error;
      res.status(500).json({ _error 'Failed to fetch widgets' });
    }
  });

  // Get single widget by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get widget with stats
      const [widgetResult, statsResult] = await Promise.all([
        supabase
          .from('widgets')
          .select('*, user:auth.users(email), versions:widget_versions(*)')
          .eq('id', id)
          .single(),
        supabase.rpc('get_widget_stats', { widget_id: id }),
      ]);

      if (widgetResult._error {
        if (widgetResult._errorcode === 'PGRST116') {
          return res.status(404).json({ _error 'Widget not found' });
        }
        throw widgetResult._error
      }

      res.json({
        ...(widgetResult.data || {}),
        stats: statsResult.data?.[0] || {
          likes_count: 0,
          comments_count: 0,
          versions_count: 0,
          shares_count: 0,
        },
      });
    } catch (_error) {
      console._error'Error fetching widget:', _error;
      res.status(500).json({ _error 'Failed to fetch widget' });
    }
  });

  // Create new widget
  router.post('/', getValidationMiddleware(WidgetSchema), async (req: Request, res: Response) => {
    try {
      const widgetData = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ _error 'User not authenticated' });
      }

      // Insert widget
      const { data, _error} = await supabase
        .from('widgets')
        .insert({
          user_id: userId,
          name: widgetData.metadata.name,
          description: widgetData.metadata.description,
          code: widgetData.code,
          dependencies: widgetData.dependencies,
          props: widgetData.props,
          tags: widgetData.metadata.tags,
          version: widgetData.metadata.version,
        })
        .select()
        .single();

      if (_error {
        throw _error;
      }

      // Create initial version
      await supabase.from('widget_versions').insert({
        widget_id: data.id,
        version_number: widgetData.metadata.version,
        code: widgetData.code,
        dependencies: widgetData.dependencies,
        props: widgetData.props,
        changelog: 'Initial version',
        created_by: userId,
      });

      res.status(201).json(data);
    } catch (_error) {
      console._error'Error creating widget:', _error;
      res.status(500).json({ _error 'Failed to create widget' });
    }
  });

  // Update widget
  router.put(
    '/:id',
    getValidationMiddleware(WidgetUpdateSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        const userId = (req as any).user?.id;

        // Check ownership or edit permission
        const { data: widget } = await supabase
          .from('widgets')
          .select('user_id')
          .eq('id', id)
          .single();

        if (!widget) {
          return res.status(404).json({ _error 'Widget not found' });
        }

        // Update widget
        const updateData: any = {};
        if (updates.metadata) {
          if (updates.metadata.name) updateData.name = updates.metadata.name;
          if (updates.metadata.description) updateData.description = updates.metadata.description;
          if (updates.metadata.tags) updateData.tags = updates.metadata.tags;
          if (updates.metadata.version) updateData.version = updates.metadata.version;
        }
        if (updates.code !== undefined) updateData.code = updates.code;
        if (updates.dependencies !== undefined) updateData.dependencies = updates.dependencies;
        if (updates.props !== undefined) updateData.props = updates.props;

        const { data, _error} = await supabase
          .from('widgets')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (_error {
          throw _error;
        }

        // Create new version if code changed
        if (updates.code && updates.metadata?.version) {
          await supabase.from('widget_versions').insert({
            widget_id: id,
            version_number: updates.metadata.version,
            code: updates.code,
            dependencies: updates.dependencies || data.dependencies,
            props: updates.props || data.props,
            changelog: updates.changelog || 'Updated version',
            created_by: userId,
          });
        }

        res.json(data);
      } catch (_error) {
        console._error'Error updating widget:', _error;
        res.status(500).json({ _error 'Failed to update widget' });
      }
    }
  );

  // Delete widget
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { _error} = await supabase.from('widgets').delete().eq('id', id);

      if (_error {
        throw _error;
      }

      res.json({ message: 'Widget deleted successfully' });
    } catch (_error) {
      console._error'Error deleting widget:', _error;
      res.status(500).json({ _error 'Failed to delete widget' });
    }
  });

  // Fork widget
  router.post('/:id/fork', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ _error 'User not authenticated' });
      }

      const { data, _error} = await supabase.rpc('fork_widget', {
        source_widget_id: id,
      });

      if (_error {
        throw _error;
      }

      if (!data) {
        return res.status(404).json({ _error 'Widget not found or not accessible' });
      }

      res.status(201).json({ id: data, message: 'Widget forked successfully' });
    } catch (_error) {
      console._error'Error forking widget:', _error;
      res.status(500).json({ _error 'Failed to fork widget' });
    }
  });

  // Like/Unlike widget
  router.post('/:id/like', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ _error 'User not authenticated' });
      }

      // Check if already liked
      const { data: existing } = await supabase
        .from('widget_likes')
        .select('*')
        .eq('widget_id', id)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Unlike
        const { _error} = await supabase
          .from('widget_likes')
          .delete()
          .eq('widget_id', id)
          .eq('user_id', userId);

        if (_error throw _error;

        res.json({ liked: false });
      } else {
        // Like
        const { _error} = await supabase
          .from('widget_likes')
          .insert({ widget_id: id, user_id: userId });

        if (_error throw _error;

        res.json({ liked: true });
      }
    } catch (_error) {
      console._error'Error toggling like:', _error;
      res.status(500).json({ _error 'Failed to toggle like' });
    }
  });

  // Get widget comments
  router.get('/:id/comments', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { data, _error} = await supabase
        .from('widget_comments')
        .select('*, user:auth.users(email)')
        .eq('widget_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (_error {
        throw _error;
      }

      res.json(data || []);
    } catch (_error) {
      console._error'Error fetching comments:', _error;
      res.status(500).json({ _error 'Failed to fetch comments' });
    }
  });

  // Add comment
  router.post('/:id/comments', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { _content parent_id } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ _error 'User not authenticated' });
      }

      if (!_content|| typeof _content!== 'string' || _contenttrim().length === 0) {
        return res.status(400).json({ _error 'Comment _contentis required' });
      }

      const { data, _error} = await supabase
        .from('widget_comments')
        .insert({
          widget_id: id,
          user_id: userId,
          _content _contenttrim(),
          parent_id,
        })
        .select('*, user:auth.users(email)')
        .single();

      if (_error {
        throw _error;
      }

      res.status(201).json(data);
    } catch (_error) {
      console._error'Error adding comment:', _error;
      res.status(500).json({ _error 'Failed to add comment' });
    }
  });

  return router;
};

export default WidgetsRouter;
