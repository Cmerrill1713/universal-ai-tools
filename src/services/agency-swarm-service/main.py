#!/usr/bin/env python3
"""
Agency Swarm Service - Local-Only Implementation
Integrates with our local Librarian service and GitHub MCP
"""

import os
import json
import asyncio
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

# Agency Swarm imports
from agency_swarm import Agency, Agent, ModelSettings
from agency_swarm import function_tool

# Local configuration
LIBRARIAN_URL = os.getenv('LIBRARIAN_URL', 'http://localhost:8032')
GITHUB_MCP_URL = os.getenv('GITHUB_MCP_URL', 'http://localhost:3000')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'local-dev-key')  # Local fallback

@dataclass
class LocalAgentConfig:
    """Configuration for local agents"""
    name: str
    description: str
    instructions: str
    capabilities: List[str]
    model_settings: Optional[Dict] = None

# Local Agent Configurations
LOCAL_AGENTS = {
    'ceo': LocalAgentConfig(
        name="CEO",
        description="Responsible for client communication, task planning and management.",
        instructions="""You are the CEO agent for our local Universal AI Tools system. 
        You coordinate with other agents to ensure complete task execution.
        You have access to our local Librarian service for knowledge management
        and can delegate GitHub operations to our GitHub Specialist agent.
        
        Key responsibilities:
        - Coordinate multi-agent workflows
        - Manage task planning and execution
        - Communicate with users and other agents
        - Store and retrieve knowledge from Librarian service
        - Delegate specialized tasks to appropriate agents""",
        capabilities=['coordination', 'planning', 'communication', 'knowledge_management'],
        model_settings={'model': 'gpt-4o-mini', 'max_tokens': 8000}
    ),
    'developer': LocalAgentConfig(
        name="Developer",
        description="Responsible for code development and technical implementation.",
        instructions="""You are the Developer agent for our local Universal AI Tools system.
        You focus on technical implementation, code quality, and development tasks.
        You work closely with the GitHub Specialist for repository operations.
        
        Key responsibilities:
        - Code development and implementation
        - Technical problem solving
        - Code review and quality assurance
        - Integration with local services
        - Documentation and testing""",
        capabilities=['development', 'coding', 'technical_implementation', 'code_review'],
        model_settings={'model': 'gpt-4o-mini', 'max_tokens': 8000}
    ),
    'github_specialist': LocalAgentConfig(
        name="GitHubSpecialist",
        description="Specialized in GitHub operations and repository management.",
        instructions="""You are the GitHub Specialist agent for our local Universal AI Tools system.
        You handle all GitHub-related operations through our local GitHub MCP.
        You work with repositories, issues, pull requests, and code management.
        
        Key responsibilities:
        - Repository management and operations
        - Issue and pull request handling
        - Code review and management
        - GitHub workflow automation
        - Integration with local GitHub MCP""",
        capabilities=['github_operations', 'repository_management', 'issue_management', 'pr_management'],
        model_settings={'model': 'gpt-4o-mini', 'max_tokens': 8000}
    ),
    'knowledge_manager': LocalAgentConfig(
        name="KnowledgeManager",
        description="Manages knowledge storage and retrieval through Librarian service.",
        instructions="""You are the Knowledge Manager agent for our local Universal AI Tools system.
        You handle all knowledge-related operations through our local Librarian service.
        You store, retrieve, and manage information for other agents.
        
        Key responsibilities:
        - Knowledge storage in Librarian service
        - Semantic search and retrieval
        - Information organization and categorization
        - Context sharing between agents
        - Knowledge base maintenance""",
        capabilities=['knowledge_storage', 'semantic_search', 'information_management', 'context_sharing'],
        model_settings={'model': 'gpt-4o-mini', 'max_tokens': 8000}
    )
}

