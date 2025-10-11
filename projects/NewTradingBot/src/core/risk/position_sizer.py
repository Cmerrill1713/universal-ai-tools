"""
Position sizing module for trading bot.
Implements various position sizing strategies and risk-based sizing.
"""

import math
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ...domain.portfolio import Portfolio, Position
from ...domain.trade import Trade, TradeSide, TradeType
from .risk_calculator import RiskLimits, RiskMetrics


class PositionSizingMethod(Enum):
    """Position sizing methods."""
    FIXED_AMOUNT = "fixed_amount"
    FIXED_PERCENTAGE = "fixed_percentage"
    VOLATILITY_ADJUSTED = "volatility_adjusted"
    KELLY_CRITERION = "kelly_criterion"
    RISK_PARITY = "risk_parity"
    OPTIMAL_F = "optimal_f"
    ATR_BASED = "atr_based"
    MONTE_CARLO = "monte_carlo"


@dataclass
class PositionSizeResult:
    """
    Result of position sizing calculation.

    Attributes:
        size: Recommended position size in base currency
        size_shares: Position size in number of shares/units
        risk_amount: Amount at risk for this position
        risk_percentage: Risk as percentage of portfolio
        confidence: Confidence in the sizing (0-1)
        method_used: Sizing method that was used
        constraints_applied: List of constraints that limited the size
        metadata: Additional calculation metadata
    """
    size: Decimal
    size_shares: Decimal
    risk_amount: Decimal
    risk_percentage: float
    confidence: float
    method_used: str
    constraints_applied: List[str]
    metadata: Dict[str, Any]


