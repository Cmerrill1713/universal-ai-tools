import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import { log, LogContext } from '@/utils/logger';
export class DeviceAuthWebSocketService {
    wss = null;
    clients = new Map();
    heartbeatInterval = null;
    initialize(server, path = '/ws/device-auth') {
        this.wss = new WebSocketServer({
            server,
            path,
            verifyClient: this.verifyClient.bind(this),
        });
        this.wss.on('connection', this.handleConnection.bind(this));
        this.startHeartbeat();
        log.info('Device Auth WebSocket server initialized', LogContext.WEBSOCKET, {
            path,
        });
    }
    async verifyClient(info, callback) {
        try {
            const authHeader = info.req.headers.authorization;
            if (!authHeader) {
                callback(false, 401, 'Unauthorized');
                return;
            }
            const token = authHeader.replace('Bearer ', '');
            const jwtSecret = process.env.JWT_SECRET || '';
            if (!jwtSecret) {
                callback(false, 500, 'Server auth misconfiguration');
                return;
            }
            const decoded = jwt.verify(token, jwtSecret);
            info.req.userId = decoded.userId;
            info.req.deviceId = decoded.deviceId;
            callback(true);
        }
        catch (error) {
            log.error('WebSocket authentication failed', LogContext.WEBSOCKET, {
                error: error instanceof Error ? error.message : String(error),
            });
            callback(false, 401, 'Invalid token');
        }
    }
    handleConnection(ws, req) {
        const { userId } = req;
        const { deviceId } = req;
        const clientId = uuidv4();
        const client = {
            id: clientId,
            userId,
            deviceId,
            ws,
            isAlive: true,
            subscriptions: new Set([`user:${userId}`]),
        };
        if (deviceId) {
            client.subscriptions.add(`device:${deviceId}`);
        }
        this.clients.set(clientId, client);
        log.info('WebSocket client connected', LogContext.WEBSOCKET, {
            clientId,
            userId,
            deviceId,
        });
        ws.on('message', (data) => this.handleMessage(clientId, data));
        ws.on('pong', () => this.handlePong(clientId));
        ws.on('close', () => this.handleDisconnect(clientId));
        ws.on('error', (error) => this.handleError(clientId, error));
        this.sendToClient(clientId, {
            type: 'welcome',
            data: {
                clientId,
                userId,
                deviceId,
                timestamp: new Date().toISOString(),
            },
        });
    }
    handleMessage(clientId, data) {
        try {
            const client = this.clients.get(clientId);
            if (!client)
                return;
            const message = JSON.parse(data.toString());
            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(clientId, message.channels);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(clientId, message.channels);
                    break;
                case 'proximity_update':
                    this.handleProximityUpdate(clientId, message.data);
                    break;
                case 'ping':
                    this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
                    break;
                default:
                    log.warn('Unknown WebSocket message type', LogContext.WEBSOCKET, {
                        type: message.type,
                        clientId,
                    });
            }
        }
        catch (error) {
            log.error('Failed to handle WebSocket message', LogContext.WEBSOCKET, {
                error: error instanceof Error ? error.message : String(error),
                clientId,
            });
        }
    }
    handleSubscribe(clientId, channels) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        channels.forEach((channel) => {
            if (this.canSubscribe(client, channel)) {
                client.subscriptions.add(channel);
            }
        });
        this.sendToClient(clientId, {
            type: 'subscribed',
            data: {
                channels: Array.from(client.subscriptions),
            },
        });
    }
    handleUnsubscribe(clientId, channels) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        channels.forEach((channel) => {
            client.subscriptions.delete(channel);
        });
        this.sendToClient(clientId, {
            type: 'unsubscribed',
            data: {
                channels: Array.from(client.subscriptions),
            },
        });
    }
    handleProximityUpdate(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client || !client.deviceId)
            return;
        this.broadcastAuthEvent({
            type: 'proximity_changed',
            deviceId: client.deviceId,
            userId: client.userId,
            timestamp: new Date().toISOString(),
            data: {
                rssi: data.rssi,
                proximity: data.proximity,
                locked: data.locked,
            },
        });
        if (data.proximity === 'far' || data.proximity === 'unknown') {
            this.broadcastAuthEvent({
                type: 'screen_locked',
                deviceId: client.deviceId,
                userId: client.userId,
                timestamp: new Date().toISOString(),
                data: {
                    reason: 'proximity',
                    proximity: data.proximity,
                },
            });
        }
        else if (data.proximity === 'immediate') {
            this.broadcastAuthEvent({
                type: 'screen_unlocked',
                deviceId: client.deviceId,
                userId: client.userId,
                timestamp: new Date().toISOString(),
                data: {
                    reason: 'proximity',
                    proximity: data.proximity,
                },
            });
        }
    }
    canSubscribe(client, channel) {
        if (channel.startsWith('user:')) {
            return channel === `user:${client.userId}`;
        }
        if (channel.startsWith('device:') && client.deviceId) {
            return channel === `device:${client.deviceId}`;
        }
        if (channel === 'global') {
            return true;
        }
        return false;
    }
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    broadcastAuthEvent(event) {
        const channels = new Set();
        channels.add(`user:${event.userId}`);
        if (event.deviceId) {
            channels.add(`device:${event.deviceId}`);
        }
        this.clients.forEach((client) => {
            const hasSubscription = Array.from(channels).some((channel) => client.subscriptions.has(channel));
            if (hasSubscription && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                    type: 'auth_event',
                    event,
                }));
            }
        });
        log.info('Broadcasted auth event', LogContext.WEBSOCKET, {
            eventType: event.type,
            userId: event.userId,
            deviceId: event.deviceId,
            recipientCount: Array.from(this.clients.values()).filter((c) => Array.from(channels).some((ch) => c.subscriptions.has(ch))).length,
        });
    }
    handlePong(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.isAlive = true;
        }
    }
    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            log.info('WebSocket client disconnected', LogContext.WEBSOCKET, {
                clientId,
                userId: client.userId,
                deviceId: client.deviceId,
            });
            if (client.deviceId) {
                this.broadcastAuthEvent({
                    type: 'device_removed',
                    deviceId: client.deviceId,
                    userId: client.userId,
                    timestamp: new Date().toISOString(),
                    data: {
                        reason: 'disconnected',
                    },
                });
            }
            this.clients.delete(clientId);
        }
    }
    handleError(clientId, error) {
        log.error('WebSocket error', LogContext.WEBSOCKET, {
            clientId,
            error: error.message,
        });
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.clients.forEach((client, clientId) => {
                if (!client.isAlive) {
                    client.ws.terminate();
                    this.handleDisconnect(clientId);
                    return;
                }
                client.isAlive = false;
                client.ws.ping();
            });
        }, 30000);
    }
    shutdown() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.wss) {
            this.clients.forEach((client) => {
                client.ws.close(1000, 'Server shutting down');
            });
            this.wss.close();
            this.wss = null;
        }
        this.clients.clear();
        log.info('Device Auth WebSocket service shutdown', LogContext.WEBSOCKET);
    }
    getConnectionCount() {
        return this.clients.size;
    }
    getUserDevices(userId) {
        const devices = [];
        this.clients.forEach((client) => {
            if (client.userId === userId && client.deviceId) {
                devices.push(client.deviceId);
            }
        });
        return devices;
    }
}
export const deviceAuthWebSocket = new DeviceAuthWebSocketService();
//# sourceMappingURL=device-auth-websocket.js.map