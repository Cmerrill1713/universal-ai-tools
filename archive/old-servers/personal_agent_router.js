const express = require('express');
const path = require('path');

// Import personal agents (CommonJS compatible)
let PersonalAssistantAgent;
try {
    // Try to load the personal assistant agent
    const agentPath = path.join(__dirname, '../dist/personal/personal_assistant_agent.js');
    if (require('fs').existsSync(agentPath)) {
        const agentModule = require(agentPath);
        PersonalAssistantAgent = agentModule.PersonalAssistantAgent || agentModule.default;
    }
} catch (error) {
    console.log('Personal agents not available (normal for production)');
}

function PersonalAgentRouter(supabase) {
    const router = express.Router();
    
    // Check if personal agents are available
    const agentsAvailable = !!PersonalAssistantAgent;
    
    // Personal agent status
    router.get('/status', (req, res) => {
        res.json({
            available: agentsAvailable,
            agents: agentsAvailable ? [
                'personal_assistant',
                'calendar',
                'photo_organizer', 
                'file_manager',
                'code_assistant',
                'system_control',
                'tool_maker',
                'web_scraper'
            ] : [],
            message: agentsAvailable ? 'Personal agents available' : 'Personal agents not loaded'
        });
    });
    
    // List available personal agents
    router.get('/agents', (req, res) => {
        if (!agentsAvailable) {
            return res.status(503).json({
                success: false,
                error: 'Personal agents not available'
            });
        }
        
        res.json({
            success: true,
            agents: [
                {
                    id: 'personal_assistant',
                    name: 'Personal Assistant',
                    description: 'High-level coordination and personalized assistance',
                    capabilities: ['comprehensive_assistance', 'smart_planning', 'proactive_assistance']
                },
                {
                    id: 'calendar',
                    name: 'Calendar Agent',
                    description: 'Calendar and scheduling management',
                    capabilities: ['schedule_management', 'event_creation', 'availability_checking']
                },
                {
                    id: 'photo_organizer',
                    name: 'Photo Organizer',
                    description: 'Photo organization and management',
                    capabilities: ['photo_organization', 'duplicate_detection', 'metadata_extraction']
                },
                {
                    id: 'file_manager',
                    name: 'File Manager',
                    description: 'File organization and management',
                    capabilities: ['file_organization', 'cleanup', 'backup_management']
                },
                {
                    id: 'code_assistant',
                    name: 'Code Assistant',
                    description: 'Development and coding assistance',
                    capabilities: ['code_analysis', 'refactoring', 'test_generation']
                },
                {
                    id: 'system_control',
                    name: 'System Control',
                    description: 'System monitoring and control',
                    capabilities: ['performance_monitoring', 'system_optimization', 'maintenance']
                }
            ]
        });
    });
    
    // Execute personal agent request
    router.post('/execute', async (req, res) => {
        if (!agentsAvailable) {
            return res.status(503).json({
                success: false,
                error: 'Personal agents not available'
            });
        }
        
        try {
            const { agent_id, request, context } = req.body;
            
            if (!request) {
                return res.status(400).json({
                    success: false,
                    error: 'Request is required'
                });
            }
            
            // Initialize personal assistant
            const personalAgent = new PersonalAssistantAgent(supabase);
            await personalAgent.initialize();
            
            // Execute request
            const executionContext = {
                requestId: `personal_${Date.now()}`,
                userRequest: request,
                timestamp: new Date(),
                agentId: agent_id || 'personal_assistant',
                context: context || {}
            };
            
            const result = await personalAgent.process(executionContext);
            
            // Store interaction for learning
            try {
                await supabase
                    .from('ai_memories')
                    .insert({
                        service_id: 'personal_agents',
                        memory_type: 'agent_interaction',
                        content: `Personal agent request: ${request}`,
                        metadata: {
                            agent_id: agent_id || 'personal_assistant',
                            request,
                            result,
                            context
                        },
                        timestamp: new Date().toISOString()
                    });
            } catch (memoryError) {
                console.log('Could not store interaction memory:', memoryError.message);
            }
            
            res.json({
                success: result.success,
                data: result.data,
                reasoning: result.reasoning,
                confidence: result.confidence,
                latency_ms: result.latencyMs,
                agent_id: result.agentId,
                next_actions: result.nextActions
            });
            
        } catch (error) {
            console.error('Personal agent execution error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                agent_available: agentsAvailable
            });
        }
    });
    
    // Get personal agent capabilities
    router.get('/capabilities/:agent_id', (req, res) => {
        if (!agentsAvailable) {
            return res.status(503).json({
                success: false,
                error: 'Personal agents not available'
            });
        }
        
        const { agent_id } = req.params;
        
        // Return capabilities for specific agent
        const capabilities = {
            personal_assistant: {
                primary: ['comprehensive_assistance', 'smart_planning', 'proactive_assistance'],
                secondary: ['coordination', 'learning', 'personalization']
            },
            calendar: {
                primary: ['schedule_management', 'event_creation', 'availability_checking'],
                secondary: ['reminder_setup', 'calendar_integration', 'time_optimization']
            },
            photo_organizer: {
                primary: ['photo_organization', 'duplicate_detection', 'metadata_extraction'],
                secondary: ['album_creation', 'face_recognition', 'location_tagging']
            },
            file_manager: {
                primary: ['file_organization', 'cleanup', 'backup_management'],
                secondary: ['search_optimization', 'storage_analysis', 'security_scanning']
            },
            code_assistant: {
                primary: ['code_analysis', 'refactoring', 'test_generation'],
                secondary: ['documentation', 'debugging', 'performance_optimization']
            },
            system_control: {
                primary: ['performance_monitoring', 'system_optimization', 'maintenance'],
                secondary: ['security_monitoring', 'update_management', 'resource_analysis']
            }
        };
        
        const agentCapabilities = capabilities[agent_id];
        if (!agentCapabilities) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        
        res.json({
            success: true,
            agent_id,
            capabilities: agentCapabilities
        });
    });
    
    return router;
}

module.exports = PersonalAgentRouter;