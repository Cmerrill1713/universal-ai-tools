import type { Server } from 'http';
interface AuthEvent {
    type: 'device_registered' | 'device_removed' | 'auth_state_changed' | 'proximity_changed' | 'screen_locked' | 'screen_unlocked';
    deviceId: string;
    userId: string;
    timestamp: string;
    data: any;
}
export declare class DeviceAuthWebSocketService {
    private wss;
    private clients;
    private heartbeatInterval;
    initialize(server: Server, path?: string): void;
    private verifyClient;
    private handleConnection;
    private handleMessage;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleProximityUpdate;
    private canSubscribe;
    private sendToClient;
    broadcastAuthEvent(event: AuthEvent): void;
    private handlePong;
    private handleDisconnect;
    private handleError;
    private startHeartbeat;
    shutdown(): void;
    getConnectionCount(): number;
    getUserDevices(userId: string): string[];
}
export declare const deviceAuthWebSocket: DeviceAuthWebSocketService;
export {};
//# sourceMappingURL=device-auth-websocket.d.ts.map