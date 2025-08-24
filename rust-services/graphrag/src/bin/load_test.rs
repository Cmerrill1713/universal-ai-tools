//! Load test binary for GraphRAG service performance validation
//! 
//! Usage:
//!   cargo run --bin load_test -- --help
//!   cargo run --bin load_test -- --concurrent-users 100 --duration 600
//!   cargo run --bin load_test -- --config load_test_config.json

use anyhow::{Result, Context};
use clap::{Arg, Command};
use std::{path::Path, time::Duration};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

// Import load test module
use graphrag_service::load_test::{LoadTestConfig, LoadTestRunner, LoadTestResults, TestScenario};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .context("Failed to set tracing subscriber")?;

    // Parse command line arguments
    let matches = Command::new("GraphRAG Load Test")
        .version("1.0.0")
        .about("Load testing suite for GraphRAG service performance validation")
        .arg(
            Arg::new("config")
                .long("config")
                .short('c')
                .value_name("FILE")
                .help("Load test configuration file (JSON)")
        )
        .arg(
            Arg::new("service-url")
                .long("service-url")
                .short('u')
                .value_name("URL")
                .default_value("http://localhost:8000")
                .help("GraphRAG service URL")
        )
        .arg(
            Arg::new("concurrent-users")
                .long("concurrent-users")
                .short('n')
                .value_name("NUMBER")
                .default_value("50")
                .help("Number of concurrent users to simulate")
        )
        .arg(
            Arg::new("duration")
                .long("duration")
                .short('d')
                .value_name("SECONDS")
                .default_value("300")
                .help("Test duration in seconds")
        )
        .arg(
            Arg::new("rps")
                .long("requests-per-second")
                .short('r')
                .value_name("NUMBER")
                .default_value("2.0")
                .help("Requests per second per user")
        )
        .arg(
            Arg::new("timeout")
                .long("timeout")
                .short('t')
                .value_name("SECONDS")
                .default_value("30")
                .help("Request timeout in seconds")
        )
        .arg(
            Arg::new("scenarios")
                .long("scenarios")
                .short('s')
                .value_name("LIST")
                .default_value("all")
                .help("Test scenarios: all, extract, search, hybrid, cache, pool, e2e")
        )
        .arg(
            Arg::new("detailed")
                .long("detailed")
                .action(clap::ArgAction::SetTrue)
                .help("Enable detailed metrics collection")
        )
        .get_matches();

    // Load configuration
    let config = if let Some(config_path) = matches.get_one::<String>("config") {
        load_config_from_file(config_path).await?
    } else {
        build_config_from_args(&matches)?
    };

    info!("🚀 Starting GraphRAG Load Test");
    info!("📊 Configuration:");
    info!("  Service URL: {}", config.service_url);
    info!("  Concurrent Users: {}", config.concurrent_users);
    info!("  Test Duration: {:?}", config.test_duration);
    info!("  Requests/Second/User: {}", config.requests_per_second);
    info!("  Request Timeout: {:?}", config.request_timeout);
    info!("  Scenarios: {:?}", config.scenarios);

    // Run load test
    let runner = LoadTestRunner::new(config);
    let results = runner.run().await?;

    // Validate results and provide recommendations
    validate_performance_results(&results);

    Ok(())
}

/// Load configuration from JSON file
async fn load_config_from_file(path: &str) -> Result<LoadTestConfig> {
    if !Path::new(path).exists() {
        return Err(anyhow::anyhow!("Configuration file not found: {}", path));
    }

    let content = tokio::fs::read_to_string(path)
        .await
        .context("Failed to read configuration file")?;

    let config: LoadTestConfig = serde_json::from_str(&content)
        .context("Failed to parse configuration file")?;

    Ok(config)
}

