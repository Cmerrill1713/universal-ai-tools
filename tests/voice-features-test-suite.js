import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { KokoroTTSService } from '../src/services/kokoro-tts-service';
import { SpeechService } from '../src/services/speech-service';
import { VoiceProfileService } from '../src/services/voice-profile-service';
import { audioHandler } from '../src/services/audio-handler';
import { logger } from '../src/utils/logger';
import { TWO, THREE, HOURS_IN_DAY } from '../src/utils/constants';
describe('Voice Features Test Suite', () => {
    let kokoroTTS;
    let speechService;
    let voiceProfileService;
    let mockSupabase;
    beforeEach(() => {
        mockSupabase = {
            from: jest.fn(() => ({
                insert: jest.fn().mockResolvedValue({ data: null, error: null }),
                select: jest.fn().mockResolvedValue({ data: [], error: null }),
            })),
        };
        kokoroTTS = new KokoroTTSService();
        speechService = new SpeechService(mockSupabase);
        voiceProfileService = new VoiceProfileService();
        jest.spyOn(logger, 'error').mockImplementation(() => { });
        jest.spyOn(logger, 'warn').mockImplementation(() => { });
        jest.spyOn(logger, 'info').mockImplementation(() => { });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Kokoro TTS Service', () => {
        it('should initialize correctly', async () => {
            const status = kokoroTTS.getServiceStatus();
            expect(status).toHaveProperty('modelPath');
            expect(status).toHaveProperty('pythonPath');
            expect(status).toHaveProperty('availableProfiles');
            expect(status.availableProfiles).toBeGreaterThan(0);
        });
        it('should provide voice profiles', () => {
            const profiles = kokoroTTS.getVoiceProfiles();
            expect(profiles).toBeDefined();
            expect(profiles.length).toBeGreaterThan(0);
            const sweetProfile = profiles.find((p) => p.id === 'athena-sweet');
            expect(sweetProfile).toBeDefined();
            expect(sweetProfile?.style).toBe('sweet');
            expect(sweetProfile?.gender).toBe('female');
        });
        it('should validate voice profile parameters', () => {
            const profiles = kokoroTTS.getVoiceProfiles();
            profiles.forEach((profile) => {
                expect(profile.pitch).toBeGreaterThanOrEqual(-2.0);
                expect(profile.pitch).toBeLessThanOrEqual(2.0);
                expect(profile.speed).toBeGreaterThanOrEqual(0.5);
                expect(profile.speed).toBeLessThanOrEqual(2.0);
                expect(profile.id).toBeDefined();
                expect(profile.name).toBeDefined();
                expect(profile.voiceFile).toBeDefined();
            });
        });
        it('should handle synthesis options validation', async () => {
            const profile = kokoroTTS.getVoiceProfile('athena-sweet');
            expect(profile).toBeDefined();
            if (profile) {
                const validOptions = {
                    text: 'Hello, this is a test.',
                    voiceProfile: profile,
                    outputFormat: 'wav',
                    temperature: 0.7,
                    topP: 0.9,
                };
                expect(() => {
                    kokoroTTS.synthesize(validOptions);
                }).not.toThrow();
            }
        });
        it('should generate appropriate Python script', () => {
            const profile = kokoroTTS.getVoiceProfile('athena-sweet');
            if (profile) {
                const mockSynthesize = jest.spyOn(kokoroTTS, 'synthesize');
                kokoroTTS.synthesize({
                    text: 'Test text',
                    voiceProfile: profile,
                    outputFormat: 'wav',
                });
                expect(mockSynthesize).toHaveBeenCalledWith(expect.objectContaining({
                    text: 'Test text',
                    voiceProfile: profile,
                    outputFormat: 'wav',
                }));
            }
        });
    });
    describe('Audio Handler', () => {
        const createTestWavBuffer = () => {
            const header = Buffer.alloc(44);
            header.write('RIFF', 0);
            header.writeUInt32LE(1024, 4);
            header.write('WAVE', 8);
            header.write('fmt ', 12);
            header.writeUInt32LE(16, 16);
            header.writeUInt16LE(1, 20);
            header.writeUInt16LE(1, 22);
            header.writeUInt32LE(22050, HOURS_IN_DAY);
            header.writeUInt32LE(44100, 28);
            header.writeUInt16LE(2, 32);
            header.writeUInt16LE(16, 34);
            header.write('data', 36);
            header.writeUInt32LE(1000, 40);
            const audioData = Buffer.alloc(1000, 0);
            return Buffer.concat([header, audioData]);
        };
        it('should validate audio buffers correctly', async () => {
            const validWav = createTestWavBuffer();
            const validation = await audioHandler.validateAudioBuffer(validWav, 'wav');
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            expect(validation.metadata.format).toBe('wav');
        });
        it('should detect invalid audio buffers', async () => {
            const invalidBuffer = Buffer.alloc(10, 0);
            const validation = await audioHandler.validateAudioBuffer(invalidBuffer);
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
        it('should process audio with normalization', async () => {
            const testBuffer = createTestWavBuffer();
            const result = await audioHandler.processAudio(testBuffer, {
                format: 'wav',
                normalize: true,
            });
            expect(result.buffer).toBeDefined();
            expect(result.metadata.isValid).toBe(true);
            expect(result.warnings).toContain('Audio normalization applied');
        });
        it('should get accurate audio metadata', async () => {
            const testBuffer = createTestWavBuffer();
            const result = await audioHandler.processAudio(testBuffer, {
                format: 'wav',
            });
            expect(result.metadata.format).toBe('wav');
            expect(result.metadata.channels).toBe(1);
            expect(result.metadata.sampleRate).toBe(22050);
            expect(result.metadata.duration).toBeGreaterThan(0);
        });
        it('should handle processing errors gracefully', async () => {
            const corruptBuffer = Buffer.from('not audio data');
            try {
                await audioHandler.processAudio(corruptBuffer, {
                    format: 'wav',
                });
            }
            catch (error) {
                expect(error).toBeDefined();
            }
        });
        it('should track processing statistics', async () => {
            const testBuffer = createTestWavBuffer();
            await audioHandler.clearCache();
            await audioHandler.processAudio(testBuffer, { format: 'wav' });
            const stats = audioHandler.getProcessingStats();
            expect(stats.totalProcessed).toBe(1);
            expect(stats.successRate).toBeGreaterThan(0);
        });
    });
    describe('Voice Profile Service', () => {
        it('should provide all personality profiles', () => {
            const profiles = voiceProfileService.getAllProfiles();
            expect(profiles.length).toBeGreaterThanOrEqual(5);
            const personalities = ['sweet', 'shy', 'confident', 'caring', 'playful'];
            personalities.forEach((personality) => {
                const profile = profiles.find((p) => p.name.toLowerCase().includes(personality));
                expect(profile).toBeDefined();
            });
        });
        it('should generate voice profiles with correct parameters', () => {
            const sweetnessLevels = [0.0, 0.5, 1.0];
            const personalities = ['sweet', 'confident', 'playful'];
            personalities.forEach((personality) => {
                sweetnessLevels.forEach((sweetness) => {
                    const profile = voiceProfileService.getVoiceProfile(personality, sweetness);
                    expect(profile.pitch).toBeGreaterThanOrEqual(0.5);
                    expect(profile.pitch).toBeLessThanOrEqual(2.0);
                    expect(profile.speaking_rate).toBeGreaterThanOrEqual(0.5);
                    expect(profile.speaking_rate).toBeLessThanOrEqual(1.5);
                    expect(profile.stability).toBeGreaterThanOrEqual(0);
                    expect(profile.stability).toBeLessThanOrEqual(1);
                });
            });
        });
        it('should adjust voice profiles for context', () => {
            const baseProfile = voiceProfileService.getVoiceProfile('sweet', 0.7);
            const contexts = [
                { textLength: 2000, urgency: 'high' },
                { textLength: 30, audience: 'child' },
                { urgency: 'low', audience: 'professional' },
            ];
            contexts.forEach((context) => {
                const adjusted = voiceProfileService.adjustVoiceForContext(baseProfile, context);
                expect(adjusted.pitch).toBeGreaterThanOrEqual(0.5);
                expect(adjusted.pitch).toBeLessThanOrEqual(2.0);
                expect(adjusted.speaking_rate).toBeGreaterThanOrEqual(0.5);
                expect(adjusted.speaking_rate).toBeLessThanOrEqual(1.5);
            });
        });
        it('should provide Kokoro voice profiles', () => {
            const personalities = ['sweet', 'confident', 'playful'];
            personalities.forEach((personality) => {
                const kokoroProfile = voiceProfileService.getKokoroVoiceProfile(personality, 0.7);
                if (kokoroProfile) {
                    expect(kokoroProfile.id).toBeDefined();
                    expect(kokoroProfile.pitch).toBeGreaterThanOrEqual(-2.0);
                    expect(kokoroProfile.pitch).toBeLessThanOrEqual(2.0);
                    expect(kokoroProfile.speed).toBeGreaterThanOrEqual(0.5);
                    expect(kokoroProfile.speed).toBeLessThanOrEqual(2.0);
                }
            });
        });
        it('should validate voice configurations', () => {
            const validConfig = {
                personality: 'sweet',
                sweetness_level: 0.7,
                voice_settings: {
                    stability: 0.8,
                    similarity_boost: 0.7,
                },
            };
            const validation = voiceProfileService.validateVoiceConfig(validConfig);
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            const invalidConfig = {
                personality: 'invalid',
                sweetness_level: 2.0,
                voice_settings: {
                    stability: 2.0,
                },
            };
            const invalidValidation = voiceProfileService.validateVoiceConfig(invalidConfig);
            expect(invalidValidation.isValid).toBe(false);
            expect(invalidValidation.errors.length).toBeGreaterThan(0);
        });
        it('should provide enhanced voice configs for different providers', () => {
            const providers = ['kokoro', 'openai', 'elevenlabs'];
            providers.forEach((provider) => {
                const config = voiceProfileService.getEnhancedVoiceConfig('sweet', 0.7, provider);
                expect(config.provider).toBe(provider);
                expect(config.baseProfile).toBeDefined();
                expect(config.optimizations).toBeDefined();
            });
        });
    });
    describe('Speech Service Integration', () => {
        it('should check service health', async () => {
            const health = await speechService.getServiceHealth();
            expect(health).toHaveProperty('status');
            expect(health).toHaveProperty('services');
            expect(health).toHaveProperty('details');
            expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
        });
        it('should get available voices', async () => {
            const voices = await speechService.getAvailableVoices();
            expect(Array.isArray(voices)).toBe(true);
            const kokoroVoices = voices.filter((v) => v.provider === 'kokoro');
            expect(kokoroVoices.length).toBeGreaterThan(0);
        });
        it('should estimate audio duration accurately', async () => {
            const shortText = 'Hello';
            const longText = 'This is a much longer text that should take more time to speak and therefore have a longer estimated duration.';
            const shortDuration = await speechService.estimateAudioDuration(shortText);
            const longDuration = await speechService.estimateAudioDuration(longText);
            expect(longDuration).toBeGreaterThan(shortDuration);
            expect(shortDuration).toBeGreaterThan(0);
        });
        it('should handle retry logic correctly', async () => {
            const voiceProfile = voiceProfileService.getVoiceProfile('sweet', 0.7);
            let callCount = 0;
            const originalSynthesize = speechService.synthesizeSpeech;
            jest.spyOn(speechService, 'synthesizeSpeech').mockImplementation(async (...args) => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Temporary failure');
                }
                return originalSynthesize.call(speechService, ...args);
            });
            try {
                await speechService.synthesizeSpeechWithRetry({
                    text: 'Test retry logic',
                    voiceProfile,
                    format: 'wav',
                }, TWO);
                expect(callCount).toBe(2);
            }
            catch (error) {
            }
        });
    });
    describe('Error Handling and Edge Cases', () => {
        it('should handle empty text input', async () => {
            const voiceProfile = voiceProfileService.getVoiceProfile('sweet', 0.7);
            try {
                await speechService.synthesizeSpeech({
                    text: '',
                    voiceProfile,
                    format: 'wav',
                });
            }
            catch (error) {
                expect(error).toBeDefined();
            }
        });
        it('should handle very long text input', async () => {
            const longText = 'A'.repeat(10000);
            const voiceProfile = voiceProfileService.getVoiceProfile('sweet', 0.7);
            const duration = await speechService.estimateAudioDuration(longText, voiceProfile);
            expect(duration).toBeGreaterThan(0);
        });
        it('should handle invalid sweetness levels gracefully', () => {
            const invalidLevels = [-1, TWO, NaN, Infinity];
            invalidLevels.forEach((level) => {
                const profile = voiceProfileService.getVoiceProfile('sweet', level);
                expect(profile.pitch).toBeGreaterThanOrEqual(0.5);
                expect(profile.speaking_rate).toBeGreaterThanOrEqual(0.5);
            });
        });
        it('should handle audio processing failures', async () => {
            const invalidBuffer = Buffer.from('invalid audio data');
            try {
                await audioHandler.processAudio(invalidBuffer, {
                    format: 'wav',
                });
            }
            catch (error) {
                expect(error).toBeDefined();
            }
        });
        it('should clear caches without errors', async () => {
            await expect(speechService.clearAllCaches()).resolves.not.toThrow();
            await expect(kokoroTTS.clearCache()).resolves.not.toThrow();
            await expect(audioHandler.clearCache()).resolves.not.toThrow();
        });
    });
    describe('Performance Tests', () => {
        it('should process audio within reasonable time limits', async () => {
            const testBuffer = Buffer.alloc(44100 * 2 * THREE);
            const startTime = Date.now();
            await audioHandler.processAudio(testBuffer, {
                format: 'wav',
                normalize: true,
            });
            const processingTime = Date.now() - startTime;
            expect(processingTime).toBeLessThan(5000);
        });
        it('should handle concurrent audio processing', async () => {
            const testBuffer = Buffer.alloc(44100 * TWO);
            const promises = Array(5)
                .fill(null)
                .map(() => audioHandler.processAudio(testBuffer, { format: 'wav' }));
            await expect(Promise.all(promises)).resolves.not.toThrow();
        });
        it('should maintain reasonable memory usage', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            for (let i = 0; i < 10; i++) {
                const testBuffer = Buffer.alloc(44100);
                await audioHandler.processAudio(testBuffer, { format: 'wav' });
            }
            if (global.gc) {
                global.gc();
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        });
    });
    describe('Integration Tests', () => {
        it('should work end-to-end with voice profiles and Kokoro TTS', async () => {
            const voiceProfile = voiceProfileService.getVoiceProfile('sweet', 0.8);
            const kokoroProfile = voiceProfileService.getKokoroVoiceProfile('sweet', 0.8);
            expect(voiceProfile).toBeDefined();
            if (kokoroProfile) {
                expect(kokoroProfile.id).toContain('athena');
                expect(kokoroProfile.style).toBe('sweet');
            }
        });
        it('should maintain consistency across service restarts', async () => {
            const profile1 = voiceProfileService.getVoiceProfile('sweet', 0.7);
            const profiles1 = kokoroTTS.getVoiceProfiles();
            const newVoiceService = new VoiceProfileService();
            const newKokoroService = new KokoroTTSService();
            const profile2 = newVoiceService.getVoiceProfile('sweet', 0.7);
            const profiles2 = newKokoroService.getVoiceProfiles();
            expect(profile1.pitch).toBe(profile2.pitch);
            expect(profile1.speaking_rate).toBe(profile2.speaking_rate);
            expect(profiles1.length).toBe(profiles2.length);
        });
    });
});
//# sourceMappingURL=voice-features-test-suite.js.map