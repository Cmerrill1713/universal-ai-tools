"""
Arbitrage trading strategy implementation.
Identifies price discrepancies across exchanges or related assets for risk-free profits.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .strategy_base import (BaseStrategy, SignalType, StrategyConfig,
                            TradingSignal)


class ArbitrageType:
    """Types of arbitrage opportunities."""
    SPATIAL = "spatial"  # Cross-exchange arbitrage
    TRIANGULAR = "triangular"  # Three-currency arbitrage
    STATISTICAL = "statistical"  # Statistical arbitrage between correlated assets
    TEMPORAL = "temporal"  # Time-based arbitrage


@dataclass
class ArbitrageOpportunity:
    """Represents an arbitrage opportunity."""
    arbitrage_type: str
    symbol_1: str
    symbol_2: Optional[str] = None
    symbol_3: Optional[str] = None  # For triangular arbitrage
    exchange_1: str = ""
    exchange_2: str = ""
    exchange_3: str = ""  # For triangular arbitrage
    price_1: Decimal = Decimal('0')
    price_2: Decimal = Decimal('0')
    price_3: Decimal = Decimal('0')
    spread_percentage: float = 0.0
    profit_potential: Decimal = Decimal('0')
    min_trade_amount: Decimal = Decimal('0')
    max_trade_amount: Decimal = Decimal('0')
    execution_time_ms: float = 0.0
    confidence: float = 0.0
    fees_total: Decimal = Decimal('0')
    net_profit: Decimal = Decimal('0')


class ArbitrageConfig(StrategyConfig):
    """Configuration specific to arbitrage strategy."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.name = "Arbitrage Strategy"
        self.description = "Exploits price discrepancies for risk-free profits"

        # Arbitrage-specific parameters
        self.min_spread_threshold = kwargs.get(
            'min_spread_threshold', 0.3)  # Minimum 0.3% spread
        self.max_execution_time_ms = kwargs.get(
            'max_execution_time_ms', 500)  # Max execution time
        self.min_profit_threshold = kwargs.get(
            'min_profit_threshold', Decimal('10'))  # Min $10 profit

        # Fee considerations
        self.trading_fee_percentage = kwargs.get(
            'trading_fee_percentage', 0.1)  # 0.1% trading fee
        self.withdrawal_fee = kwargs.get(
            'withdrawal_fee', Decimal('5'))  # $5 withdrawal fee
        self.slippage_tolerance = kwargs.get(
            'slippage_tolerance', 0.1)  # 0.1% slippage tolerance

        # Exchange configuration
        self.supported_exchanges = kwargs.get(
            'supported_exchanges', [
                'binance', 'coinbase', 'kraken'])
        self.exchange_latency = kwargs.get('exchange_latency', {  # Latency in ms
            'binance': 50,
            'coinbase': 100,
            'kraken': 150
        })

        # Triangular arbitrage
        self.enable_triangular = kwargs.get('enable_triangular', True)
        self.triangular_currencies = kwargs.get(
            'triangular_currencies', [
                'BTC', 'ETH', 'USDT', 'USD'])

        # Statistical arbitrage
        self.enable_statistical = kwargs.get('enable_statistical', True)
        self.correlation_threshold = kwargs.get('correlation_threshold', 0.8)
        self.mean_reversion_zscore = kwargs.get('mean_reversion_zscore', 2.0)
        self.statistical_lookback = kwargs.get('statistical_lookback', 100)

        # Risk management
        self.max_position_per_exchange = kwargs.get(
            'max_position_per_exchange', Decimal('1000'))
        self.max_total_arbitrage_exposure = kwargs.get(
            'max_total_arbitrage_exposure', Decimal('5000'))
        self.emergency_exit_threshold = kwargs.get(
            'emergency_exit_threshold',
            2.0)  # Exit if spread narrows by 2%


