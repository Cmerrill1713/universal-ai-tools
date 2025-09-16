#!/usr/bin/env python3
"""
Experiment with different development tasks to validate DSPy pipeline capabilities
"""
import sys
import os
import logging
import json

# Add the src path to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'services', 'dspy-orchestrator'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_task(task_description, tech_stack="typescript,rust,go,python"):
    """Test a specific development task"""
    logger.info(f"\n{'='*60}")
    logger.info(f"🧪 Testing Task: {task_description}")
    logger.info(f"📋 Tech Stack: {tech_stack}")
    logger.info(f"{'='*60}")

    try:
        from development_pipeline import development_orchestrator

        result = development_orchestrator.execute_pipeline(
            task=task_description,
            tech_stack=tech_stack,
            existing_codebase={}
        )

        # Display results
        logger.info("✅ Task completed successfully!")
        logger.info(f"📝 Plan: {result.get('plan', 'N/A')[:200]}...")
        logger.info(f"📁 Files to change: {len(result.get('files_to_change', []))}")
        logger.info(f"🧪 Tests suggested: {len(result.get('new_tests', []))}")
        logger.info(f"📊 Patches generated: {len(result.get('patches', []))}")

        # Show first patch if available
        patches = result.get('patches', [])
        if patches:
            first_patch = patches[0]
            logger.info(f"🔧 Sample patch preview:")
            if isinstance(first_patch, dict):
                logger.info(f"   File: {first_patch.get('path', 'unknown')}")
                patch_content = first_patch.get('patch_unified', str(first_patch))[:300]
            else:
                patch_content = str(first_patch)[:300]
            logger.info(f"   {patch_content}{'...' if len(patch_content) > 300 else ''}")

        return True, result

    except Exception as e:
        logger.error(f"❌ Task failed: {e}")
        import traceback
        traceback.print_exc()
        return False, str(e)

def main():
    """Run multiple experiments with different task types"""
    logger.info("🚀 Starting DSPy Development Pipeline Experiments")

    # Define test tasks with different complexity levels
    test_tasks = [
        # Simple utility tasks
        {
            "description": "Create a TypeScript function to calculate fibonacci numbers",
            "tech_stack": "typescript"
        },
        {
            "description": "Add error handling to a REST API endpoint in Express.js",
            "tech_stack": "typescript,node"
        },

        # Data processing tasks
        {
            "description": "Implement a data validation pipeline for user registration",
            "tech_stack": "typescript,rust"
        },

        # Complex multi-step tasks
        {
            "description": "Build a simple task management system with CRUD operations",
            "tech_stack": "typescript,rust,go"
        },

        # Code refactoring tasks
        {
            "description": "Refactor a monolithic function into smaller, testable modules",
            "tech_stack": "typescript,python"
        },

        # Integration tasks
        {
            "description": "Integrate authentication middleware with existing API routes",
            "tech_stack": "typescript,node"
        }
    ]

    results = []

    for i, task in enumerate(test_tasks, 1):
        logger.info(f"\n🎯 Experiment {i}/{len(test_tasks)}")

        success, result = test_task(
            task["description"],
            task["tech_stack"]
        )

        results.append({
            "experiment": i,
            "task": task["description"],
            "tech_stack": task["tech_stack"],
            "success": success,
            "result": result if success else str(result)
        })

    # Summary report
    logger.info(f"\n{'='*80}")
    logger.info("📊 EXPERIMENT SUMMARY REPORT")
    logger.info(f"{'='*80}")

    successful = sum(1 for r in results if r["success"])
    total = len(results)

    logger.info(f"✅ Successful experiments: {successful}/{total} ({successful/total*100:.1f}%)")

    if successful > 0:
        logger.info("\n🎉 SUCCESSFUL TASK TYPES:")
        for r in results:
            if r["success"]:
                logger.info(f"   • {r['task'][:60]}{'...' if len(r['task']) > 60 else ''}")

    if successful < total:
        logger.info("\n❌ FAILED TASK TYPES:")
        for r in results:
            if not r["success"]:
                logger.info(f"   • {r['task'][:60]}{'...' if len(r['task']) > 60 else ''}")
                logger.info(f"     Error: {r['result'][:100]}{'...' if len(str(r['result'])) > 100 else ''}")

    # Save detailed results
    with open("experiment_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

    logger.info("\n💾 Detailed results saved to experiment_results.json")

    # Test MIPROv2 optimization
    try:
        from development_pipeline import development_orchestrator
        logger.info(f"\n🔧 MIPROv2 Status:")
        logger.info(f"   Examples collected: {len(development_orchestrator.optimization_examples)}")
        logger.info(f"   Optimization threshold: {development_orchestrator.optimization_threshold}")

        if len(development_orchestrator.optimization_examples) >= development_orchestrator.optimization_threshold:
            logger.info("   ✅ Ready for MIPROv2 optimization!")
        else:
            examples_needed = development_orchestrator.optimization_threshold - len(development_orchestrator.optimization_examples)
            logger.info(f"   ⏳ Need {examples_needed} more examples for optimization")

    except Exception as e:
        logger.error(f"Error checking MIPROv2 status: {e}")

    logger.info("\n🎊 Experiments completed!")

if __name__ == "__main__":
    main()
