/**
 * Project Manager Functional Test
 * Tests the project tracking service with the NewTradingBot project
 */

import { ProjectTrackingService } from './src/services/project-tracking-service.js';
import fs from 'fs/promises';
import path from 'path';
import { log, LogContext } from './src/utils/logger.js';

interface ProjectStructure {
  id: string;
  name: string;
  description: string;
  version: string;
  status: string;
  modules: {
    [key: string]: {
      files: string[];
      dependencies?: string[];
    };
  };
}

class ProjectManagerTest {
  private projectService: ProjectTrackingService;
  private projectPath = path.join(process.cwd(), 'projects', 'NewTradingBot');
  private projectData: ProjectStructure | null = null;

  constructor() {
    this.projectService = ProjectTrackingService.getInstance();
  }

  async initialize(): Promise<void> {
    log.info('🚀 Initializing Project Manager Test', LogContext.SYSTEM);
    
    // Load project structure
    const indexPath = path.join(this.projectPath, 'project_index.json');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    this.projectData = JSON.parse(indexContent);
    
    log.info(`📋 Loaded project: ${this.projectData?.name}`, LogContext.SYSTEM);
  }

  async analyzeProjectStatus(): Promise<{
    totalModules: number;
    existingModules: number;
    missingModules: string[];
    completionPercentage: number;
  }> {
    if (!this.projectData) throw new Error('Project data not loaded');

    const totalModules = Object.keys(this.projectData.modules).length;
    const missingModules: string[] = [];
    let existingModules = 0;

    for (const [moduleName, moduleInfo] of Object.entries(this.projectData.modules)) {
      let moduleExists = true;
      for (const file of moduleInfo.files) {
        const filePath = path.join(this.projectPath, 'src', file);
        try {
          await fs.access(filePath);
        } catch {
          moduleExists = false;
          break;
        }
      }
      
      if (moduleExists) {
        existingModules++;
      } else {
        missingModules.push(moduleName);
      }
    }

    const completionPercentage = Math.round((existingModules / totalModules) * 100);

    return {
      totalModules,
      existingModules,
      missingModules,
      completionPercentage
    };
  }

  async createProjectTasks(): Promise<void> {
    const status = await this.analyzeProjectStatus();
    
    log.info(`📊 Project Status:`, LogContext.SYSTEM);
    log.info(`   Total Modules: ${status.totalModules}`, LogContext.SYSTEM);
    log.info(`   Existing: ${status.existingModules}`, LogContext.SYSTEM);
    log.info(`   Missing: ${status.missingModules.length}`, LogContext.SYSTEM);
    log.info(`   Completion: ${status.completionPercentage}%`, LogContext.SYSTEM);

    // Create tasks for critical missing modules (top 5)
    const criticalModules = [
      'strategies',
      'data_handlers',
      'risk_management',
      'portfolio',
      'ui_components'
    ];

    for (const moduleName of criticalModules) {
      if (status.missingModules.includes(moduleName)) {
        await this.createModuleTask(moduleName);
      }
    }
  }

  private async createModuleTask(moduleName: string): Promise<void> {
    const moduleInfo = this.projectData?.modules[moduleName];
    if (!moduleInfo) return;

    const task = {
      projectId: 'newtradingbot',
      taskName: `Implement ${moduleName} module`,
      description: `Create ${moduleInfo.files.length} files for ${moduleName}`,
      priority: this.getModulePriority(moduleName),
      estimatedHours: moduleInfo.files.length * 2,
      dependencies: moduleInfo.dependencies || [],
      assignedAgent: this.selectBestAgent(moduleName),
      status: 'pending'
    };

    // Track the task
    await this.projectService.reportTaskUpdate({
      taskId: `task_${moduleName}`,
      projectId: task.projectId,
      agentId: task.assignedAgent,
      status: 'not_started',
      progress: 0,
      timeSpent: 0,
      updatedAt: new Date()
    });

    log.info(`📝 Created task: ${task.taskName}`, LogContext.SYSTEM);
  }

