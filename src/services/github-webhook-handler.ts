#!/usr/bin/env node

/**
 * GitHub Webhook Handler
 * Processes GitHub webhook events and stores them in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import express from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '@octokit/webhooks-types';

const app = express();
const port = process.env.GITHUB_WEBHOOK_PORT || 8095;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GitHub webhook secret for verification
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/json' }));

// Verify GitHub webhook signature
function verifySignature(payload: string, signature: string): boolean {
  if (!webhookSecret) {
    console.warn('No webhook secret configured, skipping verification');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
}

// Process different webhook events
async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  const eventType = event.type;
  const repository = event.repository?.full_name;

  if (!repository) {
    console.warn('No repository found in webhook event');
    return;
  }

  console.log(`Processing ${eventType} event for ${repository}`);

  try {
    switch (eventType) {
      case 'push':
        await processPushEvent(event as any);
        break;
      case 'issues':
        await processIssuesEvent(event as any);
        break;
      case 'pull_request':
        await processPullRequestEvent(event as any);
        break;
      case 'release':
        await processReleaseEvent(event as any);
        break;
      case 'repository':
        await processRepositoryEvent(event as any);
        break;
      case 'create':
        await processCreateEvent(event as any);
        break;
      case 'delete':
        await processDeleteEvent(event as any);
        break;
      case 'fork':
        await processForkEvent(event as any);
        break;
      case 'star':
        await processStarEvent(event as any);
        break;
      case 'watch':
        await processWatchEvent(event as any);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Store webhook event
    await supabase
      .from('github_webhooks')
      .insert({
        repository,
        event_type: eventType,
        payload: event,
        processed: true,
      });

  } catch (error) {
    console.error(`Error processing ${eventType} event:`, error);
    
    // Store failed webhook event
    await supabase
      .from('github_webhooks')
      .insert({
        repository,
        event_type: eventType,
        payload: event,
        processed: false,
      });
  }
}

// Process push events (commits)
async function processPushEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const commits = event.commits || [];

  for (const commit of commits) {
    await supabase
      .from('github_commits')
      .upsert({
        sha: commit.id,
        repository,
        message: commit.message,
        author_name: commit.author.name,
        author_email: commit.author.email,
        author_login: commit.author.username,
        committer_name: commit.committer.name,
        committer_email: commit.committer.email,
        date: commit.timestamp,
        html_url: commit.url,
        additions: commit.additions || 0,
        deletions: commit.deletions || 0,
        total: (commit.additions || 0) + (commit.deletions || 0),
        data: commit,
        last_synced: new Date().toISOString(),
      });
  }

  // Update repository pushed_at timestamp
  await supabase
    .from('github_repositories')
    .update({
      pushed_at: new Date(event.head_commit.timestamp).toISOString(),
      last_synced: new Date().toISOString(),
    })
    .eq('full_name', repository);
}

// Process issues events
async function processIssuesEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const issue = event.issue;

  await supabase
    .from('github_issues')
    .upsert({
      id: issue.id,
      number: issue.number,
      repository,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels.map((label: any) => label.name),
      assignees: issue.assignees.map((assignee: any) => assignee.login),
      author: issue.user.login,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      html_url: issue.html_url,
      comments: issue.comments,
      data: issue,
      last_synced: new Date().toISOString(),
    });
}

// Process pull request events
async function processPullRequestEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const pullRequest = event.pull_request;

  await supabase
    .from('github_pull_requests')
    .upsert({
      id: pullRequest.id,
      number: pullRequest.number,
      repository,
      title: pullRequest.title,
      body: pullRequest.body,
      state: pullRequest.state === 'closed' && pullRequest.merged_at ? 'merged' : pullRequest.state,
      head_ref: pullRequest.head.ref,
      base_ref: pullRequest.base.ref,
      author: pullRequest.user.login,
      created_at: pullRequest.created_at,
      updated_at: pullRequest.updated_at,
      merged_at: pullRequest.merged_at,
      html_url: pullRequest.html_url,
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
      changed_files: pullRequest.changed_files,
      data: pullRequest,
      last_synced: new Date().toISOString(),
    });
}

// Process release events
async function processReleaseEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const release = event.release;

  await supabase
    .from('github_releases')
    .upsert({
      id: release.id,
      repository,
      tag_name: release.tag_name,
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
      published_at: release.published_at,
      author: release.author.login,
      html_url: release.html_url,
      download_count: release.assets.reduce((sum: number, asset: any) => sum + asset.download_count, 0),
      data: release,
      last_synced: new Date().toISOString(),
    });
}

// Process repository events
async function processRepositoryEvent(event: any): Promise<void> {
  const repository = event.repository;

  await supabase
    .from('github_repositories')
    .upsert({
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      description: repository.description,
      html_url: repository.html_url,
      clone_url: repository.clone_url,
      language: repository.language,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      open_issues: repository.open_issues_count,
      created_at: repository.created_at,
      updated_at: repository.updated_at,
      pushed_at: repository.pushed_at,
      owner_login: repository.owner.login,
      owner_id: repository.owner.id,
      data: repository,
      last_synced: new Date().toISOString(),
    });
}

// Process create events (branches, tags)
async function processCreateEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const refType = event.ref_type; // 'branch' or 'tag'
  const ref = event.ref;

  // Store as general data
  await supabase
    .from('github_data')
    .insert({
      data_type: 'create_event',
      data: {
        repository,
        ref_type: refType,
        ref,
        event,
      },
      repository_id: repository,
      tags: ['create', refType],
    });
}

// Process delete events (branches, tags)
async function processDeleteEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const refType = event.ref_type; // 'branch' or 'tag'
  const ref = event.ref;

  // Store as general data
  await supabase
    .from('github_data')
    .insert({
      data_type: 'delete_event',
      data: {
        repository,
        ref_type: refType,
        ref,
        event,
      },
      repository_id: repository,
      tags: ['delete', refType],
    });
}

// Process fork events
async function processForkEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const forkee = event.forkee;

  // Store fork information
  await supabase
    .from('github_data')
    .insert({
      data_type: 'fork',
      data: {
        repository,
        forkee,
        event,
      },
      repository_id: repository,
      tags: ['fork'],
    });

  // Update fork count for original repository
  await supabase
    .from('github_repositories')
    .update({
      forks: supabase.raw('forks + 1'),
      last_synced: new Date().toISOString(),
    })
    .eq('full_name', repository);
}

// Process star events
async function processStarEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const action = event.action; // 'created' or 'deleted'

  // Store star information
  await supabase
    .from('github_data')
    .insert({
      data_type: 'star',
      data: {
        repository,
        action,
        user: event.sender.login,
        event,
      },
      repository_id: repository,
      tags: ['star', action],
    });

  // Update star count
  const increment = action === 'created' ? 1 : -1;
  await supabase
    .from('github_repositories')
    .update({
      stars: supabase.raw(`stars + ${increment}`),
      last_synced: new Date().toISOString(),
    })
    .eq('full_name', repository);
}

// Process watch events
async function processWatchEvent(event: any): Promise<void> {
  const repository = event.repository.full_name;
  const action = event.action; // 'started' or 'stopped'

  // Store watch information
  await supabase
    .from('github_data')
    .insert({
      data_type: 'watch',
      data: {
        repository,
        action,
        user: event.sender.login,
        event,
      },
      repository_id: repository,
      tags: ['watch', action],
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'github-webhook-handler',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = req.body;

    // Verify webhook signature
    if (!verifySignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse webhook event
    const event = JSON.parse(payload);
    const eventType = req.headers['x-github-event'] as string;

    // Add event type to the event object
    event.type = eventType;

    // Process the event
    await processWebhookEvent(event);

    res.status(200).json({ 
      success: true, 
      message: `Processed ${eventType} event`,
      repository: event.repository?.full_name 
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 GitHub Webhook Handler running on port ${port}`);
  console.log(`📡 Webhook URL: http://localhost:${port}/webhook`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
});

export default app;
