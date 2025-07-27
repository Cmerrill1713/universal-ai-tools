import React, { useState, useEffect } from 'react';
import {
  View,
  Flex,
  Heading,
  Text,
  SearchField,
  Well,
  Button,
  ProgressBar,
  Badge,
  ActionButton,
  Dialog,
  DialogTrigger,
  Content,
  Form,
  TextField,
  TextArea
} from '@adobe/react-spectrum';
import * as Icons from 'lucide-react';

interface MemoryItem {
  id: string;
  content: string;
  type: string;
  importance: number;
  tags: string[];
  metadata: {
    source?: string;
    timestamp: string;
    relatedAgents?: string[];
  };
  embedding?: number[];
}

export default function Memory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/memory');
      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories || []);
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchMemories = async (query: string) => {
    if (!query.trim()) {
      loadMemories();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/v1/memory/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories || []);
      }
    } catch (error) {
      console.error('Failed to search memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMemory = async (content: string, tags: string[]) => {
    try {
      setIsCreating(true);
      const response = await fetch('/api/v1/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tags })
      });
      
      if (response.ok) {
        await loadMemories();
      }
    } catch (error) {
      console.error('Failed to create memory:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/memory/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setMemories(memories.filter(m => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 0.8) return '#ef4444';
    if (importance >= 0.6) return '#f59e0b';
    if (importance >= 0.4) return '#3b82f6';
    return '#6b7280';
  };

  if (loading && memories.length === 0) {
    return (
      <View padding="size-400">
        <Flex direction="column" alignItems="center" justifyContent="center" height="100vh">
          <ProgressBar label="Loading memories..." isIndeterminate />
        </Flex>
      </View>
    );
  }

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={1}>Memory Bank</Heading>
          <Flex gap="size-200">
            <DialogTrigger>
              <Button variant="cta">
                <Icons.Plus width={16} height={16} />
                <Text>New Memory</Text>
              </Button>
              {(close) => (
                <Dialog>
                  <Heading>Create New Memory</Heading>
                  <Content>
                    <Form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const content = formData.get('content') as string;
                        const tags = (formData.get('tags') as string)
                          .split(',')
                          .map(t => t.trim())
                          .filter(Boolean);
                        createMemory(content, tags);
                        close();
                      }}
                    >
                      <Flex direction="column" gap="size-200">
                        <TextArea
                          label="Content"
                          name="content"
                          isRequired
                          minHeight={150}
                        />
                        <TextField
                          label="Tags (comma-separated)"
                          name="tags"
                          placeholder="work, project, important"
                        />
                      </Flex>
                      <Flex gap="size-100" marginTop="size-300">
                        <Button type="submit" variant="cta" isDisabled={isCreating}>
                          Create
                        </Button>
                        <Button variant="secondary" onPress={close}>
                          Cancel
                        </Button>
                      </Flex>
                    </Form>
                  </Content>
                </Dialog>
              )}
            </DialogTrigger>
            <Button variant="primary" onPress={loadMemories}>
              <Icons.RefreshCw width={16} height={16} />
              <Text>Refresh</Text>
            </Button>
          </Flex>
        </Flex>

        <SearchField
          label="Search memories"
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={() => searchMemories(searchQuery)}
          width="100%"
        />

        <Flex direction="column" gap="size-200">
          {memories.map(memory => (
            <Well key={memory.id}>
              <Flex direction="column" gap="size-200">
                <Flex justifyContent="space-between" alignItems="start">
                  <Flex direction="column" gap="size-100" flex={1}>
                    <Text UNSAFE_style={{ fontSize: '16px', fontWeight: '500' }}>
                      {memory.content}
                    </Text>
                    <Flex gap="size-100" alignItems="center">
                      <Icons.Calendar width={14} height={14} color="#6b7280" />
                      <Text UNSAFE_style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(memory.metadata.timestamp).toLocaleString()}
                      </Text>
                    </Flex>
                  </Flex>
                  <Flex alignItems="center" gap="size-100">
                    <View
                      UNSAFE_style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getImportanceColor(memory.importance)
                      }}
                    />
                    <Text UNSAFE_style={{ fontSize: '12px', color: '#6b7280' }}>
                      {(memory.importance * 100).toFixed(0)}%
                    </Text>
                  </Flex>
                </Flex>

                <Flex gap="size-100" wrap>
                  {memory.tags.map(tag => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </Flex>

                {memory.metadata.relatedAgents && memory.metadata.relatedAgents.length > 0 && (
                  <Flex gap="size-100" alignItems="center">
                    <Icons.Users width={14} height={14} color="#6b7280" />
                    <Text UNSAFE_style={{ fontSize: '12px', color: '#6b7280' }}>
                      Related agents: {memory.metadata.relatedAgents.join(', ')}
                    </Text>
                  </Flex>
                )}

                <Flex gap="size-100" justifyContent="flex-end">
                  <ActionButton
                    isQuiet
                    onPress={() => deleteMemory(memory.id)}
                    UNSAFE_style={{ color: '#ef4444' }}
                  >
                    <Icons.Trash2 width={16} height={16} />
                    <Text>Delete</Text>
                  </ActionButton>
                </Flex>
              </Flex>
            </Well>
          ))}
        </Flex>

        {memories.length === 0 && !loading && (
          <Well>
            <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
              <Icons.Database size={48} color="#6b7280" />
              <Text>No memories found</Text>
              <Text UNSAFE_style={{ fontSize: '14px', color: '#6b7280' }}>
                {searchQuery ? 'Try a different search query' : 'Create your first memory to get started'}
              </Text>
            </Flex>
          </Well>
        )}
      </Flex>
    </View>
  );
}