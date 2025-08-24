import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, action = 'generate' } = await req.json()

    // Build the Ollama prompt based on action
    let ollamaPrompt = ''
    switch (action) {
      case 'generate':
        ollamaPrompt = `You are a PostgreSQL expert. Generate only SQL code for this request, no explanations or markdown: ${prompt}`
        break
      case 'explain':
        ollamaPrompt = `Explain this PostgreSQL query in simple terms: ${prompt}`
        break
      case 'optimize':
        ollamaPrompt = `Optimize this PostgreSQL query for better performance. Return only the optimized SQL: ${prompt}`
        break
      default:
        throw new Error('Invalid action')
    }

    // Call Ollama via nginx proxy
    const response = await fetch('http://host.docker.internal:8080/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: ollamaPrompt,
        stream: false,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`)
    }

    const data = await response.json()
    let result = data.response || ''
    
    // Clean up markdown if present
    result = result.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim()

    return new Response(
      JSON.stringify({ success: true, result, action }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})