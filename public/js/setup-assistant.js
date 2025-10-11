// Setup Assistant Chat UI
const API_BASE = 'http://localhost:9999/api';
let apiKey = null;
let currentTemplate = 'new-project';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkServices();
    loadRecentSetups();
    setupEventListeners();
    registerService();
});

// Register this UI as a service
async function registerService() {
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_name: 'setup-assistant-ui',
                service_type: 'custom',
                capabilities: ['setup_assistance', 'code_generation', 'integration_help']
            })
        });
        
        const data = await response.json();
        apiKey = data.api_key;
        console.log('Registered with Universal AI Tools');
    } catch (error) {
        console.error('Failed to register:', error);
    }
}

// Check service status
async function checkServices() {
    // Check API
    try {
        const response = await fetch(`${API_BASE.replace('/api', '/health')}`);
        if (response.ok) {
            document.querySelector('#api-status .status-indicator').classList.remove('offline');
            document.querySelector('#api-status').innerHTML = 'API: <span class="status-indicator"></span>';
        }
    } catch (error) {
        document.querySelector('#api-status .status-indicator').classList.add('offline');
        document.querySelector('#api-status').innerHTML = 'API: <span class="status-indicator offline"></span>';
    }
    
    // Check Ollama via our API endpoint
    try {
        const response = await fetch(`${API_BASE}/ollama/status`);
        const data = await response.json();
        
        if (data.status === 'available' && data.active_model) {
            document.querySelector('#ollama-status .status-indicator').classList.remove('offline');
            document.querySelector('#ollama-status').innerHTML = `Ollama: ${data.active_model} <span class="status-indicator"></span>`;
        } else {
            document.querySelector('#ollama-status .status-indicator').classList.add('offline');
            document.querySelector('#ollama-status').innerHTML = 'Ollama: Offline <span class="status-indicator offline"></span>';
        }
    } catch (error) {
        document.querySelector('#ollama-status .status-indicator').classList.add('offline');
        document.querySelector('#ollama-status').innerHTML = 'Ollama: Error <span class="status-indicator offline"></span>';
    }
}

