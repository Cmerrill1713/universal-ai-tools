"""
Order domain model for the trading bot system.
Represents trading orders with various types and execution strategies.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from .trade import TradeSide, TradeType


class OrderType(Enum):
    """Types of orders that can be placed."""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"
    ICEBERG = "iceberg"
    TWAP = "twap"  # Time-weighted average price
    VWAP = "vwap"  # Volume-weighted average price


class OrderStatus(Enum):
    """Status of an order throughout its lifecycle."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    OPEN = "open"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TimeInForce(Enum):
    """Time in force specifications for orders."""
    GTC = "gtc"  # Good Till Cancelled
    IOC = "ioc"  # Immediate Or Cancel
    FOK = "fok"  # Fill Or Kill
    DAY = "day"  # Valid for the day
    GTD = "gtd"  # Good Till Date


@dataclass
class OrderFill:
    """
    Represents a partial or complete fill of an order.

    Attributes:
        fill_id: Unique identifier for this fill
        amount: Amount filled in this execution
        price: Price at which fill occurred
        fee: Trading fee for this fill
        fee_currency: Currency of the fee
        timestamp: When the fill occurred
        trade_id: Associated trade ID from exchange
    """
    fill_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    amount: Decimal = field(default_factory=lambda: Decimal('0'))
    price: Decimal = field(default_factory=lambda: Decimal('0'))
    fee: Decimal = field(default_factory=lambda: Decimal('0'))
    fee_currency: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    trade_id: Optional[str] = None

    def __post_init__(self):
        """Post-initialization processing."""
        if isinstance(self.amount, (int, float)):
            self.amount = Decimal(str(self.amount))
        if isinstance(self.price, (int, float)):
            self.price = Decimal(str(self.price))
        if isinstance(self.fee, (int, float)):
            self.fee = Decimal(str(self.fee))

    @property
    def value(self) -> Decimal:
        """Calculate value of this fill."""
        return self.amount * self.price

    def to_dict(self) -> Dict[str, Any]:
        """Convert fill to dictionary."""
        return {
            'fill_id': self.fill_id,
            'amount': str(self.amount),
            'price': str(self.price),
            'fee': str(self.fee),
            'fee_currency': self.fee_currency,
            'timestamp': self.timestamp.isoformat(),
            'trade_id': self.trade_id,
            'value': str(self.value)
        }


