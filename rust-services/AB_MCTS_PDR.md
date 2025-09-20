# AB-MCTS Service Rust Migration - Preliminary Design Review (PDR)

## Design Overview

Migration of the AB-MCTS (Adaptive Bandit Monte Carlo Tree Search) orchestration service from TypeScript to Rust to achieve significant performance improvements while maintaining API compatibility.

## System Architecture

### High-Level Architecture
```
┌─────────────────────┐    FFI Bridge    ┌─────────────────────┐
│   TypeScript Layer  │ ◄───────────────► │     Rust Service    │
│                     │                   │                     │
│ ┌─────────────────┐ │                   │ ┌─────────────────┐ │
│ │ Orchestrator    │ │                   │ │ AB-MCTS Core    │ │
│ │ Interface       │ │                   │ │ Engine          │ │
│ └─────────────────┘ │                   │ └─────────────────┘ │
│ ┌─────────────────┐ │                   │ ┌─────────────────┐ │
│ │ Agent Registry  │ │                   │ │ Thompson        │ │
│ │ Integration     │ │                   │ │ Sampling        │ │
│ └─────────────────┘ │                   │ └─────────────────┘ │
│ ┌─────────────────┐ │                   │ ┌─────────────────┐ │
│ │ Caching &       │ │                   │ │ Bayesian        │ │
│ │ Persistence     │ │                   │ │ Models          │ │
│ └─────────────────┘ │                   │ └─────────────────┘ │
└─────────────────────┘                   └─────────────────────┘
```

### Component Architecture

#### Core Rust Components
1. **MCTS Engine** - Main tree search algorithm
2. **Thompson Sampler** - Bayesian bandit selection
3. **Reward Calculator** - Multi-objective optimization
4. **Node Manager** - Tree structure and memory management
5. **FFI Bridge** - TypeScript integration layer

#### Data Flow Architecture
```
User Request → TypeScript → FFI Bridge → Rust MCTS → Search Result → FFI Bridge → TypeScript → Response
```

## Detailed Component Design

### 1. Core Data Structures

#### Node Structure
```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSNode {
    pub id: String,
    pub state: AgentContext,
    pub visits: u32,
    pub total_reward: f64,
    pub average_reward: f64,
    pub ucb_score: f64,
    pub thompson_sample: f64,
    pub prior_alpha: f64,
    pub prior_beta: f64,
    pub children: HashMap<String, MCTSNode>,
    pub parent_id: Option<String>,
    pub depth: u32,
    pub is_terminal: bool,
    pub metadata: NodeMetadata,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub agent: Option<String>,
    pub action: Option<String>,
    pub timestamp: u64,
    pub confidence_interval: (f64, f64),
}
```

#### Action & Reward Structures
```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSAction {
    pub agent_name: String,
    pub agent_type: AgentType,
    pub estimated_cost: f64,
    pub estimated_time: u64,
    pub required_capabilities: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSReward {
    pub value: f64,
    pub components: RewardComponents,
    pub metadata: RewardMetadata,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RewardComponents {
    pub quality: f64,
    pub speed: f64,
    pub cost: f64,
    pub user_satisfaction: Option<f64>,
}
```

### 2. Core Algorithm Implementation

#### MCTS Main Loop
```rust
impl MCTSEngine {
    pub async fn search(
        &mut self,
        initial_context: AgentContext,
        available_agents: Vec<String>,
        options: SearchOptions,
    ) -> Result<SearchResult, MCTSError> {
        let start_time = Instant::now();
        let mut iterations = 0;
        let mut budget = self.config.max_budget;
        
        // Initialize root node
        self.initialize_root(initial_context)?;
        
        // Main search loop
        while self.should_continue(iterations, start_time, budget) {
            // Selection: Traverse tree to leaf
            let leaf = self.select().await?;
            
            // Expansion: Add new child if possible
            if let Some(expanded) = self.expand(leaf, &available_agents).await? {
                // Simulation: Estimate reward
                let reward = self.simulate(expanded, &available_agents).await?;
                
                // Backpropagation: Update tree statistics
                self.backpropagate(expanded, reward);
                
                budget -= reward.metadata.tokens_used as f64 * 0.001;
            }
            
            iterations += 1;
            
            // Checkpoint periodically
            if iterations % 100 == 0 {
                self.checkpoint().await?;
            }
        }
        
        // Generate final result
        Ok(self.generate_result(iterations, start_time.elapsed()))
    }
}
```

