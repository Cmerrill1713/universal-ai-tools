"""
Stream processing module for real-time market data.
Handles data streams, filtering, aggregation, and real-time analytics.
"""

from typing import Dict, List, Optional, Any, Callable, Tuple, Union
from decimal import Decimal
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import pandas as pd
import numpy as np
from collections import deque, defaultdict
import logging
import json
from concurrent.futures import ThreadPoolExecutor
import threading
import time

from .market_data import MarketDataPoint, DataType, Timeframe

logger = logging.getLogger(__name__)


class StreamEventType(Enum):
    """Types of stream events."""
    PRICE_UPDATE = "price_update"
    VOLUME_SPIKE = "volume_spike"
    PRICE_BREAKOUT = "price_breakout"
    VOLATILITY_CHANGE = "volatility_change"
    CORRELATION_SHIFT = "correlation_shift"
    LIQUIDITY_CHANGE = "liquidity_change"
    PATTERN_DETECTED = "pattern_detected"


class FilterType(Enum):
    """Types of data filters."""
    PRICE_RANGE = "price_range"
    VOLUME_THRESHOLD = "volume_threshold"
    VOLATILITY_LIMIT = "volatility_limit"
    TIME_WINDOW = "time_window"
    OUTLIER_REMOVAL = "outlier_removal"
    DUPLICATE_REMOVAL = "duplicate_removal"


@dataclass
class StreamEvent:
    """
    Stream event notification.
    
    Attributes:
        event_type: Type of event
        symbol: Related symbol
        timestamp: Event timestamp
        data: Event data
        severity: Event severity (0-1)
        message: Human-readable message
        metadata: Additional metadata
    """
    event_type: StreamEventType
    symbol: str
    timestamp: datetime
    data: Dict[str, Any]
    severity: float = 0.5
    message: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamFilter:
    """
    Data stream filter configuration.
    
    Attributes:
        filter_type: Type of filter
        parameters: Filter parameters
        is_active: Whether filter is active
        created_at: Filter creation time
    """
    filter_type: FilterType
    parameters: Dict[str, Any]
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass 
class StreamAggregation:
    """
    Stream aggregation configuration.
    
    Attributes:
        window_size: Time window for aggregation
        aggregation_type: Type of aggregation (mean, sum, etc.)
        output_interval: How often to output results
        symbols: Symbols to aggregate (None for all)
        last_output: Last output time
    """
    window_size: timedelta
    aggregation_type: str  # mean, sum, max, min, std, count
    output_interval: timedelta
    symbols: Optional[List[str]] = None
    last_output: datetime = field(default_factory=datetime.utcnow)


