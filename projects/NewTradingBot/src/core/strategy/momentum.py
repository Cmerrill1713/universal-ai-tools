"""
Momentum trading strategy implementation.
Uses price momentum and technical indicators to identify trending assets.
"""

from decimal import Decimal
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import ta

from .strategy_base import (BaseStrategy, SignalType, StrategyConfig,
                            TradingSignal)


class MomentumConfig(StrategyConfig):
    """Configuration specific to momentum strategy."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.name = "Momentum Strategy"
        self.description = "Trades based on price momentum and trend following"

        # Momentum-specific parameters
        self.rsi_period = kwargs.get('rsi_period', 14)
        self.rsi_oversold = kwargs.get('rsi_oversold', 30)
        self.rsi_overbought = kwargs.get('rsi_overbought', 70)

        self.macd_fast = kwargs.get('macd_fast', 12)
        self.macd_slow = kwargs.get('macd_slow', 26)
        self.macd_signal = kwargs.get('macd_signal', 9)

        self.sma_short = kwargs.get('sma_short', 20)
        self.sma_long = kwargs.get('sma_long', 50)

        self.volume_threshold_multiplier = kwargs.get(
            'volume_threshold_multiplier', 1.5)
        self.momentum_lookback = kwargs.get('momentum_lookback', 10)

        # Momentum strength thresholds
        self.strong_momentum_threshold = kwargs.get(
            'strong_momentum_threshold', 0.8)
        self.weak_momentum_threshold = kwargs.get(
            'weak_momentum_threshold', 0.3)

        # Trend confirmation requirements
        self.require_volume_confirmation = kwargs.get(
            'require_volume_confirmation', True)
        self.require_multiple_timeframes = kwargs.get(
            'require_multiple_timeframes', False)


class MomentumStrategy(BaseStrategy):
    """
    Momentum trading strategy that identifies and follows price trends.

    The strategy uses multiple technical indicators to confirm momentum:
    - RSI for overbought/oversold conditions
    - MACD for trend direction and momentum
    - Moving averages for trend confirmation
    - Volume analysis for momentum validation
    """

    def __init__(self, config: MomentumConfig = None):
        """Initialize momentum strategy."""
        if config is None:
            config = MomentumConfig()
        super().__init__(config)
        self.config: MomentumConfig = config

    def get_required_columns(self) -> List[str]:
        """Get required data columns for momentum strategy."""
        return ['open', 'high', 'low', 'close', 'volume']

    def calculate_indicators(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate technical indicators for momentum analysis.

        Args:
            data: OHLCV DataFrame

        Returns:
            Dictionary of calculated indicators
        """
        indicators = {}

        # Price data
        close = data['close']
        high = data['high']
        low = data['low']
        volume = data['volume']

        # RSI
        indicators['rsi'] = ta.momentum.rsi(
            close, window=self.config.rsi_period)

        # MACD
        macd_line = ta.trend.macd(close, window_slow=self.config.macd_slow,
                                  window_fast=self.config.macd_fast)
        macd_signal = ta.trend.macd_signal(
            close,
            window_slow=self.config.macd_slow,
            window_fast=self.config.macd_fast,
            window_sign=self.config.macd_signal)
        macd_histogram = macd_line - macd_signal

        indicators['macd'] = macd_line
        indicators['macd_signal'] = macd_signal
        indicators['macd_histogram'] = macd_histogram

        # Moving Averages
        indicators['sma_short'] = ta.trend.sma_indicator(
            close, window=self.config.sma_short)
        indicators['sma_long'] = ta.trend.sma_indicator(
            close, window=self.config.sma_long)

        # Bollinger Bands
        bb_upper = ta.volatility.bollinger_hband(close)
        bb_lower = ta.volatility.bollinger_lband(close)
        bb_middle = ta.volatility.bollinger_mavg(close)

        indicators['bb_upper'] = bb_upper
        indicators['bb_lower'] = bb_lower
        indicators['bb_middle'] = bb_middle
        indicators['bb_width'] = (bb_upper - bb_lower) / bb_middle

        # Volume indicators
        indicators['volume_sma'] = ta.volume.volume_sma(close, volume)
        indicators['volume_ratio'] = volume / indicators['volume_sma']

        # ATR for volatility
        indicators['atr'] = ta.volatility.average_true_range(high, low, close)

        # Price momentum
        indicators['momentum'] = close.pct_change(
            self.config.momentum_lookback)
        indicators['price_rate_of_change'] = ta.momentum.roc(
            close, window=self.config.momentum_lookback)

        # Trend strength
        adx = ta.trend.adx(high, low, close)
        indicators['adx'] = adx

        # Stochastic
        stoch_k = ta.momentum.stoch(high, low, close)
        stoch_d = ta.momentum.stoch_signal(high, low, close)
        indicators['stoch_k'] = stoch_k
        indicators['stoch_d'] = stoch_d

        return indicators

    def analyze_momentum_strength(self, indicators: Dict[str, Any],
                                  index: int) -> float:
        """
        Analyze the strength of momentum at a specific point.

        Args:
            indicators: Calculated technical indicators
            index: Index position to analyze

        Returns:
            Momentum strength score (0.0 to 1.0)
        """
        if index < 1:
            return 0.0

        scores = []

        # MACD momentum score
        macd = indicators['macd'].iloc[index]
        macd_signal = indicators['macd_signal'].iloc[index]
        macd_hist = indicators['macd_histogram'].iloc[index]
        macd_hist_prev = indicators['macd_histogram'].iloc[index - 1]

        if not pd.isna(macd) and not pd.isna(macd_signal):
            if macd > macd_signal and macd_hist > macd_hist_prev:
                scores.append(0.8)  # Strong bullish momentum
            elif macd > macd_signal:
                scores.append(0.6)  # Moderate bullish momentum
            elif macd < macd_signal and macd_hist < macd_hist_prev:
                scores.append(0.2)  # Strong bearish momentum
            else:
                scores.append(0.4)  # Moderate bearish momentum

        # RSI momentum score
        rsi = indicators['rsi'].iloc[index]
        if not pd.isna(rsi):
            if 50 < rsi < 80:
                scores.append(0.7)  # Good upward momentum
            elif rsi >= 80:
                scores.append(0.3)  # Overbought, weak momentum
            elif 20 < rsi < 50:
                scores.append(0.3)  # Downward momentum
            else:
                scores.append(0.1)  # Oversold, very weak momentum

        # Moving average momentum
        sma_short = indicators['sma_short'].iloc[index]
        sma_long = indicators['sma_long'].iloc[index]
        close_price = indicators.get(
            'close', pd.Series()).iloc[index] if 'close' in indicators else None

        if not pd.isna(sma_short) and not pd.isna(sma_long) and close_price:
            if sma_short > sma_long and close_price > sma_short:
                scores.append(0.8)  # Strong uptrend
            elif sma_short > sma_long:
                scores.append(0.6)  # Moderate uptrend
            elif sma_short < sma_long and close_price < sma_short:
                scores.append(0.2)  # Strong downtrend
            else:
                scores.append(0.4)  # Weak trend

        # Volume momentum score
        volume_ratio = indicators['volume_ratio'].iloc[index]
        if not pd.isna(volume_ratio):
            if volume_ratio > self.config.volume_threshold_multiplier:
                scores.append(0.8)  # High volume confirmation
            elif volume_ratio > 1.0:
                scores.append(0.6)  # Above average volume
            else:
                scores.append(0.3)  # Below average volume

        # ADX trend strength
        adx = indicators['adx'].iloc[index]
        if not pd.isna(adx):
            if adx > 50:
                scores.append(0.9)  # Very strong trend
            elif adx > 25:
                scores.append(0.7)  # Strong trend
            else:
                scores.append(0.3)  # Weak trend

        return np.mean(scores) if scores else 0.0

    def analyze_market(self, data: pd.DataFrame) -> List[TradingSignal]:
        """
        Analyze market data and generate momentum-based trading signals.

        Args:
            data: OHLCV DataFrame with datetime index

        Returns:
            List of trading signals
        """
        if not self.validate_data(data):
            return []

        # Calculate all indicators
        indicators = self.calculate_indicators(data)

        # Add price data to indicators for analysis
        indicators['close'] = data['close']

        signals = []
        current_index = len(data) - 1  # Analyze the most recent data point

        if current_index < self.config.lookback_periods:
            return signals

        # Get current values
        current_close = data['close'].iloc[current_index]
        rsi_current = indicators['rsi'].iloc[current_index]
        macd_current = indicators['macd'].iloc[current_index]
        macd_signal_current = indicators['macd_signal'].iloc[current_index]
        sma_short_current = indicators['sma_short'].iloc[current_index]
        sma_long_current = indicators['sma_long'].iloc[current_index]
        volume_ratio = indicators['volume_ratio'].iloc[current_index]

        # Check for valid data
        if any(
            pd.isna(val) for val in [
                rsi_current,
                macd_current,
                macd_signal_current,
                sma_short_current,
                sma_long_current]):
            return signals

        # Calculate momentum strength
        momentum_strength = self.analyze_momentum_strength(
            indicators, current_index)

        # Generate buy signal
        buy_conditions = [
            rsi_current > 50 and rsi_current < self.config.rsi_overbought,  # Not overbought
            macd_current > macd_signal_current,  # MACD bullish
            sma_short_current > sma_long_current,  # Uptrend
            current_close > sma_short_current,  # Price above short MA
            momentum_strength > self.config.weak_momentum_threshold
        ]

        # Volume confirmation (if required)
        if self.config.require_volume_confirmation:
            buy_conditions.append(volume_ratio > 1.2)

        # Generate sell signal
        sell_conditions = [
            rsi_current < 50 and rsi_current > self.config.rsi_oversold,  # Not oversold
            macd_current < macd_signal_current,  # MACD bearish
            sma_short_current < sma_long_current,  # Downtrend
            current_close < sma_short_current,  # Price below short MA
            momentum_strength < (1 - self.config.weak_momentum_threshold)
        ]

        # Volume confirmation for sell
        if self.config.require_volume_confirmation:
            sell_conditions.append(volume_ratio > 1.2)

        # Determine signal type and strength
        symbol = data.attrs.get('symbol', 'UNKNOWN')

        if all(buy_conditions):
            signal_type = SignalType.STRONG_BUY if momentum_strength > self.config.strong_momentum_threshold else SignalType.BUY
            confidence = min(0.95, 0.6 + momentum_strength * 0.4)

            # Calculate targets
            atr = indicators['atr'].iloc[current_index]
            stop_loss = current_close - (atr * 2)
            take_profit = current_close + (atr * 3)

            signal = TradingSignal(
                signal_type=signal_type,
                symbol=symbol,
                strength=momentum_strength,
                confidence=confidence,
                price_target=Decimal(str(current_close)),
                stop_loss=Decimal(str(stop_loss)),
                take_profit=Decimal(str(take_profit)),
                indicators={
                    'rsi': float(rsi_current),
                    'macd': float(macd_current),
                    'macd_signal': float(macd_signal_current),
                    'sma_short': float(sma_short_current),
                    'sma_long': float(sma_long_current),
                    'volume_ratio': float(volume_ratio),
                    'momentum_strength': momentum_strength,
                    'atr': float(atr)
                },
                metadata={
                    'strategy': 'momentum',
                    'conditions_met': len([c for c in buy_conditions if c]),
                    'total_conditions': len(buy_conditions)
                }
            )
            signals.append(signal)

        elif all(sell_conditions):
            signal_type = SignalType.STRONG_SELL if momentum_strength < (
                1 - self.config.strong_momentum_threshold) else SignalType.SELL
            confidence = min(0.95, 0.6 + (1 - momentum_strength) * 0.4)

            # Calculate targets
            atr = indicators['atr'].iloc[current_index]
            stop_loss = current_close + (atr * 2)
            take_profit = current_close - (atr * 3)

            signal = TradingSignal(
                signal_type=signal_type,
                symbol=symbol,
                strength=1 - momentum_strength,
                confidence=confidence,
                price_target=Decimal(str(current_close)),
                stop_loss=Decimal(str(stop_loss)),
                take_profit=Decimal(str(take_profit)),
                indicators={
                    'rsi': float(rsi_current),
                    'macd': float(macd_current),
                    'macd_signal': float(macd_signal_current),
                    'sma_short': float(sma_short_current),
                    'sma_long': float(sma_long_current),
                    'volume_ratio': float(volume_ratio),
                    'momentum_strength': momentum_strength,
                    'atr': float(atr)
                },
                metadata={
                    'strategy': 'momentum',
                    'conditions_met': len([c for c in sell_conditions if c]),
                    'total_conditions': len(sell_conditions)
                }
            )
            signals.append(signal)

        return self.filter_signals(signals)

    def get_strategy_info(self) -> Dict[str, Any]:
        """Get detailed information about the momentum strategy."""
        return {
            'name': self.config.name,
            'type': 'momentum',
            'description': self.config.description,
            'parameters': {
                'rsi_period': self.config.rsi_period,
                'rsi_oversold': self.config.rsi_oversold,
                'rsi_overbought': self.config.rsi_overbought,
                'macd_fast': self.config.macd_fast,
                'macd_slow': self.config.macd_slow,
                'macd_signal': self.config.macd_signal,
                'sma_short': self.config.sma_short,
                'sma_long': self.config.sma_long,
                'volume_threshold_multiplier': self.config.volume_threshold_multiplier,
                'momentum_lookback': self.config.momentum_lookback,
                'strong_momentum_threshold': self.config.strong_momentum_threshold,
                'weak_momentum_threshold': self.config.weak_momentum_threshold,
                'require_volume_confirmation': self.config.require_volume_confirmation},
            'risk_management': {
                'max_position_size': str(
                    self.config.max_position_size),
                'stop_loss_percentage': self.config.stop_loss_percentage,
                'take_profit_percentage': self.config.take_profit_percentage,
                'risk_reward_ratio': self.config.risk_reward_ratio},
            'performance': self.performance_metrics}
