"""
Mean reversion trading strategy implementation.
Identifies oversold/overbought conditions and trades on expected price reversals.
"""

from typing import Dict, List, Any
import pandas as pd
import numpy as np
from decimal import Decimal
import ta
from scipy import stats

from .strategy_base import BaseStrategy, StrategyConfig, TradingSignal, SignalType


class MeanReversionConfig(StrategyConfig):
    """Configuration specific to mean reversion strategy."""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.name = "Mean Reversion Strategy"
        self.description = "Trades on price reversals from extreme levels"
        
        # Mean reversion specific parameters
        self.bb_period = kwargs.get('bb_period', 20)
        self.bb_std_dev = kwargs.get('bb_std_dev', 2.0)
        
        self.rsi_period = kwargs.get('rsi_period', 14)
        self.rsi_oversold = kwargs.get('rsi_oversold', 20)
        self.rsi_overbought = kwargs.get('rsi_overbought', 80)
        
        self.stoch_k_period = kwargs.get('stoch_k_period', 14)
        self.stoch_d_period = kwargs.get('stoch_d_period', 3)
        self.stoch_oversold = kwargs.get('stoch_oversold', 20)
        self.stoch_overbought = kwargs.get('stoch_overbought', 80)
        
        # Mean calculation parameters
        self.mean_lookback = kwargs.get('mean_lookback', 50)
        self.deviation_threshold = kwargs.get('deviation_threshold', 2.0)  # Standard deviations
        
        # Reversal confirmation
        self.require_volume_spike = kwargs.get('require_volume_spike', True)
        self.volume_spike_multiplier = kwargs.get('volume_spike_multiplier', 2.0)
        self.require_divergence = kwargs.get('require_divergence', False)
        
        # Entry timing
        self.entry_confirmation_periods = kwargs.get('entry_confirmation_periods', 2)
        self.max_hold_periods = kwargs.get('max_hold_periods', 20)
        
        # Risk management specific to mean reversion
        self.quick_exit_threshold = kwargs.get('quick_exit_threshold', 0.5)  # Quick exit if trade goes against us


