use rlvr_service::advanced_experiments::RLVRExperimentRunner;
use anyhow::Result;
use std::env;
use tracing::{info, error};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("🧪 Starting RLVR Advanced Experiments...");

    // Create experiment runner
    let runner = RLVRExperimentRunner::new();

    // Run comprehensive experiment
    match runner.run_comprehensive_experiment().await {
        Ok(results) => {
            info!("🎉 Experiment completed successfully!");
            info!("📊 Final Results:");
            info!("  Success Rate: {:.1}%", results.success_rate * 100.0);
            info!("  Average Confidence: {:.3}", results.average_confidence);
            info!("  Average Iterations: {:.1}", results.average_iterations);
            info!("  Convergence Rate: {:.1}%", results.convergence_rate * 100.0);
            
            info!("💡 Key Insights:");
            for insight in &results.insights {
                info!("  • {}", insight);
            }
        }
        Err(e) => {
            error!("❌ Experiment failed: {}", e);
            return Err(e);
        }
    }

    info!("🏁 Advanced experiments completed");
    Ok(())
}
