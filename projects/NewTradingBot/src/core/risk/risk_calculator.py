"""
Risk calculation module for trading bot.
Provides comprehensive risk assessment and management functions.
"""

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats

from ...domain.order import Order
from ...domain.portfolio import Portfolio, Position
from ...domain.trade import Trade, TradeSide, TradeType


class RiskLevel(Enum):
    """Risk level categories."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


class RiskType(Enum):
    """Types of risk to assess."""
    MARKET = "market"
    LIQUIDITY = "liquidity"
    CONCENTRATION = "concentration"
    LEVERAGE = "leverage"
    VOLATILITY = "volatility"
    CORRELATION = "correlation"
    DRAWDOWN = "drawdown"


@dataclass
class RiskMetrics:
    """
    Container for various risk metrics.

    Attributes:
        portfolio_value: Total portfolio value
        var_95: 95% Value at Risk
        var_99: 99% Value at Risk
        expected_shortfall: Expected Shortfall (Conditional VaR)
        max_drawdown: Maximum historical drawdown percentage
        current_drawdown: Current drawdown from peak
        volatility_annual: Annualized portfolio volatility
        sharpe_ratio: Risk-adjusted return ratio
        beta: Portfolio beta vs market
        concentration_risk: Concentration risk score (0-1)
        leverage_ratio: Current leverage ratio
        margin_usage: Margin usage percentage
        liquidity_score: Portfolio liquidity score (0-1)
        correlation_risk: Correlation risk score (0-1)
    """
    portfolio_value: Decimal = field(default_factory=lambda: Decimal('0'))
    var_95: Decimal = field(default_factory=lambda: Decimal('0'))
    var_99: Decimal = field(default_factory=lambda: Decimal('0'))
    expected_shortfall: Decimal = field(default_factory=lambda: Decimal('0'))
    max_drawdown: float = 0.0
    current_drawdown: float = 0.0
    volatility_annual: float = 0.0
    sharpe_ratio: float = 0.0
    beta: float = 1.0
    concentration_risk: float = 0.0
    leverage_ratio: float = 1.0
    margin_usage: float = 0.0
    liquidity_score: float = 1.0
    correlation_risk: float = 0.0
    risk_score: float = 0.0  # Overall risk score (0-100)
    risk_level: RiskLevel = RiskLevel.LOW
    calculated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RiskLimits:
    """Risk limits and thresholds."""

    # Position limits
    max_position_size_pct: float = 10.0  # Max 10% per position
    max_sector_concentration_pct: float = 25.0  # Max 25% per sector
    max_correlation_exposure_pct: float = 40.0  # Max 40% in correlated positions

    # Risk metrics limits
    max_portfolio_var_pct: float = 5.0  # Max 5% daily VaR
    max_drawdown_pct: float = 15.0  # Max 15% drawdown
    min_liquidity_score: float = 0.6  # Min 60% liquidity score
    max_leverage_ratio: float = 3.0  # Max 3:1 leverage
    max_margin_usage_pct: float = 80.0  # Max 80% margin usage

    # Volatility limits
    max_portfolio_volatility_pct: float = 25.0  # Max 25% annual volatility
    min_sharpe_ratio: float = 0.5  # Min Sharpe ratio

    # Trading limits
    max_trades_per_day: int = 50
    max_daily_loss_pct: float = 3.0  # Max 3% daily loss
    max_weekly_loss_pct: float = 8.0  # Max 8% weekly loss


class RiskCalculator:
    """
    Comprehensive risk calculation and assessment system.

    Provides methods to calculate various risk metrics, assess portfolio risk,
    and validate trades against risk limits.
    """

    def __init__(self, risk_limits: RiskLimits = None):
        """
        Initialize risk calculator.

        Args:
            risk_limits: Risk limits configuration
        """
        self.risk_limits = risk_limits or RiskLimits()
        self.historical_values: List[Decimal] = []
        self.historical_returns: List[float] = []
        self.market_returns: List[float] = []  # For beta calculation

    def calculate_var(
            self,
            returns: List[float],
            confidence_level: float = 0.95) -> float:
        """
        Calculate Value at Risk using historical simulation.

        Args:
            returns: Historical returns
            confidence_level: Confidence level (e.g., 0.95 for 95% VaR)

        Returns:
            VaR as positive value (loss)
        """
        if len(returns) < 30:  # Need minimum data
            return 0.0

        returns_array = np.array(returns)
        # VaR is the negative of the percentile (since we want losses as
        # positive)
        var = -np.percentile(returns_array, (1 - confidence_level) * 100)
        return max(0.0, var)

    def calculate_expected_shortfall(
            self,
            returns: List[float],
            confidence_level: float = 0.95) -> float:
        """
        Calculate Expected Shortfall (Conditional VaR).

        Args:
            returns: Historical returns
            confidence_level: Confidence level

        Returns:
            Expected Shortfall as positive value
        """
        if len(returns) < 30:
            return 0.0

        var_threshold = -np.percentile(returns, (1 - confidence_level) * 100)
        tail_returns = [r for r in returns if r <= var_threshold]

        if not tail_returns:
            return 0.0

        # Expected shortfall is the average of tail losses
        return -np.mean(tail_returns)

    def calculate_drawdown(
            self, portfolio_values: List[Decimal]) -> Tuple[float, float]:
        """
        Calculate maximum and current drawdown.

        Args:
            portfolio_values: Historical portfolio values

        Returns:
            Tuple of (max_drawdown, current_drawdown) as percentages
        """
        if len(portfolio_values) < 2:
            return 0.0, 0.0

        values = [float(v) for v in portfolio_values]
        peak = values[0]
        max_drawdown = 0.0
        current_drawdown = 0.0

        for value in values:
            if value > peak:
                peak = value

            drawdown = (peak - value) / peak * 100 if peak > 0 else 0.0
            max_drawdown = max(max_drawdown, drawdown)

        # Current drawdown from most recent peak
        current_peak = max(values)
        current_value = values[-1]
        current_drawdown = (current_peak - current_value) / \
            current_peak * 100 if current_peak > 0 else 0.0

        return max_drawdown, current_drawdown

    def calculate_volatility(
            self,
            returns: List[float],
            annualize: bool = True) -> float:
        """
        Calculate portfolio volatility.

        Args:
            returns: Historical returns
            annualize: Whether to annualize the volatility

        Returns:
            Volatility as percentage
        """
        if len(returns) < 2:
            return 0.0

        volatility = np.std(returns, ddof=1) * 100  # Convert to percentage

        if annualize:
            # Assuming daily returns, annualize with sqrt(252)
            volatility *= np.sqrt(252)

        return volatility

    def calculate_sharpe_ratio(
            self,
            returns: List[float],
            risk_free_rate: float = 0.02) -> float:
        """
        Calculate Sharpe ratio.

        Args:
            returns: Historical returns
            risk_free_rate: Annual risk-free rate

        Returns:
            Sharpe ratio
        """
        if len(returns) < 2:
            return 0.0

        # Convert to annual terms
        annual_return = np.mean(returns) * 252  # Assuming daily returns
        annual_volatility = np.std(returns, ddof=1) * np.sqrt(252)

        if annual_volatility == 0:
            return 0.0

        return (annual_return - risk_free_rate) / annual_volatility

    def calculate_beta(
            self,
            portfolio_returns: List[float],
            market_returns: List[float]) -> float:
        """
        Calculate portfolio beta vs market.

        Args:
            portfolio_returns: Portfolio returns
            market_returns: Market benchmark returns

        Returns:
            Beta coefficient
        """
        if len(portfolio_returns) < 30 or len(market_returns) < 30:
            return 1.0  # Default beta

        min_length = min(len(portfolio_returns), len(market_returns))
        portfolio_returns = portfolio_returns[-min_length:]
        market_returns = market_returns[-min_length:]

        covariance = np.cov(portfolio_returns, market_returns)[0][1]
        market_variance = np.var(market_returns, ddof=1)

        if market_variance == 0:
            return 1.0

        return covariance / market_variance

    def calculate_concentration_risk(self, portfolio: Portfolio) -> float:
        """
        Calculate concentration risk score.

        Args:
            portfolio: Portfolio to analyze

        Returns:
            Concentration risk score (0-1, where 1 is highest risk)
        """
        if portfolio.total_value == 0:
            return 0.0

        # Calculate Herfindahl-Hirschman Index for concentration
        weights = []
        for position in portfolio.active_positions:
            weight = float(position.market_value / portfolio.total_value)
            weights.append(weight)

        if not weights:
            return 0.0

        # HHI ranges from 1/n (perfectly diversified) to 1 (fully concentrated)
        hhi = sum(w**2 for w in weights)

        # Convert to risk score (0-1)
        n = len(weights)
        min_hhi = 1.0 / n if n > 0 else 1.0
        concentration_score = (hhi - min_hhi) / \
            (1.0 - min_hhi) if min_hhi < 1.0 else 0.0

        return min(1.0, concentration_score)

    def calculate_correlation_risk(
            self,
            portfolio: Portfolio,
            correlation_matrix: pd.DataFrame = None) -> float:
        """
        Calculate correlation risk score.

        Args:
            portfolio: Portfolio to analyze
            correlation_matrix: Asset correlation matrix

        Returns:
            Correlation risk score (0-1)
        """
        if not portfolio.active_positions or correlation_matrix is None:
            return 0.0

        symbols = [pos.symbol for pos in portfolio.active_positions]
        weights = [float(pos.market_value / portfolio.total_value)
                   for pos in portfolio.active_positions]

        # Calculate portfolio correlation risk
        total_correlation = 0.0
        total_weight_pairs = 0.0

        for i, symbol1 in enumerate(symbols):
            for j, symbol2 in enumerate(symbols):
                if i != j and symbol1 in correlation_matrix.index and symbol2 in correlation_matrix.columns:
                    correlation = correlation_matrix.loc[symbol1, symbol2]
                    weight_product = weights[i] * weights[j]
                    total_correlation += abs(correlation) * weight_product
                    total_weight_pairs += weight_product

        if total_weight_pairs == 0:
            return 0.0

        avg_correlation = total_correlation / total_weight_pairs
        return min(1.0, avg_correlation)

    def calculate_liquidity_score(self,
                                  portfolio: Portfolio,
                                  volume_data: Dict[str,
                                                    Decimal] = None) -> float:
        """
        Calculate portfolio liquidity score.

        Args:
            portfolio: Portfolio to analyze
            volume_data: Trading volume data by symbol

        Returns:
            Liquidity score (0-1, where 1 is most liquid)
        """
        if not portfolio.active_positions:
            return 1.0

        total_value = portfolio.total_value
        if total_value == 0:
            return 1.0

        weighted_liquidity = Decimal('0')

        for position in portfolio.active_positions:
            weight = position.market_value / total_value

            # Estimate liquidity based on various factors
            liquidity_factors = []

            # Volume-based liquidity
            if volume_data and position.symbol in volume_data:
                daily_volume = volume_data[position.symbol]
                position_volume_ratio = position.market_value / \
                    (daily_volume * position.last_price) if daily_volume > 0 else 1.0
                volume_liquidity = max(
                    0.0,
                    1.0 -
                    float(position_volume_ratio) *
                    0.1)  # Penalty for large positions
                liquidity_factors.append(volume_liquidity)

            # Default liquidity scores by asset type (simplified)
            if 'BTC' in position.symbol or 'ETH' in position.symbol:
                liquidity_factors.append(0.9)  # High liquidity
            elif 'USDT' in position.symbol or 'USD' in position.symbol:
                liquidity_factors.append(0.95)  # Very high liquidity
            else:
                liquidity_factors.append(0.7)  # Medium liquidity

            position_liquidity = np.mean(
                liquidity_factors) if liquidity_factors else 0.7
            weighted_liquidity += weight * Decimal(str(position_liquidity))

        return float(weighted_liquidity)

    def calculate_leverage_ratio(self, portfolio: Portfolio) -> float:
        """
        Calculate current leverage ratio.

        Args:
            portfolio: Portfolio to analyze

        Returns:
            Leverage ratio
        """
        # This is a simplified calculation
        # In practice, you'd need margin account data
        total_position_value = sum(
            pos.market_value for pos in portfolio.active_positions)
        equity_value = portfolio.total_value

        if equity_value == 0:
            return 1.0

        return float(total_position_value / equity_value)

    def assess_portfolio_risk(self,
                              portfolio: Portfolio,
                              historical_data: Dict[str,
                                                    Any] = None) -> RiskMetrics:
        """
        Perform comprehensive portfolio risk assessment.

        Args:
            portfolio: Portfolio to assess
            historical_data: Historical data for calculations

        Returns:
            Complete risk metrics
        """
        metrics = RiskMetrics()
        metrics.portfolio_value = portfolio.total_value

        # Get historical data if available
        returns = historical_data.get(
            'returns', []) if historical_data else self.historical_returns
        portfolio_values = historical_data.get(
            'values', []) if historical_data else self.historical_values
        market_returns = historical_data.get(
            'market_returns', []) if historical_data else self.market_returns
        correlation_matrix = historical_data.get(
            'correlation_matrix') if historical_data else None
        volume_data = historical_data.get(
            'volume_data', {}) if historical_data else {}

        # Calculate VaR and Expected Shortfall
        if len(returns) >= 30:
            metrics.var_95 = Decimal(
                str(self.calculate_var(returns, 0.95))) * portfolio.total_value
            metrics.var_99 = Decimal(
                str(self.calculate_var(returns, 0.99))) * portfolio.total_value
            metrics.expected_shortfall = Decimal(
                str(self.calculate_expected_shortfall(returns, 0.95))) * portfolio.total_value

        # Calculate drawdown
        if len(portfolio_values) >= 2:
            max_dd, current_dd = self.calculate_drawdown(portfolio_values)
            metrics.max_drawdown = max_dd
            metrics.current_drawdown = current_dd

        # Calculate volatility and Sharpe ratio
        if len(returns) >= 2:
            metrics.volatility_annual = self.calculate_volatility(
                returns, annualize=True)
            metrics.sharpe_ratio = self.calculate_sharpe_ratio(returns)

        # Calculate beta
        if len(returns) >= 30 and len(market_returns) >= 30:
            metrics.beta = self.calculate_beta(returns, market_returns)

        # Calculate risk scores
        metrics.concentration_risk = self.calculate_concentration_risk(
            portfolio)
        metrics.correlation_risk = self.calculate_correlation_risk(
            portfolio, correlation_matrix)
        metrics.liquidity_score = self.calculate_liquidity_score(
            portfolio, volume_data)
        metrics.leverage_ratio = self.calculate_leverage_ratio(portfolio)

        # Calculate overall risk score (0-100)
        risk_components = [
            metrics.concentration_risk * 20,  # 20% weight
            metrics.correlation_risk * 15,   # 15% weight
            (1 - metrics.liquidity_score) * 15,  # 15% weight (inverted)
            min(1.0, metrics.leverage_ratio / 3.0) * 15,  # 15% weight
            min(1.0, metrics.volatility_annual / 50.0) * 20,  # 20% weight
            min(1.0, metrics.current_drawdown / 20.0) * 15  # 15% weight
        ]

        metrics.risk_score = sum(risk_components)

        # Determine risk level
        if metrics.risk_score < 25:
            metrics.risk_level = RiskLevel.LOW
        elif metrics.risk_score < 50:
            metrics.risk_level = RiskLevel.MEDIUM
        elif metrics.risk_score < 75:
            metrics.risk_level = RiskLevel.HIGH
        else:
            metrics.risk_level = RiskLevel.EXTREME

        return metrics

    def validate_trade_risk(self,
                            trade: Trade,
                            portfolio: Portfolio,
                            current_metrics: RiskMetrics = None) -> Tuple[bool,
                                                                          List[str]]:
        """
        Validate if a trade complies with risk limits.

        Args:
            trade: Trade to validate
            portfolio: Current portfolio
            current_metrics: Current risk metrics

        Returns:
            Tuple of (is_valid, list_of_violations)
        """
        violations = []

        # Calculate position size as percentage of portfolio
        trade_value = trade.amount * trade.price
        portfolio_value = portfolio.total_value

        if portfolio_value > 0:
            position_pct = float(trade_value / portfolio_value * 100)

            # Check position size limit
            if position_pct > self.risk_limits.max_position_size_pct:
                violations.append(
                    f"Position size {
                        position_pct:.1f}% exceeds limit of {
                        self.risk_limits.max_position_size_pct}%")

        # Check concentration risk
        current_position = portfolio.get_position(trade.symbol)
        new_position_value = current_position.market_value + trade_value

        if portfolio_value > 0:
            new_concentration_pct = float(
                new_position_value / portfolio_value * 100)
            if new_concentration_pct > self.risk_limits.max_position_size_pct:
                violations.append(
                    f"Total position concentration {
                        new_concentration_pct:.1f}% exceeds limit")

        # Check current risk metrics against limits
        if current_metrics:
            if current_metrics.leverage_ratio > self.risk_limits.max_leverage_ratio:
                violations.append(
                    f"Leverage ratio {
                        current_metrics.leverage_ratio:.2f} exceeds limit of {
                        self.risk_limits.max_leverage_ratio}")

            if current_metrics.current_drawdown > self.risk_limits.max_drawdown_pct:
                violations.append(
                    f"Current drawdown {
                        current_metrics.current_drawdown:.1f}% exceeds limit")

            if current_metrics.liquidity_score < self.risk_limits.min_liquidity_score:
                violations.append(
                    f"Liquidity score {
                        current_metrics.liquidity_score:.2f} below minimum")

            var_pct = float(
                current_metrics.var_95 /
                portfolio_value *
                100) if portfolio_value > 0 else 0
            if var_pct > self.risk_limits.max_portfolio_var_pct:
                violations.append(
                    f"Portfolio VaR {
                        var_pct:.1f}% exceeds limit")

        return len(violations) == 0, violations

    def calculate_optimal_position_size(
            self,
            signal_strength: float,
            portfolio: Portfolio,
            volatility: float = 0.02,
            max_risk_per_trade: float = 0.02) -> Decimal:
        """
        Calculate optimal position size using risk-based sizing.

        Args:
            signal_strength: Signal strength (0-1)
            portfolio: Current portfolio
            volatility: Expected volatility of the asset
            max_risk_per_trade: Maximum risk per trade as fraction of portfolio

        Returns:
            Optimal position size in base currency
        """
        if portfolio.total_value == 0:
            return Decimal('0')

        # Base risk per trade
        risk_amount = portfolio.total_value * Decimal(str(max_risk_per_trade))

        # Adjust based on signal strength
        adjusted_risk = risk_amount * Decimal(str(signal_strength))

        # Adjust based on volatility (higher volatility = smaller position)
        volatility_adjustment = Decimal(str(1.0 / max(0.01, volatility)))
        position_size = adjusted_risk * volatility_adjustment

        # Apply position size limits
        max_position = portfolio.total_value * \
            Decimal(str(self.risk_limits.max_position_size_pct / 100))
        position_size = min(position_size, max_position)

        return position_size

    def generate_risk_report(self, metrics: RiskMetrics,
                             portfolio: Portfolio) -> Dict[str, Any]:
        """
        Generate comprehensive risk report.

        Args:
            metrics: Risk metrics
            portfolio: Portfolio data

        Returns:
            Detailed risk report
        """
        return {
            'summary': {
                'risk_level': metrics.risk_level.value,
                'risk_score': round(metrics.risk_score, 2),
                'portfolio_value': str(metrics.portfolio_value),
                'assessment_time': metrics.calculated_at.isoformat()
            },
            'var_analysis': {
                'var_95_dollar': str(metrics.var_95),
                'var_95_percent': float(metrics.var_95 / metrics.portfolio_value * 100) if metrics.portfolio_value > 0 else 0,
                'var_99_dollar': str(metrics.var_99),
                'var_99_percent': float(metrics.var_99 / metrics.portfolio_value * 100) if metrics.portfolio_value > 0 else 0,
                'expected_shortfall': str(metrics.expected_shortfall)
            },
            'drawdown_analysis': {
                'max_drawdown_percent': metrics.max_drawdown,
                'current_drawdown_percent': metrics.current_drawdown,
                'exceeds_limit': metrics.max_drawdown > self.risk_limits.max_drawdown_pct
            },
            'portfolio_metrics': {
                'volatility_annual_percent': metrics.volatility_annual,
                'sharpe_ratio': metrics.sharpe_ratio,
                'beta': metrics.beta,
                'leverage_ratio': metrics.leverage_ratio,
                'margin_usage_percent': metrics.margin_usage
            },
            'concentration_analysis': {
                'concentration_score': metrics.concentration_risk,
                'correlation_score': metrics.correlation_risk,
                'liquidity_score': metrics.liquidity_score,
                'position_count': len(portfolio.active_positions),
                'largest_position_percent': max([
                    float(pos.market_value / metrics.portfolio_value * 100)
                    for pos in portfolio.active_positions
                ]) if portfolio.active_positions and metrics.portfolio_value > 0 else 0
            },
            'risk_limits_status': {
                'within_var_limit': float(metrics.var_95 / metrics.portfolio_value * 100) <= self.risk_limits.max_portfolio_var_pct if metrics.portfolio_value > 0 else True,
                'within_drawdown_limit': metrics.max_drawdown <= self.risk_limits.max_drawdown_pct,
                'within_leverage_limit': metrics.leverage_ratio <= self.risk_limits.max_leverage_ratio,
                'within_volatility_limit': metrics.volatility_annual <= self.risk_limits.max_portfolio_volatility_pct,
                'above_min_liquidity': metrics.liquidity_score >= self.risk_limits.min_liquidity_score
            },
            'recommendations': self._generate_risk_recommendations(metrics, portfolio)
        }

    def _generate_risk_recommendations(
            self,
            metrics: RiskMetrics,
            portfolio: Portfolio) -> List[str]:
        """Generate risk management recommendations."""
        recommendations = []

        if metrics.risk_level == RiskLevel.EXTREME:
            recommendations.append(
                "URGENT: Risk level is EXTREME. Consider reducing positions immediately.")
        elif metrics.risk_level == RiskLevel.HIGH:
            recommendations.append(
                "WARNING: High risk level detected. Review and reduce risk exposure.")

        if metrics.concentration_risk > 0.7:
            recommendations.append(
                "High concentration risk. Consider diversifying positions across more assets.")

        if metrics.correlation_risk > 0.8:
            recommendations.append(
                "High correlation risk. Positions are highly correlated, reducing diversification benefits.")

        if metrics.liquidity_score < self.risk_limits.min_liquidity_score:
            recommendations.append(
                "Low liquidity score. Consider reducing positions in illiquid assets.")

        if metrics.leverage_ratio > self.risk_limits.max_leverage_ratio:
            recommendations.append(
                f"Leverage ratio {
                    metrics.leverage_ratio:.2f} exceeds safe limits. Reduce leverage.")

        if metrics.current_drawdown > self.risk_limits.max_drawdown_pct:
            recommendations.append(
                "Current drawdown exceeds limits. Consider defensive positioning.")

        if metrics.volatility_annual > self.risk_limits.max_portfolio_volatility_pct:
            recommendations.append(
                "Portfolio volatility is high. Consider adding less volatile assets.")

        if not recommendations:
            recommendations.append(
                "Risk profile is within acceptable limits. Continue monitoring.")

        return recommendations
