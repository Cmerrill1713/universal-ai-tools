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
      console.error('❌ Failed to initialize GitLab integration:', error);
      throw error;
    }
  }

  /**
   * Test GitLab API connection
   */
  async testConnection(): Promise<boolean> {
    try {
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
      console.error('❌ GitLab connection failed:', error);
      throw error;
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
    const response = await this.makeRequest(`/projects/${this.config.projectId}`);
    return response;
  }

  /**
   * Get project issues
   */
  async getIssues(state: 'opened' | 'closed' | 'all' = 'opened'): Promise<GitLabIssue[]> {
    const response = await this.makeRequest(`/projects/${this.config.projectId}/issues?state=${state}&per_page=100`);
    return response.map(this.mapIssue);
  }

  /**
   * Get merge requests
   */
  async getMergeRequests(state: 'opened' | 'closed' | 'merged' | 'all' = 'opened'): Promise<GitLabMergeRequest[]> {
    const response = await this.makeRequest(`/projects/${this.config.projectId}/merge_requests?state=${state}&per_page=100`);
    return response.map(this.mapMergeRequest);
  }

  /**
   * Get pipeline information
   */
  async getPipelines(limit: number = 10): Promise<GitLabPipeline[]> {
    const response = await this.makeRequest(`/projects/${this.config.projectId}/pipelines?per_page=${limit}&order_by=updated_at&sort=desc`);
    return response.map(this.mapPipeline);
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
}