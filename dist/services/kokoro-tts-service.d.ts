export interface TTSRequest {
    text: string;
    voice: string;
    speed?: number;
    outputFormat?: 'wav' | 'mp3';
    outputPath?: string;
}
export interface TTSResponse {
    audioPath: string;
    duration: number;
    voice: string;
    executionTime: number;
    fileSize: number;
}
export interface VoiceInfo {
    id: string;
    name: string;
    gender: 'male' | 'female';
    language: string;
    description: string;
}
export declare class KokoroTTSService {
    private pythonProcess;
    private isInitialized;
    private kokoroPath;
    private availableVoices;
    private outputDirectory;
    constructor();
    private initializeKokoro;
    private loadAvailableVoices;
    private startTTSServer;
    generateSpeech(request: TTSRequest): Promise<TTSResponse>;
    synthesize(request: TTSRequest): Promise<TTSResponse>;
    checkHealth(): {
        status: string;
        isInitialized: boolean;
        voicesCount: number;
    };
    speakAgentResponse(agentName: string, response: string, voicePreference?: string): Promise<TTSResponse>;
    generateBatchSpeech(requests: TTSRequest[]): Promise<TTSResponse[]>;
    startStreamingSpeech(text: string, voice: string, onChunk: (audioChunk: Buffer) => void): Promise<void>;
    private getLanguageFromPrefix;
    private getVoiceDescription;
    private getAgentVoice;
    private optimizeTextForSpeech;
    private splitTextForStreaming;
    private createTTSServerScript;
    private initializeMockTTS;
    private generateMockSpeech;
    getAvailableVoices(): VoiceInfo[];
    isServiceAvailable(): boolean;
    getServiceInfo(): {
        available: boolean;
        voices: number;
        languages: string[];
        outputDirectory: string;
    };
    shutdown(): Promise<void>;
}
export declare const kokoroTTS: KokoroTTSService;
export default kokoroTTS;
//# sourceMappingURL=kokoro-tts-service.d.ts.map