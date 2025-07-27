import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import Memory from '../../pages/Memory';
import { render, mockMemoryItem, resetMocks } from '../../test/utils';

// Mock the API module
vi.mock('../../lib/api', () => ({
  memoryApi: {
    retrieve: vi.fn(),
    search: vi.fn(),
    store: vi.fn(),
    updateImportance: vi.fn(),
  },
}));

// Mock the hooks
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}));

vi.mock('../../components/MemoryVisualization', () => ({
  MemoryVisualization: ({ memories }: any) => (
    <div data-testid="memory-visualization">
      Memory Visualization with {memories.length} memories
    </div>
  ),
}));

import { memoryApi } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';

// Mock icon components to avoid rendering issues
vi.mock('lucide-react', () => ({
  Brain: ({ className }: any) => <div data-testid="brain-icon" className={className} />,
  Search: ({ className }: any) => <div data-testid="search-icon" className={className} />,
  Plus: ({ className }: any) => <div data-testid="plus-icon" className={className} />,
  Loader: ({ className }: any) => <div data-testid="loader-icon" className={className} />,
  AlertCircle: ({ className }: any) => <div data-testid="alert-icon" className={className} />,
  Save: ({ className }: any) => <div data-testid="save-icon" className={className} />,
  X: ({ className }: any) => <div data-testid="x-icon" className={className} />,
  BarChart3: ({ className }: any) => <div data-testid="chart-icon" className={className} />,
}));

