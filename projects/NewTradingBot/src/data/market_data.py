"""
Market data module for trading bot.
Handles real-time and historical market data acquisition, processing, and storage.
"""

from typing import Dict, List, Optional, Any, Callable, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
import asyncio
import aiohttp
import ccxt.async_support as ccxt
import websockets
import json
import time
from collections import deque
import logging

logger = logging.getLogger(__name__)


class DataSource(Enum):
    """Market data source types."""
    BINANCE = "binance"
    COINBASE = "coinbase"
    KRAKEN = "kraken"
    ALPACA = "alpaca"
    YAHOO_FINANCE = "yahoo_finance"
    POLYGON = "polygon"


class DataType(Enum):
    """Types of market data."""
    OHLCV = "ohlcv"
    TICKER = "ticker"
    ORDERBOOK = "orderbook"
    TRADES = "trades"
    FUNDING_RATE = "funding_rate"
    VOLUME_PROFILE = "volume_profile"


class Timeframe(Enum):
    """Data timeframes."""
    TICK = "tick"
    SECOND_1 = "1s"
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


@dataclass
class MarketDataPoint:
    """
    Single market data point.
    
    Attributes:
        symbol: Trading pair symbol
        timestamp: Data timestamp
        source: Data source
        data_type: Type of data
        data: Raw data dictionary
        open_price: Open price (for OHLCV)
        high_price: High price
        low_price: Low price
        close_price: Close price
        volume: Trading volume
        metadata: Additional metadata
    """
    symbol: str
    timestamp: datetime
    source: DataSource
    data_type: DataType
    data: Dict[str, Any]
    open_price: Optional[Decimal] = None
    high_price: Optional[Decimal] = None
    low_price: Optional[Decimal] = None
    close_price: Optional[Decimal] = None
    volume: Optional[Decimal] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_ohlcv_dict(self) -> Dict[str, Any]:
        """Convert to OHLCV dictionary format."""
        return {
            'timestamp': self.timestamp,
            'open': float(self.open_price) if self.open_price else None,
            'high': float(self.high_price) if self.high_price else None,
            'low': float(self.low_price) if self.low_price else None,
            'close': float(self.close_price) if self.close_price else None,
            'volume': float(self.volume) if self.volume else None,
            'symbol': self.symbol,
            'source': self.source.value
        }


@dataclass
class DataSubscription:
    """Data subscription configuration."""
    symbol: str
    data_type: DataType
    timeframe: Timeframe
    source: DataSource
    callback: Optional[Callable[[MarketDataPoint], None]] = None
    is_active: bool = True
    last_update: Optional[datetime] = None
    error_count: int = 0


class MarketDataProvider:
    """
    Base class for market data providers.
    Defines interface for data acquisition from various sources.
    """
    
    def __init__(self, source: DataSource, config: Dict[str, Any] = None):
        """
        Initialize market data provider.
        
        Args:
            source: Data source type
            config: Provider-specific configuration
        """
        self.source = source
        self.config = config or {}
        self.is_connected = False
        self.subscriptions: List[DataSubscription] = []
        self.rate_limits: Dict[str, float] = {}  # endpoint -> last_request_time
        
    async def connect(self) -> bool:
        """Connect to data source."""
        raise NotImplementedError
    
    async def disconnect(self) -> None:
        """Disconnect from data source."""
        raise NotImplementedError
    
    async def get_historical_data(self, symbol: str, timeframe: Timeframe,
                                start_time: datetime, end_time: datetime) -> List[MarketDataPoint]:
        """Get historical market data."""
        raise NotImplementedError
    
    async def get_current_price(self, symbol: str) -> Optional[Decimal]:
        """Get current price for symbol."""
        raise NotImplementedError
    
    async def subscribe_data(self, subscription: DataSubscription) -> bool:
        """Subscribe to real-time data."""
        raise NotImplementedError
    
    async def unsubscribe_data(self, symbol: str, data_type: DataType) -> bool:
        """Unsubscribe from real-time data."""
        raise NotImplementedError


