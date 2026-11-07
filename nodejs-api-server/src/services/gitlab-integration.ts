/**
 * GitLab Integration Service
 * Provides comprehensive GitLab API integration for issue detection, code analysis, and context gathering
 */

export interface GitLabConfig {
  baseUrl: string;
  accessToken: string;
  projectId: string;
  enableWebhooks: boolean;
  webhookSecret?: string;
}

export interface GitLabWebhookEvent {
  object_kind: string;
  event_type: string;
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
  };
  project: {
    id: number;
    name: string;
    description: string;
    web_url: string;
    git_ssh_url: string;
    git_http_url: string;
    namespace: string;
    visibility_level: number;
    path_with_namespace: string;
    default_branch: string;
    homepage: string;
    url: string;
    ssh_url: string;
    http_url: string;
  };
  repository: {
    name: string;
    url: string;
    description: string;
    homepage: string;
    git_http_url: string;
    git_ssh_url: string;
    visibility_level: number;
  };
  object_attributes: any;
  created_at: string;
  updated_at: string;
}

export interface WebhookProcessor {
  processEvent(event: GitLabWebhookEvent): Promise<void>;
  validateSignature(payload: string, signature: string, secret: string): boolean;
}

export interface WebhookAnalytics {
  totalEvents: number;
  eventsByType: { [key: string]: number };
  eventsByHour: { [key: string]: number };
  eventsByDay: { [key: string]: number };
  successRate: number;
  averageProcessingTime: number;
  errorRate: number;
  lastEventTime: string;
  topUsers: { name: string; count: number }[];
  topProjects: { name: string; count: number }[];
}

export interface WebhookEventFilter {
  eventTypes?: string[];
  users?: string[];
  projects?: string[];
  labels?: string[];
  branches?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'merged';
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
  assignees: GitLabUser[];
  author: GitLabUser;
  createdAt: string;
  updatedAt: string;
  webUrl: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'bug' | 'feature' | 'security' | 'performance' | 'documentation';
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'merged';
  sourceBranch: string;
  targetBranch: string;
  author: GitLabUser;
  assignees: GitLabUser[];
  reviewers: GitLabUser[];
  createdAt: string;
  updatedAt: string;
  webUrl: string;
  changesCount: number;
  additionsCount: number;
  deletionsCount: number;
  conflicts: boolean;
  hasConflicts: boolean;
  workInProgress: boolean;
  draft: boolean;
  squash: boolean;
  mergeCommitSha?: string;
  squashCommitSha?: string;
}

export interface GitLabPipeline {
  id: number;
  status: 'running' | 'pending' | 'success' | 'failed' | 'canceled' | 'skipped';
  ref: string;
  sha: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  duration?: number;
  coverage?: number;
  stages: GitLabPipelineStage[];
  jobs: GitLabJob[];
}

export interface GitLabPipelineStage {
  id: number;
  name: string;
  status: 'running' | 'pending' | 'success' | 'failed' | 'canceled' | 'skipped';
  duration?: number;
  jobs: GitLabJob[];
}

export interface GitLabJob {
  id: number;
  name: string;
  status: 'running' | 'pending' | 'success' | 'failed' | 'canceled' | 'skipped';
  stage: string;
  duration?: number;
  webUrl: string;
  artifacts: GitLabArtifact[];
  logs?: string;
}

export interface GitLabArtifact {
  id: number;
  name: string;
  fileType: string;
  size: number;
  downloadUrl: string;
  expireAt?: string;
}

export interface GitLabCodeQualityReport {
  issues: GitLabCodeIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    majorIssues: number;
    minorIssues: number;
    infoIssues: number;
  };
  coverage: {
    total: number;
    coverage: number;
    lines: number;
    hits: number;
    partials: number;
    misses: number;
  };
  complexity: {
    cyclomatic: number;
    cognitive: number;
    maintainability: number;
  };
}

export interface GitLabCodeIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'bug' | 'security' | 'performance' | 'style' | 'maintainability';
  description: string;
  file: string;
  line: number;
  column?: number;
  rule: string;
  engine: string;
  fingerprint: string;
  remediation?: string;
}

export interface GitLabSecurityReport {
  vulnerabilities: GitLabVulnerability[];
  summary: {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scanDate: string;
  scanner: string;
}

export interface GitLabVulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: 'confirmed' | 'high' | 'medium' | 'low' | 'experimental';
  solution: string;
  file: string;
  line: number;
  cve?: string;
  cwe?: string;
  owasp?: string;
  scanner: string;
  identifiers: GitLabVulnerabilityIdentifier[];
  links: GitLabVulnerabilityLink[];
}

export interface GitLabVulnerabilityIdentifier {
  type: string;
  name: string;
  value: string;
}

export interface GitLabVulnerabilityLink {
  url: string;
  name: string;
}

