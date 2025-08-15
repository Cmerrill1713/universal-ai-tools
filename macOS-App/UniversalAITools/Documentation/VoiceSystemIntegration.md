# Voice System Integration Guide

## Overview

The Universal AI Tools macOS app now features comprehensive voice capabilities including speech-to-text (STT), text-to-speech (TTS), conversational AI interactions, and voice commands. This document provides integration instructions and usage guidelines.

## Architecture Components

### Core Services

1. **STTService** (`Services/STTService.swift`)
   - Uses macOS Speech framework for voice recognition
   - Supports multiple input modes: push-to-talk, voice activation, continuous
   - Provides real-time audio level monitoring
   - Configurable language support and recognition settings

2. **TTSService** (`Services/TTSService.swift`) 
   - Enhanced text-to-speech with premium voices
   - Volume and speed controls
   - Audio playback state management
   - Backend API integration for advanced voice synthesis

3. **VoiceAgent** (`Services/VoiceAgent.swift`)
   - Orchestrates STT and TTS services
   - Manages conversation context and personality
   - Supports multiple interaction modes (conversational, command, dictation, assistant)
   - Integrates with backend API for AI responses

4. **VoiceCommandHandler** (`Services/VoiceCommandHandler.swift`)
   - Natural language command parsing
   - Built-in commands for navigation, voice control, and system operations
   - Extensible command registration system
   - Context-aware command execution

### UI Components

1. **VoiceRecordingView** (`Views/Components/VoiceRecordingView.swift`)
   - Main voice input interface with visual feedback
   - Real-time waveform visualization
   - Recording controls and status indicators
   - Input mode selection

2. **VoiceControlsPanel** (`Views/Components/VoiceControlsPanel.swift`)
   - Comprehensive settings interface
   - Tabbed organization: General, STT, TTS, Agent, Advanced
   - Voice testing and configuration tools
   - Data export and management

3. **VoiceVisualFeedback** (`Views/Components/VoiceVisualFeedback.swift`)
   - Waveform visualizer for audio input
   - Voice status indicators
   - Interaction mode displays
   - Confidence meters and timeline views

4. **Enhanced SimpleChatView** 
   - Integrated voice input toggle
   - Voice recording controls
   - Visual feedback for voice states
   - Seamless text/voice switching

## Integration Steps

### 1. Add Voice Services to Your View

```swift
struct YourView: View {
    @State private var sttService = STTService()
    @State private var ttsService: TTSService
    @State private var voiceAgent: VoiceAgent
    
    init(apiService: APIService) {
        let tts = TTSService(apiService: apiService)
        let stt = STTService()
        
        self.ttsService = tts
        self.voiceAgent = VoiceAgent(sttService: stt, ttsService: tts, apiService: apiService)
    }
}
```

### 2. Request Permissions

```swift
.onAppear {
    Task {
        await sttService.requestAuthorization()
    }
}
```

### 3. Add Voice Controls

```swift
// Voice input button
CompactVoiceButton(voiceAgent: voiceAgent)

// Voice recording panel
VoiceRecordingView(
    sttService: sttService,
    voiceAgent: voiceAgent,
    onTranscriptionComplete: { transcription in
        // Handle transcription
    }
)

// Voice settings
VoiceControlsPanel(
    sttService: sttService,
    ttsService: ttsService,
    voiceAgent: voiceAgent
)
```

### 4. Monitor Voice State

```swift
.onChange(of: voiceAgent.state) { state in
    switch state {
    case .listening:
        // Update UI for listening state
    case .processing:
        // Show processing indicator
    case .responding:
        // Display AI response state
    case .error(let message):
        // Handle error
    default:
        // Idle state
    }
}
```

## Voice Interaction Modes

### Conversational Mode
- Natural back-and-forth conversation
- Maintains context between interactions
- Automatic TTS responses
- Ideal for chat interfaces

### Command Mode
- Single command execution
- No context retention
- Quick actions and controls
- Best for system operations

### Dictation Mode
- Pure speech-to-text transcription
- No AI processing
- Direct text input replacement
- Useful for content creation

### Assistant Mode
- Context-aware AI assistance
- Enhanced personality options
- Smart punctuation and formatting
- Professional use cases

## Built-in Voice Commands

The system includes these default voice commands:

