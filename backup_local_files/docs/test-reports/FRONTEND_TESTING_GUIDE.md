# Frontend Testing Guide - Chat and Agents
## Overview

This guide helps you test the chat and agent functionality after the fixes have been applied.
## What Was Fixed
1. **Authentication**

   - Added missing `getAuthHeaders` function in `ui/src/lib/api.ts`

   - Function now properly handles JWT tokens and API keys
2. **Backend Routes**

   - Fixed missing authentication on GET `/api/agents`

   - Fixed database table name mismatch (ai_agents → agents)

   - Verified SweetAthena routes are properly registered
3. **API Integration**

   - Updated Agents page to use proper API client

   - Removed hardcoded Supabase keys (now uses env vars)

   - Fixed API calls to use consistent authentication
## Prerequisites
1. Backend server running on port 9999

2. Supabase running locally (or configured)

3. API keys configured in environment
## Setup Instructions
### 1. Backend Setup
```bash
# Start the backend server

npm run dev

# Or start minimal server

npm run start:minimal

```
### 2. Frontend Setup
```bash
# Navigate to UI directory

cd ui

# Install dependencies

npm install

# Create .env.local file

cp .env.example .env.local

# Edit .env.local and add:

VITE_API_KEY=your-api-key-here

VITE_API_URL=http://localhost:9999/api

VITE_AI_SERVICE=local-ui

# Start the frontend

npm run dev

```
### 3. Generate API Key (if needed)
If you don't have an API key, you can:
1. Use the default test key (check backend logs)

2. Create one in Supabase:

   ```sql

   INSERT INTO ai_service_keys (service_id, encrypted_key, name)

   VALUES ('test-service', 'your-api-key-here', 'Frontend Test Key');

   ```
## Testing Chat Functionality
### 1. Test SweetAthena Chat

- Navigate to: http://localhost:5173/sweet-athena

- Try sending messages

- Test different personality modes

- Check console for API calls
### 2. Test Regular AI Chat

- Navigate to: http://localhost:5173/chat

- Send test messages

- Verify responses from Ollama
## Testing Agent Functionality
### 1. View Agents List

- Navigate to: http://localhost:5173/agents

- Should see list of agents (or empty list if none exist)

- Check console for authentication errors
### 2. Create New Agent

- Click "Create Agent" button

- Fill in:

  - Name: Test Agent

  - Description: A test agent

  - Type: cognitive

  - Capabilities: planning, analysis

- Submit and verify creation
### 3. Execute Agent

- Click the lightning bolt icon on an agent

- Enter a test task: "What is 2+2?"

- Submit and check response
## Common Issues and Solutions
### 1. Authentication Errors (401)

**Problem**: "Missing authentication headers" or "Invalid API key"

**Solution**: 

- Ensure API key is set in `.env.local`

- Check backend logs for the correct API key

- Verify headers are being sent (check Network tab)
### 2. Database Errors

**Problem**: "relation 'agents' does not exist"

**Solution**: 

- Run migrations: `npm run db:migrate`

- Or create tables manually (see migration files)
### 3. CORS Errors

**Problem**: "Access to fetch at ... has been blocked by CORS"

**Solution**: 

- Ensure backend is running on port 9999

- Check CORS configuration in server.ts

- Use correct API URL in frontend
### 4. WebSocket Connection Failed

**Problem**: "WebSocket connection to 'ws://localhost:9999' failed"

**Solution**: 

- This is expected - agent coordination WebSocket not implemented yet

- Doesn't affect basic functionality
## Validation Checklist
- [ ] Backend server starts without errors

- [ ] Frontend builds without errors

- [ ] Can access frontend at http://localhost:5173

- [ ] Health check endpoint responds: http://localhost:9999/api/health

- [ ] SweetAthena chat sends and receives messages

- [ ] Agent list loads (even if empty)

- [ ] Can create new agents

- [ ] Can execute agents

- [ ] No authentication errors in console

- [ ] API calls show in Network tab with proper headers
## Test Script
A test script is available: `test-frontend-integration.cjs`
```bash
# Run with your API key

API_KEY=your-api-key-here node test-frontend-integration.cjs

```
## Next Steps
Once basic functionality is working:
1. Test WebSocket real-time updates

2. Implement error boundaries

3. Add loading states and better error messages

4. Remove mock data fallbacks

5. Implement agent control endpoints (start/stop/pause)
## Summary
The frontend is now properly integrated with the backend. Main improvements:

- Proper authentication flow

- Consistent API usage

- Fixed database references

- Removed hardcoded credentials
The chat and agent systems should now work with the real backend when properly configured.