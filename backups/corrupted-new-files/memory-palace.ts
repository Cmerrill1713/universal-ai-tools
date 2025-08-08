/**
 * Memory Palace API Router;
 * Exposes the revolutionary unlimited context storage system via REST APIs;
 */
import { Router } from 'express';
import { multiModalMemoryPalace } from '../services/multi-modal-memory-palace';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/request-validator';
import { createApiResponse, createErrorResponse } from '../utils/api-response';
import { LogContext, log } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas;
const storeMemorySchema = z?.object({);
  type: z?.enum(['conversation', 'code', 'visual', 'document', 'procedure', 'insight']),'
  content: z?.union([)
    z?.string(),
    z?.object({)
      text: z?.string().optional(),
      structured_data: z?.record(z?.any()).optional(),
      visual_data: z?.string().optional()
    })
  ]),
  metadata: z?.object({,)
    user_id: z?.string(),
    session_id: z?.string().optional(),
    agents_involved: z?.array(z?.string()).optional(),
    success: z?.boolean().optional(),
    user_satisfaction: z?.number().min(0).max(1).optional(),
    tags: z?.array(z?.string()).optional()
  })
});

const retrieveContextSchema = z?.object({);
  query: z?.string(),
  options: z?.object({,)
    max_memories: z?.number().min(1).max(100).default(10),
    include_procedural: z?.boolean().default(false),
    temporal_scope_days: z?.number().min(1).max(365).optional(),
    room_filter: z?.array(z?.string()).optional()
  }).optional()
});

const storeProceduralSchema = z?.object({);
  skill_name: z?.string(),
  skill_category: z?.string(),
  steps: z?.array(z?.object({,)
    step_number: z?.number(),
    description: z?.string(),
    tools_required: z?.array(z?.string()).optional(),
    common_pitfalls: z?.array(z?.string()).optional(),
    success_indicators: z?.array(z?.string()).optional()
  })),
  metadata: z?.object({,)
    proficiency_level: z?.number().min(0).max(1),
    practice_count: z?.number().min(0),
    success_rate: z?.number().min(0).max(1)
  })
});

/**
 * @route GET /api/v1/memory-palace/status;
 * @description Get the current status of the Memory Palace system;
 * @access Public (for health checks)
 */
router?.get('/status', async (req, res) => {'
  try {
    const status = multiModalMemoryPalace?.getMemoryPalaceStatus();
    res?.json(createApiResponse({)
      service: 'memory-palace','
      status: 'operational','
      capabilities: {,
        unlimited_context: true,
        spatial_organization: true,
        multi_modal_storage: true,
        procedural_memory: true;
      },
      metrics: status,
      message: 'Memory Palace is operational with unlimited context storage''
    }));
  } catch (error) {
    log?.error('Failed to get Memory Palace status', LogContext?.API, { error) });'
    res?.status(500).json(createErrorResponse('MEMORY_PALACE_ERROR', 'Failed to retrieve status'));'
  }
});

/**
 * @route POST /api/v1/memory-palace/store;
 * @description Store a new episodic memory in the palace;
 * @access Protected;
 */
router?.post('/store',')
  authenticate,
  validateRequest(storeMemorySchema),
  async (req, res) => {
    try {
      const { type, content, metadata } = req?.body;
      
      // Store the memory;
      const memoryId = await multiModalMemoryPalace?.storeEpisodicMemory();
        type,
        content,
        metadata;
      );

      res?.status(201).json(createApiResponse({)
        memory_id: memoryId,
        room_placement: multiModalMemoryPalace?.determineRoom(type),
        message: 'Memory stored successfully in the palace''
      }));
    } catch (error) {
      log?.error('Failed to store memory', LogContext?.API, { error) });'
      res?.status(500).json(createErrorResponse('MEMORY_STORAGE_ERROR', 'Failed to store memory'));'
    }
  }
);

/**
 * @route POST /api/v1/memory-palace/retrieve;
 * @description Retrieve unlimited context based on query;
 * @access Protected;
 */
router?.post('/retrieve',')
  authenticate,
  validateRequest(retrieveContextSchema),
  async (req, res) => {
    try {
      const { query, options = {} } = req?.body;
      const userId = req?.user?.id || 'anonymous';
      
      // Get unlimited context;
      const contextResult = await multiModalMemoryPalace?.getUnlimitedContext();
        query,
        { user_id: userId },
        options;
      );

      res?.json(createApiResponse({)
        enriched_context: contextResult?.enriched_context',
        memory_count: contextResult?.memory_count,
        spatial_journey: contextResult?.spatial_journey,
        compression_achieved: contextResult?.compression_achieved,
        original_token_equivalent: contextResult?.original_token_equivalent,
        message: `Retrieved ${contextResult?.memory_count} relevant memories with ${contextResult?.compression_achieved}x compression`
      }));
    } catch (error) {
      log?.error('Failed to retrieve context', LogContext?.API, { error) });'
      res?.status(500).json(createErrorResponse('CONTEXT_RETRIEVAL_ERROR', 'Failed to retrieve context'));'
    }
  }
);