- **"New chat"** - Start a new conversation
- **"Clear context"** - Reset conversation history
- **"Open settings"** - Launch settings panel
- **"Enable/Disable TTS"** - Toggle text-to-speech
- **"Stop listening"** - End voice recording
- **"Help"** - Show available commands
- **"Repeat that"** - Replay last response
- **"Export chat"** - Save conversation
- **"Switch to [mode] mode"** - Change interaction mode

## Configuration Options

### STT Settings
- **Input Mode**: Push-to-talk, voice activation, or continuous
- **Language**: Recognition language selection
- **Punctuation**: Automatic punctuation insertion
- **Partial Results**: Real-time transcription display
- **Silence Threshold**: Auto-stop timeout
- **Recording Duration**: Maximum recording time
- **Voice Activation**: Sensitivity threshold

### TTS Settings
- **Voice Selection**: Premium voice options
- **Volume**: Playback volume control
- **Speech Rate**: Playback speed adjustment
- **Auto-Response**: Automatic AI response reading

### Voice Agent Settings
- **Interaction Mode**: Conversational behavior
- **Context Retention**: Memory management
- **Personality**: Response style and tone
- **Voice Commands**: Activation phrases
- **Performance**: Timeout and optimization settings

## State Management

The voice system integrates with AppState to maintain:

- Voice enablement status
- Current interaction mode
- Recognition and agent states
- Interaction history
- User preferences

Use AppState methods for voice control:

```swift
appState.toggleVoiceInput()
appState.setVoiceInteractionMode(.conversational)
appState.addVoiceInteraction(interaction)
appState.clearVoiceHistory()
```

## Error Handling

The voice system provides comprehensive error handling:

```swift
switch sttService.recognitionState {
case .error(let message):
    // Display error to user
    showError(message)
case .idle:
    // Reset UI state
default:
    break
}
```

Common error scenarios:
- Microphone permission denied
- Speech recognition unavailable
- Network connectivity issues
- Backend API errors
- Audio hardware problems

## Performance Considerations

### Audio Processing
- Real-time audio level monitoring at 50ms intervals
- Efficient waveform data management
- Background audio processing
- Automatic cleanup of audio resources

### Memory Management
- Limited interaction history (100 items)
- Context trimming based on settings
- Automatic service cleanup on deinit
- Efficient UI state updates

### Network Usage
- STT uses local macOS Speech framework
- TTS can use local or remote synthesis
- AI responses require backend connectivity
- Configurable offline behavior

## Testing and Debugging

### Voice Testing
Use the built-in test features in VoiceControlsPanel:
- TTS playback testing
- STT recording verification
- End-to-end voice interaction testing

### Debug Information
Monitor voice system logs:
```swift
// Enable detailed logging in services
logger.debug("Voice operation: \(operation)")
```

### Common Issues
1. **No microphone access**: Check System Preferences > Security & Privacy
2. **Poor recognition**: Adjust voice activation threshold
3. **No audio output**: Verify TTS service initialization
4. **Backend errors**: Check API connectivity and authentication

## Best Practices

### User Experience
- Provide clear visual feedback for voice states
- Offer both voice and text input options
- Include help and tutorial information
- Handle errors gracefully with useful messages

### Performance
- Initialize services early in app lifecycle
- Use background queues for audio processing
- Implement proper cleanup and resource management
- Monitor and limit memory usage

### Accessibility
- Support VoiceOver integration
- Provide keyboard alternatives
- Include visual indicators for audio states
- Offer customizable interface options

## Future Enhancements

Potential improvements for the voice system:
- Multi-language support
- Custom voice training
- Advanced noise cancellation
- Gesture-based controls
- Voice shortcuts and macros
- Integration with Shortcuts app
- Cloud voice synthesis options
- Real-time voice translation

## Integration Checklist

- [ ] Add voice services to your view
- [ ] Request microphone permissions
- [ ] Implement voice UI components
- [ ] Configure voice settings
- [ ] Test voice interactions
- [ ] Handle error scenarios
- [ ] Add voice commands
- [ ] Integrate with app state
- [ ] Test accessibility features
- [ ] Optimize performance

The voice system provides a comprehensive foundation for voice-enabled AI interactions in the Universal AI Tools macOS app. Follow this guide to integrate voice capabilities into your specific use cases and workflows.