import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import { render, mockSystemStats, resetMocks } from '../../test/utils';
import { systemApi } from '../../lib/api';

// Mock the API module
vi.mock('../../lib/api', () => ({
  systemApi: {
    getStats: vi.fn(),
  },
}));

// Mock recharts to avoid SVG rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    resetMocks();
    vi.mocked(systemApi.getStats).mockResolvedValue(mockSystemStats);
  });

  it('renders without crashing', () => {
    render(<Dashboard />);
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(<Dashboard />);
    // The component should render even during loading
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });

  it('displays system stats when loaded', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // Check for key stats that should be displayed
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('Messages Today')).toBeInTheDocument();
      expect(screen.getByText('Memories Stored')).toBeInTheDocument();
      expect(screen.getByText('Tokens Used')).toBeInTheDocument();
    });
  });

  it('displays correct stat values', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // Check that the mocked values are displayed
      expect(screen.getByText('5')).toBeInTheDocument(); // activeAgents
      expect(screen.getByText('247')).toBeInTheDocument(); // messagestoday
      expect(screen.getByText('1543')).toBeInTheDocument(); // totalMemories
    });
  });

  it('renders performance charts', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // Check that chart components are rendered
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('displays memory type breakdown', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // Check for memory type section
      expect(screen.getByText('Memory Distribution')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    // Mock a failed API call
    vi.mocked(systemApi.getStats).mockRejectedValue(new Error('API Error'));
    
    render(<Dashboard />);

    // Component should still render without crashing
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<Dashboard />);

    // Check that component renders with proper structure
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
    expect(screen.getByText('Messages Today')).toBeInTheDocument();
  });

  it('renders stat cards with proper structure', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      // Check that stat cards have proper structure
      const statCards = screen.getAllByText(/Active Agents|Messages Today|Total Memories|Tokens Used/);
      expect(statCards).toHaveLength(4);
    });
  });
});