class PositionSizer:
    """
    Advanced position sizing system that uses multiple methods to determine
    optimal position sizes based on risk management principles.
    """

    def __init__(self, risk_limits: RiskLimits = None):
        """
        Initialize position sizer.

        Args:
            risk_limits: Risk limits configuration
        """
        self.risk_limits = risk_limits or RiskLimits()

        # Kelly Criterion parameters
        self.kelly_win_rate = 0.55  # Default win rate
        self.kelly_avg_win = 0.06   # Average win as decimal
        self.kelly_avg_loss = 0.03  # Average loss as decimal
        self.kelly_max_fraction = 0.25  # Maximum Kelly fraction

        # Volatility parameters
        self.vol_lookback_days = 30
        self.vol_target_annual = 0.20  # 20% annual volatility target

        # Risk parity parameters
        self.risk_budget_per_position = 0.05  # 5% risk budget per position

    def calculate_fixed_amount(
            self,
            amount: Decimal,
            current_price: Decimal) -> PositionSizeResult:
        """
        Calculate position size using fixed dollar amount.

        Args:
            amount: Fixed dollar amount to invest
            current_price: Current asset price

        Returns:
            Position sizing result
        """
        size_shares = amount / \
            current_price if current_price > 0 else Decimal('0')

        return PositionSizeResult(
            size=amount,
            size_shares=size_shares,
            risk_amount=amount * Decimal('0.02'),  # Assume 2% risk
            risk_percentage=2.0,
            confidence=1.0,
            method_used=PositionSizingMethod.FIXED_AMOUNT.value,
            constraints_applied=[],
            metadata={'fixed_amount': str(amount)}
        )

    def calculate_fixed_percentage(
            self,
            portfolio_value: Decimal,
            percentage: float,
            current_price: Decimal) -> PositionSizeResult:
        """
        Calculate position size using fixed percentage of portfolio.

        Args:
            portfolio_value: Total portfolio value
            percentage: Percentage of portfolio to allocate
            current_price: Current asset price

        Returns:
            Position sizing result
        """
        size = portfolio_value * Decimal(str(percentage / 100))
        size_shares = size / \
            current_price if current_price > 0 else Decimal('0')

        return PositionSizeResult(
            size=size,
            size_shares=size_shares,
            risk_amount=size * Decimal('0.02'),  # Assume 2% risk
            risk_percentage=percentage * 0.02,  # 2% of the allocation
            confidence=0.8,
            method_used=PositionSizingMethod.FIXED_PERCENTAGE.value,
            constraints_applied=[],
            metadata={'percentage': percentage}
        )

    def calculate_volatility_adjusted(
            self,
            portfolio_value: Decimal,
            current_price: Decimal,
            asset_volatility: float,
            target_volatility: float = None) -> PositionSizeResult:
        """
        Calculate position size adjusted for asset volatility.

        Args:
            portfolio_value: Total portfolio value
            current_price: Current asset price
            asset_volatility: Asset's historical volatility (annual)
            target_volatility: Target portfolio volatility

        Returns:
            Position sizing result
        """
        if target_volatility is None:
            target_volatility = self.vol_target_annual

        if asset_volatility <= 0:
            asset_volatility = 0.20  # Default 20% if no data

        # Position size inversely proportional to volatility
        vol_adjustment = target_volatility / asset_volatility

        # Base allocation as percentage of portfolio
        base_percentage = 10.0  # 10% base allocation
        adjusted_percentage = base_percentage * vol_adjustment

        # Cap the percentage
        adjusted_percentage = min(
            adjusted_percentage,
            self.risk_limits.max_position_size_pct)

        size = portfolio_value * Decimal(str(adjusted_percentage / 100))
        size_shares = size / \
            current_price if current_price > 0 else Decimal('0')

        # Risk amount based on volatility
        # 2x daily volatility as risk
        risk_amount = size * Decimal(str(asset_volatility * 2))
        risk_percentage = float(
            risk_amount /
            portfolio_value *
            100) if portfolio_value > 0 else 0

        constraints = []
        if adjusted_percentage != base_percentage * vol_adjustment:
            constraints.append(
                f"Capped at max position size {
                    self.risk_limits.max_position_size_pct}%")

        return PositionSizeResult(
            size=size,
            size_shares=size_shares,
            risk_amount=risk_amount,
            risk_percentage=risk_percentage,
            confidence=0.75,
            method_used=PositionSizingMethod.VOLATILITY_ADJUSTED.value,
            constraints_applied=constraints,
            metadata={
                'asset_volatility': asset_volatility,
                'target_volatility': target_volatility,
                'vol_adjustment': vol_adjustment,
                'adjusted_percentage': adjusted_percentage
            }
        )

    def calculate_kelly_criterion(
            self,
            portfolio_value: Decimal,
            current_price: Decimal,
            win_rate: float = None,
            avg_win: float = None,
            avg_loss: float = None) -> PositionSizeResult:
        """
        Calculate position size using Kelly Criterion.

        Args:
            portfolio_value: Total portfolio value
            current_price: Current asset price
            win_rate: Historical win rate (0-1)
            avg_win: Average win as decimal
            avg_loss: Average loss as decimal

        Returns:
            Position sizing result
        """
        # Use provided values or defaults
        win_rate = win_rate or self.kelly_win_rate
        avg_win = avg_win or self.kelly_avg_win
        avg_loss = avg_loss or self.kelly_avg_loss

        if avg_loss <= 0:
            avg_loss = 0.03  # Default to avoid division by zero

        # Kelly formula: f = (bp - q) / b
        # where b = odds received (avg_win/avg_loss), p = win probability, q =
        # loss probability
        b = avg_win / avg_loss
        p = win_rate
        q = 1 - win_rate

        kelly_fraction = (b * p - q) / b

        # Apply safety constraints
        kelly_fraction = max(0, kelly_fraction)  # No negative positions
        kelly_fraction = min(kelly_fraction,
                             self.kelly_max_fraction)  # Cap at maximum

        size = portfolio_value * Decimal(str(kelly_fraction))
        size_shares = size / \
            current_price if current_price > 0 else Decimal('0')

        # Risk is the potential loss
        risk_amount = size * Decimal(str(avg_loss))
        risk_percentage = float(
            risk_amount /
            portfolio_value *
            100) if portfolio_value > 0 else 0

        constraints = []
        if kelly_fraction <= 0:
            constraints.append(
                "Negative Kelly fraction - no position recommended")
        elif kelly_fraction == self.kelly_max_fraction:
            constraints.append(
                f"Capped at maximum Kelly fraction {
                    self.kelly_max_fraction}")

        confidence = min(
            0.9,
            kelly_fraction /
            0.2) if kelly_fraction > 0 else 0.1

        return PositionSizeResult(
            size=size,
            size_shares=size_shares,
            risk_amount=risk_amount,
            risk_percentage=risk_percentage,
            confidence=confidence,
            method_used=PositionSizingMethod.KELLY_CRITERION.value,
            constraints_applied=constraints,
            metadata={
                'kelly_fraction': kelly_fraction,
                'win_rate': win_rate,
                'avg_win': avg_win,
                'avg_loss': avg_loss,
                'odds_ratio': b
            }
        )

    def calculate_atr_based(
            self,
            portfolio_value: Decimal,
            current_price: Decimal,
            atr: Decimal,
            atr_multiplier: float = 2.0,
            risk_per_trade: float = 0.02) -> PositionSizeResult:
        """
        Calculate position size based on Average True Range (ATR).

        Args:
            portfolio_value: Total portfolio value
            current_price: Current asset price
            atr: Average True Range value
            atr_multiplier: ATR multiplier for stop loss
            risk_per_trade: Risk per trade as fraction of portfolio

        Returns:
            Position sizing result
        """
        if atr <= 0:
            # Fallback if no ATR data
            atr = current_price * Decimal('0.02')  # Assume 2% ATR

        # Calculate stop loss distance
        stop_distance = atr * Decimal(str(atr_multiplier))

        # Calculate position size based on risk
        risk_amount = portfolio_value * Decimal(str(risk_per_trade))

        if stop_distance > 0:
            size_shares = risk_amount / stop_distance
            size = size_shares * current_price
        else:
            size = Decimal('0')
            size_shares = Decimal('0')

        # Apply position size limits
        max_size = portfolio_value * \
            Decimal(str(self.risk_limits.max_position_size_pct / 100))
        constraints = []

        if size > max_size:
            size = max_size
            size_shares = size / \
                current_price if current_price > 0 else Decimal('0')
            constraints.append(
                f"Position capped at {
                    self.risk_limits.max_position_size_pct}% of portfolio")

        risk_percentage = float(
            risk_amount /
            portfolio_value *
            100) if portfolio_value > 0 else 0

        return PositionSizeResult(
            size=size,
            size_shares=size_shares,
            risk_amount=risk_amount,
            risk_percentage=risk_percentage,
            confidence=0.85,
            method_used=PositionSizingMethod.ATR_BASED.value,
            constraints_applied=constraints,
            metadata={
                'atr': str(atr),
                'atr_multiplier': atr_multiplier,
                'stop_distance': str(stop_distance),
                'risk_per_trade': risk_per_trade
            }
        )

    def calculate_risk_parity(
            self,
            portfolio_value: Decimal,
            current_price: Decimal,
            asset_volatility: float,
            target_risk_contribution: float = None) -> PositionSizeResult:
        """
        Calculate position size using risk parity approach.

        Args:
            portfolio_value: Total portfolio value
            current_price: Current asset price
            asset_volatility: Asset's volatility
            target_risk_contribution: Target risk contribution

        Returns:
            Position sizing result
        """
        if target_risk_contribution is None:
            target_risk_contribution = self.risk_budget_per_position

        if asset_volatility <= 0:
            asset_volatility = 0.20  # Default volatility

        # Risk budget for this position
        risk_budget = portfolio_value * Decimal(str(target_risk_contribution))

        # Position size = risk_budget / volatility
        # This ensures each position contributes equally to portfolio risk
        position_volatility_adjusted = risk_budget / \
            Decimal(str(asset_volatility))

        size = position_volatility_adjusted
        size_shares = size / \
            current_price if current_price > 0 else Decimal('0')

        # Apply constraints
        max_size = portfolio_value * \
            Decimal(str(self.risk_limits.max_position_size_pct / 100))
        constraints = []

        if size > max_size:
            size = max_size
            size_shares = size / \
                current_price if current_price > 0 else Decimal('0')
            constraints.append("Position capped at maximum size limit")

        risk_amount = size * Decimal(str(asset_volatility))
        risk_percentage = float(
            risk_amount /
            portfolio_value *
            100) if portfolio_value > 0 else 0

        return PositionSizeResult(
            size=size,
            size_shares=size_shares,
            risk_amount=risk_amount,
            risk_percentage=risk_percentage,
            confidence=0.8,
            method_used=PositionSizingMethod.RISK_PARITY.value,
            constraints_applied=constraints,
            metadata={
                'asset_volatility': asset_volatility,
                'target_risk_contribution': target_risk_contribution,
                'risk_budget': str(risk_budget)
            }
        )

    def calculate_optimal_position_size(self,
                                        portfolio: Portfolio,
                                        signal_data: Dict[str, Any],
                                        market_data: Dict[str, Any],
                                        method: PositionSizingMethod = PositionSizingMethod.VOLATILITY_ADJUSTED) -> PositionSizeResult:
        """
        Calculate optimal position size using specified method.

        Args:
            portfolio: Current portfolio
            signal_data: Trading signal information
            market_data: Market data for the asset
            method: Position sizing method to use

        Returns:
            Position sizing result
        """
        symbol = signal_data.get('symbol', '')
        current_price = Decimal(str(market_data.get('price', 0)))
        portfolio_value = portfolio.total_value

        if portfolio_value == 0 or current_price == 0:
            return PositionSizeResult(
                size=Decimal('0'),
                size_shares=Decimal('0'),
                risk_amount=Decimal('0'),
                risk_percentage=0.0,
                confidence=0.0,
                method_used=method.value,
                constraints_applied=["Zero portfolio value or price"],
                metadata={}
            )

        # Get additional market data
        volatility = market_data.get('volatility', 0.20)  # Annual volatility
        atr = market_data.get('atr', current_price * Decimal('0.02'))  # ATR

        # Get signal strength for confidence weighting
        signal_strength = signal_data.get('strength', 0.5)
        signal_confidence = signal_data.get('confidence', 0.5)

        # Calculate base position size using selected method
        if method == PositionSizingMethod.FIXED_AMOUNT:
            base_amount = portfolio_value * Decimal('0.10')  # 10% default
            result = self.calculate_fixed_amount(base_amount, current_price)

        elif method == PositionSizingMethod.FIXED_PERCENTAGE:
            result = self.calculate_fixed_percentage(
                portfolio_value, 10.0, current_price)

        elif method == PositionSizingMethod.VOLATILITY_ADJUSTED:
            result = self.calculate_volatility_adjusted(
                portfolio_value, current_price, volatility)

        elif method == PositionSizingMethod.KELLY_CRITERION:
            win_rate = signal_data.get(
                'historical_win_rate', self.kelly_win_rate)
            avg_win = signal_data.get('avg_win', self.kelly_avg_win)
            avg_loss = signal_data.get('avg_loss', self.kelly_avg_loss)
            result = self.calculate_kelly_criterion(
                portfolio_value, current_price, win_rate, avg_win, avg_loss)

        elif method == PositionSizingMethod.ATR_BASED:
            result = self.calculate_atr_based(
                portfolio_value, current_price, atr)

        elif method == PositionSizingMethod.RISK_PARITY:
            result = self.calculate_risk_parity(
                portfolio_value, current_price, volatility)

        else:
            # Default to volatility adjusted
            result = self.calculate_volatility_adjusted(
                portfolio_value, current_price, volatility)

        # Apply signal-based adjustments
        result = self._apply_signal_adjustments(
            result, signal_strength, signal_confidence)

        # Apply portfolio constraints
        result = self._apply_portfolio_constraints(result, portfolio, symbol)

        return result

    def _apply_signal_adjustments(
            self,
            result: PositionSizeResult,
            signal_strength: float,
            signal_confidence: float) -> PositionSizeResult:
        """Apply adjustments based on signal quality."""
        # Combine signal strength and confidence
        signal_quality = (signal_strength + signal_confidence) / 2

        # Adjust position size based on signal quality
        adjustment_factor = Decimal(
            str(0.5 + signal_quality * 0.5))  # Range: 0.5 to 1.0

        result.size = result.size * adjustment_factor
        result.size_shares = result.size_shares * adjustment_factor
        result.risk_amount = result.risk_amount * adjustment_factor

        # Update confidence
        result.confidence = result.confidence * signal_quality

        # Add to metadata
        result.metadata['signal_strength'] = signal_strength
        result.metadata['signal_confidence'] = signal_confidence
        result.metadata['signal_adjustment_factor'] = str(adjustment_factor)

        if adjustment_factor < Decimal('1.0'):
            result.constraints_applied.append(
                f"Position reduced by {(1 - float(adjustment_factor)) * 100:.1f}% due to signal quality")

        return result

    def _apply_portfolio_constraints(self, result: PositionSizeResult,
                                     portfolio: Portfolio,
                                     symbol: str) -> PositionSizeResult:
        """Apply portfolio-level constraints."""
        portfolio_value = portfolio.total_value

        if portfolio_value == 0:
            return result

        # Check existing position
        existing_position = portfolio.get_position(symbol)
        total_position_size = result.size + existing_position.market_value

        # Position size constraint
        max_position_value = portfolio_value * \
            Decimal(str(self.risk_limits.max_position_size_pct / 100))

        if total_position_size > max_position_value:
            # Reduce size to fit within limits
            available_size = max_position_value - existing_position.market_value
            available_size = max(Decimal('0'), available_size)

            if available_size < result.size:
                reduction_factor = available_size / \
                    result.size if result.size > 0 else Decimal('0')

                result.size = available_size
                result.size_shares = result.size_shares * reduction_factor
                result.risk_amount = result.risk_amount * reduction_factor
                result.constraints_applied.append(
                    f"Position size reduced to stay within {
                        self.risk_limits.max_position_size_pct}% limit")

        # Check total number of positions
        if len(portfolio.active_positions) >= 20:  # Arbitrary limit
            result.size = result.size * Decimal('0.8')  # Reduce by 20%
            result.size_shares = result.size_shares * Decimal('0.8')
            result.risk_amount = result.risk_amount * Decimal('0.8')
            result.constraints_applied.append(
                "Position reduced due to high number of existing positions")

        # Update risk percentage
        result.risk_percentage = float(
            result.risk_amount /
            portfolio_value *
            100) if portfolio_value > 0 else 0

        return result

    def get_sizing_recommendation(self,
                                  portfolio: Portfolio,
                                  signal_data: Dict[str, Any],
                                  market_data: Dict[str, Any],
                                  risk_metrics: RiskMetrics = None) -> Dict[str, Any]:
        """
        Get comprehensive position sizing recommendation.

        Args:
            portfolio: Current portfolio
            signal_data: Trading signal data
            market_data: Market data
            risk_metrics: Current risk metrics

        Returns:
            Comprehensive sizing recommendation
        """
        # Calculate sizes using multiple methods
        methods = [
            PositionSizingMethod.VOLATILITY_ADJUSTED,
            PositionSizingMethod.KELLY_CRITERION,
            PositionSizingMethod.ATR_BASED,
            PositionSizingMethod.RISK_PARITY
        ]

        results = {}
        for method in methods:
            try:
                results[method.value] = self.calculate_optimal_position_size(
                    portfolio, signal_data, market_data, method
                )
            except Exception as e:
                results[method.value] = None

        # Filter successful results
        valid_results = {k: v for k, v in results.items() if v is not None}

        if not valid_results:
            return {
                'recommended_size': Decimal('0'),
                'recommended_method': 'none',
                'confidence': 0.0,
                'risk_assessment': 'Unable to calculate position size',
                'methods_compared': {},
                'constraints': ['All sizing methods failed']
            }

        # Choose best method based on confidence and constraints
        best_method = None
        best_score = 0

        for method, result in valid_results.items():
            # Score based on confidence and inverse of constraints
            score = result.confidence * \
                (1 - len(result.constraints_applied) * 0.1)

            if score > best_score:
                best_score = score
                best_method = method

        recommended_result = valid_results[best_method]

        # Risk assessment
        risk_level = "low"
        if recommended_result.risk_percentage > 3.0:
            risk_level = "high"
        elif recommended_result.risk_percentage > 1.5:
            risk_level = "medium"

        return {
            'recommended_size': recommended_result.size,
            'recommended_shares': recommended_result.size_shares,
            'recommended_method': best_method,
            'confidence': recommended_result.confidence,
            'risk_amount': recommended_result.risk_amount,
            'risk_percentage': recommended_result.risk_percentage,
            'risk_assessment': risk_level,
            'methods_compared': {
                method: {
                    'size': str(result.size),
                    'confidence': result.confidence,
                    'constraints': result.constraints_applied
                }
                for method, result in valid_results.items()
            },
            'constraints': recommended_result.constraints_applied,
            'metadata': recommended_result.metadata
        }
