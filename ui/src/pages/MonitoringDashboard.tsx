import React, { useState, useEffect } from 'react';
import * as Icons from '@untitled-ui/icons-react';
import { 
  View, 
  Flex, 
  Text, 
  ActionButton,
  ProgressCircle,
  Well,
  Heading,
  Divider,
  Badge,
  StatusLight,
  Grid
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  loaded: boolean;
  status: 'active' | 'idle' | 'error' | 'stopped';
}

interface ServiceStatus {
  database: boolean;
  redis: boolean;
  ollama: boolean;
  lmStudio: boolean;
  websocket: boolean;
  supabase: boolean;
}

interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'failed';
  duration?: number;
  details?: any;
}

export default function MonitoringDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'this.connected' | 'error'>('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load data from backend
  useEffect(() => {
    loadSystemData();
  }, []);

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadSystemData();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadSystemData = async () => {
    try {
      setError(null);
      
      // Check backend health and get service status
      const healthResponse = await api.health();
      setServiceStatus(healthResponse.services || {
        database: false,
        redis: false,
        ollama: false,
        lmStudio: false,
        websocket: false,
        supabase: false
      });
      setConnectionStatus('this.connected');

      // Load agents
      const agentsResponse = await api.getAgents();
      if (agentsResponse.success && agentsResponse.data?.agents) {
        setAgents(agentsResponse.data.agents.map((agent: any) => ({
          id: agent.name || agent.id,
          name: agent.name,
          description: agent.description || 'No description available',
          category: agent.category || 'general',
          capabilities: agent.capabilities || [],
          loaded: agent.loaded || false,
          status: agent.loaded ? 'active' : 'idle'
        })));
      }

      // Load agent performance data as activities
      const performanceResponse = await api.getAgentPerformance();
      if (performanceResponse.success && performanceResponse.data && Array.isArray(performanceResponse.data)) {
        const performanceActivities = performanceResponse.data.map((metric: any, index: number) => ({
          id: `perf-${index}`,
          agentId: metric.agentId || 'system',
          agentName: metric.agentName || 'System Monitor',
          action: `Performance check: ${metric.metric || 'general'}`,
          timestamp: new Date(metric.timestamp || Date.now()),
          status: metric.value > 80 ? 'completed' : metric.value > 50 ? 'running' : 'failed',
          duration: metric.responseTime || 0,
          details: metric
        }));
        setActivities(performanceActivities);
      }

    } catch (error) {
      console.error('Failed to load system data:', error);
      setConnectionStatus('error');
      setError('Failed to connect to backend services');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setLoading(true);
    loadSystemData();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'positive' as const,
      idle: 'neutral' as const,
      error: 'negative' as const,
      stopped: 'negative' as const,
      running: 'info' as const,
      completed: 'positive' as const,
      failed: 'negative' as const
    };
    return <Badge variant={variants[status as keyof typeof variants] || 'neutral'}>{status.toUpperCase()}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return <Icons.PlayCircle size={16} color="#10b981" />;
      case 'completed':
        return <Icons.CheckCircle size={16} color="#10b981" />;
      case 'error':
      case 'failed':
        return <Icons.XCircle size={16} color="#ef4444" />;
      case 'idle':
      case 'stopped':
        return <Icons.PauseCircle size={16} color="#6b7280" />;
      default:
        return <Icons.Clock size={16} color="#6b7280" />;
    }
  };

  if (loading) {
    return (
      <View padding="size-400">
        <Flex direction="column" alignItems="center" gap="size-300" padding="size-600">
          <ProgressCircle size="L" isIndeterminate />
          <Text>Loading agent activity data from backend...</Text>
        </Flex>
      </View>
    );
  }

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-200">
            <Icons.Activity size={24} color="#3b82f6" />
            <Heading level={2}>Agent Activity Monitor</Heading>
            <StatusLight variant={connectionStatus === 'this.connected' ? 'positive' : 'negative'}>
              <Text>{connectionStatus === 'this.connected' ? 'Connected' : 'Disconnected'}</Text>
            </StatusLight>
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <ActionButton
              isQuiet
              onPress={refreshData}
              aria-label="Refresh data"
            >
              <Icons.RefreshCcw01 size={20} />
              <Text>Refresh</Text>
            </ActionButton>
            
            <ActionButton
              isQuiet
              onPress={() => setAutoRefresh(!autoRefresh)}
              aria-label={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
            >
              <Icons.Clock size={20} />
              <Text>{autoRefresh ? 'Auto: ON' : 'Auto: OFF'}</Text>
            </ActionButton>
          </Flex>
        </Flex>

        <Divider />

        {/* Error Display */}
        {error && (
          <Well>
            <Flex alignItems="center" gap="size-200">
              <Icons.AlertTriangle size={20} color="#ef4444" />
              <Text>{error}</Text>
              <ActionButton
                isQuiet
                onPress={() => setError(null)}
                aria-label="Dismiss error"
              >
                <Icons.X size={16} />
              </ActionButton>
            </Flex>
          </Well>
        )}

        {/* Service Status Grid */}
        <View>
          <Heading level={3} marginBottom="size-200">System Services Status</Heading>
          {serviceStatus ? (
            <Grid columns={['1fr', '1fr', '1fr']} gap="size-300">
              {Object.entries(serviceStatus).map(([service, status]) => (
                <View
                  key={service}
                  backgroundColor="gray-50"
                  borderRadius="medium"
                  padding="size-200"
                  borderWidth="thin"
                  borderColor={status ? "positive" : "negative"}
                >
                  <Flex alignItems="center" gap="size-200">
                    {getStatusIcon(status ? 'active' : 'error')}
                    <Text UNSAFE_style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                      {service}
                    </Text>
                    {getStatusBadge(status ? 'active' : 'error')}
                  </Flex>
                </View>
              ))}
            </Grid>
          ) : (
            <Well>
              <Text>No service status data available</Text>
            </Well>
          )}
        </View>

        {/* Agents Grid */}
        <View>
          <Heading level={3} marginBottom="size-200">Active Agents ({agents.length})</Heading>
          {agents.length > 0 ? (
            <Grid columns={['1fr', '1fr']} gap="size-300">
              {agents.map(agent => (
                <View
                  key={agent.id}
                  backgroundColor="gray-50"
                  borderRadius="medium"
                  padding="size-300"
                  borderWidth="thin"
                  borderColor="gray-300"
                >
                  <Flex direction="column" gap="size-200">
                    <Flex justifyContent="space-between" alignItems="center">
                      <Flex alignItems="center" gap="size-200">
                        {getStatusIcon(agent.status)}
                        <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                          {agent.name}
                        </Text>
                        {getStatusBadge(agent.status)}
                      </Flex>
                      <Badge variant="info">{agent.category}</Badge>
                    </Flex>
                    
                    <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {agent.description}
                    </Text>
                    
                    {agent.capabilities.length > 0 && (
                      <Flex gap="size-100" wrap="wrap">
                        {agent.capabilities.slice(0, 4).map((capability, index) => (
                          <Badge key={index} variant="neutral" UNSAFE_style={{ fontSize: '0.75rem' }}>
                            {capability}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 4 && (
                          <Badge variant="neutral" UNSAFE_style={{ fontSize: '0.75rem' }}>
                            +{agent.capabilities.length - 4} more
                          </Badge>
                        )}
                      </Flex>
                    )}
                  </Flex>
                </View>
              ))}
            </Grid>
          ) : (
            <Well>
              <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                <Icons.AlertCircle size={48} color="#6b7280" />
                <Text UNSAFE_style={{ color: '#6b7280' }}>
                  No agents available. Backend may be starting up.
                </Text>
              </Flex>
            </Well>
          )}
        </View>

        {/* Recent Activities */}
        <View>
          <Heading level={3} marginBottom="size-200">Recent Activities ({activities.length})</Heading>
          {activities.length > 0 ? (
            <Flex direction="column" gap="size-200">
              {activities.slice(0, 10).map(activity => (
                <View
                  key={activity.id}
                  backgroundColor="gray-50"
                  borderRadius="medium"
                  padding="size-300"
                  borderWidth="thin"
                  borderColor="gray-300"
                >
                  <Flex justifyContent="space-between" alignItems="center">
                    <Flex alignItems="center" gap="size-200">
                      {getStatusIcon(activity.status)}
                      <Flex direction="column">
                        <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                          {activity.agentName}
                        </Text>
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {activity.action}
                        </Text>
                      </Flex>
                      {getStatusBadge(activity.status)}
                    </Flex>
                    
                    <Flex direction="column" alignItems="end">
                      <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {activity.timestamp.toLocaleTimeString()}
                      </Text>
                      {activity.duration && (
                        <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {activity.duration}ms
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                </View>
              ))}
            </Flex>
          ) : (
            <Well>
              <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                <Icons.Clock size={48} color="#6b7280" />
                <Text UNSAFE_style={{ color: '#6b7280' }}>
                  No recent activities found. Start using agents to see activity here.
                </Text>
              </Flex>
            </Well>
          )}
        </View>

      </Flex>
    </View>
  );
}