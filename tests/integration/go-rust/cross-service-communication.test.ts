/**
 * Cross-Service Communication Integration Tests
 * Tests communication between Go, Rust, and Node.js services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/test'
import WebSocket from 'ws'
import fetch from 'node-fetch'

interface ServiceHealth {
  status: string
  service: string
  timestamp: string
  dependencies?: Record<string, string>
}

interface FFITestResult {
  success: boolean
  data?: string
  error?: string
  metrics?: {
    calls_total: number
    bytes_transferred: number
    errors_total: number
  }
}

interface MLInferenceRequest {
  model_id: string
  input: {
    text?: string
    image_data?: string
  }
  parameters?: Record<string, any>
}

interface MLInferenceResponse {
  success: boolean
  result?: any
  latency_ms: number
  model_version: string
  processing_time: number
}

describe('Cross-Service Communication Tests', () => {
  const services = {
    nodeBekend: 'http://localhost:9999',
    messageBroker: 'http://localhost:8080',
    loadBalancer: 'http://localhost:8081',
    cacheCoordinator: 'http://localhost:8083',
    streamProcessor: 'http://localhost:8084',
    goMLInference: 'http://localhost:8086',
    rustMLInference: 'http://localhost:8087',
    sharedMemory: 'http://localhost:8089',
    tracingService: 'http://localhost:8090',
    metricsAggregator: 'http://localhost:8091',
    rustParameterAnalytics: 'http://localhost:8092',
    rustABMCTS: 'http://localhost:8093'
  }

  const wsConnections: WebSocket[] = []

  beforeAll(async () => {
    // Wait for all services to be ready
    console.log('🔄 Waiting for services to start...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Verify all services are healthy
    for (const [name, url] of Object.entries(services)) {
      try {
        const response = await fetch(`${url}/health`, { timeout: 5000 })
        expect(response.ok).toBe(true)
        console.log(`✅ ${name} is healthy`)
      } catch (error) {
        console.warn(`⚠️  ${name} is not available: ${error.message}`)
      }
    }
  })

  afterAll(async () => {
    // Clean up WebSocket connections
    wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })
  })

  describe('Health Check Integration', () => {
    test('All services report healthy status', async () => {
      const healthChecks = await Promise.allSettled(
        Object.entries(services).map(async ([name, url]) => {
          const response = await fetch(`${url}/health`)
          const health: ServiceHealth = await response.json()
          return { name, health }
        })
      )

      const healthyServices = healthChecks
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)

      expect(healthyServices.length).toBeGreaterThan(8) // At least core services
      
      healthyServices.forEach(({ name, health }) => {
        expect(health.status).toBe('healthy')
        console.log(`✅ ${name}: ${health.status}`)
      })
    })

    test('Services have proper dependency health checks', async () => {
      const response = await fetch(`${services.nodeBekend}/api/v1/health`)
      const health: ServiceHealth = await response.json()
      
      expect(health.status).toBe('healthy')
      expect(health.dependencies).toBeDefined()
      
      // Should include key dependencies
      expect(health.dependencies).toHaveProperty('database')
      expect(health.dependencies).toHaveProperty('redis')
    })
  })

  describe('Message Broker Integration', () => {
    test('WebSocket connection establishment', (done) => {
      const ws = new WebSocket(`ws://localhost:8080/ws/test_service`)
      wsConnections.push(ws)

      ws.on('open', () => {
        console.log('✅ WebSocket connected to message broker')
        done()
      })

      ws.on('error', (error) => {
        done(error)
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          done(new Error('WebSocket connection timeout'))
        }
      }, 10000)
    })

    test('Message routing between services', (done) => {
      const ws = new WebSocket(`ws://localhost:8080/ws/test_service`)
      wsConnections.push(ws)

      const testMessage = {
        id: `test-${Date.now()}`,
        type: 'request',
        source: 'test_service',
        destination: 'node_backend',
        timestamp: new Date().toISOString(),
        payload: JSON.stringify({ action: 'ping' })
      }

      ws.on('open', () => {
        ws.send(JSON.stringify(testMessage))
      })

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString())
        expect(response.type).toBeDefined()
        console.log('✅ Message routing successful:', response.type)
        done()
      })

      ws.on('error', done)

      // Timeout after 15 seconds
      setTimeout(() => done(new Error('Message routing timeout')), 15000)
    })

    test('NATS message persistence', async () => {
      const publishResponse = await fetch(`${services.messageBroker}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `test-persist-${Date.now()}`,
          type: 'broadcast',
          source: 'test_service',
          timestamp: new Date().toISOString(),
          payload: JSON.stringify({ data: 'persistence test' })
        })
      })

      expect(publishResponse.ok).toBe(true)
      const result = await publishResponse.json()
      expect(result.status).toBe('published')
      console.log('✅ NATS message published successfully')
    })
  })

  describe('FFI Bridge Integration', () => {
    test('Rust-Go FFI bridge initialization', async () => {
      const response = await fetch(`${services.sharedMemory}/api/v1/ipc/init`, {
        method: 'POST'
      })
      
      expect(response.ok).toBe(true)
      const result: FFITestResult = await response.json()
      expect(result.success).toBe(true)
      console.log('✅ FFI bridge initialized')
    })

    test('Zero-copy data transfer via shared memory', async () => {
      const testData = Buffer.from('Hello from Node.js!', 'utf8')
      
      // Create shared buffer
      const createResponse = await fetch(`${services.sharedMemory}/api/v1/ipc/buffer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test_buffer',
          size: 1024
        })
      })
      
      expect(createResponse.ok).toBe(true)

      // Write data to buffer
      const writeResponse = await fetch(`${services.sharedMemory}/api/v1/ipc/buffer/test_buffer`, {
        method: 'PUT',
        body: testData
      })
      
      expect(writeResponse.ok).toBe(true)

      // Read data back
      const readResponse = await fetch(`${services.sharedMemory}/api/v1/ipc/buffer/test_buffer`)
      const readData = await readResponse.text()
      
      expect(readData).toBe('Hello from Node.js!')
      console.log('✅ Zero-copy data transfer successful')
    })

    test('FFI function calls with metrics', async () => {
      const response = await fetch(`${services.sharedMemory}/api/v1/ipc/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'echo',
          data: 'FFI test data'
        })
      })

      expect(response.ok).toBe(true)
      const result: FFITestResult = await response.json()
      
      expect(result.success).toBe(true)
      expect(result.data).toBe('FFI test data')
      console.log('✅ FFI function call successful')

      // Check metrics
      const metricsResponse = await fetch(`${services.sharedMemory}/api/v1/ipc/metrics`)
      const metrics = await metricsResponse.json()
      
      expect(metrics.calls_total).toBeGreaterThan(0)
      console.log(`✅ FFI metrics: ${metrics.calls_total} calls`)
    })
  })

  describe('ML Inference Service Integration', () => {
    test('Go ML inference service', async () => {
      const request: MLInferenceRequest = {
        model_id: 'test-model',
        input: { text: 'Test inference with Go service' },
        parameters: { temperature: 0.7, max_tokens: 100 }
      }

      const response = await fetch(`${services.goMLInference}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      expect(response.ok).toBe(true)
      const result: MLInferenceResponse = await response.json()
      
      expect(result.success).toBe(true)
      expect(result.latency_ms).toBeGreaterThan(0)
      expect(result.model_version).toBeDefined()
      console.log(`✅ Go ML inference: ${result.latency_ms}ms latency`)
    })

    test('Rust ML inference service', async () => {
      const request: MLInferenceRequest = {
        model_id: 'candle-model',
        input: { text: 'Test inference with Rust service' },
        parameters: { temperature: 0.5, max_length: 50 }
      }

      const response = await fetch(`${services.rustMLInference}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      expect(response.ok).toBe(true)
      const result: MLInferenceResponse = await response.json()
      
      expect(result.success).toBe(true)
      expect(result.processing_time).toBeGreaterThan(0)
      console.log(`✅ Rust ML inference: ${result.processing_time}ms processing`)
    })

    test('Load balancing between ML services', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        model_id: 'load-test',
        input: { text: `Load test request ${i}` }
      }))

      const responses = await Promise.allSettled(
        requests.map(req => 
          fetch(`${services.loadBalancer}/api/v1/ml/infer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
          })
        )
      )

      const successfulRequests = responses.filter(
        result => result.status === 'fulfilled' && result.value.ok
      )

      expect(successfulRequests.length).toBeGreaterThan(5) // At least 50% success
      console.log(`✅ Load balancing: ${successfulRequests.length}/10 requests successful`)
    })
  })

  describe('Cache Coordination', () => {
    test('Multi-tier cache operations', async () => {
      const key = `test-cache-${Date.now()}`
      const value = { data: 'cached test data', timestamp: Date.now() }

      // Set value in cache
      const setResponse = await fetch(`${services.cacheCoordinator}/cache/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
      })

      expect(setResponse.ok).toBe(true)

      // Get value from cache
      const getResponse = await fetch(`${services.cacheCoordinator}/cache/${key}`)
      expect(getResponse.ok).toBe(true)
      
      const cachedValue = await getResponse.json()
      expect(cachedValue.data).toBe(value.data)
      console.log('✅ Cache coordination successful')

      // Test cache invalidation
      const deleteResponse = await fetch(`${services.cacheCoordinator}/cache/${key}`, {
        method: 'DELETE'
      })
      expect(deleteResponse.ok).toBe(true)
    })

    test('Cache performance and hit rates', async () => {
      const statsResponse = await fetch(`${services.cacheCoordinator}/stats`)
      expect(statsResponse.ok).toBe(true)
      
      const stats = await statsResponse.json()
      expect(stats).toHaveProperty('hit_rate')
      expect(stats).toHaveProperty('local_cache_size')
      expect(stats).toHaveProperty('redis_connections')
      console.log(`✅ Cache stats: ${stats.hit_rate}% hit rate`)
    })
  })

  describe('Stream Processing', () => {
    test('Real-time data streaming', (done) => {
      const ws = new WebSocket(`ws://localhost:8084/stream`)
      wsConnections.push(ws)

      const testEvents = [
        { type: 'data_point', value: 42, timestamp: Date.now() },
        { type: 'metric_update', metric: 'cpu_usage', value: 75.5 },
        { type: 'alert', level: 'info', message: 'Test alert' }
      ]

      let receivedEvents = 0

      ws.on('open', () => {
        console.log('✅ Stream processor WebSocket connected')
        
        // Send test events
        testEvents.forEach((event, index) => {
          setTimeout(() => ws.send(JSON.stringify(event)), index * 100)
        })
      })

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString())
        receivedEvents++
        
        console.log(`📡 Received streamed event: ${event.type}`)
        
        if (receivedEvents >= testEvents.length) {
          done()
        }
      })

      ws.on('error', done)

      // Timeout after 20 seconds
      setTimeout(() => {
        if (receivedEvents < testEvents.length) {
          done(new Error(`Stream processing timeout: ${receivedEvents}/${testEvents.length} events received`))
        }
      }, 20000)
    })

    test('ML stream processing pipeline', async () => {
      const streamData = {
        model_inputs: [
          { text: 'Stream input 1', priority: 'high' },
          { text: 'Stream input 2', priority: 'normal' },
          { text: 'Stream input 3', priority: 'low' }
        ]
      }

      const response = await fetch(`${services.streamProcessor}/ml/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamData)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      
      expect(result.processed_count).toBe(3)
      expect(result.batch_id).toBeDefined()
      console.log(`✅ ML stream processing: ${result.processed_count} items`)
    })
  })

  describe('Distributed Tracing', () => {
    test('Trace propagation across services', async () => {
      const traceId = `trace-${Date.now()}`
      
      const response = await fetch(`${services.nodeBekend}/api/v1/test/trace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': traceId
        },
        body: JSON.stringify({ 
          test_operation: 'cross_service_trace',
          services_to_call: ['go-ml-inference', 'rust-parameter-analytics']
        })
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.trace_id).toBe(traceId)

      // Wait for trace to be processed
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Query tracing service for the trace
      const traceResponse = await fetch(`${services.tracingService}/api/v1/tracing/trace/${traceId}`)
      expect(traceResponse.ok).toBe(true)
      
      const trace = await traceResponse.json()
      expect(trace.spans.length).toBeGreaterThan(2) // At least 3 services involved
      console.log(`✅ Distributed tracing: ${trace.spans.length} spans recorded`)
    })
  })

  describe('Metrics Aggregation', () => {
    test('Cross-service metrics collection', async () => {
      const response = await fetch(`${services.metricsAggregator}/metrics`)
      expect(response.ok).toBe(true)
      
      const metrics = await response.text()
      
      // Should contain metrics from various services
      expect(metrics).toContain('message_broker_messages_received_total')
      expect(metrics).toContain('cache_coordinator_requests_total')
      expect(metrics).toContain('ml_inference_requests_total')
      expect(metrics).toContain('stream_processor_events_processed_total')
      
      console.log('✅ Cross-service metrics aggregation working')
    })

    test('Service discovery and registration', async () => {
      const response = await fetch(`${services.metricsAggregator}/discovery/services`)
      expect(response.ok).toBe(true)
      
      const services_discovered = await response.json()
      expect(services_discovered.length).toBeGreaterThan(5)
      
      const serviceNames = services_discovered.map((s: any) => s.name)
      expect(serviceNames).toContain('go-message-broker')
      expect(serviceNames).toContain('rust-ml-inference')
      expect(serviceNames).toContain('node-backend')
      
      console.log(`✅ Service discovery: ${services_discovered.length} services registered`)
    })
  })

  describe('End-to-End Workflow', () => {
    test('Complete AI inference workflow', async () => {
      const workflowRequest = {
        task_id: `workflow-${Date.now()}`,
        pipeline: [
          { service: 'parameter-analytics', action: 'optimize_params' },
          { service: 'ml-inference', action: 'infer', model: 'llama3.2:3b' },
          { service: 'ab-mcts', action: 'evaluate_result' }
        ],
        input: {
          text: 'Complete end-to-end AI inference test',
          optimization_target: 'accuracy'
        }
      }

      const response = await fetch(`${services.nodeBekend}/api/v1/workflow/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      
      expect(result.task_id).toBe(workflowRequest.task_id)
      expect(result.status).toBe('completed')
      expect(result.pipeline_results).toHaveLength(3)
      
      console.log(`✅ End-to-end workflow: ${result.total_time_ms}ms total time`)
    })
  })
})