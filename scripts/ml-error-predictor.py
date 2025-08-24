#!/usr/bin/env python3
"""
ML-based Error Prediction and Auto-Healing System
Predicts and prevents errors before they occur
"""

import json
import time
import logging
import subprocess
import psutil
import numpy as np
from datetime import datetime, timedelta
from collections import deque
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class ErrorPredictor:
    """Predicts system errors using pattern recognition"""
    
    def __init__(self):
        self.error_patterns = deque(maxlen=1000)
        self.metrics_history = deque(maxlen=100)
        self.predictions = {}
        self.thresholds = {
            'memory': 80,
            'cpu': 85,
            'disk': 90,
            'response_time': 1000,
            'error_rate': 0.05
        }
        
    def collect_metrics(self) -> Dict:
        """Collect system and service metrics"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'memory': psutil.virtual_memory().percent,
            'cpu': psutil.cpu_percent(interval=1),
            'disk': psutil.disk_usage('/').percent,
            'network': self._get_network_stats(),
            'processes': len(psutil.pids()),
            'load_avg': psutil.getloadavg()[0]
        }
        
        # Check service health
        services = {
            'go-api-gateway': 8080,
            'rust-llm-router': 8082,
            'rust-ai-core': 8083
        }
        
        for service, port in services.items():
            metrics[f'{service}_healthy'] = self._check_port(port)
            
        self.metrics_history.append(metrics)
        return metrics
    
    def _get_network_stats(self) -> Dict:
        """Get network statistics"""
        stats = psutil.net_io_counters()
        return {
            'bytes_sent': stats.bytes_sent,
            'bytes_recv': stats.bytes_recv,
            'packets_dropped': stats.dropin + stats.dropout
        }
    
    def _check_port(self, port: int) -> bool:
        """Check if a port is listening"""
        for conn in psutil.net_connections():
            if conn.laddr.port == port and conn.status == 'LISTEN':
                return True
        return False
    
    def analyze_patterns(self) -> Dict[str, float]:
        """Analyze patterns to predict errors"""
        if len(self.metrics_history) < 10:
            return {}
        
        predictions = {}
        
        # Memory leak detection
        memory_trend = self._calculate_trend([m['memory'] for m in self.metrics_history])
        if memory_trend > 0.5:  # Rising trend
            predictions['memory_leak'] = min(memory_trend * 100, 95)
        
        # CPU spike prediction
        cpu_values = [m['cpu'] for m in self.metrics_history]
        cpu_volatility = np.std(cpu_values) if cpu_values else 0
        if cpu_volatility > 20:
            predictions['cpu_spike'] = min(cpu_volatility * 2, 90)
        
        # Service failure prediction
        for service in ['go-api-gateway', 'rust-llm-router', 'rust-ai-core']:
            key = f'{service}_healthy'
            health_history = [m.get(key, True) for m in self.metrics_history[-10:]]
            failure_rate = health_history.count(False) / len(health_history)
            if failure_rate > 0.2:
                predictions[f'{service}_failure'] = failure_rate * 100
        
        # Network congestion prediction
        if len(self.metrics_history) > 1:
            recent_network = self.metrics_history[-1].get('network', {})
            prev_network = self.metrics_history[-2].get('network', {})
            
            if recent_network and prev_network:
                packet_loss_rate = recent_network.get('packets_dropped', 0) - prev_network.get('packets_dropped', 0)
                if packet_loss_rate > 100:
                    predictions['network_congestion'] = min(packet_loss_rate / 10, 80)
        
        self.predictions = predictions
        return predictions
    
    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend using linear regression"""
        if len(values) < 2:
            return 0
        
        x = np.arange(len(values))
        y = np.array(values)
        
        # Simple linear regression
        n = len(values)
        slope = (n * np.sum(x * y) - np.sum(x) * np.sum(y)) / (n * np.sum(x**2) - np.sum(x)**2)
        
        return slope
    
    def recommend_actions(self) -> List[Dict]:
        """Recommend preventive actions based on predictions"""
        actions = []
        
        for issue, probability in self.predictions.items():
            if probability < 50:
                continue
                
            if 'memory_leak' in issue:
                actions.append({
                    'issue': issue,
                    'probability': probability,
                    'action': 'trigger_memory_cleanup',
                    'command': 'scripts/optimize-memory.sh'
                })
            
            elif 'cpu_spike' in issue:
                actions.append({
                    'issue': issue,
                    'probability': probability,
                    'action': 'scale_resources',
                    'command': 'scripts/scale-services.sh up'
                })
            
            elif '_failure' in issue:
                service = issue.replace('_failure', '')
                actions.append({
                    'issue': issue,
                    'probability': probability,
                    'action': 'preemptive_restart',
                    'command': f'scripts/restart-service.sh {service}'
                })
            
            elif 'network_congestion' in issue:
                actions.append({
                    'issue': issue,
                    'probability': probability,
                    'action': 'optimize_network',
                    'command': 'scripts/optimize-network.sh'
                })
        
        return actions


