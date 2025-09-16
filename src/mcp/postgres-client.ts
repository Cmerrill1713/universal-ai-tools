/**
 * PostgreSQL Client Wrapper
 * Provides a simple interface for PostgreSQL operations
 */

import pg from 'pg';

export class PostgresClient {
  private client: pg.Client;
  private connected: boolean = false;

  constructor() {
    this.client = new pg.Client({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '54321'),
      database: process.env.POSTGRES_DB || 'postgres',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }

  async query(text: string, params?: any[]): Promise<pg.QueryResult> {
    await this.connect();
    return await this.client.query(text, params);
  }

  async upsertRepository(data: {
    id: number;
    name: string;
    full_name: string;
    description?: string;
    html_url?: string;
    clone_url?: string;
    language?: string;
    stars?: number;
    forks?: number;
    open_issues?: number;
    created_at?: string;
    updated_at?: string;
    pushed_at?: string;
    owner_login: string;
    owner_id?: number;
    data?: any;
  }): Promise<void> {
    const query = `
      INSERT INTO github_repositories (
        id, name, full_name, description, html_url, clone_url, language,
        stars, forks, open_issues, created_at, updated_at, pushed_at,
        owner_login, owner_id, data, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (full_name) DO UPDATE SET
        stars = EXCLUDED.stars,
        forks = EXCLUDED.forks,
        open_issues = EXCLUDED.open_issues,
        updated_at = EXCLUDED.updated_at,
        last_synced = EXCLUDED.last_synced,
        data = EXCLUDED.data;
    `;

    await this.query(query, [
      data.id, data.name, data.full_name, data.description, data.html_url,
      data.clone_url, data.language, data.stars, data.forks, data.open_issues,
      data.created_at, data.updated_at, data.pushed_at, data.owner_login,
      data.owner_id, data.data ? JSON.stringify(data.data) : null
    ]);
  }

  async upsertIssue(data: {
    id: number;
    number: number;
    repository: string;
    title: string;
    body?: string;
    state: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
    author: string;
    created_at?: string;
    updated_at?: string;
    closed_at?: string;
    html_url?: string;
    comments?: number;
    data?: any;
  }): Promise<void> {
    const query = `
      INSERT INTO github_issues (
        id, number, repository, title, body, state, labels, assignees,
        author, created_at, updated_at, closed_at, html_url, comments, data, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (repository, number) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        state = EXCLUDED.state,
        labels = EXCLUDED.labels,
        assignees = EXCLUDED.assignees,
        updated_at = EXCLUDED.updated_at,
        closed_at = EXCLUDED.closed_at,
        comments = EXCLUDED.comments,
        data = EXCLUDED.data,
        last_synced = EXCLUDED.last_synced;
    `;

    await this.query(query, [
      data.id, data.number, data.repository, data.title, data.body, data.state,
      data.labels, data.assignees, data.author, data.created_at, data.updated_at,
      data.closed_at, data.html_url, data.comments, data.data ? JSON.stringify(data.data) : null
    ]);
  }

  async storeData(data: {
    data_type: string;
    data: any;
    repository_id?: string;
    tags?: string[];
  }): Promise<string> {
    const query = `
      INSERT INTO github_data (data_type, data, repository_id, tags)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;

    const result = await this.query(query, [
      data.data_type,
      JSON.stringify(data.data),
      data.repository_id,
      data.tags
    ]);

    return result.rows[0].id;
  }

  async getRepositories(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT * FROM github_repositories
      ORDER BY last_synced DESC
      LIMIT $1;
    `;

    const result = await this.query(query, [limit]);
    return result.rows;
  }

  async getIssues(repository?: string, limit: number = 10): Promise<any[]> {
    let query = `
      SELECT * FROM github_issues
    `;
    const params: any[] = [limit];

    if (repository) {
      query += ` WHERE repository = $2`;
      params.unshift(repository);
    }

    query += ` ORDER BY last_synced DESC LIMIT $${params.length};`;

    const result = await this.query(query, params);
    return result.rows;
  }

  async getData(dataType?: string, repositoryId?: string, limit: number = 10): Promise<any[]> {
    let query = `
      SELECT * FROM github_data
    `;
    const params: any[] = [limit];
    let paramCount = 1;

    const conditions: string[] = [];
    if (dataType) {
      conditions.push(`data_type = $${++paramCount}`);
      params.splice(-1, 0, dataType);
    }
    if (repositoryId) {
      conditions.push(`repository_id = $${++paramCount}`);
      params.splice(-1, 0, repositoryId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $1;`;

    const result = await this.query(query, params);
    return result.rows;
  }

  async upsertPullRequest(data: {
    id: number;
    number: number;
    repository: string;
    title: string;
    body?: string;
    state: 'open' | 'closed';
    head_ref: string;
    base_ref: string;
    author: string;
    created_at?: string;
    updated_at?: string;
    merged_at?: string;
    html_url?: string;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    data?: any;
  }): Promise<void> {
    const query = `
      INSERT INTO github_pull_requests (
        id, number, repository, title, body, state, head_ref, base_ref,
        author, created_at, updated_at, merged_at, html_url, additions,
        deletions, changed_files, data, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (repository, number) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        state = EXCLUDED.state,
        head_ref = EXCLUDED.head_ref,
        base_ref = EXCLUDED.base_ref,
        updated_at = EXCLUDED.updated_at,
        merged_at = EXCLUDED.merged_at,
        additions = EXCLUDED.additions,
        deletions = EXCLUDED.deletions,
        changed_files = EXCLUDED.changed_files,
        data = EXCLUDED.data,
        last_synced = EXCLUDED.last_synced;
    `;

    await this.query(query, [
      data.id, data.number, data.repository, data.title, data.body, data.state,
      data.head_ref, data.base_ref, data.author, data.created_at, data.updated_at,
      data.merged_at, data.html_url, data.additions, data.deletions, data.changed_files,
      data.data ? JSON.stringify(data.data) : null
    ]);
  }

  async upsertCommit(data: {
    sha: string;
    repository: string;
    message: string;
    author: string;
    author_email?: string;
    committer?: string;
    committer_email?: string;
    created_at?: string;
    html_url?: string;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    data?: any;
  }): Promise<void> {
    const query = `
      INSERT INTO github_commits (
        sha, repository, message, author, author_email, committer, committer_email,
        created_at, html_url, additions, deletions, changed_files, data, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (repository, sha) DO UPDATE SET
        message = EXCLUDED.message,
        author = EXCLUDED.author,
        author_email = EXCLUDED.author_email,
        committer = EXCLUDED.committer,
        committer_email = EXCLUDED.committer_email,
        created_at = EXCLUDED.created_at,
        additions = EXCLUDED.additions,
        deletions = EXCLUDED.deletions,
        changed_files = EXCLUDED.changed_files,
        data = EXCLUDED.data,
        last_synced = EXCLUDED.last_synced;
    `;

    await this.query(query, [
      data.sha, data.repository, data.message, data.author, data.author_email,
      data.committer, data.committer_email, data.created_at, data.html_url,
      data.additions, data.deletions, data.changed_files, data.data ? JSON.stringify(data.data) : null
    ]);
  }

  async ensureTablesExist(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS github_repositories (
        id BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        full_name VARCHAR(500) NOT NULL UNIQUE,
        description TEXT,
        html_url TEXT,
        clone_url TEXT,
        language VARCHAR(100),
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        open_issues INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        pushed_at TIMESTAMP WITH TIME ZONE,
        owner_login VARCHAR(255) NOT NULL,
        owner_id BIGINT,
        data JSONB,
        last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS github_issues (
        id BIGINT PRIMARY KEY,
        number INTEGER NOT NULL,
        repository VARCHAR(500) NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        state VARCHAR(20) NOT NULL CHECK (state IN ('open', 'closed')),
        labels TEXT[],
        assignees TEXT[],
        author VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        closed_at TIMESTAMP WITH TIME ZONE,
        html_url TEXT,
        comments INTEGER DEFAULT 0,
        data JSONB,
        last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(repository, number)
      );`,
      `CREATE TABLE IF NOT EXISTS github_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_type VARCHAR(100) NOT NULL,
        data JSONB NOT NULL,
        repository_id VARCHAR(500),
        tags TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
      `CREATE TABLE IF NOT EXISTS github_pull_requests (
        id BIGINT PRIMARY KEY,
        number INTEGER NOT NULL,
        repository VARCHAR(500) NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        state VARCHAR(20) NOT NULL CHECK (state IN ('open', 'closed')),
        head_ref VARCHAR(255) NOT NULL,
        base_ref VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        merged_at TIMESTAMP WITH TIME ZONE,
        html_url TEXT,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        changed_files INTEGER DEFAULT 0,
        data JSONB,
        last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(repository, number)
      );`,
      `CREATE TABLE IF NOT EXISTS github_commits (
        sha VARCHAR(40) PRIMARY KEY,
        repository VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        author_email VARCHAR(255),
        committer VARCHAR(255),
        committer_email VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE,
        html_url TEXT,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        changed_files INTEGER DEFAULT 0,
        data JSONB,
        last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(repository, sha)
      );`
    ];

    for (const table of tables) {
      await this.query(table);
    }
  }
}
