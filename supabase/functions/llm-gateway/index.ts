import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LLMRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const request = await req.json() as LLMRequest
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
      throw new Error('Authorization required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Get LLM model configuration
    const { data: modelConfig } = await supabase
      .from('llm_users.models')
      .select('*')
      .eq('model_name', request.model)
      .single()

    if (!modelConfig) {
      throw new Error(`Model ${request.model} not found`)
    }

    // Check rate limits
    const currentTime = new Date()
    const minuteAgo = new Date(currentTime.getTime() - 60000)
    
    const { count: recentRequests } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('llm_model_id', modelConfig.id)
      .gte('timestamp', minuteAgo.toISOString())

    if (recentRequests && recentRequests >= modelConfig.rate_limits.requests_per_minute) {
      throw new Error('Rate limit exceeded')
    }

    // Get API key from vault
    const { data: apiKeyData } = await supabase
      .from('vault.llm_secrets')
      .select('secret')
      .eq('id', modelConfig.api_key_id)
      .single()

    if (!apiKeyData) {
      throw new Error('API key not configured')
    }

    // Route to appropriate provider
    let response: Response
    
    switch (modelConfig.provider) {
      case 'openai':
        response = await callOpenAI(request, apiKeyData.secret)
        break
      
      case 'anthropic':
        response = await callAnthropic(request, apiKeyData.secret)
        break
      
      case 'local':
        response = await callLocalModel(request, modelConfig)
        break
      
      default:
        throw new Error(`Provider ${modelConfig.provider} not supported`)
    }

    // Log usage
    const usage = await response.clone().json()
    await supabase.from('analytics_events').insert({
      event_type: 'llm_request',
      user_id: user.id,
      llm_model_id: modelConfig.id,
      metadata: {
        model: request.model,
        messages_count: request.messages.length,
        tokens_used: usage.usage?.total_tokens || 0,
        stream: request.stream || false
      }
    })

    // Update model usage stats
    const newStats = {
      total_requests: (modelConfig.usage_stats.total_requests || 0) + 1,
      total_tokens: (modelConfig.usage_stats.total_tokens || 0) + (usage.usage?.total_tokens || 0)
    }
    
    await supabase
      .from('llm_users.models')
      .update({ usage_stats: newStats })
      .eq('id', modelConfig.id)

    // Return response with CORS headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    })

  } catch (error) {
    console.error('LLM Gateway error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function callOpenAI(request: LLMRequest, apiKey: string): Promise<Response> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
      stream: request.stream || false
    })
  })
  
  return response
}

async function callAnthropic(request: LLMRequest, apiKey: string): Promise<Response> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens || 1000,
      temperature: request.temperature || 0.7
    })
  })
  
  return response
}

async function callLocalModel(request: LLMRequest, modelConfig: any): Promise<Response> {
  // Get local model endpoint from metadata
  const endpoint = modelConfig.metadata?.endpoint || 'http://localhost:11434/api/chat'
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      options: {
        temperature: request.temperature || 0.7,
        num_predict: request.max_tokens || 1000
      },
      stream: request.stream || false
    })
  })
  
  return response
}