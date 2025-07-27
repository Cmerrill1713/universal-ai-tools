import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart
} from 'recharts';
import { Activity, AlertCircle, CheckCircle, Clock, Cpu, TrendingUp, TrendingDown, Users, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWebSocket } from '../hooks/useWebSocket';

interface PerformanceMetric {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_type: string;
  task_id?: string;
  task_name?: string;
  metric_type: 'execution_time' | 'resource_usage' | 'success_rate' | 'task_complexity';
  value: number;
  unit?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface AggregatedMetrics {
  agent_id: string;
  period: 'minute' | 'hour' | 'day' | 'week' | 'month';
  start_time: string;
  end_time: string;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  avg_execution_time: number;
  min_execution_time: number;
  max_execution_time: number;
  avg_cpu_usage?: number;
  avg_memory_usage?: number;
  complexity_handled: Record<string, number>;
}

interface AgentSummary {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  current_status: string;
  reliability_score: number;
  tasks_last_24h: number;
  avg_execution_time_24h: number;
  active_alerts: number;
}

interface PerformanceAlert {
  id: string;
  agent_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  created_at: string;
  resolved: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const AgentPerformanceTracker: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [agentSummaries, setAgentSummaries] = useState<AgentSummary[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<AggregatedMetrics[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [realTimeMetrics, setRealTimeMetrics] = useState<PerformanceMetric[]>([]);

  const ws = useWebSocket({ url: '/agent-performance' });

  // Fetch agent summaries
  const fetchAgentSummaries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('agent_performance_summary')
        .select('*')
        .order('reliability_score', { ascending: false });

      if (error) throw error;
      setAgentSummaries(data || []);
    } catch (error) {
      console.error('Error fetching agent summaries:', error);
    }
  }, []);

