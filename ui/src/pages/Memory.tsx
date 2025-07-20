import { useState, useEffect } from 'react';
import { Brain, Search, Plus, Loader, AlertCircle, Save, X, BarChart3 } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { MemoryVisualization } from '../components/MemoryVisualization';
import { useWebSocket } from '../hooks/useWebSocket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memoryApi, MemoryItem } from '../lib/api';

// Extend the API MemoryItem type with additional fields that might be present
interface Memory extends MemoryItem {
  updated_at?: string;
  access_count?: number;
  last_accessed?: string;
  services_accessed?: string[];
  importance?: number; // Alias for importance_score for backward compatibility
}

export function Memory() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);
  const [newMemory, setNewMemory] = useState<{
    memory_type: 'semantic' | 'episodic' | 'procedural' | 'working';
    content: string;
    tags: string[];
    importance: number;
  }>({
    memory_type: 'semantic',
    content: '',
    tags: [],
    importance: 0.5,
  });
  const [tagInput, setTagInput] = useState('');

  // Fetch memories
  const { data: memories, isLoading, error } = useQuery({
    queryKey: ['memories'],
    queryFn: async (): Promise<Memory[]> => {
      try {
        const fetchedMemories = await memoryApi.retrieve(undefined, 100);
        // Map API response to our Memory interface, adding the importance alias
        return fetchedMemories.map(memory => ({
          ...memory,
          importance: memory.importance_score, // Add alias for backward compatibility
        }));
      } catch (err: any) {
        throw new Error(err.response?.data?.message || err.message || 'Failed to fetch memories');
      }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Search memories
  const searchMutation = useMutation({
    mutationFn: async (query: string): Promise<Memory[]> => {
      try {
        const searchResults = await memoryApi.search(query, 50);
        // Map API response to our Memory interface, adding the importance alias
        return searchResults.map(memory => ({
          ...memory,
          importance: memory.importance_score, // Add alias for backward compatibility
        }));
      } catch (err: any) {
        throw new Error(err.response?.data?.message || err.message || 'Failed to search memories');
      }
    },
    onSuccess: (searchResults) => {
      queryClient.setQueryData(['memories'], searchResults);
    },
    onError: (error: Error) => {
      console.error('💥 Search failed:', error);
      // Provide user feedback
      const errorMessage = error.message || 'Search failed';
      console.error('Search error details:', errorMessage);
    },
  });

  // Create memory mutation
  const createMemoryMutation = useMutation({
    mutationFn: async (memory: typeof newMemory): Promise<MemoryItem> => {
      try {
        return await memoryApi.store({
          content: memory.content,
          memory_type: memory.memory_type,
          importance: memory.importance,
          tags: memory.tags,
        });
      } catch (err: any) {
        throw new Error(err.response?.data?.message || err.message || 'Failed to create memory');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      setShowCreateModal(false);
      setNewMemory({
        memory_type: 'semantic',
        content: '',
        tags: [],
        importance: 0.5,
      });
      setTagInput('');
    },
    onError: (error: Error) => {
      console.error('💥 Create memory failed:', error);
      // Provide user feedback
      const errorMessage = error.message || 'Failed to create memory';
      console.error('Create memory error details:', errorMessage);
    },
  });

  // Update memory importance mutation
  const updateImportanceMutation = useMutation({
    mutationFn: async ({ id, importance }: { id: string; importance: number }) => {
      try {
        return await memoryApi.updateImportance(id, importance);
      } catch (err: any) {
        throw new Error(err.response?.data?.message || err.message || 'Failed to update memory importance');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
    onError: (error: Error) => {
      console.error('💥 Update importance failed:', error);
      // Provide user feedback and optionally revert changes
      const errorMessage = error.message || 'Failed to update importance';
      console.error('Update importance error details:', errorMessage);
      // Optionally refresh memories to revert any optimistic updates
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
  });

  // WebSocket connection for real-time updates
  const { isConnected, sendMessage, reconnectAttempts, maxReconnectAttempts } = useWebSocket({
    url: 'ws://localhost:9999',
    onConnect: () => {
      console.log('📡 Memory page: WebSocket connected');
    },
    onMessage: (data) => {
      console.log('📨 Memory page: WebSocket message received:', data);
      
      // Handle different message types
      if (data.type === 'memory_updated' || 
          (data.type === 'update' && data.channel === 'memories') ||
          (data.type === 'database_change' && data.table === 'ai_memories')) {
        console.log('🔄 Memory update received, refreshing data...');
        queryClient.invalidateQueries({ queryKey: ['memories'] });
      }
      
      // Handle real-time memory creation/deletion
      if (data.type === 'memory_created') {
        console.log('➕ New memory created, refreshing data...');
        queryClient.invalidateQueries({ queryKey: ['memories'] });
      }
      
      if (data.type === 'memory_deleted') {
        console.log('🗑️ Memory deleted, refreshing data...');
        queryClient.invalidateQueries({ queryKey: ['memories'] });
      }
    },
    onDisconnect: () => {
      console.log('📡 Memory page: WebSocket disconnected');
    },
    onError: (error) => {
      console.error('📡 Memory page: WebSocket error:', error);
    },
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  });

  // Subscribe to memory updates when WebSocket connection is established
  useEffect(() => {
    if (isConnected && sendMessage) {
      console.log('📡 Subscribing to memory updates...');
      
      // Subscribe to various memory-related channels
      const subscriptions = [
        {
          type: 'subscribe',
          channel: 'memories',
          table: 'ai_memories'
        },
        {
          type: 'subscribe',
          channel: 'database_changes',
          table: 'ai_memories'
        },
        {
          type: 'subscribe',
          event: 'memory_events'
        }
      ];
      
      subscriptions.forEach(subscription => {
        const success = sendMessage(subscription);
        if (!success) {
          console.warn('⚠️ Failed to send subscription:', subscription);
        }
      });
    }
  }, [isConnected, sendMessage]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    } else {
      // Reset to all memories
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    }
  };

  const handleCreateMemory = () => {
    if (newMemory.content.trim()) {
      createMemoryMutation.mutate(newMemory);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !newMemory.tags.includes(tagInput.trim())) {
      setNewMemory({
        ...newMemory,
        tags: [...newMemory.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewMemory({
      ...newMemory,
      tags: newMemory.tags.filter(t => t !== tag),
    });
  };

  const handleUpdateImportance = (memoryId: string, importance: number) => {
    console.log(`📊 Updating memory ${memoryId} importance to ${importance}`);
    updateImportanceMutation.mutate({ id: memoryId, importance });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} minutes ago`;
    } else if (hours < 24) {
      return `${hours} hours ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} days ago`;
    }
  };

  const getMemoryTypeColor = (type: Memory['memory_type']) => {
    const colors: Record<string, string> = {
      episodic: 'text-blue-500',
      semantic: 'text-green-500',
      procedural: 'text-purple-500',
      working: 'text-yellow-500',
    };
    return colors[type] || 'text-gray-500';
  };

  const getMemoryTypeIcon = (type: Memory['memory_type']) => {
    switch (type) {
      case 'episodic':
        return '📅'; // Calendar for time-based memories
      case 'semantic':
        return '📚'; // Books for knowledge
      case 'procedural':
        return '⚙️'; // Gear for procedures
      case 'working':
        return '💭'; // Thought bubble for working memory
      default:
        return '🧠';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Memory Bank</h2>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-sm text-gray-400">
              Real-time updates: {isConnected ? (
                <span className="text-green-500 font-medium">● Connected</span>
              ) : reconnectAttempts > 0 ? (
                <span className="text-yellow-500 font-medium">● Reconnecting ({reconnectAttempts}/{maxReconnectAttempts})</span>
              ) : (
                <span className="text-red-500 font-medium">● Disconnected</span>
              )}
            </p>
            {memories && memories.length > 0 && (
              <span className="text-sm text-gray-500">
                {memories.length} memories
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="secondary" 
            onClick={() => setShowVisualization(!showVisualization)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showVisualization ? 'Hide' : 'Show'} Analytics
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Store New Memory
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button 
            variant="secondary" 
            onClick={handleSearch}
            disabled={searchMutation.isPending}
          >
            {searchMutation.isPending ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>
        {searchMutation.error && (
          <div className="mt-2 p-2 bg-red-900/20 border border-red-500/20 rounded text-red-400 text-sm">
            Search failed: {searchMutation.error instanceof Error ? searchMutation.error.message : 'Unknown error'}
          </div>
        )}
      </Card>

      {/* Memory Visualization */}
      {showVisualization && memories && memories.length > 0 && (
        <MemoryVisualization memories={memories} />
      )}

      {/* Memory Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load memories</p>
          <p className="text-sm text-gray-500 mt-2">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button 
            variant="secondary" 
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['memories'] })}
          >
            Try Again
          </Button>
        </Card>
      ) : memories && memories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((memory) => (
            <Card 
              key={memory.id} 
              className="p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{getMemoryTypeIcon(memory.memory_type)}</span>
                  <span className={`text-xs font-medium ${getMemoryTypeColor(memory.memory_type)}`}>
                    {memory.memory_type.charAt(0).toUpperCase() + memory.memory_type.slice(1)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(memory.created_at)}
                </span>
              </div>
              
              <p className="text-sm text-gray-300 mb-3 line-clamp-3">
                {memory.content}
              </p>
              
              {/* Tags */}
              {memory.tags && memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {memory.tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-1 text-xs bg-gray-700 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Importance and Stats */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-3">
                    {(memory.importance || memory.importance_score) !== undefined && (
                      <div className="flex items-center space-x-1">
                        <span>Importance:</span>
                        <span className="px-2 py-1 bg-gray-700 rounded">
                          {((memory.importance || memory.importance_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {memory.access_count !== undefined && (
                    <span>Accessed {memory.access_count} times</span>
                  )}
                </div>
                
                {/* Interactive Importance Slider */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 min-w-fit">Update:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue={memory.importance || memory.importance_score || 0}
                    onChangeCapture={(e) => {
                      const target = e.target as HTMLInputElement;
                      const importance = parseFloat(target.value);
                      // Debounce the update to avoid too many API calls
                      setTimeout(() => {
                        handleUpdateImportance(memory.id, importance);
                      }, 500);
                    }}
                    className={`flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ${
                      updateImportanceMutation.isPending ? 'opacity-50' : ''
                    }`}
                    disabled={updateImportanceMutation.isPending}
                    title="Drag to update memory importance"
                  />
                  {updateImportanceMutation.isPending && (
                    <Loader className="h-3 w-3 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Brain className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No memories stored yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Click "Store New Memory" to add your first memory
          </p>
        </Card>
      )}

      {/* Create Memory Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Store New Memory</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  createMemoryMutation.reset(); // Clear any errors
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Memory Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Memory Type</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['episodic', 'semantic', 'procedural', 'working']).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewMemory({ ...newMemory, memory_type: type as "episodic" | "semantic" | "procedural" | "working" })}
                      className={`p-3 rounded-lg border transition-colors ${
                        newMemory.memory_type === type
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl block mb-1">{getMemoryTypeIcon(type)}</span>
                      <span className="text-sm capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                  placeholder="Enter memory content..."
                  className="w-full h-32 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tags..."
                    className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button variant="secondary" onClick={handleAddTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {newMemory.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newMemory.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-700 rounded-full text-sm flex items-center space-x-1"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="text-gray-400 hover:text-gray-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Importance */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Importance: {(newMemory.importance * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newMemory.importance}
                  onChange={(e) => setNewMemory({ ...newMemory, importance: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {createMemoryMutation.error && (
              <div className="p-3 bg-red-900/20 border border-red-500/20 rounded text-red-400 text-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Failed to create memory</span>
                </div>
                <div className="mt-1 text-xs text-red-300">
                  {createMemoryMutation.error instanceof Error ? createMemoryMutation.error.message : 'Unknown error occurred'}
                </div>
              </div>
            )}

            {updateImportanceMutation.error && (
              <div className="p-3 bg-red-900/20 border border-red-500/20 rounded text-red-400 text-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Failed to update importance</span>
                </div>
                <div className="mt-1 text-xs text-red-300">
                  {updateImportanceMutation.error instanceof Error ? updateImportanceMutation.error.message : 'Unknown error occurred'}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 mt-6">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowCreateModal(false);
                  createMemoryMutation.reset(); // Clear any errors
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMemory}
                disabled={!newMemory.content.trim() || createMemoryMutation.isPending}
              >
                {createMemoryMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Memory
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}