# Universal AI Tools - Development Quick Start

Last Updated: August 18, 2025

## 🚀 30-Second Setup

```bash
# 1. Start Supabase
npx supabase start

# 2. Start the app
npm run dev

# 3. Access at http://localhost:9999
```

That's it! The app is now running with local Supabase.

## 📊 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Backend API** | http://localhost:9999 | Main application |
| **Supabase API** | http://127.0.0.1:54321 | REST API |
| **Supabase Studio** | http://127.0.0.1:54323 | Database UI |
| **PostgreSQL** | postgresql://postgres:postgres@127.0.0.1:54322/postgres | Direct DB access |

## 🔑 Default Credentials

### Supabase (Local Development)
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### Database
- **User**: postgres
- **Password**: postgres
- **Database**: postgres

## 🛠️ Common Commands

### Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Start with minimal services (faster)
npm run dev:minimal

# Start with performance monitoring
npm run dev:perf
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Database
```bash
# Check Supabase status
npx supabase status

# Reset database
npx supabase db reset

# Create new migration
npx supabase migration new my_migration

# Apply migrations
npx supabase db push
```

## 🔧 Troubleshooting

### Supabase won't start?
```bash
# Stop and clean restart
npx supabase stop
npx supabase start
```

### Port already in use?
```bash
# Find process on port 9999
lsof -i :9999

# Kill it
kill -9 <PID>

# Or use different port
PORT=3000 npm run dev
```

### TypeScript errors?
```bash
# Fix linting issues
npm run lint:fix

# Check types
npm run type-check
```

### Migration errors?
```bash
# Move problematic migration
mv supabase/migrations/problem.sql supabase/migrations/problem.sql.backup

# Restart Supabase
npx supabase stop && npx supabase start
```

## 📁 Project Structure

```
universal-ai-tools/
├── src/               # Backend source code
│   ├── services/      # Core services
│   ├── routers/       # API endpoints
│   ├── agents/        # AI agents
│   └── middleware/    # Express middleware
├── macOS-App/         # SwiftUI frontend
├── supabase/          # Database
│   └── migrations/    # SQL migrations
├── scripts/           # Utility scripts
└── tests/             # Test suites
```

## 🔍 Health Checks

### Backend Health
```bash
curl http://localhost:9999/health
```

### Supabase Health
```bash
curl http://127.0.0.1:54321/rest/v1/
```

### Database Connection
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1"
```

## 💡 Development Tips

1. **Use Supabase Studio** for database management: http://127.0.0.1:54323
2. **Monitor logs** in real-time: `npm run dev` shows all server logs
3. **Hot reload** is enabled - changes auto-refresh
4. **TypeScript strict mode** is on - fix types as you go
5. **Use MCP tools** - XcodeBuildMCP is available for automation

## 🆘 Need Help?

1. Check [BUILD_SETUP.md](./BUILD_SETUP.md) for detailed configuration
2. Review [SUPABASE_MIGRATION_STATUS.md](./SUPABASE_MIGRATION_STATUS.md) for database issues
3. See [CLAUDE.md](./CLAUDE.md) for AI assistant guidance
4. Check GitHub Issues for known problems
5. Create new issue with error details

## 🎯 Next Steps

1. **Explore the API**: http://localhost:9999/api-docs
2. **Try the endpoints**: Use Postman or curl
3. **Check the database**: http://127.0.0.1:54323
4. **Run tests**: `npm test`
5. **Build for production**: `npm run build`