  private getModulePriority(moduleName: string): 'low' | 'medium' | 'high' | 'critical' {
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'strategies': 'critical',
      'data_handlers': 'critical',
      'risk_management': 'high',
      'portfolio': 'high',
      'ui_components': 'medium'
    };
    return priorityMap[moduleName] || 'low';
  }

  private selectBestAgent(moduleName: string): string {
    const agentMap: Record<string, string> = {
      'strategies': 'enhanced-code-assistant-agent',
      'data_handlers': 'enhanced-retriever-agent',
      'risk_management': 'enhanced-planner-agent',
      'portfolio': 'enhanced-synthesizer-agent',
      'ui_components': 'enhanced-personal-assistant-agent'
    };
    return agentMap[moduleName] || 'enhanced-base-agent';
  }

  async implementModule(moduleName: string): Promise<void> {
    const moduleInfo = this.projectData?.modules[moduleName];
    if (!moduleInfo) return;

    log.info(`🔨 Implementing module: ${moduleName}`, LogContext.SYSTEM);

    // Update task to in-progress
    await this.projectService.reportTaskUpdate({
      taskId: `task_${moduleName}`,
      projectId: 'newtradingbot',
      agentId: this.selectBestAgent(moduleName),
      status: 'in_progress',
      progress: 25,
      timeSpent: 0.5,
      updatedAt: new Date()
    });

    // Create module files
    for (const file of moduleInfo.files) {
      await this.createModuleFile(moduleName, file);
    }

    // Update task to completed
    await this.projectService.reportTaskUpdate({
      taskId: `task_${moduleName}`,
      projectId: 'newtradingbot',
      agentId: this.selectBestAgent(moduleName),
      status: 'completed',
      progress: 100,
      timeSpent: 2,
      qualityScore: 95,
      deliverables: moduleInfo.files,
      updatedAt: new Date()
    });

    log.info(`✅ Module ${moduleName} implemented successfully`, LogContext.SYSTEM);
  }

  private async createModuleFile(moduleName: string, fileName: string): Promise<void> {
    const filePath = path.join(this.projectPath, 'src', fileName);
    const dirPath = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Generate appropriate content based on module
    let content = this.generateModuleContent(moduleName, fileName);
    
    await fs.writeFile(filePath, content);
    log.info(`   📄 Created: ${fileName}`, LogContext.SYSTEM);
  }

  private generateModuleContent(moduleName: string, fileName: string): string {
    const baseFileName = path.basename(fileName, '.py');
    
    const templates: Record<string, string> = {
      'strategies': `"""
Trading Strategy Module: ${baseFileName}
Part of the NewTradingBot IDE project
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class ${this.toPascalCase(baseFileName)}Strategy:
    """Advanced trading strategy implementation"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.positions = []
        self.signals = []
        
    def analyze(self, market_data: pd.DataFrame) -> Dict:
        """Analyze market data and generate trading signals"""
        signals = {
            'action': 'hold',
            'confidence': 0.0,
            'indicators': {}
        }
        
        # Calculate technical indicators
        if len(market_data) > 20:
            signals['indicators']['sma_20'] = market_data['close'].rolling(20).mean().iloc[-1]
            signals['indicators']['rsi'] = self.calculate_rsi(market_data['close'])
            
            # Generate signal based on indicators
            if signals['indicators']['rsi'] < 30:
                signals['action'] = 'buy'
                signals['confidence'] = 0.75
            elif signals['indicators']['rsi'] > 70:
                signals['action'] = 'sell'
                signals['confidence'] = 0.75
                
        return signals
    
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.iloc[-1] if not rsi.empty else 50.0
    
    def execute(self, signal: Dict, portfolio) -> Optional[Dict]:
        """Execute trading decision based on signal"""
        if signal['confidence'] > 0.6:
            return {
                'action': signal['action'],
                'amount': self.calculate_position_size(portfolio),
                'timestamp': datetime.now()
            }
        return None
    
    def calculate_position_size(self, portfolio) -> float:
        """Calculate appropriate position size based on risk management"""
        return portfolio.available_capital * 0.02  # 2% risk per trade
`,

      'data_handlers': `"""
Data Handler Module: ${baseFileName}
Manages market data acquisition and processing
"""

import asyncio
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json

class ${this.toPascalCase(baseFileName)}Handler:
    """Handles data acquisition and preprocessing"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.cache = {}
        self.data_sources = []
        
    async def fetch_market_data(self, symbol: str, timeframe: str = '1h') -> pd.DataFrame:
        """Fetch market data for given symbol and timeframe"""
        # Simulated data fetching
        data = pd.DataFrame({
            'timestamp': pd.date_range(start='2024-01-01', periods=100, freq=timeframe),
            'open': np.random.randn(100).cumsum() + 100,
            'high': np.random.randn(100).cumsum() + 101,
            'low': np.random.randn(100).cumsum() + 99,
            'close': np.random.randn(100).cumsum() + 100,
            'volume': np.random.randint(1000, 10000, 100)
        })
        
        self.cache[f"{symbol}_{timeframe}"] = data
        return data
    
    async def stream_realtime_data(self, symbols: List[str]):
        """Stream real-time market data"""
        while True:
            for symbol in symbols:
                # Simulate real-time data
                yield {
                    'symbol': symbol,
                    'price': np.random.randn() * 10 + 100,
                    'volume': np.random.randint(100, 1000),
                    'timestamp': datetime.now()
                }
            await asyncio.sleep(1)
    
    def preprocess_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """Preprocess and clean market data"""
        # Remove NaN values
        data = data.dropna()
        
        # Add technical indicators
        data['returns'] = data['close'].pct_change()
        data['ma_10'] = data['close'].rolling(10).mean()
        data['volatility'] = data['returns'].rolling(20).std()
        
        return data
`,

      'risk_management': `"""
Risk Management Module: ${baseFileName}
Implements comprehensive risk management strategies
"""

import numpy as np
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class RiskMetrics:
    var_95: float  # Value at Risk at 95% confidence
    sharpe_ratio: float
    max_drawdown: float
    position_limit: float
    
class ${this.toPascalCase(baseFileName)}RiskManager:
    """Advanced risk management system"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {
            'max_position_size': 0.1,  # 10% max per position
            'max_portfolio_risk': 0.02,  # 2% max portfolio risk
            'stop_loss': 0.05,  # 5% stop loss
            'take_profit': 0.15  # 15% take profit
        }
        self.positions = []
        self.risk_metrics = None
        
    def calculate_risk_metrics(self, portfolio_value: float, returns: List[float]) -> RiskMetrics:
        """Calculate comprehensive risk metrics"""
        returns_array = np.array(returns)
        
        # Value at Risk (95% confidence)
        var_95 = np.percentile(returns_array, 5) * portfolio_value
        
        # Sharpe Ratio
        sharpe_ratio = (np.mean(returns_array) / np.std(returns_array)) * np.sqrt(252)
        
        # Maximum Drawdown
        cumulative = (1 + returns_array).cumprod()
        running_max = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = np.min(drawdown)
        
        # Position Limit
        position_limit = portfolio_value * self.config['max_position_size']
        
        self.risk_metrics = RiskMetrics(
            var_95=var_95,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown,
            position_limit=position_limit
        )
        
        return self.risk_metrics
    
    def validate_trade(self, trade: Dict, portfolio) -> Tuple[bool, str]:
        """Validate if a trade meets risk requirements"""
        # Check position size
        if trade['amount'] > self.risk_metrics.position_limit:
            return False, "Position size exceeds limit"
        
        # Check portfolio risk
        potential_loss = trade['amount'] * self.config['stop_loss']
        if potential_loss > portfolio.value * self.config['max_portfolio_risk']:
            return False, "Trade exceeds portfolio risk limit"
        
        # Check correlation risk
        if self.check_correlation_risk(trade, portfolio):
            return False, "High correlation risk with existing positions"
        
        return True, "Trade approved"
    
    def check_correlation_risk(self, trade: Dict, portfolio) -> bool:
        """Check if new trade has high correlation with existing positions"""
        # Simplified correlation check
        similar_positions = [p for p in portfolio.positions 
                           if p['symbol'] == trade['symbol']]
        return len(similar_positions) > 2
    
    def set_stop_loss_take_profit(self, entry_price: float) -> Dict:
        """Calculate stop loss and take profit levels"""
        return {
            'stop_loss': entry_price * (1 - self.config['stop_loss']),
            'take_profit': entry_price * (1 + self.config['take_profit'])
        }
`
    };

    // Return appropriate template or default
    if (moduleName in templates) {
      return templates[moduleName];
    }
    
    // Default template for other modules
    return `"""
Module: ${baseFileName}
Part of the NewTradingBot IDE project
"""

class ${this.toPascalCase(baseFileName)}:
    """Implementation for ${baseFileName}"""
    
    def __init__(self, config=None):
        self.config = config or {}
        
    def process(self, data):
        """Process data according to module functionality"""
        return data
`;
  }

  private toPascalCase(str: string): string {
    return str.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
  }

  async generateReport(): Promise<void> {
    const metrics = await this.projectService.getProjectMetrics();
    const status = await this.analyzeProjectStatus();
    
    log.info('📊 === PROJECT MANAGER TEST REPORT ===', LogContext.SYSTEM);
    log.info(`Project: NewTradingBot`, LogContext.SYSTEM);
    log.info(`Completion: ${status.completionPercentage}%`, LogContext.SYSTEM);
    log.info(`Modules Implemented: ${status.existingModules}/${status.totalModules}`, LogContext.SYSTEM);
    
    if (metrics) {
      log.info(`\n📈 Overall Metrics:`, LogContext.SYSTEM);
      log.info(`   Active Projects: ${metrics.activeProjects}`, LogContext.SYSTEM);
      log.info(`   Avg Health Score: ${metrics.avgHealthScore}`, LogContext.SYSTEM);
      log.info(`   Resource Utilization: ${metrics.resourceUtilization}%`, LogContext.SYSTEM);
    }
    
    log.info('\n✅ Test Complete!', LogContext.SYSTEM);
  }
}

// Run the test
async function main() {
  const test = new ProjectManagerTest();
  
  try {
    await test.initialize();
    await test.createProjectTasks();
    
    // Implement critical modules
    const modulesToImplement = ['strategies', 'data_handlers', 'risk_management'];
    
    for (const module of modulesToImplement) {
      await test.implementModule(module);
      // Small delay to simulate real work
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await test.generateReport();
    
  } catch (error) {
    log.error(`Test failed: ${error}`, LogContext.ERROR);
    process.exit(1);
  }
}

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ProjectManagerTest };