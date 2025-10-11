use fast_llm_coordinator::{
    coordinator::FastLLMCoordinator,
    load_balancer::LoadBalancingStrategy,
    routing::{CoordinationContext, UrgencyLevel, ResponseLength},
};
use std::time::Instant;
use tokio::time::{sleep, Duration};
use tracing_subscriber::fmt::init;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init();
    
    println!("🚀 Fast LLM Coordinator Benchmark");
    println!("==================================");
    
    // Test different load balancing strategies
    let strategies = [
        ("Hybrid", LoadBalancingStrategy::Hybrid),
        ("Weighted Round Robin", LoadBalancingStrategy::WeightedRoundRobin),
        ("Least Connections", LoadBalancingStrategy::LeastConnections),
        ("Response Time Based", LoadBalancingStrategy::ResponseTimeBased),
    ];
    
    for (strategy_name, strategy) in &strategies {
        println!("\n🔧 Testing {}", strategy_name);
        
        let coordinator = FastLLMCoordinator::with_load_balancing_strategy(strategy.clone());
        
        // Run benchmark
        let results = run_benchmark(&coordinator, 50, 10).await?;
        
        println!("📊 Results for {}:", strategy_name);
        println!("   Total requests: {}", results.total_requests);
        println!("   Successful requests: {}", results.successful_requests);
        println!("   Average response time: {:.2}ms", results.avg_response_time);
        println!("   Requests per second: {:.2}", results.requests_per_second);
        println!("   Error rate: {:.2}%", results.error_rate * 100.0);
        println!("   Load balancing effectiveness: {:.2}%", results.load_balancing_effectiveness * 100.0);
    }
    
    // Test routing accuracy
    println!("\n🎯 Testing Routing Accuracy");
    let coordinator = FastLLMCoordinator::new();
    test_routing_accuracy(&coordinator).await?;
    
    // Test multi-agent coordination
    println!("\n🤖 Testing Multi-Agent Coordination");
    test_multi_agent_coordination(&coordinator).await?;
    
    // Performance comparison
    println!("\n⚡ Performance Comparison");
    show_performance_comparison(&coordinator).await?;
    
    println!("\n✅ Benchmark completed successfully!");
    Ok(())
}

async fn run_benchmark(
    coordinator: &FastLLMCoordinator,
    total_requests: usize,
    concurrent_requests: usize,
) -> Result<BenchmarkResults, Box<dyn std::error::Error>> {
    let start_time = Instant::now();
    let mut successful_requests = 0;
    let mut total_response_time = 0u128;
    let mut load_balanced_requests = 0;
    
    // Create test requests
    let test_requests = vec![
        ("What is 2+2?", create_simple_context()),
        ("Explain quantum computing", create_complex_context()),
        ("Write a Python function to sort a list", create_technical_context()),
        ("Tell me about the weather", create_simple_context()),
        ("Analyze market trends", create_complex_context()),
    ];
    
    // Run concurrent batches
    for batch_start in (0..total_requests).step_by(concurrent_requests) {
        let batch_end = (batch_start + concurrent_requests).min(total_requests);
        let batch_size = batch_end - batch_start;
        
        let mut batch_tasks = Vec::new();
        
        for i in 0..batch_size {
            let (request, context) = test_requests[i % test_requests.len()].clone();
            let task = coordinator.execute_with_coordination(request, &context);
            batch_tasks.push(task);
        }
        
        // Wait for batch to complete
        let batch_results = futures::future::join_all(batch_tasks).await;
        
        for result in batch_results {
            match result {
                Ok(coordinated_result) => {
                    successful_requests += 1;
                    total_response_time += coordinated_result.metadata.execution_time as u128;
                    if coordinated_result.metadata.was_load_balanced {
                        load_balanced_requests += 1;
                    }
                }
                Err(e) => {
                    eprintln!("Request failed: {}", e);
                }
            }
        }
        
        // Brief pause between batches
        sleep(Duration::from_millis(10)).await;
    }
    
    let elapsed = start_time.elapsed();
    let avg_response_time = if successful_requests > 0 {
        total_response_time as f64 / successful_requests as f64
    } else {
        0.0
    };
    
    let requests_per_second = successful_requests as f64 / elapsed.as_secs_f64();
    let error_rate = (total_requests - successful_requests) as f64 / total_requests as f64;
    let load_balancing_effectiveness = load_balanced_requests as f64 / successful_requests as f64;
    
    Ok(BenchmarkResults {
        total_requests,
        successful_requests,
        avg_response_time,
        requests_per_second,
        error_rate,
        load_balancing_effectiveness,
    })
}