class CCXTProvider(MarketDataProvider):
    """Market data provider using CCXT library for cryptocurrency exchanges."""
    
    def __init__(self, source: DataSource, config: Dict[str, Any] = None):
        super().__init__(source, config)
        self.exchange = None
        self.ws_connection = None
        
    async def connect(self) -> bool:
        """Connect to exchange via CCXT."""
        try:
            exchange_class = getattr(ccxt, self.source.value)
            self.exchange = exchange_class({
                'apiKey': self.config.get('api_key', ''),
                'secret': self.config.get('secret', ''),
                'password': self.config.get('password', ''),
                'sandbox': self.config.get('sandbox', False),
                'enableRateLimit': True,
            })
            
            # Test connection
            await self.exchange.load_markets()
            self.is_connected = True
            logger.info(f"Connected to {self.source.value}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {self.source.value}: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from exchange."""
        if self.exchange:
            await self.exchange.close()
            self.is_connected = False
    
    async def get_historical_data(self, symbol: str, timeframe: Timeframe,
                                start_time: datetime, end_time: datetime) -> List[MarketDataPoint]:
        """Get historical OHLCV data."""
        if not self.exchange:
            return []
        
        try:
            # Convert timeframe to CCXT format
            tf_map = {
                Timeframe.MINUTE_1: '1m',
                Timeframe.MINUTE_5: '5m',
                Timeframe.MINUTE_15: '15m',
                Timeframe.MINUTE_30: '30m',
                Timeframe.HOUR_1: '1h',
                Timeframe.HOUR_4: '4h',
                Timeframe.DAY_1: '1d'
            }
            
            ccxt_timeframe = tf_map.get(timeframe, '1h')
            
            # Get data
            since = int(start_time.timestamp() * 1000)  # CCXT expects milliseconds
            limit = 1000  # Most exchanges limit to ~1000 candles per request
            
            ohlcv_data = await self.exchange.fetch_ohlcv(
                symbol, ccxt_timeframe, since=since, limit=limit
            )
            
            data_points = []
            for candle in ohlcv_data:
                timestamp = datetime.fromtimestamp(candle[0] / 1000)
                
                if timestamp > end_time:
                    break
                
                data_point = MarketDataPoint(
                    symbol=symbol,
                    timestamp=timestamp,
                    source=self.source,
                    data_type=DataType.OHLCV,
                    data={'raw': candle},
                    open_price=Decimal(str(candle[1])),
                    high_price=Decimal(str(candle[2])),
                    low_price=Decimal(str(candle[3])),
                    close_price=Decimal(str(candle[4])),
                    volume=Decimal(str(candle[5])) if candle[5] else Decimal('0')
                )
                data_points.append(data_point)
            
            return data_points
            
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {e}")
            return []
    
    async def get_current_price(self, symbol: str) -> Optional[Decimal]:
        """Get current price from ticker."""
        if not self.exchange:
            return None
        
        try:
            ticker = await self.exchange.fetch_ticker(symbol)
            return Decimal(str(ticker['last'])) if ticker['last'] else None
        except Exception as e:
            logger.error(f"Error fetching current price for {symbol}: {e}")
            return None
    
    async def subscribe_data(self, subscription: DataSubscription) -> bool:
        """Subscribe to real-time data via WebSocket."""
        # This would implement WebSocket subscription
        # For now, we'll use polling as a fallback
        self.subscriptions.append(subscription)
        return True
    
    async def unsubscribe_data(self, symbol: str, data_type: DataType) -> bool:
        """Unsubscribe from real-time data."""
        self.subscriptions = [
            sub for sub in self.subscriptions
            if not (sub.symbol == symbol and sub.data_type == data_type)
        ]
        return True


class MarketDataManager:
    """
    Central manager for market data from multiple sources.
    Handles data aggregation, validation, and distribution.
    """
    
    def __init__(self):
        """Initialize market data manager."""
        self.providers: Dict[DataSource, MarketDataProvider] = {}
        self.data_cache: Dict[str, deque] = {}  # symbol -> recent data points
        self.subscribers: Dict[str, List[Callable]] = {}  # data_key -> callbacks
        self.is_running = False
        self.update_tasks: List[asyncio.Task] = []
        
        # Data validation settings
        self.max_price_change_pct = 50.0  # Max 50% price change filter
        self.min_volume_threshold = Decimal('0.01')
        self.data_staleness_threshold = timedelta(minutes=5)
        
    def add_provider(self, provider: MarketDataProvider) -> None:
        """Add a market data provider."""
        self.providers[provider.source] = provider
    
    async def start(self) -> None:
        """Start the market data manager."""
        # Connect all providers
        for provider in self.providers.values():
            await provider.connect()
        
        self.is_running = True
        
        # Start update tasks
        self.update_tasks = [
            asyncio.create_task(self._price_update_loop()),
            asyncio.create_task(self._data_cleanup_loop())
        ]
        
        logger.info("Market data manager started")
    
    async def stop(self) -> None:
        """Stop the market data manager."""
        self.is_running = False
        
        # Cancel update tasks
        for task in self.update_tasks:
            task.cancel()
        
        # Disconnect all providers
        for provider in self.providers.values():
            await provider.disconnect()
        
        logger.info("Market data manager stopped")
    
    async def get_historical_data(self, symbol: str, timeframe: Timeframe,
                                start_time: datetime, end_time: datetime,
                                source: DataSource = None) -> pd.DataFrame:
        """
        Get historical market data as DataFrame.
        
        Args:
            symbol: Trading pair symbol
            timeframe: Data timeframe
            start_time: Start time for data
            end_time: End time for data
            source: Preferred data source (if None, uses first available)
            
        Returns:
            DataFrame with OHLCV data
        """
        # Select provider
        if source and source in self.providers:
            provider = self.providers[source]
        else:
            # Use first available provider
            if not self.providers:
                logger.error("No market data providers available")
                return pd.DataFrame()
            provider = next(iter(self.providers.values()))
        
        # Get data
        data_points = await provider.get_historical_data(symbol, timeframe, start_time, end_time)
        
        if not data_points:
            return pd.DataFrame()
        
        # Convert to DataFrame
        data_list = [point.to_ohlcv_dict() for point in data_points]
        df = pd.DataFrame(data_list)
        
        if not df.empty:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
            df.sort_index(inplace=True)
            
            # Validate data
            df = self._validate_ohlcv_data(df)
        
        return df
    
    async def get_current_prices(self, symbols: List[str]) -> Dict[str, Decimal]:
        """
        Get current prices for multiple symbols.
        
        Args:
            symbols: List of trading pair symbols
            
        Returns:
            Dictionary of symbol -> current price
        """
        prices = {}
        
        # Get prices from all available providers
        for symbol in symbols:
            for provider in self.providers.values():
                try:
                    price = await provider.get_current_price(symbol)
                    if price:
                        prices[symbol] = price
                        break  # Use first successful price
                except Exception as e:
                    logger.error(f"Error getting price for {symbol} from {provider.source}: {e}")
        
        return prices
    
    def subscribe_to_data(self, symbol: str, data_type: DataType,
                         callback: Callable[[MarketDataPoint], None],
                         source: DataSource = None) -> bool:
        """
        Subscribe to real-time market data.
        
        Args:
            symbol: Trading pair symbol
            data_type: Type of data to subscribe to
            callback: Callback function for data updates
            source: Preferred data source
            
        Returns:
            True if subscription successful
        """
        data_key = f"{symbol}_{data_type.value}"
        
        if data_key not in self.subscribers:
            self.subscribers[data_key] = []
        
        self.subscribers[data_key].append(callback)
        
        # Subscribe to provider
        if source and source in self.providers:
            provider = self.providers[source]
        else:
            provider = next(iter(self.providers.values())) if self.providers else None
        
        if provider:
            subscription = DataSubscription(
                symbol=symbol,
                data_type=data_type,
                timeframe=Timeframe.MINUTE_1,  # Default timeframe
                source=provider.source,
                callback=callback
            )
            asyncio.create_task(provider.subscribe_data(subscription))
            return True
        
        return False
    
    def unsubscribe_from_data(self, symbol: str, data_type: DataType,
                             callback: Callable[[MarketDataPoint], None]) -> None:
        """Unsubscribe from real-time market data."""
        data_key = f"{symbol}_{data_type.value}"
        
        if data_key in self.subscribers:
            self.subscribers[data_key] = [
                cb for cb in self.subscribers[data_key] if cb != callback
            ]
            
            # If no more subscribers, unsubscribe from provider
            if not self.subscribers[data_key]:
                for provider in self.providers.values():
                    asyncio.create_task(provider.unsubscribe_data(symbol, data_type))
    
    def get_cached_data(self, symbol: str, limit: int = 100) -> List[MarketDataPoint]:
        """Get recent cached data points for a symbol."""
        if symbol in self.data_cache:
            return list(self.data_cache[symbol])[-limit:]
        return []
    
    async def _price_update_loop(self) -> None:
        """Background task to update prices for subscribed symbols."""
        while self.is_running:
            try:
                # Update prices for all subscribed symbols
                symbols = set()
                for key in self.subscribers.keys():
                    symbol = key.split('_')[0]
                    symbols.add(symbol)
                
                if symbols:
                    prices = await self.get_current_prices(list(symbols))
                    
                    # Notify subscribers
                    for symbol, price in prices.items():
                        data_point = MarketDataPoint(
                            symbol=symbol,
                            timestamp=datetime.utcnow(),
                            source=list(self.providers.keys())[0] if self.providers else DataSource.BINANCE,
                            data_type=DataType.TICKER,
                            data={'price': float(price)},
                            close_price=price
                        )
                        
                        # Update cache
                        if symbol not in self.data_cache:
                            self.data_cache[symbol] = deque(maxlen=1000)
                        self.data_cache[symbol].append(data_point)
                        
                        # Notify subscribers
                        self._notify_subscribers(symbol, DataType.TICKER, data_point)
                
                await asyncio.sleep(1)  # Update every second
                
            except Exception as e:
                logger.error(f"Error in price update loop: {e}")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def _data_cleanup_loop(self) -> None:
        """Background task to clean up old data."""
        while self.is_running:
            try:
                current_time = datetime.utcnow()
                
                # Clean up cached data older than 1 hour
                for symbol, cache in self.data_cache.items():
                    while cache and current_time - cache[0].timestamp > timedelta(hours=1):
                        cache.popleft()
                
                await asyncio.sleep(300)  # Run every 5 minutes
                
            except Exception as e:
                logger.error(f"Error in data cleanup loop: {e}")
                await asyncio.sleep(60)
    
    def _notify_subscribers(self, symbol: str, data_type: DataType, data_point: MarketDataPoint) -> None:
        """Notify subscribers of new data."""
        data_key = f"{symbol}_{data_type.value}"
        
        if data_key in self.subscribers:
            for callback in self.subscribers[data_key]:
                try:
                    callback(data_point)
                except Exception as e:
                    logger.error(f"Error in subscriber callback: {e}")
    
    def _validate_ohlcv_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate and clean OHLCV data."""
        if df.empty:
            return df
        
        # Remove rows with invalid prices
        df = df.dropna(subset=['open', 'high', 'low', 'close'])
        df = df[df['open'] > 0]
        df = df[df['high'] > 0]
        df = df[df['low'] > 0]
        df = df[df['close'] > 0]
        
        # Check for reasonable OHLC relationships
        df = df[df['high'] >= df['low']]
        df = df[df['high'] >= df['open']]
        df = df[df['high'] >= df['close']]
        df = df[df['low'] <= df['open']]
        df = df[df['low'] <= df['close']]
        
        # Filter out extreme price changes
        if len(df) > 1:
            price_changes = df['close'].pct_change().abs() * 100
            df = df[price_changes <= self.max_price_change_pct]
        
        # Filter out low volume data
        if 'volume' in df.columns:
            df = df[df['volume'] >= float(self.min_volume_threshold)]
        
        return df
    
    def get_data_quality_report(self) -> Dict[str, Any]:
        """Generate a data quality report."""
        report = {
            'providers': len(self.providers),
            'active_providers': sum(1 for p in self.providers.values() if p.is_connected),
            'cached_symbols': len(self.data_cache),
            'total_cached_points': sum(len(cache) for cache in self.data_cache.values()),
            'subscribers': len(self.subscribers),
            'data_sources': [source.value for source in self.providers.keys()],
            'oldest_cached_data': None,
            'newest_cached_data': None
        }
        
        # Find oldest and newest data points
        all_timestamps = []
        for cache in self.data_cache.values():
            if cache:
                all_timestamps.extend([point.timestamp for point in cache])
        
        if all_timestamps:
            report['oldest_cached_data'] = min(all_timestamps).isoformat()
            report['newest_cached_data'] = max(all_timestamps).isoformat()
        
        return report