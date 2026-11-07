# GitLab Webhook Setup Guide

## Overview
This guide explains how to set up GitLab webhooks for real-time event processing in the Universal AI Tools project.

## 🔧 Configuration

### Environment Variables
Update your `.env` file with webhook settings:

```bash
# Enable webhooks
GITLAB_ENABLE_WEBHOOKS=true

# Webhook secret for security (recommended)
GITLAB_WEBHOOK_SECRET=your_secure_webhook_secret_here

# Other GitLab settings
GITLAB_URL=https://gitlab.com
GITLAB_ACCESS_TOKEN=glpat-your_token_here
GITLAB_PROJECT_ID=12345678
```

### Webhook URL
Your webhook endpoint will be available at:
```
https://your-domain.com/api/gitlab/webhook
```

For local development:
```
http://localhost:9999/api/gitlab/webhook
```

## 🚀 Setting Up GitLab Webhooks

### 1. Navigate to Project Settings
1. Go to your GitLab project
2. Click **Settings** → **Webhooks**
3. Click **Add new webhook**

### 2. Configure Webhook
Fill in the webhook configuration:

**URL**: `https://your-domain.com/api/gitlab/webhook`

**Secret Token**: Use the same value as `GITLAB_WEBHOOK_SECRET` in your `.env`

**Trigger Events**: Select the events you want to monitor:
- ✅ **Issues events** - Issue creation, updates, closures
- ✅ **Merge request events** - MR creation, updates, merges
- ✅ **Pipeline events** - CI/CD pipeline status changes
- ✅ **Push events** - Code pushes to branches
- ✅ **Tag push events** - Tag creation and updates
- ✅ **Note events** - Comments on issues and MRs
- ✅ **Wiki page events** - Wiki page updates
- ✅ **Build events** - Individual job status changes

**SSL verification**: ✅ Enable (recommended for production)

### 3. Test Webhook
After creating the webhook, GitLab will send a test event. Check your server logs to verify it's working.

## 📊 Supported Webhook Events

### Issue Events
- **Issue Hook**: Issue creation, updates, closures
- **Note Hook**: Comments on issues

**Event Data**:
```json
{
  "object_kind": "issue",
  "event_type": "issue",
  "user": { "name": "John Doe", "username": "johndoe" },
  "project": { "name": "Universal AI Tools" },
  "object_attributes": {
    "title": "Bug in authentication",
    "state": "opened",
    "action": "opened",
    "labels": ["bug", "critical"]
  }
}
```

### Merge Request Events
- **Merge Request Hook**: MR creation, updates, merges
- **Note Hook**: Comments on MRs

**Event Data**:
```json
{
  "object_kind": "merge_request",
  "event_type": "merge_request",
  "user": { "name": "Jane Smith", "username": "janesmith" },
  "project": { "name": "Universal AI Tools" },
  "object_attributes": {
    "title": "Add new feature",
    "state": "opened",
    "action": "opened",
    "source_branch": "feature/new-feature",
    "target_branch": "main"
  }
}
```

### Pipeline Events
- **Pipeline Hook**: CI/CD pipeline status changes

**Event Data**:
```json
{
  "object_kind": "pipeline",
  "event_type": "pipeline",
  "user": { "name": "CI/CD Bot", "username": "gitlab-ci" },
  "project": { "name": "Universal AI Tools" },
  "object_attributes": {
    "status": "success",
    "ref": "main",
    "duration": 1800
  }
}
```

### Push Events
- **Push Hook**: Code pushes to branches

**Event Data**:
```json
{
  "object_kind": "push",
  "event_type": "push",
  "user": { "name": "Developer", "username": "dev" },
  "project": { "name": "Universal AI Tools" },
  "ref": "refs/heads/main",
  "commits": [
    {
      "message": "Fix authentication bug",
      "author": { "name": "Developer" }
    }
  ]
}
```

## 🧪 Testing Webhooks

### 1. Test Webhook Configuration
```bash
curl http://localhost:9999/api/gitlab/webhook/config
```

### 2. Test Webhook Processing
```bash
# Test issue webhook
curl -X POST http://localhost:9999/api/gitlab/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"eventType": "issue"}'

# Test merge request webhook
curl -X POST http://localhost:9999/api/gitlab/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"eventType": "merge_request"}'

# Test pipeline webhook
curl -X POST http://localhost:9999/api/gitlab/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"eventType": "pipeline"}'
```