class StreamBuffer:
    """
    Circular buffer for streaming data with time-based indexing.
    """
    
    def __init__(self, max_size: int = 10000, max_age: timedelta = None):
        """
        Initialize stream buffer.
        
        Args:
            max_size: Maximum number of data points to store
            max_age: Maximum age of data points to keep
        """
        self.data: deque = deque(maxlen=max_size)
        self.max_age = max_age or timedelta(hours=24)
        self.lock = threading.Lock()
        
    def add(self, data_point: MarketDataPoint) -> None:
        """Add a data point to the buffer."""
        with self.lock:
            self.data.append(data_point)
            self._cleanup_old_data()
    
    def get_data(self, since: datetime = None, limit: int = None) -> List[MarketDataPoint]:
        """Get data points from buffer."""
        with self.lock:
            if since is None and limit is None:
                return list(self.data)
            
            result = []
            for point in reversed(self.data):
                if since and point.timestamp < since:
                    break
                result.append(point)
                if limit and len(result) >= limit:
                    break
            
            return list(reversed(result))
    
    def get_latest(self) -> Optional[MarketDataPoint]:
        """Get the most recent data point."""
        with self.lock:
            return self.data[-1] if self.data else None
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get buffer statistics."""
        with self.lock:
            if not self.data:
                return {'count': 0}
            
            timestamps = [point.timestamp for point in self.data]
            prices = [float(point.close_price) for point in self.data if point.close_price]
            volumes = [float(point.volume) for point in self.data if point.volume]
            
            stats = {
                'count': len(self.data),
                'oldest': min(timestamps).isoformat(),
                'newest': max(timestamps).isoformat(),
                'time_span_seconds': (max(timestamps) - min(timestamps)).total_seconds()
            }
            
            if prices:
                stats.update({
                    'price_min': min(prices),
                    'price_max': max(prices),
                    'price_mean': np.mean(prices),
                    'price_std': np.std(prices)
                })
            
            if volumes:
                stats.update({
                    'volume_total': sum(volumes),
                    'volume_mean': np.mean(volumes),
                    'volume_max': max(volumes)
                })
            
            return stats
    
    def _cleanup_old_data(self) -> None:
        """Remove old data points beyond max_age."""
        if not self.data:
            return
        
        cutoff_time = datetime.utcnow() - self.max_age
        while self.data and self.data[0].timestamp < cutoff_time:
            self.data.popleft()


class StreamProcessor:
    """
    Real-time stream processor for market data.
    Handles filtering, aggregation, pattern detection, and event generation.
    """
    
    def __init__(self, max_symbols: int = 100):
        """
        Initialize stream processor.
        
        Args:
            max_symbols: Maximum number of symbols to track
        """
        self.max_symbols = max_symbols
        self.buffers: Dict[str, StreamBuffer] = {}
        self.filters: List[StreamFilter] = []
        self.aggregations: List[StreamAggregation] = []
        self.event_handlers: List[Callable[[StreamEvent], None]] = []
        
        # Processing statistics
        self.stats = {
            'total_processed': 0,
            'filtered_out': 0,
            'events_generated': 0,
            'start_time': datetime.utcnow(),
            'last_update': datetime.utcnow()
        }
        
        # Pattern detection
        self.pattern_detectors: Dict[str, Callable] = {
            'volume_spike': self._detect_volume_spike,
            'price_breakout': self._detect_price_breakout,
            'volatility_change': self._detect_volatility_change
        }
        
        # Executor for CPU-intensive tasks
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Background tasks
        self.is_running = False
        self.background_tasks: List[asyncio.Task] = []
    
    async def start(self) -> None:
        """Start the stream processor."""
        self.is_running = True
        
        # Start background tasks
        self.background_tasks = [
            asyncio.create_task(self._aggregation_loop()),
            asyncio.create_task(self._pattern_detection_loop()),
            asyncio.create_task(self._cleanup_loop())
        ]
        
        logger.info("Stream processor started")
    
    async def stop(self) -> None:
        """Stop the stream processor."""
        self.is_running = False
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        logger.info("Stream processor stopped")
    
    def add_data_point(self, data_point: MarketDataPoint) -> None:
        """
        Process a new data point.
        
        Args:
            data_point: Market data point to process
        """
        # Update statistics
        self.stats['total_processed'] += 1
        self.stats['last_update'] = datetime.utcnow()
        
        # Apply filters
        if not self._apply_filters(data_point):
            self.stats['filtered_out'] += 1
            return
        
        # Add to buffer
        symbol = data_point.symbol
        if symbol not in self.buffers:
            if len(self.buffers) >= self.max_symbols:
                # Remove oldest buffer
                oldest_symbol = min(self.buffers.keys(), 
                                  key=lambda s: self.buffers[s].get_latest().timestamp if self.buffers[s].get_latest() else datetime.min)
                del self.buffers[oldest_symbol]
            
            self.buffers[symbol] = StreamBuffer()
        
        self.buffers[symbol].add(data_point)
        
        # Trigger immediate pattern detection for this data point
        asyncio.create_task(self._detect_patterns_for_symbol(symbol))
    
    def add_filter(self, stream_filter: StreamFilter) -> None:
        """Add a new data filter."""
        self.filters.append(stream_filter)
    
    def remove_filter(self, filter_type: FilterType) -> None:
        """Remove all filters of specified type."""
        self.filters = [f for f in self.filters if f.filter_type != filter_type]
    
    def add_aggregation(self, aggregation: StreamAggregation) -> None:
        """Add a new data aggregation."""
        self.aggregations.append(aggregation)
    
    def add_event_handler(self, handler: Callable[[StreamEvent], None]) -> None:
        """Add an event handler."""
        self.event_handlers.append(handler)
    
    def get_buffer(self, symbol: str) -> Optional[StreamBuffer]:
        """Get buffer for a specific symbol."""
        return self.buffers.get(symbol)
    
    def get_latest_data(self, symbol: str) -> Optional[MarketDataPoint]:
        """Get latest data point for a symbol."""
        buffer = self.buffers.get(symbol)
        return buffer.get_latest() if buffer else None
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get processor statistics."""
        runtime = datetime.utcnow() - self.stats['start_time']
        
        stats = self.stats.copy()
        stats.update({
            'runtime_seconds': runtime.total_seconds(),
            'processing_rate': self.stats['total_processed'] / max(1, runtime.total_seconds()),
            'symbols_tracked': len(self.buffers),
            'active_filters': len([f for f in self.filters if f.is_active]),
            'active_aggregations': len(self.aggregations),
            'event_handlers': len(self.event_handlers),
            'buffer_stats': {
                symbol: buffer.get_statistics()
                for symbol, buffer in self.buffers.items()
            }
        })
        
        return stats
    
    def _apply_filters(self, data_point: MarketDataPoint) -> bool:
        """Apply all active filters to a data point."""
        for stream_filter in self.filters:
            if not stream_filter.is_active:
                continue
            
            if not self._apply_single_filter(data_point, stream_filter):
                return False
        
        return True
    
    def _apply_single_filter(self, data_point: MarketDataPoint, stream_filter: StreamFilter) -> bool:
        """Apply a single filter to a data point."""
        try:
            if stream_filter.filter_type == FilterType.PRICE_RANGE:
                if data_point.close_price:
                    price = float(data_point.close_price)
                    min_price = stream_filter.parameters.get('min_price', 0)
                    max_price = stream_filter.parameters.get('max_price', float('inf'))
                    return min_price <= price <= max_price
            
            elif stream_filter.filter_type == FilterType.VOLUME_THRESHOLD:
                if data_point.volume:
                    volume = float(data_point.volume)
                    min_volume = stream_filter.parameters.get('min_volume', 0)
                    return volume >= min_volume
            
            elif stream_filter.filter_type == FilterType.TIME_WINDOW:
                now = datetime.utcnow()
                max_age = timedelta(seconds=stream_filter.parameters.get('max_age_seconds', 3600))
                return now - data_point.timestamp <= max_age
            
            elif stream_filter.filter_type == FilterType.DUPLICATE_REMOVAL:
                # Check if we've seen this exact data recently
                buffer = self.buffers.get(data_point.symbol)
                if buffer:
                    recent_data = buffer.get_data(limit=10)
                    for recent_point in recent_data:
                        if (recent_point.timestamp == data_point.timestamp and
                            recent_point.close_price == data_point.close_price):
                            return False
            
            # Add more filter types as needed
            
        except Exception as e:
            logger.error(f"Error applying filter {stream_filter.filter_type}: {e}")
            return True  # Don't filter out on error
        
        return True
    
    async def _aggregation_loop(self) -> None:
        """Background task for data aggregation."""
        while self.is_running:
            try:
                current_time = datetime.utcnow()
                
                for aggregation in self.aggregations:
                    if current_time - aggregation.last_output >= aggregation.output_interval:
                        await self._process_aggregation(aggregation)
                        aggregation.last_output = current_time
                
                await asyncio.sleep(1)  # Check every second
                
            except Exception as e:
                logger.error(f"Error in aggregation loop: {e}")
                await asyncio.sleep(5)
    
    async def _pattern_detection_loop(self) -> None:
        """Background task for pattern detection."""
        while self.is_running:
            try:
                # Run pattern detection for all symbols
                for symbol in list(self.buffers.keys()):
                    await self._detect_patterns_for_symbol(symbol)
                
                await asyncio.sleep(5)  # Run every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in pattern detection loop: {e}")
                await asyncio.sleep(10)
    
    async def _cleanup_loop(self) -> None:
        """Background task for cleanup."""
        while self.is_running:
            try:
                # Remove empty buffers
                empty_symbols = [
                    symbol for symbol, buffer in self.buffers.items()
                    if not buffer.data
                ]
                
                for symbol in empty_symbols:
                    del self.buffers[symbol]
                
                # Clean up old data in buffers (they handle this themselves)
                
                await asyncio.sleep(60)  # Run every minute
                
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)
    
    async def _process_aggregation(self, aggregation: StreamAggregation) -> None:
        """Process a data aggregation."""
        try:
            symbols = aggregation.symbols or list(self.buffers.keys())
            cutoff_time = datetime.utcnow() - aggregation.window_size
            
            aggregated_data = {}
            
            for symbol in symbols:
                buffer = self.buffers.get(symbol)
                if not buffer:
                    continue
                
                # Get data within window
                data_points = buffer.get_data(since=cutoff_time)
                if not data_points:
                    continue
                
                # Extract values for aggregation
                if aggregation.aggregation_type in ['price_mean', 'price_std']:
                    values = [float(point.close_price) for point in data_points if point.close_price]
                elif aggregation.aggregation_type in ['volume_sum', 'volume_mean']:
                    values = [float(point.volume) for point in data_points if point.volume]
                else:
                    values = [1] * len(data_points)  # For count
                
                if not values:
                    continue
                
                # Calculate aggregation
                if 'mean' in aggregation.aggregation_type:
                    result = np.mean(values)
                elif 'sum' in aggregation.aggregation_type:
                    result = np.sum(values)
                elif 'max' in aggregation.aggregation_type:
                    result = np.max(values)
                elif 'min' in aggregation.aggregation_type:
                    result = np.min(values)
                elif 'std' in aggregation.aggregation_type:
                    result = np.std(values)
                elif 'count' in aggregation.aggregation_type:
                    result = len(values)
                else:
                    result = values[-1]  # Latest value
                
                aggregated_data[symbol] = result
            
            # Create aggregation event
            if aggregated_data:
                event = StreamEvent(
                    event_type=StreamEventType.PRICE_UPDATE,
                    symbol="AGGREGATED",
                    timestamp=datetime.utcnow(),
                    data={
                        'aggregation_type': aggregation.aggregation_type,
                        'window_size_seconds': aggregation.window_size.total_seconds(),
                        'results': aggregated_data
                    },
                    severity=0.1,
                    message=f"Aggregation completed: {aggregation.aggregation_type}"
                )
                
                self._emit_event(event)
        
        except Exception as e:
            logger.error(f"Error processing aggregation: {e}")
    
    async def _detect_patterns_for_symbol(self, symbol: str) -> None:
        """Run pattern detection for a specific symbol."""
        buffer = self.buffers.get(symbol)
        if not buffer:
            return
        
        # Run pattern detectors
        for pattern_name, detector_func in self.pattern_detectors.items():
            try:
                # Run detector in executor to avoid blocking
                loop = asyncio.get_event_loop()
                event = await loop.run_in_executor(
                    self.executor, detector_func, symbol, buffer
                )
                
                if event:
                    self._emit_event(event)
                    
            except Exception as e:
                logger.error(f"Error in pattern detector {pattern_name} for {symbol}: {e}")
    
    def _detect_volume_spike(self, symbol: str, buffer: StreamBuffer) -> Optional[StreamEvent]:
        """Detect volume spikes."""
        recent_data = buffer.get_data(limit=20)
        if len(recent_data) < 10:
            return None
        
        volumes = [float(point.volume) for point in recent_data if point.volume]
        if len(volumes) < 10:
            return None
        
        # Calculate rolling average and compare latest volume
        recent_volumes = volumes[-5:]  # Last 5 data points
        historical_volumes = volumes[:-5]  # Earlier data points
        
        recent_avg = np.mean(recent_volumes)
        historical_avg = np.mean(historical_volumes)
        
        # Detect spike (3x normal volume)
        if recent_avg > historical_avg * 3:
            severity = min(1.0, recent_avg / (historical_avg * 3))
            
            return StreamEvent(
                event_type=StreamEventType.VOLUME_SPIKE,
                symbol=symbol,
                timestamp=recent_data[-1].timestamp,
                data={
                    'recent_volume': recent_avg,
                    'historical_volume': historical_avg,
                    'spike_ratio': recent_avg / historical_avg
                },
                severity=severity,
                message=f"Volume spike detected: {recent_avg:.0f} vs {historical_avg:.0f} (ratio: {recent_avg/historical_avg:.1f}x)"
            )
        
        return None
    
    def _detect_price_breakout(self, symbol: str, buffer: StreamBuffer) -> Optional[StreamEvent]:
        """Detect price breakouts."""
        recent_data = buffer.get_data(limit=50)
        if len(recent_data) < 20:
            return None
        
        prices = [float(point.close_price) for point in recent_data if point.close_price]
        if len(prices) < 20:
            return None
        
        # Calculate support/resistance levels
        highs = [float(point.high_price) for point in recent_data[-20:-1] if point.high_price]
        lows = [float(point.low_price) for point in recent_data[-20:-1] if point.low_price]
        
        if not highs or not lows:
            return None
        
        resistance = np.max(highs)
        support = np.min(lows)
        current_price = prices[-1]
        
        # Detect breakout
        breakout_threshold = 0.01  # 1%
        
        if current_price > resistance * (1 + breakout_threshold):
            return StreamEvent(
                event_type=StreamEventType.PRICE_BREAKOUT,
                symbol=symbol,
                timestamp=recent_data[-1].timestamp,
                data={
                    'breakout_type': 'bullish',
                    'current_price': current_price,
                    'resistance_level': resistance,
                    'breakout_percentage': (current_price - resistance) / resistance * 100
                },
                severity=0.7,
                message=f"Bullish breakout: {current_price:.2f} above resistance {resistance:.2f}"
            )
        
        elif current_price < support * (1 - breakout_threshold):
            return StreamEvent(
                event_type=StreamEventType.PRICE_BREAKOUT,
                symbol=symbol,
                timestamp=recent_data[-1].timestamp,
                data={
                    'breakout_type': 'bearish',
                    'current_price': current_price,
                    'support_level': support,
                    'breakout_percentage': (support - current_price) / support * 100
                },
                severity=0.7,
                message=f"Bearish breakout: {current_price:.2f} below support {support:.2f}"
            )
        
        return None
    
    def _detect_volatility_change(self, symbol: str, buffer: StreamBuffer) -> Optional[StreamEvent]:
        """Detect significant volatility changes."""
        recent_data = buffer.get_data(limit=100)
        if len(recent_data) < 50:
            return None
        
        prices = [float(point.close_price) for point in recent_data if point.close_price]
        if len(prices) < 50:
            return None
        
        # Calculate rolling volatility
        returns = np.diff(np.log(prices))
        
        # Recent vs historical volatility
        recent_volatility = np.std(returns[-20:]) * np.sqrt(1440)  # Annualized (assuming 1-min data)
        historical_volatility = np.std(returns[:-20]) * np.sqrt(1440)
        
        # Detect significant change (50% increase/decrease)
        volatility_ratio = recent_volatility / historical_volatility if historical_volatility > 0 else 1
        
        if volatility_ratio > 1.5 or volatility_ratio < 0.67:
            change_type = "increase" if volatility_ratio > 1 else "decrease"
            severity = min(1.0, abs(volatility_ratio - 1))
            
            return StreamEvent(
                event_type=StreamEventType.VOLATILITY_CHANGE,
                symbol=symbol,
                timestamp=recent_data[-1].timestamp,
                data={
                    'change_type': change_type,
                    'recent_volatility': recent_volatility,
                    'historical_volatility': historical_volatility,
                    'volatility_ratio': volatility_ratio
                },
                severity=severity,
                message=f"Volatility {change_type}: {recent_volatility:.1f}% vs {historical_volatility:.1f}%"
            )
        
        return None
    
    def _emit_event(self, event: StreamEvent) -> None:
        """Emit an event to all handlers."""
        self.stats['events_generated'] += 1
        
        for handler in self.event_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Error in event handler: {e}")