@dataclass
class Order:
    """
    Core order entity representing a trading order.

    Attributes:
        id: Unique identifier for the order
        symbol: Trading pair symbol
        order_type: Type of order (market, limit, etc.)
        side: Buy or sell
        amount: Quantity to trade
        price: Order price (for limit orders)
        stop_price: Stop price (for stop orders)
        time_in_force: Time validity of the order
        status: Current order status
        exchange_order_id: External exchange order ID
        client_order_id: Client-provided order ID
        filled_amount: Amount that has been filled
        avg_fill_price: Average price of fills
        remaining_amount: Amount still to be filled
        fills: List of order fills
        created_at: Order creation time
        updated_at: Last update time
        expires_at: Order expiration time
        strategy_id: ID of strategy that created this order
        metadata: Additional order data
    """

    # Core order identification
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str = ""

    # Order parameters
    order_type: OrderType = OrderType.MARKET
    side: TradeType = TradeType.BUY
    amount: Decimal = field(default_factory=lambda: Decimal('0'))
    price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None

    # Order execution settings
    time_in_force: TimeInForce = TimeInForce.GTC
    status: OrderStatus = OrderStatus.PENDING

    # Exchange integration
    exchange_order_id: Optional[str] = None
    client_order_id: Optional[str] = None

    # Fill tracking
    filled_amount: Decimal = field(default_factory=lambda: Decimal('0'))
    avg_fill_price: Decimal = field(default_factory=lambda: Decimal('0'))
    fills: List[OrderFill] = field(default_factory=list)

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

    # Strategy and metadata
    strategy_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Post-initialization processing."""
        if isinstance(self.amount, (int, float)):
            self.amount = Decimal(str(self.amount))
        if isinstance(self.filled_amount, (int, float)):
            self.filled_amount = Decimal(str(self.filled_amount))
        if isinstance(self.avg_fill_price, (int, float)):
            self.avg_fill_price = Decimal(str(self.avg_fill_price))
        if self.price and isinstance(self.price, (int, float)):
            self.price = Decimal(str(self.price))
        if self.stop_price and isinstance(self.stop_price, (int, float)):
            self.stop_price = Decimal(str(self.stop_price))

        # Set expiration for DAY orders
        if self.time_in_force == TimeInForce.DAY and not self.expires_at:
            # Set to end of trading day (assuming 24h trading)
            self.expires_at = (self.created_at + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

    @property
    def remaining_amount(self) -> Decimal:
        """Calculate remaining unfilled amount."""
        return self.amount - self.filled_amount

    @property
    def fill_percentage(self) -> float:
        """Calculate fill percentage."""
        if self.amount == 0:
            return 0.0
        return float((self.filled_amount / self.amount) * 100)

    @property
    def is_filled(self) -> bool:
        """Check if order is completely filled."""
        return self.filled_amount >= self.amount

    @property
    def is_active(self) -> bool:
        """Check if order is still active."""
        return self.status in [
            OrderStatus.OPEN,
            OrderStatus.PARTIALLY_FILLED,
            OrderStatus.SUBMITTED]

    @property
    def is_expired(self) -> bool:
        """Check if order has expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def total_fee(self) -> Decimal:
        """Calculate total fees paid."""
        return sum(fill.fee for fill in self.fills)

    @property
    def total_value(self) -> Decimal:
        """Calculate total value if fully filled."""
        effective_price = self.price or self.avg_fill_price or Decimal('0')
        return self.amount * effective_price

    @property
    def filled_value(self) -> Decimal:
        """Calculate value of filled portion."""
        return self.filled_amount * \
            self.avg_fill_price if self.avg_fill_price else Decimal('0')

    def add_fill(self, amount: Decimal, price: Decimal, fee: Decimal = None,
                 fee_currency: str = "", trade_id: str = None) -> OrderFill:
        """
        Add a fill to this order.

        Args:
            amount: Amount filled
            price: Fill price
            fee: Trading fee
            fee_currency: Fee currency
            trade_id: Exchange trade ID

        Returns:
            The created OrderFill object
        """
        fill = OrderFill(
            amount=amount,
            price=price,
            fee=fee or Decimal('0'),
            fee_currency=fee_currency,
            trade_id=trade_id
        )

        self.fills.append(fill)

        # Update filled amount and average price
        old_filled_value = self.filled_amount * self.avg_fill_price
        new_filled_value = amount * price

        self.filled_amount += amount

        if self.filled_amount > 0:
            self.avg_fill_price = (
                old_filled_value + new_filled_value) / self.filled_amount

        # Update status
        if self.filled_amount >= self.amount:
            self.status = OrderStatus.FILLED
        elif self.filled_amount > 0 and self.status == OrderStatus.OPEN:
            self.status = OrderStatus.PARTIALLY_FILLED

        self.updated_at = datetime.utcnow()
        return fill

    def cancel(self, reason: str = None) -> bool:
        """
        Cancel the order.

        Args:
            reason: Optional cancellation reason

        Returns:
            True if order was cancelled, False if not cancellable
        """
        if not self.is_active:
            return False

        self.status = OrderStatus.CANCELLED
        if reason:
            self.metadata['cancellation_reason'] = reason
        self.updated_at = datetime.utcnow()
        return True

    def reject(self, reason: str = None) -> None:
        """
        Reject the order.

        Args:
            reason: Rejection reason
        """
        self.status = OrderStatus.REJECTED
        if reason:
            self.metadata['rejection_reason'] = reason
        self.updated_at = datetime.utcnow()

    def expire(self) -> bool:
        """
        Expire the order if applicable.

        Returns:
            True if order was expired, False otherwise
        """
        if self.is_expired and self.is_active:
            self.status = OrderStatus.EXPIRED
            self.updated_at = datetime.utcnow()
            return True
        return False

    def update_status(self, new_status: OrderStatus) -> None:
        """Update order status."""
        self.status = new_status
        self.updated_at = datetime.utcnow()

    def validate(self) -> List[str]:
        """
        Validate order parameters.

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        if not self.symbol:
            errors.append("Symbol is required")

        if self.amount <= 0:
            errors.append("Amount must be positive")

        if self.order_type in [OrderType.LIMIT,
                               OrderType.STOP_LIMIT] and not self.price:
            errors.append(f"{self.order_type.value} order requires price")

        if self.order_type in [
                OrderType.STOP,
                OrderType.STOP_LIMIT,
                OrderType.TRAILING_STOP] and not self.stop_price:
            errors.append(f"{self.order_type.value} order requires stop_price")

        if self.price and self.price <= 0:
            errors.append("Price must be positive")

        if self.stop_price and self.stop_price <= 0:
            errors.append("Stop price must be positive")

        # Check time in force compatibility
        if self.time_in_force == TimeInForce.GTD and not self.expires_at:
            errors.append("GTD orders require expiration time")

        return errors

    def to_dict(self) -> Dict[str, Any]:
        """Convert order to dictionary representation."""
        return {
            'id': self.id,
            'symbol': self.symbol,
            'order_type': self.order_type.value,
            'side': self.side.value,
            'amount': str(self.amount),
            'price': str(self.price) if self.price else None,
            'stop_price': str(self.stop_price) if self.stop_price else None,
            'time_in_force': self.time_in_force.value,
            'status': self.status.value,
            'exchange_order_id': self.exchange_order_id,
            'client_order_id': self.client_order_id,
            'filled_amount': str(self.filled_amount),
            'avg_fill_price': str(self.avg_fill_price),
            'remaining_amount': str(self.remaining_amount),
            'fill_percentage': self.fill_percentage,
            'total_fee': str(self.total_fee),
            'total_value': str(self.total_value),
            'filled_value': str(self.filled_value),
            'fills': [fill.to_dict() for fill in self.fills],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'strategy_id': self.strategy_id,
            'metadata': self.metadata,
            'is_filled': self.is_filled,
            'is_active': self.is_active,
            'is_expired': self.is_expired
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Order':
        """Create order from dictionary representation."""
        # Parse fills
        fills = []
        for fill_data in data.get('fills', []):
            fill = OrderFill(
                fill_id=fill_data.get('fill_id', str(uuid.uuid4())),
                amount=Decimal(str(fill_data.get('amount', '0'))),
                price=Decimal(str(fill_data.get('price', '0'))),
                fee=Decimal(str(fill_data.get('fee', '0'))),
                fee_currency=fill_data.get('fee_currency', ''),
                timestamp=datetime.fromisoformat(fill_data['timestamp']) if fill_data.get('timestamp') else datetime.utcnow(),
                trade_id=fill_data.get('trade_id')
            )
            fills.append(fill)

        order = cls(
            id=data.get('id', str(uuid.uuid4())),
            symbol=data.get('symbol', ''),
            order_type=OrderType(data.get('order_type', 'market')),
            side=TradeType(data.get('side', 'buy')),
            amount=Decimal(str(data.get('amount', '0'))),
            price=Decimal(str(data['price'])) if data.get('price') else None,
            stop_price=Decimal(str(data['stop_price'])) if data.get('stop_price') else None,
            time_in_force=TimeInForce(data.get('time_in_force', 'gtc')),
            status=OrderStatus(data.get('status', 'pending')),
            exchange_order_id=data.get('exchange_order_id'),
            client_order_id=data.get('client_order_id'),
            filled_amount=Decimal(str(data.get('filled_amount', '0'))),
            avg_fill_price=Decimal(str(data.get('avg_fill_price', '0'))),
            fills=fills,
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else datetime.utcnow(),
            expires_at=datetime.fromisoformat(data['expires_at']) if data.get('expires_at') else None,
            strategy_id=data.get('strategy_id'),
            metadata=data.get('metadata', {})
        )

        return order

    def __str__(self) -> str:
        """String representation of the order."""
        price_str = f" @ {self.price}" if self.price else ""
        return f"Order({self.id[:8]}): {self.side.value.upper()} {self.amount} {self.symbol}{price_str} [{self.status.value}]"

    def __repr__(self) -> str:
        """Detailed string representation of the order."""
        return (f"Order(id='{self.id}', symbol='{self.symbol}', "
                f"type={self.order_type.value}, side={self.side.value}, "
                f"amount={self.amount}, status={self.status.value})")
