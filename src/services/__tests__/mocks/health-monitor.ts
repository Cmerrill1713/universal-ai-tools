/**
 * Mock HealthMonitor for testing
 */

export class HealthMonitor {
  private metrics = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
      responseTimes: [] as number[]
    }
  };

  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        }
      },
      uptime: process.uptime()
    };
  }

  async checkServices() {
    return {
      database: 'healthy',
      redis: 'healthy',
      ollama: 'healthy'
    };
  }

  recordRequest(path: string, method: string, statusCode: number, responseTime: number) {
    this.metrics.requests.total++;
    
    if (statusCode >= 200 && statusCode < 300) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    this.metrics.requests.responseTimes.push(responseTime);
  }

  getMetrics() {
    const {responseTimes} = this.metrics.requests;
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      requests: {
        total: this.metrics.requests.total,
        successful: this.metrics.requests.successful,
        failed: this.metrics.requests.failed,
        avgResponseTime
      }
    };
  }
}