#!/bin/bash

echo "🚀 Starting Agent Zero with Local Supabase..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.supabase.yml down

# Remove existing volumes if you want a fresh start (uncomment if needed)
# echo "🗑️  Removing existing volumes..."
# docker-compose -f docker-compose.supabase.yml down -v

# Build and start the services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.supabase.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service status
echo "📊 Service Status:"
docker-compose -f docker-compose.supabase.yml ps

echo ""
echo "✅ Setup complete! Your services are available at:"
echo "   🌐 Agent Zero: http://localhost:3000"
echo "   🗄️  Supabase Dashboard: http://localhost:8000"
echo "   🔌 Supabase REST API: http://localhost:3001"
echo "   🔐 Supabase Auth: http://localhost:9999"
echo "   📡 Supabase Realtime: http://localhost:4000"
echo "   💾 Supabase Storage: http://localhost:5000"
echo "   ⚡ Supabase Edge Functions: http://localhost:9000"
echo "   🐘 PostgreSQL Database: localhost:54322"
echo "   🔴 Redis: localhost:6379"
echo ""
echo "📝 To view logs: docker-compose -f docker-compose.supabase.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.supabase.yml down"
echo ""
echo "🔑 Default Supabase credentials:"
echo "   - Database: postgres/postgres"
echo "   - Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
echo "   - Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