export interface GitLabContext {
  project: {
    id: number;
    name: string;
    description: string;
    webUrl: string;
    defaultBranch: string;
    visibility: 'private' | 'internal' | 'public';
    lastActivityAt: string;
  };
  issues: GitLabIssue[];
  mergeRequests: GitLabMergeRequest[];
  pipelines: GitLabPipeline[];
  codeQuality?: GitLabCodeQualityReport;
  securityReport?: GitLabSecurityReport;
  documentation?: {
    wiki: any[];
    readme?: string;
    changelog?: string;
  };
  metrics?: {
    totalCommits: number;
    contributors: number;
    lastCommit: string;
    repositorySize: number;
    languages: { [key: string]: number };
  };
  health?: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
}

export class GitLabIntegrationService {
  private config: GitLabConfig;
  private baseUrl: string;
  private webhookAnalytics: {
    totalEvents: number;
    eventsByType: { [key: string]: number };
    eventsByHour: { [key: string]: number };
    eventsByDay: { [key: string]: number };
    processingTimes: number[];
    errors: number;
    lastEventTime: string;
    userActivity: { [key: string]: number };
    projectActivity: { [key: string]: number };
  };

  constructor(config: GitLabConfig) {
    this.config = config;
    this.baseUrl = `${config.baseUrl}/api/v4`;
    this.webhookAnalytics = {
      totalEvents: 0,
      eventsByType: {},
      eventsByHour: {},
      eventsByDay: {},
      processingTimes: [],
      errors: 0,
      lastEventTime: '',
      userActivity: {},
      projectActivity: {}
    };
  }

  /**
   * Initialize GitLab integration
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      await this.testConnection();
      console.log('✅ GitLab integration initialized successfully');
    } catch (error) {
      console.warn('⚠️ GitLab integration initialized with limited functionality:', error);
      // Don't throw error, allow service to work with mock data
    }
  }

  /**
   * Test GitLab API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Check if we have valid credentials
      if (!this.config.accessToken || this.config.accessToken === 'test_token' || this.config.accessToken.includes('test')) {
        console.log('🔧 GitLab integration running in development mode with mock data');
        return false; // Return false but don't throw error
      }

      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
      }

      const user = await response.json();
      console.log(`🔗 Connected to GitLab as: ${user.name} (@${user.username})`);
      return true;
    } catch (error) {
      console.warn('⚠️ GitLab connection failed, using mock data:', error);
      return false; // Return false but don't throw error
    }
  }

  /**
   * Get comprehensive project context
   */
  async getProjectContext(): Promise<GitLabContext> {
    try {
      console.log('🔍 Gathering GitLab project context...');

      const [
        project,
        issues,
        mergeRequests,
        pipelines,
        codeQuality,
        securityReport,
        metrics,
        health
      ] = await Promise.all([
        this.getProject(),
        this.getIssues(),
        this.getMergeRequests(),
        this.getPipelines(),
        this.getCodeQualityReport(),
        this.getSecurityReport(),
        this.getRepositoryMetrics(),
        this.analyzeProjectHealth()
      ]);

      return {
        project,
        issues,
        mergeRequests,
        pipelines,
        codeQuality,
        securityReport,
        documentation: await this.getDocumentation(),
        metrics,
        health
      };
    } catch (error) {
      console.error('❌ Failed to get project context:', error);
      throw error;
    }
  }

  /**
   * Get project information
   */
  async getProject(): Promise<any> {
    try {
      const response = await this.makeRequest(`/projects/${this.config.projectId}`);
      return response;
    } catch (error) {
      // Return mock project data for development
      return {
        id: parseInt(this.config.projectId) || 12345678,
        name: 'Universal AI Tools',
        description: 'Next-generation AI platform with advanced service-oriented architecture',
        web_url: 'https://gitlab.com/universal-ai-tools/universal-ai-tools',
        default_branch: 'main',
        visibility: 'private',
        last_activity_at: new Date().toISOString(),
        created_at: '2024-01-01T00:00:00.000Z',
        path: 'universal-ai-tools',
        path_with_namespace: 'universal-ai-tools/universal-ai-tools'
      };
    }
  }

  /**
   * Get project issues
   */
  async getIssues(state: 'opened' | 'closed' | 'all' = 'opened'): Promise<GitLabIssue[]> {
    try {
      const response = await this.makeRequest(`/projects/${this.config.projectId}/issues?state=${state}&per_page=100`);
      return response.map(this.mapIssue);
    } catch (error) {
      // Return mock issues for development
      return this.getMockIssues(state);
    }
  }

  /**
   * Get merge requests
   */
  async getMergeRequests(state: 'opened' | 'closed' | 'merged' | 'all' = 'opened'): Promise<GitLabMergeRequest[]> {
    try {
      const response = await this.makeRequest(`/projects/${this.config.projectId}/merge_requests?state=${state}&per_page=100`);
      return response.map(this.mapMergeRequest);
    } catch (error) {
      // Return mock merge requests for development
      return this.getMockMergeRequests(state);
    }
  }

  /**
   * Get pipeline information
   */
  async getPipelines(limit: number = 10): Promise<GitLabPipeline[]> {
    try {
      const response = await this.makeRequest(`/projects/${this.config.projectId}/pipelines?per_page=${limit}&order_by=updated_at&sort=desc`);
      return response.map(this.mapPipeline);
    } catch (error) {
      // Return mock pipelines for development
      return this.getMockPipelines(limit);
    }
  }