### 3. Test with Real GitLab Events
1. Create an issue in your GitLab project
2. Check server logs for webhook processing
3. Verify the event was handled correctly

## 🔒 Security Considerations

### Webhook Signature Validation
The webhook handler validates GitLab's signature to ensure events are authentic:

```typescript
// Signature validation is automatic when GITLAB_WEBHOOK_SECRET is set
const isValid = gitlabService.validateWebhookSignature(
  payload,
  signature,
  secret
);
```

### Rate Limiting
Consider implementing rate limiting for webhook endpoints to prevent abuse:

```typescript
// Example rate limiting middleware
const rateLimit = require('express-rate-limit');

const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP'
});

router.post('/webhook', webhookRateLimit, webhookHandler);
```

### HTTPS Only
Always use HTTPS in production to protect webhook data in transit.

## 📝 Event Processing

### Automatic Processing
The webhook handler automatically processes events and logs them:

```
🔔 Processing GitLab webhook: issue
📋 Issue opened: Bug in authentication (opened)
  🆕 New issue created by John Doe
  🚨 CRITICAL ISSUE DETECTED: Bug in authentication
✅ Successfully processed issue webhook event
```

### Custom Event Handlers
You can extend the webhook processing by adding custom handlers:

```typescript
// Add custom event processing
private async processCustomEvent(event: GitLabWebhookEvent): Promise<void> {
  // Your custom logic here
  console.log('Custom event processing:', event.object_kind);
}
```

## 🚨 Troubleshooting

### Common Issues

**1. Webhook not receiving events**
- Check if `GITLAB_ENABLE_WEBHOOKS=true` in `.env`
- Verify webhook URL is accessible from GitLab
- Check server logs for errors

**2. Invalid signature errors**
- Ensure `GITLAB_WEBHOOK_SECRET` matches GitLab configuration
- Check if webhook secret is properly configured in GitLab

**3. Events not being processed**
- Check server logs for processing errors
- Verify event types are supported
- Test with webhook test endpoint

### Debug Mode
Enable debug logging to see detailed webhook processing:

```bash
# Set debug environment variable
export DEBUG=gitlab:webhook

# Start server with debug logging
npm start
```

### Logs
Check server logs for webhook activity:

```bash
# View webhook logs
tail -f logs/gitlab-webhook.log

# Or check console output
npm start | grep "webhook"
```

## 📊 Monitoring

### Webhook Health Check
```bash
curl http://localhost:9999/api/gitlab/webhook/config
```

### Event Statistics
Monitor webhook event processing through the GitLab integration API:

```bash
# Get project statistics including webhook events
curl http://localhost:9999/api/gitlab/statistics
```

## 🔄 Maintenance

### Regular Tasks
- Monitor webhook processing logs
- Update webhook secrets periodically
- Check for failed webhook deliveries
- Review and optimize event processing

### Scaling
For high-volume projects, consider:
- Implementing webhook queuing
- Using message brokers (Redis, RabbitMQ)
- Horizontal scaling of webhook processors

## 📚 API Reference

### Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gitlab/webhook` | POST | Main webhook handler |
| `/api/gitlab/webhook/config` | GET | Webhook configuration |
| `/api/gitlab/webhook/test` | POST | Test webhook processing |

### Headers
- `X-Gitlab-Event`: Event type (e.g., "Issue Hook", "Merge Request Hook")
- `X-Gitlab-Token`: Webhook signature for validation
- `User-Agent`: GitLab webhook user agent

## ✅ Verification Checklist

- [ ] Webhooks enabled in `.env`
- [ ] Webhook secret configured
- [ ] GitLab webhook created with correct URL
- [ ] SSL verification enabled (production)
- [ ] Test webhook processing works
- [ ] Real events are being received
- [ ] Event processing logs are visible
- [ ] Security validation is working
- [ ] Error handling is robust

## 🎯 Next Steps

1. **Configure GitLab webhooks** using this guide
2. **Test webhook functionality** with test endpoints
3. **Monitor webhook processing** in production
4. **Set up alerts** for critical events
5. **Optimize performance** based on usage patterns

---

*Webhook setup complete! Your GitLab integration now supports real-time event processing.* 🚀