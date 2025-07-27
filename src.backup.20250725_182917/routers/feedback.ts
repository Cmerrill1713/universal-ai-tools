import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { humanFeedbackService, UserFeedback } from '../services/human-feedback-service';

export function FeedbackRouter(supabase: SupabaseClient) {
  const router = Router();
  const feedbackService = humanFeedbackService(supabase);

  // Submit feedback
  router.post('/submit', async (req: any, res) => {
    try {
      const schema = z.object({
        feedbackId: z.string(),
        requestId: z.string(),
        feedbackType: z.enum(['rating', 'correction', 'preference', 'label']),
        rating: z.number().min(1).max(5).optional(),
        correctedResponse: z.string().optional(),
        preferredResponse: z.string().optional(),
        labels: z.array(z.string()).optional(),
        comments: z.string().optional(),
        userId: z.string().optional();
      });

      const feedbackData = schema.parse(req.body);
      
      const feedback: UserFeedback = {
        ...feedbackData,
        timestamp: new Date(),
      };

      await feedbackService.submitFeedback(feedback);

      res.json({ success: true, message: 'Feedback submitted successfully' });
    } catch (error: any) {
      logger.error('Feedback submission error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Request feedback
  router.post('/request', async (req: any, res) => {
    try {
      const schema = z.object({
        agentId: z.string(),
        requestId: z.string(),
        userRequest: z.string(),
        agentResponse: z.any(),
        feedbackType: z.enum(['rating', 'correction', 'preference', 'label']).optional();
      });

      const data = schema.parse(req.body);
      
      // Check rate limits
      const shouldRequest = await feedbackService.shouldRequestFeedback(
        data.agentId,
        req.userId;
      );

      if (!shouldRequest) {
        return res.json({ ;
          success: false, ;
          message: 'Feedback rate limit reached' ;
        });
      }

      const feedbackRequest = await feedbackService.requestFeedback(
        data.agentId,
        data.requestId,
        data.userRequest,
        data.agentResponse,
        data.feedbackType;
      );

      res.json({ success: true, feedbackRequest });
    } catch (error: any) {
      logger.error('Feedback request error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get pending feedback requests
  router.get('/pending', async (req: any, res) => {
    try {
      const pending = feedbackService.getActiveFeedbackRequests();
      res.json({ requests: pending });
    } catch (error: any) {
      logger.error('Get pending feedback error:', error);
      res.status(500).json({ error: 'Failed to get pending feedback' });
    }
  });

  // Get feedback metrics
  router.get('/metrics', async (req: any, res) => {
    try {
      const { agentId, timeframe = '7d' } = req.query;
      
      const metrics = await feedbackService.getFeedbackMetrics(
        agentId as string,
        timeframe as string;
      );

      res.json({ metrics });
    } catch (error: any) {
      logger.error('Get metrics error:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // Create training dataset
  router.post('/dataset/create', async (req: any, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        description: z.string(),
        filters: z.object({
          agentId: z.string().optional(),
          minRating: z.number().optional(),
          labels: z.array(z.string()).optional(),
          timeframe: z.string().optional();
        }).optional();
      });

      const data = schema.parse(req.body);
      
      const dataset = await feedbackService.createTrainingDataset(
        data.name,
        data.description,
        data.filters;
      );

      res.json({ success: true, dataset });
    } catch (error: any) {
      logger.error('Create dataset error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Export dataset for DSPy
  router.get('/dataset/:datasetId/export', async (req: any, res) => {
    try {
      const { datasetId } = req.params;
      
      const exportData = await feedbackService.exportForDSPy(datasetId);

      res.json({ data: exportData });
    } catch (error: any) {
      logger.error('Export dataset error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // WebSocket endpoint for real-time feedback
  router.ws('/live', (ws: any, req: any) => {
    feedbackService.addWebSocketConnection(ws);

    ws.on('close', () => {
      feedbackService.removeWebSocketConnection(ws);
    });

    ws.on('error', (error: any) => {
      logger.error('Feedback WebSocket error:', error);
      feedbackService.removeWebSocketConnection(ws);
    });
  });

  return router;
}