class MeanReversionStrategy(BaseStrategy):
    """
    Mean reversion trading strategy that identifies extreme price movements
    and trades on the expectation of price returning to its mean.
    
    The strategy uses multiple indicators to identify reversal opportunities:
    - Bollinger Bands for price extremes
    - RSI for momentum extremes
    - Stochastic for overbought/oversold conditions
    - Volume analysis for confirmation
    - Statistical analysis for mean calculation
    """
    
    def __init__(self, config: MeanReversionConfig = None):
        """Initialize mean reversion strategy."""
        if config is None:
            config = MeanReversionConfig()
        super().__init__(config)
        self.config: MeanReversionConfig = config
    
    def get_required_columns(self) -> List[str]:
        """Get required data columns for mean reversion strategy."""
        return ['open', 'high', 'low', 'close', 'volume']
    
    def calculate_indicators(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate technical indicators for mean reversion analysis.
        
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
        
        # Bollinger Bands
        bb_upper = ta.volatility.bollinger_hband(close, window=self.config.bb_period, 
                                                window_dev=self.config.bb_std_dev)
        bb_lower = ta.volatility.bollinger_lband(close, window=self.config.bb_period,
                                                window_dev=self.config.bb_std_dev)
        bb_middle = ta.volatility.bollinger_mavg(close, window=self.config.bb_period)
        
        indicators['bb_upper'] = bb_upper
        indicators['bb_lower'] = bb_lower
        indicators['bb_middle'] = bb_middle
        indicators['bb_width'] = (bb_upper - bb_lower) / bb_middle
        
        # Bollinger Band position (0 = at lower band, 1 = at upper band)
        indicators['bb_position'] = (close - bb_lower) / (bb_upper - bb_lower)
        
        # RSI
        indicators['rsi'] = ta.momentum.rsi(close, window=self.config.rsi_period)
        
        # Stochastic Oscillator
        indicators['stoch_k'] = ta.momentum.stoch(high, low, close, 
                                                 window=self.config.stoch_k_period,
                                                 smooth_window=self.config.stoch_d_period)
        indicators['stoch_d'] = ta.momentum.stoch_signal(high, low, close,
                                                        window=self.config.stoch_k_period,
                                                        smooth_window=self.config.stoch_d_period)
        
        # Williams %R
        indicators['williams_r'] = ta.momentum.williams_r(high, low, close)
        
        # Price statistics
        rolling_mean = close.rolling(window=self.config.mean_lookback).mean()
        rolling_std = close.rolling(window=self.config.mean_lookback).std()
        
        indicators['price_mean'] = rolling_mean
        indicators['price_std'] = rolling_std
        indicators['z_score'] = (close - rolling_mean) / rolling_std
        
        # Volume analysis
        volume_sma = ta.volume.volume_sma(close, volume, window=self.config.mean_lookback)
        indicators['volume_sma'] = volume_sma
        indicators['volume_ratio'] = volume / volume_sma
        
        # Price momentum for divergence detection
        indicators['momentum_5'] = ta.momentum.roc(close, window=5)
        indicators['momentum_10'] = ta.momentum.roc(close, window=10)
        
        # ATR for stop loss calculation
        indicators['atr'] = ta.volatility.average_true_range(high, low, close)
        
        # Support and resistance levels (pivot points)
        indicators['pivot'] = (high + low + close) / 3
        indicators['resistance_1'] = 2 * indicators['pivot'] - low
        indicators['support_1'] = 2 * indicators['pivot'] - high
        
        # Mean reversion signals
        indicators['oversold_signal'] = (
            (indicators['rsi'] < self.config.rsi_oversold) & 
            (indicators['stoch_k'] < self.config.stoch_oversold) &
            (indicators['bb_position'] < 0.1)
        ).astype(int)
        
        indicators['overbought_signal'] = (
            (indicators['rsi'] > self.config.rsi_overbought) & 
            (indicators['stoch_k'] > self.config.stoch_overbought) &
            (indicators['bb_position'] > 0.9)
        ).astype(int)
        
        return indicators
    
    def detect_bullish_divergence(self, data: pd.DataFrame, 
                                indicators: Dict[str, Any], 
                                current_index: int) -> bool:
        """
        Detect bullish divergence between price and momentum indicators.
        
        Args:
            data: Price data
            indicators: Technical indicators
            current_index: Current data point index
            
        Returns:
            True if bullish divergence detected
        """
        if current_index < self.config.mean_lookback:
            return False
        
        # Look for price making lower lows while RSI makes higher lows
        lookback_period = min(20, current_index)
        price_data = data['close'].iloc[current_index - lookback_period:current_index + 1]
        rsi_data = indicators['rsi'].iloc[current_index - lookback_period:current_index + 1]
        
        # Find local minima
        price_lows = []
        rsi_lows = []
        
        for i in range(2, len(price_data) - 2):
            if (price_data.iloc[i] < price_data.iloc[i-1] and 
                price_data.iloc[i] < price_data.iloc[i+1] and
                price_data.iloc[i] < price_data.iloc[i-2] and
                price_data.iloc[i] < price_data.iloc[i+2]):
                price_lows.append((i, price_data.iloc[i]))
                rsi_lows.append((i, rsi_data.iloc[i]))
        
        if len(price_lows) < 2:
            return False
        
        # Check if recent low is lower in price but higher in RSI
        recent_price_low = price_lows[-1][1]
        recent_rsi_low = rsi_lows[-1][1]
        prev_price_low = price_lows[-2][1]
        prev_rsi_low = rsi_lows[-2][1]
        
        return recent_price_low < prev_price_low and recent_rsi_low > prev_rsi_low
    
    def detect_bearish_divergence(self, data: pd.DataFrame, 
                                 indicators: Dict[str, Any], 
                                 current_index: int) -> bool:
        """
        Detect bearish divergence between price and momentum indicators.
        
        Args:
            data: Price data
            indicators: Technical indicators
            current_index: Current data point index
            
        Returns:
            True if bearish divergence detected
        """
        if current_index < self.config.mean_lookback:
            return False
        
        # Look for price making higher highs while RSI makes lower highs
        lookback_period = min(20, current_index)
        price_data = data['close'].iloc[current_index - lookback_period:current_index + 1]
        rsi_data = indicators['rsi'].iloc[current_index - lookback_period:current_index + 1]
        
        # Find local maxima
        price_highs = []
        rsi_highs = []
        
        for i in range(2, len(price_data) - 2):
            if (price_data.iloc[i] > price_data.iloc[i-1] and 
                price_data.iloc[i] > price_data.iloc[i+1] and
                price_data.iloc[i] > price_data.iloc[i-2] and
                price_data.iloc[i] > price_data.iloc[i+2]):
                price_highs.append((i, price_data.iloc[i]))
                rsi_highs.append((i, rsi_data.iloc[i]))
        
        if len(price_highs) < 2:
            return False
        
        # Check if recent high is higher in price but lower in RSI
        recent_price_high = price_highs[-1][1]
        recent_rsi_high = rsi_highs[-1][1]
        prev_price_high = price_highs[-2][1]
        prev_rsi_high = rsi_highs[-2][1]
        
        return recent_price_high > prev_price_high and recent_rsi_high < prev_rsi_high
    
    def calculate_reversion_probability(self, indicators: Dict[str, Any], 
                                      current_index: int) -> float:
        """
        Calculate the probability of mean reversion based on current conditions.
        
        Args:
            indicators: Technical indicators
            current_index: Current data point index
            
        Returns:
            Reversion probability (0.0 to 1.0)
        """
        if current_index < self.config.mean_lookback:
            return 0.0
        
        probability_factors = []
        
        # Z-score factor (how far from mean)
        z_score = abs(indicators['z_score'].iloc[current_index])
        if not pd.isna(z_score):
            z_factor = min(1.0, z_score / 3.0)  # Normalize to 3 standard deviations
            probability_factors.append(z_factor)
        
        # Bollinger Band position factor
        bb_position = indicators['bb_position'].iloc[current_index]
        if not pd.isna(bb_position):
            # Higher probability at extremes
            bb_factor = max(0, min(1.0, 2 * abs(bb_position - 0.5)))
            probability_factors.append(bb_factor)
        
        # RSI extreme factor
        rsi = indicators['rsi'].iloc[current_index]
        if not pd.isna(rsi):
            if rsi <= self.config.rsi_oversold:
                rsi_factor = 0.8 + (self.config.rsi_oversold - rsi) / self.config.rsi_oversold * 0.2
            elif rsi >= self.config.rsi_overbought:
                rsi_factor = 0.8 + (rsi - self.config.rsi_overbought) / (100 - self.config.rsi_overbought) * 0.2
            else:
                rsi_factor = max(0, 1 - abs(rsi - 50) / 50)
            probability_factors.append(min(1.0, rsi_factor))
        
        # Stochastic extreme factor
        stoch_k = indicators['stoch_k'].iloc[current_index]
        if not pd.isna(stoch_k):
            if stoch_k <= self.config.stoch_oversold:
                stoch_factor = 0.8
            elif stoch_k >= self.config.stoch_overbought:
                stoch_factor = 0.8
            else:
                stoch_factor = 0.3
            probability_factors.append(stoch_factor)
        
        # Volume confirmation factor
        volume_ratio = indicators['volume_ratio'].iloc[current_index]
        if not pd.isna(volume_ratio):
            if volume_ratio > self.config.volume_spike_multiplier:
                vol_factor = 0.8  # High volume increases reversion probability
            elif volume_ratio > 1.5:
                vol_factor = 0.6
            else:
                vol_factor = 0.3
            probability_factors.append(vol_factor)
        
        return np.mean(probability_factors) if probability_factors else 0.0
    
    def analyze_market(self, data: pd.DataFrame) -> List[TradingSignal]:
        """
        Analyze market data and generate mean reversion signals.
        
        Args:
            data: OHLCV DataFrame with datetime index
            
        Returns:
            List of trading signals
        """
        if not self.validate_data(data):
            return []
        
        # Calculate all indicators
        indicators = self.calculate_indicators(data)
        
        signals = []
        current_index = len(data) - 1
        
        if current_index < self.config.mean_lookback:
            return signals
        
        # Get current values
        current_close = data['close'].iloc[current_index]
        rsi_current = indicators['rsi'].iloc[current_index]
        stoch_k_current = indicators['stoch_k'].iloc[current_index]
        bb_position = indicators['bb_position'].iloc[current_index]
        z_score = indicators['z_score'].iloc[current_index]
        volume_ratio = indicators['volume_ratio'].iloc[current_index]
        
        # Check for valid data
        if any(pd.isna(val) for val in [rsi_current, stoch_k_current, bb_position, z_score]):
            return signals
        
        # Calculate reversion probability
        reversion_probability = self.calculate_reversion_probability(indicators, current_index)
        
        symbol = data.attrs.get('symbol', 'UNKNOWN')
        atr = indicators['atr'].iloc[current_index]
        
        # Generate oversold (buy) signal
        oversold_conditions = [
            rsi_current <= self.config.rsi_oversold,
            stoch_k_current <= self.config.stoch_oversold,
            bb_position <= 0.1,  # Price near lower Bollinger Band
            z_score <= -self.config.deviation_threshold,  # Price significantly below mean
            reversion_probability > 0.6
        ]
        
        # Volume confirmation for oversold
        if self.config.require_volume_spike:
            oversold_conditions.append(volume_ratio > self.config.volume_spike_multiplier)
        
        # Divergence confirmation for oversold
        if self.config.require_divergence:
            oversold_conditions.append(self.detect_bullish_divergence(data, indicators, current_index))
        
        # Generate overbought (sell) signal
        overbought_conditions = [
            rsi_current >= self.config.rsi_overbought,
            stoch_k_current >= self.config.stoch_overbought,
            bb_position >= 0.9,  # Price near upper Bollinger Band
            z_score >= self.config.deviation_threshold,  # Price significantly above mean
            reversion_probability > 0.6
        ]
        
        # Volume confirmation for overbought
        if self.config.require_volume_spike:
            overbought_conditions.append(volume_ratio > self.config.volume_spike_multiplier)
        
        # Divergence confirmation for overbought
        if self.config.require_divergence:
            overbought_conditions.append(self.detect_bearish_divergence(data, indicators, current_index))
        
        # Generate buy signal (oversold reversal)
        if sum(oversold_conditions) >= len(oversold_conditions) * 0.7:  # 70% of conditions met
            confidence = min(0.95, 0.5 + reversion_probability * 0.4)
            strength = min(1.0, abs(z_score) / 3.0)  # Strength based on deviation from mean
            
            # Calculate targets
            mean_price = indicators['price_mean'].iloc[current_index]
            stop_loss = current_close - (atr * 1.5)  # Tight stop for mean reversion
            take_profit = min(mean_price, current_close + (atr * 2))  # Target mean or modest profit
            
            signal = TradingSignal(
                signal_type=SignalType.BUY,
                symbol=symbol,
                strength=strength,
                confidence=confidence,
                price_target=Decimal(str(current_close)),
                stop_loss=Decimal(str(stop_loss)),
                take_profit=Decimal(str(take_profit)),
                indicators={
                    'rsi': float(rsi_current),
                    'stoch_k': float(stoch_k_current),
                    'bb_position': float(bb_position),
                    'z_score': float(z_score),
                    'volume_ratio': float(volume_ratio),
                    'reversion_probability': reversion_probability,
                    'mean_price': float(mean_price),
                    'atr': float(atr)
                },
                metadata={
                    'strategy': 'mean_reversion',
                    'signal_reason': 'oversold_reversal',
                    'conditions_met': sum(oversold_conditions),
                    'total_conditions': len(oversold_conditions),
                    'expected_hold_periods': self.config.max_hold_periods
                }
            )
            signals.append(signal)
        
        # Generate sell signal (overbought reversal)
        elif sum(overbought_conditions) >= len(overbought_conditions) * 0.7:
            confidence = min(0.95, 0.5 + reversion_probability * 0.4)
            strength = min(1.0, abs(z_score) / 3.0)
            
            # Calculate targets
            mean_price = indicators['price_mean'].iloc[current_index]
            stop_loss = current_close + (atr * 1.5)  # Tight stop for mean reversion
            take_profit = max(mean_price, current_close - (atr * 2))  # Target mean or modest profit
            
            signal = TradingSignal(
                signal_type=SignalType.SELL,
                symbol=symbol,
                strength=strength,
                confidence=confidence,
                price_target=Decimal(str(current_close)),
                stop_loss=Decimal(str(stop_loss)),
                take_profit=Decimal(str(take_profit)),
                indicators={
                    'rsi': float(rsi_current),
                    'stoch_k': float(stoch_k_current),
                    'bb_position': float(bb_position),
                    'z_score': float(z_score),
                    'volume_ratio': float(volume_ratio),
                    'reversion_probability': reversion_probability,
                    'mean_price': float(mean_price),
                    'atr': float(atr)
                },
                metadata={
                    'strategy': 'mean_reversion',
                    'signal_reason': 'overbought_reversal',
                    'conditions_met': sum(overbought_conditions),
                    'total_conditions': len(overbought_conditions),
                    'expected_hold_periods': self.config.max_hold_periods
                }
            )
            signals.append(signal)
        
        return self.filter_signals(signals)
    
    def get_strategy_info(self) -> Dict[str, Any]:
        """Get detailed information about the mean reversion strategy."""
        return {
            'name': self.config.name,
            'type': 'mean_reversion',
            'description': self.config.description,
            'parameters': {
                'bb_period': self.config.bb_period,
                'bb_std_dev': self.config.bb_std_dev,
                'rsi_period': self.config.rsi_period,
                'rsi_oversold': self.config.rsi_oversold,
                'rsi_overbought': self.config.rsi_overbought,
                'stoch_k_period': self.config.stoch_k_period,
                'stoch_d_period': self.config.stoch_d_period,
                'mean_lookback': self.config.mean_lookback,
                'deviation_threshold': self.config.deviation_threshold,
                'require_volume_spike': self.config.require_volume_spike,
                'volume_spike_multiplier': self.config.volume_spike_multiplier,
                'require_divergence': self.config.require_divergence
            },
            'risk_management': {
                'max_position_size': str(self.config.max_position_size),
                'stop_loss_percentage': self.config.stop_loss_percentage,
                'take_profit_percentage': self.config.take_profit_percentage,
                'quick_exit_threshold': self.config.quick_exit_threshold,
                'max_hold_periods': self.config.max_hold_periods
            },
            'performance': self.performance_metrics
        }