export declare class AthenaWebSocketService {
    startHeartbeat(): void;
    startStatusUpdates(): void;
    shutdown(): void;
    handleConnection(ws: any, req: any): void;
}
export declare const athenaWebSocket: AthenaWebSocketService;
export declare function handleAthenaWebSocket(ws: any, req: any): void;
//# sourceMappingURL=athena-websocket.d.ts.map