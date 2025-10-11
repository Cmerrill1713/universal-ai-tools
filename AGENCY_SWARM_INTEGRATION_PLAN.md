# Agency Swarm Integration Plan

## 🎯 **Objective**
Integrate the [Agency Swarm framework](https://github.com/VRSEN/agency-swarm) (3.8k stars, 970 forks) with our Universal AI Tools system, replacing our custom Agent Swarm implementation with this production-ready, reliable multi-agent orchestration framework.

## 📊 **Agency Swarm Analysis**

### **Key Features:**
- ✅ **Reliable Multi-Agent Orchestration**: Production-ready framework
- ✅ **OpenAI Agents SDK Extension**: Built on solid foundation
- ✅ **Type-Safe Tools**: Pydantic models with automatic validation
- ✅ **Orchestrated Communication**: Dedicated `send_message` tool
- ✅ **Flexible State Persistence**: Thread management callbacks
- ✅ **Communication Flows**: Explicit, directional agent interactions
- ✅ **Production-Ready**: Built for reliability and deployment

### **Architecture:**
```
Agency (CEO Agent Entry Point)
    ↓
Communication Flows (CEO > Developer > VirtualAssistant)
    ↓
Agent Tools (@function_tool, BaseTool, ToolFactory)
    ↓
State Persistence (load_threads_callback/save_threads_callback)
```

### **Installation:**
```bash
pip install -U agency-swarm
```

### **Compatibility:**
- **Python**: 3.12+
- **Models**: OpenAI GPT-5/GPT-4o, LiteLLM router (Anthropic, Google, Azure)
- **OS**: macOS, Linux, Windows

## 🚀 **Integration Strategy**

### **Phase 1: Agency Swarm Service Setup**
1. **Install Agency Swarm**: `pip install -U agency-swarm`
2. **Create Agency Swarm Service**: Python service with Agency Swarm
3. **Define Agent Roles**: CEO, Developer, VirtualAssistant, GitHub Specialist
4. **Setup Communication Flows**: Define agent interaction patterns

### **Phase 2: MCP Bridge Integration**
1. **Create Agency Swarm MCP Bridge**: Bridge between MCP and Agency Swarm
2. **Tool Integration**: Connect Agency Swarm tools with MCP tools
3. **State Management**: Integrate with our Librarian service
4. **GitHub Integration**: Connect with our GitHub MCP

### **Phase 3: Advanced Features**
1. **Custom Tools**: Create specialized tools for our use cases
2. **Persistence**: Integrate with Librarian for thread storage
3. **Monitoring**: Add observability and performance tracking
4. **Scaling**: Multi-agent workflows and dynamic agent creation

## 🛠️ **Implementation Plan**

### **Step 1: Agency Swarm Service**
```python
# src/services/agency-swarm-service/main.py
from agency_swarm import Agency, Agent, ModelSettings
from agency_swarm import function_tool

# Define custom tools
@function_tool
def github_operation(operation_type: str, repository: str, parameters: dict) -> str:
    """Perform GitHub operations through our GitHub MCP"""
    # Integration with GitHub MCP
    pass

@function_tool
def store_knowledge(content: str, metadata: dict) -> str:
    """Store knowledge in Librarian service"""
    # Integration with Librarian
    pass

# Define agents
ceo = Agent(
    name="CEO",
    description="Responsible for client communication, task planning and management.",
    instructions="You must converse with other agents to ensure complete task execution.",
    tools=[github_operation, store_knowledge],
    model_settings=ModelSettings(
        model="gpt-4o",
        max_tokens=25000,
    ),
)

developer = Agent(
    name="Developer",
    description="Responsible for code development and technical implementation.",
    instructions="Focus on technical implementation and code quality.",
    tools=[github_operation],
    model_settings=ModelSettings(
        model="gpt-4o",
        max_tokens=25000,
    ),
)

github_specialist = Agent(
    name="GitHubSpecialist",
    description="Specialized in GitHub operations and repository management.",
    instructions="Handle all GitHub-related tasks and operations.",
    tools=[github_operation],
    model_settings=ModelSettings(
        model="gpt-4o",
        max_tokens=25000,
    ),
)

# Create agency with communication flows
agency = Agency(
    ceo,  # CEO as entry point
    communication_flows=[
        ceo > developer,
        ceo > github_specialist,
        developer > github_specialist,
    ],
    shared_instructions='agency_manifesto.md',
)
```

### **Step 2: MCP Bridge**
```typescript
// src/mcp/agency-swarm-mcp-bridge.ts
class AgencySwarmMCPBridge {
  private agency: any; // Agency Swarm instance
  private librarianUrl: string;
  
  constructor() {
    this.librarianUrl = process.env.LIBRARIAN_URL || 'http://localhost:8032';
    this.setupAgencySwarm();
  }
  
  private async setupAgencySwarm() {
    // Initialize Agency Swarm with our agents
    // Setup communication flows
    // Integrate with Librarian for persistence
  }
  
  async executeWorkflow(workflow: string, context: any) {
    // Execute workflow through Agency Swarm
    const response = await this.agency.get_response(workflow, context);
    return response.final_output;
  }
}
```

### **Step 3: Librarian Integration**
```python
# Custom tools for Librarian integration
@function_tool
def store_agent_knowledge(content: str, agent_name: str, knowledge_type: str) -> str:
    """Store agent knowledge in Librarian service"""
    import requests
    
    librarian_url = "http://localhost:8032"
    response = requests.post(f"{librarian_url}/embed", json=[{
        "content": content,
        "metadata": {
            "type": "agent_knowledge",
            "agent_name": agent_name,
            "knowledge_type": knowledge_type,
            "source": "agency-swarm",
            "stored_at": datetime.now().isoformat(),
        },
        "context": {
            "agent_name": agent_name,
            "knowledge_type": knowledge_type,
        }
    }])
    
    return f"Knowledge stored: {response.json()}"

@function_tool
def search_agent_knowledge(query: str, limit: int = 10) -> str:
    """Search agent knowledge using Librarian service"""
    import requests
    
    librarian_url = "http://localhost:8032"
    response = requests.get(f"{librarian_url}/search?query={query}&limit={limit}")
    
    return f"Search results: {response.json()}"
```

## 📋 **Agency Swarm Tools (Enhanced)**

### **Agent Management Tools:**
- `agency_swarm_create_agent` - Create agents with Agency Swarm
- `agency_swarm_list_agents` - List Agency Swarm agents
- `agency_swarm_get_agent` - Get agent details
- `agency_swarm_update_agent` - Update agent configuration

### **Workflow Tools:**
- `agency_swarm_execute_workflow` - Execute multi-agent workflows
- `agency_swarm_monitor_workflow` - Monitor workflow progress
- `agency_swarm_collaborate` - Enable agent collaboration
- `agency_swarm_communication_flow` - Manage communication flows

### **GitHub Integration Tools:**
- `agency_swarm_github_automation` - GitHub operations through agents
- `agency_swarm_code_review` - Automated code review
- `agency_swarm_issue_management` - Issue management
- `agency_swarm_repository_management` - Repository operations

### **Knowledge Management Tools:**
- `agency_swarm_store_knowledge` - Store knowledge in Librarian
- `agency_swarm_search_knowledge` - Search agent knowledge
- `agency_swarm_share_context` - Share context between agents
- `agency_swarm_thread_management` - Manage conversation threads

## 🔧 **Technical Architecture**

```
Agency Swarm Service (Python)
    ↓
MCP Bridge (TypeScript)
    ↓
Librarian Service (Knowledge & Embeddings)
    ↓
GitHub MCP (Repository Operations)
    ↓
Agent Orchestrator (Rust MCTS) - Existing
```

## 📊 **Agency Swarm vs Custom Implementation**

### **Agency Swarm Advantages:**
- ✅ **Production-Ready**: 3.8k stars, active development
- ✅ **OpenAI Integration**: Native Agents SDK support
- ✅ **Type Safety**: Pydantic models and validation
- ✅ **Communication Flows**: Structured agent interactions
- ✅ **State Persistence**: Built-in thread management
- ✅ **Tool Ecosystem**: Rich tool development framework
- ✅ **Documentation**: Comprehensive docs and examples

### **Custom Implementation Advantages:**
- ✅ **Full Control**: Complete customization
- ✅ **Librarian Integration**: Direct integration
- ✅ **TypeScript**: Native TypeScript implementation
- ✅ **MCP Native**: Built for MCP protocol

### **Recommendation:**
**Hybrid Approach**: Use Agency Swarm as the core orchestration engine with our MCP bridge for integration.

## 🎯 **Implementation Steps**

### **Step 1: Setup Agency Swarm Service**
```bash
# Install Agency Swarm
pip install -U agency-swarm

# Create service directory
mkdir -p src/services/agency-swarm-service
```

### **Step 2: Create Agency Swarm Agents**
```python
# Define CEO, Developer, GitHub Specialist agents
# Setup communication flows
# Integrate with Librarian and GitHub MCP
```

### **Step 3: Create MCP Bridge**
```typescript
// Bridge between MCP and Agency Swarm
// Handle tool calls and responses
// Manage state and persistence
```

### **Step 4: Integration Testing**
```bash
# Test agent communication
# Test GitHub operations
# Test knowledge storage
# Test workflow execution
```

## 📈 **Success Metrics**

### **Performance Metrics:**
- Agent response time < 200ms
- Workflow completion rate > 95%
- Agent collaboration efficiency > 90%
- Knowledge retrieval accuracy > 95%

### **Integration Metrics:**
- Librarian service utilization > 80%
- GitHub MCP tool usage > 70%
- Agency Swarm uptime > 99%
- Cross-agent communication success > 95%

## 🚀 **Next Steps**

1. **Install Agency Swarm**: `pip install -U agency-swarm`
2. **Create Agency Swarm Service**: Python service with agents
3. **Build MCP Bridge**: TypeScript bridge for MCP integration
4. **Integrate with Librarian**: Knowledge storage and retrieval
5. **Test Integration**: Comprehensive testing and validation
6. **Deploy**: Production deployment with monitoring

---

**Status**: Research Complete ✅  
**Next**: Agency Swarm Service Implementation  
**Timeline**: 1-2 weeks for full integration  
**Repository**: [VRSEN/agency-swarm](https://github.com/VRSEN/agency-swarm)