#### Thompson Sampling Implementation
```rust
pub struct ThompsonSampler {
    arms: HashMap<String, BetaDistribution>,
    selection_history: Vec<(String, f64)>,
}

impl ThompsonSampler {
    pub fn select_arm(&self) -> String {
        let mut best_arm = String::new();
        let mut best_sample = f64::NEG_INFINITY;
        
        for (arm_name, distribution) in &self.arms {
            let sample = distribution.sample();
            if sample > best_sample {
                best_sample = sample;
                best_arm = arm_name.clone();
            }
        }
        
        best_arm
    }
    
    pub fn update_arm(&mut self, arm_name: &str, reward: f64) {
        if let Some(distribution) = self.arms.get_mut(arm_name) {
            if reward > 0.5 {
                distribution.alpha += 1.0;
            } else {
                distribution.beta += 1.0;
            }
        }
    }
}
```

#### UCB1 Calculation
```rust
pub struct UCBCalculator;

impl UCBCalculator {
    pub fn calculate_ucb1(
        child_reward: f64,
        parent_visits: u32,
        child_visits: u32,
        exploration_constant: f64,
    ) -> f64 {
        if child_visits == 0 {
            return f64::INFINITY;
        }
        
        let exploitation = child_reward;
        let exploration = exploration_constant * 
            ((parent_visits as f64).ln() / (child_visits as f64)).sqrt();
        
        exploitation + exploration
    }
}
```

### 3. Performance Optimizations

#### Memory Management
```rust
pub struct NodePool {
    nodes: Vec<MCTSNode>,
    free_indices: Vec<usize>,
    allocated: usize,
}

impl NodePool {
    pub fn allocate_node(&mut self) -> &mut MCTSNode {
        if let Some(index) = self.free_indices.pop() {
            &mut self.nodes[index]
        } else {
            self.nodes.push(MCTSNode::default());
            self.allocated += 1;
            self.nodes.last_mut().unwrap()
        }
    }
    
    pub fn deallocate_node(&mut self, index: usize) {
        if index < self.nodes.len() {
            self.free_indices.push(index);
        }
    }
}
```

#### Parallel Simulation
```rust
pub async fn simulate_parallel(
    &self,
    nodes: Vec<&MCTSNode>,
    agents: &[String],
) -> Result<Vec<MCTSReward>, MCTSError> {
    let futures: Vec<_> = nodes
        .into_iter()
        .map(|node| self.simulate_single(node, agents))
        .collect();
        
    try_join_all(futures).await
}
```

### 4. FFI Bridge Design

#### TypeScript Interface
```typescript
interface RustMCTSBridge {
  search(
    context: AgentContext,
    agents: string[],
    options: SearchOptions
  ): Promise<SearchResult>;
  
  processFeedback(
    nodeId: string,
    feedback: Feedback
  ): Promise<void>;
  
  getVisualization(): Promise<VisualizationData>;
  
  reset(): void;
}
```

#### Rust FFI Implementation
```rust
use neon::prelude::*;

#[neon::export]
async fn search(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let context: AgentContext = cx.argument::<JsObject>(0)?.try_into(&mut cx)?;
    let agents: Vec<String> = cx.argument::<JsArray>(1)?.to_vec(&mut cx)?;
    let options: SearchOptions = cx.argument::<JsObject>(2)?.try_into(&mut cx)?;
    
    let (deferred, promise) = cx.promise();
    let channel = cx.channel();
    
    tokio::spawn(async move {
        let result = MCTS_ENGINE.lock().await.search(context, agents, options).await;
        
        deferred.settle_with(&channel, move |mut cx| {
            match result {
                Ok(search_result) => {
                    let js_result = search_result.to_js_object(&mut cx)?;
                    Ok(js_result)
                }
                Err(error) => {
                    cx.throw_error(error.to_string())
                }
            }
        });
    });
    
    Ok(promise)
}
```

