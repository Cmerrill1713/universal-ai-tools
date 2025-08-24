import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VoiceRequest {
  action: 'transcribe' | 'synthesize'
  audio?: string // base64 encoded audio for transcription
  text?: string // text for synthesis
  voiceProfile?: {
    voice_id: string
    settings: {
      stability: number
      similarity_boost: number
      style: number
      pitch: number
      speaking_rate: number
    }
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, audio, text, voiceProfile } = await req.json() as VoiceRequest
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get API keys from Vault
    const { data: secrets } = await supabase
      .from('vault.llm_secrets')
      .select('name, secret')
      .in('name', ['whisper_api_key', 'elevenlabs_api_key', 'local_whisper_url', 'local_tts_url'])

    const secretsMap = new Map(secrets?.map(s => [s.name, s.secret]) || [])

    switch (action) {
      case 'transcribe': {
        if (!audio) {
          throw new Error('Audio data required for transcription')
        }

        // Try local Whisper first
        const localWhisperUrl = secretsMap.get('local_whisper_url')
        if (localWhisperUrl) {
          try {
            const response = await fetch(localWhisperUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio, format: 'base64' })
            })

            if (response.ok) {
              const result = await response.json()
              
              // Log analytics
              await supabase.from('analytics_events').insert({
                event_type: 'voice_transcription',
                metadata: {
                  provider: 'local_whisper',
                  duration: result.duration,
                  language: result.language
                }
              })

              return new Response(JSON.stringify({
                text: result.text,
                confidence: result.confidence,
                provider: 'local_whisper'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          } catch (error) {
            console.error('Local Whisper error:', error)
          }
        }

        // Fallback to OpenAI Whisper
        const whisperApiKey = secretsMap.get('whisper_api_key')
        if (whisperApiKey) {
          // Convert base64 to blob
          const audioBlob = base64ToBlob(audio)
          const formData = new FormData()
          formData.append('file', audioBlob, 'audio.webm')
          formData.append('model', 'whisper-1')

          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whisperApiKey}`
            },
            body: formData
          })

          const result = await response.json()
          
          // Log analytics
          await supabase.from('analytics_events').insert({
            event_type: 'voice_transcription',
            metadata: {
              provider: 'openai_whisper',
              text_length: result.text?.length
            }
          })

          return new Response(JSON.stringify({
            text: result.text,
            provider: 'openai_whisper'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        throw new Error('No transcription service available')
      }

      case 'synthesize': {
        if (!text || !voiceProfile) {
          throw new Error('Text and voice profile required for synthesis')
        }

        // Try local TTS first
        const localTTSUrl = secretsMap.get('local_tts_url')
        if (localTTSUrl) {
          try {
            const response = await fetch(localTTSUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text,
                voice: voiceProfile.voice_id,
                settings: voiceProfile.settings
              })
            })

            if (response.ok) {
              const audioBuffer = await response.arrayBuffer()
              const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))
              
              // Store in Supabase Storage
              const fileName = `audio/${Date.now()}_${voiceProfile.voice_id}.mp3`
              const { data: uploadData } = await supabase.storage
                .from('voice-outputs')
                .upload(fileName, audioBuffer, {
                  contentType: 'audio/mpeg'
                })

              // Log analytics
              await supabase.from('analytics_events').insert({
                event_type: 'voice_synthesis',
                metadata: {
                  provider: 'local_tts',
                  voice_id: voiceProfile.voice_id,
                  text_length: text.length,
                  storage_path: uploadData?.path
                }
              })

              return new Response(JSON.stringify({
                audio: base64Audio,
                url: uploadData?.path ? `${supabaseUrl}/storage/v1/object/public/voice-outputs/${uploadData.path}` : null,
                provider: 'local_tts'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          } catch (error) {
            console.error('Local TTS error:', error)
          }
        }

        // Fallback to ElevenLabs
        const elevenLabsKey = secretsMap.get('elevenlabs_api_key')
        if (elevenLabsKey) {
          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceProfile.voice_id}`,
            {
              method: 'POST',
              headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text,
                model_id: 'eleven_turbo_v2',
                voice_settings: voiceProfile.settings
              })
            }
          )

          const audioBuffer = await response.arrayBuffer()
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))
          
          // Store in Supabase Storage
          const fileName = `audio/${Date.now()}_${voiceProfile.voice_id}.mp3`
          const { data: uploadData } = await supabase.storage
            .from('voice-outputs')
            .upload(fileName, audioBuffer, {
              contentType: 'audio/mpeg'
            })

          // Log analytics
          await supabase.from('analytics_events').insert({
            event_type: 'voice_synthesis',
            metadata: {
              provider: 'elevenlabs',
              voice_id: voiceProfile.voice_id,
              text_length: text.length,
              storage_path: uploadData?.path
            }
          })

          return new Response(JSON.stringify({
            audio: base64Audio,
            url: uploadData?.path ? `${supabaseUrl}/storage/v1/object/public/voice-outputs/${uploadData.path}` : null,
            provider: 'elevenlabs'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        throw new Error('No synthesis service available')
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('Voice processor error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function base64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: 'audio/webm' })
}