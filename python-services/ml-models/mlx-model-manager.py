#!/usr/bin/env python3

"""
MLX Model Management System
Handles model deployment, retirement, and lifecycle management based on performance grades
"""

import json
import time
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ModelManager:
    """Manages MLX model lifecycle based on performance grades"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or "mlx-grading-config.json"
        self.adapters_root = Path("mlx-adapters")
        self.production_path = self.adapters_root / "production"
        self.retired_path = self.adapters_root / "retired"
        self.staging_path = self.adapters_root / "staging"
        
        # Ensure directories exist
        self.production_path.mkdir(parents=True, exist_ok=True)
        self.retired_path.mkdir(parents=True, exist_ok=True)
        self.staging_path.mkdir(parents=True, exist_ok=True)
        
        self.load_config()
    
    def load_config(self):
        """Load grading configuration"""
        try:
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
            logger.info(f"✅ Loaded configuration from {self.config_path}")
        except FileNotFoundError:
            logger.warning(f"⚠️ Config file not found: {self.config_path}")
            self.config = self._get_default_config()
    
    def _get_default_config(self):
        """Get default configuration if config file is missing"""
        return {
            "deployment_rules": {
                "auto_deploy_grades": ["A", "B"],
                "manual_review_grades": ["C"],
                "reject_grades": ["D", "F"],
                "auto_retire_grades": ["D", "F"]
            },
            "domain_specific_metrics": {
                "minimum_production_score": 75.0,
                "target_domain_accuracy": 90.0
            }
        }
    
    def process_new_model(self, model_path: str, performance_report: Dict) -> Dict:
        """Process a newly trained model based on its performance grade"""
        logger.info(f"🔄 Processing new model: {model_path}")
        
        grade = performance_report.get('grade', 'F')
        score = performance_report.get('score', 0.0)
        
        result = {
            'model_path': model_path,
            'grade': grade,
            'score': score,
            'processed_at': datetime.now().isoformat(),
            'action_taken': None,
            'deployment_status': None
        }
        
        # Get deployment rules
        rules = self.config['deployment_rules']
        
        if grade in rules.get('auto_deploy_grades', []):
            result['action_taken'] = 'auto_deploy'
            result['deployment_status'] = self._deploy_to_production(model_path, performance_report)
            
        elif grade in rules.get('manual_review_grades', []):
            result['action_taken'] = 'manual_review'
            result['deployment_status'] = self._move_to_staging(model_path, performance_report)
            
        elif grade in rules.get('reject_grades', []):
            result['action_taken'] = 'reject'
            result['deployment_status'] = self._reject_model(model_path, performance_report)
            
        else:
            result['action_taken'] = 'unknown_grade'
            result['deployment_status'] = 'error'
            logger.error(f"❌ Unknown grade: {grade}")
        
        # Log the decision
        self._log_model_decision(result)
        
        return result
    
    def _deploy_to_production(self, model_path: str, performance_report: Dict) -> str:
        """Deploy model to production"""
        try:
            source_path = Path(model_path)
            
            # Backup current production model if it exists
            if self.production_path.exists() and any(self.production_path.iterdir()):
                backup_name = f"backup_{int(time.time())}"
                backup_path = self.adapters_root / backup_name
                shutil.copytree(self.production_path, backup_path)
                logger.info(f"📦 Backed up current production model to {backup_name}")
            
            # Clear production directory and copy new model
            if self.production_path.exists():
                shutil.rmtree(self.production_path)
            shutil.copytree(source_path, self.production_path)
            
            # Create deployment record
            deployment_record = {
                'deployed_at': datetime.now().isoformat(),
                'model_path': str(source_path),
                'performance_grade': performance_report,
                'deployment_method': 'auto_deploy',
                'status': 'active'
            }
            
            with open(self.production_path / 'deployment.json', 'w') as f:
                json.dump(deployment_record, f, indent=2)
            
            logger.info(f"🚀 Successfully deployed model to production")
            return 'deployed'
            
        except Exception as e:
            logger.error(f"❌ Production deployment failed: {e}")
            return 'failed'
    
    def _move_to_staging(self, model_path: str, performance_report: Dict) -> str:
        """Move model to staging for manual review"""
        try:
            source_path = Path(model_path)
            staging_name = f"review_{int(time.time())}"
            staging_model_path = self.staging_path / staging_name
            
            shutil.copytree(source_path, staging_model_path)
            
            # Create review record
            review_record = {
                'staged_at': datetime.now().isoformat(),
                'model_path': str(source_path),
                'performance_grade': performance_report,
                'requires_review': True,
                'reviewer': None,
                'review_decision': None,
                'review_notes': None
            }
            
            with open(staging_model_path / 'review.json', 'w') as f:
                json.dump(review_record, f, indent=2)
            
            logger.info(f"📋 Model moved to staging for review: {staging_name}")
            return 'staged'
            
        except Exception as e:
            logger.error(f"❌ Staging failed: {e}")
            return 'failed'
    
    def _reject_model(self, model_path: str, performance_report: Dict) -> str:
        """Reject model due to poor performance"""
        try:
            source_path = Path(model_path)
            rejected_name = f"rejected_{int(time.time())}"
            rejected_model_path = self.retired_path / rejected_name
            
            shutil.copytree(source_path, rejected_model_path)
            
            # Create rejection record
            rejection_record = {
                'rejected_at': datetime.now().isoformat(),
                'model_path': str(source_path),
                'performance_grade': performance_report,
                'rejection_reason': f"Grade {performance_report.get('grade')} below minimum standards",
                'recommendations': performance_report.get('recommendations', [])
            }
            
            with open(rejected_model_path / 'rejection.json', 'w') as f:
                json.dump(rejection_record, f, indent=2)
            
            logger.info(f"🗑️ Model rejected and archived: {rejected_name}")
            return 'rejected'
            
        except Exception as e:
            logger.error(f"❌ Rejection failed: {e}")
            return 'failed'
    
    def _log_model_decision(self, result: Dict):
        """Log model management decision"""
        log_file = self.adapters_root / "model_management.log"
        
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'decision': result
        }
        
        # Append to log file
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
    
    def retire_old_models(self, days_old: int = 30) -> List[str]:
        """Retire models older than specified days"""
        retired_models = []
        cutoff_date = datetime.now() - timedelta(days=days_old)
        
        # Check production models
        if self.production_path.exists():
            deployment_file = self.production_path / "deployment.json"
            if deployment_file.exists():
                with open(deployment_file, 'r') as f:
                    deployment_data = json.load(f)
                
                deployed_at = datetime.fromisoformat(deployment_data.get('deployed_at', ''))
                if deployed_at < cutoff_date:
                    retired_name = f"retired_production_{int(time.time())}"
                    retired_path = self.retired_path / retired_name
                    shutil.copytree(self.production_path, retired_path)
                    retired_models.append(retired_name)
                    logger.info(f"🗄️ Retired old production model: {retired_name}")
        
        return retired_models
    
    def get_model_status(self) -> Dict:
        """Get current model status across all environments"""
        status = {
            'production': None,
            'staging': [],
            'retired': [],
            'summary': {
                'total_models': 0,
                'production_models': 0,
                'staging_models': 0,
                'retired_models': 0
            }
        }
        
        # Check production
        if self.production_path.exists() and any(self.production_path.iterdir()):
            deployment_file = self.production_path / "deployment.json"
            if deployment_file.exists():
                with open(deployment_file, 'r') as f:
                    status['production'] = json.load(f)
                status['summary']['production_models'] = 1
        
        # Check staging
        if self.staging_path.exists():
            for model_dir in self.staging_path.iterdir():
                if model_dir.is_dir():
                    review_file = model_dir / "review.json"
                    if review_file.exists():
                        with open(review_file, 'r') as f:
                            review_data = json.load(f)
                            review_data['model_name'] = model_dir.name
                            status['staging'].append(review_data)
            status['summary']['staging_models'] = len(status['staging'])
        
        # Check retired
        if self.retired_path.exists():
            status['summary']['retired_models'] = len([d for d in self.retired_path.iterdir() if d.is_dir()])
        
        status['summary']['total_models'] = (
            status['summary']['production_models'] + 
            status['summary']['staging_models'] + 
            status['summary']['retired_models']
        )
        
        return status

def main():
    """Demo of model management system"""
    manager = ModelManager()
    
    # Display current status
    status = manager.get_model_status()
    print("📊 Current Model Status:")
    print(f"  Production Models: {status['summary']['production_models']}")
    print(f"  Staging Models: {status['summary']['staging_models']}")
    print(f"  Retired Models: {status['summary']['retired_models']}")
    print(f"  Total Models: {status['summary']['total_models']}")
    
    # Show production model details if available
    if status['production']:
        prod_model = status['production']
        print(f"\n🚀 Production Model:")
        print(f"  Deployed: {prod_model.get('deployed_at', 'Unknown')}")
        if 'performance_grade' in prod_model:
            grade_info = prod_model['performance_grade']
            print(f"  Grade: {grade_info.get('grade', 'N/A')}")
            print(f"  Score: {grade_info.get('score', 0):.1f}%")

if __name__ == "__main__":
    main()