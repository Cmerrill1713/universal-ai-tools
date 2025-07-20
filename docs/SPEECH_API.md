# Universal AI Tools Speech API

This document describes the comprehensive voice synthesis and speech recognition capabilities of the Universal AI Tools platform, featuring multiple TTS providers, personality-based voice modulation, and high-quality speech processing.

## Overview

The Speech API provides:
- **Multi-provider TTS**: OpenAI TTS, ElevenLabs, and Kokoro TTS
- **Speech Recognition**: Whisper-based transcription
- **Personality Profiles**: Sweet, shy, confident, caring, and playful voices
- **Dynamic Voice Modulation**: Sweetness levels and emotional parameters
- **High-Quality Audio**: Multiple formats and quality levels

## Authentication

All endpoints require authentication using the standard Universal AI Tools headers:
- `X-API-Key`: Your API key
- `X-AI-Service`: Your service identifier

## Endpoints

### 1. Speech Recognition - `/api/speech/transcribe`

Transcribes audio files to text using Whisper AI.

**Method:** POST  
**Content-Type:** multipart/form-data

**Request:**
```javascript
// Form data fields:
audio: File // Audio file (WebM, WAV, MP3, OGG)
conversation_id: string // Optional - links to conversation
context: string // Optional - provides context for better transcription
```

**Response:**
```json
{
  "success": true,
  "transcript": "Hello, I'd like to learn more about quantum computing.",
  "confidence": 0.95,
  "duration": 3.5,
  "language": "en",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Voice Synthesis - `/api/speech/synthesize`

Generates speech audio from text with personality-based voice characteristics.

**Method:** POST  
**Content-Type:** application/json

**Request:**
```json
{
  "text": "Hello! I'm Sweet Athena, your AI assistant. How can I help you today?",
  "personality": "sweet", // Options: sweet, shy, confident, caring, playful
  "sweetness_level": 0.7, // 0.0 to 1.0 - affects voice warmth and pitch
  "voice_settings": { // Optional - fine-tune voice
    "stability": 0.75,
    "similarity_boost": 0.8,
    "style": 0.6,
    "use_speaker_boost": true
  },
  "conversation_id": "conv_123", // Optional
  "format": "mp3" // Options: mp3, wav
}
```

**Response:**
- Audio file (MP3 or WAV format)
- Headers include:
  - `X-Voice-Id`: The voice ID used
  - `X-Voice-Personality`: The personality applied
  - `X-Audio-Duration`: Duration in seconds

### 3. Get Available Voices - `/api/speech/voices`

Lists all available voices and personality profiles.

**Method:** GET

**Response:**
```json
{
  "success": true,
  "voices": [
    {
      "id": "EXAVITQu4vr4xnSDxMaL",
      "name": "Sarah (Sweet)",
      "provider": "elevenlabs",
      "preview_url": "https://...",
      "labels": {
        "accent": "american",
        "description": "warm and friendly",
        "age": "young-adult",
        "gender": "female"
      }
    }
  ],
  "personalities": [
    {
      "name": "Sweet",
      "description": "Warm, gentle, and inviting voice with a hint of sweetness",
      "base_profile": {
        "pitch": 1.1,
        "speaking_rate": 0.95,
        "description": "A warm and inviting voice that sounds caring and approachable"
      }
    }
  ]
}
```

### 4. Configure Voice - `/api/speech/configure-voice`

Updates voice configuration for a specific personality.

**Method:** POST  
**Content-Type:** application/json

**Request:**
```json
{
  "personality": "sweet",
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "settings": {
    "pitch_adjustment": 0.1, // -2 to 2
    "speaking_rate": 0.95, // 0.5 to 2
    "volume_gain_db": 3 // -20 to 20
  }
}
```

### 5. Get Voice History - `/api/speech/history/:conversation_id`

Retrieves voice interaction history for a conversation.

**Method:** GET  
**Parameters:**
- `limit`: Number of entries to retrieve (default: 50)

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "content": "User (voice): What is quantum computing?",
      "created_at": "2024-01-15T10:30:00.000Z",
      "metadata": {
        "audio_duration": 2.5,
        "confidence": 0.96
      }
    },
    {
      "content": "Assistant (voice): Quantum computing is a revolutionary approach...",
      "created_at": "2024-01-15T10:30:05.000Z",
      "metadata": {
        "personality": "sweet",
        "sweetness_level": 0.7,
        "voice_id": "sarah",
        "duration": 15.3
      }
    }
  ],
  "conversation_id": "conv_123"
}
```

### 6. Kokoro TTS Synthesis - `/api/speech/synthesize/kokoro`

High-quality local TTS synthesis using the Kokoro model for natural-sounding voices.

**Method:** POST  
**Content-Type:** application/json

