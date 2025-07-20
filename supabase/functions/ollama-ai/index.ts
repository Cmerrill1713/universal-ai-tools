import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { prompt, action = 'generate' } = await req.json()
    
    // Call Ollama API
    const ollamaResponse = await fetch('http://host.docker.internal:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: action === 'generate' 
          ? `Generate PostgreSQL query for: ${prompt}. Return only SQL.`
          : `Explain this SQL: ${prompt}`,
        temperature: 0.1,
        stream: false
      })
    })

    const data = await ollamaResponse.json()
    
    return new Response(
      JSON.stringify({ 
        result: data.response,
        model: 'llama3.2:3b',
        action 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