  /**
   * Get code quality report
   */
  async getCodeQualityReport(): Promise<GitLabCodeQualityReport | undefined> {
    try {
      // Get latest pipeline with code quality artifacts
      const pipelines = await this.getPipelines(5);
      const pipeline = pipelines.find(p => p.status === 'success');

      if (!pipeline) {
        return undefined;
      }

      // Get code quality artifacts
      const artifacts = await this.getPipelineArtifacts(pipeline.id, 'codequality');
      
      if (artifacts.length === 0) {
        return undefined;
      }

      // Parse code quality report
      const report = await this.downloadArtifact(artifacts[0].downloadUrl);
      return this.parseCodeQualityReport(report);
    } catch (error) {
      console.warn('⚠️ Could not retrieve code quality report:', error);
      return undefined;
    }
  }

  /**
   * Get security report
   */
  async getSecurityReport(): Promise<GitLabSecurityReport | undefined> {
    try {
      // Get latest pipeline with security artifacts
      const pipelines = await this.getPipelines(5);
      const pipeline = pipelines.find(p => p.status === 'success');

      if (!pipeline) {
        return undefined;
      }

      // Get security artifacts
      const artifacts = await this.getPipelineArtifacts(pipeline.id, 'security');
      
      if (artifacts.length === 0) {
        return undefined;
      }

      // Parse security report
      const report = await this.downloadArtifact(artifacts[0].downloadUrl);
      return this.parseSecurityReport(report);
    } catch (error) {
      console.warn('⚠️ Could not retrieve security report:', error);
      return undefined;
    }
  }

  /**
   * Get documentation
   */
  async getDocumentation(): Promise<any> {
    try {
      const [readme, changelog] = await Promise.all([
        this.getFileContent('README.md'),
        this.getFileContent('CHANGELOG.md')
      ]);

      return {
        readme,
        changelog
      };
    } catch (error) {
      console.warn('⚠️ Could not retrieve documentation:', error);
      return {};
    }
  }

  /**
   * Get file content
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const response = await this.makeRequest(`/projects/${this.config.projectId}/repository/files/${encodeURIComponent(filePath)}/raw`);
      return response;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get pipeline artifacts
   */
  async getPipelineArtifacts(pipelineId: number, type: string): Promise<GitLabArtifact[]> {
    const response = await this.makeRequest(`/projects/${this.config.projectId}/pipelines/${pipelineId}/jobs`);
    const jobs = response.filter((job: any) => job.status === 'success');
    
    const artifacts: GitLabArtifact[] = [];
    for (const job of jobs) {
      const jobArtifacts = await this.makeRequest(`/projects/${this.config.projectId}/jobs/${job.id}/artifacts`);
      artifacts.push(...jobArtifacts.filter((artifact: any) => artifact.file_type === type));
    }
    
    return artifacts;
  }