/// Build configuration from command line arguments
fn build_config_from_args(matches: &clap::ArgMatches) -> Result<LoadTestConfig> {
    let service_url = matches.get_one::<String>("service-url").unwrap().clone();
    
    let concurrent_users = matches.get_one::<String>("concurrent-users")
        .unwrap()
        .parse::<usize>()
        .context("Invalid concurrent-users value")?;

    let duration_secs = matches.get_one::<String>("duration")
        .unwrap()
        .parse::<u64>()
        .context("Invalid duration value")?;

    let requests_per_second = matches.get_one::<String>("rps")
        .unwrap()
        .parse::<f64>()
        .context("Invalid requests-per-second value")?;

    let timeout_secs = matches.get_one::<String>("timeout")
        .unwrap()
        .parse::<u64>()
        .context("Invalid timeout value")?;

    let scenarios_str = matches.get_one::<String>("scenarios").unwrap();
    let scenarios = parse_scenarios(scenarios_str)?;

    let detailed_metrics = matches.get_flag("detailed");

    Ok(LoadTestConfig {
        service_url,
        concurrent_users,
        test_duration: Duration::from_secs(duration_secs),
        requests_per_second,
        scenarios,
        request_timeout: Duration::from_secs(timeout_secs),
        detailed_metrics,
    })
}

/// Parse test scenarios from string
fn parse_scenarios(scenarios_str: &str) -> Result<Vec<TestScenario>> {
    if scenarios_str == "all" {
        return Ok(vec![
            TestScenario::EntityExtraction,
            TestScenario::VectorSearch,
            TestScenario::HybridSearch,
            TestScenario::CacheTest,
            TestScenario::ConnectionPoolTest,
            TestScenario::EndToEndWorkflow,
        ]);
    }

    let mut scenarios = Vec::new();
    for scenario_str in scenarios_str.split(',') {
        let scenario = match scenario_str.trim() {
            "extract" => TestScenario::EntityExtraction,
            "search" => TestScenario::VectorSearch,
            "hybrid" => TestScenario::HybridSearch,
            "cache" => TestScenario::CacheTest,
            "pool" => TestScenario::ConnectionPoolTest,
            "e2e" => TestScenario::EndToEndWorkflow,
            _ => return Err(anyhow::anyhow!("Unknown scenario: {}", scenario_str)),
        };
        scenarios.push(scenario);
    }

    if scenarios.is_empty() {
        return Err(anyhow::anyhow!("No valid scenarios specified"));
    }

    Ok(scenarios)
}

