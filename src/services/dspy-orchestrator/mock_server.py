#!/usr/bin/env python3
"""
Mock DSPy server for testing without requiring OpenAI API
"""
import asyncio
import json
import logging
import websockets
from typing import Dict, Any, List
from datetime import datetime
import random

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MockDSPyServer:
    """Mock WebSocket server that simulates DSPy responses."""
    
    def __init__(self):
        self.clients = set()
        self.request_count = 0
        
    async def handle_request(self, websocket):
        """Handle incoming WebSocket connections."""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")
        
        try:
            async for message in websocket:
                try:
                    request = json.loads(message)
                    response = await self.process_request(request)
                    await websocket.send(json.dumps(response))
                except json.JSONDecodeError as e:
                    error_response = {
                        'requestId': 'error',
                        'success': False,
                        'error': f'Invalid JSON: {str(e)}'
                    }
                    await websocket.send(json.dumps(error_response))
                except Exception as e:
                    logger.error(f"Error processing request: {e}")
                    error_response = {
                        'requestId': request.get('requestId', 'unknown'),
                        'success': False,
                        'error': str(e)
                    }
                    await websocket.send(json.dumps(error_response))
        finally:
            self.clients.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.clients)}")
    
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming DSPy requests with mock responses."""
        self.request_count += 1
        request_id = request.get('requestId')
        method = request.get('method')
        params = request.get('params', {})
        
        logger.info(f"Processing request #{self.request_count}: {method}")
        
        # Simulate processing delay
        await asyncio.sleep(random.uniform(0.1, 0.3))
        
        try:
            if method == 'orchestrate':
                result = self._mock_orchestrate(params)
                return {
                    'requestId': request_id,
                    'success': True,
                    'data': result
                }
            
            elif method == 'coordinate_agents':
                result = self._mock_coordinate_agents(params)
                return {
                    'requestId': request_id,
                    'success': True,
                    'data': result
                }
            
            elif method == 'manage_knowledge':
                result = self._mock_manage_knowledge(params)
                return {
                    'requestId': request_id,
                    'success': True,
                    'data': result
                }
            
            elif method == 'optimize_prompts':
                result = self._mock_optimize_prompts(params)
                return {
                    'requestId': request_id,
                    'success': True,
                    'data': result
                }
            
            else:
                return {
                    'requestId': request_id,
                    'success': False,
                    'error': f'Unknown method: {method}'
                }
                
        except Exception as e:
            logger.error(f"Error in {method}: {e}")
            return {
                'requestId': request_id,
                'success': False,
                'error': str(e)
            }
    
    def _mock_orchestrate(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock orchestration response."""
        user_request = params.get('userRequest', '')
        context = params.get('context', {})
        
        # Determine complexity based on request length
        complexity = 0.3 if len(user_request) < 50 else 0.7 if len(user_request) < 100 else 0.9
        
        # Mock intelligent response
        return {
            'intent': f'Process request: {user_request[:50]}...',
            'complexity': complexity,
            'orchestration_mode': 'cognitive' if complexity > 0.7 else 'standard',
            'selected_agents': 'planner,executor,validator',
            'coordination_plan': 'Sequential execution with validation checkpoints',
            'consensus': f'Successfully processed request with {complexity:.0%} confidence',
            'confidence': complexity,
            'agent_responses': [
                {
                    'agent': 'planner',
                    'response': 'Execution plan created',
                    'confidence': 0.9
                },
                {
                    'agent': 'executor',
                    'response': 'Task executed successfully',
                    'confidence': 0.85
                },
                {
                    'agent': 'validator',
                    'response': 'Results validated',
                    'confidence': 0.95
                }
            ]
        }
    
    def _mock_coordinate_agents(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock agent coordination response."""
        task = params.get('task', '')
        agents = params.get('agents', [])
        
        # Select random subset of agents
        selected = random.sample(agents, min(3, len(agents))) if agents else ['default_agent']
        
        return {
            'selected_agents': ', '.join(selected),
            'coordination_plan': f'Coordinate {len(selected)} agents for: {task}',
            'agent_assignments': [
                {
                    'agent': agent,
                    'subtask': f'Handle {task} - part {i+1}',
                    'confidence': random.uniform(0.8, 0.95)
                }
                for i, agent in enumerate(selected)
            ]
        }
    
    def _mock_manage_knowledge(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock knowledge management response."""
        operation = params.get('operation', 'search')
        data = params.get('data', {})
        
        if operation == 'extract':
            return {
                'knowledge': f'Extracted knowledge from: {data.get("content", "")[:50]}...',
                'confidence': random.uniform(0.8, 0.95),
                'facts': ['Fact 1', 'Fact 2', 'Fact 3'],
                'relationships': ['Rel 1', 'Rel 2'],
                'insights': ['Insight 1']
            }
        elif operation == 'search':
            return {
                'results': [
                    {
                        'content': f'Result {i+1} for query: {data.get("query", "")}',
                        'relevance': random.uniform(0.7, 0.95),
                        'source': 'knowledge_base'
                    }
                    for i in range(3)
                ],
                'count': 3
            }
        elif operation == 'evolve':
            return {
                'evolved_knowledge': 'Knowledge has been updated and evolved',
                'changes': ['Added new insights', 'Updated relationships', 'Refined facts']
            }
        else:
            return {'error': f'Unknown operation: {operation}'}
    
    def _mock_optimize_prompts(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock prompt optimization response."""
        examples = params.get('examples', [])
        
        return {
            'optimized': True,
            'improvements': [
                'Added chain-of-thought reasoning',
                'Improved task decomposition',
                'Enhanced error handling'
            ],
            'performance_gain': random.uniform(0.1, 0.3),
            'optimization_metrics': {
                'before': {'accuracy': 0.75, 'speed': 1.2},
                'after': {'accuracy': 0.88, 'speed': 0.9}
            }
        }
    
    async def start_server(self, host='localhost', port=8766):
        """Start the WebSocket server."""
        logger.info(f"Starting Mock DSPy server on {host}:{port}")
        logger.info("This is a mock server for testing - no AI model required")
        
        async with websockets.serve(self.handle_request, host, port):
            await asyncio.Future()  # Run forever

def main():
    """Main entry point."""
    server = MockDSPyServer()
    asyncio.run(server.start_server())

if __name__ == "__main__":
    main()