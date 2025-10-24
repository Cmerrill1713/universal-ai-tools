#!/bin/bash

# Deploy Supabase AI Functions
# This script deploys the AI-powered code analysis functions to Supabase

echo "🚀 Deploying Supabase AI Functions..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Login to Supabase (if not already logged in)
echo "📝 Checking Supabase login..."
supabase login

# Link to project (if not already linked)
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "🔗 Linking to Supabase project..."
    read -p "Enter your Supabase project ref: " PROJECT_REF
    supabase link --project-ref $PROJECT_REF
fi

# Deploy Edge Functions
echo "📦 Deploying Edge Functions..."

# Deploy embedding generator
echo "  → Deploying generate-embedding function..."
supabase functions deploy generate-embedding

# Deploy AI code analyzer
echo "  → Deploying ai-code-analyzer function..."
supabase functions deploy ai-code-analyzer

# Deploy TypeScript error fixer (from earlier)
if [ -d "supabase/functions/fix-typescript-error" ]; then
    echo "  → Deploying fix-typescript-error function..."
    supabase functions deploy fix-typescript-error
fi

# Set up secrets
echo "🔐 Setting up secrets..."
echo "Please enter your API keys (press Enter to skip):"

read -p "OpenAI API Key (or compatible): " OPENAI_KEY
if [ ! -z "$OPENAI_KEY" ]; then
    supabase secrets set OPENAI_API_KEY=$OPENAI_KEY
fi

read -p "OpenAI Base URL (default: https://api.openai.com/v1): " OPENAI_BASE
if [ ! -z "$OPENAI_BASE" ]; then
    supabase secrets set OPENAI_BASE_URL=$OPENAI_BASE
fi

read -p "Ollama URL (default: http://localhost:11434): " OLLAMA_URL
if [ ! -z "$OLLAMA_URL" ]; then
    supabase secrets set OLLAMA_URL=$OLLAMA_URL
fi

read -p "LLM Model (default: gpt-4-turbo-preview): " LLM_MODEL
if [ ! -z "$LLM_MODEL" ]; then
    supabase secrets set LLM_MODEL=$LLM_MODEL
fi

# Run migrations
echo "🗄️ Running database migrations..."
supabase db push

echo "✅ Deployment complete!"
echo ""
echo "📚 Next steps:"
echo "1. Test the embedding function:"
echo "   curl -X POST https://your-project.supabase.co/functions/v1/generate-embedding \\"
echo "     -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "     -d '{\"input\": \"Test text for embedding\"}'"
echo ""
echo "2. Test the AI code analyzer:"
echo "   curl -X POST https://your-project.supabase.co/functions/v1/ai-code-analyzer \\"
echo "     -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "     -d '{\"code\": \"const x = undefined.property\", \"error\": {\"code\": \"TS2532\", \"message\": \"Object is possibly undefined\"}}'"
echo ""
echo "3. Check function logs:"
echo "   supabase functions logs generate-embedding"
echo "   supabase functions logs ai-code-analyzer"