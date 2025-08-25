/**
 * Browser Scraping Bridge Service
 * Coordinates between backend scraping requests and Electron browser windows
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { LogContext, log } from '../utils/logger';

interface ScrapingSession {
  id: string;
  url: string;
  windowId?: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: any;
}

export class BrowserScrapingBridge extends EventEmitter {
  private wsServer: WebSocketServer | null = null;
  private electronClient: WebSocket | null = null;
  private sessions: Map<string, ScrapingSession> = new Map();
  private isElectronConnected = false;

  constructor() {
    super();
    this.initializeWebSocket();
  }

  /**
   * Initialize WebSocket server for Electron communication
   */
  private initializeWebSocket(): void {
    try {
      this.wsServer = new WebSocketServer({ 
        port: 9998,
        host: 'localhost'
      });

      this.wsServer.on('connection', (ws: WebSocket) => {
        log.info('🌐 Electron client connected for browser scraping', LogContext.SERVICE);
        this.electronClient = ws;
        this.isElectronConnected = true;

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleElectronMessage(message);
          } catch (error) {
            log.error('Failed to parse Electron message', LogContext.SERVICE, { error });
          }
        });

        ws.on('close', () => {
          log.info('🔌 Electron client disconnected', LogContext.SERVICE);
          this.electronClient = null;
          this.isElectronConnected = false;
        });

        ws.on('error', (error) => {
          log.error('WebSocket error', LogContext.SERVICE, { error });
        });

        // Send pending scraping sessions
        this.sessions.forEach(session => {
          if (session.status === 'pending') {
            this.sendToElectron('open-browser', {
              sessionId: session.id,
              url: session.url
            });
          }
        });
      });

      log.info('🚀 Browser scraping bridge WebSocket server started on port 9998', LogContext.SERVICE);
    } catch (error) {
      log.error('Failed to initialize WebSocket server', LogContext.SERVICE, { error });
    }
  }

  /**
   * Handle messages from Electron
   */
  private handleElectronMessage(message: any): void {
    const { type, sessionId, data } = message;

    switch (type) {
      case 'browser-opened':
        this.handleBrowserOpened(sessionId, data.windowId);
        break;
      case 'scraping-complete':
        this.handleScrapingComplete(sessionId, data);
        break;
      case 'scraping-error':
        this.handleScrapingError(sessionId, data.error);
        break;
      default:
        log.warn('Unknown message type from Electron', LogContext.SERVICE, { type });
    }
  }

  /**
   * Send message to Electron
   */
  private sendToElectron(type: string, data: any): void {
    if (this.electronClient && this.electronClient.readyState === WebSocket.OPEN) {
      this.electronClient.send(JSON.stringify({ type, ...data }));
    } else {
      log.warn('Electron client not connected', LogContext.SERVICE);
    }
  }

  /**
   * Start a browser scraping session
   */
  public async startScrapingSession(url: string): Promise<string> {
    const sessionId = `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ScrapingSession = {
      id: sessionId,
      url,
      status: 'pending',
      startTime: new Date()
    };

    this.sessions.set(sessionId, session);

    log.info('🔍 Starting browser scraping session', LogContext.SERVICE, {
      sessionId,
      url,
      electronConnected: this.isElectronConnected
    });

    if (this.isElectronConnected) {
      // Send request to Electron to open browser
      this.sendToElectron('open-browser', {
        sessionId,
        url
      });
    } else {
      log.warn('Electron not connected, queuing scraping session', LogContext.SERVICE, { sessionId });
    }

    return sessionId;
  }

  /**
   * Handle browser opened event
   */
  private handleBrowserOpened(sessionId: string, windowId: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.windowId = windowId;
      session.status = 'active';
      log.info('🪟 Browser window opened for scraping', LogContext.SERVICE, {
        sessionId,
        windowId
      });
      this.emit('browser-opened', { sessionId, windowId });
    }
  }

  /**
   * Handle scraping complete
   */
  private handleScrapingComplete(sessionId: string, data: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = new Date();
      session.result = data;

      log.info('✅ Scraping completed', LogContext.SERVICE, {
        sessionId,
        duration: session.endTime.getTime() - session.startTime.getTime()
      });

      this.emit('scraping-complete', { sessionId, result: data });

      // Close the browser window
      if (session.windowId) {
        this.sendToElectron('close-browser', {
          sessionId,
          windowId: session.windowId
        });
      }
    }
  }

  /**
   * Handle scraping error
   */
  private handleScrapingError(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.endTime = new Date();

      log.error('❌ Scraping failed', LogContext.SERVICE, {
        sessionId,
        error
      });

      this.emit('scraping-error', { sessionId, error });

      // Close the browser window
      if (session.windowId) {
        this.sendToElectron('close-browser', {
          sessionId,
          windowId: session.windowId
        });
      }
    }
  }

  /**
   * Execute JavaScript in scraping browser
   */
  public async executeInBrowser(sessionId: string, code: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.windowId) {
      throw new Error('Invalid or inactive scraping session');
    }

    return new Promise((resolve, reject) => {
      const requestId = `exec_${Date.now()}`;

      const timeout = setTimeout(() => {
        reject(new Error('Script execution timeout'));
      }, 30000);

      const handler = (message: any) => {
        if (message.type === 'execute-result' && message.requestId === requestId) {
          clearTimeout(timeout);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        }
      };

      if (this.electronClient) {
        this.electronClient.once('message', (data) => {
          const message = JSON.parse(data.toString());
          handler(message);
        });
      }

      this.sendToElectron('execute-script', {
        sessionId,
        windowId: session.windowId,
        code,
        requestId
      });
    });
  }

  /**
   * Complete scraping session manually
   */
  public async completeScrapingSession(sessionId: string, data?: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.windowId) {
      this.handleScrapingComplete(sessionId, data || {});
    }
  }

  /**
   * Get session status
   */
  public getSessionStatus(sessionId: string): ScrapingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): ScrapingSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * Check if Electron is connected
   */
  public isConnected(): boolean {
    return this.isElectronConnected;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.wsServer) {
      this.wsServer.close();
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const browserScrapingBridge = new BrowserScrapingBridge();