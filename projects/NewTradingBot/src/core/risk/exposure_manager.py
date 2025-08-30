"""
Exposure management module for trading bot.
Manages overall portfolio exposure, sector allocation, and risk concentration.
"""

from typing import Dict, List, Optional, Any, Tuple, Set
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np

from ...domain.portfolio import Portfolio, Position
from ...domain.trade import Trade, TradeType, TradeSide
from .risk_calculator import RiskMetrics, RiskLimits


class ExposureType(Enum):
    """Types of exposure to monitor."""
    ASSET = "asset"
    SECTOR = "sector"
    GEOGRAPHY = "geography"
    CURRENCY = "currency"
    MARKET_CAP = "market_cap"
    STRATEGY = "strategy"


class ExposureLevel(Enum):
    """Exposure level categories."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


@dataclass
class ExposureLimit:
    """Exposure limit configuration."""
    exposure_type: ExposureType
    category: str  # e.g., "technology", "crypto", "large_cap"
    max_percentage: float  # Maximum percentage of portfolio
    target_percentage: float  # Target percentage
    min_percentage: float = 0.0  # Minimum percentage
    rebalance_threshold: float = 5.0  # Rebalance if deviation > threshold


@dataclass
class ExposureMetrics:
    """Exposure analysis metrics."""
    exposure_type: ExposureType
    category: str
    current_percentage: float
    target_percentage: float
    max_allowed: float
    deviation: float  # Current - Target
    level: ExposureLevel
    positions: List[str]  # List of symbols in this category
    total_value: Decimal
    largest_position_pct: float
    concentration_score: float  # 0-1, higher = more concentrated
    recommendation: str


@dataclass 
class CorrelationCluster:
    """Group of highly correlated positions."""
    cluster_id: str
    symbols: List[str]
    avg_correlation: float
    total_exposure_pct: float
    risk_contribution: float
    recommendation: str


class ExposureManager:
    """
    Manages portfolio exposure across multiple dimensions including
    sectors, asset classes, geographies, and correlation clusters.
    """
    
    def __init__(self, risk_limits: RiskLimits = None):
        """
        Initialize exposure manager.
        
        Args:
            risk_limits: Risk limits configuration
        """
        self.risk_limits = risk_limits or RiskLimits()
        
        # Default exposure limits
        self.exposure_limits: List[ExposureLimit] = [
            # Sector limits
            ExposureLimit(ExposureType.SECTOR, "technology", 30.0, 20.0),
            ExposureLimit(ExposureType.SECTOR, "financial", 25.0, 15.0),
            ExposureLimit(ExposureType.SECTOR, "healthcare", 20.0, 10.0),
            ExposureLimit(ExposureType.SECTOR, "crypto", 40.0, 25.0),
            
            # Asset type limits
            ExposureLimit(ExposureType.ASSET, "equities", 80.0, 60.0),
            ExposureLimit(ExposureType.ASSET, "crypto", 40.0, 25.0),
            ExposureLimit(ExposureType.ASSET, "commodities", 20.0, 10.0),
            ExposureLimit(ExposureType.ASSET, "forex", 30.0, 15.0),
            
            # Market cap limits
            ExposureLimit(ExposureType.MARKET_CAP, "large_cap", 60.0, 40.0),
            ExposureLimit(ExposureType.MARKET_CAP, "mid_cap", 40.0, 30.0),
            ExposureLimit(ExposureType.MARKET_CAP, "small_cap", 20.0, 10.0),
            
            # Currency limits
            ExposureLimit(ExposureType.CURRENCY, "USD", 100.0, 70.0),
            ExposureLimit(ExposureType.CURRENCY, "EUR", 30.0, 15.0),
            ExposureLimit(ExposureType.CURRENCY, "BTC", 40.0, 20.0),
        ]
        
        # Asset classification mappings
        self.asset_classifications = {
            'sectors': {
                'AAPL': 'technology', 'MSFT': 'technology', 'GOOGL': 'technology',
                'BTC/USDT': 'crypto', 'ETH/USDT': 'crypto', 'ADA/USDT': 'crypto',
                'JPM': 'financial', 'BAC': 'financial', 'WFC': 'financial',
                'JNJ': 'healthcare', 'PFE': 'healthcare', 'UNH': 'healthcare'
            },
            'asset_types': {
                'AAPL': 'equities', 'MSFT': 'equities', 'GOOGL': 'equities',
                'BTC/USDT': 'crypto', 'ETH/USDT': 'crypto',
                'GLD': 'commodities', 'OIL': 'commodities',
                'EUR/USD': 'forex', 'GBP/USD': 'forex'
            },
            'market_caps': {
                'AAPL': 'large_cap', 'MSFT': 'large_cap', 'GOOGL': 'large_cap',
                'BTC/USDT': 'large_cap', 'ETH/USDT': 'large_cap'
            },
            'currencies': {
                'BTC/USDT': 'BTC', 'ETH/USDT': 'ETH', 'ADA/USDT': 'ADA',
                'EUR/USD': 'EUR', 'GBP/USD': 'GBP'
            }
        }
        
        # Correlation tracking
        self.correlation_matrix: Optional[pd.DataFrame] = None
        self.correlation_threshold = 0.7  # High correlation threshold
        
    def set_exposure_limits(self, limits: List[ExposureLimit]) -> None:
        """Set custom exposure limits."""
        self.exposure_limits = limits
    
    def add_exposure_limit(self, limit: ExposureLimit) -> None:
        """Add a new exposure limit."""
        # Remove existing limit for same type/category if exists
        self.exposure_limits = [
            l for l in self.exposure_limits 
            if not (l.exposure_type == limit.exposure_type and l.category == limit.category)
        ]
        self.exposure_limits.append(limit)
    
    def classify_asset(self, symbol: str, classification_type: str) -> str:
        """
        Classify an asset into a category.
        
        Args:
            symbol: Asset symbol
            classification_type: Type of classification (sectors, asset_types, etc.)
            
        Returns:
            Category name or 'other' if not classified
        """
        classifications = self.asset_classifications.get(classification_type, {})
        return classifications.get(symbol, 'other')
    
    def calculate_exposure_by_type(self, portfolio: Portfolio, 
                                 exposure_type: ExposureType) -> Dict[str, ExposureMetrics]:
        """
        Calculate exposure breakdown by specified type.
        
        Args:
            portfolio: Portfolio to analyze
            exposure_type: Type of exposure to calculate
            
        Returns:
            Dictionary of exposure metrics by category
        """
        exposures = {}
        total_value = portfolio.total_value
        
        if total_value == 0:
            return exposures
        
        # Group positions by category
        category_positions = {}
        
        for position in portfolio.active_positions:
            if exposure_type == ExposureType.SECTOR:
                category = self.classify_asset(position.symbol, 'sectors')
            elif exposure_type == ExposureType.ASSET:
                category = self.classify_asset(position.symbol, 'asset_types')
            elif exposure_type == ExposureType.MARKET_CAP:
                category = self.classify_asset(position.symbol, 'market_caps')
            elif exposure_type == ExposureType.CURRENCY:
                category = self.classify_asset(position.symbol, 'currencies')
            elif exposure_type == ExposureType.STRATEGY:
                # Would need strategy information from positions
                category = 'strategy_1'  # Placeholder
            else:
                category = 'other'
            
            if category not in category_positions:
                category_positions[category] = []
            category_positions[category].append(position)
        
        # Calculate metrics for each category
        for category, positions in category_positions.items():
            category_value = sum(pos.market_value for pos in positions)
            current_pct = float(category_value / total_value * 100)
            
            # Find exposure limit for this category
            target_pct = 10.0  # Default
            max_pct = 20.0     # Default
            
            for limit in self.exposure_limits:
                if limit.exposure_type == exposure_type and limit.category == category:
                    target_pct = limit.target_percentage
                    max_pct = limit.max_percentage
                    break
            
            # Calculate concentration within category
            if len(positions) > 0:
                position_weights = [float(pos.market_value / category_value) for pos in positions]
                # Herfindahl-Hirschman Index for concentration
                concentration_score = sum(w**2 for w in position_weights)
                largest_position_pct = max(position_weights) * current_pct / 100  # As % of total portfolio
            else:
                concentration_score = 0.0
                largest_position_pct = 0.0
            
            # Determine exposure level
            if current_pct >= max_pct:
                level = ExposureLevel.EXTREME
            elif current_pct >= target_pct * 1.5:
                level = ExposureLevel.HIGH
            elif current_pct >= target_pct * 0.75:
                level = ExposureLevel.MEDIUM
            elif current_pct > 0:
                level = ExposureLevel.LOW
            else:
                level = ExposureLevel.NONE
            
            # Generate recommendation
            deviation = current_pct - target_pct
            if abs(deviation) > 5.0:
                if deviation > 0:
                    recommendation = f"REDUCE: {abs(deviation):.1f}% over target"
                else:
                    recommendation = f"INCREASE: {abs(deviation):.1f}% under target"
            else:
                recommendation = "MAINTAIN: Within target range"
            
            exposures[category] = ExposureMetrics(
                exposure_type=exposure_type,
                category=category,
                current_percentage=current_pct,
                target_percentage=target_pct,
                max_allowed=max_pct,
                deviation=deviation,
                level=level,
                positions=[pos.symbol for pos in positions],
                total_value=category_value,
                largest_position_pct=largest_position_pct,
                concentration_score=concentration_score,
                recommendation=recommendation
            )
        
        return exposures
    
    def identify_correlation_clusters(self, portfolio: Portfolio, 
                                    correlation_matrix: pd.DataFrame = None) -> List[CorrelationCluster]:
        """
        Identify groups of highly correlated positions.
        
        Args:
            portfolio: Portfolio to analyze
            correlation_matrix: Asset correlation matrix
            
        Returns:
            List of correlation clusters
        """
        clusters = []
        
        if correlation_matrix is None or len(portfolio.active_positions) < 2:
            return clusters
        
        symbols = [pos.symbol for pos in portfolio.active_positions]
        available_symbols = [s for s in symbols if s in correlation_matrix.index]
        
        if len(available_symbols) < 2:
            return clusters
        
        # Find highly correlated pairs
        clustered_symbols = set()
        cluster_id = 1
        
        for i, symbol1 in enumerate(available_symbols):
            if symbol1 in clustered_symbols:
                continue
            
            # Find all symbols highly correlated with symbol1
            cluster_symbols = [symbol1]
            
            for j, symbol2 in enumerate(available_symbols):
                if i != j and symbol2 not in clustered_symbols:
                    if (symbol1 in correlation_matrix.index and 
                        symbol2 in correlation_matrix.columns):
                        correlation = abs(correlation_matrix.loc[symbol1, symbol2])
                        
                        if correlation >= self.correlation_threshold:
                            cluster_symbols.append(symbol2)
            
            # Create cluster if multiple symbols
            if len(cluster_symbols) > 1:
                # Calculate cluster metrics
                cluster_positions = [pos for pos in portfolio.active_positions 
                                   if pos.symbol in cluster_symbols]
                
                total_cluster_value = sum(pos.market_value for pos in cluster_positions)
                cluster_exposure_pct = float(total_cluster_value / portfolio.total_value * 100) if portfolio.total_value > 0 else 0
                
                # Calculate average correlation within cluster
                correlations = []
                for k, sym1 in enumerate(cluster_symbols):
                    for sym2 in cluster_symbols[k+1:]:
                        if (sym1 in correlation_matrix.index and 
                            sym2 in correlation_matrix.columns):
                            corr = abs(correlation_matrix.loc[sym1, sym2])
                            correlations.append(corr)
                
                avg_correlation = np.mean(correlations) if correlations else 0.0
                
                # Estimate risk contribution (simplified)
                risk_contribution = cluster_exposure_pct * avg_correlation
                
                # Generate recommendation
                if cluster_exposure_pct > 25.0:
                    recommendation = "HIGH RISK: Consider reducing correlated positions"
                elif cluster_exposure_pct > 15.0:
                    recommendation = "MEDIUM RISK: Monitor correlation exposure"
                else:
                    recommendation = "LOW RISK: Correlation exposure acceptable"
                
                clusters.append(CorrelationCluster(
                    cluster_id=f"cluster_{cluster_id}",
                    symbols=cluster_symbols.copy(),
                    avg_correlation=avg_correlation,
                    total_exposure_pct=cluster_exposure_pct,
                    risk_contribution=risk_contribution,
                    recommendation=recommendation
                ))
                
                # Mark symbols as clustered
                clustered_symbols.update(cluster_symbols)
                cluster_id += 1
        
        return clusters
    
    def assess_concentration_risk(self, portfolio: Portfolio) -> Dict[str, Any]:
        """
        Assess overall portfolio concentration risk.
        
        Args:
            portfolio: Portfolio to analyze
            
        Returns:
            Concentration risk assessment
        """
        if not portfolio.active_positions or portfolio.total_value == 0:
            return {
                'overall_score': 0.0,
                'level': 'none',
                'top_positions': [],
                'recommendations': []
            }
        
        # Calculate position weights
        weights = []
        position_data = []
        
        for position in portfolio.active_positions:
            weight = float(position.market_value / portfolio.total_value)
            weights.append(weight)
            position_data.append({
                'symbol': position.symbol,
                'weight_pct': weight * 100,
                'value': position.market_value
            })
        
        # Sort by weight
        position_data.sort(key=lambda x: x['weight_pct'], reverse=True)
        
        # Calculate concentration metrics
        # Herfindahl-Hirschman Index
        hhi = sum(w**2 for w in weights)
        
        # Top N concentration
        top_5_pct = sum(sorted(weights, reverse=True)[:5]) * 100
        top_10_pct = sum(sorted(weights, reverse=True)[:10]) * 100
        
        # Gini coefficient (inequality measure)
        n = len(weights)
        if n > 1:
            weights_sorted = sorted(weights)
            cumulative = np.cumsum(weights_sorted)
            gini = (2 * sum((i + 1) * weight for i, weight in enumerate(weights_sorted))) / (n * sum(weights_sorted)) - (n + 1) / n
        else:
            gini = 0
        
        # Overall concentration score (0-1)
        hhi_normalized = (hhi - 1/n) / (1 - 1/n) if n > 1 else 0
        concentration_score = (hhi_normalized * 0.4 + gini * 0.4 + min(1.0, top_5_pct / 50.0) * 0.2)
        
        # Determine concentration level
        if concentration_score >= 0.8:
            level = 'extreme'
        elif concentration_score >= 0.6:
            level = 'high'
        elif concentration_score >= 0.4:
            level = 'medium'
        elif concentration_score > 0.1:
            level = 'low'
        else:
            level = 'none'
        
        # Generate recommendations
        recommendations = []
        
        if level in ['extreme', 'high']:
            recommendations.append("Reduce position sizes in largest holdings")
            recommendations.append("Diversify across more assets")
            
            # Specific recommendations for top positions
            for i, pos_data in enumerate(position_data[:3]):
                if pos_data['weight_pct'] > 15.0:
                    recommendations.append(f"Reduce {pos_data['symbol']} position ({pos_data['weight_pct']:.1f}% of portfolio)")
        
        elif level == 'medium':
            recommendations.append("Monitor concentration levels")
            recommendations.append("Consider gradual diversification")
        
        else:
            recommendations.append("Concentration levels are acceptable")
        
        return {
            'overall_score': concentration_score,
            'level': level,
            'hhi': hhi,
            'gini_coefficient': gini,
            'top_5_concentration_pct': top_5_pct,
            'top_10_concentration_pct': top_10_pct,
            'position_count': len(position_data),
            'top_positions': position_data[:10],  # Top 10 positions
            'recommendations': recommendations
        }
    
    def validate_trade_exposure(self, trade: Trade, portfolio: Portfolio) -> Tuple[bool, List[str]]:
        """
        Validate if a trade violates exposure limits.
        
        Args:
            trade: Trade to validate
            portfolio: Current portfolio
            
        Returns:
            Tuple of (is_valid, list_of_violations)
        """
        violations = []
        
        # Simulate the trade impact
        simulated_portfolio = self._simulate_trade_impact(trade, portfolio)
        
        # Check all exposure types
        for exposure_type in ExposureType:
            try:
                exposures = self.calculate_exposure_by_type(simulated_portfolio, exposure_type)
                
                for category, metrics in exposures.items():
                    if metrics.current_percentage > metrics.max_allowed:
                        violations.append(
                            f"{exposure_type.value.title()} exposure to {category} would exceed limit: "
                            f"{metrics.current_percentage:.1f}% > {metrics.max_allowed:.1f}%"
                        )
            except Exception as e:
                # Skip this exposure type if calculation fails
                continue
        
        # Check concentration risk
        concentration = self.assess_concentration_risk(simulated_portfolio)
        if concentration['level'] in ['extreme']:
            violations.append("Trade would create extreme concentration risk")
        
        return len(violations) == 0, violations
    
    def _simulate_trade_impact(self, trade: Trade, portfolio: Portfolio) -> Portfolio:
        """Simulate the impact of a trade on portfolio exposure."""
        # Create a copy of the portfolio
        simulated_portfolio = Portfolio(
            id=portfolio.id + "_sim",
            name=portfolio.name + "_simulated",
            base_currency=portfolio.base_currency
        )
        
        # Copy existing positions
        for symbol, position in portfolio.positions.items():
            simulated_portfolio.positions[symbol] = Position(
                symbol=position.symbol,
                side=position.side,
                amount=position.amount,
                avg_entry_price=position.avg_entry_price,
                unrealized_pnl=position.unrealized_pnl,
                realized_pnl=position.realized_pnl,
                last_price=position.last_price
            )
        
        # Copy balances
        for currency, balance in portfolio.balances.items():
            from ...domain.portfolio import Balance
            simulated_portfolio.balances[currency] = Balance(
                currency=balance.currency,
                available=balance.available,
                locked=balance.locked
            )
        
        # Apply the trade
        if trade.is_complete:
            simulated_portfolio.add_trade(trade)
        else:
            # Simulate complete trade
            completed_trade = Trade(
                id=trade.id,
                symbol=trade.symbol,
                trade_type=trade.trade_type,
                side=trade.side,
                amount=trade.amount,
                price=trade.price,
                filled_amount=trade.amount,
                filled_price=trade.price,
                status=trade.status
            )
            simulated_portfolio.add_trade(completed_trade)
        
        return simulated_portfolio
    
    def generate_rebalancing_recommendations(self, portfolio: Portfolio) -> Dict[str, Any]:
        """
        Generate portfolio rebalancing recommendations.
        
        Args:
            portfolio: Portfolio to analyze
            
        Returns:
            Rebalancing recommendations
        """
        recommendations = {
            'rebalancing_needed': False,
            'priority': 'low',
            'actions': [],
            'exposure_analysis': {},
            'concentration_analysis': {},
            'estimated_trades': []
        }
        
        # Analyze all exposure types
        total_violations = 0
        max_deviation = 0.0
        
        for exposure_type in ExposureType:
            try:
                exposures = self.calculate_exposure_by_type(portfolio, exposure_type)
                recommendations['exposure_analysis'][exposure_type.value] = {}
                
                for category, metrics in exposures.items():
                    recommendations['exposure_analysis'][exposure_type.value][category] = {
                        'current_pct': metrics.current_percentage,
                        'target_pct': metrics.target_percentage,
                        'deviation': metrics.deviation,
                        'level': metrics.level.value,
                        'recommendation': metrics.recommendation
                    }
                    
                    # Check if rebalancing needed
                    abs_deviation = abs(metrics.deviation)
                    max_deviation = max(max_deviation, abs_deviation)
                    
                    if abs_deviation > 5.0:  # 5% threshold
                        total_violations += 1
                        recommendations['actions'].append({
                            'type': 'rebalance_exposure',
                            'exposure_type': exposure_type.value,
                            'category': category,
                            'current_pct': metrics.current_percentage,
                            'target_pct': metrics.target_percentage,
                            'action': 'reduce' if metrics.deviation > 0 else 'increase'
                        })
            except Exception:
                continue
        
        # Concentration analysis
        concentration = self.assess_concentration_risk(portfolio)
        recommendations['concentration_analysis'] = concentration
        
        if concentration['level'] in ['extreme', 'high']:
            total_violations += len(concentration['recommendations'])
            recommendations['actions'].extend([
                {'type': 'reduce_concentration', 'recommendation': rec}
                for rec in concentration['recommendations']
            ])
        
        # Correlation cluster analysis
        if self.correlation_matrix is not None:
            clusters = self.identify_correlation_clusters(portfolio, self.correlation_matrix)
            high_risk_clusters = [c for c in clusters if c.total_exposure_pct > 20.0]
            
            for cluster in high_risk_clusters:
                recommendations['actions'].append({
                    'type': 'reduce_correlation',
                    'cluster_symbols': cluster.symbols,
                    'exposure_pct': cluster.total_exposure_pct,
                    'recommendation': cluster.recommendation
                })
                total_violations += 1
        
        # Determine rebalancing priority
        if total_violations >= 5 or max_deviation > 15.0:
            recommendations['rebalancing_needed'] = True
            recommendations['priority'] = 'high'
        elif total_violations >= 2 or max_deviation > 8.0:
            recommendations['rebalancing_needed'] = True
            recommendations['priority'] = 'medium'
        elif total_violations > 0 or max_deviation > 5.0:
            recommendations['rebalancing_needed'] = True
            recommendations['priority'] = 'low'
        
        return recommendations
    
    def get_exposure_summary(self, portfolio: Portfolio) -> Dict[str, Any]:
        """
        Get comprehensive exposure summary.
        
        Args:
            portfolio: Portfolio to analyze
            
        Returns:
            Complete exposure summary
        """
        summary = {
            'portfolio_value': str(portfolio.total_value),
            'position_count': len(portfolio.active_positions),
            'timestamp': datetime.utcnow().isoformat(),
            'exposures': {},
            'concentration_risk': self.assess_concentration_risk(portfolio),
            'correlation_clusters': [],
            'violations': [],
            'recommendations': []
        }
        
        # Calculate exposures by type
        for exposure_type in ExposureType:
            try:
                exposures = self.calculate_exposure_by_type(portfolio, exposure_type)
                summary['exposures'][exposure_type.value] = {
                    category: {
                        'percentage': metrics.current_percentage,
                        'value': str(metrics.total_value),
                        'level': metrics.level.value,
                        'positions': metrics.positions,
                        'deviation': metrics.deviation
                    }
                    for category, metrics in exposures.items()
                }
                
                # Collect violations
                for category, metrics in exposures.items():
                    if metrics.level in [ExposureLevel.EXTREME, ExposureLevel.HIGH]:
                        summary['violations'].append(
                            f"{exposure_type.value.title()} {category}: {metrics.current_percentage:.1f}% "
                            f"(limit: {metrics.max_allowed:.1f}%)"
                        )
            except Exception:
                summary['exposures'][exposure_type.value] = {}
        
        # Add correlation clusters
        if self.correlation_matrix is not None:
            clusters = self.identify_correlation_clusters(portfolio, self.correlation_matrix)
            summary['correlation_clusters'] = [
                {
                    'id': cluster.cluster_id,
                    'symbols': cluster.symbols,
                    'exposure_pct': cluster.total_exposure_pct,
                    'avg_correlation': cluster.avg_correlation,
                    'recommendation': cluster.recommendation
                }
                for cluster in clusters
            ]
        
        # Generate summary recommendations
        if summary['violations']:
            summary['recommendations'].append("Address exposure limit violations")
        
        if summary['concentration_risk']['level'] in ['high', 'extreme']:
            summary['recommendations'].append("Reduce position concentration")
        
        if not summary['recommendations']:
            summary['recommendations'].append("Exposure profile is within acceptable limits")
        
        return summary