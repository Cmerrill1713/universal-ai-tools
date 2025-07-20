import React from 'react';
// Temporarily disabled - missing UI library components
// import {
//   Search,
//   GitBranch,
//   BookOpen,
//   Layers,
//   Link,
//   Brain,
//   Target,
//   Sparkles,
//   ChevronRight,
//   Info
// } from 'lucide-react';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Skeleton } from '@/components/ui/skeleton';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { api } from '@/lib/api';

/*
interface SearchResult {
  memory_id: string;
  content: string;
  domain: string;
  relevance_score: number;
  context_score: number;
  final_score: number;
  related_memories: string[];
  metadata: any;
}
*/

/*
interface KnowledgePath {
  path_id: number;
  memory_sequence: string[];
  content_sequence: string[];
  domain_sequence: string[];
  total_strength: number;
  path_description: string;
}
*/

/*
interface KnowledgeCluster {
  primary_cluster: string;
  complexity_level: string;
  memory_count: number;
  avg_importance: number;
  domains: string[];
  cluster_keywords: string[];
}
*/

export const KnowledgeExplorer: React.FC = () => {
  return (
    <div className="p-4">
      <h2>Knowledge Explorer</h2>
      <p>Component temporarily disabled - UI library components missing</p>
    </div>
  );
};

/* Temporarily disabled component - needs UI library
export const KnowledgeExplorerDisabled: React.FC = () => {
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [knowledgePaths, setKnowledgePaths] = useState<KnowledgePath[]>([]);
  const [clusters, setClusters] = useState<KnowledgeCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // Load knowledge clusters on mount
  useEffect(() => {
    loadClusters();
  }, []);

  const loadClusters = async () => {
    try {
      const response = await api.post('/api/context/clusters');
      setClusters(response.data);
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await api.post('/api/context/search', {
        query,
        intent: intent || undefined,
        domains: selectedDomains.length > 0 ? selectedDomains : undefined,
        maxResults: 20
      });

      setSearchResults(response.data.results);
      
      // Also load knowledge paths
      const pathsResponse = await api.post('/api/context/knowledge-paths', {
        query,
        traversalDepth: 2,
        maxPaths: 5
      });
      
      setKnowledgePaths(pathsResponse.data.paths);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIntentIcon = (intentValue: string) => {
    switch (intentValue) {
      case 'learning': return <BookOpen className="w-4 h-4" />;
      case 'debugging': return <Target className="w-4 h-4" />;
      case 'implementation': return <Layers className="w-4 h-4" />;
      case 'optimization': return <Sparkles className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      'supabase': 'bg-green-500',
      'graphql': 'bg-purple-500',
      'agent-orchestration-system': 'bg-blue-500',
      'reranking': 'bg-orange-500',
      'default': 'bg-gray-500'
    };
    return colors[domain] || colors.default;
  };

  const renderSearchResults = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      );
    }

    if (searchResults.length === 0 && query) {
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No results found. Try adjusting your search terms or intent.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        {searchResults.map((result) => (
          <Card key={result.memory_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${getDomainColor(result.domain)} text-white`}>
                    {result.domain}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Score: {result.final_score.toFixed(3)}
                  </span>
                </div>
                {result.related_memories.length > 0 && (
                  <Badge variant="outline">
                    <Link className="w-3 h-3 mr-1" />
                    {result.related_memories.length} related
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm line-clamp-3">{result.content}</p>
              {result.metadata && Object.keys(result.metadata).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {result.metadata.tags?.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderKnowledgePaths = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      );
    }

    if (knowledgePaths.length === 0) {
      return (
        <Alert>
          <GitBranch className="h-4 w-4" />
          <AlertDescription>
            No knowledge paths found. Try searching first.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        {knowledgePaths.map((path) => (
          <Card key={path.path_id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {path.path_description}
              </CardTitle>
              <CardDescription className="text-xs">
                Strength: {path.total_strength.toFixed(3)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {path.domain_sequence.map((domain, idx) => (
                  <React.Fragment key={idx}>
                    <Badge className={`${getDomainColor(domain)} text-white whitespace-nowrap`}>
                      {domain}
                    </Badge>
                    {idx < path.domain_sequence.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderClusters = () => {
    if (clusters.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-32 w-32 rounded-full" />
        </div>
      );
    }

    const clusterGroups = clusters.reduce((acc, cluster) => {
      if (!acc[cluster.primary_cluster]) {
        acc[cluster.primary_cluster] = [];
      }
      acc[cluster.primary_cluster].push(cluster);
      return acc;
    }, {} as Record<string, KnowledgeCluster[]>);

    return (
      <div className="space-y-6">
        {Object.entries(clusterGroups).map(([clusterName, items]) => (
          <div key={clusterName}>
            <h3 className="text-lg font-semibold mb-3 capitalize">
              {clusterName.replace(/-/g, ' ')}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((cluster, idx) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{cluster.complexity_level}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {cluster.memory_count} items
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Avg importance: {cluster.avg_importance.toFixed(2)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cluster.cluster_keywords.slice(0, 5).map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Brain className="w-8 h-8" />
          Knowledge Explorer
        </h1>
        <p className="text-muted-foreground">
          Explore and discover connections in the enhanced searchable context system
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search across knowledge domains..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All intents</SelectItem>
                  <SelectItem value="learning">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Learning
                    </div>
                  </SelectItem>
                  <SelectItem value="debugging">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Debugging
                    </div>
                  </SelectItem>
                  <SelectItem value="implementation">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Implementation
                    </div>
                  </SelectItem>
                  <SelectItem value="optimization">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Optimization
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {['supabase', 'graphql', 'agent-orchestration-system', 'reranking'].map((domain) => (
                <Badge
                  key={domain}
                  variant={selectedDomains.includes(domain) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedDomains(prev =>
                      prev.includes(domain)
                        ? prev.filter(d => d !== domain)
                        : [...prev, domain]
                    );
                  }}
                >
                  {domain}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search Results</TabsTrigger>
          <TabsTrigger value="paths">Knowledge Paths</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <ScrollArea className="h-[600px] pr-4">
            {renderSearchResults()}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="paths" className="mt-4">
          <ScrollArea className="h-[600px] pr-4">
            {renderKnowledgePaths()}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="clusters" className="mt-4">
          <ScrollArea className="h-[600px] pr-4">
            {renderClusters()}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
*/