import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface RequestBody {
  prompt: string
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
  system?: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    })
  }

  try {
    const body: RequestBody = await req.json()
    const { 
      prompt, 
      model = 'llama3.2:3b',
      temperature = 0.7,
      max_tokens = 1000,
      stream = false,
      system = 'You are a helpful AI assistant.'
    } = body

    // Get the AI_INFERENCE_API_HOST from environment
    const ollamaHost = Deno.env.get('AI_INFERENCE_API_HOST') || 'http://host.docker.internal:11434'
    
    // Combine system prompt with user prompt
    const fullPrompt = `${system}\n\nUser: ${prompt}\n\nAssistant:`

    if (stream) {
      // Handle streaming response
      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          temperature,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }

      const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      })

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          const reader = response.body?.getReader()
          
          if (!reader) {
            controller.error(new Error('No response body'))
            return
          }

          try {
            const decoder = new TextDecoder()
            
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              const chunk = decoder.decode(value)
              const lines = chunk.split('\n').filter(line => line.trim())
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line)
                  if (data.response) {
                    const eventData = JSON.stringify({
                      content: data.response,
                      done: data.done || false
                    })
                    controller.enqueue(encoder.encode(`data: ${eventData}\n\n`))
                  }
                  
                  if (data.done) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
                    controller.close()
                    return
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          } catch (error) {
            console.error('Streaming error:', error)
            controller.error(error)
          } finally {
            controller.close()
          }
        }
      })

      return new Response(stream, { headers })
    } else {
      // Handle non-streaming response
      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          temperature,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`)
      }

      const data = await response.json()

      return new Response(
        JSON.stringify({
          response: data.response || '',
          model,
          usage: {
            prompt_tokens: data.prompt_eval_count || 0,
            completion_tokens: data.eval_count || 0,
            total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
          }
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  } catch (error) {
    console.error('Error in ollama-assistant:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
        details: error.toString()
      }),
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