describe('Memory Component', () => {
  const mockMemories = [
    {
      ...mockMemoryItem,
      id: 'memory-1',
      content: 'First test memory',
      memory_type: 'semantic' as const,
      importance_score: 0.8,
      tags: ['test', 'semantic'],
    },
    {
      ...mockMemoryItem,
      id: 'memory-2',
      content: 'Second test memory',
      memory_type: 'episodic' as const,
      importance_score: 0.6,
      tags: ['test', 'episodic'],
    },
  ];

  const mockUseWebSocket = {
    isConnected: true,
    sendMessage: vi.fn(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
  };

  beforeEach(() => {
    resetMocks();
    vi.mocked(memoryApi.retrieve).mockResolvedValue(mockMemories);
    vi.mocked(memoryApi.search).mockResolvedValue(mockMemories);
    vi.mocked(memoryApi.store).mockResolvedValue(mockMemoryItem);
    vi.mocked(memoryApi.updateImportance).mockResolvedValue(mockMemoryItem);
    vi.mocked(useWebSocket).mockReturnValue(mockUseWebSocket);
  });

  it('renders without crashing', () => {
    render(<Memory />);
    expect(screen.getByText('Memory Bank')).toBeInTheDocument();
  });

  it('displays this.connected status when WebSocket is this.connected', () => {
    render(<Memory />);
    expect(screen.getByText(/● Connected/)).toBeInTheDocument();
  });

  it('displays disconnected status when WebSocket is disconnected', () => {
    vi.mocked(useWebSocket).mockReturnValue({
      ...mockUseWebSocket,
      isConnected: false,
    });

    render(<Memory />);
    expect(screen.getByText(/● Disconnected/)).toBeInTheDocument();
  });

  it('displays reconnecting status during reconnection attempts', () => {
    vi.mocked(useWebSocket).mockReturnValue({
      ...mockUseWebSocket,
      isConnected: false,
      reconnectAttempts: 3,
    });

    render(<Memory />);
    expect(screen.getByText(/● Reconnecting \(3\/10\)/)).toBeInTheDocument();
  });

  it('displays loading state while fetching memories', () => {
    render(<Memory />);
    // Initial loading state might be brief, but component should handle it
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('displays memories when loaded', async () => {
    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('First test memory')).toBeInTheDocument();
      expect(screen.getByText('Second test memory')).toBeInTheDocument();
    });
  });

  it('displays memory count correctly', async () => {
    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('2 memories')).toBeInTheDocument();
    });
  });

  it('displays empty state when no memories', async () => {
    vi.mocked(memoryApi.retrieve).mockResolvedValue([]);

    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('No memories stored yet')).toBeInTheDocument();
      expect(screen.getByText('Click "Store New Memory" to add your first memory')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    vi.mocked(memoryApi.retrieve).mockRejectedValue(new Error('API Error'));

    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load memories')).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('First test memory')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search memories...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.click(searchButton);

    expect(memoryApi.search).toHaveBeenCalledWith('test query', 50);
  });

  it('handles search on Enter key', async () => {
    render(<Memory />);

    const searchInput = screen.getByPlaceholderText('Search memories...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter' });

    expect(memoryApi.search).toHaveBeenCalledWith('test query', 50);
  });

  it('opens create memory modal', async () => {
    render(<Memory />);

    const createButton = screen.getByText('Store New Memory');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Store New Memory')).toBeInTheDocument();
      expect(screen.getByText('Memory Type')).toBeInTheDocument();
    });
  });

  it('handles memory creation', async () => {
    render(<Memory />);

    // Open modal
    const createButton = screen.getByText('Store New Memory');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter memory content...')).toBeInTheDocument();
    });

    // Fill form
    const contentInput = screen.getByPlaceholderText('Enter memory content...');
    fireEvent.change(contentInput, { target: { value: 'New test memory' } });

    // Submit
    const submitButton = screen.getByText('Create Memory');
    fireEvent.click(submitButton);

    expect(memoryApi.store).toHaveBeenCalledWith({
      content: 'New test memory',
      memory_type: 'semantic',
      importance: 0.5,
      tags: [],
    });
  });

  it('handles tag addition in create modal', async () => {
    render(<Memory />);

    // Open modal
    fireEvent.click(screen.getByText('Store New Memory'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
    });

    // Add tag
    const tagInput = screen.getByPlaceholderText('Add tags...');
    fireEvent.change(tagInput, { target: { value: 'test-tag' } });
    fireEvent.keyPress(tagInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('test-tag')).toBeInTheDocument();
    });
  });

  it('handles tag removal in create modal', async () => {
    render(<Memory />);

    // Open modal
    fireEvent.click(screen.getByText('Store New Memory'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
    });

    // Add tag
    const tagInput = screen.getByPlaceholderText('Add tags...');
    fireEvent.change(tagInput, { target: { value: 'test-tag' } });
    fireEvent.keyPress(tagInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('test-tag')).toBeInTheDocument();
    });

    // Remove tag
    const removeButton = screen.getByText('test-tag').nextElementSibling;
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('test-tag')).not.toBeInTheDocument();
    });
  });

  it('handles memory type selection in create modal', async () => {
    render(<Memory />);

    // Open modal
    fireEvent.click(screen.getByText('Store New Memory'));

    await waitFor(() => {
      expect(screen.getByText('Episodic')).toBeInTheDocument();
    });

    // Select episodic type
    const episodicButton = screen.getByText('Episodic');
    fireEvent.click(episodicButton);

    // Fill content and submit
    const contentInput = screen.getByPlaceholderText('Enter memory content...');
    fireEvent.change(contentInput, { target: { value: 'Episodic memory' } });

    const submitButton = screen.getByText('Create Memory');
    fireEvent.click(submitButton);

    expect(memoryApi.store).toHaveBeenCalledWith({
      content: 'Episodic memory',
      memory_type: 'episodic',
      importance: 0.5,
      tags: [],
    });
  });

  it('handles importance slider in create modal', async () => {
    render(<Memory />);

    // Open modal
    fireEvent.click(screen.getByText('Store New Memory'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
    });

    // Change importance
    const importanceSlider = screen.getByDisplayValue('0.5');
    fireEvent.change(importanceSlider, { target: { value: '0.8' } });

    // Should show 80%
    expect(screen.getByText('Importance: 80%')).toBeInTheDocument();
  });

  it('handles memory importance update', async () => {
    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('First test memory')).toBeInTheDocument();
    });

    // Find importance slider for the first memory
    const importanceSliders = screen.getAllByTitle('Drag to update memory importance');
    if (importanceSliders.length > 0) {
      fireEvent.change(importanceSliders[0], { target: { value: '0.9' } });

      // Wait for debounced update
      await waitFor(() => {
        expect(memoryApi.updateImportance).toHaveBeenCalledWith('memory-1', 0.9);
      }, { timeout: 1000 });
    }
  });

  it('displays memory type icons correctly', async () => {
    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('📚')).toBeInTheDocument(); // Semantic
      expect(screen.getByText('📅')).toBeInTheDocument(); // Episodic
    });
  });

  it('displays memory type colors correctly', async () => {
    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText('Semantic')).toBeInTheDocument();
      expect(screen.getByText('Episodic')).toBeInTheDocument();
    });
  });

  it('shows/hides analytics visualization', async () => {
    render(<Memory />);

    // Initially hidden
    expect(screen.queryByTestId('memory-visualization')).not.toBeInTheDocument();

    // Show analytics
    const analyticsButton = screen.getByText('Show Analytics');
    fireEvent.click(analyticsButton);

    await waitFor(() => {
      expect(screen.getByTestId('memory-visualization')).toBeInTheDocument();
    });

    // Hide analytics
    const hideButton = screen.getByText('Hide Analytics');
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(screen.queryByTestId('memory-visualization')).not.toBeInTheDocument();
    });
  });

  it('handles modal close', async () => {
    render(<Memory />);

    // Open modal
    fireEvent.click(screen.getByText('Store New Memory'));

    await waitFor(() => {
      expect(screen.getByText('Store New Memory')).toBeInTheDocument();
    });

    // Close modal with X button
    const closeButton = screen.getByTestId('x-icon').closest('button');
    if (closeButton) {
      fireEvent.click(closeButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('Memory Type')).not.toBeInTheDocument();
    });
  });

  it('prevents form submission with empty content', async () => {
    render(<Memory />);

    // Open modal
    fireEvent.click(screen.getByText('Store New Memory'));

    await waitFor(() => {
      expect(screen.getByText('Create Memory')).toBeInTheDocument();
    });

    // Try to submit without content
    const submitButton = screen.getByText('Create Memory');
    expect(submitButton).toBeDisabled();
  });

  it('handles search error gracefully', async () => {
    vi.mocked(memoryApi.search).mockRejectedValue(new Error('Search failed'));

    render(<Memory />);

    const searchInput = screen.getByPlaceholderText('Search memories...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/Search failed/)).toBeInTheDocument();
    });
  });

  it('displays formatted relative time correctly', async () => {
    const recentMemory = {
      ...mockMemoryItem,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    };

    vi.mocked(memoryApi.retrieve).mockResolvedValue([recentMemory]);

    render(<Memory />);

    await waitFor(() => {
      expect(screen.getByText(/30 minutes ago/)).toBeInTheDocument();
    });
  });
});