async fn test_routing_accuracy(
    coordinator: &FastLLMCoordinator,
) -> Result<(), Box<dyn std::error::Error>> {
    let test_cases = vec![
        ("Quick question: what is 1+1?", "lfm2"), // Should route to fast model
        ("Write a complex algorithm in Python", "lm-studio"), // Should route to technical service
        ("Analyze this business proposal in detail", "anthropic"), // Should route to analysis service
        ("Generate a creative story", "openai"), // Should route to creative service
        ("Simple definition of AI", "lfm2"), // Should route to fast model
    ];
    
    let mut correct_routings = 0;
    
    for (request, expected_service) in test_cases {
        let context = create_auto_context();
        let decision = coordinator.make_routing_decision(request, &context).await?;
        
        let routed_service = decision.target_service.as_str();
        let is_correct = routed_service == expected_service;
        
        if is_correct {
            correct_routings += 1;
        }
        
        println!("   Request: \"{}\"", request);
        println!("   Expected: {}, Got: {}, Correct: {}", 
                expected_service, routed_service, is_correct);
        println!("   Confidence: {:.2}, Reasoning: {}", 
                decision.confidence, decision.reasoning);
        println!();
    }
    
    let accuracy = correct_routings as f64 / test_cases.len() as f64;
    println!("🎯 Routing Accuracy: {:.2}% ({}/{} correct)", 
             accuracy * 100.0, correct_routings, test_cases.len());
    
    Ok(())
}

async fn test_multi_agent_coordination(
    coordinator: &FastLLMCoordinator,
) -> Result<(), Box<dyn std::error::Error>> {
    let primary_task = "Create a project plan for building a web application";
    let supporting_tasks = vec![
        "List required technologies".to_string(),
        "Estimate development time".to_string(),
        "Identify potential risks".to_string(),
    ];
    
    let start_time = Instant::now();
    let result = coordinator
        .coordinate_multiple_agents(primary_task, &supporting_tasks)
        .await?;
    let elapsed = start_time.elapsed();
    
    println!("🤖 Multi-Agent Coordination Results:");
    println!("   Primary task: {}", primary_task);
    println!("   Supporting tasks: {}", supporting_tasks.len());
    println!("   Total execution time: {}ms", elapsed.as_millis());
    println!("   Services used: {:?}", result.coordination.services_used);
    println!("   Total tokens: {}", result.coordination.total_tokens);
    println!("   Load balancing effectiveness: {:.2}%", 
             result.coordination.load_balancing_effectiveness * 100.0);
    
    Ok(())
}

async fn show_performance_comparison(
    coordinator: &FastLLMCoordinator,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get current performance metrics
    let metrics = coordinator.get_performance_metrics();
    let comparison = coordinator.get_service_performance_comparison();
    
    println!("⚡ System Performance Metrics:");
    println!("   Total requests processed: {}", metrics.total_requests);
    println!("   Success rate: {:.2}%", (1.0 - metrics.error_rate) * 100.0);
    println!("   Average response time: {:.2}ms", metrics.average_response_time);
    println!("   Requests per second: {:.2}", metrics.requests_per_second);
    
    println!("\n🏆 Service Performance Comparison:");
    for (service, perf) in comparison {
        println!("   {}:", service);
        println!("     Requests: {}", perf.total_requests);
        println!("     Success rate: {:.2}%", perf.success_rate * 100.0);
        println!("     Avg response time: {:.2}ms", perf.average_response_time);
        println!("     P95 response time: {:.2}ms", perf.p95_response_time);
        println!("     Tokens/second: {:.2}", perf.tokens_per_second);
    }
    
    Ok(())
}

// Helper functions for creating test contexts
fn create_simple_context() -> CoordinationContext {
    CoordinationContext {
        task_type: "simple_qa".to_string(),
        complexity: "simple".to_string(),
        urgency: UrgencyLevel::High,
        expected_response_length: ResponseLength::Short,
        requires_creativity: false,
        requires_accuracy: false,
        timestamp: current_timestamp(),
    }
}

fn create_complex_context() -> CoordinationContext {
    CoordinationContext {
        task_type: "analysis".to_string(),
        complexity: "complex".to_string(),
        urgency: UrgencyLevel::Medium,
        expected_response_length: ResponseLength::Long,
        requires_creativity: true,
        requires_accuracy: true,
        timestamp: current_timestamp(),
    }
}

fn create_technical_context() -> CoordinationContext {
    CoordinationContext {
        task_type: "code_generation".to_string(),
        complexity: "medium".to_string(),
        urgency: UrgencyLevel::Medium,
        expected_response_length: ResponseLength::Medium,
        requires_creativity: false,
        requires_accuracy: true,
        timestamp: current_timestamp(),
    }
}

fn create_auto_context() -> CoordinationContext {
    CoordinationContext {
        task_type: "auto".to_string(),
        complexity: "auto".to_string(),
        urgency: UrgencyLevel::Medium,
        expected_response_length: ResponseLength::Medium,
        requires_creativity: false,
        requires_accuracy: true,
        timestamp: current_timestamp(),
    }
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

struct BenchmarkResults {
    total_requests: usize,
    successful_requests: usize,
    avg_response_time: f64,
    requests_per_second: f64,
    error_rate: f64,
    load_balancing_effectiveness: f64,
}
