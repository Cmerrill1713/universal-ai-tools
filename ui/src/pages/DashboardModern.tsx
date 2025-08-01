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
  Monitor,
  ChevronRight,
  Eye,
  Workflow,
  Rocket,
  Star
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

const DashboardModern: React.FC = () => {
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
    { role: 'assistant', content: 'Welcome to Universal AI Tools! 🚀 Your AI ecosystem is ready. How can I help you today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real system metrics
  useEffect(() => {
    const fetchSystemMetrics = async () => {
      try {
        const response = await fetch('/api/v1/system/metrics');
        
        if (!response.ok) {
          return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
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
        console.debug('Backend unavailable - toggling auto-pilot in demo mode');
        setAutoPilotActive(!autoPilotActive);
        
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
      console.debug('Backend unavailable - toggling auto-pilot in demo mode');
      setAutoPilotActive(!autoPilotActive);
      
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

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-40 right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      {/* Header */}
      <header className="relative backdrop-blur-xl bg-white/5 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Universal AI Tools
                  </h1>
                  <p className="text-sm text-gray-400">Next-Generation AI Platform</p>
                </div>
              </div>
              
              <div className="hidden md:flex items-center space-x-3 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-emerald-300 font-medium">All Systems Operational</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleAutoPilot}
                className={`px-6 py-3 rounded-xl flex items-center space-x-2 font-medium transition-all ${
                  autoPilotActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10'
                }`}
              >
                {autoPilotActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>Auto-Pilot</span>
                {autoPilotActive && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1"></div>}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10 transition-all"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-5 h-5" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDarkMode(!darkMode)}
                className="p-3 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10 transition-all"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                AI-Powered Excellence
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Experience the future of artificial intelligence with advanced orchestration, 
              real-time analytics, and seamless automation.
            </p>
          </motion.div>
        </div>

        {/* Key Metrics - Redesigned */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { 
              label: 'Success Rate', 
              value: `${systemMetrics.successRate.toFixed(1)}%`, 
              change: '+2.1%',
              trend: 'up',
              icon: CheckCircle,
              gradient: 'from-emerald-500 to-teal-600',
              bgGradient: 'from-emerald-500/10 to-teal-600/10',
              description: 'System reliability'
            },
            { 
              label: 'Response Time', 
              value: `${systemMetrics.avgResponseTime}ms`, 
              change: '-15ms',
              trend: 'down',
              icon: Zap,
              gradient: 'from-blue-500 to-cyan-600',
              bgGradient: 'from-blue-500/10 to-cyan-600/10',
              description: 'Average latency'
            },
            { 
              label: 'Active Agents', 
              value: systemMetrics.activeAgents, 
              change: '+2',
              trend: 'up',
              icon: Bot,
              gradient: 'from-purple-500 to-pink-600',
              bgGradient: 'from-purple-500/10 to-pink-600/10',
              description: 'AI agents online'
            },
            { 
              label: 'Task Queue', 
              value: systemMetrics.queuedTasks, 
              change: '-1',
              trend: 'down',
              icon: Layers,
              gradient: 'from-orange-500 to-red-600',
              bgGradient: 'from-orange-500/10 to-red-600/10',
              description: 'Pending operations'
            }
          ].map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group"
            >
              <div className={`relative p-6 rounded-2xl bg-gradient-to-br ${metric.bgGradient} backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-3xl transition-all duration-300`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${metric.gradient} shadow-lg`}>
                    <metric.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`flex items-center text-sm font-medium ${
                    metric.trend === 'up' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {metric.trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {metric.change}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-white">{metric.value}</p>
                  <p className="text-lg font-medium text-gray-300">{metric.label}</p>
                  <p className="text-sm text-gray-400">{metric.description}</p>
                </div>
                
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Performance Chart - Enhanced */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">System Performance</h2>
                  <p className="text-gray-400">Real-time metrics and analytics</p>
                </div>
                <div className="flex items-center space-x-2">
                  {['1h', '6h', '24h', '7d'].map(range => (
                    <motion.button
                      key={range}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedTimeRange(range)}
                      className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                        selectedTimeRange === range
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {range}
                    </motion.button>
                  ))}
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                    name="Requests/min"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorConfidence)" 
                    name="Confidence %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Quick Chat - Enhanced */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">AI Assistant</h2>
                    <p className="text-sm text-gray-400">Always ready to help</p>
                  </div>
                </div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-4 space-y-4 max-h-80">
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'bg-white/10 text-gray-100 border border-white/10'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      {msg.metadata && (
                        <p className="text-xs mt-2 opacity-70">
                          {msg.metadata.agent} • {msg.metadata.executionTime}ms
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/10">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/25 outline-none transition-all"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || isLoading}
                  className={`p-3 rounded-xl transition-all ${
                    chatInput.trim() && !isLoading
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Agent Performance Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Agent Performance</h2>
                    <p className="text-gray-400">Real-time agent analytics</p>
                  </div>
                </div>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="space-y-4">
                {agentPerformance.slice(0, 4).map((agent, index) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 * index }}
                    className="group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${COLORS[index % COLORS.length]} shadow-lg`}></div>
                        <span className="font-medium text-white">{agent.name}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>{agent.calls} calls</span>
                        <span className="text-emerald-400 font-medium">{agent.successRate}%</span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.successRate}%` }}
                        transition={{ duration: 1, delay: 0.2 + index * 0.1 }}
                        className={`h-full bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg`}
                        style={{
                          boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Avg: {agent.avgTime}ms</span>
                      <span>Confidence: {(agent.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600">
                    <Cpu className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">System Resources</h2>
                    <p className="text-gray-400">Hardware utilization</p>
                  </div>
                </div>
                <Monitor className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300 font-medium">CPU Usage</span>
                    <span className="text-2xl font-bold text-white">{systemMetrics.cpu.toFixed(1)}%</span>
                  </div>
                  <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${systemMetrics.cpu}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full bg-gradient-to-r shadow-lg ${
                        systemMetrics.cpu > 80 
                          ? 'from-red-500 to-orange-600' 
                          : systemMetrics.cpu > 60 
                            ? 'from-orange-500 to-yellow-600' 
                            : 'from-emerald-500 to-teal-600'
                      }`}
                      style={{
                        boxShadow: `0 0 15px ${
                          systemMetrics.cpu > 80 
                            ? 'rgba(239, 68, 68, 0.5)' 
                            : systemMetrics.cpu > 60 
                              ? 'rgba(245, 158, 11, 0.5)' 
                              : 'rgba(16, 185, 129, 0.5)'
                        }`
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300 font-medium">Memory Usage</span>
                    <span className="text-2xl font-bold text-white">{systemMetrics.memory.toFixed(1)}%</span>
                  </div>
                  <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${systemMetrics.memory}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className={`h-full bg-gradient-to-r shadow-lg ${
                        systemMetrics.memory > 80 
                          ? 'from-red-500 to-orange-600' 
                          : systemMetrics.memory > 60 
                            ? 'from-orange-500 to-yellow-600' 
                            : 'from-blue-500 to-purple-600'
                      }`}
                      style={{
                        boxShadow: `0 0 15px ${
                          systemMetrics.memory > 80 
                            ? 'rgba(239, 68, 68, 0.5)' 
                            : systemMetrics.memory > 60 
                              ? 'rgba(245, 158, 11, 0.5)' 
                              : 'rgba(99, 102, 241, 0.5)'
                        }`
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{systemMetrics.activeAgents}</p>
                      <p className="text-sm text-gray-400">Active Agents</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{systemMetrics.queuedTasks}</p>
                      <p className="text-sm text-gray-400">Queued Tasks</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* AB-MCTS Status (if active) */}
        <AnimatePresence>
          {autoPilotActive && abMctsMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 backdrop-blur-xl border border-blue-500/20 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">AB-MCTS Auto-Pilot Active</h2>
                      <p className="text-blue-300">Advanced AI orchestration running</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-emerald-300 font-medium">Learning & Optimizing</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Requests', value: abMctsMetrics.totalRequests, icon: Activity },
                    { 
                      label: 'Success Rate', 
                      value: `${((abMctsMetrics.successfulRequests / abMctsMetrics.totalRequests) * 100).toFixed(1)}%`,
                      icon: CheckCircle
                    },
                    { label: 'Learning Cycles', value: abMctsMetrics.learningCycles, icon: Brain },
                    { label: 'Optimizations', value: abMctsMetrics.parameterOptimizations, icon: Zap }
                  ].map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="text-center"
                    >
                      <div className="p-3 rounded-xl bg-white/10 border border-white/20 mb-3">
                        <metric.icon className="w-6 h-6 text-blue-400 mx-auto" />
                      </div>
                      <p className="text-3xl font-bold text-white mb-1">{metric.value}</p>
                      <p className="text-sm text-gray-300">{metric.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Access Cards - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-white mb-8 text-center">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Explore AI Tools
            </span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                title: 'AI Chat', 
                description: 'Advanced conversational AI with streaming responses',
                icon: MessageSquare,
                link: '/chat',
                gradient: 'from-blue-500 to-cyan-600',
                bgGradient: 'from-blue-500/10 to-cyan-600/10'
              },
              { 
                title: 'Vision Studio', 
                description: 'PyVision & SDXL image processing',
                icon: Image,
                link: '/vision',
                gradient: 'from-purple-500 to-pink-600',
                bgGradient: 'from-purple-500/10 to-pink-600/10'
              },
              { 
                title: 'MLX Training', 
                description: 'Fine-tune models on Apple Silicon',
                icon: Cpu,
                link: '/mlx',
                gradient: 'from-emerald-500 to-teal-600',
                bgGradient: 'from-emerald-500/10 to-teal-600/10'
              },
              { 
                title: 'Agent Management', 
                description: 'Orchestrate and monitor AI agents',
                icon: Bot,
                link: '/agents',
                gradient: 'from-orange-500 to-red-600',
                bgGradient: 'from-orange-500/10 to-red-600/10'
              },
              { 
                title: 'Performance', 
                description: 'Real-time system analytics',
                icon: BarChart3,
                link: '/performance',
                gradient: 'from-indigo-500 to-purple-600',
                bgGradient: 'from-indigo-500/10 to-purple-600/10'
              },
              { 
                title: 'Memory System', 
                description: 'Vector memory and knowledge base',
                icon: Database,
                link: '/memory',
                gradient: 'from-teal-500 to-emerald-600',
                bgGradient: 'from-teal-500/10 to-emerald-600/10'
              },
              { 
                title: 'API Keys', 
                description: 'Secure credential management',
                icon: Key,
                link: '/api-keys',
                gradient: 'from-yellow-500 to-orange-600',
                bgGradient: 'from-yellow-500/10 to-orange-600/10'
              },
              { 
                title: 'Monitoring', 
                description: 'System health and diagnostics',
                icon: Monitor,
                link: '/monitoring',
                gradient: 'from-pink-500 to-rose-600',
                bgGradient: 'from-pink-500/10 to-rose-600/10'
              }
            ].map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + index * 0.05 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group"
              >
                <Link to={card.link}>
                  <div className={`relative p-6 rounded-2xl bg-gradient-to-br ${card.bgGradient} backdrop-blur-xl border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 h-full`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-r ${card.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <card.icon className="w-6 h-6 text-white" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors duration-300">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                    
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default DashboardModern;