  // Fetch performance trends
  const fetchPerformanceTrends = useCallback(async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_performance_aggregated')
        .select('*')
        .eq('agent_id', agentId)
        .eq('period', timeRange)
        .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      setPerformanceTrends(data || []);
    } catch (error) {
      console.error('Error fetching performance trends:', error);
    }
  }, [timeRange]);

  // Fetch recent alerts
  const fetchRecentAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('agent_performance_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAgentSummaries(),
        fetchRecentAlerts()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchAgentSummaries, fetchRecentAlerts]);

  // Fetch trends when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      fetchPerformanceTrends(selectedAgent);
    }
  }, [selectedAgent, fetchPerformanceTrends]);

  // WebSocket event handlers
  useEffect(() => {
    if (!socketConnection || !isConnected) return;

    const handleMetricRecorded = (metric: PerformanceMetric) => {
      setRealTimeMetrics(prev => [...prev.slice(-99), metric]);
    };

    const handleTaskCompleted = (event: any) => {
      // Refresh summaries when a task completes
      fetchAgentSummaries();
    };

    this.socketConnection?.on('metricRecorded', handleMetricRecorded);
    this.socketConnection?.on('taskCompleted', handleTaskCompleted);

    return () => {
      this.socketConnection?.off('metricRecorded', handleMetricRecorded);
      this.socketConnection?.off('taskCompleted', handleTaskCompleted);
    };
  }, [socketConnection, isConnected, fetchAgentSummaries]);

  // Format execution time
  const formatExecutionTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Calculate success rate color
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Prepare chart data
  const executionTimeData = performanceTrends.map(trend => ({
    time: new Date(trend.start_time).toLocaleString(),
    avg: Math.round(trend.avg_execution_time),
    min: Math.round(trend.min_execution_time),
    max: Math.round(trend.max_execution_time)
  }));

  const successRateData = performanceTrends.map(trend => ({
    time: new Date(trend.start_time).toLocaleString(),
    successRate: trend.total_tasks > 0 
      ? Math.round((trend.successful_tasks / trend.total_tasks) * 100)
      : 0,
    totalTasks: trend.total_tasks
  }));

  const resourceUsageData = performanceTrends.filter(t => t.avg_cpu_usage !== null).map(trend => ({
    time: new Date(trend.start_time).toLocaleString(),
    cpu: Math.round(trend.avg_cpu_usage || 0),
    memory: Math.round(trend.avg_memory_usage || 0)
  }));

  // Agent comparison radar chart data
  const agentComparisonData = agentSummaries.slice(0, 5).map(agent => ({
    agent: agent.agent_name,
    reliability: agent.reliability_score,
    speed: agent.avg_execution_time_24h ? Math.max(0, 100 - (agent.avg_execution_time_24h / 100)) : 0,
    throughput: Math.min(100, agent.tasks_last_24h),
    efficiency: 100 - agent.active_alerts * 10
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Agent Performance Tracker</h1>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="hour">Last Hour</option>
            <option value="day">Last Day</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Real-time updates active' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Agent Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agentSummaries.map(agent => (
          <div
            key={agent.agent_id}
            onClick={() => setSelectedAgent(agent.agent_id)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedAgent === agent.agent_id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{agent.agent_name}</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${
                agent.current_status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                agent.current_status === 'idle' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {agent.current_status}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Reliability</span>
                <span className={`font-semibold ${getSuccessRateColor(agent.reliability_score)}`}>
                  {agent.reliability_score.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tasks (24h)</span>
                <span className="font-semibold">{agent.tasks_last_24h}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Time</span>
                <span className="font-semibold">
                  {formatExecutionTime(agent.avg_execution_time_24h || 0)}
                </span>
              </div>
              {agent.active_alerts > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Alerts</span>
                  <span className="font-semibold text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {agent.active_alerts}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Performance Charts */}
      {selectedAgent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Execution Time Trend */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-indigo-600" />
              Execution Time Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={executionTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="avg" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="Average" />
                <Area type="monotone" dataKey="max" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} name="Max" />
                <Area type="monotone" dataKey="min" stroke="#ffc658" fill="#ffc658" fillOpacity={0.3} name="Min" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rate Trend */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Success Rate Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="successRate" stroke="#00C49F" strokeWidth={2} name="Success Rate %" />
                <Line type="monotone" dataKey="totalTasks" stroke="#0088FE" strokeWidth={2} yAxisId="right" name="Total Tasks" />
                <YAxis yAxisId="right" orientation="right" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Resource Usage */}
          {resourceUsageData.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Cpu className="w-5 h-5 mr-2 text-purple-600" />
                Resource Usage
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resourceUsageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cpu" fill="#8884d8" name="CPU %" />
                  <Bar dataKey="memory" fill="#82ca9d" name="Memory MB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Task Complexity Distribution */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-orange-600" />
              Task Complexity Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(
                    performanceTrends.reduce((acc, trend) => {
                      Object.entries(trend.complexity_handled).forEach(([level, count]) => {
                        acc[level] = (acc[level] || 0) + count;
                      });
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([level, count]) => ({
                    name: `Level ${level}`,
                    value: count
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {performanceTrends.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agent Comparison Radar */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
          Agent Performance Comparison
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={agentComparisonData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="agent" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar name="Reliability" dataKey="reliability" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            <Radar name="Speed" dataKey="speed" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
            <Radar name="Throughput" dataKey="throughput" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
            <Radar name="Efficiency" dataKey="efficiency" stroke="#ff7c7c" fill="#ff7c7c" fillOpacity={0.6} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
            Recent Performance Alerts
          </h3>
          <div className="space-y-2">
            {recentAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'critical' ? 'border-red-300 bg-red-50' :
                  alert.severity === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                  'border-blue-300 bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-semibold ${
                      alert.severity === 'critical' ? 'text-red-700' :
                      alert.severity === 'warning' ? 'text-yellow-700' :
                      'text-blue-700'
                    }`}>
                      {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Metrics Stream */}
      {realTimeMetrics.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-indigo-600" />
            Real-time Metrics Stream
          </h3>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {realTimeMetrics.slice(-10).reverse().map((metric, index) => (
              <div key={index} className="text-sm text-gray-600 font-mono">
                <span className="text-gray-400">{new Date(metric.timestamp).toLocaleTimeString()}</span>
                {' - '}
                <span className="font-semibold">{metric.agent_name}</span>
                {': '}
                <span>{metric.metric_type}</span>
                {' = '}
                <span className="text-indigo-600">{metric.value.toFixed(2)}</span>
                {metric.unit && <span> {metric.unit}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};