### 5. Configuration & Error Handling

#### Configuration Structure
```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSConfig {
    pub max_iterations: u32,
    pub max_depth: u32,
    pub exploration_constant: f64,
    pub discount_factor: f64,
    pub time_limit: Duration,
    pub parallel_simulations: usize,
    pub node_pool_size: usize,
    pub checkpoint_interval: u32,
    pub cache_size: usize,
}

impl Default for MCTSConfig {
    fn default() -> Self {
        Self {
            max_iterations: 1000,
            max_depth: 10,
            exploration_constant: std::f64::consts::SQRT_2,
            discount_factor: 0.95,
            time_limit: Duration::from_secs(30),
            parallel_simulations: 4,
            node_pool_size: 10000,
            checkpoint_interval: 100,
            cache_size: 1000,
        }
    }
}
```

#### Error Handling
```rust
#[derive(Debug, thiserror::Error)]
pub enum MCTSError {
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    
    #[error("Search timeout after {0:?}")]
    SearchTimeout(Duration),
    
    #[error("Node not found: {0}")]
    NodeNotFound(String),
    
    #[error("Agent execution failed: {0}")]
    AgentExecutionFailed(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
```

### 6. Testing Strategy

#### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_thompson_sampling() {
        let mut sampler = ThompsonSampler::new();
        sampler.add_arm("agent1".to_string(), 1.0, 1.0);
        sampler.add_arm("agent2".to_string(), 1.0, 1.0);
        
        // Test selection
        let selected = sampler.select_arm();
        assert!(["agent1", "agent2"].contains(&selected.as_str()));
        
        // Test update
        sampler.update_arm(&selected, 0.8);
        let distribution = sampler.get_arm(&selected).unwrap();
        assert!(distribution.alpha > 1.0 || distribution.beta > 1.0);
    }
    
    #[tokio::test]
    async fn test_ucb_calculation() {
        let ucb = UCBCalculator::calculate_ucb1(0.7, 100, 10, 1.414);
        assert!(ucb > 0.7); // Should be greater than exploitation term
        
        let ucb_unvisited = UCBCalculator::calculate_ucb1(0.0, 100, 0, 1.414);
        assert_eq!(ucb_unvisited, f64::INFINITY);
    }
}
```

#### Integration Tests
```rust
#[tokio::test]
async fn test_complete_search() {
    let config = MCTSConfig {
        max_iterations: 100,
        time_limit: Duration::from_secs(5),
        ..Default::default()
    };
    
    let mut engine = MCTSEngine::new(config);
    let context = create_test_context();
    let agents = vec!["agent1".to_string(), "agent2".to_string()];
    
    let result = engine.search(context, agents, SearchOptions::default()).await;
    
    assert!(result.is_ok());
    let search_result = result.unwrap();
    assert!(!search_result.best_path.is_empty());
    assert!(search_result.confidence >= 0.0 && search_result.confidence <= 1.0);
}
```

#### Performance Benchmarks
```rust
#[cfg(test)]
mod benchmarks {
    use criterion::{black_box, criterion_group, criterion_main, Criterion};
    
    fn bench_search(c: &mut Criterion) {
        c.bench_function("mcts_search_1000_iterations", |b| {
            b.to_async(tokio::runtime::Runtime::new().unwrap())
                .iter(|| async {
                    let mut engine = MCTSEngine::new(MCTSConfig::default());
                    let result = engine.search(
                        black_box(create_test_context()),
                        black_box(create_test_agents()),
                        black_box(SearchOptions::default())
                    ).await;
                    black_box(result)
                });
        });
    }
    