# Example usage functions

def create_basic_filters() -> List[StreamFilter]:
    """Create a set of basic data filters."""
    return [
        StreamFilter(
            filter_type=FilterType.PRICE_RANGE,
            parameters={'min_price': 0.0001, 'max_price': 1000000}
        ),
        StreamFilter(
            filter_type=FilterType.VOLUME_THRESHOLD,
            parameters={'min_volume': 0.001}
        ),
        StreamFilter(
            filter_type=FilterType.TIME_WINDOW,
            parameters={'max_age_seconds': 3600}  # 1 hour
        ),
        StreamFilter(
            filter_type=FilterType.DUPLICATE_REMOVAL,
            parameters={}
        )
    ]


def create_basic_aggregations() -> List[StreamAggregation]:
    """Create a set of basic aggregations."""
    return [
        StreamAggregation(
            window_size=timedelta(minutes=5),
            aggregation_type="price_mean",
            output_interval=timedelta(minutes=1)
        ),
        StreamAggregation(
            window_size=timedelta(minutes=15),
            aggregation_type="volume_sum",
            output_interval=timedelta(minutes=5)
        ),
        StreamAggregation(
            window_size=timedelta(hours=1),
            aggregation_type="price_std",
            output_interval=timedelta(minutes=15)
        )
    ]