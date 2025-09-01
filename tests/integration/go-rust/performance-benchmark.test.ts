/**
 * Performance Benchmark Tests for Go-Rust Integration
 * Tests throughput, latency, and resource efficiency
 */

import { describe, test, expect, beforeAll } from '@jest/test'
import fetch from 'node-fetch'
import { performance } from 'perf_hooks'

interface BenchmarkResult {
  operation: string
  total_requests: number
  successful_requests: number
  failed_requests: number
  average_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  throughput_rps: number
  memory_usage_mb: number
  cpu_usage_percent: number
}

interface MLBenchmarkRequest {
  model: string
  input_size: number
  batch_size: number
  iterations: number
}

interface ResourceMetrics {
  cpu_percent: number
  memory_mb: number
  network_io_mb: number
  disk_io_mb: number
}

describe('Performance Benchmarks', () => {
  const services = {
    nodeBekend: 'http://localhost:9999',
    messageBroker: 'http://localhost:8080',
    loadBalancer: 'http://localhost:8081',
    cacheCoordinator: 'http://localhost:8083',
    goMLInference: 'http://localhost:8086',
    rustMLInference: 'http://localhost:8087',
    sharedMemory: 'http://localhost:8089',
    rustParameterAnalytics: 'http://localhost:8092'
  }

  beforeAll(async () => {
    console.log('🔄 Warming up services for benchmarks...')
    await new Promise(resolve => setTimeout(resolve, 3000))
  })

  describe('FFI Bridge Performance', () => {
    test('High-frequency FFI calls benchmark', async () => {
      const iterations = 1000
      const payload = 'x'.repeat(1024) // 1KB payload
      const latencies: number[] = []
      let successful = 0

      console.log(`🔬 Running ${iterations} FFI calls...`)

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const callStart = performance.now()
        
        try {
          const response = await fetch(`${services.sharedMemory}/api/v1/ipc/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: 'transform',
              data: payload
            })
          })

          if (response.ok) {
            successful++
          }
          
          const callEnd = performance.now()
          latencies.push(callEnd - callStart)
        } catch (error) {
          console.warn(`FFI call ${i} failed:`, error.message)
        }
      }

      const endTime = performance.now()
      const totalTimeMs = endTime - startTime

      // Calculate statistics
      latencies.sort((a, b) => a - b)
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p95Latency = latencies[Math.floor(latencies.length * 0.95)]
      const p99Latency = latencies[Math.floor(latencies.length * 0.99)]
      const throughput = (successful / totalTimeMs) * 1000

      const result: BenchmarkResult = {
        operation: 'FFI Bridge Calls',
        total_requests: iterations,
        successful_requests: successful,
        failed_requests: iterations - successful,
        average_latency_ms: avgLatency,
        p95_latency_ms: p95Latency,
        p99_latency_ms: p99Latency,
        throughput_rps: throughput,
        memory_usage_mb: 0, // Would be measured separately
        cpu_usage_percent: 0 // Would be measured separately
      }

      console.log(`✅ FFI Bridge Performance:`)
      console.log(`   - Throughput: ${result.throughput_rps.toFixed(2)} RPS`)
      console.log(`   - Avg Latency: ${result.average_latency_ms.toFixed(2)}ms`)
      console.log(`   - P95 Latency: ${result.p95_latency_ms.toFixed(2)}ms`)
      console.log(`   - Success Rate: ${(successful / iterations * 100).toFixed(2)}%`)

      // Performance assertions
      expect(result.throughput_rps).toBeGreaterThan(100) // At least 100 RPS
      expect(result.average_latency_ms).toBeLessThan(50) // Less than 50ms average
      expect(result.p95_latency_ms).toBeLessThan(100) // Less than 100ms P95
      expect(successful / iterations).toBeGreaterThan(0.95) // 95% success rate
    })

    test('Zero-copy memory transfer benchmark', async () => {
      const bufferSizes = [1024, 10240, 102400, 1048576] // 1KB, 10KB, 100KB, 1MB
      const results: Array<{ size: number; throughput_mbps: number }> = []

      for (const size of bufferSizes) {
        const iterations = Math.max(10, Math.floor(1000000 / size)) // Scale iterations by size
        const testData = Buffer.alloc(size, 'x')
        
        console.log(`📊 Testing ${size} byte transfers (${iterations} iterations)...`)

        // Create shared buffer
        await fetch(`${services.sharedMemory}/api/v1/ipc/buffer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `bench_buffer_${size}`,
            size: size * 2 // Double the size for safety
          })
        })

        const startTime = performance.now()
        let successful = 0

        for (let i = 0; i < iterations; i++) {
          try {
            const writeResponse = await fetch(
              `${services.sharedMemory}/api/v1/ipc/buffer/bench_buffer_${size}`,
              {
                method: 'PUT',
                body: testData
              }
            )

            const readResponse = await fetch(
              `${services.sharedMemory}/api/v1/ipc/buffer/bench_buffer_${size}`
            )

            if (writeResponse.ok && readResponse.ok) {
              successful++
            }
          } catch (error) {
            console.warn(`Transfer ${i} failed:`, error.message)
          }
        }

        const endTime = performance.now()
        const totalTimeMs = endTime - startTime
        const totalBytes = successful * size * 2 // Write + read
        const throughputMbps = (totalBytes / 1024 / 1024) / (totalTimeMs / 1000)

        results.push({ size, throughput_mbps: throughputMbps })

        console.log(`   - ${size} bytes: ${throughputMbps.toFixed(2)} MB/s`)
      }

      // Performance assertions
      results.forEach(({ size, throughput_mbps }) => {
        if (size <= 10240) { // Small transfers should be very fast
          expect(throughput_mbps).toBeGreaterThan(100) // > 100 MB/s
        } else { // Larger transfers should still be reasonable
          expect(throughput_mbps).toBeGreaterThan(10) // > 10 MB/s
        }
      })
    })
  })

  describe('ML Inference Performance', () => {
    test('Go vs Rust ML inference comparison', async () => {
      const testCases = [
        { model: 'small-text', input_tokens: 100, expected_output_tokens: 50 },
        { model: 'medium-text', input_tokens: 500, expected_output_tokens: 200 },
        { model: 'large-text', input_tokens: 1000, expected_output_tokens: 500 }
      ]

      const results: Array<{
        test_case: string
        go_latency_ms: number
        rust_latency_ms: number
        go_throughput_rps: number
        rust_throughput_rps: number
      }> = []

      for (const testCase of testCases) {
        console.log(`🧠 Testing ${testCase.model} inference...`)

        const request = {
          model_id: testCase.model,
          input: {
            text: 'x'.repeat(testCase.input_tokens * 4) // Approximate token size
          },
          parameters: {
            max_tokens: testCase.expected_output_tokens,
            temperature: 0.7
          }
        }

        // Benchmark Go service
        const goLatencies: number[] = []
        const goIterations = 10

        for (let i = 0; i < goIterations; i++) {
          const startTime = performance.now()
          try {
            const response = await fetch(`${services.goMLInference}/infer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request)
            })
            const endTime = performance.now()
            
            if (response.ok) {
              goLatencies.push(endTime - startTime)
            }
          } catch (error) {
            console.warn(`Go ML inference ${i} failed:`, error.message)
          }
        }

        // Benchmark Rust service
        const rustLatencies: number[] = []
        const rustIterations = 10

        for (let i = 0; i < rustIterations; i++) {
          const startTime = performance.now()
          try {
            const response = await fetch(`${services.rustMLInference}/infer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request)
            })
            const endTime = performance.now()
            
            if (response.ok) {
              rustLatencies.push(endTime - startTime)
            }
          } catch (error) {
            console.warn(`Rust ML inference ${i} failed:`, error.message)
          }
        }

        const goAvgLatency = goLatencies.reduce((a, b) => a + b, 0) / goLatencies.length
        const rustAvgLatency = rustLatencies.reduce((a, b) => a + b, 0) / rustLatencies.length
        const goThroughput = 1000 / goAvgLatency
        const rustThroughput = 1000 / rustAvgLatency

        results.push({
          test_case: testCase.model,
          go_latency_ms: goAvgLatency,
          rust_latency_ms: rustAvgLatency,
          go_throughput_rps: goThroughput,
          rust_throughput_rps: rustThroughput
        })

        console.log(`   - Go: ${goAvgLatency.toFixed(2)}ms (${goThroughput.toFixed(2)} RPS)`)
        console.log(`   - Rust: ${rustAvgLatency.toFixed(2)}ms (${rustThroughput.toFixed(2)} RPS)`)
        console.log(`   - Performance ratio: ${(goAvgLatency / rustAvgLatency).toFixed(2)}x`)
      }

      // Performance assertions
      results.forEach((result) => {
        expect(result.go_latency_ms).toBeLessThan(5000) // Go inference < 5s
        expect(result.rust_latency_ms).toBeLessThan(3000) // Rust inference < 3s (expected to be faster)
        expect(result.go_throughput_rps).toBeGreaterThan(0.1) // At least 0.1 RPS
        expect(result.rust_throughput_rps).toBeGreaterThan(0.1) // At least 0.1 RPS
      })
    })

    test('Concurrent ML inference load test', async () => {
      const concurrencyLevels = [1, 5, 10, 20]
      const requestsPerLevel = 20
      const results: Array<{
        concurrency: number
        successful_requests: number
        average_latency_ms: number
        throughput_rps: number
      }> = []

      for (const concurrency of concurrencyLevels) {
        console.log(`📈 Testing concurrency level: ${concurrency}`)

        const request = {
          model_id: 'load-test-model',
          input: { text: 'Load test input text' },
          parameters: { max_tokens: 100 }
        }

        const startTime = performance.now()
        const promises: Promise<any>[] = []
        const latencies: number[] = []

        // Create concurrent requests
        for (let batch = 0; batch < requestsPerLevel; batch += concurrency) {
          const batchPromises = Array.from({ length: concurrency }, async () => {
            const requestStart = performance.now()
            try {
              const response = await fetch(`${services.loadBalancer}/api/v1/ml/infer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
              })
              const requestEnd = performance.now()
              
              if (response.ok) {
                latencies.push(requestEnd - requestStart)
                return { success: true }
              }
              return { success: false }
            } catch (error) {
              return { success: false, error: error.message }
            }
          })

          promises.push(...batchPromises)
          
          // Wait for batch to complete before starting next batch
          await Promise.allSettled(batchPromises)
        }

        const responses = await Promise.allSettled(promises)
        const endTime = performance.now()

        const successful = responses.filter(
          r => r.status === 'fulfilled' && r.value.success
        ).length

        const totalTimeMs = endTime - startTime
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
        const throughput = (successful / totalTimeMs) * 1000

        results.push({
          concurrency,
          successful_requests: successful,
          average_latency_ms: avgLatency,
          throughput_rps: throughput
        })

        console.log(`   - Success: ${successful}/${requestsPerLevel}`)
        console.log(`   - Avg Latency: ${avgLatency.toFixed(2)}ms`)
        console.log(`   - Throughput: ${throughput.toFixed(2)} RPS`)
      }

      // Performance assertions
      results.forEach((result, index) => {
        expect(result.successful_requests).toBeGreaterThan(requestsPerLevel * 0.8) // 80% success rate
        expect(result.throughput_rps).toBeGreaterThan(0.1) // Minimum throughput
        
        // Throughput should generally increase with concurrency (up to a point)
        if (index > 0 && result.concurrency <= 10) {
          const prevResult = results[index - 1]
          expect(result.throughput_rps).toBeGreaterThanOrEqual(prevResult.throughput_rps * 0.8)
        }
      })
    })
  })

  describe('Cache Performance', () => {
    test('Cache hit rate and latency benchmark', async () => {
      const iterations = 1000
      const keyPrefix = `bench-${Date.now()}`
      const values = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        data: `benchmark data ${i}`,
        timestamp: Date.now()
      }))

      console.log(`💾 Cache performance test with ${iterations} operations...`)

      // Populate cache with test data
      const populatePromises = values.map((value, i) =>
        fetch(`${services.cacheCoordinator}/cache/${keyPrefix}-${i}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value)
        })
      )

      await Promise.allSettled(populatePromises)

      // Benchmark mixed read operations
      const readLatencies: number[] = []
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const keyIndex = Math.floor(Math.random() * values.length)
        const requestStart = performance.now()

        try {
          const response = await fetch(`${services.cacheCoordinator}/cache/${keyPrefix}-${keyIndex}`)
          const requestEnd = performance.now()
          
          if (response.ok) {
            readLatencies.push(requestEnd - requestStart)
          }
        } catch (error) {
          console.warn(`Cache read ${i} failed:`, error.message)
        }
      }

      const endTime = performance.now()

      // Calculate metrics
      const avgLatency = readLatencies.reduce((a, b) => a + b, 0) / readLatencies.length
      const throughput = (readLatencies.length / (endTime - startTime)) * 1000

      readLatencies.sort((a, b) => a - b)
      const p95Latency = readLatencies[Math.floor(readLatencies.length * 0.95)]
      const p99Latency = readLatencies[Math.floor(readLatencies.length * 0.99)]

      console.log(`✅ Cache Performance:`)
      console.log(`   - Throughput: ${throughput.toFixed(2)} RPS`)
      console.log(`   - Avg Latency: ${avgLatency.toFixed(2)}ms`)
      console.log(`   - P95 Latency: ${p95Latency.toFixed(2)}ms`)
      console.log(`   - P99 Latency: ${p99Latency.toFixed(2)}ms`)

      // Get cache statistics
      const statsResponse = await fetch(`${services.cacheCoordinator}/stats`)
      const stats = await statsResponse.json()

      console.log(`   - Hit Rate: ${stats.hit_rate.toFixed(2)}%`)

      // Performance assertions
      expect(avgLatency).toBeLessThan(10) // Average latency < 10ms
      expect(p95Latency).toBeLessThan(20) // P95 latency < 20ms
      expect(throughput).toBeGreaterThan(500) // Throughput > 500 RPS
      expect(stats.hit_rate).toBeGreaterThan(80) // Hit rate > 80%
    })
  })

  describe('Message Broker Performance', () => {
    test('High-throughput message routing benchmark', async () => {
      const WebSocket = require('ws')
      const messageCount = 1000
      const concurrentConnections = 10

      console.log(`📨 Message broker performance test: ${messageCount} messages across ${concurrentConnections} connections`)

      const results = await new Promise<{
        totalMessages: number
        successfulMessages: number
        averageLatency: number
        throughput: number
      }>((resolve, reject) => {
        const connections: any[] = []
        const messageLatencies: number[] = []
        let messagesReceived = 0
        let messagesSent = 0

        const startTime = performance.now()
        const messageTimestamps = new Map<string, number>()

        // Create concurrent connections
        for (let i = 0; i < concurrentConnections; i++) {
          const ws = new WebSocket(`ws://localhost:8080/ws/bench_client_${i}`)
          
          ws.on('open', () => {
            connections.push(ws)
            
            // Start sending messages when all connections are ready
            if (connections.length === concurrentConnections) {
              // Send messages
              for (let j = 0; j < messageCount; j++) {
                const connectionIndex = j % concurrentConnections
                const messageId = `bench-msg-${j}`
                const sendTime = performance.now()
                
                messageTimestamps.set(messageId, sendTime)
                
                const message = {
                  id: messageId,
                  type: 'request',
                  source: `bench_client_${connectionIndex}`,
                  destination: 'node_backend',
                  timestamp: new Date().toISOString(),
                  payload: JSON.stringify({ 
                    benchmark: true,
                    index: j,
                    data: 'x'.repeat(100) // 100 byte payload
                  })
                }

                connections[connectionIndex].send(JSON.stringify(message))
                messagesSent++
              }
            }
          })

          ws.on('message', (data: Buffer) => {
            try {
              const message = JSON.parse(data.toString())
              const receiveTime = performance.now()
              const sendTime = messageTimestamps.get(message.id)

              if (sendTime) {
                messageLatencies.push(receiveTime - sendTime)
                messageTimestamps.delete(message.id)
              }

              messagesReceived++

              // Complete test when all messages received
              if (messagesReceived >= messageCount) {
                const endTime = performance.now()
                const totalTimeMs = endTime - startTime
                const avgLatency = messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length
                const throughput = (messagesReceived / totalTimeMs) * 1000

                // Clean up connections
                connections.forEach(conn => conn.close())

                resolve({
                  totalMessages: messageCount,
                  successfulMessages: messagesReceived,
                  averageLatency: avgLatency,
                  throughput
                })
              }
            } catch (error) {
              console.warn('Failed to parse message:', error.message)
            }
          })

          ws.on('error', (error: Error) => {
            console.warn(`WebSocket ${i} error:`, error.message)
          })
        }

        // Timeout after 30 seconds
        setTimeout(() => {
          connections.forEach(conn => conn.close())
          reject(new Error(`Message broker benchmark timeout. Sent: ${messagesSent}, Received: ${messagesReceived}`))
        }, 30000)
      })

      console.log(`✅ Message Broker Performance:`)
      console.log(`   - Messages: ${results.successfulMessages}/${results.totalMessages}`)
      console.log(`   - Avg Latency: ${results.averageLatency.toFixed(2)}ms`)
      console.log(`   - Throughput: ${results.throughput.toFixed(2)} msg/s`)

      // Performance assertions
      expect(results.successfulMessages).toBeGreaterThan(messageCount * 0.95) // 95% success rate
      expect(results.averageLatency).toBeLessThan(100) // Average latency < 100ms
      expect(results.throughput).toBeGreaterThan(100) // Throughput > 100 msg/s
    }, 60000) // Increased timeout for this test
  })

  describe('Resource Monitoring', () => {
    test('Service resource usage monitoring', async () => {
      console.log('📊 Collecting resource usage metrics...')

      const resourceMetrics: Record<string, ResourceMetrics> = {}

      // Collect metrics from all services
      for (const [serviceName, serviceUrl] of Object.entries(services)) {
        try {
          const response = await fetch(`${serviceUrl}/metrics`)
          if (response.ok) {
            const metricsText = await response.text()
            
            // Parse Prometheus metrics (simplified parsing)
            const cpuMatch = metricsText.match(/process_cpu_seconds_total ([0-9.]+)/)
            const memoryMatch = metricsText.match(/process_resident_memory_bytes ([0-9.]+)/)
            
            resourceMetrics[serviceName] = {
              cpu_percent: cpuMatch ? parseFloat(cpuMatch[1]) : 0,
              memory_mb: memoryMatch ? parseFloat(memoryMatch[1]) / 1024 / 1024 : 0,
              network_io_mb: 0, // Would need more detailed parsing
              disk_io_mb: 0 // Would need more detailed parsing
            }

            console.log(`   - ${serviceName}: ${resourceMetrics[serviceName].memory_mb.toFixed(2)} MB`)
          }
        } catch (error) {
          console.warn(`Failed to get metrics for ${serviceName}:`, error.message)
        }
      }

      // Resource usage assertions
      Object.entries(resourceMetrics).forEach(([serviceName, metrics]) => {
        // Memory usage should be reasonable
        if (serviceName.includes('ml')) {
          expect(metrics.memory_mb).toBeLessThan(2000) // ML services < 2GB
        } else {
          expect(metrics.memory_mb).toBeLessThan(1000) // Other services < 1GB
        }
      })

      // Total resource usage across all services
      const totalMemory = Object.values(resourceMetrics)
        .reduce((sum, metrics) => sum + metrics.memory_mb, 0)

      console.log(`📊 Total memory usage: ${totalMemory.toFixed(2)} MB across all services`)
      expect(totalMemory).toBeLessThan(8000) // Total system usage < 8GB
    })
  })
})