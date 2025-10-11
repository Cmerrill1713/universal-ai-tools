import { ollamaSupabase } from '../src/services/ollama-supabase-bridge'

async function main() {
  console.log('Testing Ollama via Supabase Edge Functions\n')

  // 1. Health check
  console.log('1. Running health check...')
  const isHealthy = await ollamaSupabase.healthCheck()
  console.log(`Health check: ${isHealthy ? 'PASSED' : 'FAILED'}\n`)

  // 2. Simple generation
  console.log('2. Testing simple generation...')
  try {
    const response = await ollamaSupabase.generate({
      prompt: 'Explain what Supabase is in one sentence.',
      temperature: 0.5,
      max_tokens: 100
    })
    console.log('Response:', response.response)
    console.log('Model:', response.model)
    console.log('Tokens:', response.usage)
  } catch (error) {
    console.error('Generation error:', error)
  }

  // 3. Streaming generation
  console.log('\n3. Testing streaming generation...')
  try {
    console.log('Streaming response:')
    for await (const chunk of ollamaSupabase.generateStream({
      prompt: 'Write a haiku about databases.',
      temperature: 0.8
    })) {
      process.stdout.write(chunk)
    }
    console.log('\n')
  } catch (error) {
    console.error('Streaming error:', error)
  }

  // 4. Custom system prompt
  console.log('4. Testing with custom system prompt...')
  try {
    const response = await ollamaSupabase.generate({
      prompt: 'SELECT * FROM users WHERE age > 25',
      system: 'You are a SQL optimization expert. Analyze the given query and suggest improvements.',
      temperature: 0.3,
      max_tokens: 200
    })
    console.log('SQL Analysis:', response.response)
  } catch (error) {
    console.error('Custom system prompt error:', error)
  }

  // 5. List available models
  console.log('\n5. Available models:')
  const models = await ollamaSupabase.listModels()
  models.forEach(model => console.log(`  - ${model}`))
}

// Run the example
main().catch(console.error)