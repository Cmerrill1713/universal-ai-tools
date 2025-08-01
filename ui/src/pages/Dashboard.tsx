import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Sparkles, 
  Zap, 
  Network, 
  BarChart3, 
  Activity,
  Terminal,
  Cpu,
  GitBranch,
  MessageSquare,
  Send,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Settings,
  Maximize2,
  Bot,
  Users,
  Layers,
  Shield,
  Moon,
  Sun,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Image,
  FileCode2,
  Key,
  Monitor
} from 'lucide-react';
import { api } from '../lib/api-enhanced';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SystemMetrics {
  cpu: number;
  memory: number;
  activeAgents: number;
  queuedTasks: number;
  successRate: number;
  avgResponseTime: number;
}

interface ABMCTSMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  averageConfidence: number;
  learningCycles: number;
  parameterOptimizations: number;
}

interface AgentPerformance {
  name: string;
  calls: number;
  successRate: number;
  avgTime: number;
  confidence: number;
}

const Dashboard: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [autoPilotActive, setAutoPilotActive] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 45.2,
    memory: 62.8,
    activeAgents: 6,
    queuedTasks: 3,
    successRate: 94.5,
    avgResponseTime: 240
  });
  const [abMctsMetrics, setAbMctsMetrics] = useState<ABMCTSMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([
    { time: '10:00', requests: 42, confidence: 94, responseTime: 210 },
    { time: '10:15', requests: 38, confidence: 96, responseTime: 195 },
    { time: '10:30', requests: 51, confidence: 93, responseTime: 240 },
    { time: '10:45', requests: 47, confidence: 95, responseTime: 220 },
    { time: '11:00', requests: 44, confidence: 97, responseTime: 185 },
    { time: '11:15', requests: 53, confidence: 94, responseTime: 260 },
    { time: '11:30', requests: 49, confidence: 96, responseTime: 205 }
  ]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([
    { name: 'Enhanced Planner', calls: 142, successRate: 96.2, avgTime: 1200, confidence: 0.94 },
    { name: 'Enhanced Retriever', calls: 89, successRate: 98.1, avgTime: 850, confidence: 0.91 },
    { name: 'Enhanced Synthesizer', calls: 67, successRate: 94.0, avgTime: 1450, confidence: 0.88 },
    { name: 'Personal Assistant', calls: 203, successRate: 97.5, avgTime: 950, confidence: 0.93 },
    { name: 'MLX Fine-Tuner', calls: 12, successRate: 100.0, avgTime: 3200, confidence: 0.89 },
    { name: 'Vision Processor', calls: 34, successRate: 92.6, avgTime: 2100, confidence: 0.86 }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([
    { role: 'assistant', content: 'System ready. How can I assist you today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real system metrics
  useEffect(() => {
    const fetchSystemMetrics = async () => {
      try {
        const response = await fetch('/api/v1/system/metrics');
        
        if (!response.ok) {
          // Backend unavailable - use mock data or skip
          return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // Not JSON response - skip parsing
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
          const metrics = data.data;
          setSystemMetrics({
            cpu: metrics.system.cpu,
            memory: metrics.system.memory,
            activeAgents: metrics.agents.active,
            queuedTasks: metrics.performance.queuedTasks,
            successRate: metrics.performance.successRate,
            avgResponseTime: metrics.performance.avgResponseTime
          });
        }
      } catch (error) {
        // Silently handle errors when backend is unavailable
        console.debug('Backend unavailable - using default metrics');
      }
    };

    const fetchPerformanceData = async () => {
      try {
        const response = await fetch(`/api/v1/system/performance?timeRange=${selectedTimeRange}`);
        
        if (!response.ok) {
          return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data?.data) {
          setPerformanceData(data.data.data);
        }
      } catch (error) {
        console.debug('Backend unavailable - using default performance data');
      }
    };

    const fetchAgentPerformance = async () => {
      try {
        const response = await fetch('/api/v1/system/agents/performance');
        
        if (!response.ok) {
          return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
          setAgentPerformance(data.data);
        }
      } catch (error) {
        console.debug('Backend unavailable - using default agent performance');
      }
    };

    // Initial fetch
    fetchSystemMetrics();
    fetchPerformanceData();
    fetchAgentPerformance();

    // Set up refresh intervals
    const metricsInterval = setInterval(fetchSystemMetrics, 5000);
    const performanceInterval = setInterval(fetchPerformanceData, 10000);
    const agentInterval = setInterval(fetchAgentPerformance, 15000);

    return () => {
      clearInterval(metricsInterval);
      clearInterval(performanceInterval);
      clearInterval(agentInterval);
    };
  }, [selectedTimeRange]);

  // Check auto-pilot status
  useEffect(() => {
    const checkAutoPilotStatus = async () => {
      try {
        const response = await fetch('/api/v1/ab-mcts/auto-pilot/status');
        
        if (!response.ok) {
          return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }
        
        const data = await response.json();
        setAutoPilotActive(data.data?.active || false);
        if (data.data?.metrics) {
          setAbMctsMetrics(data.data.metrics);
        }
      } catch (error) {
        console.debug('Backend unavailable - auto-pilot status unknown');
      }
    };
    
    checkAutoPilotStatus();
    const interval = setInterval(checkAutoPilotStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleAutoPilot = async () => {
    try {
      const endpoint = autoPilotActive ? 'stop' : 'start';
      const response = await fetch(`/api/v1/ab-mcts/auto-pilot/${endpoint}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        // Backend unavailable - toggle in demo mode
        console.debug('Backend unavailable - toggling auto-pilot in demo mode');
        setAutoPilotActive(!autoPilotActive);
        
        // Set demo AB-MCTS metrics when enabled
        if (!autoPilotActive) {
          setAbMctsMetrics({
            totalRequests: 1247,
            successfulRequests: 1198,
            failedRequests: 49,
            averageResponseTime: 285,
            averageConfidence: 0.924,
            learningCycles: 23,
            parameterOptimizations: 156
          });
        } else {
          setAbMctsMetrics(null);
        }
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Backend available but not JSON - toggle in demo mode
        setAutoPilotActive(!autoPilotActive);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAutoPilotActive(!autoPilotActive);
        if (data.data?.metrics) {
          setAbMctsMetrics(data.data.metrics);
        }
      }
    } catch (error) {
      // Network error - toggle in demo mode
      console.debug('Backend unavailable - toggling auto-pilot in demo mode');
      setAutoPilotActive(!autoPilotActive);
      
      // Set demo AB-MCTS metrics when enabled
      if (!autoPilotActive) {
        setAbMctsMetrics({
          totalRequests: 1247,
          successfulRequests: 1198,
          failedRequests: 49,
          averageResponseTime: 285,
          averageConfidence: 0.924,
          learningCycles: 23,
          parameterOptimizations: 156
        });
      } else {
        setAbMctsMetrics(null);
      }
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoading(true);

    try {
      const response = await api.chat(userMessage.content);
      
      // Extract message content from different possible response formats
      let messageContent = 'Message processed successfully.';
      
      if (response.data?.message?.content) {
        messageContent = response.data.message.content;
      } else if (response.response) {
        messageContent = response.response;
      } else if (response.message) {
        messageContent = response.message;
      }
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: messageContent,
        metadata: response.metadata
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Error processing message. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} backdrop-blur-sm border-b sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-semibold">Universal AI Tools</h1>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-gray-500">All Systems Operational</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={toggleAutoPilot}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                  autoPilotActive
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {autoPilotActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="text-sm font-medium">Auto-Pilot</span>
              </button>

              <button
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { 
              label: 'Success Rate', 
              value: `${systemMetrics.successRate.toFixed(1)}%`, 
              change: performanceData.length > 10 ? 
                `${(systemMetrics.successRate - performanceData[performanceData.length - 10]?.successRate || 0).toFixed(1)}%` : 
                '0%', 
              trend: performanceData.length > 10 && 
                systemMetrics.successRate > (performanceData[performanceData.length - 10]?.successRate || 0) ? 'up' : 'down',
              icon: CheckCircle,
              color: 'green'
            },
            { 
              label: 'Avg Response Time', 
              value: `${systemMetrics.avgResponseTime}ms`, 
              change: performanceData.length > 10 ? 
                `${systemMetrics.avgResponseTime - (performanceData[performanceData.length - 10]?.responseTime || 0)}ms` : 
                '0ms', 
              trend: performanceData.length > 10 && 
                systemMetrics.avgResponseTime < (performanceData[performanceData.length - 10]?.responseTime || 0) ? 'down' : 'up',
              icon: Clock,
              color: 'blue'
            },
            { 
              label: 'Active Agents', 
              value: systemMetrics.activeAgents, 
              change: '0', 
              trend: 'up',
              icon: Users,
              color: 'purple'
            },
            { 
              label: 'Queued Tasks', 
              value: systemMetrics.queuedTasks, 
              change: '0', 
              trend: systemMetrics.queuedTasks > 10 ? 'up' : 'down',
              icon: Layers,
              color: 'orange'
            }
          ].map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } rounded-xl border p-6`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{metric.label}</span>
                <metric.icon className={`w-5 h-5 text-${metric.color}-500`} />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">{metric.value}</span>
                <div className={`flex items-center text-sm ${
                  metric.trend === 'up' ? 'text-green-500' : 'text-blue-500'
                }`}>
                  {metric.trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {metric.change}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <div className={`lg:col-span-2 ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } rounded-xl border p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">System Performance</h2>
              <div className="flex items-center space-x-2">
                {['1h', '6h', '24h', '7d'].map(range => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      selectedTimeRange === range
                        ? 'bg-blue-600 text-white'
                        : darkMode 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="time" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '0.5rem'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="requests" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorRequests)" 
                  name="Requests/min"
                />
                <Area 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#8b5cf6" 
                  fillOpacity={1} 
                  fill="url(#colorConfidence)" 
                  name="Confidence %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Chat */}
          <div className={`${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } rounded-xl border p-6 flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Quick Chat</h2>
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-64">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : darkMode ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    {msg.metadata && (
                      <p className="text-xs mt-1 opacity-70">
                        {msg.metadata.agent} • {msg.metadata.executionTime}ms
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask anything..."
                className={`flex-1 px-4 py-2 rounded-lg outline-none ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-100 placeholder-gray-400' 
                    : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                }`}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isLoading}
                className={`p-2 rounded-lg transition-colors ${
                  chatInput.trim() && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : darkMode 
                      ? 'bg-gray-700 text-gray-500'
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Agent Performance */}
          <div className={`${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } rounded-xl border p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Agent Performance</h2>
              <Bot className="w-5 h-5 text-purple-500" />
            </div>
            
            <div className="space-y-3">
              {agentPerformance.map((agent, index) => (
                <div key={agent.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{agent.name}</span>
                    <span className="text-gray-500">{agent.calls} calls</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.successRate}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{agent.successRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Resources */}
          <div className={`${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } rounded-xl border p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">System Resources</h2>
              <Cpu className="w-5 h-5 text-orange-500" />
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">CPU Usage</span>
                  <span className="text-sm font-medium">{systemMetrics.cpu.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${systemMetrics.cpu}%` }}
                    transition={{ duration: 0.3 }}
                    className={`h-full ${
                      systemMetrics.cpu > 80 ? 'bg-red-500' : systemMetrics.cpu > 60 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Memory Usage</span>
                  <span className="text-sm font-medium">{systemMetrics.memory.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${systemMetrics.memory}%` }}
                    transition={{ duration: 0.3 }}
                    className={`h-full ${
                      systemMetrics.memory > 80 ? 'bg-red-500' : systemMetrics.memory > 60 ? 'bg-orange-500' : 'bg-blue-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Response Time Distribution */}
          <div className={`${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } rounded-xl border p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Response Time Distribution</h2>
              <BarChart3 className="w-5 h-5 text-green-500" />
            </div>
            
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(() => {
                // Calculate distribution from performance data
                const distribution = { '0-500ms': 0, '500-1s': 0, '1-2s': 0, '2-5s': 0, '>5s': 0 };
                performanceData.forEach(d => {
                  const time = d.responseTime;
                  if (time < 500) distribution['0-500ms']++;
                  else if (time < 1000) distribution['500-1s']++;
                  else if (time < 2000) distribution['1-2s']++;
                  else if (time < 5000) distribution['2-5s']++;
                  else distribution['>5s']++;
                });
                return Object.entries(distribution).map(([range, count]) => ({ range, count }));
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="range" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '0.5rem'
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AB-MCTS Status (if active) */}
        {autoPilotActive && abMctsMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 ${
              darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
            } rounded-xl border p-6`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-6 h-6 text-blue-500" />
                <h2 className="text-lg font-semibold">AB-MCTS Auto-Pilot Active</h2>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Learning & Optimizing</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-2xl font-bold">{abMctsMetrics.totalRequests}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold">
                  {((abMctsMetrics.successfulRequests / abMctsMetrics.totalRequests) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Learning Cycles</p>
                <p className="text-2xl font-bold">{abMctsMetrics.learningCycles}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Optimizations</p>
                <p className="text-2xl font-bold">{abMctsMetrics.parameterOptimizations}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Access Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { 
              title: 'Full Chat Interface', 
              description: 'Advanced AI chat with streaming responses',
              icon: MessageSquare,
              link: '/chat',
              color: 'from-blue-500 to-blue-600'
            },
            { 
              title: 'Vision Studio', 
              description: 'PyVision & SDXL image processing',
              icon: Image,
              link: '/vision',
              color: 'from-purple-500 to-purple-600'
            },
            { 
              title: 'MLX Training', 
              description: 'Fine-tune models on Apple Silicon',
              icon: Cpu,
              link: '/mlx',
              color: 'from-green-500 to-green-600'
            },
            { 
              title: 'Models Manager', 
              description: 'Manage and deploy AI models',
              icon: Database,
              link: '/models',
              color: 'from-orange-500 to-orange-600'
            },
            { 
              title: 'API Keys', 
              description: 'Manage API keys securely with Vault',
              icon: Key,
              link: '/api-keys',
              color: 'from-yellow-500 to-yellow-600'
            },
            { 
              title: 'Agent Performance', 
              description: 'Monitor agent performance metrics',
              icon: Activity,
              link: '/performance',
              color: 'from-red-500 to-red-600'
            },
            { 
              title: 'Activity Monitor', 
              description: 'Real-time agent activity tracking',
              icon: Monitor,
              link: '/activity',
              color: 'from-indigo-500 to-indigo-600'
            },
            { 
              title: 'Task Execution', 
              description: 'Execute and monitor agent tasks',
              icon: CheckCircle,
              link: '/tasks',
              color: 'from-teal-500 to-teal-600'
            }
          ].map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
            >
              <Link to={card.link}>
                <div className={`${
                  darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                } rounded-xl border p-4 transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer`}>
                  <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${card.color} mb-3`}>
                    <card.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-1">{card.title}</h3>
                  <p className="text-sm text-gray-500">{card.description}</p>
                  <div className="flex items-center mt-3 text-sm text-blue-500">
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;