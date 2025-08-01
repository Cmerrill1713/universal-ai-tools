/**
 * Athena - Advanced AI Assistant Dashboard
 * Dynamic agent management, tool creation, and workflow orchestration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Badge,
  Tooltip,
  Fade,
  LinearProgress,
} from '@mui/material';
import {
  SmartToy as AgentIcon,
  Build as ToolIcon,
  AccountTree as WorkflowIcon,
  Code as CodeIcon,
  Lightbulb as SuggestionIcon,
  Analytics as MetricsIcon,
  Send as SendIcon,
  Circle as StatusIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Forum as ChatIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

interface Agent {
  id: string;
  name: string;
  purpose: string;
  status: 'active' | 'idle' | 'spawning';
  capabilities: string[];
  tools: Array<{ name: string; description: string; type: string }>;
  createdAt: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
  description: string;
}

interface AthenaStatus {
  connected: boolean;
  activeAgents: number;
  totalAgents: number;
  systemHealth: 'healthy' | 'degraded' | 'error';
  uptime: number;
}

export default function Athena() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [athenaStatus, setAthenaStatus] = useState<AthenaStatus>({
    connected: false,
    activeAgents: 0,
    totalAgents: 0,
    systemHealth: 'error',
    uptime: 0,
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [responseMessage, setResponseMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        // For now, disable WebSocket and rely on periodic HTTP polling
        // WebSocket integration can be enhanced later
        console.log('📡 Athena using HTTP polling mode');
        setAthenaStatus(prev => ({ ...prev, connected: true }));
        fetchStatus();
        
        // Set up periodic status updates
        const interval = setInterval(() => {
          fetchStatus();
        }, 5000); // Update every 5 seconds
        
        // Store cleanup function
        (ws as any) = { 
          close: () => {
            clearInterval(interval);
            setAthenaStatus(prev => ({ ...prev, connected: false }));
          }
        };
      } catch (error) {
        console.error('Failed to setup Athena connection:', error);
        setAthenaStatus(prev => ({ ...prev, connected: false }));
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'status_update':
        setAthenaStatus(prev => ({ ...prev, ...data.status }));
        break;
      case 'agent_update':
        fetchAgents();
        break;
      case 'notification':
        setResponseMessage({ type: data.level || 'info', message: data.message });
        break;
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await api.get('/athena/status');
      if (response.data.success) {
        const status = response.data.data;
        setAthenaStatus({
          connected: true,
          activeAgents: status.activeAgents || 0,
          totalAgents: status.totalAgents || 0,
          systemHealth: status.systemHealth || 'healthy',
          uptime: status.uptime || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch Athena status:', error);
      setAthenaStatus(prev => ({ ...prev, connected: false, systemHealth: 'error' }));
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await api.get('/athena/agents');
      if (response.data.success) {
        setAgents(response.data.data.agents || []);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAgents();
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSpawnAgent = async () => {
    setLoading(true);
    try {
      // Show spawn agent dialog or navigate to spawn page
      navigate('/athena/spawn');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTool = async () => {
    setLoading(true);
    try {
      // Show create tool dialog or navigate to tool creation
      navigate('/athena/tools/create');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async () => {
    setLoading(true);
    try {
      // Show workflow builder or navigate to workflow page
      navigate('/athena/workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeCode = async () => {
    setLoading(true);
    try {
      // Navigate to code analysis
      navigate('/athena/analyze');
    } finally {
      setLoading(false);
    }
  };

  const handleGetSuggestions = async () => {
    setLoading(true);
    try {
      const response = await api.post('/athena/suggestions', {
        context: 'dashboard',
        recentActivity: agents.slice(0, 5).map(a => ({ id: a.id, name: a.name })),
      });
      
      if (response.data.success) {
        setResponseMessage({
          type: 'info',
          message: `Suggestions: ${response.data.data.suggestions.join(', ')}`,
        });
      }
    } catch (error) {
      setResponseMessage({
        type: 'error',
        message: 'Failed to get suggestions',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewMetrics = () => {
    navigate('/monitoring');
  };

  const quickActions: QuickAction[] = [
    {
      id: 'spawn-agent',
      label: 'Spawn Agent',
      icon: <AgentIcon sx={{ fontSize: 40 }} />,
      color: '#4A90E2',
      action: handleSpawnAgent,
      description: 'Create a new AI agent with custom capabilities',
    },
    {
      id: 'create-tool',
      label: 'Create Tool',
      icon: <ToolIcon sx={{ fontSize: 40 }} />,
      color: '#F5A623',
      action: handleCreateTool,
      description: 'Build custom tools for your agents',
    },
    {
      id: 'start-workflow',
      label: 'Start Workflow',
      icon: <WorkflowIcon sx={{ fontSize: 40 }} />,
      color: '#7C4DFF',
      action: handleStartWorkflow,
      description: 'Design and execute complex workflows',
    },
    {
      id: 'analyze-code',
      label: 'Analyze Code',
      icon: <CodeIcon sx={{ fontSize: 40 }} />,
      color: '#50E3C2',
      action: handleAnalyzeCode,
      description: 'Get AI-powered code analysis and improvements',
    },
    {
      id: 'get-suggestions',
      label: 'Get Suggestions',
      icon: <SuggestionIcon sx={{ fontSize: 40 }} />,
      color: '#F8B500',
      action: handleGetSuggestions,
      description: 'Receive intelligent suggestions for your tasks',
    },
    {
      id: 'view-metrics',
      label: 'View Metrics',
      icon: <MetricsIcon sx={{ fontSize: 40 }} />,
      color: '#E74C3C',
      action: handleViewMetrics,
      description: 'Monitor system performance and agent metrics',
    },
  ];

  const handleCommandSubmit = async () => {
    if (!command.trim() || loading) return;

    setLoading(true);
    try {
      const response = await api.post('/athena/execute', {
        command,
        context: {
          activeTab: ['command', 'agents', 'tools', 'performance'][activeTab],
          activeAgents: athenaStatus.activeAgents,
        },
      });

      if (response.data.success) {
        setResponseMessage({
          type: 'success',
          message: response.data.data.result || 'Command executed successfully',
        });
        setCommand('');
      }
    } catch (error: any) {
      setResponseMessage({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to execute command',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!athenaStatus.connected) return '#E74C3C';
    switch (athenaStatus.systemHealth) {
      case 'healthy':
        return '#50E3C2';
      case 'degraded':
        return '#F5A623';
      case 'error':
        return '#E74C3C';
      default:
        return '#9B9B9B';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <AgentIcon sx={{ fontSize: 48, color: '#7C4DFF' }} />
            </motion.div>
            <Box>
              <Typography variant="h3" fontWeight="bold">
                Athena
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Advanced AI Assistant
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<StatusIcon sx={{ color: getStatusColor() + '!important' }} />}
              label={`${athenaStatus.activeAgents} Active Agents`}
              variant="outlined"
            />
            <Chip
              icon={<StatusIcon sx={{ color: getStatusColor() + '!important' }} />}
              label={athenaStatus.connected ? 'Connected' : 'Disconnected'}
              color={athenaStatus.connected ? 'success' : 'error'}
              variant="filled"
            />
          </Box>
        </Box>

        {/* Tabs */}
        <Paper sx={{ borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                py: 2,
                fontSize: '1rem',
                fontWeight: 500,
              },
            }}
          >
            <Tab label="Command" />
            <Tab label="Agents" />
            <Tab label="Tools" />
            <Tab label="Performance" />
          </Tabs>
        </Paper>
      </Box>

      {/* Command Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* Command Input */}
          <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom fontWeight="medium">
              What can I help you with?
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Enter your command or request..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCommandSubmit();
                }
              }}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleCommandSubmit}
                      disabled={loading || !command.trim()}
                      color="primary"
                    >
                      {loading ? <CircularProgress size={24} /> : <SendIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  backgroundColor: 'background.default',
                },
              }}
            />
          </Paper>

          {/* Response Message */}
          <AnimatePresence>
            {responseMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Alert
                  severity={responseMessage.type}
                  onClose={() => setResponseMessage(null)}
                  sx={{ mb: 4 }}
                >
                  {responseMessage.message}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Actions */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              Quick Actions
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            {quickActions.map((action, index) => (
              <Grid item xs={12} sm={6} md={4} key={action.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    sx={{
                      p: 3,
                      height: '100%',
                      cursor: 'pointer',
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: action.color,
                        boxShadow: `0 0 20px ${action.color}40`,
                      },
                    }}
                    onClick={action.action}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <Box sx={{ color: action.color, mb: 2 }}>
                        {action.icon}
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {action.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {action.description}
                      </Typography>
                    </Box>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Agents Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="medium">
              Active Agents ({agents.filter(a => a.status === 'active').length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<AgentIcon />}
              onClick={handleSpawnAgent}
              sx={{ borderRadius: 2 }}
            >
              Spawn New Agent
            </Button>
          </Box>

          {agents.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
              <AgentIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No agents spawned yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Spawn your first agent to get started
              </Typography>
              <Button variant="contained" onClick={handleSpawnAgent}>
                Spawn Agent
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {agents.map((agent) => (
                <Grid item xs={12} md={6} key={agent.id}>
                  <Card sx={{ p: 3, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {agent.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={agent.status}
                          color={agent.status === 'active' ? 'success' : 'default'}
                        />
                      </Box>
                      <IconButton size="small">
                        <SettingsIcon />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {agent.purpose}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Capabilities: {agent.capabilities.join(', ')}
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Tools Tab */}
      {activeTab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="medium">
              Available Tools
            </Typography>
            <Button
              variant="contained"
              startIcon={<ToolIcon />}
              onClick={handleCreateTool}
              sx={{ borderRadius: 2 }}
            >
              Create New Tool
            </Button>
          </Box>
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
            <ToolIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Tool creation coming soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Build custom tools to extend agent capabilities
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Performance Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h5" fontWeight="medium" gutterBottom>
            System Performance
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  System Health
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StatusIcon sx={{ color: getStatusColor() }} />
                  <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
                    {athenaStatus.systemHealth}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Active Agents
                </Typography>
                <Typography variant="h4">
                  {athenaStatus.activeAgents} / {athenaStatus.totalAgents}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Uptime
                </Typography>
                <Typography variant="h4">
                  {Math.floor(athenaStatus.uptime / 3600)}h {Math.floor((athenaStatus.uptime % 3600) / 60)}m
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-around',
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(0,0,0,0.8)',
        }}
      >
        <Tooltip title="Athena">
          <IconButton color="primary" size="large">
            <Badge badgeContent={athenaStatus.activeAgents} color="error">
              <AgentIcon />
            </Badge>
          </IconButton>
        </Tooltip>
        <Tooltip title="Agents">
          <IconButton onClick={() => navigate('/agents')} size="large">
            <AgentIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Tools">
          <IconButton onClick={() => setActiveTab(2)} size="large">
            <ToolIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Chat">
          <IconButton onClick={() => navigate('/chat')} size="large">
            <ChatIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton onClick={() => navigate('/settings')} size="large">
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Paper>
    </Container>
  );
}