/// Validate performance results and provide recommendations
fn validate_performance_results(results: &LoadTestResults) {
    println!("🔍 PERFORMANCE ANALYSIS");
    println!("=======================");

    // Error rate validation
    if results.error_rate_percent > 5.0 {
        println!("❌ HIGH ERROR RATE: {:.2}% (target: <5%)", results.error_rate_percent);
        println!("   → Check service health and scaling");
    } else if results.error_rate_percent > 1.0 {
        println!("⚠️  MODERATE ERROR RATE: {:.2}% (target: <1%)", results.error_rate_percent);
    } else {
        println!("✅ LOW ERROR RATE: {:.2}%", results.error_rate_percent);
    }

    // Response time validation
    if results.avg_response_time_ms > 1000.0 {
        println!("❌ HIGH RESPONSE TIME: {:.2}ms (target: <500ms)", results.avg_response_time_ms);
        println!("   → Consider database optimization or caching");
    } else if results.avg_response_time_ms > 500.0 {
        println!("⚠️  MODERATE RESPONSE TIME: {:.2}ms", results.avg_response_time_ms);
    } else {
        println!("✅ GOOD RESPONSE TIME: {:.2}ms", results.avg_response_time_ms);
    }

    // P99 latency validation
    if results.p99_response_time_ms > 5000.0 {
        println!("❌ HIGH P99 LATENCY: {:.2}ms (target: <2000ms)", results.p99_response_time_ms);
        println!("   → Investigate tail latency causes");
    } else if results.p99_response_time_ms > 2000.0 {
        println!("⚠️  MODERATE P99 LATENCY: {:.2}ms", results.p99_response_time_ms);
    } else {
        println!("✅ GOOD P99 LATENCY: {:.2}ms", results.p99_response_time_ms);
    }

    // Throughput validation
    let expected_min_rps = 100.0; // Minimum expected throughput
    if results.requests_per_second < expected_min_rps {
        println!("❌ LOW THROUGHPUT: {:.2} RPS (target: >{:.0} RPS)", 
                 results.requests_per_second, expected_min_rps);
        println!("   → Check connection pooling and async handling");
    } else {
        println!("✅ GOOD THROUGHPUT: {:.2} RPS", results.requests_per_second);
    }

    // Cache performance validation
    if let Some(cache_hit_rate) = results.cache_hit_rate_percent {
        if cache_hit_rate < 50.0 {
            println!("❌ LOW CACHE HIT RATE: {:.2}% (target: >80%)", cache_hit_rate);
            println!("   → Review cache TTL and key strategies");
        } else if cache_hit_rate < 80.0 {
            println!("⚠️  MODERATE CACHE HIT RATE: {:.2}%", cache_hit_rate);
        } else {
            println!("✅ EXCELLENT CACHE HIT RATE: {:.2}%", cache_hit_rate);
        }
    }

    println!("\n💡 RECOMMENDATIONS");
    println!("==================");
    
    if results.error_rate_percent > 1.0 {
        println!("• Investigate and fix error sources");
        println!("• Check database connection limits");
        println!("• Verify service health endpoints");
    }
    
    if results.avg_response_time_ms > 500.0 {
        println!("• Enable Redis caching for frequent queries");
        println!("• Optimize database connection pooling");
        println!("• Consider request batching");
    }
    
    if results.p99_response_time_ms > 2000.0 {
        println!("• Implement circuit breakers for external calls");
        println!("• Add request timeouts and retries");
        println!("• Profile slow query patterns");
    }

    if let Some(cache_hit_rate) = results.cache_hit_rate_percent {
        if cache_hit_rate < 80.0 {
            println!("• Tune Redis cache TTL settings");
            println!("• Implement cache warming strategies");
            println!("• Review cache key namespace organization");
        }
    }

    println!("\n🎯 OVERALL ASSESSMENT");
    println!("====================");
    
    let score = calculate_performance_score(results);
    match score {
        90..=100 => println!("🟢 EXCELLENT: Score {}/100 - Production ready!", score),
        75..=89 => println!("🟡 GOOD: Score {}/100 - Minor optimizations needed", score),
        60..=74 => println!("🟠 FAIR: Score {}/100 - Significant improvements required", score),
        _ => println!("🔴 POOR: Score {}/100 - Major performance issues detected", score),
    }
}

/// Calculate overall performance score
fn calculate_performance_score(results: &LoadTestResults) -> u8 {
    let mut score = 100;

    // Error rate penalty
    if results.error_rate_percent > 5.0 {
        score -= 30;
    } else if results.error_rate_percent > 1.0 {
        score -= 10;
    }

    // Response time penalty
    if results.avg_response_time_ms > 1000.0 {
        score -= 25;
    } else if results.avg_response_time_ms > 500.0 {
        score -= 10;
    }

    // P99 latency penalty
    if results.p99_response_time_ms > 5000.0 {
        score -= 20;
    } else if results.p99_response_time_ms > 2000.0 {
        score -= 10;
    }

    // Throughput penalty
    if results.requests_per_second < 50.0 {
        score -= 20;
    } else if results.requests_per_second < 100.0 {
        score -= 10;
    }

    // Cache performance bonus/penalty
    if let Some(cache_hit_rate) = results.cache_hit_rate_percent {
        if cache_hit_rate > 90.0 {
            score += 5; // Bonus for excellent caching
        } else if cache_hit_rate < 50.0 {
            score -= 15;
        }
    }

    score.max(0) as u8
}