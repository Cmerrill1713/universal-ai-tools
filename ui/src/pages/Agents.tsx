import React, { useState, useEffect } from 'react';
import { 
  View, 
  Flex, 
  Grid, 
  Heading, 
  Text, 
  Well, 
  StatusLight, 
  Button,
  Dialog,
  DialogTrigger,
  Content,
  ProgressBar,
  Badge,
  ActionButton
} from '@adobe/react-spectrum';
import * as Icons from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  type: 'cognitive' | 'personal' | 'system';
  status: 'active' | 'idle' | 'error';
  description: string;
  capabilities: string[];
  metrics: {
    tasksCompleted: number;
    avgResponseTime: number;
    successRate: number;
  };
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: Agent['status']) => {
    switch (status) {
      case 'active': return 'positive';
      case 'idle': return 'neutral';
      case 'error': return 'negative';
      default: return 'neutral';
    }
  };

  const getTypeIcon = (type: Agent['type']) => {
    switch (type) {
      case 'cognitive': return <Icons.Brain size={20} />;
      case 'personal': return <Icons.User size={20} />;
      case 'system': return <Icons.Settings size={20} />;
    }
  };

  const getTypeBadgeVariant = (type: Agent['type']) => {
    switch (type) {
      case 'cognitive': return 'info';
      case 'personal': return 'positive';
      case 'system': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <View padding="size-400">
        <Flex direction="column" alignItems="center" justifyContent="center" height="100vh">
          <ProgressBar label="Loading agents..." isIndeterminate />
        </Flex>
      </View>
    );
  }

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={1}>Agent Management</Heading>
          <Flex gap="size-200">
            <Button variant="cta" onPress={loadAgents}>
              <Icons.RefreshCw width={16} height={16} />
              <Text>Refresh</Text>
            </Button>
          </Flex>
        </Flex>

        <Grid
          columns={['1fr', '1fr', '1fr']}
          autoRows="auto"
          gap="size-300"
          UNSAFE_style={{
            '@media (max-width: 768px)': {
              gridTemplateColumns: '1fr'
            },
            '@media (max-width: 1024px)': {
              gridTemplateColumns: '1fr 1fr'
            }
          }}
        >
          {agents.map(agent => (
            <Well key={agent.id}>
              <Flex direction="column" gap="size-200">
                <Flex justifyContent="space-between" alignItems="start">
                  <Flex alignItems="center" gap="size-100">
                    {getTypeIcon(agent.type)}
                    <Heading level={3}>{agent.name}</Heading>
                  </Flex>
                  <StatusLight variant={getStatusVariant(agent.status)}>
                    {agent.status}
                  </StatusLight>
                </Flex>

                <Text UNSAFE_style={{ fontSize: '14px', color: '#9ca3af' }}>
                  {agent.description}
                </Text>

                <Flex gap="size-100" wrap>
                  <Badge variant={getTypeBadgeVariant(agent.type)}>
                    {agent.type}
                  </Badge>
                  {agent.capabilities.slice(0, 2).map(cap => (
                    <Badge key={cap} variant="neutral">
                      {cap}
                    </Badge>
                  ))}
                  {agent.capabilities.length > 2 && (
                    <Badge variant="neutral">
                      +{agent.capabilities.length - 2}
                    </Badge>
                  )}
                </Flex>

                <Flex direction="column" gap="size-100" marginTop="size-200">
                  <Flex justifyContent="space-between">
                    <Text UNSAFE_style={{ fontSize: '12px' }}>Tasks Completed</Text>
                    <Text UNSAFE_style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {agent.metrics.tasksCompleted}
                    </Text>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Text UNSAFE_style={{ fontSize: '12px' }}>Avg Response</Text>
                    <Text UNSAFE_style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {agent.metrics.avgResponseTime}ms
                    </Text>
                  </Flex>
                  <Flex justifyContent="space-between">
                    <Text UNSAFE_style={{ fontSize: '12px' }}>Success Rate</Text>
                    <Text UNSAFE_style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {(agent.metrics.successRate * 100).toFixed(1)}%
                    </Text>
                  </Flex>
                </Flex>

                <DialogTrigger>
                  <ActionButton isQuiet>
                    <Icons.Info width={16} height={16} />
                    <Text>View Details</Text>
                  </ActionButton>
                  {(close) => (
                    <Dialog>
                      <Heading>{agent.name}</Heading>
                      <Content>
                        <Flex direction="column" gap="size-200">
                          <Text>Type: {agent.type}</Text>
                          <Text>Status: {agent.status}</Text>
                          <Text>{agent.description}</Text>
                          <Heading level={4}>Capabilities</Heading>
                          <ul>
                            {agent.capabilities.map(cap => (
                              <li key={cap}>{cap}</li>
                            ))}
                          </ul>
                        </Flex>
                      </Content>
                      <Button variant="primary" onPress={close}>
                        Close
                      </Button>
                    </Dialog>
                  )}
                </DialogTrigger>
              </Flex>
            </Well>
          ))}
        </Grid>

        {agents.length === 0 && (
          <Well>
            <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
              <Icons.AlertCircle size={48} color="#6b7280" />
              <Text>No agents found</Text>
              <Button variant="primary" onPress={loadAgents}>
                <Icons.RefreshCw width={16} height={16} />
                <Text>Retry</Text>
              </Button>
            </Flex>
          </Well>
        )}
      </Flex>
    </View>
  );
}