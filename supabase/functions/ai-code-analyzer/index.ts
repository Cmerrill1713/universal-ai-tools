import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { code, error, context, useOllama = true } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: Generate embedding for the code error
    const embeddingResponse = await fetch(`${supabaseUrl}/functions/v1/generate-embedding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        input: `TypeScript ${error?.code || ''} ${error?.message || ''} ${code}`.slice(0, 512) 
      })
    })

    const { embedding } = await embeddingResponse.json()

    // Step 2: Find similar code patterns using vector search
    const { data: similarPatterns } = await supabase.rpc('find_similar_code_fixes', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5
    })

    // Step 3: Generate fix using LLM (Ollama or OpenAI-compatible)
    let fixResponse
    
    if (useOllama && Deno.env.get('OLLAMA_URL')) {
      // Use local Ollama
      const ollamaUrl = Deno.env.get('OLLAMA_URL') || 'http://localhost:11434'
      
      fixResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'codellama:7b',
          prompt: buildPrompt(error, code, context, similarPatterns),
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
          }
        })
      })
      
      const ollamaData = await fixResponse.json()
      fixResponse = {
        fixedCode: extractCode(ollamaData.response),
        explanation: extractExplanation(ollamaData.response),
        confidence: calculateConfidence(similarPatterns),
        model: 'codellama:7b'
      }
    } else {
      // Use OpenAI-compatible API (xAI, OpenAI, etc.)
      const apiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('XAI_API_KEY')
      const baseUrl = Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1'
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('LLM_MODEL') || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a TypeScript expert. Provide fixes in JSON format with keys: fixedCode, explanation, confidence (0-1), imports (array).'
            },
            {
              role: 'user',
              content: buildPrompt(error, code, context, similarPatterns)
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      })
      
      const data = await response.json()
      fixResponse = JSON.parse(data.choices[0].message.content)
    }

    // Step 4: Store the analysis and fix
    const { data: storedFix, error: dbError } = await supabase
      .from('code_analysis')
      .insert({
        file_path: context?.filePath,
        error_code: error?.code,
        error_message: error?.message,
        code_snippet: code,
        code_embedding: embedding,
        suggested_fix: fixResponse.fixedCode,
        explanation: fixResponse.explanation,
        confidence: fixResponse.confidence || calculateConfidence(similarPatterns),
        llm_model: fixResponse.model || 'unknown',
        similar_patterns: similarPatterns,
        metadata: {
          context,
          imports: fixResponse.imports || []
        }
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
    }

    // Step 5: Update pattern success if this is a known pattern
    if (similarPatterns && similarPatterns.length > 0) {
      const mostSimilar = similarPatterns[0]
      if (mostSimilar.similarity > 0.9) {
        await supabase.rpc('update_fix_success_rate', {
          pattern_id: mostSimilar.id,
          was_successful: true
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fix: {
          code: fixResponse.fixedCode,
          explanation: fixResponse.explanation,
          confidence: fixResponse.confidence,
          imports: fixResponse.imports || []
        },
        embedding: {
          dimensions: embedding.length,
          model: 'gte-small'
        },
        similarPatterns: similarPatterns?.slice(0, 3),
        stored: storedFix
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in ai-code-analyzer:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

function buildPrompt(error: any, code: string, context: any, similarPatterns: any[]) {
  let prompt = `Fix this TypeScript error:

Error: ${error?.code || 'Unknown'} - ${error?.message || 'No message'}
File: ${context?.filePath || 'Unknown file'}
Line: ${error?.line || 'Unknown line'}

Code with error:
\`\`\`typescript
${code}
\`\`\`
`

  if (context?.fileContent) {
    prompt += `\nFile context:\n\`\`\`typescript\n${context.fileContent}\n\`\`\`\n`
  }

  if (similarPatterns && similarPatterns.length > 0) {
    prompt += '\nSimilar errors that were fixed successfully:\n'
    similarPatterns.forEach((pattern, i) => {
      prompt += `${i + 1}. ${pattern.error_pattern} → ${pattern.fix_pattern} (${Math.round(pattern.success_rate * 100)}% success rate)\n`
    })
  }

  prompt += `
Please provide:
1. The corrected code
2. A brief explanation of the fix
3. Any additional imports needed
4. Your confidence level (0-1) in this fix`

  return prompt
}

function extractCode(response: string): string {
  // Extract code block from response
  const codeMatch = response.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/)
  if (codeMatch) {
    return codeMatch[1].trim()
  }
  
  // Try to find inline code
  const inlineMatch = response.match(/`([^`]+)`/)
  if (inlineMatch) {
    return inlineMatch[1]
  }
  
  // Return first line that looks like code
  const lines = response.split('\n')
  for (const line of lines) {
    if (line.includes('=') || line.includes('{') || line.includes('(')) {
      return line.trim()
    }
  }
  
  return response.trim()
}

function extractExplanation(response: string): string {
  // Remove code blocks
  const withoutCode = response.replace(/```[\s\S]*?```/g, '').trim()
  
  // Find explanation patterns
  const explanationMatch = withoutCode.match(/(?:explanation|fix|because|this works|the issue)[:.]?\s*(.+)/i)
  if (explanationMatch) {
    return explanationMatch[1].trim()
  }
  
  return withoutCode.split('\n')[0] || 'AI-generated fix'
}

function calculateConfidence(similarPatterns: any[]): number {
  if (!similarPatterns || similarPatterns.length === 0) {
    return 0.5
  }
  
  // Base confidence on similarity and success rate of similar patterns
  const topPattern = similarPatterns[0]
  const similarityScore = topPattern.similarity || 0
  const successRate = topPattern.success_rate || 0
  
  // Weighted average
  return (similarityScore * 0.7 + successRate * 0.3)
}