// Load recent setups from memory
async function loadRecentSetups() {
    if (!apiKey) return;
    
    try {
        const response = await fetch(`${API_BASE}/memory/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'X-AI-Service': 'setup-assistant-ui'
            },
            body: JSON.stringify({
                query: 'setup completed',
                memory_type: 'episodic',
                limit: 5
            })
        });
        
        const data = await response.json();
        const recentList = document.getElementById('recent-setups');
        
        if (data.memories && data.memories.length > 0) {
            recentList.innerHTML = data.memories.map(memory => {
                const content = JSON.parse(memory.content);
                return `<li class="template-item" onclick="loadPreviousSetup('${memory.id}')">${content.name || 'Previous Setup'}</li>`;
            }).join('');
        } else {
            recentList.innerHTML = '<li class="template-item">No recent setups</li>';
        }
    } catch (error) {
        console.error('Failed to load recent setups:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Template selection
    document.querySelectorAll('.template-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.template-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            currentTemplate = e.target.dataset.template;
            if (currentTemplate) {
                startTemplateSetup(currentTemplate);
            }
        });
    });
    
    // Input field auto-resize
    const input = document.getElementById('user-input');
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    });
    
    // Enter to send (Shift+Enter for new line)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// Send message
async function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    if (!message) return;
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Add user message
    addMessage(message, 'user');
    
    // Show loading
    const loadingId = addMessage('<div class="loading-dots"><span></span><span></span><span></span></div>', 'assistant');
    
    try {
        // Use our enhanced chat endpoint
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                sessionId: 'web_ui_session'
            })
        });
        
        const data = await response.json();
        
        // Remove loading
        document.getElementById(loadingId).remove();
        
        // Add the response
        addMessage(data.response, 'assistant');
        
        // If it's a setup assistance response with detailed data, show additional info
        if (data.type === 'setup_assistance' && data.data) {
            showSetupDetails(data.data);
        }
        
    } catch (error) {
        document.getElementById(loadingId).remove();
        addMessage('Sorry, I encountered an error. Please check if the services are running.', 'assistant');
    }
}

// Show setup details for enhanced responses
function showSetupDetails(data) {
    if (data.suggested_tools && data.suggested_tools.length > 0) {
        addMessage(`🛠️ **Suggested Tools:** ${data.suggested_tools.join(', ')}`, 'assistant');
    }
    
    if (data.setup_steps && data.setup_steps.length > 0) {
        const stepsText = data.setup_steps.map((step, index) => 
            `${index + 1}. ${step}`
        ).join('\n');
        addMessage(`📋 **Setup Steps:**\n${stepsText}`, 'assistant');
    }
    
    if (data.additional_recommendations && data.additional_recommendations.length > 0) {
        const recommendationsText = data.additional_recommendations.map(rec => `• ${rec}`).join('\n');
        addMessage(`💡 **Additional Recommendations:**\n${recommendationsText}`, 'assistant');
    }
    
    if (data.estimated_complexity) {
        const complexityEmoji = {
            'low': '🟢',
            'medium': '🟡', 
            'high': '🔴'
        };
        addMessage(`${complexityEmoji[data.estimated_complexity]} **Estimated Complexity:** ${data.estimated_complexity.toUpperCase()}`, 'assistant');
    }
    
    // Show orchestration details if available
    if (data.orchestration_analysis) {
        const analysis = data.orchestration_analysis;
        addMessage(`🎯 **Confidence:** ${(analysis.confidence * 100).toFixed(1)}%`, 'assistant');
        if (analysis.agents_orchestrated) {
            addMessage(`🤖 **Agents Used:** ${analysis.agents_orchestrated.join(', ')}`, 'assistant');
        }
    }
}

// This function is no longer needed since we use the chat endpoint directly
// Keeping it for backwards compatibility but it won't be called
async function processUserRequest(message, suggestions) {
    // This is now handled by the chat endpoint
}

// Handle connection request
async function handleConnectionRequest(message) {
    // Extract language and framework
    const languages = ['python', 'javascript', 'typescript', 'go', 'rust', 'java'];
    const frameworks = ['flask', 'django', 'express', 'fastapi', 'react', 'vue', 'gin', 'fiber'];
    
    let language = languages.find(lang => message.toLowerCase().includes(lang)) || 'python';
    let framework = frameworks.find(fw => message.toLowerCase().includes(fw)) || 'flask';
    
    addMessage(`I'll help you connect your ${language} application. Generating integration code...`, 'assistant');
    
    try {
        const response = await fetch(`${API_BASE}/assistant/generate-integration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language,
                framework,
                purpose: message
            })
        });
        
        const data = await response.json();
        
        addMessage(`Here's your ${language} integration code:`, 'assistant');
        addMessage(`<pre><code>${escapeHtml(data.code)}</code></pre>`, 'assistant');
        
        // Save to memory
        if (apiKey) {
            await saveSetupToMemory({
                type: 'connection',
                language,
                framework,
                purpose: message,
                code: data.code
            });
        }
        
        addMessage('I\'ve saved this setup to memory. You can find it in your recent setups.', 'system');
        
    } catch (error) {
        addMessage('Failed to generate integration code. Please check if the services are running.', 'assistant');
    }
}

// Handle tool creation
async function handleToolCreation(message) {
    addMessage('Let me help you create a custom tool. What should this tool do?', 'assistant');
    
    // Extract tool details from message
    const toolName = message.match(/tool.+?called\s+(\w+)/i)?.[1] || 'custom_tool';
    const description = message;
    
    try {
        const response = await fetch(`${API_BASE}/assistant/create-tool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: toolName,
                description: description,
                requirements: message,
                save: false
            })
        });
        
        const data = await response.json();
        
        addMessage('Here\'s your custom tool implementation:', 'assistant');
        addMessage(`<pre><code>${JSON.stringify(data.tool, null, 2)}</code></pre>`, 'assistant');
        
        addMessage('Would you like me to save this tool to the system? (Type "yes" to save)', 'assistant');
        
    } catch (error) {
        addMessage('Failed to create tool. Please try again.', 'assistant');
    }
}

// Handle setup request
async function handleSetupRequest(message) {
    const setupSteps = [
        '1. 📁 Creating project structure',
        '2. 📦 Installing dependencies',
        '3. 🔧 Configuring environment',
        '4. 🔗 Connecting to Universal AI Tools',
        '5. ✅ Setup complete!'
    ];
    
    addMessage('Starting setup process...', 'assistant');
    
    for (const step of setupSteps) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        addMessage(step, 'system');
    }
    
    addMessage('Setup completed! Here are your next steps:', 'assistant');
    addMessage(`
- Start the Universal AI service: \`npm run dev\`
- Register your application to get an API key
- Use the generated integration code
- Store memories and context as needed
    `, 'assistant');
}

// Show saved setups
async function showSavedSetups() {
    await loadRecentSetups();
    addMessage('I\'ve updated your recent setups in the sidebar. Click any to load its configuration.', 'assistant');
}

// Provide general help
async function provideGeneralHelp(message, suggestions) {
    if (suggestions && suggestions.suggested_tools) {
        // Enhanced response format
        addMessage(`🎯 **Recommended Tools:** ${suggestions.suggested_tools.join(', ')}`, 'assistant');
        
        if (suggestions.reasoning) {
            addMessage(`💡 **Why these tools?**\n${suggestions.reasoning}`, 'assistant');
        }
        
        if (suggestions.setup_steps && suggestions.setup_steps.length > 0) {
            const stepsText = suggestions.setup_steps.map((step, index) => 
                `${index + 1}. ${step}`
            ).join('\n');
            addMessage(`📋 **Setup Steps:**\n${stepsText}`, 'assistant');
        }
        
        if (suggestions.additional_recommendations) {
            addMessage(`⚠️ **Additional Recommendations:**\n${suggestions.additional_recommendations}`, 'assistant');
        }
        
        if (suggestions.estimated_complexity) {
            const complexityEmoji = {
                'low': '🟢',
                'medium': '🟡', 
                'high': '🔴'
            };
            addMessage(`${complexityEmoji[suggestions.estimated_complexity]} **Estimated Complexity:** ${suggestions.estimated_complexity.toUpperCase()}`, 'assistant');
        }
        
        // Show quick actions based on suggested tools
        if (suggestions.suggested_tools.includes('trading_data_provider')) {
            addMessage('🚀 **Quick Actions:** I can help you set up exchange API connections, configure risk management, or create trading strategies.', 'assistant');
        } else if (suggestions.suggested_tools.includes('web_scraper')) {
            addMessage('🚀 **Quick Actions:** I can generate scraping code, set up data pipelines, or create monitoring dashboards.', 'assistant');
        } else if (suggestions.suggested_tools.includes('ai_model_connector')) {
            addMessage('🚀 **Quick Actions:** I can help you integrate LLMs, set up conversation memory, or create AI-powered features.', 'assistant');
        } else if (suggestions.suggested_tools.includes('deployment_manager')) {
            addMessage('🚀 **Quick Actions:** I can create CI/CD pipelines, configure monitoring, or set up production environments.', 'assistant');
        } else {
            addMessage('🚀 **Quick Actions:** I can generate integration code, create custom tools, or help with specific configurations.', 'assistant');
        }
        
    } else {
        addMessage('I can help you with:\n- Connecting any application to Universal AI Tools\n- Creating custom tools\n- Setting up development environments\n- Generating integration code\n\nWhat would you like to do?', 'assistant');
    }
}

// Start template setup
function startTemplateSetup(template) {
    const templates = {
        'python': 'I want to set up a Python environment',
        'nodejs': 'I want to set up a Node.js application',
        'docker': 'I want to set up Docker containers',
        'database': 'I want to set up a database',
        'api': 'I want to set up API integration',
        'ai-model': 'I want to set up an AI model',
        'monitoring': 'I want to set up monitoring tools'
    };
    
    const message = templates[template] || 'I want to set up a new project';
    
    // Use our sendMessage function to process this through the chat endpoint
    document.getElementById('user-input').value = message;
    sendMessage();
}

// Quick actions
function quickAction(action) {
    document.getElementById('user-input').value = action;
    sendMessage();
}

// Add message to chat
function addMessage(content, type) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now();
    
    messageDiv.id = messageId;
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = formatMessage(content);
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return messageId;
}

// Format message content with markdown-style formatting
function formatMessage(content) {
    // Convert **text** to <strong>text</strong>
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert newlines to <br> but preserve existing HTML
    if (!content.includes('<')) {
        content = content.replace(/\n/g, '<br>');
    }
    
    // Convert numbered lists
    content = content.replace(/^(\d+\.\s+.+)$/gm, '<li>$1</li>');
    if (content.includes('<li>')) {
        content = content.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    }
    
    return content;
}

// Save setup to memory
async function saveSetupToMemory(setupData) {
    if (!apiKey) return;
    
    try {
        await fetch(`${API_BASE}/memory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'X-AI-Service': 'setup-assistant-ui'
            },
            body: JSON.stringify({
                memory_type: 'episodic',
                content: JSON.stringify({
                    ...setupData,
                    timestamp: new Date().toISOString(),
                    name: `${setupData.language} ${setupData.framework} setup`
                }),
                tags: ['setup', setupData.language, setupData.framework],
                importance: 0.8
            })
        });
    } catch (error) {
        console.error('Failed to save to memory:', error);
    }
}

// Load previous setup
async function loadPreviousSetup(memoryId) {
    addMessage('Loading previous setup configuration...', 'system');
    // Implementation would fetch the specific memory and replay the setup
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-refresh service status
setInterval(checkServices, 30000);