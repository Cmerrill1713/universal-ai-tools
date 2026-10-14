# GitLab Integration Setup Guide

## Overview

The Universal AI Tools project includes comprehensive GitLab integration for:
- Issue tracking and project management
- Merge request monitoring
- Pipeline status tracking
- Code quality analysis
- Security vulnerability scanning
- Webhook handling

## Current Status

✅ **Fully Implemented:**
- GitLab CI/CD pipeline configuration
- Complete TypeScript service implementation
- RESTful API endpoints
- Mock data for development
- Error handling and fallbacks

⚠️ **Needs Configuration:**
- GitLab credentials and project setup
- Real GitLab instance connection
- Webhook configuration

## Quick Setup

### 1. Environment Configuration

Create or update your `.env` file in the `nodejs-api-server` directory:

```bash
# GitLab Configuration
GITLAB_URL=https://gitlab.com                    # Your GitLab instance URL
GITLAB_ACCESS_TOKEN=glpat-your_token_here        # Your GitLab access token
GITLAB_PROJECT_ID=12345678                       # Your GitLab project ID
GITLAB_ENABLE_WEBHOOKS=true                      # Enable webhook support
GITLAB_WEBHOOK_SECRET=your_webhook_secret_here   # Webhook secret for security
```

### 2. GitLab Access Token Setup

1. Go to your GitLab profile → Access Tokens
2. Create a new token with these scopes:
   - `read_api` - Read GitLab API
   - `read_repository` - Read repository data
   - `read_user` - Read user information
   - `api` - Full API access (if needed)

### 3. Project ID Configuration

Find your project ID:
1. Go to your GitLab project
2. Look at the project URL: `https://gitlab.com/group/project` 
3. Or check the project settings → General → Project ID

### 4. Webhook Configuration (Optional)

To enable real-time updates:

1. Go to your GitLab project → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/gitlab/webhook`
3. Select events: Issues, Merge Requests, Pipeline
4. Set the secret token (same as `GITLAB_WEBHOOK_SECRET`)

## API Endpoints

Once configured, the following endpoints are available:

### Status & Health
- `GET /api/gitlab/status` - Check GitLab integration status
- `GET /api/gitlab/project` - Get project information

### Issues & Merge Requests
- `GET /api/gitlab/issues` - List project issues
- `GET /api/gitlab/merge-requests` - List merge requests
- `GET /api/gitlab/pipelines` - List pipeline runs

### Analysis & Reports
- `GET /api/gitlab/code-quality` - Get code quality report
- `GET /api/gitlab/security` - Get security vulnerability report
- `GET /api/gitlab/context` - Get comprehensive project context
- `GET /api/gitlab/analysis` - Get project analysis and recommendations

### Webhooks
- `POST /api/gitlab/webhook` - Handle GitLab webhook events

## Development Mode

The integration works in development mode with mock data when:
- No valid GitLab credentials are provided
- GitLab API is unreachable
- Using test tokens

Mock data includes:
- Sample issues with different priorities and categories
- Mock merge requests with various states
- Pipeline runs with different statuses
- Code quality and security reports

## Testing the Integration

### 1. Start the Server

```bash
cd nodejs-api-server
npm run build
npm start
```

### 2. Test Endpoints

```bash
# Check status
curl http://localhost:9999/api/gitlab/status

# Get project info
curl http://localhost:9999/api/gitlab/project

# List issues
curl http://localhost:9999/api/gitlab/issues

# Get analysis
curl http://localhost:9999/api/gitlab/analysis
```

### 3. Test with Real GitLab

Once you have valid credentials:

```bash
# Set environment variables
export GITLAB_URL="https://gitlab.com"
export GITLAB_ACCESS_TOKEN="glpat-your_real_token"
export GITLAB_PROJECT_ID="your_real_project_id"

# Test connection
curl http://localhost:9999/api/gitlab/status
```

## GitLab CI/CD Integration

The project includes a comprehensive `.gitlab-ci.yml` that:

1. **Builds** both Node.js and Rust services
2. **Tests** all components with coverage reporting
3. **Scans** for security vulnerabilities
4. **Analyzes** code quality
5. **Deploys** to staging and production environments

### Pipeline Stages

- `build` - Compile and build all services
- `test` - Run unit and integration tests
- `security` - Security scanning and dependency analysis
- `deploy-staging` - Deploy to staging environment
- `deploy-production` - Deploy to production
- `post-deploy` - Post-deployment testing and cleanup

## Troubleshooting

### Common Issues

1. **"GitLab API error: 401 Unauthorized"**
   - Check your access token
   - Verify token has correct scopes
   - Ensure token hasn't expired

2. **"GitLab API error: 404 Not Found"**
   - Verify project ID is correct
   - Check if project exists and is accessible
   - Ensure you have access to the project

3. **"Connection failed, using mock data"**
   - This is normal in development mode
   - Check network connectivity
   - Verify GitLab URL is correct

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
DEBUG=gitlab:*
```

## Security Considerations

1. **Access Tokens**: Store securely, never commit to repository
2. **Webhook Secrets**: Use strong, random secrets
3. **HTTPS**: Always use HTTPS for webhook URLs
4. **Permissions**: Use minimal required permissions for tokens

## Production Deployment

For production deployment:

1. Set up proper environment variables
2. Configure webhook endpoints
3. Set up monitoring and alerting
4. Enable security scanning
5. Configure backup and recovery

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify configuration settings
3. Test with mock data first
4. Check GitLab API documentation

## Next Steps

1. Configure your GitLab credentials
2. Test the integration endpoints
3. Set up webhooks for real-time updates
4. Configure CI/CD pipeline
5. Monitor and maintain the integration