# Custom Tools for Local Integration
@function_tool
def store_knowledge_in_librarian(content: str, metadata: dict = None, tags: list = None) -> str:
    """Store knowledge in our local Librarian service"""
    try:
        payload = [{
            "content": content,
            "metadata": {
                "type": "agent_knowledge",
                "source": "agency-swarm",
                "stored_at": datetime.now().isoformat(),
                "tags": tags or [],
                **(metadata or {})
            },
            "context": {
                "source": "agency-swarm",
                "metadata": metadata or {}
            }
        }]
        
        response = requests.post(f"{LIBRARIAN_URL}/embed", json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            return f"Knowledge stored successfully in Librarian. Embedded: {result.get('embedded_count', 0)} documents."
        else:
            return f"Failed to store knowledge: {response.status_code} - {response.text}"
            
    except Exception as e:
        return f"Error storing knowledge: {str(e)}"

@function_tool
def search_knowledge_in_librarian(query: str, limit: int = 10) -> str:
    """Search knowledge in our local Librarian service"""
    try:
        params = {"query": query, "limit": limit}
        response = requests.get(f"{LIBRARIAN_URL}/search", params=params, timeout=10)
        
        if response.status_code == 200:
            results = response.json()
            if isinstance(results, list) and len(results) > 0:
                formatted_results = []
                for i, result in enumerate(results[:5]):  # Show top 5
                    formatted_results.append(f"{i+1}. {result.get('content', '')[:100]}... (score: {result.get('similarity_score', 0):.3f})")
                return f"Found {len(results)} results:\n" + "\n".join(formatted_results)
            else:
                return "No results found in knowledge base."
        else:
            return f"Search failed: {response.status_code} - {response.text}"
            
    except Exception as e:
        return f"Error searching knowledge: {str(e)}"

@function_tool
def github_operation_local(operation_type: str, repository: str, parameters: dict = None) -> str:
    """Perform GitHub operations through our local GitHub MCP"""
    try:
        # Simulate GitHub MCP integration
        # In a real implementation, this would call our GitHub MCP server
        operation_data = {
            "operation": operation_type,
            "repository": repository,
            "parameters": parameters or {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Store the operation in Librarian for tracking
        store_result = store_knowledge_in_librarian(
            f"GitHub Operation: {operation_type} on {repository}",
            {"operation_type": operation_type, "repository": repository},
            ["github", "operation", operation_type]
        )
        
        return f"GitHub operation '{operation_type}' on '{repository}' completed. {store_result}"
        
    except Exception as e:
        return f"Error performing GitHub operation: {str(e)}"

@function_tool
def get_librarian_health() -> str:
    """Check the health of our local Librarian service"""
    try:
        response = requests.get(f"{LIBRARIAN_URL}/health", timeout=5)
        
        if response.status_code == 200:
            health_data = response.json()
            return f"Librarian service is healthy. Model: {health_data.get('embedding_model', 'unknown')}, Database: {health_data.get('database', 'unknown')}, Cache: {health_data.get('memory_cache', 0)} documents."
        else:
            return f"Librarian service health check failed: {response.status_code}"
            
    except Exception as e:
        return f"Error checking Librarian health: {str(e)}"

@function_tool
def list_available_agents() -> str:
    """List all available agents in our local system"""
    agent_list = []
    for agent_id, config in LOCAL_AGENTS.items():
        agent_list.append(f"- {config.name}: {config.description}")
    
    return f"Available local agents:\n" + "\n".join(agent_list)

class LocalAgencySwarmService:
    """Local Agency Swarm Service"""
    
    def __init__(self):
        self.agency = None
        self.agents = {}
        self.setup_agents()
        self.setup_agency()
    
    def setup_agents(self):
        """Setup local agents with custom tools"""
        print("🤖 Setting up local agents...")
        
        # Common tools for all agents
        common_tools = [
            store_knowledge_in_librarian,
            search_knowledge_in_librarian,
            get_librarian_health,
            list_available_agents
        ]
        
        # Specialized tools
        github_tools = [github_operation_local]
        
        for agent_id, config in LOCAL_AGENTS.items():
            # Select tools based on agent capabilities
            agent_tools = common_tools.copy()
            if 'github_operations' in config.capabilities:
                agent_tools.extend(github_tools)
            
            # Create agent
            agent = Agent(
                name=config.name,
                description=config.description,
                instructions=config.instructions,
                tools=agent_tools,
                model_settings=ModelSettings(**config.model_settings) if config.model_settings else None
            )
            
            self.agents[agent_id] = agent
            print(f"   ✅ {config.name} agent created with {len(agent_tools)} tools")
    
    def setup_agency(self):
        """Setup agency with communication flows"""
        print("🏢 Setting up agency with communication flows...")
        
        # Define communication flows
        communication_flows = [
            self.agents['ceo'] > self.agents['developer'],
            self.agents['ceo'] > self.agents['github_specialist'],
            self.agents['ceo'] > self.agents['knowledge_manager'],
            self.agents['developer'] > self.agents['github_specialist'],
            self.agents['developer'] > self.agents['knowledge_manager'],
            self.agents['github_specialist'] > self.agents['knowledge_manager'],
        ]
        
        # Create agency
        self.agency = Agency(
            self.agents['ceo'],  # CEO as entry point
            communication_flows=communication_flows,
            shared_instructions="""You are part of a local Universal AI Tools system.
            All operations are performed locally without external API calls.
            Use the Librarian service for knowledge management.
            Use the GitHub MCP for repository operations.
            Coordinate effectively with other agents to complete tasks."""
        )
        
        print(f"   ✅ Agency created with {len(communication_flows)} communication flows")
    
    async def execute_workflow(self, workflow_description: str, context: dict = None) -> str:
        """Execute a workflow through the agency"""
        try:
            print(f"🚀 Executing workflow: {workflow_description}")
            
            # Add context to workflow description
            if context:
                workflow_description += f"\n\nContext: {json.dumps(context, indent=2)}"
            
            # Execute through agency
            response = await self.agency.get_response(workflow_description)
            
            # Store workflow result in Librarian
            store_knowledge_in_librarian(
                f"Workflow Execution: {workflow_description}\nResult: {response.final_output}",
                {"workflow": workflow_description, "context": context},
                ["workflow", "execution", "agency-swarm"]
            )
            
            return response.final_output
            
        except Exception as e:
            error_msg = f"Workflow execution failed: {str(e)}"
            print(f"❌ {error_msg}")
            return error_msg
    
    def get_agent_status(self) -> dict:
        """Get status of all agents"""
        return {
            "agency_status": "running" if self.agency else "not_initialized",
            "agents": {
                agent_id: {
                    "name": config.name,
                    "capabilities": config.capabilities,
                    "tools_count": len(agent.tools) if hasattr(agent, 'tools') else 0
                }
                for agent_id, config in LOCAL_AGENTS.items()
                for agent in [self.agents.get(agent_id)]
                if agent
            },
            "librarian_url": LIBRARIAN_URL,
            "github_mcp_url": GITHUB_MCP_URL
        }
    
    def health_check(self) -> dict:
        """Perform health check of the service"""
        try:
            # Check Librarian service
            librarian_response = requests.get(f"{LIBRARIAN_URL}/health", timeout=5)
            librarian_healthy = librarian_response.status_code == 200
            
            return {
                "service": "agency-swarm-local",
                "status": "healthy",
                "agents_count": len(self.agents),
                "agency_initialized": self.agency is not None,
                "librarian_service": "healthy" if librarian_healthy else "unhealthy",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "service": "agency-swarm-local",
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Global service instance
agency_service = None

def get_agency_service() -> LocalAgencySwarmService:
    """Get or create the global agency service instance"""
    global agency_service
    if agency_service is None:
        agency_service = LocalAgencySwarmService()
    return agency_service

async def main():
    """Main function for testing"""
    print("🚀 Starting Local Agency Swarm Service...")
    
    # Initialize service
    service = get_agency_service()
    
    # Health check
    health = service.health_check()
    print(f"📊 Health Status: {json.dumps(health, indent=2)}")
    
    # Agent status
    status = service.get_agent_status()
    print(f"🤖 Agent Status: {json.dumps(status, indent=2)}")
    
    # Test workflow
    test_workflow = "Create a simple project structure and store the information in our knowledge base"
    result = await service.execute_workflow(test_workflow)
    print(f"📋 Workflow Result: {result}")

if __name__ == "__main__":
    asyncio.run(main())
