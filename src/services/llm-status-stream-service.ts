/**
 * LLM Status Stream Service
 * Provides real-time status updates for LLM processing
 */

type StatusType = 'thinking' | 'generating' | 'retrieving' | 'analyzing' | 'reasoning' | 'searching' | 'connecting' | 'completed';

class LLMStatusStreamService {
  private activeStreams: Map<string, any> = new Map();

  /**
   * Start a new status stream for a session
   */
  startStream(sessionId: string): void {
    this.activeStreams.set(sessionId, {
      sessionId,
      startTime: Date.now(),
      statuses: []
    });
    console.log(`🔄 Started status stream for session: ${sessionId}`);
  }

  /**
   * Send a status update for a session
   */
  sendStatus(sessionId: string, status: StatusType, message: string): void {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      const statusUpdate = {
        status,
        message,
        timestamp: Date.now()
      };
      stream.statuses.push(statusUpdate);
      console.log(`📡 Status [${sessionId}]: ${status} - ${message}`);
    }
  }

  /**
   * Complete a status stream
   */
  completeStream(sessionId: string, finalMessage: string): void {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      stream.completed = true;
      stream.finalMessage = finalMessage;
      stream.endTime = Date.now();
      stream.duration = stream.endTime - stream.startTime;
      console.log(`✅ Completed status stream for session: ${sessionId} (${stream.duration}ms)`);
      
      // Clean up after a delay
      setTimeout(() => {
        this.activeStreams.delete(sessionId);
      }, 5000);
    }
  }

  /**
   * Get current status for a session
   */
  getStatus(sessionId: string): any {
    return this.activeStreams.get(sessionId) || null;
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }
}

export const llmStatusStream = new LLMStatusStreamService();