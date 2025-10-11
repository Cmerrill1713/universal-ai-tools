# Voice Features Testing Guide
This guide provides comprehensive instructions for testing the Kokoro TTS and voice features integration in the Universal AI Tools platform.
## Table of Contents

- [Quick Start](#quick-start)

- [Backend Testing](#backend-testing)

- [Frontend Testing](#frontend-testing)

- [API Endpoints](#api-endpoints)

- [Voice Profile Testing](#voice-profile-testing)

- [Error Scenarios](#error-scenarios)

- [Performance Testing](#performance-testing)

- [Troubleshooting](#troubleshooting)
## Quick Start
### Prerequisites

1. Node.js and npm installed

2. Backend server running on port 9999

3. (Optional) FFmpeg installed for MP3 conversion

4. (Optional) Python 3 with audio libraries for Kokoro TTS
### Start the System

```bash
# Start backend

npm run dev

# In another terminal, start frontend

cd ui

npm run dev

```
### Basic Test

1. Open http://localhost:5173

2. Click on the voice assistant avatar

3. Click the microphone button and speak

4. Listen for the AI response
## Backend Testing
### Health Check

Test the speech service health:

```bash

curl -X GET "http://localhost:9999/api/speech/health" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui"

```
Expected response:

```json

{

  "success": true,

  "status": "healthy",

  "services": {

    "openai": false,

    "elevenlabs": false,

    "kokoro": true,

    "whisper": false

  },

  "details": {

    "kokoro": {

      "initialized": true,

      "modelPath": "/path/to/models/tts/Kokoro-82M",

      "availableProfiles": 5

    },

    "audioProcessing": {

      "totalProcessed": 0,

      "successRate": 0,

      "averageProcessingTime": 0

    }

  }

}

```
### Voice Synthesis

Test basic speech synthesis:

```bash

curl -X POST "http://localhost:9999/api/speech/synthesize" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{

    "text": "Hello! This is a test of the voice synthesis system.",

    "personality": "sweet",

    "sweetness_level": 0.7,

    "format": "mp3"

  }' \

  --output test_audio.mp3

```
### Kokoro TTS Direct Test

Test Kokoro TTS specifically:

```bash

curl -X POST "http://localhost:9999/api/speech/synthesize/kokoro" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{

    "text": "Hello from Kokoro TTS!",

    "voiceId": "athena-sweet",

    "format": "wav"

  }' \

  --output kokoro_test.wav

```
### Voice Testing

Test individual Kokoro voices:

```bash

curl -X POST "http://localhost:9999/api/speech/test/kokoro/athena-sweet" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{

    "text": "This is Athena with a sweet voice style."

  }' \

  --output athena_sweet_test.wav

```
### Get Available Voices

```bash

curl -X GET "http://localhost:9999/api/speech/voices" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui"

```
## Frontend Testing
### Voice Assistant UI

1. Open the application in a browser

2. Click the AI assistant avatar to open the voice interface

3. Test features:

   - Microphone icon: Start/stop voice recognition

   - Speaker icon: Play/pause TTS output

   - Test button (🎵): Test current voice settings

   - Settings button: Access voice configuration
### Browser Compatibility

Test in different browsers:

- Chrome (best Web Audio support)

- Firefox

- Safari

- Edge
### Voice Recognition Testing

1. Click microphone button

2. Speak clearly: "Hello, how are you today?"

3. Observe transcript appearing in real-time

4. Wait for AI response and TTS playback
### Voice Synthesis Testing

1. Type a message in chat

2. Click send

3. Listen for voice response

4. Test different personalities:

   - Sweet: Warm and gentle

   - Confident: Clear and assured

   - Playful: Bubbly and energetic

   - Caring: Nurturing and soothing

   - Shy: Soft and reserved
## API Endpoints
### Core Speech Endpoints

#### `GET /api/speech/health`

Check service health and availability.

#### `POST /api/speech/synthesize`

Standard speech synthesis with personality support.
**Body:**

```json

{

  "text": "Text to synthesize",

  "personality": "sweet|confident|playful|caring|shy",

  "sweetness_level": 0.7,

  "format": "mp3|wav",

  "conversation_id": "optional-uuid"

}

```

#### `POST /api/speech/synthesize/retry`

Speech synthesis with retry logic for improved reliability.

#### `POST /api/speech/synthesize/kokoro`

Direct Kokoro TTS synthesis.
**Body:**

```json

{

  "text": "Text to synthesize",

  "voiceId": "athena-sweet|athena-confident|athena-warm|athena-playful|athena-professional",

  "format": "mp3|wav"

}

```

#### `POST /api/speech/transcribe`

Speech recognition from audio files.

#### `GET /api/speech/voices`

Get all available voices and profiles.
### Testing Endpoints

#### `POST /api/speech/test/kokoro/:voiceId`

Test specific Kokoro voice with sample text.

#### `POST /api/speech/estimate-duration`

Estimate audio duration for given text.

#### `POST /api/speech/admin/clear-cache`

Clear all speech service caches.
## Voice Profile Testing
### Available Personalities

Test each personality with different sweetness levels:
1. **Sweet** (athena-sweet)

   - Sweetness 0.3: Gentle

   - Sweetness 0.7: Moderately sweet

   - Sweetness 1.0: Very sweet
2. **Confident** (athena-confident)

   - Professional and assured tone

   - Good for business or instructional content
3. **Playful** (athena-playful)

   - Energetic and fun

   - Good for casual conversation
4. **Caring** (athena-warm)

   - Nurturing and empathetic

   - Good for support or comfort
5. **Shy** (maps to athena-sweet)

   - Soft and reserved

   - Good for gentle interactions
### Test Script

```bash
#!/bin/bash

# Test all personalities

personalities=("sweet" "confident" "playful" "caring" "shy")

sweetness_levels=(0.3 0.7 1.0)
for personality in "${personalities[@]}"; do

  for sweetness in "${sweetness_levels[@]}"; do

    echo "Testing $personality with sweetness $sweetness"

    curl -X POST "http://localhost:9999/api/speech/synthesize" \

      -H "Content-Type: application/json" \

      -H "X-API-Key: local-dev-key" \

      -H "X-AI-Service: local-ui" \

      -d "{

        \"text\": \"Hello, I am the $personality personality with sweetness level $sweetness\",

        \"personality\": \"$personality\",

        \"sweetness_level\": $sweetness,

        \"format\": \"mp3\"

      }" \

      --output "test_${personality}_${sweetness}.mp3"

  done

done

```
## Error Scenarios
### Test Error Handling
1. **Invalid API Key**

```bash

curl -X POST "http://localhost:9999/api/speech/synthesize" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: invalid-key" \

  -d '{"text": "Test", "personality": "sweet"}'

```
2. **Invalid Personality**

```bash

curl -X POST "http://localhost:9999/api/speech/synthesize" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{"text": "Test", "personality": "invalid"}'

```
3. **Empty Text**

```bash

curl -X POST "http://localhost:9999/api/speech/synthesize" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{"text": "", "personality": "sweet"}'

```
4. **Very Long Text**

```bash
# Generate long text

long_text=$(python3 -c "print('A' * 10000)")

curl -X POST "http://localhost:9999/api/speech/synthesize" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d "{\"text\": \"$long_text\", \"personality\": \"sweet\"}"

```
### Browser Error Testing
1. **No Microphone Permission**

   - Deny microphone access

   - Test graceful degradation
2. **No Speaker/Audio Output**

   - Mute system audio

   - Test error messages
3. **Network Disconnection**

   - Disconnect internet during synthesis

   - Test fallback mechanisms
## Performance Testing
### Load Testing

Test concurrent synthesis requests:
```bash
#!/bin/bash

# Run 10 concurrent requests

for i in {1..10}; do

  curl -X POST "http://localhost:9999/api/speech/synthesize" \

    -H "Content-Type: application/json" \

    -H "X-API-Key: local-dev-key" \

    -H "X-AI-Service: local-ui" \

    -d "{

      \"text\": \"Concurrent test request number $i\",

      \"personality\": \"sweet\",

      \"format\": \"mp3\"

    }" \

    --output "concurrent_$i.mp3" &

done
wait

echo "All concurrent requests completed"

```
### Memory Usage

Monitor memory usage during extended testing:
```bash
# Monitor memory while running voice tests

top -p $(pgrep -f "node.*server") &
# Run your tests here

```
### Response Time Testing

Measure synthesis response times:
```bash
#!/bin/bash
for i in {1..5}; do

  echo "Test $i:"

  time curl -X POST "http://localhost:9999/api/speech/synthesize" \

    -H "Content-Type: application/json" \

    -H "X-API-Key: local-dev-key" \

    -H "X-AI-Service: local-ui" \

    -d '{"text": "Performance test", "personality": "sweet"}' \

    --output "/dev/null" \

    --silent

  echo ""

done

```
## Troubleshooting
### Common Issues
1. **Backend Not Responding**

   - Check server is running on port 9999

   - Verify no CORS issues

   - Check logs for errors
2. **No Audio Output**

   - Verify audio format support

   - Check browser audio permissions

   - Test with different browsers
3. **Kokoro TTS Not Working**

   - Check Python installation

   - Verify model path exists

   - Check temp directory permissions
4. **Poor Voice Quality**

   - Test FFmpeg installation

   - Check audio processing settings

   - Verify voice profile parameters
### Log Analysis

Check server logs for errors:
```bash
# Follow server logs

tail -f server.log

# Filter for voice-related errors

grep -i "voice\|speech\|audio\|kokoro" server.log

```
### Debug Mode

Enable debug logging:
```bash
# Set environment variable

export LOG_LEVEL=debug

# Or in .env file

LOG_LEVEL=debug

```
### Health Check Script

Create a comprehensive health check:
```bash
#!/bin/bash
echo "=== Voice Features Health Check ==="

# Check backend health

echo "1. Checking backend health..."

health=$(curl -s "http://localhost:9999/api/speech/health" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui")
if echo "$health" | grep -q "healthy"; then

  echo "✅ Backend is healthy"

else

  echo "❌ Backend health issues detected"

  echo "$health"

fi

# Check voice synthesis

echo "2. Testing voice synthesis..."

if curl -s -X POST "http://localhost:9999/api/speech/synthesize" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{"text": "Health check test", "personality": "sweet"}' \

  --output /dev/null; then

  echo "✅ Voice synthesis working"

else

  echo "❌ Voice synthesis failed"

fi

# Check Kokoro TTS

echo "3. Testing Kokoro TTS..."

if curl -s -X POST "http://localhost:9999/api/speech/test/kokoro/athena-sweet" \

  -H "Content-Type: application/json" \

  -H "X-API-Key: local-dev-key" \

  -H "X-AI-Service: local-ui" \

  -d '{"text": "Kokoro test"}' \

  --output /dev/null; then

  echo "✅ Kokoro TTS working"

else

  echo "❌ Kokoro TTS failed"

fi
echo "=== Health Check Complete ==="

```
## Test Results Validation
### Expected Outcomes
1. **Successful Synthesis**

   - Audio file generated

   - Appropriate file size (>1KB for short text)

   - Valid audio format headers

   - Playable audio
2. **Voice Characteristics**

   - Sweet: Higher pitch, slower pace

   - Confident: Clear articulation, moderate pace

   - Playful: Variable pitch, energetic

   - Caring: Warm tone, gentle pace
3. **Error Handling**

   - Graceful fallback to browser TTS

   - Appropriate error messages

   - No server crashes
4. **Performance**

   - Synthesis time < 5 seconds for normal text

   - Memory usage stable during extended use

   - Concurrent requests handled properly
### Success Criteria
- ✅ All personalities working

- ✅ Audio quality acceptable

- ✅ Error handling robust

- ✅ UI responsive and intuitive

- ✅ Performance within acceptable limits

- ✅ No memory leaks

- ✅ Cross-browser compatibility
This testing guide ensures comprehensive validation of the voice features integration. Regular testing helps maintain system reliability and user experience quality.