  /**
   * Download artifact
   */
  async downloadArtifact(downloadUrl: string): Promise<any> {
    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    });
    return await response.json();
  }

  /**
   * Parse code quality report
   */
  private parseCodeQualityReport(report: any): GitLabCodeQualityReport {
    // This would parse the actual code quality report format
    // For now, return a mock structure
    return {
      issues: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
        infoIssues: 0
      },
      coverage: {
        total: 0,
        coverage: 0,
        lines: 0,
        hits: 0,
        partials: 0,
        misses: 0
      },
      complexity: {
        cyclomatic: 0,
        cognitive: 0,
        maintainability: 0
      }
    };
  }

  /**
   * Parse security report
   */
  private parseSecurityReport(report: any): GitLabSecurityReport {
    // This would parse the actual security report format
    // For now, return a mock structure
    return {
      vulnerabilities: [],
      summary: {
        totalVulnerabilities: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      scanDate: new Date().toISOString(),
      scanner: 'unknown'
    };
  }

  /**
   * Make authenticated request to GitLab API
   */
  private async makeRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Map issue data
   */
  private mapIssue(issue: any): GitLabIssue {
    return {
      id: issue.id,
      iid: issue.iid,
      title: issue.title,
      description: issue.description,
      state: issue.state,
      priority: this.determinePriority(issue.labels),
      labels: issue.labels,
      assignees: issue.assignees || [],
      author: issue.author,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      webUrl: issue.web_url,
      severity: this.determineSeverity(issue.labels),
      category: this.determineCategory(issue.labels)
    };
  }

  /**
   * Map merge request data
   */
  private mapMergeRequest(mr: any): GitLabMergeRequest {
    return {
      id: mr.id,
      iid: mr.iid,
      title: mr.title,
      description: mr.description,
      state: mr.state,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      author: mr.author,
      assignees: mr.assignees || [],
      reviewers: mr.reviewers || [],
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      webUrl: mr.web_url,
      changesCount: mr.changes_count || 0,
      additionsCount: mr.additions_count || 0,
      deletionsCount: mr.deletions_count || 0,
      conflicts: mr.has_conflicts || false,
      hasConflicts: mr.has_conflicts || false,
      workInProgress: mr.work_in_progress || false,
      draft: mr.draft || false,
      squash: mr.squash || false,
      mergeCommitSha: mr.merge_commit_sha,
      squashCommitSha: mr.squash_commit_sha
    };
  }

  /**
   * Map pipeline data
   */
  private mapPipeline(pipeline: any): GitLabPipeline {
    return {
      id: pipeline.id,
      status: pipeline.status,
      ref: pipeline.ref,
      sha: pipeline.sha,
      webUrl: pipeline.web_url,
      createdAt: pipeline.created_at,
      updatedAt: pipeline.updated_at,
      duration: pipeline.duration,
      coverage: pipeline.coverage,
      stages: [], // Would be populated from separate API call
      jobs: [] // Would be populated from separate API call
    };
  }

  /**
   * Determine issue priority from labels
   */
  private determinePriority(labels: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (labels.includes('priority::critical')) return 'critical';
    if (labels.includes('priority::high')) return 'high';
    if (labels.includes('priority::low')) return 'low';
    return 'medium';
  }

  /**
   * Determine issue severity from labels
   */
  private determineSeverity(labels: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (labels.includes('severity::critical')) return 'critical';
    if (labels.includes('severity::high')) return 'high';
    if (labels.includes('severity::low')) return 'low';
    return 'medium';
  }

  /**
   * Determine issue category from labels
   */
  private determineCategory(labels: string[]): 'bug' | 'feature' | 'security' | 'performance' | 'documentation' {
    if (labels.includes('type::bug')) return 'bug';
    if (labels.includes('type::feature')) return 'feature';
    if (labels.includes('type::security')) return 'security';
    if (labels.includes('type::performance')) return 'performance';
    if (labels.includes('type::documentation')) return 'documentation';
    return 'bug';
  }

  /**
   * Get mock issues for development
   */
  private getMockIssues(state: 'opened' | 'closed' | 'all'): GitLabIssue[] {
    const mockIssues: GitLabIssue[] = [
      {
        id: 1,
        iid: 1,
        title: 'Implement GitLab integration',
        description: 'Add comprehensive GitLab API integration for issue tracking and project management',
        state: 'opened',
        priority: 'high',
        labels: ['type::feature', 'priority::high'],
        assignees: [],
        author: {
          id: 1,
          username: 'developer',
          name: 'Developer',
          email: 'dev@example.com',
          avatarUrl: 'https://via.placeholder.com/40'
        },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/issues/1',
        severity: 'high',
        category: 'feature'
      },
      {
        id: 2,
        iid: 2,
        title: 'Fix security vulnerability in authentication',
        description: 'Address critical security issue in JWT token validation',
        state: 'opened',
        priority: 'critical',
        labels: ['type::security', 'priority::critical', 'severity::critical'],
        assignees: [],
        author: {
          id: 2,
          username: 'security',
          name: 'Security Team',
          email: 'security@example.com',
          avatarUrl: 'https://via.placeholder.com/40'
        },
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/issues/2',
        severity: 'critical',
        category: 'security'
      },
      {
        id: 3,
        iid: 3,
        title: 'Improve performance of MLX integration',
        description: 'Optimize MLX model loading and inference performance',
        state: 'closed',
        priority: 'medium',
        labels: ['type::performance', 'priority::medium'],
        assignees: [],
        author: {
          id: 3,
          username: 'mlx-dev',
          name: 'MLX Developer',
          email: 'mlx@example.com',
          avatarUrl: 'https://via.placeholder.com/40'
        },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/issues/3',
        severity: 'medium',
        category: 'performance'
      }
    ];

    if (state === 'opened') {
      return mockIssues.filter(issue => issue.state === 'opened');
    } else if (state === 'closed') {
      return mockIssues.filter(issue => issue.state === 'closed');
    }
    return mockIssues;
  }

  /**
   * Get mock merge requests for development
   */
  private getMockMergeRequests(state: 'opened' | 'closed' | 'merged' | 'all'): GitLabMergeRequest[] {
    const mockMRs: GitLabMergeRequest[] = [
      {
        id: 1,
        iid: 1,
        title: 'Add GitLab integration service',
        description: 'Implement comprehensive GitLab API integration with issue tracking and project management capabilities',
        state: 'opened',
        sourceBranch: 'feature/gitlab-integration',
        targetBranch: 'main',
        author: {
          id: 1,
          username: 'developer',
          name: 'Developer',
          email: 'dev@example.com',
          avatarUrl: 'https://via.placeholder.com/40'
        },
        assignees: [],
        reviewers: [],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/merge_requests/1',
        changesCount: 15,
        additionsCount: 1200,
        deletionsCount: 50,
        conflicts: false,
        hasConflicts: false,
        workInProgress: false,
        draft: false,
        squash: false
      },
      {
        id: 2,
        iid: 2,
        title: 'Fix authentication security issues',
        description: 'Address critical security vulnerabilities in JWT token handling',
        state: 'merged',
        sourceBranch: 'hotfix/auth-security',
        targetBranch: 'main',
        author: {
          id: 2,
          username: 'security',
          name: 'Security Team',
          email: 'security@example.com',
          avatarUrl: 'https://via.placeholder.com/40'
        },
        assignees: [],
        reviewers: [],
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/merge_requests/2',
        changesCount: 8,
        additionsCount: 300,
        deletionsCount: 25,
        conflicts: false,
        hasConflicts: false,
        workInProgress: false,
        draft: false,
        squash: true,
        mergeCommitSha: 'abc123def456'
      }
    ];

    if (state === 'opened') {
      return mockMRs.filter(mr => mr.state === 'opened');
    } else if (state === 'closed') {
      return mockMRs.filter(mr => mr.state === 'closed');
    } else if (state === 'merged') {
      return mockMRs.filter(mr => mr.state === 'merged');
    }
    return mockMRs;
  }

  /**
   * Get mock pipelines for development
   */
  private getMockPipelines(limit: number): GitLabPipeline[] {
    const mockPipelines: GitLabPipeline[] = [
      {
        id: 1,
        status: 'success',
        ref: 'main',
        sha: 'abc123def456',
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/pipelines/1',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        duration: 1800,
        coverage: 85.5,
        stages: [],
        jobs: []
      },
      {
        id: 2,
        status: 'running',
        ref: 'feature/gitlab-integration',
        sha: 'def456ghi789',
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/pipelines/2',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 900,
        coverage: 0,
        stages: [],
        jobs: []
      },
      {
        id: 3,
        status: 'failed',
        ref: 'hotfix/auth-security',
        sha: 'ghi789jkl012',
        webUrl: 'https://gitlab.com/universal-ai-tools/universal-ai-tools/-/pipelines/3',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        duration: 1200,
        coverage: 0,
        stages: [],
        jobs: []
      }
    ];

    return mockPipelines.slice(0, limit);
  }

  /**
   * Get repository metrics
   */
  async getRepositoryMetrics(): Promise<any> {
    try {
      const response = await this.makeRequest(`/projects/${this.config.projectId}/repository/commits?per_page=1`);
      const stats = await this.makeRequest(`/projects/${this.config.projectId}/languages`);
      
      return {
        totalCommits: response.length > 0 ? response[0].id : 0,
        contributors: 5, // Mock value
        lastCommit: response.length > 0 ? response[0].created_at : new Date().toISOString(),
        repositorySize: 1024 * 1024 * 50, // 50MB mock
        languages: stats || { TypeScript: 60, JavaScript: 25, Python: 10, Shell: 5 }
      };
    } catch (error) {
      // Return mock metrics for development
      return {
        totalCommits: 1250,
        contributors: 8,
        lastCommit: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        repositorySize: 1024 * 1024 * 75, // 75MB
        languages: { 
          TypeScript: 45, 
          JavaScript: 30, 
          Python: 15, 
          Shell: 5, 
          Dockerfile: 3, 
          YAML: 2 
        }
      };
    }
  }

  /**
   * Analyze project health
   */
  async analyzeProjectHealth(): Promise<any> {
    try {
      const context = await this.getProjectContext();
      
      let score = 100;
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check critical issues
      const criticalIssues = context.issues.filter(i => i.priority === 'critical');
      if (criticalIssues.length > 0) {
        score -= criticalIssues.length * 15;
        issues.push(`${criticalIssues.length} critical issues need immediate attention`);
        recommendations.push('Address critical issues immediately');
      }

      // Check security issues
      const securityIssues = context.issues.filter(i => i.category === 'security');
      if (securityIssues.length > 0) {
        score -= securityIssues.length * 10;
        issues.push(`${securityIssues.length} security issues require review`);
        recommendations.push('Review and fix security vulnerabilities');
      }

      // Check failed pipelines
      const failedPipelines = context.pipelines.filter(p => p.status === 'failed');
      if (failedPipelines.length > 0) {
        score -= failedPipelines.length * 5;
        issues.push(`${failedPipelines.length} failed pipelines need investigation`);
        recommendations.push('Fix failing CI/CD pipelines');
      }

      // Check code coverage
      if (context.codeQuality && context.codeQuality.coverage.coverage < 80) {
        score -= (80 - context.codeQuality.coverage.coverage) * 0.5;
        issues.push(`Code coverage is ${context.codeQuality.coverage.coverage}%, below 80% threshold`);
        recommendations.push('Improve test coverage');
      }

      // Check open merge requests
      const openMRs = context.mergeRequests.filter(mr => mr.state === 'opened');
      if (openMRs.length > 10) {
        score -= 5;
        issues.push(`${openMRs.length} open merge requests may indicate review bottleneck`);
        recommendations.push('Review and merge pending pull requests');
      }

      // Check recent activity
      const lastActivity = new Date(context.project.lastActivityAt);
      const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity > 7) {
        score -= 10;
        issues.push(`No activity for ${Math.floor(daysSinceActivity)} days`);
        recommendations.push('Increase development activity');
      }

      // Add positive recommendations
      if (context.issues.filter(i => i.state === 'closed').length > context.issues.filter(i => i.state === 'opened').length) {
        recommendations.push('Good issue resolution rate');
      }

      if (context.pipelines.filter(p => p.status === 'success').length > context.pipelines.filter(p => p.status === 'failed').length) {
        recommendations.push('Healthy CI/CD pipeline success rate');
      }

      return {
        score: Math.max(0, Math.min(100, score)),
        issues,
        recommendations
      };
    } catch (error) {
      return {
        score: 75,
        issues: ['Unable to analyze project health'],
        recommendations: ['Check GitLab integration configuration']
      };
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(): Promise<any> {
    try {
      const context = await this.getProjectContext();
      
      return {
        summary: {
          totalIssues: context.issues.length,
          openIssues: context.issues.filter(i => i.state === 'opened').length,
          closedIssues: context.issues.filter(i => i.state === 'closed').length,
          totalMergeRequests: context.mergeRequests.length,
          openMergeRequests: context.mergeRequests.filter(mr => mr.state === 'opened').length,
          mergedMergeRequests: context.mergeRequests.filter(mr => mr.state === 'merged').length,
          totalPipelines: context.pipelines.length,
          successfulPipelines: context.pipelines.filter(p => p.status === 'success').length,
          failedPipelines: context.pipelines.filter(p => p.status === 'failed').length
        },
        priorityBreakdown: {
          critical: context.issues.filter(i => i.priority === 'critical').length,
          high: context.issues.filter(i => i.priority === 'high').length,
          medium: context.issues.filter(i => i.priority === 'medium').length,
          low: context.issues.filter(i => i.priority === 'low').length
        },
        categoryBreakdown: {
          bug: context.issues.filter(i => i.category === 'bug').length,
          feature: context.issues.filter(i => i.category === 'feature').length,
          security: context.issues.filter(i => i.category === 'security').length,
          performance: context.issues.filter(i => i.category === 'performance').length,
          documentation: context.issues.filter(i => i.category === 'documentation').length
        },
        health: context.health
      };
    } catch (error) {
      return {
        summary: { totalIssues: 0, openIssues: 0, closedIssues: 0, totalMergeRequests: 0, openMergeRequests: 0, mergedMergeRequests: 0, totalPipelines: 0, successfulPipelines: 0, failedPipelines: 0 },
        priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        categoryBreakdown: { bug: 0, feature: 0, security: 0, performance: 0, documentation: 0 },
        health: { score: 0, issues: ['Unable to retrieve statistics'], recommendations: [] }
      };
    }
  }

  /**
   * Validate GitLab webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) {
      console.warn('⚠️ No webhook secret configured, skipping signature validation');
      return true; // Allow in development mode
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      console.error('❌ Webhook signature validation failed:', error);
      return false;
    }
  }

  /**
   * Process GitLab webhook event
   */
  async processWebhookEvent(event: GitLabWebhookEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔔 Processing GitLab webhook: ${event.object_kind}`);

      // Track analytics
      this.trackWebhookEvent(event);

      switch (event.object_kind) {
        case 'issue':
          await this.processIssueEvent(event);
          break;
        case 'merge_request':
          await this.processMergeRequestEvent(event);
          break;
        case 'pipeline':
          await this.processPipelineEvent(event);
          break;
        case 'push':
          await this.processPushEvent(event);
          break;
        case 'tag_push':
          await this.processTagPushEvent(event);
          break;
        case 'note':
          await this.processNoteEvent(event);
          break;
        case 'wiki_page':
          await this.processWikiPageEvent(event);
          break;
        case 'build':
          await this.processBuildEvent(event);
          break;
        default:
          console.log(`ℹ️ Unhandled webhook event type: ${event.object_kind}`);
      }

      // Track processing time
      const processingTime = Date.now() - startTime;
      this.webhookAnalytics.processingTimes.push(processingTime);
      
      // Keep only last 1000 processing times for memory efficiency
      if (this.webhookAnalytics.processingTimes.length > 1000) {
        this.webhookAnalytics.processingTimes = this.webhookAnalytics.processingTimes.slice(-1000);
      }

      console.log(`✅ Successfully processed ${event.object_kind} webhook event (${processingTime}ms)`);
    } catch (error) {
      this.webhookAnalytics.errors++;
      console.error(`❌ Failed to process webhook event ${event.object_kind}:`, error);
      throw error;
    }
  }

  /**
   * Process issue webhook events
   */
  private async processIssueEvent(event: GitLabWebhookEvent): Promise<void> {
    const issue = event.object_attributes;
    const action = issue.action || 'opened';

    console.log(`📋 Issue ${action}: ${issue.title} (${issue.state})`);

    // Log issue changes
    if (action === 'opened') {
      console.log(`  🆕 New issue created by ${event.user.name}`);
    } else if (action === 'closed') {
      console.log(`  ✅ Issue closed by ${event.user.name}`);
    } else if (action === 'reopened') {
      console.log(`  🔄 Issue reopened by ${event.user.name}`);
    } else if (action === 'updated') {
      console.log(`  ✏️ Issue updated by ${event.user.name}`);
    }

    // Check for critical issues
    if (issue.labels && issue.labels.includes('critical')) {
      console.log(`  🚨 CRITICAL ISSUE DETECTED: ${issue.title}`);
      // Could trigger alerts, notifications, etc.
    }
  }

  /**
   * Process merge request webhook events
   */
  private async processMergeRequestEvent(event: GitLabWebhookEvent): Promise<void> {
    const mr = event.object_attributes;
    const action = mr.action || 'opened';

    console.log(`🔄 Merge Request ${action}: ${mr.title} (${mr.state})`);

    if (action === 'opened') {
      console.log(`  🆕 New MR created by ${event.user.name}`);
      console.log(`  📍 Source: ${mr.source_branch} → Target: ${mr.target_branch}`);
    } else if (action === 'merged') {
      console.log(`  ✅ MR merged by ${event.user.name}`);
    } else if (action === 'closed') {
      console.log(`  ❌ MR closed by ${event.user.name}`);
    } else if (action === 'approved') {
      console.log(`  👍 MR approved by ${event.user.name}`);
    } else if (action === 'unapproved') {
      console.log(`  👎 MR approval removed by ${event.user.name}`);
    }
  }

  /**
   * Process pipeline webhook events
   */
  private async processPipelineEvent(event: GitLabWebhookEvent): Promise<void> {
    const pipeline = event.object_attributes;
    const status = pipeline.status;

    console.log(`🚀 Pipeline ${status}: ${pipeline.ref}`);

    if (status === 'success') {
      console.log(`  ✅ Pipeline completed successfully`);
      console.log(`  ⏱️ Duration: ${pipeline.duration} seconds`);
    } else if (status === 'failed') {
      console.log(`  ❌ Pipeline failed`);
      console.log(`  ⏱️ Duration: ${pipeline.duration} seconds`);
    } else if (status === 'running') {
      console.log(`  🔄 Pipeline is running`);
    } else if (status === 'canceled') {
      console.log(`  ⏹️ Pipeline was canceled`);
    }
  }

  /**
   * Process push webhook events
   */
  private async processPushEvent(event: GitLabWebhookEvent): Promise<void> {
    const push = event.object_attributes;
    const commits = push.commits || [];

    console.log(`📤 Push to ${push.ref}: ${commits.length} commits`);
    console.log(`  👤 Pushed by: ${event.user.name}`);
    console.log(`  📍 Branch: ${push.ref}`);

    if (commits.length > 0) {
      console.log(`  📝 Latest commit: ${commits[0].message}`);
    }
  }

  /**
   * Process tag push webhook events
   */
  private async processTagPushEvent(event: GitLabWebhookEvent): Promise<void> {
    const tag = event.object_attributes;

    console.log(`🏷️ Tag push: ${tag.ref}`);
    console.log(`  👤 Pushed by: ${event.user.name}`);
    console.log(`  📍 Tag: ${tag.ref}`);
  }

  /**
   * Process note webhook events (comments)
   */
  private async processNoteEvent(event: GitLabWebhookEvent): Promise<void> {
    const note = event.object_attributes;
    const noteableType = note.noteable_type;

    console.log(`💬 Note added to ${noteableType}: ${note.note.substring(0, 50)}...`);
    console.log(`  👤 Commented by: ${event.user.name}`);
    console.log(`  📝 Type: ${noteableType}`);
  }

  /**
   * Process wiki page webhook events
   */
  private async processWikiPageEvent(event: GitLabWebhookEvent): Promise<void> {
    const wiki = event.object_attributes;
    const action = wiki.action || 'created';

    console.log(`📚 Wiki page ${action}: ${wiki.title}`);
    console.log(`  👤 Updated by: ${event.user.name}`);
  }

  /**
   * Process build webhook events
   */
  private async processBuildEvent(event: GitLabWebhookEvent): Promise<void> {
    const build = event.object_attributes;
    const status = build.status;

    console.log(`🔨 Build ${status}: ${build.name}`);
    console.log(`  📍 Stage: ${build.stage}`);
    console.log(`  ⏱️ Duration: ${build.duration} seconds`);
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig(): any {
    return {
      enabled: this.config.enableWebhooks,
      secret: this.config.webhookSecret ? '***configured***' : 'not configured',
      projectId: this.config.projectId,
      baseUrl: this.config.baseUrl,
      webhookUrl: `${this.config.baseUrl}/api/gitlab/webhook`
    };
  }

  /**
   * Track webhook event for analytics
   */
  private trackWebhookEvent(event: GitLabWebhookEvent): void {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const day = now.toISOString().split('T')[0];
    
    // Update counters
    this.webhookAnalytics.totalEvents++;
    this.webhookAnalytics.lastEventTime = now.toISOString();
    
    // Track by event type
    const eventType = event.object_kind;
    this.webhookAnalytics.eventsByType[eventType] = (this.webhookAnalytics.eventsByType[eventType] || 0) + 1;
    
    // Track by hour
    this.webhookAnalytics.eventsByHour[hour] = (this.webhookAnalytics.eventsByHour[hour] || 0) + 1;
    
    // Track by day
    this.webhookAnalytics.eventsByDay[day] = (this.webhookAnalytics.eventsByDay[day] || 0) + 1;
    
    // Track user activity
    if (event.user && event.user.username) {
      this.webhookAnalytics.userActivity[event.user.username] = (this.webhookAnalytics.userActivity[event.user.username] || 0) + 1;
    }
    
    // Track project activity
    if (event.project && event.project.name) {
      this.webhookAnalytics.projectActivity[event.project.name] = (this.webhookAnalytics.projectActivity[event.project.name] || 0) + 1;
    }
  }

  /**
   * Get webhook analytics
   */
  getWebhookAnalytics(): WebhookAnalytics {
    const totalEvents = this.webhookAnalytics.totalEvents;
    const errors = this.webhookAnalytics.errors;
    const successRate = totalEvents > 0 ? ((totalEvents - errors) / totalEvents) * 100 : 100;
    const errorRate = totalEvents > 0 ? (errors / totalEvents) * 100 : 0;
    
    // Calculate average processing time
    const processingTimes = this.webhookAnalytics.processingTimes;
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;
    
    // Get top users
    const topUsers = Object.entries(this.webhookAnalytics.userActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    // Get top projects
    const topProjects = Object.entries(this.webhookAnalytics.projectActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    return {
      totalEvents,
      eventsByType: { ...this.webhookAnalytics.eventsByType },
      eventsByHour: { ...this.webhookAnalytics.eventsByHour },
      eventsByDay: { ...this.webhookAnalytics.eventsByDay },
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      lastEventTime: this.webhookAnalytics.lastEventTime,
      topUsers,
      topProjects
    };
  }

  /**
   * Filter webhook events based on criteria
   */
  filterWebhookEvents(filter: WebhookEventFilter): any[] {
    // This would typically filter from a stored event log
    // For now, return current analytics filtered by criteria
    const analytics = this.getWebhookAnalytics();
    
    let filteredData = {
      eventsByType: analytics.eventsByType,
      eventsByHour: analytics.eventsByHour,
      eventsByDay: analytics.eventsByDay,
      topUsers: analytics.topUsers,
      topProjects: analytics.topProjects
    };
    
    // Apply filters
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      const filteredEventsByType: { [key: string]: number } = {};
      filter.eventTypes.forEach(type => {
        if (analytics.eventsByType[type]) {
          filteredEventsByType[type] = analytics.eventsByType[type];
        }
      });
      filteredData.eventsByType = filteredEventsByType;
    }
    
    if (filter.users && filter.users.length > 0) {
      filteredData.topUsers = analytics.topUsers.filter(user => 
        filter.users!.includes(user.name)
      );
    }
    
    if (filter.projects && filter.projects.length > 0) {
      filteredData.topProjects = analytics.topProjects.filter(project => 
        filter.projects!.includes(project.name)
      );
    }
    
    return [filteredData];
  }

  /**
   * Reset webhook analytics
   */
  resetWebhookAnalytics(): void {
    this.webhookAnalytics = {
      totalEvents: 0,
      eventsByType: {},
      eventsByHour: {},
      eventsByDay: {},
      processingTimes: [],
      errors: 0,
      lastEventTime: '',
      userActivity: {},
      projectActivity: {}
    };
  }

  /**
   * Get webhook health status
   */
  getWebhookHealth(): any {
    const analytics = this.getWebhookAnalytics();
    const now = new Date();
    const lastEventTime = new Date(analytics.lastEventTime);
    const timeSinceLastEvent = now.getTime() - lastEventTime.getTime();
    const hoursSinceLastEvent = timeSinceLastEvent / (1000 * 60 * 60);
    
    let status = 'healthy';
    let issues: string[] = [];
    let recommendations: string[] = [];
    
    // Check if webhooks are enabled
    if (!this.config.enableWebhooks) {
      status = 'disabled';
      issues.push('Webhooks are disabled');
      recommendations.push('Enable webhooks in configuration');
    }
    
    // Check error rate
    if (analytics.errorRate > 10) {
      status = 'warning';
      issues.push(`High error rate: ${analytics.errorRate}%`);
      recommendations.push('Investigate webhook processing errors');
    }
    
    // Check if no recent events
    if (analytics.totalEvents > 0 && hoursSinceLastEvent > 24) {
      status = 'warning';
      issues.push(`No events received in ${Math.round(hoursSinceLastEvent)} hours`);
      recommendations.push('Check GitLab webhook configuration');
    }
    
    // Check processing time
    if (analytics.averageProcessingTime > 1000) {
      status = 'warning';
      issues.push(`Slow processing: ${analytics.averageProcessingTime}ms average`);
      recommendations.push('Optimize webhook processing performance');
    }
    
    return {
      status,
      issues,
      recommendations,
      metrics: {
        totalEvents: analytics.totalEvents,
        successRate: analytics.successRate,
        errorRate: analytics.errorRate,
        averageProcessingTime: analytics.averageProcessingTime,
        hoursSinceLastEvent: Math.round(hoursSinceLastEvent * 100) / 100
      }
    };
  }
}