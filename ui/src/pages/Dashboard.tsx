import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Brain,
  MessageSquare,
  Users,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { Card } from '../components/Card';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  // Fetch system stats
  const { data: statsResponse } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const response = await fetch('http://localhost:9999/api/stats', {
        headers: {
          'X-API-Key': 'local-dev-key',
          'X-AI-Service': 'local-ui',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    },
    refetchInterval: 5000,
  });

  const stats = statsResponse?.stats;

  // Mock data for charts
  const performanceData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    tokens: Math.floor(Math.random() * 1000),
  }));

  const statsCards = [
    {
      title: 'Active Agents',
      value: stats?.activeAgents?.toString() || '0',
      icon: Users,
      change: '+2',
      trend: 'up',
    },
    {
      title: 'Messages Today',
      value: stats?.messagestoday?.toString() || '0',
      icon: MessageSquare,
      change: '+12%',
      trend: 'up',
    },
    {
      title: 'Memories Stored',
      value: stats?.totalMemories?.toString() || '0',
      icon: Brain,
      change: '+234',
      trend: 'up',
    },
    {
      title: 'Tokens Used',
      value: stats?.tokensUsed || '45.2K',
      icon: Zap,
      change: '-5%',
      trend: 'down',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                <p
                  className={`text-sm mt-2 ${
                    stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {stat.change} from last hour
                </p>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <stat.icon className="h-6 w-6 text-gray-400" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU & Memory Usage */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">System Resources</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                }}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="CPU %"
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
                name="Memory %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Token Usage */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Token Usage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                }}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Active Services */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Ollama', status: 'online', endpoint: 'http://localhost:11434' },
            { name: 'Redis', status: 'online', endpoint: 'redis://localhost:6379' },
            { name: 'SearXNG', status: 'online', endpoint: 'http://localhost:8888' },
            { name: 'PostgreSQL', status: 'online', endpoint: 'postgresql://localhost:5432' },
            { name: 'Prometheus', status: 'online', endpoint: 'http://localhost:9090' },
            { name: 'Grafana', status: 'online', endpoint: 'http://localhost:3001' },
          ].map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
            >
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-gray-400">{service.endpoint}</p>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    service.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm capitalize">{service.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}