    criterion_group!(benches, bench_search);
    criterion_main!(benches);
}
```

## Performance Analysis

### Expected Performance Improvements

| Metric | TypeScript | Rust Target | Improvement |
|--------|------------|-------------|-------------|
| Search Time (1000 iter) | 5.0s | 1.5s | 3.3x |
| Memory Usage | 500MB | 150MB | 70% reduction |
| CPU Efficiency | 20% utilization | 70% utilization | 3.5x |
| Concurrent Searches | 10 | 50 | 5x |

### Memory Layout Optimization
```rust
// Optimized node layout for cache efficiency
#[repr(C)]
pub struct CompactNode {
    // Hot data - frequently accessed (64 bytes)
    pub visits: u32,
    pub total_reward: f64,
    pub average_reward: f64,
    pub ucb_score: f64,
    pub thompson_sample: f64,
    pub depth: u16,
    pub flags: u16, // is_terminal, is_expanded, etc.
    
    // Cold data - less frequently accessed
    pub id: String,
    pub state: Box<AgentContext>,
    pub children: Box<HashMap<String, CompactNode>>,
    pub metadata: Box<NodeMetadata>,
}
```

## Risk Analysis & Mitigation

### Technical Risks

#### 1. Mathematical Correctness
- **Risk**: Thompson Sampling statistical properties
- **Mitigation**: Unit tests comparing with reference implementation
- **Validation**: Statistical tests for distribution correctness

#### 2. Memory Management
- **Risk**: Memory leaks in complex tree structures  
- **Mitigation**: Custom allocator with bounds checking
- **Validation**: Memory profiling and leak detection

#### 3. FFI Overhead
- **Risk**: Performance loss in TypeScript ↔ Rust communication
- **Mitigation**: Efficient serialization, batched operations
- **Validation**: Benchmark FFI call overhead

### Integration Risks

#### 1. API Compatibility
- **Risk**: Breaking changes to existing interfaces
- **Mitigation**: Comprehensive compatibility test suite
- **Validation**: End-to-end integration testing

#### 2. Error Propagation
- **Risk**: Rust errors not properly handled in TypeScript
- **Mitigation**: Structured error types with proper mapping
- **Validation**: Error scenario testing

## Implementation Plan

### Phase 1: Core Implementation (Weeks 1-3)
- [ ] Set up Rust project structure and dependencies
- [ ] Implement core data structures (Node, Action, Reward)
- [ ] Develop MCTS algorithm core (select, expand, simulate, backpropagate)
- [ ] Create Thompson Sampling implementation
- [ ] Add UCB1 calculation and selection logic

### Phase 2: Optimization & Integration (Weeks 4-5)
- [ ] Implement memory pool optimization
- [ ] Add parallel simulation support
- [ ] Create FFI bridge with Neon
- [ ] Develop TypeScript integration layer
- [ ] Implement error handling and logging

### Phase 3: Advanced Features (Weeks 6-7)
- [ ] Add Redis persistence for tree storage
- [ ] Implement feedback processing system
- [ ] Create visualization data export
- [ ] Add comprehensive configuration system
- [ ] Develop performance monitoring hooks

### Phase 4: Testing & Deployment (Week 8)
- [ ] Create comprehensive test suite
- [ ] Performance benchmarking and optimization
- [ ] Integration testing with existing system
- [ ] Documentation and API reference
- [ ] Production deployment preparation

## Success Criteria

### Performance Targets
- ✅ **3x faster search**: 1000 iterations in <2 seconds
- ✅ **70% memory reduction**: Peak usage <150MB
- ✅ **5x concurrency**: Support 50+ parallel searches
- ✅ **API compatibility**: 100% TypeScript interface preservation

### Quality Targets
- ✅ **Test coverage**: >95% code coverage
- ✅ **Mathematical correctness**: Statistical validation
- ✅ **Error handling**: <0.1% crash rate
- ✅ **Documentation**: Complete API and integration docs

---

*PDR Version*: 1.0  
*Review Date*: August 31, 2025  
*Approved By*: Engineering Team  
*Next Review*: Development Milestone Reviews