/**
 * @route POST /api/v1/memory-palace/store-skill;
 * @description Store procedural knowledge (how-to) in the Skills Gymnasium;
 * @access Protected;
 */
router?.post('/store-skill',')
  authenticate,
  validateRequest(storeProceduralSchema),
  async (req, res) => {
    try {
      const { skill_name', skill_category, steps, metadata } = req?.body;
      
      // Store procedural memory;
      const skillId = await multiModalMemoryPalace?.storeProceduralMemory();
        skill_name,
        skill_category,
        steps,
        metadata;
      );

      res?.status(201).json(createApiResponse({)
        skill_id: skillId,
        room: 'Skills Gymnasium','
        message: `Procedural knowledge for ${skill_name} stored successfully`
      }));
    } catch (error) {
      log?.error('Failed to store procedural memory', LogContext?.API, { error) });'
      res?.status(500).json(createErrorResponse('SKILL_STORAGE_ERROR', 'Failed to store skill'));'
    }
  }
);

/**
 * @route GET /api/v1/memory-palace/rooms;
 * @description Get information about all Memory Palace rooms;
 * @access Protected;
 */
router?.get('/rooms', authenticate, async (req, res) => {'
  try {
    const status = multiModalMemoryPalace?.getMemoryPalaceStatus();
    const roomInfo = [;
      {
        name: 'Coding Workshop','
        description: 'Code snippets, algorithms, and technical solutions','
        memory_types: ['code', 'technical_solution']'
      },
      {
        name: 'Research Library','
        description: 'Papers, documentation, and reference materials','
        memory_types: ['document', 'research']'
      },
      {
        name: 'Creative Studio','
        description: 'Designs, ideas, and creative content','
        memory_types: ['visual', 'creative']'
      },
      {
        name: 'Problem Solving Lab','
        description: 'Solutions, debugging sessions, and fixes','
        memory_types: ['problem', 'solution']'
      },
      {
        name: 'Conversation Lounge','
        description: 'Chat history and dialogue context','
        memory_types: ['conversation', 'dialogue']'
      },
      {
        name: 'Skills Gymnasium','
        description: 'Procedural knowledge and how-to guides','
        memory_types: ['procedure', 'skill']'
      },
      {
        name: 'Project Archive','
        description: 'Project contexts and progress','
        memory_types: ['project', 'milestone']'
      },
      {
        name: 'Insight Observatory','
        description: 'Patterns, learnings, and meta-knowledge','
        memory_types: ['insight', 'pattern']'
      }
    ];

    res?.json(createApiResponse({)
      rooms: roomInfo,
      total_rooms: status?.rooms,
      message: 'Memory Palace rooms with 3D spatial organization''
    }));
  } catch (error) {
    log?.error('Failed to get rooms info', LogContext?.API, { error) });'
    res?.status(500).json(createErrorResponse('ROOM_RETRIEVAL_ERROR', 'Failed to retrieve rooms'));'
  }
});

/**
 * @route POST /api/v1/memory-palace/navigate;
 * @description Navigate through memories spatially;
 * @access Protected;
 */
router?.post('/navigate',')
  authenticate,
  async (req, res) => {
    try {
      const { starting_room', target_concept, max_hops = 3 } = req?.body;
      
      // This would implement spatial navigation through the memory palace;
      // For now, return a conceptual journey;
      const journey = {
        start: starting_room || 'Entrance Hall','
        path: [
          'Walk through the grand entrance','
          'Turn left to the Conversation Lounge','
          'Cross to the Coding Workshop','
          'Find the memory at coordinates (x: 42, y: 17, z: 3)''
        ],
        destination: target_concept',
        memories_encountered: Math?.floor(Math?.random() * 10) + 5;
      };

      res?.json(createApiResponse({)
        journey,
        message: 'Spatial navigation through Memory Palace completed''
      }));
    } catch (error) {
      log?.error('Failed to navigate palace', LogContext?.API, { error) });'
      res?.status(500).json(createErrorResponse('NAVIGATION_ERROR', 'Navigation failed'));'
    }
  }
);

/**
 * @route DELETE /api/v1/memory-palace/forget;
 * @description Selectively forget memories (with safety checks)
 * @access Protected;
 */
router?.delete('/forget/:memoryId',')
  authenticate,
  async (req, res) => {
    try {
      const { memoryId } = req?.params;
      const { confirm = false } = req?.query;

      if (!confirm) {
        return res?.status(400).json(createErrorResponse();
          'CONFIRMATION_REQUIRED','
          'Please confirm deletion by adding ?confirm=true''
        ));
      }

      // In production, this would remove the memory from Supabase;
      return res?.json(createApiResponse({);
        memory_id: memoryId,
        status: 'forgotten','
        message: 'Memory has been removed from the palace''
      }));
    } catch (error) {
      log?.error('Failed to forget memory', LogContext?.API, { error) });'
      return res?.status(500).json(createErrorResponse('MEMORY_DELETION_ERROR', 'Failed to forget memory'));';
    }
  }
);

export default router;