// Supabase Edge Function for Ollama Embeddings
// Deploy with: supabase functions deploy ollama-embeddings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmbeddingRequest {
  text: string
  model?: string
  userId?: string
}

interface OllamaEmbeddingResponse {
  embedding: number[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Parse request
    const { text, model = 'all-minilm:latest', userId }: EmbeddingRequest = await req.json()

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Build Ollama request
    const ollamaPayload = {
      model,
      prompt: text
    }

    // Call Ollama API
    const startTime = performance.now()
    const ollamaResponse = await fetch('http://host.docker.internal:11434/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaPayload),
    })

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status}`)
    }

    const result: OllamaEmbeddingResponse = await ollamaResponse.json()
    const endTime = performance.now()
    const latencyMs = Math.round(endTime - startTime)

    // Log the request to Supabase
    const logData = {
      user_id: userId,
      model_name: model,
      request_type: 'embedding',
      input_text: text,
      embedding: JSON.stringify(result.embedding), // Store as JSON string
      latency_ms: latencyMs,
      success: true,
    }

    // Insert request log (fire and forget)
    supabaseClient.from('ollama_requests').insert(logData).then(() => {
      console.log('Embedding request logged successfully')
    }).catch((error) => {
      console.error('Failed to log embedding request:', error)
    })

    // Return response
    return new Response(
      JSON.stringify({
        embedding: result.embedding,
        model,
        dimension: result.embedding.length,
        latencyMs,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Embedding edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})