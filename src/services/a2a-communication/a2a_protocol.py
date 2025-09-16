#!/usr/bin/env python3
"""
A2A (Agent-to-Agent) Communication Protocol
Enables agents to communicate and coordinate tasks
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
import aiohttp
import websockets
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MessageType(Enum):
    """A2A Message Types"""
    TASK_REQUEST = "task_request"
    TASK_RESPONSE = "task_response"
    COORDINATION = "coordination"
    STATUS_UPDATE = "status_update"
    RESOURCE_REQUEST = "resource_request"
    RESOURCE_RESPONSE = "resource_response"
    ERROR = "error"
    HEARTBEAT = "heartbeat"

class AgentRole(Enum):
    """Agent Roles in A2A System"""
    PLANNER = "planner"
    SYNTHESIZER = "synthesizer"
    RETRIEVER = "retriever"
    PERSONAL_ASSISTANT = "personal_assistant"
    CODE_ASSISTANT = "code_assistant"
    RESEARCHER = "researcher"
    VALIDATOR = "validator"
    COORDINATOR = "coordinator"

@dataclass
class A2AMessage:
    """A2A Communication Message"""
    message_id: str
    sender_id: str
    receiver_id: Optional[str]  # None for broadcast
    message_type: MessageType
    content: Dict[str, Any]
    timestamp: datetime
    priority: int = 1  # 1=low, 2=medium, 3=high, 4=critical
    correlation_id: Optional[str] = None  # For request-response pairs
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['message_type'] = self.message_type.value
        data['timestamp'] = self.timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'A2AMessage':
        """Create from dictionary"""
        data['message_type'] = MessageType(data['message_type'])
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)

@dataclass
class AgentCapabilities:
    """Agent capabilities and metadata"""
    agent_id: str
    role: AgentRole
    capabilities: List[str]
    max_concurrent_tasks: int
    current_load: int
    status: str  # active, busy, idle, error
    last_heartbeat: datetime

class A2ACommunicationHub:
    """
    A2A Communication Hub
    Manages agent-to-agent communication and coordination
    """
    
    def __init__(self, websocket_port: int = 8018):
        self.websocket_port = websocket_port
        self.agents: Dict[str, AgentCapabilities] = {}
        self.message_handlers: Dict[MessageType, List[Callable]] = {}
        self.active_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.running = False
        
    async def start_hub(self):
        """Start the A2A Communication Hub"""
        try:
            logger.info(f"🚀 Starting A2A Communication Hub on port {self.websocket_port}")
            
            # Start WebSocket server
            server = await websockets.serve(
                self._handle_agent_connection,
                "localhost",
                self.websocket_port
            )
            
            # Start message processing
            self.running = True
            asyncio.create_task(self._process_messages())
            asyncio.create_task(self._heartbeat_monitor())
            
            logger.info("✅ A2A Communication Hub started")
            
            # Keep server running
            await server.wait_closed()
            
        except Exception as e:
            logger.error(f"❌ A2A Hub startup failed: {e}")
            raise
    
    async def _handle_agent_connection(self, websocket, path):
        """Handle new agent connection"""
        agent_id = None
        try:
            async for message in websocket:
                data = json.loads(message)
                
                if data.get('type') == 'register':
                    # Agent registration
                    agent_id = data['agent_id']
                    await self._register_agent(agent_id, data, websocket)
                    
                elif data.get('type') == 'message':
                    # A2A message
                    a2a_message = A2AMessage.from_dict(data['message'])
                    await self._route_message(a2a_message)
                    
                elif data.get('type') == 'heartbeat':
                    # Heartbeat
                    await self._update_heartbeat(data['agent_id'])
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Agent {agent_id} disconnected")
        except Exception as e:
            logger.error(f"❌ Connection error: {e}")
        finally:
            if agent_id:
                await self._unregister_agent(agent_id)
    
    async def _register_agent(self, agent_id: str, data: Dict, websocket):
        """Register a new agent"""
        try:
            capabilities = AgentCapabilities(
                agent_id=agent_id,
                role=AgentRole(data['role']),
                capabilities=data['capabilities'],
                max_concurrent_tasks=data.get('max_concurrent_tasks', 5),
                current_load=0,
                status='active',
                last_heartbeat=datetime.now()
            )
            
            self.agents[agent_id] = capabilities
            self.active_connections[agent_id] = websocket
            
            logger.info(f"✅ Registered agent {agent_id} ({capabilities.role.value})")
            
            # Send registration confirmation
            await websocket.send(json.dumps({
                'type': 'registration_confirmed',
                'agent_id': agent_id,
                'hub_status': 'active'
            }))
            
        except Exception as e:
            logger.error(f"❌ Agent registration failed: {e}")
    
    async def _unregister_agent(self, agent_id: str):
        """Unregister an agent"""
        if agent_id in self.agents:
            del self.agents[agent_id]
        if agent_id in self.active_connections:
            del self.active_connections[agent_id]
        logger.info(f"🔌 Unregistered agent {agent_id}")
    
    async def _route_message(self, message: A2AMessage):
        """Route A2A message to appropriate handler"""
        try:
            # Add to message queue for processing
            await self.task_queue.put(message)
            
        except Exception as e:
            logger.error(f"❌ Message routing failed: {e}")
    
    async def _process_messages(self):
        """Process A2A messages from queue"""
        while self.running:
            try:
                message = await asyncio.wait_for(self.task_queue.get(), timeout=1.0)
                await self._handle_message(message)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"❌ Message processing error: {e}")
    
    async def _handle_message(self, message: A2AMessage):
        """Handle individual A2A message"""
        try:
            logger.info(f"📨 Processing {message.message_type.value} from {message.sender_id}")
            
            # Route to specific receiver or broadcast
            if message.receiver_id:
                await self._send_to_agent(message.receiver_id, message)
            else:
                await self._broadcast_message(message)
            
            # Execute registered handlers
            if message.message_type in self.message_handlers:
                for handler in self.message_handlers[message.message_type]:
                    try:
                        await handler(message)
                    except Exception as e:
                        logger.error(f"❌ Message handler error: {e}")
            
        except Exception as e:
            logger.error(f"❌ Message handling failed: {e}")
    
    async def _send_to_agent(self, agent_id: str, message: A2AMessage):
        """Send message to specific agent"""
        if agent_id in self.active_connections:
            websocket = self.active_connections[agent_id]
            await websocket.send(json.dumps({
                'type': 'a2a_message',
                'message': message.to_dict()
            }))
            logger.info(f"📤 Sent {message.message_type.value} to {agent_id}")
        else:
            logger.warning(f"⚠️ Agent {agent_id} not connected")
    
    async def _broadcast_message(self, message: A2AMessage):
        """Broadcast message to all agents"""
        for agent_id, websocket in self.active_connections.items():
            if agent_id != message.sender_id:  # Don't send to sender
                await websocket.send(json.dumps({
                    'type': 'a2a_message',
                    'message': message.to_dict()
                }))
        logger.info(f"📢 Broadcasted {message.message_type.value} to {len(self.active_connections)-1} agents")
    
    async def _update_heartbeat(self, agent_id: str):
        """Update agent heartbeat"""
        if agent_id in self.agents:
            self.agents[agent_id].last_heartbeat = datetime.now()
            self.agents[agent_id].status = 'active'
    
    async def _heartbeat_monitor(self):
        """Monitor agent heartbeats"""
        while self.running:
            try:
                current_time = datetime.now()
                inactive_agents = []
                
                for agent_id, agent in self.agents.items():
                    time_since_heartbeat = (current_time - agent.last_heartbeat).total_seconds()
                    if time_since_heartbeat > 30:  # 30 seconds timeout
                        agent.status = 'inactive'
                        inactive_agents.append(agent_id)
                
                if inactive_agents:
                    logger.warning(f"⚠️ Inactive agents: {inactive_agents}")
                
                await asyncio.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                logger.error(f"❌ Heartbeat monitoring error: {e}")
                await asyncio.sleep(10)
    
    def register_message_handler(self, message_type: MessageType, handler: Callable):
        """Register a message handler"""
        if message_type not in self.message_handlers:
            self.message_handlers[message_type] = []
        self.message_handlers[message_type].append(handler)
        logger.info(f"✅ Registered handler for {message_type.value}")
    
    async def send_task_request(self, sender_id: str, task: Dict[str, Any], 
                              target_role: Optional[AgentRole] = None) -> str:
        """Send a task request to agents"""
        message_id = f"task_{datetime.now().timestamp()}"
        
        message = A2AMessage(
            message_id=message_id,
            sender_id=sender_id,
            receiver_id=None,  # Broadcast
            message_type=MessageType.TASK_REQUEST,
            content={
                'task': task,
                'target_role': target_role.value if target_role else None,
                'requirements': task.get('requirements', [])
            },
            timestamp=datetime.now(),
            priority=task.get('priority', 2)
        )
        
        await self._route_message(message)
        return message_id
    
    async def send_coordination_message(self, sender_id: str, coordination_data: Dict[str, Any]):
        """Send coordination message"""
        message = A2AMessage(
            message_id=f"coord_{datetime.now().timestamp()}",
            sender_id=sender_id,
            receiver_id=None,
            message_type=MessageType.COORDINATION,
            content=coordination_data,
            timestamp=datetime.now(),
            priority=3
        )
        
        await self._route_message(message)
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            'total_agents': len(self.agents),
            'active_agents': len([a for a in self.agents.values() if a.status == 'active']),
            'agents': {
                agent_id: {
                    'role': agent.role.value,
                    'status': agent.status,
                    'capabilities': agent.capabilities,
                    'current_load': agent.current_load,
                    'max_concurrent_tasks': agent.max_concurrent_tasks
                }
                for agent_id, agent in self.agents.items()
            }
        }

class A2AAgent:
    """
    Base A2A Agent class
    Provides common functionality for agents participating in A2A communication
    """
    
    def __init__(self, agent_id: str, role: AgentRole, capabilities: List[str]):
        self.agent_id = agent_id
        self.role = role
        self.capabilities = capabilities
        self.websocket = None
        self.hub_url = f"ws://localhost:8018"
        self.running = False
        
    async def connect_to_hub(self):
        """Connect to A2A Communication Hub"""
        try:
            self.websocket = await websockets.connect(self.hub_url)
            
            # Register with hub
            registration = {
                'type': 'register',
                'agent_id': self.agent_id,
                'role': self.role.value,
                'capabilities': self.capabilities,
                'max_concurrent_tasks': 5
            }
            
            await self.websocket.send(json.dumps(registration))
            
            # Start message handling
            self.running = True
            asyncio.create_task(self._handle_messages())
            asyncio.create_task(self._send_heartbeats())
            
            logger.info(f"✅ Agent {self.agent_id} connected to A2A Hub")
            
        except Exception as e:
            logger.error(f"❌ Agent connection failed: {e}")
            raise
    
    async def _handle_messages(self):
        """Handle incoming A2A messages"""
        try:
            async for message in self.websocket:
                data = json.loads(message)
                
                if data.get('type') == 'a2a_message':
                    a2a_message = A2AMessage.from_dict(data['message'])
                    await self._process_a2a_message(a2a_message)
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Agent {self.agent_id} disconnected from hub")
        except Exception as e:
            logger.error(f"❌ Message handling error: {e}")
    
    async def _process_a2a_message(self, message: A2AMessage):
        """Process incoming A2A message"""
        try:
            if message.message_type == MessageType.TASK_REQUEST:
                await self._handle_task_request(message)
            elif message.message_type == MessageType.COORDINATION:
                await self._handle_coordination(message)
            elif message.message_type == MessageType.STATUS_UPDATE:
                await self._handle_status_update(message)
            else:
                logger.info(f"📨 Received {message.message_type.value} from {message.sender_id}")
                
        except Exception as e:
            logger.error(f"❌ A2A message processing error: {e}")
    
    async def _handle_task_request(self, message: A2AMessage):
        """Handle task request"""
        task = message.content.get('task', {})
        target_role = message.content.get('target_role')
        
        # Check if this agent can handle the task
        if target_role and target_role != self.role.value:
            return  # Not for this agent
        
        # Check capabilities
        requirements = message.content.get('requirements', [])
        if not all(req in self.capabilities for req in requirements):
            return  # Missing required capabilities
        
        # Process task
        logger.info(f"🎯 Agent {self.agent_id} processing task: {task.get('name', 'Unknown')}")
        result = await self._execute_task(task)
        
        # Send response
        response = A2AMessage(
            message_id=f"response_{datetime.now().timestamp()}",
            sender_id=self.agent_id,
            receiver_id=message.sender_id,
            message_type=MessageType.TASK_RESPONSE,
            content={
                'task_id': task.get('id'),
                'result': result,
                'status': 'completed'
            },
            timestamp=datetime.now(),
            correlation_id=message.message_id
        )
        
        await self._send_message(response)
    
    async def _handle_coordination(self, message: A2AMessage):
        """Handle coordination message"""
        logger.info(f"🤝 Agent {self.agent_id} received coordination from {message.sender_id}")
        # Override in subclasses for specific coordination logic
    
    async def _handle_status_update(self, message: A2AMessage):
        """Handle status update"""
        logger.info(f"📊 Agent {self.agent_id} received status update from {message.sender_id}")
        # Override in subclasses for specific status handling
    
    async def _execute_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a task - override in subclasses"""
        return {'status': 'completed', 'result': 'Task executed'}
    
    async def _send_message(self, message: A2AMessage):
        """Send A2A message"""
        if self.websocket:
            await self.websocket.send(json.dumps({
                'type': 'message',
                'message': message.to_dict()
            }))
    
    async def _send_heartbeats(self):
        """Send periodic heartbeats"""
        while self.running:
            try:
                if self.websocket:
                    await self.websocket.send(json.dumps({
                        'type': 'heartbeat',
                        'agent_id': self.agent_id
                    }))
                await asyncio.sleep(10)  # Send every 10 seconds
            except Exception as e:
                logger.error(f"❌ Heartbeat error: {e}")
                break
    
    async def disconnect(self):
        """Disconnect from A2A Hub"""
        self.running = False
        if self.websocket:
            await self.websocket.close()
        logger.info(f"🔌 Agent {self.agent_id} disconnected")

async def main():
    """Main function to run A2A Communication Hub"""
    hub = A2ACommunicationHub()
    
    try:
        await hub.start_hub()
    except KeyboardInterrupt:
        logger.info("🛑 A2A Hub shutting down")
    except Exception as e:
        logger.error(f"❌ A2A Hub failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
