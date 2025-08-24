import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.5.0'

// Supabase's built-in embedding model
env.useBrowserCache = false
env.allowLocalModels = false

// Initialize the pipeline
const pipe = await pipeline(
  'feature-extraction',
  'Supabase/gte-small',
)

serve(async (req) => {
  try {
    const { input } = await req.json()
    
    if (!input) {
      return new Response(
        JSON.stringify({ error: 'Missing input text' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Generate embedding using Supabase's model
    const output = await pipe(input, {
      pooling: 'mean',
      normalize: true,
    })
    
    // Extract the embedding array
    const embedding = Array.from(output.data)
    
    return new Response(
      JSON.stringify({ 
        embedding,
        dimensions: embedding.length,
        model: 'gte-small'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Embedding generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})