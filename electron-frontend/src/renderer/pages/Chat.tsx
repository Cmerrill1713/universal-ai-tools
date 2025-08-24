import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  MicrophoneIcon,
  StopIcon,
  UserIcon,
  CpuChipIcon,
  ClockIcon,
  CheckIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  DocumentIcon,
  EyeIcon,
  ServerIcon,
  WindowIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { useStore } from '../store/useStore';
import { useTaskWindows } from '../hooks/useTaskWindows';
import TaskWindow from '../components/TaskWindow';
import { TaskWindowManager } from '../services/taskWindowManager';
import type { TaskWindow as TaskWindowType } from '../services/taskWindowManager';

import Logger from '../utils/logger';
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered';
  typing?: boolean;
}

const Chat: React.ComponentType = () => {
  // Use store for state management
  const {
    messages,
    isTyping,
    streamingContent,
    agents,
    selectedAgent,
    connectionStatus,
    addMessage,
    updateMessage,
    setTyping,
    setStreamingContent,
    setAgents,
    selectAgent,
    setConnectionStatus,
  } = useStore();

  // Local component state
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [activeTaskWindow, setActiveTaskWindow] = useState<TaskWindowType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Task windows management
  const {
    taskWindows: _taskWindows,
    activeTaskWindows,
    isConnected: taskWSConnected,
    executeAgentOperation,
    closeTaskWindow: _closeTaskWindow,
    cancelTask,
  } = useTaskWindows({
    backendUrl: 'http://localhost:8082',
    maxConcurrentTasks: 3,
    autoCloseCompletedTasks: false,
  });

  // Add welcome message if no messages exist
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        content:
          "Hello! I'm your Universal AI Assistant with specialized agents. How can I help you today?",
        sender: 'assistant',
        status: 'delivered',
      });
    }
  }, [messages.length, addMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load agents and check connection status
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Check connection status
        const isConnected = apiService.getConnectionStatus();
        setConnectionStatus({ isConnected });

        if (isConnected) {
          // Load available agents
          const agentList = await apiService.getAgents();
          setAgents(agentList);

          // Set default agent if none selected
          if (!selectedAgent && agentList.length > 0) {
            // Prefer Code Generator for coding tasks, or first available agent
            const defaultAgent = agentList.find((a: any) => a.type === 'coding') || agentList[0];
            if (defaultAgent) {
              selectAgent(defaultAgent.id);
            }
          }
        }
      } catch (_error) {
        if (process.env.NODE_ENV === 'development') {
          Logger.error('Failed to initialize chat:', _error);
        }
      }
    };

    initializeChat();
    const interval = setInterval(() => {
      const isConnected = apiService.getConnectionStatus();
      setConnectionStatus({ isConnected });
    }, 5000);

    return () => clearInterval(interval);
  }, [setConnectionStatus, setAgents, selectAgent, selectedAgent]);

  // Close agent picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAgentPicker) {
        const target = event.target as Element;
        const agentPicker = target.closest('.agent-picker-container');
        if (!agentPicker) {
          setShowAgentPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAgentPicker]);

  // Helper function to detect agentic tasks and select appropriate agent
  const detectAgenticTask = (message: string): { agentId: string; includeCodeContext: boolean } => {
    const lowerMsg = message.toLowerCase();
    const currentAgent = agents.find((a: any) => a.id === selectedAgent);

    // Detect coding/development tasks
    const codingKeywords = [
      'fix',
      'code',
      'frontend',
      'backend',
      'debug',
      'refactor',
      'implement',
      'build',
    ];
    const isCodingTask = codingKeywords.some(keyword => lowerMsg.includes(keyword));

    if (isCodingTask) {
      const codingAgent = agents.find(
        (a: any) => a.type === 'coding' || a.capabilities?.includes('code_generation')
      );
      if (codingAgent) {
        return { agentId: codingAgent.id, includeCodeContext: true };
      }
    }

    // Detect file management tasks
    const fileKeywords = ['file', 'folder', 'organize', 'cleanup', 'disk space', 'storage'];
    const isFileTask = fileKeywords.some(keyword => lowerMsg.includes(keyword));

    if (isFileTask) {
      const fileAgent = agents.find((a: any) => a.type === 'file_management');
      if (fileAgent) {
        return { agentId: fileAgent.id, includeCodeContext: false };
      }
    }

    // Detect vision/image tasks
    const visionKeywords = ['image', 'picture', 'analyze', 'vision', 'screenshot'];
    const isVisionTask = visionKeywords.some(keyword => lowerMsg.includes(keyword));

    if (isVisionTask) {
      const visionAgent = agents.find((a: any) => a.type === 'vision');
      if (visionAgent) {
        return { agentId: visionAgent.id, includeCodeContext: false };
      }
    }

    // Default to currently selected agent
    return {
      agentId: currentAgent?.id || selectedAgent,
      includeCodeContext: isCodingTask,
    };
  };

  // Helper function to detect complex operations that should use task windows
  const detectComplexOperation = (
    message: string
  ): {
    operation: string;
    agentType: 'one-folder' | 'pydantic-ai';
    description: string;
    params: Record<string, unknown>;
  } | null => {
    const lowerMsg = message.toLowerCase();

    // Detect React/Node.js app building
    if (
      lowerMsg.includes('build') &&
      (lowerMsg.includes('react') || lowerMsg.includes('app') || lowerMsg.includes('project'))
    ) {
      return {
        operation: 'build_react_app',
        agentType: 'one-folder',
        description: 'build a React application',
        params: {
          projectName: 'react-app',
          template: lowerMsg.includes('typescript') ? 'typescript' : 'javascript',
          features: lowerMsg.includes('routing') ? ['routing'] : [],
        },
      };
    }

    // Detect folder organization tasks
    if (
      lowerMsg.includes('organize') &&
      (lowerMsg.includes('folder') || lowerMsg.includes('directory') || lowerMsg.includes('files'))
    ) {
      return {
        operation: 'organize_folder',
        agentType: 'one-folder',
        description: 'organize your folders and files',
        params: {
          targetPath: '/Users', // Default path, should be configurable
          createBackup: true,
        },
      };
    }

    // Detect image generation tasks
    if (
      lowerMsg.includes('generate') &&
      (lowerMsg.includes('image') || lowerMsg.includes('picture') || lowerMsg.includes('photo'))
    ) {
      return {
        operation: 'generate_image',
        agentType: 'pydantic-ai',
        description: 'generate an image for you',
        params: {
          prompt: message,
          width: 512,
          height: 512,
          steps: 20,
        },
      };
    }

    // Detect code analysis tasks
    if (
      lowerMsg.includes('analyze') &&
      (lowerMsg.includes('code') || lowerMsg.includes('codebase') || lowerMsg.includes('project'))
    ) {
      return {
        operation: 'code_analysis',
        agentType: 'one-folder',
        description: 'analyze your codebase',
        params: {
          targetPath: process.cwd(),
          includeTests: true,
          generateReport: true,
        },
      };
    }

    // Detect complex multi-step requests that indicate task window usage
    const complexIndicators = [
      'create a complete',
      'build me a',
      'set up a new',
      'install and configure',
      'generate a full',
      'create from scratch',
    ];

    if (complexIndicators.some(indicator => lowerMsg.includes(indicator))) {
      return {
        operation: 'build_react_app', // Default to React app for complex requests
        agentType: 'one-folder',
        description: 'create a complete solution',
        params: {
          projectName: 'custom-app',
          template: 'typescript',
          features: ['routing', 'testing'],
        },
      };
    }

    return null; // Not a complex operation
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
    };

    addMessage({
      content: userMessage.content,
      sender: userMessage.sender,
      status: userMessage.status,
    });
    setInputValue('');

    // Update message status
    setTimeout(() => {
      updateMessage(userMessage.id, { status: 'sent' });
    }, 200);

    setTyping(true);

    try {
      // Mark as delivered
      updateMessage(userMessage.id, { status: 'delivered' });

      if (connectionStatus.isConnected) {
        // Detect if this is a complex operation that should use task windows
        const complexOperation = detectComplexOperation(content);

        if (complexOperation && taskWSConnected) {
          // Advanced task windows available - use them
          setTyping(false);
          addMessage({
            content: `I'll help you ${complexOperation.description}. Starting ${complexOperation.operation} in a dedicated task window...`,
            sender: 'assistant',
            status: 'delivered',
          });

          try {
            const taskWindow = await executeAgentOperation(
              complexOperation.agentType,
              complexOperation.operation,
              complexOperation.params,
              {
                modal: true,
                closeable: true,
                minimizable: true,
                width: 800,
                height: 600,
                showLogs: true,
                showProgress: true,
              }
            );

            setActiveTaskWindow(taskWindow);

            addMessage({
              content: `Task window opened for "${taskWindow.title}". You can monitor progress in the dedicated window.`,
              sender: 'assistant',
              status: 'delivered',
            });
          } catch (_error) {
            Logger.error('Failed to create task window:', _error);
            addMessage({
              content: `I'll help you ${complexOperation.description} using the regular chat interface instead.`,
              sender: 'assistant',
              status: 'delivered',
            });
            // Fall through to regular processing
          }
          return;
        } else if (complexOperation && !taskWSConnected) {
          // Task system offline - handle gracefully for family use
          addMessage({
            content: `I'll help you ${complexOperation.description}. Let me work on that for you right here in the chat.`,
            sender: 'assistant',
            status: 'delivered',
          });
          // Fall through to regular processing
        }

        // Regular chat handling for non-complex operations
        // Detect agentic task and select appropriate agent
        const { agentId, includeCodeContext } = detectAgenticTask(content);
        const selectedAgentData = agents.find((a: any) => a.id === agentId);

        // Update selected agent if different
        if (agentId !== selectedAgent) {
          selectAgent(agentId);
        }
        // Try streaming first
        let fullResponse = '';
        apiService.streamChat(
          content,
          chunk => {
            fullResponse += chunk;
            setStreamingContent(fullResponse);
          },
          () => {
            // On complete
            setTyping(false);
            setStreamingContent('');
            addMessage({
              content: fullResponse || 'Message received.',
              sender: 'assistant',
              status: 'delivered',
              model: selectedAgentData?.name,
            });
          },
          async _error => {
            // On _error, fallback to regular API with agent selection
            if (process.env.NODE_ENV === 'development') {
              Logger.warn('Streaming failed, falling back to regular API:', _error);
            }
            try {
              const response = await apiService.sendMessage(
                content,
                selectedAgentData?.name || 'lm-studio',
                {
                  includeCodeContext,
                  forceRealAI: true,
                }
              );
              setTyping(false);
              addMessage({
                content: response.response,
                sender: 'assistant',
                status: 'delivered',
                model: response.model,
              });
            } catch {
              setTyping(false);
              addMessage({
                content:
                  'Sorry, I encountered an _error while processing your request. Please try again.',
                sender: 'assistant',
                status: 'delivered',
              });
            }
          }
        );
      } else {
        // Offline mode - use fallback response
        setTimeout(() => {
          setTyping(false);
          addMessage({
            content: generateResponse(content),
            sender: 'assistant',
            status: 'delivered',
          });
        }, 1500);
      }
    } catch (_error) {
      Logger.error('Error sending message:', _error);
      setTyping(false);
      addMessage({
        content: 'Sorry, I encountered an error. Please check your connection and try again.',
        sender: 'assistant',
        status: 'delivered',
      });
    }
  };

  const generateResponse = (_userInput: string): string => {
    const responses = [
      "I'm currently in offline mode. Your backend services are not connected. To get AI-powered responses, please ensure your backend services are running.",
      "Running in offline mode. I can't access the AI models right now, but I'm here to help once the connection is restored.",
      'The backend services appear to be offline. Please check that your Universal AI Tools backend is running on the configured ports.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Get current agent data
  const currentAgent = agents.find((a: any) => a.id === selectedAgent);

  // Get agent icon based on type
  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'coding':
        return CodeBracketIcon;
      case 'vision':
        return EyeIcon;
      case 'file_management':
        return DocumentIcon;
      default:
        return CpuChipIcon;
    }
  };

  // Get agent color based on type
  const getAgentColor = (type: string) => {
    switch (type) {
      case 'coding':
        return 'from-blue-500 to-purple-600';
      case 'vision':
        return 'from-green-500 to-blue-600';
      case 'file_management':
        return 'from-orange-500 to-red-600';
      default:
        return 'from-purple-500 to-pink-600';
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 500, damping: 30 },
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  return (
    <div className='h-full flex flex-col bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800'>
      {/* Chat Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className='flex-shrink-0 bg-white dark:bg-gray-800 shadow-lg p-6 border-b border-gray-200 dark:border-gray-700'
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            {/* Agent Selector */}
            <div className='relative agent-picker-container'>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAgentPicker(!showAgentPicker)}
                className={`w-12 h-12 bg-gradient-to-br ${getAgentColor(currentAgent?.type || 'default')} rounded-full flex items-center justify-center shadow-lg`}
              >
                {currentAgent &&
                  React.createElement(getAgentIcon(currentAgent.type), {
                    className: 'w-6 h-6 text-white',
                  })}
              </motion.button>

              {/* Agent Picker Dropdown */}
              <AnimatePresence>
                {showAgentPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className='absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50'
                  >
                    <div className='p-4'>
                      <h3 className='text-sm font-semibold text-gray-900 dark:text-white mb-3'>
                        Select Agent
                      </h3>
                      <div className='space-y-2 max-h-60 overflow-y-auto'>
                        {agents.map(agent => {
                          const AgentIcon = getAgentIcon(agent.type);
                          const isSelected = agent.id === selectedAgent;

                          return (
                            <motion.button
                              key={agent.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                selectAgent(agent.id);
                                setShowAgentPicker(false);
                              }}
                              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 bg-gradient-to-br ${getAgentColor(agent.type)} rounded-full flex items-center justify-center flex-shrink-0`}
                              >
                                <AgentIcon className='w-4 h-4 text-white' />
                              </div>
                              <div className='flex-1 min-w-0'>
                                <p
                                  className={`text-sm font-medium ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}
                                >
                                  {agent.name}
                                </p>
                                <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                  {agent.description}
                                </p>
                                {agent.capabilities && (
                                  <div className='flex flex-wrap gap-1 mt-1'>
                                    {agent.capabilities.slice(0, 2).map(cap => (
                                      <span
                                        key={cap}
                                        className='text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400'
                                      >
                                        {cap.replace('_', ' ')}
                                      </span>
                                    ))}
                                    {agent.capabilities.length > 2 && (
                                      <span className='text-xs text-gray-400'>
                                        +{agent.capabilities.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {agent.status === 'active' && (
                                <div className='w-2 h-2 bg-green-400 rounded-full flex-shrink-0' />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <div className='flex items-center space-x-2'>
                <h1 className='text-xl font-bold text-gray-900 dark:text-white'>
                  {currentAgent?.name || 'AI Assistant'}
                </h1>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                  className='p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700'
                >
                  <ChevronDownIcon className='w-4 h-4 text-gray-500' />
                </motion.button>
              </div>
              <div className='flex items-center space-x-2'>
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus.isConnected ? 'bg-green-400' : 'bg-yellow-400'
                  }`}
                />
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  {connectionStatus.isConnected ? 'Online and ready' : 'Offline mode'}
                </span>
                {currentAgent && (
                  <>
                    <span className='text-sm text-gray-400'>•</span>
                    <span className='text-sm text-gray-500 dark:text-gray-400'>
                      {currentAgent.type.replace('_', ' ')} agent
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className='text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-4'
          >
            {connectionStatus.isConnected ? (
              <>
                {currentAgent?.performance && (
                  <div className='flex items-center space-x-2'>
                    <ClockIcon className='w-4 h-4' />
                    <span>
                      ~{Math.round(currentAgent.performance.average_response_time_ms || 87)}ms
                    </span>
                  </div>
                )}
                <div className='flex items-center space-x-2'>
                  <ServerIcon className='w-4 h-4' />
                  <span>{agents.length} agents</span>
                </div>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className='w-4 h-4 text-yellow-500' />
                <span>Backend disconnected</span>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Messages Container */}
      <div className='flex-1 overflow-y-auto p-6 space-y-4'>
        <AnimatePresence>
          {messages.map(message => (
            <motion.div
              key={message.id}
              variants={messageVariants}
              initial='hidden'
              animate='visible'
              exit='exit'
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg flex items-end space-x-2 ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.sender === 'user'
                      ? 'bg-blue-500'
                      : 'bg-gradient-to-br from-purple-500 to-pink-500'
                  }`}
                  role='img'
                  aria-label={message.sender === 'user' ? 'User avatar' : 'Assistant avatar'}
                >
                  {message.sender === 'user' ? (
                    <UserIcon className='w-4 h-4 text-white' aria-hidden='true' />
                  ) : (
                    <CpuChipIcon className='w-4 h-4 text-white' aria-hidden='true' />
                  )}
                </motion.div>

                {/* Message Bubble */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={`relative px-4 py-3 rounded-2xl shadow-lg ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
                  }`}
                  role='article'
                  aria-label={`${message.sender === 'user' ? 'Your message' : 'Assistant message'}: ${message.content}`}
                >
                  <p className='text-sm'>{message.content}</p>

                  {/* Message Status */}
                  {message.sender === 'user' && (
                    <div className='flex items-center justify-end mt-1 space-x-1'>
                      <span className='text-xs opacity-75'>
                        {message.timestamp
                          ? (message.timestamp instanceof Date
                              ? message.timestamp
                              : new Date(message.timestamp)
                            ).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        {message.status === 'sending' && (
                          <div className='w-3 h-3 border border-white border-opacity-50 border-t-white rounded-full animate-spin' />
                        )}
                        {message.status === 'sent' && <CheckIcon className='w-3 h-3 opacity-75' />}
                        {message.status === 'delivered' && (
                          <div className='flex space-x-0.5'>
                            <CheckIcon className='w-3 h-3 opacity-75' />
                            <CheckIcon className='w-3 h-3 opacity-75' />
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}

                  {message.sender === 'assistant' && (
                    <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                      {message.timestamp
                        ? (message.timestamp instanceof Date
                            ? message.timestamp
                            : new Date(message.timestamp)
                          ).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='flex justify-start'
            >
              <div className='flex items-end space-x-2'>
                <div className='w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center'>
                  <CpuChipIcon className='w-4 h-4 text-white' />
                </div>
                <div className='bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 shadow-lg'>
                  <div className='flex space-x-1'>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: 'easeInOut',
                        }}
                        className='w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full'
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streaming content preview */}
        {streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='flex justify-start'
          >
            <div className='flex items-end space-x-2'>
              <div className='w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center'>
                <CpuChipIcon className='w-4 h-4 text-white' />
              </div>
              <div className='bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 shadow-lg max-w-xs lg:max-w-md xl:max-w-lg'>
                <p className='text-sm text-gray-900 dark:text-white'>{streamingContent}</p>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className='flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6'
      >
        <div className='flex items-end space-x-4'>
          {/* Voice Recording Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsRecording(!isRecording)}
            className={`flex-shrink-0 p-3 rounded-full transition-all duration-200 ${
              isRecording
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {isRecording ? (
              <StopIcon className='w-5 h-5' />
            ) : (
              <MicrophoneIcon className='w-5 h-5' />
            )}
          </motion.button>

          {/* Text Input */}
          <div className='flex-1 relative'>
            <textarea
              value={inputValue}
              onChange={_e => setInputValue(_e.target.value)}
              onKeyPress={_e => {
                if (_e.key === 'Enter' && !_e.shiftKey) {
                  _e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }}
              placeholder='Type your message...'
              rows={1}
              className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-2xl border-none focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim()}
            className={`flex-shrink-0 p-3 rounded-full transition-all duration-200 ${
              inputValue.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            <PaperAirplaneIcon className='w-5 h-5' />
          </motion.button>
        </div>
      </motion.div>

      {/* Task Windows */}
      {activeTaskWindow && (
        <TaskWindow
          taskWindow={activeTaskWindow}
          onClose={() => {
            setActiveTaskWindow(null);
          }}
          onCancel={() => {
            if (activeTaskWindow) {
              cancelTask(activeTaskWindow.id);
            }
            setActiveTaskWindow(null);
          }}
          taskWindowManager={new TaskWindowManager('http://localhost:8082')}
        />
      )}

      {/* Task Window Status Indicator */}
      {activeTaskWindows.length > 0 && (
        <div className='fixed bottom-4 right-4 z-40'>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2'
          >
            <WindowIcon className='w-5 h-5' />
            <span className='text-sm'>
              {activeTaskWindows.length} task{activeTaskWindows.length > 1 ? 's' : ''} running
            </span>
            <button
              onClick={() => setActiveTaskWindow(activeTaskWindows[0])}
              className='text-white hover:text-blue-200'
            >
              <PlayIcon className='w-4 h-4' />
            </button>
          </motion.div>
        </div>
      )}

      {/* Task System Status - Only show for development or if explicitly enabled */}
      {process.env.NODE_ENV === 'development' && !taskWSConnected && (
        <div className='fixed top-4 right-4 z-40'>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className='bg-yellow-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2'
          >
            <ExclamationCircleIcon className='w-4 h-4' />
            <span className='text-xs'>Advanced features offline</span>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Chat;
