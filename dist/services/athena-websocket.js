export class AthenaWebSocketService {
    startHeartbeat() {
    }
    startStatusUpdates() {
    }
    shutdown() {
    }
    handleConnection(ws, req) {
    }
}
export const athenaWebSocket = new AthenaWebSocketService();
export function handleAthenaWebSocket(ws, req) {
    athenaWebSocket.handleConnection(ws, req);
}
//# sourceMappingURL=athena-websocket.js.map