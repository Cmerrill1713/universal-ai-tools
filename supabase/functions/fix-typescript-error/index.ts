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
    const { error, context, memories } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Prepare context for LLM
    const contextInfo = memories?.map((m: any) => {
      try {
        const content = JSON.parse(m.content)
        return `Previous fix for similar error: ${content.fix_pattern || content.content}`
      } catch {
        return ''
      }
    }).filter(Boolean).join('\n')

    // Call OpenAI API (or Anthropic/Ollama)
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    
    const prompt = `You are a TypeScript expert. Fix this code error.

Error Code: ${error.code}
Error Message: ${error.message}
File: ${error.file}
Line: ${error.line}

Code with error:
\`\`\`typescript
${error.codeSnippet || context?.codeSnippet || 'No code snippet provided'}
\`\`\`

${context?.fileContent ? `File context:\n\`\`\`typescript\n${context.fileContent}\n\`\`\`\n` : ''}

${contextInfo ? `\nSimilar fixes that worked before:\n${contextInfo}\n` : ''}

Please provide:
1. The fixed code (just the corrected lines)
2. A brief explanation of what was wrong and how you fixed it
3. Your confidence level (0.0 to 1.0) that this fix will work

Format your response as JSON:
{
  "fixedCode": "the corrected code",
  "explanation": "what was wrong and how it was fixed",
  "confidence": 0.95,
  "additionalImports": ["any new imports needed"]
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a TypeScript expert. Always respond with valid JSON containing fixedCode, explanation, confidence, and additionalImports fields.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const aiResponse = await response.json()
    const fixData = JSON.parse(aiResponse.choices[0].message.content)

    // Store the fix attempt in database
    const { error: dbError } = await supabase
      .from('code_fix_attempts')
      .insert({
        error_code: error.code,
        error_message: error.message,
        original_code: error.codeSnippet,
        fixed_code: fixData.fixedCode,
        explanation: fixData.explanation,
        confidence: fixData.confidence,
        file_path: error.file,
        line_number: error.line,
        status: 'proposed'
      })

    if (dbError) {
      console.error('Database error:', dbError)
    }

    // Return the fix
    return new Response(
      JSON.stringify({
        success: true,
        ...fixData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in fix-typescript-error function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        fixedCode: null,
        explanation: 'Failed to generate fix',
        confidence: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})