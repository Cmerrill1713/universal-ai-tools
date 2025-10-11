#!/usr/bin/env python3
"""
Direct test of the DSPy development pipeline without WebSocket server
"""
import logging
import os
import sys

# Add the src path to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'services', 'dspy-orchestrator'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    # Import the development pipeline
    from development_pipeline import development_orchestrator
    logger.info("✅ Successfully imported development orchestrator")

    # Test the pipeline with a simple task
    task = "Create a simple TypeScript utility function to validate email addresses"
    tech_stack = "typescript"
    existing_codebase = {}

    logger.info(f"🚀 Testing pipeline with task: {task}")

    result = development_orchestrator.execute_pipeline(
        task=task,
        tech_stack=tech_stack,
        existing_codebase=existing_codebase
    )

    logger.info("✅ Pipeline executed successfully!")
    logger.info("📊 Pipeline Result:")
    for key, value in result.items():
        if key in ['plan', 'code_changes_summary']:
            logger.info(f"  {key}: {value[:100]}...")
        else:
            logger.info(f"  {key}: {value}")

    # Test MIPROv2 optimization
    logger.info("🔧 Testing MIPROv2 optimization...")
    if len(development_orchestrator.optimization_examples) > 0:
        logger.info(f"📈 Optimization examples collected: {len(development_orchestrator.optimization_examples)}")
    else:
        logger.info("📈 No optimization examples yet - need more runs")

except ImportError as e:
    logger.error(f"❌ Import error: {e}")
    sys.exit(1)
except Exception as e:
    logger.error(f"❌ Pipeline test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n🎉 Direct pipeline test completed successfully!")
