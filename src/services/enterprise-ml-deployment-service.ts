/**
 * Enterprise ML Deployment Service
 * Handles automated model deployment, versioning, A/B testing, and rollback capabilities
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import { createHash } from 'crypto'
import { supabase } from '../config/supabase'

// ============= Types & Interfaces =============

export interface MLModel {
  id: string
  name: string
  version: string
  type: 'llm' | 'embedding' | 'classification' | 'generation' | 'multimodal'
  framework: 'mlx' | 'ollama' | 'transformers' | 'pytorch' | 'tensorflow' | 'onnx'
  size_gb: number
  parameters?: number
  capabilities: string[]
  metadata: {
    description: string
    author: string
    training_data?: string
    performance_metrics?: Record<string, number>
    requirements: {
      min_memory_gb: number
      min_vram_gb?: number
      cuda_required?: boolean
      python_version?: string
    }
    tags: string[]
    license?: string
  }
  created_at: Date
  updated_at: Date
}

export interface DeploymentConfig {
  model_id: string
  environment: 'development' | 'staging' | 'production'
  deployment_type: 'blue_green' | 'canary' | 'rolling' | 'immediate'
  resource_allocation: {
    cpu_cores: number
    memory_gb: number
    gpu_count?: number
    storage_gb: number
  }
  scaling: {
    min_replicas: number
    max_replicas: number
    target_cpu_percent: number
    target_memory_percent: number
    scale_up_cooldown_seconds: number
    scale_down_cooldown_seconds: number
  }
  health_check: {
    endpoint: string
    timeout_seconds: number
    interval_seconds: number
    failure_threshold: number
  }
  traffic_split?: {
    current_version_percent: number
    new_version_percent: number
  }
  rollback_config: {
    enable_auto_rollback: boolean
    failure_threshold_percent: number
    monitoring_window_minutes: number
  }
}

export interface Deployment {
  id: string
  model_id: string
  version: string
  config: DeploymentConfig
  status: 'pending' | 'deploying' | 'active' | 'rolling_back' | 'failed' | 'terminated'
  endpoints: string[]
  metrics: {
    cpu_usage_percent: number
    memory_usage_percent: number
    request_count: number
    error_rate: number
    response_time_p95_ms: number
    last_updated: Date
  }
  created_at: Date
  updated_at: Date
}

export interface ABTestConfig {
  name: string
  description: string
  model_a_id: string
  model_b_id: string
  traffic_split_percent: number
  duration_hours: number
  success_metrics: string[]
  minimum_samples: number
  significance_threshold: number
}

export interface ABTestResult {
  test_id: string
  model_a_metrics: Record<string, number>
  model_b_metrics: Record<string, number>
  statistical_significance: Record<string, number>
  winner?: 'model_a' | 'model_b' | 'inconclusive'
  confidence_percent: number
  recommendation: string
}

// ============= Main Service Class =============

export class EnterpriseMLDeploymentService extends EventEmitter {
  private models = new Map<string, MLModel>()
  private deployments = new Map<string, Deployment>()
  private abTests = new Map<string, ABTestConfig>()
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>()
  private metricsCollectionInterval: NodeJS.Timeout | null = null
  
  constructor() {
    super()
    this.initializeService()
  }

  // ============= Initialization =============

  private async initializeService(): Promise<void> {
    console.log('🚀 Initializing Enterprise ML Deployment Service...')
    
    try {
      await this.loadExistingModels()
      await this.loadExistingDeployments()
      await this.startMetricsCollection()
      
      console.log('✅ Enterprise ML Deployment Service ready')
      this.emit('service:ready')
    } catch (error) {
      console.error('❌ Failed to initialize ML Deployment Service:', error)
      this.emit('service:error', error)
    }
  }

  private async loadExistingModels(): Promise<void> {
    const { data, error } = await supabase
      .from('ml_models')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Warning: Could not load existing models:', error.message)
      return
    }

    if (data) {
      data.forEach(model => {
        this.models.set(model.id, model)
      })
      console.log(`📚 Loaded ${data.length} existing ML models`)
    }
  }

  private async loadExistingDeployments(): Promise<void> {
    const { data, error } = await supabase
      .from('ml_deployments')
      .select('*')
      .in('status', ['active', 'deploying'])

    if (error) {
      console.warn('Warning: Could not load existing deployments:', error.message)
      return
    }

    if (data) {
      data.forEach(deployment => {
        this.deployments.set(deployment.id, deployment)
        if (deployment.status === 'active') {
          this.startHealthChecking(deployment.id)
        }
      })
      console.log(`🔄 Restored ${data.length} active deployments`)
    }
  }

  // ============= Model Management =============

  async registerModel(modelData: Omit<MLModel, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const modelId = createHash('sha256')
      .update(`${modelData.name}-${modelData.version}-${Date.now()}`)
      .digest('hex')
      .substring(0, 16)

    const model: MLModel = {
      ...modelData,
      id: modelId,
      created_at: new Date(),
      updated_at: new Date()
    }

    // Store in database
    const { error } = await supabase
      .from('ml_models')
      .insert(model)

    if (error) {
      throw new Error(`Failed to register model: ${error.message}`)
    }

    this.models.set(modelId, model)
    
    console.log(`📝 Registered model: ${model.name} v${model.version} (${modelId})`)
    this.emit('model:registered', { modelId, model })
    
    return modelId
  }

  async getModel(modelId: string): Promise<MLModel | null> {
    return this.models.get(modelId) || null
  }

  async listModels(filters?: {
    type?: MLModel['type']
    framework?: MLModel['framework']
    tags?: string[]
  }): Promise<MLModel[]> {
    let models = Array.from(this.models.values())

    if (filters) {
      if (filters.type) {
        models = models.filter(m => m.type === filters.type)
      }
      if (filters.framework) {
        models = models.filter(m => m.framework === filters.framework)
      }
      if (filters.tags) {
        models = models.filter(m => 
          filters.tags!.every(tag => m.metadata.tags.includes(tag))
        )
      }
    }

    return models.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
  }

  async updateModel(modelId: string, updates: Partial<MLModel>): Promise<void> {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    const updatedModel = {
      ...model,
      ...updates,
      updated_at: new Date()
    }

    const { error } = await supabase
      .from('ml_models')
      .update(updatedModel)
      .eq('id', modelId)

    if (error) {
      throw new Error(`Failed to update model: ${error.message}`)
    }

    this.models.set(modelId, updatedModel)
    this.emit('model:updated', { modelId, model: updatedModel })
  }

  // ============= Deployment Management =============

  async deploy(config: DeploymentConfig): Promise<string> {
    const model = this.models.get(config.model_id)
    if (!model) {
      throw new Error(`Model ${config.model_id} not found`)
    }

    const deploymentId = createHash('sha256')
      .update(`${config.model_id}-${config.environment}-${Date.now()}`)
      .digest('hex')
      .substring(0, 16)

    const deployment: Deployment = {
      id: deploymentId,
      model_id: config.model_id,
      version: model.version,
      config,
      status: 'pending',
      endpoints: [],
      metrics: {
        cpu_usage_percent: 0,
        memory_usage_percent: 0,
        request_count: 0,
        error_rate: 0,
        response_time_p95_ms: 0,
        last_updated: new Date()
      },
      created_at: new Date(),
      updated_at: new Date()
    }

    // Store in database
    const { error } = await supabase
      .from('ml_deployments')
      .insert(deployment)

    if (error) {
      throw new Error(`Failed to create deployment: ${error.message}`)
    }

    this.deployments.set(deploymentId, deployment)
    
    console.log(`🚀 Starting deployment: ${deploymentId} (${model.name} v${model.version})`)
    this.emit('deployment:created', { deploymentId, deployment })

    // Start deployment process asynchronously
    this.executeDeployment(deploymentId).catch(error => {
      console.error(`Deployment ${deploymentId} failed:`, error)
      this.updateDeploymentStatus(deploymentId, 'failed')
    })

    return deploymentId
  }

  private async executeDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId)
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`)
    }

    await this.updateDeploymentStatus(deploymentId, 'deploying')

    try {
      // Simulate deployment steps
      console.log(`📦 Preparing deployment for ${deployment.model_id}...`)
      await this.sleep(2000)

      // Resource allocation
      console.log(`⚡ Allocating resources: ${deployment.config.resource_allocation.cpu_cores} CPU, ${deployment.config.resource_allocation.memory_gb}GB RAM`)
      await this.sleep(3000)

      // Model loading and validation
      console.log(`🔍 Loading and validating model...`)
      await this.validateModelDeployment(deployment)
      await this.sleep(5000)

      // Endpoint setup
      console.log(`🌐 Setting up service endpoints...`)
      const endpoints = await this.setupEndpoints(deployment)
      
      // Update deployment with endpoints
      deployment.endpoints = endpoints
      deployment.updated_at = new Date()
      await this.updateDeploymentInDB(deployment)

      // Health check setup
      console.log(`🏥 Starting health monitoring...`)
      this.startHealthChecking(deploymentId)

      // Traffic routing (for blue-green/canary deployments)
      if (deployment.config.deployment_type !== 'immediate') {
        await this.setupTrafficRouting(deployment)
      }

      await this.updateDeploymentStatus(deploymentId, 'active')
      console.log(`✅ Deployment ${deploymentId} is now active`)

      this.emit('deployment:active', { deploymentId, deployment, endpoints })

    } catch (error) {
      console.error(`❌ Deployment ${deploymentId} failed:`, error)
      await this.updateDeploymentStatus(deploymentId, 'failed')
      throw error
    }
  }

  private async validateModelDeployment(deployment: Deployment): Promise<void> {
    const model = this.models.get(deployment.model_id)
    if (!model) {
      throw new Error(`Model ${deployment.model_id} not found`)
    }

    // Check resource requirements
    const config = deployment.config
    if (config.resource_allocation.memory_gb < model.metadata.requirements.min_memory_gb) {
      throw new Error(`Insufficient memory allocated: ${config.resource_allocation.memory_gb}GB < ${model.metadata.requirements.min_memory_gb}GB required`)
    }

    if (model.metadata.requirements.min_vram_gb && 
        (!config.resource_allocation.gpu_count || config.resource_allocation.gpu_count === 0)) {
      throw new Error(`Model requires GPU but none allocated`)
    }

    // Simulate model validation
    console.log(`✅ Model validation passed for ${model.name}`)
  }

  private async setupEndpoints(deployment: Deployment): Promise<string[]> {
    const basePort = 8000 + parseInt(deployment.id.substring(0, 4), 16) % 1000
    const endpoints = []

    // HTTP inference endpoint
    endpoints.push(`http://localhost:${basePort}/predict`)
    
    // Health check endpoint
    endpoints.push(`http://localhost:${basePort}/health`)
    
    // Metrics endpoint
    endpoints.push(`http://localhost:${basePort}/metrics`)

    // WebSocket endpoint for streaming
    if (deployment.config.model_id.includes('llm') || deployment.config.model_id.includes('generation')) {
      endpoints.push(`ws://localhost:${basePort}/stream`)
    }

    return endpoints
  }

  private async setupTrafficRouting(deployment: Deployment): Promise<void> {
    const config = deployment.config
    
    if (config.deployment_type === 'canary') {
      console.log(`🐤 Setting up canary deployment with ${config.traffic_split?.new_version_percent || 10}% traffic`)
      // Implement canary routing logic
    } else if (config.deployment_type === 'blue_green') {
      console.log(`🔵🟢 Setting up blue-green deployment`)
      // Implement blue-green routing logic
    }

    // Simulate traffic routing setup
    await this.sleep(1000)
  }

  // ============= A/B Testing =============

  async createABTest(config: ABTestConfig): Promise<string> {
    const testId = createHash('sha256')
      .update(`${config.name}-${Date.now()}`)
      .digest('hex')
      .substring(0, 16)

    // Validate both models exist
    const modelA = this.models.get(config.model_a_id)
    const modelB = this.models.get(config.model_b_id)

    if (!modelA || !modelB) {
      throw new Error('Both models must be registered before creating A/B test')
    }

    this.abTests.set(testId, config)

    // Store in database
    const { error } = await supabase
      .from('ab_tests')
      .insert({
        id: testId,
        ...config,
        status: 'active',
        created_at: new Date()
      })

    if (error) {
      throw new Error(`Failed to create A/B test: ${error.message}`)
    }

    console.log(`🧪 Created A/B test: ${config.name} (${testId})`)
    console.log(`   Model A: ${modelA.name} v${modelA.version}`)
    console.log(`   Model B: ${modelB.name} v${modelB.version}`)
    console.log(`   Traffic Split: ${config.traffic_split_percent}% to B`)
    
    this.emit('ab_test:created', { testId, config })

    // Schedule test completion
    setTimeout(() => {
      this.completeABTest(testId).catch(console.error)
    }, config.duration_hours * 60 * 60 * 1000)

    return testId
  }

  private async completeABTest(testId: string): Promise<ABTestResult> {
    const config = this.abTests.get(testId)
    if (!config) {
      throw new Error(`A/B test ${testId} not found`)
    }

    // Collect metrics for both models
    const modelAMetrics = await this.collectModelMetrics(config.model_a_id)
    const modelBMetrics = await this.collectModelMetrics(config.model_b_id)

    // Perform statistical analysis
    const result = this.analyzeABTestResults(config, modelAMetrics, modelBMetrics)

    // Store results
    await supabase
      .from('ab_test_results')
      .insert({
        test_id: testId,
        ...result,
        completed_at: new Date()
      })

    console.log(`📊 A/B test ${testId} completed:`)
    console.log(`   Winner: ${result.winner || 'inconclusive'}`)
    console.log(`   Confidence: ${result.confidence_percent.toFixed(1)}%`)
    console.log(`   Recommendation: ${result.recommendation}`)

    this.emit('ab_test:completed', { testId, result })

    return result
  }

  private async collectModelMetrics(modelId: string): Promise<Record<string, number>> {
    // Simulate metrics collection
    return {
      accuracy: Math.random() * 0.1 + 0.85,
      latency_ms: Math.random() * 100 + 200,
      throughput_rps: Math.random() * 50 + 100,
      error_rate: Math.random() * 0.02,
      user_satisfaction: Math.random() * 0.15 + 0.8
    }
  }

  private analyzeABTestResults(
    config: ABTestConfig, 
    modelAMetrics: Record<string, number>, 
    modelBMetrics: Record<string, number>
  ): ABTestResult {
    // Simplified statistical analysis
    const significance: Record<string, number> = {}
    let totalSignificance = 0
    let betterBCount = 0

    for (const metric of config.success_metrics) {
      const aValue = modelAMetrics[metric] || 0
      const bValue = modelBMetrics[metric] || 0
      
      // Simple significance calculation (in production, use proper statistical tests)
      const diff = Math.abs(aValue - bValue)
      const avgValue = (aValue + bValue) / 2
      const relativeDiff = diff / avgValue
      
      significance[metric] = Math.min(relativeDiff * 10, 1) // Normalize to 0-1
      totalSignificance += significance[metric]
      
      if ((metric.includes('accuracy') || metric.includes('satisfaction') || metric.includes('throughput')) && bValue > aValue) {
        betterBCount++
      } else if ((metric.includes('latency') || metric.includes('error')) && bValue < aValue) {
        betterBCount++
      }
    }

    const avgSignificance = totalSignificance / config.success_metrics.length
    const confidencePercent = avgSignificance * 100

    let winner: 'model_a' | 'model_b' | 'inconclusive' = 'inconclusive'
    let recommendation = 'Results are inconclusive. Consider extending the test duration.'

    if (confidencePercent > config.significance_threshold) {
      if (betterBCount > config.success_metrics.length / 2) {
        winner = 'model_b'
        recommendation = 'Model B shows statistically significant improvement. Recommend full deployment.'
      } else {
        winner = 'model_a'
        recommendation = 'Model A performs better or equivalently. Consider keeping current model.'
      }
    }

    return {
      test_id: config.name,
      model_a_metrics: modelAMetrics,
      model_b_metrics: modelBMetrics,
      statistical_significance: significance,
      winner,
      confidence_percent: confidencePercent,
      recommendation
    }
  }

  // ============= Health Monitoring & Metrics =============

  private startHealthChecking(deploymentId: string): void {
    const deployment = this.deployments.get(deploymentId)
    if (!deployment) return

    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(deploymentId)
      } catch (error) {
        console.error(`Health check failed for deployment ${deploymentId}:`, error)
        await this.handleHealthCheckFailure(deploymentId)
      }
    }, deployment.config.health_check.interval_seconds * 1000)

    this.healthCheckIntervals.set(deploymentId, interval)
  }

  private async performHealthCheck(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId)
    if (!deployment || deployment.status !== 'active') return

    // Simulate health check
    const isHealthy = Math.random() > 0.05 // 95% success rate

    if (isHealthy) {
      // Update metrics
      deployment.metrics = {
        cpu_usage_percent: Math.random() * 30 + 20,
        memory_usage_percent: Math.random() * 40 + 30,
        request_count: deployment.metrics.request_count + Math.floor(Math.random() * 100),
        error_rate: Math.random() * 0.02,
        response_time_p95_ms: Math.random() * 100 + 150,
        last_updated: new Date()
      }

      this.deployments.set(deploymentId, deployment)
      this.emit('deployment:health_check_passed', { deploymentId, metrics: deployment.metrics })
    } else {
      throw new Error('Health check endpoint returned error')
    }
  }

  private async handleHealthCheckFailure(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId)
    if (!deployment) return

    const config = deployment.config.rollback_config

    if (config.enable_auto_rollback) {
      console.warn(`⚠️ Health check failure detected for ${deploymentId}. Initiating auto-rollback...`)
      await this.rollbackDeployment(deploymentId)
    } else {
      console.error(`❌ Health check failure for ${deploymentId}. Manual intervention required.`)
      this.emit('deployment:health_check_failed', { deploymentId, deployment })
    }
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectAllMetrics().catch(console.error)
    }, 30000) // Every 30 seconds
  }

  private async collectAllMetrics(): Promise<void> {
    const activeDeployments = Array.from(this.deployments.values())
      .filter(d => d.status === 'active')

    for (const deployment of activeDeployments) {
      // Metrics are updated during health checks
      // Here we could add additional metric collection logic
      
      // Store metrics in database
      await supabase
        .from('deployment_metrics')
        .insert({
          deployment_id: deployment.id,
          metrics: deployment.metrics,
          timestamp: new Date()
        })
        .on('error', () => {}) // Ignore errors to prevent spam
    }
  }

  // ============= Rollback Management =============

  async rollbackDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId)
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`)
    }

    console.log(`🔄 Starting rollback for deployment ${deploymentId}...`)
    await this.updateDeploymentStatus(deploymentId, 'rolling_back')

    try {
      // Stop health checking
      const interval = this.healthCheckIntervals.get(deploymentId)
      if (interval) {
        clearInterval(interval)
        this.healthCheckIntervals.delete(deploymentId)
      }

      // Simulate rollback process
      await this.sleep(3000)

      // Remove endpoints
      deployment.endpoints = []
      deployment.updated_at = new Date()

      await this.updateDeploymentStatus(deploymentId, 'terminated')
      console.log(`✅ Rollback completed for deployment ${deploymentId}`)

      this.emit('deployment:rolled_back', { deploymentId, deployment })

    } catch (error) {
      console.error(`❌ Rollback failed for deployment ${deploymentId}:`, error)
      await this.updateDeploymentStatus(deploymentId, 'failed')
      throw error
    }
  }

  // ============= Utility Methods =============

  private async updateDeploymentStatus(deploymentId: string, status: Deployment['status']): Promise<void> {
    const deployment = this.deployments.get(deploymentId)
    if (!deployment) return

    deployment.status = status
    deployment.updated_at = new Date()
    this.deployments.set(deploymentId, deployment)

    await this.updateDeploymentInDB(deployment)
    this.emit('deployment:status_changed', { deploymentId, status })
  }

  private async updateDeploymentInDB(deployment: Deployment): Promise<void> {
    await supabase
      .from('ml_deployments')
      .update(deployment)
      .eq('id', deployment.id)
      .on('error', () => {}) // Ignore database errors
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ============= Public API Methods =============

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    return this.deployments.get(deploymentId) || null
  }

  async listDeployments(filters?: {
    environment?: DeploymentConfig['environment']
    status?: Deployment['status']
  }): Promise<Deployment[]> {
    let deployments = Array.from(this.deployments.values())

    if (filters) {
      if (filters.environment) {
        deployments = deployments.filter(d => d.config.environment === filters.environment)
      }
      if (filters.status) {
        deployments = deployments.filter(d => d.status === filters.status)
      }
    }

    return deployments.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    models_registered: number
    active_deployments: number
    active_ab_tests: number
    system_metrics: {
      total_requests: number
      average_response_time_ms: number
      error_rate: number
    }
  }> {
    const activeDeployments = Array.from(this.deployments.values())
      .filter(d => d.status === 'active')

    const totalRequests = activeDeployments
      .reduce((sum, d) => sum + d.metrics.request_count, 0)
    
    const avgResponseTime = activeDeployments.length > 0
      ? activeDeployments.reduce((sum, d) => sum + d.metrics.response_time_p95_ms, 0) / activeDeployments.length
      : 0

    const avgErrorRate = activeDeployments.length > 0
      ? activeDeployments.reduce((sum, d) => sum + d.metrics.error_rate, 0) / activeDeployments.length
      : 0

    const status = avgErrorRate > 0.05 ? 'unhealthy' : 
                  avgErrorRate > 0.02 ? 'degraded' : 'healthy'

    return {
      status,
      models_registered: this.models.size,
      active_deployments: activeDeployments.length,
      active_ab_tests: this.abTests.size,
      system_metrics: {
        total_requests: totalRequests,
        average_response_time_ms: Math.round(avgResponseTime),
        error_rate: Math.round(avgErrorRate * 10000) / 10000
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Enterprise ML Deployment Service...')

    // Clear all intervals
    this.healthCheckIntervals.forEach(interval => clearInterval(interval))
    this.healthCheckIntervals.clear()

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
    }

    console.log('✅ Enterprise ML Deployment Service shutdown complete')
  }
}

// Export singleton instance
export const enterpriseMLDeploymentService = new EnterpriseMLDeploymentService()