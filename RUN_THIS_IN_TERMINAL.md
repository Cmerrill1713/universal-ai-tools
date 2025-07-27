# Universal AI Tools - Terminal Setup Guide

## Step 1: Kill Any Existing Processes

Open a terminal and run:

```bash
pkill -f "tsx.*server"
pkill -f "vite"
pkill -f "python.*dspy"
```

## Step 2: Start Redis (if not running)

```bash
# Check if Redis is running
redis-cli ping

# If it returns an error, start Redis:
brew services start redis
# OR
redis-server --daemonize yes
```

## Step 3: Start Backend Server

Open a new terminal window/tab and run:

```bash
cd /Users/christianmerrill/Desktop/universal-ai-tools

# Create .env file if it doesn't exist
echo 'SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key-here
JWT_SECRET=your-jwt-secret-here
OPENAI_API_KEY=your-openai-key-here
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=9999' > .env

# Start the minimal backend server
npm run start:minimal
```

You should see:

```
🚀 Starting Universal AI Tools (Enhanced) on port 9999...
✅ Universal AI Tools (Enhanced) running on port 9999
```

## Step 4: Start Frontend

Open another new terminal window/tab and run:

```bash
cd /Users/christianmerrill/Desktop/universal-ai-tools/ui

# Create .env file for React
echo 'REACT_APP_API_URL=http://localhost:9999
REACT_APP_API_KEY=test-api-key-123
REACT_APP_AI_SERVICE=universal-ai-tools
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here' > .env

# Start the frontend
npm run dev
```

You should see:

```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## Step 5: Verify Everything is Working

Open a third terminal and run:

```bash
# Check backend
curl -H "X-API-Key: test-api-key-123" http://localhost:9999/api/v1/status

# Check frontend
curl -I http://localhost:5173
```

## Step 6: Access the Application

Open your browser and go to:

- **Frontend**: http://localhost:5173
- **AI Chat**: http://localhost:5173/ai-chat
- **Agents**: http://localhost:5173/agents

## Troubleshooting

### If the backend fails to start:

1. Check if port 9999 is already in use:
   ```bash
   lsof -i :9999
   ```
2. If yes, kill the process:
   ```bash
   kill -9 <PID>
   ```

### If the frontend fails to start:

1. Check if port 5173 is already in use:
   ```bash
   lsof -i :5173
   ```
2. Clear node modules and reinstall:
   ```bash
   cd /Users/christianmerrill/Desktop/universal-ai-tools/ui
   rm -rf node_modules
   npm install
   ```

### If you see CORS errors:

Make sure the backend is running on port 9999 before starting the frontend.

## Quick All-in-One Start Script

Save this as `start-all.sh` and run it:

```bash
#!/bin/bash
# Kill existing processes
pkill -f "tsx.*server"
pkill -f "vite"

# Start backend
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run start:minimal &

# Wait for backend to start
sleep 5

# Start frontend
cd /Users/christianmerrill/Desktop/universal-ai-tools/ui
npm run dev &

echo "Services starting..."
echo "Backend: http://localhost:9999"
echo "Frontend: http://localhost:5173"
```

Make it executable: `chmod +x start-all.sh`
Run it: `./start-all.sh`