class ArbitrageStrategy(BaseStrategy):
    """
    Arbitrage trading strategy that identifies and exploits price discrepancies.

    Supports multiple types of arbitrage:
    1. Spatial Arbitrage: Price differences across exchanges
    2. Triangular Arbitrage: Currency exchange cycles
    3. Statistical Arbitrage: Mean reversion between correlated assets
    4. Temporal Arbitrage: Time-based price inefficiencies
    """

    def __init__(self, config: ArbitrageConfig = None):
        """Initialize arbitrage strategy."""
        if config is None:
            config = ArbitrageConfig()
        super().__init__(config)
        self.config: ArbitrageConfig = config

        # Track arbitrage opportunities
        self.active_opportunities: List[ArbitrageOpportunity] = []
        self.opportunity_history: List[ArbitrageOpportunity] = []

        # Exchange data storage
        # exchange -> symbol -> price
        self.exchange_prices: Dict[str, Dict[str, Decimal]] = {}
        # exchange -> symbol -> volume
        self.exchange_volumes: Dict[str, Dict[str, Decimal]] = {}
        # exchange -> last_update
        self.exchange_timestamps: Dict[str, datetime] = {}

        # Statistical arbitrage data
        self.correlation_matrix: Optional[pd.DataFrame] = None
        # (symbol1, symbol2) -> spread history
        self.price_spreads: Dict[Tuple[str, str], List[float]] = {}

    def get_required_columns(self) -> List[str]:
        """Get required data columns for arbitrage strategy."""
        return ['open', 'high', 'low', 'close', 'volume', 'exchange']

    def calculate_indicators(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate indicators for arbitrage analysis.

        Args:
            data: Multi-exchange OHLCV data

        Returns:
            Dictionary of calculated indicators
        """
        indicators = {}

        if 'exchange' not in data.columns:
            return indicators

        # Group by exchange and calculate exchange-specific metrics
        exchanges = data['exchange'].unique()

        for exchange in exchanges:
            exchange_data = data[data['exchange'] == exchange]

            if len(exchange_data) == 0:
                continue

            indicators[f'{exchange}_price'] = exchange_data['close'].iloc[-1] if len(
                exchange_data) > 0 else None
            indicators[f'{exchange}_volume'] = exchange_data['volume'].sum()
            indicators[f'{exchange}_volatility'] = exchange_data['close'].pct_change(
            ).std() * np.sqrt(24)  # Daily volatility
            indicators[f'{exchange}_spread'] = (
                (exchange_data['high'] - exchange_data['low']) / exchange_data['close']).mean()

        # Calculate cross-exchange spreads
        if len(exchanges) >= 2:
            for i, exchange1 in enumerate(exchanges):
                for exchange2 in exchanges[i + 1:]:
                    price1 = indicators.get(f'{exchange1}_price')
                    price2 = indicators.get(f'{exchange2}_price')

                    if price1 and price2 and price1 > 0 and price2 > 0:
                        spread_pct = abs(float(price1 - price2)) / \
                            float((price1 + price2) / 2) * 100
                        indicators[f'spread_{exchange1}_{exchange2}'] = spread_pct

        # Calculate correlation indicators for statistical arbitrage
        if len(data) >= self.config.statistical_lookback:
            price_matrix = data.pivot_table(
                index=data.index, columns='exchange', values='close')
            if len(price_matrix.columns) >= 2:
                returns = price_matrix.pct_change().dropna()
                if len(returns) > 0:
                    indicators['correlation_matrix'] = returns.corr()

        return indicators

    def detect_spatial_arbitrage(
            self, exchange_data: Dict[str, Dict[str, Any]]) -> List[ArbitrageOpportunity]:
        """
        Detect spatial arbitrage opportunities across exchanges.

        Args:
            exchange_data: Dictionary of exchange data

        Returns:
            List of spatial arbitrage opportunities
        """
        opportunities = []

        # Get all symbols available on multiple exchanges
        all_symbols = set()
        for exchange, data in exchange_data.items():
            all_symbols.update(data.get('symbols', []))

        for symbol in all_symbols:
            # Find exchanges that have this symbol
            exchange_prices = []
            for exchange, data in exchange_data.items():
                if symbol in data.get('symbols', []):
                    price = data.get('prices', {}).get(symbol)
                    volume = data.get('volumes', {}).get(symbol, 0)
                    if price and volume > self.config.min_volume_threshold:
                        exchange_prices.append((exchange, price, volume))

            # Need at least 2 exchanges for arbitrage
            if len(exchange_prices) < 2:
                continue

            # Find best buy and sell opportunities
            exchange_prices.sort(key=lambda x: x[1])  # Sort by price

            lowest_exchange, lowest_price, lowest_volume = exchange_prices[0]
            highest_exchange, highest_price, highest_volume = exchange_prices[-1]

            # Calculate spread
            spread_pct = float(
                (highest_price - lowest_price) / lowest_price * 100)

            if spread_pct >= self.config.min_spread_threshold:
                # Calculate potential profit
                trade_amount = min(
                    lowest_volume,
                    highest_volume) * Decimal('0.1')  # Use 10% of lower volume
                trade_amount = min(
                    trade_amount, self.config.max_position_per_exchange)

                gross_profit = (highest_price - lowest_price) * trade_amount

                # Calculate fees
                buy_fee = lowest_price * trade_amount * \
                    Decimal(str(self.config.trading_fee_percentage / 100))
                sell_fee = highest_price * trade_amount * \
                    Decimal(str(self.config.trading_fee_percentage / 100))
                withdrawal_fee = self.config.withdrawal_fee
                total_fees = buy_fee + sell_fee + withdrawal_fee

                net_profit = gross_profit - total_fees

                if net_profit >= self.config.min_profit_threshold:
                    opportunity = ArbitrageOpportunity(
                        arbitrage_type=ArbitrageType.SPATIAL,
                        symbol_1=symbol,
                        exchange_1=lowest_exchange,
                        exchange_2=highest_exchange,
                        price_1=lowest_price,
                        price_2=highest_price,
                        spread_percentage=spread_pct,
                        profit_potential=gross_profit,
                        min_trade_amount=trade_amount,
                        max_trade_amount=min(
                            lowest_volume,
                            highest_volume),
                        execution_time_ms=max(
                            self.config.exchange_latency.get(
                                lowest_exchange,
                                100),
                            self.config.exchange_latency.get(
                                highest_exchange,
                                100)),
                        confidence=min(
                            0.95,
                            spread_pct /
                            self.config.min_spread_threshold *
                            0.8),
                        fees_total=total_fees,
                        net_profit=net_profit)
                    opportunities.append(opportunity)

        return opportunities

    def detect_triangular_arbitrage(
            self, exchange_data: Dict[str, Any]) -> List[ArbitrageOpportunity]:
        """
        Detect triangular arbitrage opportunities.

        Args:
            exchange_data: Single exchange data with multiple currency pairs

        Returns:
            List of triangular arbitrage opportunities
        """
        opportunities = []

        if not self.config.enable_triangular:
            return opportunities

        prices = exchange_data.get('prices', {})

        # Check all possible triangular combinations
        currencies = self.config.triangular_currencies

        for i, curr_a in enumerate(currencies):
            for j, curr_b in enumerate(currencies):
                if i >= j:
                    continue
                for k, curr_c in enumerate(currencies):
                    if k <= j or k == i:
                        continue

                    # Define the three pairs for triangular arbitrage
                    pair_ab = f"{curr_a}/{curr_b}"
                    pair_bc = f"{curr_b}/{curr_c}"
                    pair_ca = f"{curr_c}/{curr_a}"

                    # Alternative pair naming
                    pair_ba = f"{curr_b}/{curr_a}"
                    pair_cb = f"{curr_c}/{curr_b}"
                    pair_ac = f"{curr_a}/{curr_c}"

                    # Get prices (try both directions)
                    price_ab = prices.get(pair_ab) or (
                        1 /
                        prices.get(
                            pair_ba,
                            Decimal('0')) if prices.get(
                            pair_ba,
                            Decimal('0')) > 0 else Decimal('0'))
                    price_bc = prices.get(pair_bc) or (
                        1 /
                        prices.get(
                            pair_cb,
                            Decimal('0')) if prices.get(
                            pair_cb,
                            Decimal('0')) > 0 else Decimal('0'))
                    price_ca = prices.get(pair_ca) or (
                        1 /
                        prices.get(
                            pair_ac,
                            Decimal('0')) if prices.get(
                            pair_ac,
                            Decimal('0')) > 0 else Decimal('0'))

                    if price_ab > 0 and price_bc > 0 and price_ca > 0:
                        # Calculate arbitrage potential
                        # Start with 1 unit of curr_a
                        # curr_a -> curr_b -> curr_c -> curr_a
                        final_amount = price_ab * price_bc * price_ca

                        arbitrage_profit = final_amount - Decimal('1')
                        profit_percentage = float(arbitrage_profit * 100)

                        if profit_percentage >= self.config.min_spread_threshold:
                            # Calculate actual profit with fees
                            # Start with $1000 equivalent
                            trade_value = Decimal('1000')

                            # Three trades, each with fees
                            fee_rate = Decimal(
                                str(self.config.trading_fee_percentage / 100))
                            total_fees = trade_value * fee_rate * 3

                            gross_profit = trade_value * arbitrage_profit
                            net_profit = gross_profit - total_fees

                            if net_profit >= self.config.min_profit_threshold:
                                opportunity = ArbitrageOpportunity(
                                    arbitrage_type=ArbitrageType.TRIANGULAR,
                                    symbol_1=pair_ab,
                                    symbol_2=pair_bc,
                                    symbol_3=pair_ca,
                                    exchange_1=list(
                                        exchange_data.keys())[0] if exchange_data else "",
                                    price_1=price_ab,
                                    price_2=price_bc,
                                    price_3=price_ca,
                                    spread_percentage=profit_percentage,
                                    profit_potential=gross_profit,
                                    min_trade_amount=trade_value,
                                    max_trade_amount=trade_value * 10,  # Scale up to $10k
                                    execution_time_ms=self.config.max_execution_time_ms,
                                    confidence=min(
                                        0.9, profit_percentage / self.config.min_spread_threshold * 0.7),
                                    fees_total=total_fees,
                                    net_profit=net_profit
                                )
                                opportunities.append(opportunity)

        return opportunities

    def detect_statistical_arbitrage(
            self, data: pd.DataFrame) -> List[ArbitrageOpportunity]:
        """
        Detect statistical arbitrage opportunities between correlated assets.

        Args:
            data: Historical price data for multiple symbols

        Returns:
            List of statistical arbitrage opportunities
        """
        opportunities = []

        if not self.config.enable_statistical or len(
                data) < self.config.statistical_lookback:
            return opportunities

        # Get unique symbols
        symbols = data['symbol'].unique() if 'symbol' in data.columns else []

        if len(symbols) < 2:
            return opportunities

        # Create price matrix
        price_data = {}
        for symbol in symbols:
            symbol_data = data[data['symbol'] == symbol]['close']
            if len(symbol_data) >= self.config.statistical_lookback:
                price_data[symbol] = symbol_data.tail(
                    self.config.statistical_lookback)

        if len(price_data) < 2:
            return opportunities

        # Calculate correlations and spreads
        for i, symbol1 in enumerate(symbols):
            for symbol2 in symbols[i + 1:]:
                if symbol1 not in price_data or symbol2 not in price_data:
                    continue

                prices1 = price_data[symbol1]
                prices2 = price_data[symbol2]

                # Ensure same length
                min_len = min(len(prices1), len(prices2))
                prices1 = prices1.tail(min_len)
                prices2 = prices2.tail(min_len)

                # Calculate correlation
                correlation = prices1.corr(prices2)

                if abs(correlation) >= self.config.correlation_threshold:
                    # Calculate spread
                    spread_ratio = prices1 / prices2
                    spread_mean = spread_ratio.mean()
                    spread_std = spread_ratio.std()
                    current_spread = spread_ratio.iloc[-1]

                    # Calculate z-score
                    z_score = (current_spread - spread_mean) / \
                        spread_std if spread_std > 0 else 0

                    if abs(z_score) >= self.config.mean_reversion_zscore:
                        # Determine trade direction
                        if z_score > 0:  # Current spread is high, expect mean reversion
                            # Short symbol1, long symbol2
                            signal_type = "short_long"
                            confidence = min(0.9, abs(z_score) / 3.0)
                        else:  # Current spread is low, expect expansion
                            # Long symbol1, short symbol2
                            signal_type = "long_short"
                            confidence = min(0.9, abs(z_score) / 3.0)

                        # Calculate potential profit
                        expected_reversion = spread_mean - current_spread
                        # Scale by position size
                        profit_potential = abs(
                            expected_reversion) * Decimal('1000')

                        # Estimate fees (two positions)
                        fee_rate = Decimal(
                            str(self.config.trading_fee_percentage / 100))
                        # $2000 total position value
                        total_fees = Decimal('2000') * fee_rate

                        net_profit = profit_potential - total_fees

                        if net_profit >= self.config.min_profit_threshold:
                            opportunity = ArbitrageOpportunity(
                                arbitrage_type=ArbitrageType.STATISTICAL,
                                symbol_1=symbol1,
                                symbol_2=symbol2,
                                exchange_1="statistical",  # Not exchange-specific
                                price_1=Decimal(str(prices1.iloc[-1])),
                                price_2=Decimal(str(prices2.iloc[-1])),
                                spread_percentage=float(abs(z_score) * 100),
                                profit_potential=profit_potential,
                                min_trade_amount=Decimal('1000'),
                                max_trade_amount=Decimal('10000'),
                                execution_time_ms=200,  # Statistical arbitrage is slower
                                confidence=confidence,
                                fees_total=total_fees,
                                net_profit=net_profit
                            )
                            opportunities.append(opportunity)

        return opportunities

    def analyze_market(self, data: pd.DataFrame) -> List[TradingSignal]:
        """
        Analyze market data and generate arbitrage signals.

        Args:
            data: Market data with exchange and symbol information

        Returns:
            List of trading signals based on arbitrage opportunities
        """
        if not self.validate_data(data):
            return []

        signals = []

        # Group data by exchange if available
        if 'exchange' in data.columns:
            exchange_data = {}
            for exchange in data['exchange'].unique():
                exchange_subset = data[data['exchange'] == exchange]

                exchange_data[exchange] = {
                    'symbols': exchange_subset['symbol'].unique().tolist() if 'symbol' in exchange_subset.columns else [],
                    'prices': dict(zip(exchange_subset.get('symbol', []), exchange_subset['close'])),
                    'volumes': dict(zip(exchange_subset.get('symbol', []), exchange_subset['volume']))
                }

            # Detect spatial arbitrage
            spatial_opportunities = self.detect_spatial_arbitrage(
                exchange_data)

            # Detect triangular arbitrage for each exchange
            for exchange, ex_data in exchange_data.items():
                triangular_opportunities = self.detect_triangular_arbitrage(
                    {exchange: ex_data})
                spatial_opportunities.extend(triangular_opportunities)

        # Detect statistical arbitrage
        statistical_opportunities = self.detect_statistical_arbitrage(data)

        # Combine all opportunities
        all_opportunities = []
        if 'exchange' in data.columns:
            all_opportunities.extend(spatial_opportunities)
        all_opportunities.extend(statistical_opportunities)

        # Convert opportunities to trading signals
        for opp in all_opportunities:
            if opp.net_profit >= self.config.min_profit_threshold:
                # Create signal based on arbitrage type
                if opp.arbitrage_type == ArbitrageType.SPATIAL:
                    signal = TradingSignal(
                        signal_type=SignalType.BUY,  # Buy low, sell high
                        symbol=opp.symbol_1,
                        strength=min(
                            1.0, opp.spread_percentage / 5.0),  # Scale to 5% max
                        confidence=opp.confidence,
                        price_target=opp.price_1,  # Buy at lower price
                        stop_loss=opp.price_1 *
                        Decimal('0.99'),  # 1% stop loss
                        # Sell slightly below high price
                        take_profit=opp.price_2 * Decimal('0.99'),
                        indicators={
                            'arbitrage_type': opp.arbitrage_type,
                            'spread_percentage': opp.spread_percentage,
                            'net_profit': float(opp.net_profit),
                            'execution_time_ms': opp.execution_time_ms,
                            'buy_exchange': opp.exchange_1,
                            'sell_exchange': opp.exchange_2
                        },
                        metadata={
                            'strategy': 'arbitrage',
                            'opportunity_id': f"{opp.arbitrage_type}_{opp.symbol_1}_{opp.exchange_1}_{opp.exchange_2}",
                            'requires_immediate_execution': True,
                            'max_execution_time_ms': self.config.max_execution_time_ms
                        }
                    )
                    signals.append(signal)

                elif opp.arbitrage_type == ArbitrageType.TRIANGULAR:
                    # Create signals for each leg of triangular arbitrage
                    for i, (symbol, price) in enumerate([(opp.symbol_1, opp.price_1),
                                                         (opp.symbol_2, opp.price_2),
                                                         (opp.symbol_3, opp.price_3)]):
                        signal = TradingSignal(
                            signal_type=SignalType.BUY,
                            symbol=symbol,
                            strength=min(1.0, opp.spread_percentage / 3.0),
                            confidence=opp.confidence,
                            price_target=price,
                            indicators={
                                'arbitrage_type': opp.arbitrage_type,
                                'leg_number': i + 1,
                                'total_legs': 3,
                                'spread_percentage': opp.spread_percentage,
                                # Divide profit among legs
                                'net_profit': float(opp.net_profit / 3)
                            },
                            metadata={
                                'strategy': 'arbitrage',
                                'opportunity_id': f"triangular_{opp.symbol_1}_{opp.symbol_2}_{opp.symbol_3}",
                                'requires_coordinated_execution': True,
                                'sequence_order': i + 1
                            }
                        )
                        signals.append(signal)

                elif opp.arbitrage_type == ArbitrageType.STATISTICAL:
                    # Create pair trading signals
                    signal1 = TradingSignal(
                        signal_type=SignalType.SELL,  # Typically short the overperforming asset
                        symbol=opp.symbol_1,
                        strength=min(1.0, opp.spread_percentage / 10.0),
                        confidence=opp.confidence,
                        price_target=opp.price_1,
                        indicators={
                            'arbitrage_type': opp.arbitrage_type,
                            'pair_symbol': opp.symbol_2,
                            'spread_percentage': opp.spread_percentage,
                            'net_profit': float(opp.net_profit / 2)
                        },
                        metadata={
                            'strategy': 'statistical_arbitrage',
                            'pair_trade': True,
                            'hedge_symbol': opp.symbol_2
                        }
                    )

                    signal2 = TradingSignal(
                        signal_type=SignalType.BUY,  # Long the underperforming asset
                        symbol=opp.symbol_2,
                        strength=min(1.0, opp.spread_percentage / 10.0),
                        confidence=opp.confidence,
                        price_target=opp.price_2,
                        indicators={
                            'arbitrage_type': opp.arbitrage_type,
                            'pair_symbol': opp.symbol_1,
                            'spread_percentage': opp.spread_percentage,
                            'net_profit': float(opp.net_profit / 2)
                        },
                        metadata={
                            'strategy': 'statistical_arbitrage',
                            'pair_trade': True,
                            'hedge_symbol': opp.symbol_1
                        }
                    )

                    signals.extend([signal1, signal2])

        # Store opportunities for tracking
        self.active_opportunities = all_opportunities

        return self.filter_signals(signals)

    def get_strategy_info(self) -> Dict[str, Any]:
        """Get detailed information about the arbitrage strategy."""
        return {
            'name': self.config.name,
            'type': 'arbitrage',
            'description': self.config.description,
            'parameters': {
                'min_spread_threshold': self.config.min_spread_threshold,
                'max_execution_time_ms': self.config.max_execution_time_ms,
                'min_profit_threshold': str(self.config.min_profit_threshold),
                'trading_fee_percentage': self.config.trading_fee_percentage,
                'slippage_tolerance': self.config.slippage_tolerance,
                'supported_exchanges': self.config.supported_exchanges,
                'enable_triangular': self.config.enable_triangular,
                'enable_statistical': self.config.enable_statistical,
                'correlation_threshold': self.config.correlation_threshold
            },
            'active_opportunities': len(self.active_opportunities),
            'opportunity_types': list(set(opp.arbitrage_type for opp in self.active_opportunities)),
            'total_profit_potential': sum(float(opp.net_profit) for opp in self.active_opportunities),
            'performance': self.performance_metrics
        }
