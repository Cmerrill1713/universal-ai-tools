/**
 * DSPy Enhanced Sweet Athena Chat Component
 * 
 * Enhanced chat interface that integrates Sweet Athena's personality system
 * with DSPy orchestration for intelligent multi-agent conversations.
 * 
 * @fileoverview DSPy-enhanced chat interface
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { orchestrationApi, agentsApi, OrchestrationRequest, OrchestrationResponse, AgentItem } from '../../../lib/api';
import type { PersonalityMood, ChatMessage, MessageRole } from '../types';

export interface DSPyEnhancedChatProps {
  mood?: PersonalityMood;
  isLoading?: boolean;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  enableVoice?: boolean;
  enableAgentSelection?: boolean;
  enableWorkflowManagement?: boolean;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  conversationId?: string;
  sessionId?: string;
}

interface ExtendedChatMessage extends ChatMessage {
  orchestrationData?: {
    mode: string;
    confidence: number;
    participatingAgents: string[];
    reasoning?: string;
    executionTime: number;
  };
  workflowStep?: {
    stepId: string;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    assignedAgent?: string;
  };
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'thinking' | 'offline';
  currentTask?: string;
  performance: {
    successRate: number;
    avgResponseTime: number;
    tasksCompleted: number;
  };
}

export const DSPyEnhancedChat: React.FC<DSPyEnhancedChatProps> = ({
  mood = 'sweet',
  isLoading = false,
  onMessage,
  onError,
  enableVoice = false,
  enableAgentSelection = true,
  enableWorkflowManagement = true,
  orchestrationMode = 'standard',
  conversationId = 'dspy-athena-chat',
  sessionId
}) => {
  // State management
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [availableAgents, setAvailableAgents] = useState<AgentItem[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<any>(null);
  const [orchestrationLoading, setOrchestrationLoading] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = await agentsApi.list();
        setAvailableAgents(agents);
        
        // Initialize agent statuses
        const statuses: AgentStatus[] = agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          status: 'idle',
          performance: {
            successRate: 0.85 + Math.random() * 0.15, // Mock data
            avgResponseTime: 500 + Math.random() * 1000,
            tasksCompleted: Math.floor(Math.random() * 100)
          }
        }));
        setAgentStatuses(statuses);
      } catch (error) {
        console.error('Failed to load agents:', error);
        onError?.('Failed to load available agents');
      }
    };
    
    loadAgents();
  }, [onError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle message sending with DSPy orchestration
  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setOrchestrationLoading(true);

    try {
      // Update agent statuses to show activity
      if (selectedAgents.length > 0) {
        setAgentStatuses(prev => prev.map(status => 
          selectedAgents.includes(status.id) 
            ? { ...status, status: 'thinking' as const, currentTask: input.substring(0, 50) + '...' }
            : status
        ));
      }

      // Create orchestration request
      const request: OrchestrationRequest = {
        userRequest: input.trim(),
        orchestrationMode,
        context: {
          conversationId,
          sessionId: sessionId || `session-${Date.now()}`,
          selectedAgents,
          personalityMood: mood,
          enableWorkflow: enableWorkflowManagement
        }
      };

      // Call DSPy orchestration
      const orchestrationResult = await orchestrationApi.orchestrate(request);

      // Create assistant response with orchestration data
      const assistantMessage: ExtendedChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: orchestrationResult.data?.response || orchestrationResult.data || 'I\'m processing your request through the agent network...',
        timestamp: new Date(),
        orchestrationData: {
          mode: orchestrationResult.mode,
          confidence: orchestrationResult.confidence,
          participatingAgents: orchestrationResult.participatingAgents,
          reasoning: orchestrationResult.reasoning,
          executionTime: orchestrationResult.executionTime
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
      onMessage?.(assistantMessage);

      // Update agent statuses
      setAgentStatuses(prev => prev.map(status => {
        const wasParticipating = orchestrationResult.participatingAgents.includes(status.name);
        return wasParticipating
          ? { 
              ...status, 
              status: 'idle' as const, 
              currentTask: undefined,
              performance: {
                ...status.performance,
                tasksCompleted: status.performance.tasksCompleted + 1,
                successRate: Math.min(0.99, status.performance.successRate + 0.01)
              }
            }
          : status;
      }));

    } catch (error) {
      console.error('DSPy orchestration failed:', error);
      const errorMessage: ExtendedChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      onError?.(error instanceof Error ? error.message : 'Orchestration failed');

      // Reset agent statuses
      setAgentStatuses(prev => prev.map(status => ({
        ...status,
        status: 'idle' as const,
        currentTask: undefined
      })));
    } finally {
      setOrchestrationLoading(false);
    }
  }, [input, orchestrationMode, conversationId, sessionId, selectedAgents, mood, enableWorkflowManagement, onMessage, onError]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle agent selection
  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // Get mood-based responses
  const getMoodBasedGreeting = () => {
    const greetings = {
      sweet: "Hello there! ✨ I'm Sweet Athena, ready to help with my amazing agent team!",
      shy: "Oh... h-hello! I'm Athena... I have some friends who can help us... 😊",
      confident: "Greetings! I'm Athena and I command a powerful network of AI agents! 💪",
      caring: "Welcome, dear friend. I'm Athena, and together with my caring agent family, we're here for you. 💗",
      playful: "Hey there, awesome human! 🎉 I'm Athena and we're about to have some AI-powered fun!"
    };
    return greetings[mood] || greetings.sweet;
  };

  // Show greeting if no messages
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: ExtendedChatMessage = {
        id: 'greeting',
        role: 'assistant',
        content: getMoodBasedGreeting(),
        timestamp: new Date()
      };
      setMessages([greeting]);
    }
  }, [mood]); // Re-trigger when mood changes

  return (
    <div className={`dspy-enhanced-chat dspy-enhanced-chat--${mood}`}>
      {/* Header with controls */}
      <div className="chat-header">
        <div className="header-title">
          <h3>Sweet Athena DSPy Chat</h3>
          <span className="orchestration-mode">{orchestrationMode} mode</span>
        </div>
        <div className="header-controls">
          {enableAgentSelection && (
            <button 
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className={`control-button ${showAgentPanel ? 'active' : ''}`}
              title="Manage Agents"
            >
              🤖 Agents ({selectedAgents.length})
            </button>
          )}
          {enableWorkflowManagement && (
            <button 
              onClick={() => setShowWorkflowPanel(!showWorkflowPanel)}
              className={`control-button ${showWorkflowPanel ? 'active' : ''}`}
              title="Workflow Management"
            >
              📋 Workflow
            </button>
          )}
          {enableVoice && (
            <button className="control-button" title="Voice Input">
              🎤 Voice
            </button>
          )}
        </div>
      </div>

      <div className="chat-content">
        {/* Agent Selection Panel */}
        {showAgentPanel && (
          <div className="side-panel agent-panel">
            <h4>Available Agents</h4>
            <div className="agent-list">
              {availableAgents.map(agent => {
                const status = agentStatuses.find(s => s.id === agent.id);
                const isSelected = selectedAgents.includes(agent.id);
                
                return (
                  <div key={agent.id} className={`agent-item ${isSelected ? 'selected' : ''}`}>
                    <label className="agent-selector">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAgentSelection(agent.id)}
                      />
                      <div className="agent-info">
                        <div className="agent-name">
                          {agent.name}
                          <span className={`status-indicator status-${status?.status}`} />
                        </div>
                        <div className="agent-description">{agent.description}</div>
                        {status?.currentTask && (
                          <div className="current-task">Task: {status.currentTask}</div>
                        )}
                        <div className="agent-metrics">
                          <span>Success: {(status?.performance.successRate * 100 || 0).toFixed(0)}%</span>
                          <span>Tasks: {status?.performance.tasksCompleted || 0}</span>
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Workflow Panel */}
        {showWorkflowPanel && (
          <div className="side-panel workflow-panel">
            <h4>Workflow Management</h4>
            <div className="workflow-status">
              {currentWorkflow ? (
                <div className="active-workflow">
                  <h5>{currentWorkflow.name}</h5>
                  <div className="workflow-steps">
                    {currentWorkflow.steps?.map((step: any, index: number) => (
                      <div key={index} className={`workflow-step step-${step.status}`}>
                        <span className="step-number">{index + 1}</span>
                        <span className="step-name">{step.name}</span>
                        <span className={`step-status status-${step.status}`}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-workflow">
                  <p>No active workflow</p>
                  <p>Send a complex request to create a workflow</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="messages-container">
          <div className="chat-messages">
            {messages.map(message => (
              <div key={message.id} className={`message message--${message.role}`}>
                <div className="message-content">
                  {message.content}
                  {message.orchestrationData && (
                    <div className="orchestration-info">
                      <div className="orchestration-summary">
                        <span className="confidence">Confidence: {(message.orchestrationData.confidence * 100).toFixed(0)}%</span>
                        <span className="execution-time">{message.orchestrationData.executionTime}ms</span>
                        <span className="mode">{message.orchestrationData.mode}</span>
                      </div>
                      {message.orchestrationData.participatingAgents.length > 0 && (
                        <div className="participating-agents">
                          <span className="label">Agents:</span>
                          {message.orchestrationData.participatingAgents.map((agent, idx) => (
                            <span key={idx} className="agent-tag">{agent}</span>
                          ))}
                        </div>
                      )}
                      {message.orchestrationData.reasoning && (
                        <details className="reasoning-details">
                          <summary>Reasoning</summary>
                          <p>{message.orchestrationData.reasoning}</p>
                        </details>
                      )}
                    </div>
                  )}
                </div>
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            {(orchestrationLoading || isLoading) && (
              <div className="message message--assistant">
                <div className="message-content">
                  <div className="orchestration-loading">
                    <div className="loading-animation">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>Orchestrating with agent network...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="input-controls">
          <select 
            value={orchestrationMode} 
            onChange={(e) => window.dispatchEvent(new CustomEvent('updateOrchestrationMode', { detail: e.target.value }))}
            className="mode-selector"
          >
            <option value="simple">Simple</option>
            <option value="standard">Standard</option>
            <option value="cognitive">Cognitive</option>
            <option value="adaptive">Adaptive</option>
          </select>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Chat with Sweet Athena and her agent team (${mood} mode)...`}
          rows={2}
          disabled={orchestrationLoading || isLoading}
          className="message-input"
        />
        <button 
          onClick={handleSendMessage}
          disabled={!input.trim() || orchestrationLoading || isLoading}
          className="send-button"
        >
          {orchestrationLoading ? 'Orchestrating...' : 'Send ✨'}
        </button>
      </div>

      <style>{`
        .dspy-enhanced-chat {
          display: flex;
          flex-direction: column;
          height: 600px;
          max-width: 1200px;
          margin: 0 auto;
          border: 2px solid;
          border-radius: 16px;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%);
          border-bottom: 1px solid #e2e8f0;
          backdrop-filter: blur(10px);
        }

        .header-title h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .orchestration-mode {
          font-size: 12px;
          color: #64748b;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 12px;
          margin-left: 8px;
        }

        .header-controls {
          display: flex;
          gap: 8px;
        }

        .control-button {
          padding: 6px 12px;
          background: #e2e8f0;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-button:hover {
          background: #cbd5e1;
        }

        .control-button.active {
          background: #3b82f6;
          color: white;
        }

        .chat-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .side-panel {
          width: 280px;
          border-right: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.8);
          overflow-y: auto;
        }

        .side-panel h4 {
          margin: 0;
          padding: 16px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
        }

        .agent-list {
          padding: 8px;
        }

        .agent-item {
          margin-bottom: 8px;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .agent-item.selected {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }

        .agent-selector {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          cursor: pointer;
          width: 100%;
        }

        .agent-info {
          flex: 1;
          min-width: 0;
        }

        .agent-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          font-size: 13px;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-idle { background: #10b981; }
        .status-working { background: #f59e0b; }
        .status-thinking { background: #8b5cf6; }
        .status-offline { background: #6b7280; }

        .agent-description {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 6px;
          line-height: 1.3;
        }

        .current-task {
          font-size: 10px;
          color: #7c3aed;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .agent-metrics {
          display: flex;
          gap: 8px;
          font-size: 10px;
          color: #6b7280;
        }

        .messages-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }

        .message {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }

        .message--user {
          align-items: flex-end;
        }

        .message--assistant {
          align-items: flex-start;
        }

        .message-content {
          max-width: 80%;
          padding: 16px 20px;
          border-radius: 20px;
          font-size: 14px;
          line-height: 1.5;
        }

        .message--user .message-content {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .message--assistant .message-content {
          background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
          color: #333;
        }

        .orchestration-info {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .orchestration-summary {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .orchestration-summary span {
          font-size: 11px;
          background: rgba(0,0,0,0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .participating-agents {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .participating-agents .label {
          font-size: 11px;
          font-weight: 500;
        }

        .agent-tag {
          font-size: 10px;
          background: #3b82f6;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .reasoning-details {
          margin-top: 8px;
        }

        .reasoning-details summary {
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          color: #6b7280;
        }

        .reasoning-details p {
          font-size: 11px;
          margin: 4px 0 0 0;
          color: #6b7280;
          line-height: 1.4;
        }

        .orchestration-loading {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading-animation {
          display: flex;
          gap: 4px;
        }

        .loading-animation span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8b5cf6;
          animation: orchestrating 1.4s infinite;
        }

        .loading-animation span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .loading-animation span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes orchestrating {
          0%, 60%, 100% {
            transform: scale(0.6) translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: scale(1) translateY(-8px);
            opacity: 1;
          }
        }

        .message-time {
          font-size: 11px;
          color: #6b7280;
          margin-top: 6px;
          padding: 0 8px;
        }

        .chat-input-area {
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .input-controls {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mode-selector {
          padding: 6px 8px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          background: white;
        }

        .message-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
        }

        .message-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .send-button {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* Mood-specific border colors */
        .dspy-enhanced-chat--sweet {
          border-color: #fbb6ce;
        }

        .dspy-enhanced-chat--confident {
          border-color: #60a5fa;
        }

        .dspy-enhanced-chat--playful {
          border-color: #a78bfa;
        }

        .dspy-enhanced-chat--caring {
          border-color: #34d399;
        }

        .dspy-enhanced-chat--shy {
          border-color: #f9a8d4;
        }

        /* Workflow Panel Styles */
        .workflow-panel {
          padding: 0;
        }

        .workflow-status {
          padding: 16px;
        }

        .no-workflow {
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }

        .active-workflow h5 {
          margin: 0 0 12px 0;
          color: #1e293b;
          font-size: 14px;
        }

        .workflow-step {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          margin-bottom: 4px;
          font-size: 12px;
        }

        .step-number {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #e5e7eb;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          font-size: 10px;
        }

        .step-name {
          flex: 1;
          color: #374151;
        }

        .step-status {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .step-pending { background: #f3f4f6; color: #6b7280; }
        .step-in_progress { background: #dbeafe; color: #1d4ed8; }
        .step-completed { background: #d1fae5; color: #065f46; }
        .step-failed { background: #fee2e2; color: #dc2626; }
      `}</style>
    </div>
  );
};

export default DSPyEnhancedChat;