**Request:**
```json
{
  "text": "Hello! This is a high-quality Kokoro TTS synthesis.",
  "voiceId": "athena-sweet", // Available: athena-sweet, athena-confident, athena-caring
  "voiceSettings": { // Optional
    "pitch": 1.0, // 0.5 to 2.0
    "speakingRate": 1.0, // 0.5 to 2.0
    "temperature": 0.7 // 0.1 to 1.0
  },
  "format": "wav" // Options: wav, mp3
}
```

**Response Headers:**
- `X-Voice-Provider`: "kokoro"
- `X-Voice-Profile`: Voice profile ID used
- `X-Processing-Time`: Processing time in milliseconds

**Features:**
- Ultra-natural voice synthesis
- Low latency processing
- Local processing (no external API calls)
- Optimized for conversational AI

## Voice Personalities

### Sweet (Default)
- **Characteristics:** Warm, gentle, inviting
- **Pitch:** Slightly higher (+10%)
- **Rate:** Slightly slower (-5%)
- **Best for:** General assistance, friendly interactions

### Shy
- **Characteristics:** Soft, reserved, endearing
- **Pitch:** Higher (+15%)
- **Rate:** Slower (-10%)
- **Best for:** Gentle guidance, sensitive topics

### Confident
- **Characteristics:** Clear, assured, professional
- **Pitch:** Normal
- **Rate:** Normal
- **Best for:** Technical explanations, leadership

### Caring
- **Characteristics:** Nurturing, empathetic, soothing
- **Pitch:** Slightly higher (+5%)
- **Rate:** Slower (-8%)
- **Best for:** Support, counseling, encouragement

### Playful
- **Characteristics:** Bubbly, energetic, expressive
- **Pitch:** Variable (+8%)
- **Rate:** Faster (+5%)
- **Best for:** Entertainment, creativity, fun interactions

## Sweetness Level

The `sweetness_level` parameter (0.0 to 1.0) affects:
- **Voice warmth:** Higher values = warmer tone
- **Breathiness:** Subtle breathiness increases with sweetness
- **Pitch variation:** More melodic with higher sweetness
- **Expressiveness:** More emotional range with higher sweetness

## Integration Example

```javascript
// Frontend integration example
class SweetAthenaVoice {
  constructor(apiKey, serviceId) {
    this.apiKey = apiKey;
    this.serviceId = serviceId;
    this.baseUrl = 'http://localhost:3002/api/speech';
  }

  async transcribeAudio(audioBlob, conversationId) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('conversation_id', conversationId);
    
    const response = await fetch(`${this.baseUrl}/transcribe`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'X-AI-Service': this.serviceId
      },
      body: formData
    });
    
    return response.json();
  }

  async synthesizeSpeech(text, personality = 'sweet', sweetnessLevel = 0.7) {
    const response = await fetch(`${this.baseUrl}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-AI-Service': this.serviceId
      },
      body: JSON.stringify({
        text,
        personality,
        sweetness_level: sweetnessLevel,
        format: 'mp3'
      })
    });
    
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  }
}
```

## Environment Variables

Configure the following environment variables for TTS providers:

```bash
# OpenAI for Whisper transcription and TTS
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs for premium voice synthesis (optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Kokoro TTS configuration (local deployment)
KOKORO_TTS_ENABLED=true
KOKORO_MODEL_PATH=/path/to/kokoro/models

# Custom Whisper API URL (optional - for local deployment)
WHISPER_API_URL=http://localhost:5000/transcribe

# Voice provider priority (optional)
TTS_PROVIDER_PRIORITY=kokoro,elevenlabs,openai
```

## TTS Provider Priority

The service automatically selects the best available TTS provider based on:
1. **Kokoro TTS** (highest quality, local processing)
2. **ElevenLabs** (premium cloud voices)
3. **OpenAI TTS** (reliable cloud fallback)
4. **Mock Audio** (development mode only)

## Error Handling

All endpoints return appropriate error responses:

```json
{
  "error": "Failed to transcribe audio",
  "details": "Invalid audio format"
}
```

Common status codes:
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (invalid API key)
- `413`: File too large (>25MB)
- `500`: Server error

## Rate Limits

- Transcription: 100 requests per minute
- Synthesis: 500 requests per minute
- File size limit: 25MB for audio uploads

## Best Practices

1. **Audio Quality:** For best transcription results, use:
   - Sample rate: 16kHz or higher
   - Bit rate: 128kbps or higher
   - Clear audio without background noise

2. **Text Length:** For synthesis:
   - Optimal: 1-500 characters per request
   - Maximum: 5000 characters
   - Split longer texts for better quality

3. **Personality Selection:**
   - Match personality to context
   - Use sweetness level to fine-tune warmth
   - Maintain consistency within conversations

4. **Performance:**
   - Cache synthesized audio when possible
   - Use WebSocket for real-time transcription (future feature)
   - Implement client-side audio compression