"""
Trade domain model for the trading bot system.
Represents individual trading transactions with all necessary metadata.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Optional


class TradeType(Enum):
    """Types of trades that can be executed."""
    BUY = "buy"
    SELL = "sell"


class TradeStatus(Enum):
    """Status of a trade throughout its lifecycle."""
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TradeSide(Enum):
    """Side of the trade from position perspective."""
    LONG = "long"
    SHORT = "short"


@dataclass
class Trade:
    """
    Core trade entity representing a trading transaction.

    Attributes:
        id: Unique identifier for the trade
        symbol: Trading pair symbol (e.g., 'BTC/USDT')
        trade_type: Buy or sell operation
        side: Long or short position
        amount: Quantity of base asset to trade
        price: Price per unit of base asset
        timestamp: When the trade was created
        status: Current status of the trade
        exchange_order_id: External exchange order identifier
        filled_amount: Amount actually filled
        filled_price: Average price of filled amount
        fee: Trading fee charged
        fee_currency: Currency in which fee is denominated
        strategy_id: ID of strategy that generated this trade
        metadata: Additional trade-specific data
        created_at: Trade creation timestamp
        updated_at: Last update timestamp
    """

    # Core trade identification
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str = ""

    # Trade parameters
    trade_type: TradeType = TradeType.BUY
    side: TradeSide = TradeSide.LONG
    amount: Decimal = field(default_factory=lambda: Decimal('0'))
    price: Decimal = field(default_factory=lambda: Decimal('0'))

    # Trade status and execution
    status: TradeStatus = TradeStatus.PENDING
    exchange_order_id: Optional[str] = None
    filled_amount: Decimal = field(default_factory=lambda: Decimal('0'))
    filled_price: Decimal = field(default_factory=lambda: Decimal('0'))

    # Fees and costs
    fee: Decimal = field(default_factory=lambda: Decimal('0'))
    fee_currency: str = ""

    # Strategy and metadata
    strategy_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Timestamps
    timestamp: datetime = field(default_factory=datetime.utcnow)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        """Post-initialization processing."""
        if isinstance(self.amount, (int, float)):
            self.amount = Decimal(str(self.amount))
        if isinstance(self.price, (int, float)):
            self.price = Decimal(str(self.price))
        if isinstance(self.filled_amount, (int, float)):
            self.filled_amount = Decimal(str(self.filled_amount))
        if isinstance(self.filled_price, (int, float)):
            self.filled_price = Decimal(str(self.filled_price))
        if isinstance(self.fee, (int, float)):
            self.fee = Decimal(str(self.fee))

    @property
    def total_value(self) -> Decimal:
        """Calculate total value of the trade."""
        return self.amount * self.price

    @property
    def filled_value(self) -> Decimal:
        """Calculate total value of filled portion."""
        return self.filled_amount * self.filled_price

    @property
    def remaining_amount(self) -> Decimal:
        """Calculate remaining unfilled amount."""
        return self.amount - self.filled_amount

    @property
    def fill_percentage(self) -> float:
        """Calculate what percentage of the trade has been filled."""
        if self.amount == 0:
            return 0.0
        return float((self.filled_amount / self.amount) * 100)

    @property
    def is_complete(self) -> bool:
        """Check if trade is completely filled."""
        return self.status == TradeStatus.FILLED or self.filled_amount >= self.amount

    @property
    def is_active(self) -> bool:
        """Check if trade is still active (can be filled)."""
        return self.status in [
            TradeStatus.PENDING,
            TradeStatus.PARTIALLY_FILLED]

    def update_fill(
            self,
            filled_amount: Decimal,
            filled_price: Decimal,
            fee: Decimal = None) -> None:
        """
        Update trade with fill information.

        Args:
            filled_amount: Amount that was filled
            filled_price: Price at which fill occurred
            fee: Trading fee (optional)
        """
        self.filled_amount += filled_amount

        # Calculate weighted average filled price
        if self.filled_amount > 0:
            total_filled_value = (
                self.filled_price * (self.filled_amount - filled_amount)) + (filled_price * filled_amount)
            self.filled_price = total_filled_value / self.filled_amount

        if fee is not None:
            self.fee += fee

        # Update status based on fill
        if self.filled_amount >= self.amount:
            self.status = TradeStatus.FILLED
        elif self.filled_amount > 0:
            self.status = TradeStatus.PARTIALLY_FILLED

        self.updated_at = datetime.utcnow()

    def cancel(self) -> None:
        """Cancel the trade."""
        if self.is_active:
            self.status = TradeStatus.CANCELLED
            self.updated_at = datetime.utcnow()

    def reject(self, reason: str = None) -> None:
        """Reject the trade with optional reason."""
        self.status = TradeStatus.REJECTED
        if reason:
            self.metadata['rejection_reason'] = reason
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert trade to dictionary representation."""
        return {
            'id': self.id,
            'symbol': self.symbol,
            'trade_type': self.trade_type.value,
            'side': self.side.value,
            'amount': str(self.amount),
            'price': str(self.price),
            'status': self.status.value,
            'exchange_order_id': self.exchange_order_id,
            'filled_amount': str(self.filled_amount),
            'filled_price': str(self.filled_price),
            'fee': str(self.fee),
            'fee_currency': self.fee_currency,
            'strategy_id': self.strategy_id,
            'metadata': self.metadata,
            'timestamp': self.timestamp.isoformat(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'total_value': str(self.total_value),
            'filled_value': str(self.filled_value),
            'remaining_amount': str(self.remaining_amount),
            'fill_percentage': self.fill_percentage,
            'is_complete': self.is_complete,
            'is_active': self.is_active
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Trade':
        """Create trade from dictionary representation."""
        trade = cls(
            id=data.get('id', str(uuid.uuid4())),
            symbol=data.get('symbol', ''),
            trade_type=TradeType(data.get('trade_type', 'buy')),
            side=TradeSide(data.get('side', 'long')),
            amount=Decimal(str(data.get('amount', '0'))),
            price=Decimal(str(data.get('price', '0'))),
            status=TradeStatus(data.get('status', 'pending')),
            exchange_order_id=data.get('exchange_order_id'),
            filled_amount=Decimal(str(data.get('filled_amount', '0'))),
            filled_price=Decimal(str(data.get('filled_price', '0'))),
            fee=Decimal(str(data.get('fee', '0'))),
            fee_currency=data.get('fee_currency', ''),
            strategy_id=data.get('strategy_id'),
            metadata=data.get('metadata', {}),
            timestamp=datetime.fromisoformat(data['timestamp']) if data.get('timestamp') else datetime.utcnow(),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else datetime.utcnow()
        )
        return trade

    def __str__(self) -> str:
        """String representation of the trade."""
        return f"Trade({self.id[:8]}): {self.trade_type.value.upper()} {self.amount} {self.symbol} @ {self.price} [{self.status.value}]"

    def __repr__(self) -> str:
        """Detailed string representation of the trade."""
        return (
            f"Trade(id='{
                self.id}', symbol='{
                self.symbol}', " f"type={
                self.trade_type.value}, side={
                    self.side.value}, " f"amount={
                        self.amount}, price={
                            self.price}, status={
                                self.status.value})")
