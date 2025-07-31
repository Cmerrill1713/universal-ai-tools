// Supabase Edge Function for Ollama Chat Integration
// Deploy with: supabase functions deploy ollama-chat

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  model: string
  message: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  userId?: string
  conversationId?: string
  workingDirectory?: string
  currentProject?: string
  enableContextInjection?: boolean
}

interface OllamaResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
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
    const { 
      model, 
      message, 
      systemPrompt, 
      temperature = 0.7, 
      maxTokens = 2048, 
      userId, 
      conversationId,
      workingDirectory,
      currentProject,
      enableContextInjection = true
    }: ChatRequest = await req.json()

    if (!model || !message) {
      return new Response(
        JSON.stringify({ error: 'Model and message are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Context injection if enabled
    let enrichedMessage = message
    let contextSummary = 'No context injection'
    
    if (enableContextInjection && userId) {
      try {
        // Get relevant context from knowledge base
        const embeddingResponse = await fetch('http://host.docker.internal:54321/functions/v1/ollama-embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            text: message,
            model: 'all-minilm:latest',
            userId: userId,
          }),
        })

        if (embeddingResponse.ok) {
          const { embedding } = await embeddingResponse.json()
          
          // Search for relevant context
          const { data: contextResults, error: contextError } = await supabaseClient.rpc('hybrid_search', {
            query_text: message,
            query_embedding: embedding,
            search_tables: ['knowledge_sources', 'documents', 'conversation_messages'],
            match_limit: 5,
            semantic_weight: 0.7,
          })

          if (!contextError && contextResults && contextResults.length > 0) {
            let contextInfo = '\n\n## RELEVANT PROJECT CONTEXT:\n'
            contextResults.forEach((result: any, index: number) => {
              contextInfo += `${index + 1}. ${result.source || 'Unknown source'} (relevance: ${(result.similarity_score || 0).toFixed(2)}):\n${result.content || result.text || ''}\n\n`
            })
            
            if (workingDirectory) {
              contextInfo += `## WORKING DIRECTORY: ${workingDirectory}\n`
            }
            
            if (currentProject) {
              contextInfo += `## CURRENT PROJECT: ${currentProject}\n`
            }
            
            contextInfo += `## INSTRUCTIONS:\nYou MUST use the above context to inform your response. Reference specific information from the context when relevant.\n\n## USER REQUEST:\n`
            
            enrichedMessage = contextInfo + message
            contextSummary = `Used ${contextResults.length} context sources`
          }
        }
      } catch (error) {
        console.warn('Context injection failed:', error)
        contextSummary = 'Context injection failed'
      }
    }

    // Build Ollama request
    const messages = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt + '\n\nIMPORTANT: You MUST review and use any project context provided in user messages before responding.' })
    } else if (enableContextInjection) {
      messages.push({ role: 'system', content: 'You are a helpful AI assistant. IMPORTANT: You MUST review and use any project context provided in user messages before responding.' })
    }
    messages.push({ role: 'user', content: enrichedMessage })

    const ollamaPayload = {
      model,
      messages,
      options: {
        temperature,
        num_predict: maxTokens
      },
      stream: false
    }

    // Call Ollama API
    const startTime = performance.now()
    const ollamaResponse = await fetch('http://host.docker.internal:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaPayload),
    })

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status}`)
    }

    const result: OllamaResponse = await ollamaResponse.json()
    const endTime = performance.now()
    const latencyMs = Math.round(endTime - startTime)

    // Log the request to Supabase
    const logData = {
      user_id: userId,
      model_name: model,
      request_type: 'chat',
      input_text: message,
      system_prompt: systemPrompt,
      output_text: result.message.content,
      latency_ms: latencyMs,
      temperature,
      max_tokens: maxTokens,
      success: true,
    }

    // Insert request log (fire and forget)
    supabaseClient.from('ollama_requests').insert(logData).then(() => {
      console.log('Request logged successfully')
    }).catch((error) => {
      console.error('Failed to log request:', error)
    })

    // Store conversation if conversationId provided
    if (conversationId && userId) {
      // Store user message
      await supabaseClient.from('conversation_messages').insert({
        thread_id: conversationId,
        role: 'user',
        content: message,
      })

      // Store assistant response
      await supabaseClient.from('conversation_messages').insert({
        thread_id: conversationId,
        role: 'assistant',
        content: result.message.content,
        model_used: model,
        tokens_used: result.message.content.length, // Approximate
      })
    }

    // Return response
    return new Response(
      JSON.stringify({
        response: result.message.content,
        model: result.model,
        latencyMs,
        contextSummary,
        success: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    
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