#!/usr/bin/env python3
"""
Integrate Personal Agents with Universal AI Tools Main Application
Creates unified API endpoints and dashboard integration for all personal agents
"""

import os
import shutil
from pathlib import Path

class PersonalAgentIntegrator:
    def __init__(self):
        self.project_root = Path("/Users/christianmerrill/Desktop/universal-ai-tools")
        self.dist_dir = self.project_root / "dist"
        self.personal_agents_dir = self.dist_dir / "personal"
        self.app_bundle = Path("/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources")
        
    def integrate_agents(self):
        """Integrate personal agents with main application"""
        print("🤖 Universal AI Tools - Personal Agents Integration")
        print("=" * 60)
        
        # Check if personal agents exist
        if not self.personal_agents_dir.exists():
            print("❌ Personal agents directory not found!")
            return False
            
        # Create integration endpoints
        self.create_agent_endpoints()
        
        # Update main server
        self.update_main_server()
        
        # Create agent dashboard
        self.create_agent_dashboard()
        
        # Update app bundle
        self.update_app_bundle()
        
        print("\n🎉 Personal agents successfully integrated!")
        return True
        
    def create_agent_endpoints(self):
        """Create API endpoints for personal agents"""
        print("\n📡 Creating personal agent API endpoints...")
        
        router_content = '''const express = require('express');
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

module.exports = PersonalAgentRouter;'''
        
        # Write the router file
        router_file = self.project_root / "personal_agent_router.js"
        with open(router_file, 'w') as f:
            f.write(router_content)
            
        print("   ✅ Personal agent API router created")
        
    def update_main_server(self):
        """Update main server to include personal agent endpoints"""
        print("\n🔧 Updating main server with personal agent integration...")
        
        server_path = self.app_bundle / "dist/server.js"
        
        # Read current server content
        if server_path.exists():
            with open(server_path, 'r') as f:
                content = f.read()
        else:
            print("   ❌ Server file not found")
            return
            
        # Check if already integrated
        if 'PersonalAgentRouter' in content:
            print("   ✅ Personal agents already integrated")
            return
            
        # Add personal agent router import
        import_line = "const PersonalAgentRouter = require('../../personal_agent_router');"
        
        # Find where to insert the import (after other requires)
        lines = content.split('\n')
        insert_index = 0
        for i, line in enumerate(lines):
            if line.startswith('const') and 'require(' in line:
                insert_index = i + 1
                
        # Insert import
        lines.insert(insert_index, import_line)
        
        # Add route mounting
        route_line = "app.use('/api/personal', PersonalAgentRouter(supabase));"
        
        # Find where to insert route (after other app.use statements)
        for i, line in enumerate(lines):
            if 'app.use(express.static' in line:
                lines.insert(i + 1, route_line)
                break
                
        # Update server file
        updated_content = '\n'.join(lines)
        with open(server_path, 'w') as f:
            f.write(updated_content)
            
        print("   ✅ Main server updated with personal agent endpoints")
        
    def create_agent_dashboard(self):
        """Create dashboard interface for personal agents"""
        print("\n🖥️  Creating personal agents dashboard...")
        
        dashboard_content = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Personal Agents - Universal AI Tools</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        
        .status-bar {
            padding: 1rem 2rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #28a745;
            animation: pulse 2s infinite;
        }
        
        .status-dot.offline {
            background: #dc3545;
            animation: none;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .main-content {
            padding: 2rem;
        }
        
        .agents-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .agent-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .agent-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.1);
        }
        
        .agent-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .agent-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: white;
        }
        
        .agent-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #2d3748;
        }
        
        .agent-description {
            color: #718096;
            margin-bottom: 1rem;
            line-height: 1.5;
        }
        
        .capabilities {
            margin-bottom: 1rem;
        }
        
        .capability-tag {
            display: inline-block;
            background: #f7fafc;
            color: #4a5568;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            margin: 0.25rem 0.25rem 0.25rem 0;
            border: 1px solid #e2e8f0;
        }
        
        .agent-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a67d8;
        }
        
        .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
        }
        
        .btn-secondary:hover {
            background: #cbd5e0;
        }
        
        .interaction-panel {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 1.5rem;
            margin-top: 2rem;
        }
        
        .interaction-header {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #2d3748;
        }
        
        .input-group {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .input-group input,
        .input-group select {
            flex: 1;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 1rem;
        }
        
        .input-group textarea {
            flex: 1;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 1rem;
            min-height: 100px;
            resize: vertical;
        }
        
        .result-area {
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 1rem;
            margin-top: 1rem;
            min-height: 100px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 0.9rem;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 2rem;
            color: #718096;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Personal Agents</h1>
            <p>Intelligent automation and assistance for your daily tasks</p>
        </div>
        
        <div class="status-bar">
            <div class="status-indicator">
                <div class="status-dot" id="statusDot"></div>
                <span id="statusText">Checking agent status...</span>
            </div>
            <div>
                <a href="/" class="btn btn-secondary">← Back to Main</a>
            </div>
        </div>
        
        <div class="main-content">
            <div class="agents-grid" id="agentsGrid">
                <!-- Agents will be loaded here -->
            </div>
            
            <div class="interaction-panel">
                <div class="interaction-header">🗣️ Agent Interaction</div>
                <div class="input-group">
                    <select id="agentSelect">
                        <option value="personal_assistant">Personal Assistant</option>
                    </select>
                </div>
                <div class="input-group">
                    <textarea id="requestInput" placeholder="Enter your request or question..."></textarea>
                </div>
                <div class="input-group">
                    <button class="btn btn-primary" onclick="executeAgent()">Execute Request</button>
                    <button class="btn btn-secondary" onclick="clearResult()">Clear</button>
                </div>
                
                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    <div>Processing your request...</div>
                </div>
                
                <div class="result-area" id="resultArea">Results will appear here...</div>
            </div>
        </div>
    </div>

    <script>
        let agentsAvailable = false;
        
        // Agent configurations
        const agentConfigs = {
            personal_assistant: { icon: '🤖', color: '#667eea' },
            calendar: { icon: '📅', color: '#f56565' },
            photo_organizer: { icon: '📸', color: '#38b2ac' },
            file_manager: { icon: '📁', color: '#ed8936' },
            code_assistant: { icon: '💻', color: '#9f7aea' },
            system_control: { icon: '⚙️', color: '#48bb78' }
        };
        
        // Load agents on page load
        document.addEventListener('DOMContentLoaded', async () => {
            await checkAgentStatus();
            await loadAgents();
        });
        
        async function checkAgentStatus() {
            try {
                const response = await fetch('/api/personal/status');
                const data = await response.json();
                
                agentsAvailable = data.available;
                const statusDot = document.getElementById('statusDot');
                const statusText = document.getElementById('statusText');
                
                if (agentsAvailable) {
                    statusDot.classList.remove('offline');
                    statusText.textContent = `${data.agents.length} personal agents available`;
                } else {
                    statusDot.classList.add('offline');
                    statusText.textContent = 'Personal agents not available';
                }
            } catch (error) {
                console.error('Error checking agent status:', error);
                document.getElementById('statusText').textContent = 'Error checking status';
            }
        }
        
        async function loadAgents() {
            const grid = document.getElementById('agentsGrid');
            const select = document.getElementById('agentSelect');
            
            if (!agentsAvailable) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #718096;">Personal agents are not currently available. This may be normal in production mode.</div>';
                return;
            }
            
            try {
                const response = await fetch('/api/personal/agents');
                const data = await response.json();
                
                if (data.success) {
                    grid.innerHTML = '';
                    select.innerHTML = '';
                    
                    data.agents.forEach(agent => {
                        const config = agentConfigs[agent.id] || { icon: '🤖', color: '#667eea' };
                        
                        // Add to grid
                        const card = createAgentCard(agent, config);
                        grid.appendChild(card);
                        
                        // Add to select
                        const option = document.createElement('option');
                        option.value = agent.id;
                        option.textContent = agent.name;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Error loading agents:', error);
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #e53e3e;">Error loading agents</div>';
            }
        }
        
        function createAgentCard(agent, config) {
            const card = document.createElement('div');
            card.className = 'agent-card';
            
            card.innerHTML = `
                <div class="agent-header">
                    <div class="agent-icon" style="background: ${config.color}">
                        ${config.icon}
                    </div>
                    <div>
                        <div class="agent-title">${agent.name}</div>
                    </div>
                </div>
                <div class="agent-description">${agent.description}</div>
                <div class="capabilities">
                    ${agent.capabilities.map(cap => `<span class="capability-tag">${cap.replace(/_/g, ' ')}</span>`).join('')}
                </div>
                <div class="agent-actions">
                    <button class="btn btn-primary" onclick="selectAgent('${agent.id}')">Use Agent</button>
                    <button class="btn btn-secondary" onclick="viewCapabilities('${agent.id}')">Details</button>
                </div>
            `;
            
            return card;
        }
        
        function selectAgent(agentId) {
            document.getElementById('agentSelect').value = agentId;
            document.getElementById('requestInput').focus();
        }
        
        async function viewCapabilities(agentId) {
            try {
                const response = await fetch(`/api/personal/capabilities/${agentId}`);
                const data = await response.json();
                
                if (data.success) {
                    const capabilities = data.capabilities;
                    alert(`${agentId} Capabilities:\\n\\nPrimary: ${capabilities.primary.join(', ')}\\n\\nSecondary: ${capabilities.secondary.join(', ')}`);
                }
            } catch (error) {
                alert('Error loading capabilities');
            }
        }
        
        async function executeAgent() {
            const agentId = document.getElementById('agentSelect').value;
            const request = document.getElementById('requestInput').value.trim();
            
            if (!request) {
                alert('Please enter a request');
                return;
            }
            
            const loading = document.getElementById('loading');
            const resultArea = document.getElementById('resultArea');
            
            loading.style.display = 'block';
            resultArea.textContent = '';
            
            try {
                const response = await fetch('/api/personal/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: agentId,
                        request: request,
                        context: { timestamp: new Date().toISOString() }
                    })
                });
                
                const data = await response.json();
                
                loading.style.display = 'none';
                
                if (data.success) {
                    resultArea.textContent = JSON.stringify(data, null, 2);
                } else {
                    resultArea.textContent = `Error: ${data.error}`;
                }
            } catch (error) {
                loading.style.display = 'none';
                resultArea.textContent = `Network Error: ${error.message}`;
            }
        }
        
        function clearResult() {
            document.getElementById('resultArea').textContent = 'Results will appear here...';
            document.getElementById('requestInput').value = '';
        }
    </script>
</body>
</html>'''
        
        dashboard_file = self.project_root / "personal_agents_dashboard.html"
        with open(dashboard_file, 'w') as f:
            f.write(dashboard_content)
            
        # Copy to app bundle
        if self.app_bundle.exists():
            shutil.copy2(dashboard_file, self.app_bundle / "personal_agents_dashboard.html")
            
        print("   ✅ Personal agents dashboard created")
        
    def update_app_bundle(self):
        """Update app bundle with personal agent integration"""
        print("\n📦 Updating app bundle with personal agents...")
        
        # Copy personal agent router to app bundle
        router_source = self.project_root / "personal_agent_router.js"
        if router_source.exists() and self.app_bundle.exists():
            shutil.copy2(router_source, self.app_bundle / "personal_agent_router.js")
            print("   ✅ Personal agent router copied to app bundle")
            
        # Copy personal agents if they exist
        if self.personal_agents_dir.exists() and self.app_bundle.exists():
            dest_dir = self.app_bundle / "dist" / "personal"
            if dest_dir.exists():
                shutil.rmtree(dest_dir)
            shutil.copytree(self.personal_agents_dir, dest_dir)
            print("   ✅ Personal agents copied to app bundle")
            
        print("   ✅ App bundle updated with personal agent integration")

def main():
    integrator = PersonalAgentIntegrator()
    integrator.integrate_agents()

if __name__ == "__main__":
    main()