import { useMemo } from 'react';
import { BarChart, Brain, Clock, Tag, TrendingUp, PieChart, Activity } from 'lucide-react';
import { Card } from './Card';

export interface MemoryItem {
  id: string;
  content: string;
  memory_type: string;
  importance_score: number;
  tags?: string[];
  created_at: string;
  access_count?: number;
  last_accessed?: string;
}

interface MemoryVisualizationProps {
  memories: MemoryItem[];
}

export function MemoryVisualization({ memories }: MemoryVisualizationProps) {
  const stats = useMemo(() => {
    if (!memories?.length) {
      return {
        typeBreakdown: {},
        averageImportance: 0,
        totalAccess: 0,
        tagFrequency: {},
        recentActivity: 0,
        importanceDistribution: {
          high: 0,
          medium: 0,
          low: 0
        }
      };
    }

    // Type breakdown
    const typeBreakdown = memories.reduce((acc, memory) => {
      acc[memory.memory_type] = (acc[memory.memory_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Average importance
    const averageImportance = memories.reduce((sum, memory) => 
      sum + (memory.importance_score || 0), 0) / memories.length;

    // Total access count
    const totalAccess = memories.reduce((sum, memory) => 
      sum + (memory.access_count || 0), 0);

    // Tag frequency
    const tagFrequency = memories.reduce((acc, memory) => {
      if (memory.tags) {
        memory.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    // Recent activity (memories created in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentActivity = memories.filter(memory => 
      new Date(memory.created_at) > weekAgo
    ).length;

    // Importance distribution
    const importanceDistribution = memories.reduce((acc, memory) => {
      const importance = memory.importance_score || 0;
      if (importance >= 0.7) acc.high++;
      else if (importance >= 0.4) acc.medium++;
      else acc.low++;
      return acc;
    }, { high: 0, medium: 0, low: 0 });

    return {
      typeBreakdown,
      averageImportance,
      totalAccess,
      tagFrequency,
      recentActivity,
      importanceDistribution
    };
  }, [memories]);

  const getTypeColor = (type: string) => {
    const colors = {
      episodic: 'bg-blue-500',
      semantic: 'bg-green-500',
      procedural: 'bg-purple-500',
      working: 'bg-yellow-500',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'episodic':
        return '📅';
      case 'semantic':
        return '📚';
      case 'procedural':
        return '⚙️';
      case 'working':
        return '💭';
      default:
        return '🧠';
    }
  };

  const topTags = Object.entries(stats.tagFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  const totalMemories = memories.length;
  const maxTypeCount = Math.max(...Object.values(stats.typeBreakdown));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Brain className="h-6 w-6 text-blue-500" />
        <h3 className="text-lg font-semibold">Memory Analytics</h3>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Brain className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-xl font-semibold">{totalMemories}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Importance</p>
              <p className="text-xl font-semibold">
                {(stats.averageImportance * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Access</p>
              <p className="text-xl font-semibold">{stats.totalAccess}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Recent (7d)</p>
              <p className="text-xl font-semibold">{stats.recentActivity}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Type Distribution */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <PieChart className="h-5 w-5 text-blue-500" />
            <h4 className="font-semibold">Memory Types</h4>
          </div>
          <div className="space-y-3">
            {Object.entries(stats.typeBreakdown).map(([type, count]) => (
              <div key={type} className="flex items-center space-x-3">
                <span className="text-lg">{getTypeIcon(type)}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium capitalize">{type}</span>
                    <span className="text-sm text-gray-400">{count}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getTypeColor(type)}`}
                      style={{ 
                        width: `${maxTypeCount > 0 ? (count / maxTypeCount) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Importance Distribution */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold">Importance Distribution</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-sm">High (70%+)</span>
              </div>
              <span className="text-sm font-medium">{stats.importanceDistribution.high}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-sm">Medium (40-70%)</span>
              </div>
              <span className="text-sm font-medium">{stats.importanceDistribution.medium}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-500 rounded"></div>
                <span className="text-sm">Low (&lt;40%)</span>
              </div>
              <span className="text-sm font-medium">{stats.importanceDistribution.low}</span>
            </div>
          </div>
        </Card>

        {/* Top Tags */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center space-x-2 mb-4">
            <Tag className="h-5 w-5 text-purple-500" />
            <h4 className="font-semibold">Most Used Tags</h4>
          </div>
          {topTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topTags.map(([tag, count]) => (
                <span 
                  key={tag}
                  className="px-3 py-2 bg-gray-700 rounded-full text-sm flex items-center space-x-2"
                >
                  <span>{tag}</span>
                  <span className="px-2 py-1 bg-gray-600 rounded-full text-xs">{count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No tags found</p>
          )}
        </Card>
      </div>
    </div>
  );
}