class AutoHealer:
    """Executes healing actions based on predictions"""
    
    def __init__(self):
        self.predictor = ErrorPredictor()
        self.action_history = deque(maxlen=100)
        self.cooldown_period = 300  # 5 minutes between same actions
        
    def run_healing_cycle(self):
        """Run one cycle of prediction and healing"""
        # Collect metrics
        metrics = self.predictor.collect_metrics()
        logging.info(f"Metrics: CPU={metrics['cpu']:.1f}%, Memory={metrics['memory']:.1f}%")
        
        # Analyze patterns
        predictions = self.predictor.analyze_patterns()
        
        if predictions:
            logging.info(f"Predictions: {predictions}")
        
        # Get recommended actions
        actions = self.predictor.recommend_actions()
        
        # Execute actions
        for action in actions:
            if self._can_execute_action(action):
                self._execute_action(action)
    
    def _can_execute_action(self, action: Dict) -> bool:
        """Check if action can be executed (cooldown check)"""
        action_key = action['action']
        
        # Check cooldown
        for past_action in self.action_history:
            if past_action['action'] == action_key:
                time_diff = datetime.now() - past_action['timestamp']
                if time_diff.total_seconds() < self.cooldown_period:
                    logging.info(f"Action {action_key} in cooldown period")
                    return False
        
        return True
    
    def _execute_action(self, action: Dict):
        """Execute a healing action"""
        logging.warning(f"🔧 Executing healing action: {action['action']} (probability: {action['probability']:.1f}%)")
        
        # Record action
        self.action_history.append({
            'action': action['action'],
            'timestamp': datetime.now(),
            'issue': action['issue']
        })
        
        # Execute command
        if 'command' in action:
            try:
                result = subprocess.run(
                    action['command'],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    logging.info(f"✅ Action successful: {action['action']}")
                else:
                    logging.error(f"❌ Action failed: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                logging.error(f"⏱️ Action timed out: {action['action']}")
            except Exception as e:
                logging.error(f"❌ Error executing action: {e}")
    
    def start_monitoring(self, interval: int = 30):
        """Start continuous monitoring and healing"""
        logging.info("🚀 Starting ML-based auto-healing system...")
        
        try:
            while True:
                self.run_healing_cycle()
                time.sleep(interval)
                
        except KeyboardInterrupt:
            logging.info("👋 Shutting down auto-healing system...")
        except Exception as e:
            logging.error(f"❌ Unexpected error: {e}")
            # Restart after error
            time.sleep(10)
            self.start_monitoring(interval)


class ErrorPatternLearner:
    """Learn from error patterns to improve predictions"""
    
    def __init__(self):
        self.error_database = []
        self.pattern_weights = {}
        
    def record_error(self, error_type: str, context: Dict):
        """Record an error occurrence"""
        self.error_database.append({
            'timestamp': datetime.now(),
            'type': error_type,
            'context': context
        })
        
        # Update pattern weights
        self._update_weights(error_type, context)
    
    def _update_weights(self, error_type: str, context: Dict):
        """Update pattern weights based on error occurrence"""
        # Extract features from context
        features = {
            'high_memory': context.get('memory', 0) > 80,
            'high_cpu': context.get('cpu', 0) > 85,
            'time_of_day': datetime.now().hour,
            'day_of_week': datetime.now().weekday()
        }
        
        # Update weights
        pattern_key = f"{error_type}_{hash(frozenset(features.items()))}"
        self.pattern_weights[pattern_key] = self.pattern_weights.get(pattern_key, 0) + 1
    
    def predict_error_likelihood(self, error_type: str, context: Dict) -> float:
        """Predict likelihood of error based on learned patterns"""
        features = {
            'high_memory': context.get('memory', 0) > 80,
            'high_cpu': context.get('cpu', 0) > 85,
            'time_of_day': datetime.now().hour,
            'day_of_week': datetime.now().weekday()
        }
        
        pattern_key = f"{error_type}_{hash(frozenset(features.items()))}"
        weight = self.pattern_weights.get(pattern_key, 0)
        
        # Normalize to probability
        total_weight = sum(self.pattern_weights.values()) or 1
        return (weight / total_weight) * 100


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ML-based Auto-Healing System')
    parser.add_argument('--interval', type=int, default=30, help='Check interval in seconds')
    parser.add_argument('--mode', choices=['monitor', 'predict', 'learn'], default='monitor')
    
    args = parser.parse_args()
    
    if args.mode == 'monitor':
        healer = AutoHealer()
        healer.start_monitoring(args.interval)
    
    elif args.mode == 'predict':
        predictor = ErrorPredictor()
        metrics = predictor.collect_metrics()
        predictions = predictor.analyze_patterns()
        print(json.dumps({
            'metrics': metrics,
            'predictions': predictions,
            'recommendations': predictor.recommend_actions()
        }, indent=2, default=str))
    
    elif args.mode == 'learn':
        learner = ErrorPatternLearner()
        # In production, this would load historical data
        print("Learning mode: Analyzing historical patterns...")


if __name__ == '__main__':
    main()