import { EventEmitter } from 'events';
export interface DSPyRequest {
    requestId: string;
    method: string;
    params: unknown;
    metadata?: unknown;
}
export interface DSPyResponse {
    requestId: string;
    success: boolean;
    data: unknown;
    error?: string;
    metadata?: unknown;
}
export declare class DSPyBridge extends EventEmitter {
    private ws;
    private pythonProcess;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private isConnected;
    private port;
    constructor();
    private startPythonService;
    private connectWebSocket;
    private attemptReconnect;
    sendRequest(request: DSPyRequest): Promise<DSPyResponse>;
    isReady(): boolean;
    shutdown(): Promise<void>;
}
export declare const dspyBridge: DSPyBridge;
export default dspyBridge;
//# sourceMappingURL=bridge.d.ts.map