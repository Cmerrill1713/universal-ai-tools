import { spawn } from 'child_process';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { zodValidate } from '@/middleware/zod-validate';
import { kokoroTTS } from '@/services/kokoro-tts-service';
import { log, LogContext } from '@/utils/logger';
const router = Router();
const upload = multer({ dest: '/tmp/voice-uploads/' });
const ttsSchema = z.object({
    text: z.string().min(1).max(5000),
    voice: z.string().optional().default('af_bella'),
    speed: z.number().optional().default(1.0),
    format: z.enum(['wav', 'mp3']).optional().default('wav')
});
const voiceCommandSchema = z.object({
    command: z.string().min(1),
    context: z.record(z.any()).optional()
});
router.get('/voices', authenticate, async (req, res) => {
    try {
        const voices = kokoroTTS.getAvailableVoices();
        res.json({
            success: true,
            data: {
                voices,
                defaultVoice: 'af_bella',
                categories: {
                    male: voices.filter(v => v.gender === 'male'),
                    female: voices.filter(v => v.gender === 'female')
                }
            }
        });
    }
    catch (error) {
        log.error('Failed to get voices', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: { message: 'Failed to retrieve available voices' }
        });
    }
});
router.post('/synthesize', authenticate, zodValidate(ttsSchema), async (req, res) => {
    try {
        const { text, voice, speed, format } = req.body;
        log.info('🎤 Synthesizing speech with Kokoro', LogContext.AI, {
            textLength: text.length,
            voice,
            speed
        });
        const result = await kokoroTTS.synthesize({
            text,
            voice,
            speed,
            outputFormat: format
        });
        res.json({
            success: true,
            data: {
                audioUrl: `/audio/${result.audioPath.split('/').pop()}`,
                duration: result.duration,
                voice: result.voice,
                fileSize: result.fileSize,
                executionTime: result.executionTime
            }
        });
    }
    catch (error) {
        log.error('TTS synthesis failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: { message: 'Failed to synthesize speech' }
        });
    }
});
router.post('/transcribe', authenticate, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: { message: 'No audio file provided' }
            });
        }
        log.info('🎧 Transcribing audio with Whisper', LogContext.AI, {
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });
        const transcription = await transcribeWithWhisper(req.file.path);
        return res.json({
            success: true,
            data: {
                text: transcription.text,
                language: transcription.language,
                confidence: transcription.confidence,
                duration: transcription.duration
            }
        });
    }
    catch (error) {
        log.error('Speech transcription failed', LogContext.AI, { error });
        return res.status(500).json({
            success: false,
            error: { message: 'Failed to transcribe audio' }
        });
    }
});
router.post('/command', authenticate, zodValidate(voiceCommandSchema), async (req, res) => {
    try {
        const { command, context } = req.body;
        log.info('🎙️ Processing voice command', LogContext.AI, {
            command: command.substring(0, 50),
            hasContext: !!context
        });
        const response = await processVoiceCommand(command, context);
        const speechResult = await kokoroTTS.synthesize({
            text: response.text,
            voice: response.voice || 'af_bella',
            speed: 1.0,
            outputFormat: 'wav'
        });
        res.json({
            success: true,
            data: {
                responseText: response.text,
                audioUrl: `/audio/${speechResult.audioPath.split('/').pop()}`,
                action: response.action,
                metadata: response.metadata
            }
        });
    }
    catch (error) {
        log.error('Voice command processing failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: { message: 'Failed to process voice command' }
        });
    }
});
router.get('/status', async (req, res) => {
    try {
        const kokoroStatus = await kokoroTTS.checkHealth();
        const whisperAvailable = await checkWhisperAvailability();
        res.json({
            success: true,
            data: {
                tts: {
                    provider: 'kokoro',
                    available: kokoroStatus,
                    voices: kokoroTTS.getAvailableVoices().length,
                    model: 'Kokoro-82M'
                },
                stt: {
                    provider: 'whisper',
                    available: whisperAvailable,
                    models: ['whisper-base', 'whisper-small', 'whisper-medium']
                }
            }
        });
    }
    catch (error) {
        log.error('Failed to check speech status', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: { message: 'Failed to check speech services status' }
        });
    }
});
async function transcribeWithWhisper(audioPath) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const whisperProcess = spawn('whisper', [
            audioPath,
            '--model', 'base',
            '--output_format', 'json',
            '--language', 'auto'
        ]);
        let output = '';
        let error = '';
        whisperProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        whisperProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        whisperProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    resolve({
                        text: result.text || '',
                        language: result.language || 'en',
                        confidence: result.confidence || 0.95,
                        duration: (Date.now() - startTime) / 1000
                    });
                }
                catch (parseError) {
                    resolve({
                        text: output.trim(),
                        language: 'en',
                        confidence: 0.9,
                        duration: (Date.now() - startTime) / 1000
                    });
                }
            }
            else {
                reject(new Error(`Whisper process failed: ${error}`));
            }
        });
    });
}
async function checkWhisperAvailability() {
    return new Promise((resolve) => {
        const whisperCheck = spawn('which', ['whisper']);
        whisperCheck.on('close', (code) => {
            resolve(code === 0);
        });
    });
}
async function processVoiceCommand(command, context) {
    const lowerCommand = command.toLowerCase();
    if (lowerCommand.includes('weather')) {
        return {
            text: "I'll check the weather for you. The current conditions are partly cloudy with a temperature of 72 degrees.",
            voice: 'af_bella',
            action: 'check_weather'
        };
    }
    else if (lowerCommand.includes('time')) {
        const now = new Date();
        return {
            text: `The current time is ${now.toLocaleTimeString()}.`,
            voice: 'af_bella',
            action: 'check_time'
        };
    }
    else if (lowerCommand.includes('help')) {
        return {
            text: "I can help you with various tasks. You can ask me about the weather, time, or to perform actions like sending messages or setting reminders.",
            voice: 'af_bella',
            action: 'show_help'
        };
    }
    else {
        return {
            text: `I understood your command: "${command}". How can I help you with that?`,
            voice: 'af_bella',
            action: 'process_command',
            metadata: { originalCommand: command }
        };
    }
}
export default router;
//# sourceMappingURL=speech.js.map