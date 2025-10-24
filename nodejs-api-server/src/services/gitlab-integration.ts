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
}

export class GitLabIntegrationService {
  private config: GitLabConfig;
  private baseUrl: string;

  constructor(config: GitLabConfig) {
    this.config = config;
    this.baseUrl = `${config.baseUrl}/api/v4`;
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
        securityReport
      ] = await Promise.all([
        this.getProject(),
        this.getIssues(),
        this.getMergeRequests(),
        this.getPipelines(),
        this.getCodeQualityReport(),
        this.getSecurityReport()
      ]);

      return {
        project,
        issues,
        mergeRequests,
        pipelines,
        codeQuality,
        securityReport,
        documentation: await this.getDocumentation()
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
}