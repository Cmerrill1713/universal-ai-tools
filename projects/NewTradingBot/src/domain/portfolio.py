"""
Portfolio domain model for the trading bot system.
Manages positions, balances, and portfolio-level metrics.
"""

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import uuid

from .trade import Trade, TradeType, TradeSide


@dataclass
class Position:
    """
    Represents a position in a specific trading pair.
    
    Attributes:
        symbol: Trading pair symbol
        side: Long or short position
        amount: Total position size
        avg_entry_price: Average entry price for the position
        unrealized_pnl: Unrealized profit/loss
        realized_pnl: Realized profit/loss
        last_price: Last known market price
        created_at: Position creation time
        updated_at: Last update time
    """
    symbol: str = ""
    side: TradeSide = TradeSide.LONG
    amount: Decimal = field(default_factory=lambda: Decimal('0'))
    avg_entry_price: Decimal = field(default_factory=lambda: Decimal('0'))
    unrealized_pnl: Decimal = field(default_factory=lambda: Decimal('0'))
    realized_pnl: Decimal = field(default_factory=lambda: Decimal('0'))
    last_price: Decimal = field(default_factory=lambda: Decimal('0'))
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        """Post-initialization processing."""
        if isinstance(self.amount, (int, float)):
            self.amount = Decimal(str(self.amount))
        if isinstance(self.avg_entry_price, (int, float)):
            self.avg_entry_price = Decimal(str(self.avg_entry_price))
        if isinstance(self.unrealized_pnl, (int, float)):
            self.unrealized_pnl = Decimal(str(self.unrealized_pnl))
        if isinstance(self.realized_pnl, (int, float)):
            self.realized_pnl = Decimal(str(self.realized_pnl))
        if isinstance(self.last_price, (int, float)):
            self.last_price = Decimal(str(self.last_price))

    @property
    def market_value(self) -> Decimal:
        """Calculate current market value of the position."""
        if self.amount == 0:
            return Decimal('0')
        return self.amount * self.last_price

    @property
    def entry_value(self) -> Decimal:
        """Calculate entry value of the position."""
        if self.amount == 0:
            return Decimal('0')
        return self.amount * self.avg_entry_price

    @property
    def total_pnl(self) -> Decimal:
        """Calculate total profit/loss (realized + unrealized)."""
        return self.realized_pnl + self.unrealized_pnl

    @property
    def pnl_percentage(self) -> float:
        """Calculate PnL as percentage of entry value."""
        if self.entry_value == 0:
            return 0.0
        return float((self.total_pnl / self.entry_value) * 100)

    def update_price(self, new_price: Decimal) -> None:
        """Update position with new market price."""
        self.last_price = new_price
        
        if self.amount != 0:
            price_diff = new_price - self.avg_entry_price
            if self.side == TradeSide.SHORT:
                price_diff = -price_diff
            self.unrealized_pnl = self.amount * price_diff
        
        self.updated_at = datetime.utcnow()

    def add_trade(self, trade: Trade) -> None:
        """Add a trade to this position."""
        if trade.symbol != self.symbol:
            raise ValueError(f"Trade symbol {trade.symbol} doesn't match position symbol {self.symbol}")
        
        trade_amount = trade.filled_amount if trade.filled_amount > 0 else trade.amount
        trade_price = trade.filled_price if trade.filled_price > 0 else trade.price
        
        if trade.side != self.side:
            # Closing or reducing position
            if trade_amount >= self.amount:
                # Fully closing position
                if self.amount > 0:
                    pnl_per_unit = trade_price - self.avg_entry_price
                    if self.side == TradeSide.SHORT:
                        pnl_per_unit = -pnl_per_unit
                    self.realized_pnl += self.amount * pnl_per_unit
                
                self.amount = Decimal('0')
                self.avg_entry_price = Decimal('0')
                self.unrealized_pnl = Decimal('0')
            else:
                # Partially closing position
                pnl_per_unit = trade_price - self.avg_entry_price
                if self.side == TradeSide.SHORT:
                    pnl_per_unit = -pnl_per_unit
                self.realized_pnl += trade_amount * pnl_per_unit
                self.amount -= trade_amount
        else:
            # Adding to position
            if self.amount == 0:
                # New position
                self.amount = trade_amount
                self.avg_entry_price = trade_price
                self.side = trade.side
                self.created_at = trade.timestamp
            else:
                # Adding to existing position - calculate new average price
                total_value = (self.amount * self.avg_entry_price) + (trade_amount * trade_price)
                self.amount += trade_amount
                self.avg_entry_price = total_value / self.amount
        
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert position to dictionary."""
        return {
            'symbol': self.symbol,
            'side': self.side.value,
            'amount': str(self.amount),
            'avg_entry_price': str(self.avg_entry_price),
            'unrealized_pnl': str(self.unrealized_pnl),
            'realized_pnl': str(self.realized_pnl),
            'last_price': str(self.last_price),
            'market_value': str(self.market_value),
            'entry_value': str(self.entry_value),
            'total_pnl': str(self.total_pnl),
            'pnl_percentage': self.pnl_percentage,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


@dataclass
class Balance:
    """
    Represents balance in a specific currency.
    
    Attributes:
        currency: Currency code (e.g., 'USDT', 'BTC')
        available: Available balance for trading
        locked: Locked balance in open orders
        total: Total balance (available + locked)
    """
    currency: str = ""
    available: Decimal = field(default_factory=lambda: Decimal('0'))
    locked: Decimal = field(default_factory=lambda: Decimal('0'))
    
    def __post_init__(self):
        """Post-initialization processing."""
        if isinstance(self.available, (int, float)):
            self.available = Decimal(str(self.available))
        if isinstance(self.locked, (int, float)):
            self.locked = Decimal(str(self.locked))

    @property
    def total(self) -> Decimal:
        """Calculate total balance."""
        return self.available + self.locked

    def lock(self, amount: Decimal) -> bool:
        """Lock amount from available balance."""
        if amount <= self.available:
            self.available -= amount
            self.locked += amount
            return True
        return False

    def unlock(self, amount: Decimal) -> bool:
        """Unlock amount back to available balance."""
        if amount <= self.locked:
            self.locked -= amount
            self.available += amount
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Convert balance to dictionary."""
        return {
            'currency': self.currency,
            'available': str(self.available),
            'locked': str(self.locked),
            'total': str(self.total)
        }


@dataclass
class Portfolio:
    """
    Main portfolio class managing all positions and balances.
    
    Attributes:
        id: Unique portfolio identifier
        name: Portfolio name
        balances: Dictionary of currency balances
        positions: Dictionary of trading positions
        base_currency: Base currency for portfolio valuation
        created_at: Portfolio creation time
        updated_at: Last update time
        metadata: Additional portfolio data
    """
    
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Default Portfolio"
    balances: Dict[str, Balance] = field(default_factory=dict)
    positions: Dict[str, Position] = field(default_factory=dict)
    base_currency: str = "USDT"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_balance(self, currency: str) -> Balance:
        """Get balance for a specific currency."""
        if currency not in self.balances:
            self.balances[currency] = Balance(currency=currency)
        return self.balances[currency]

    def get_position(self, symbol: str) -> Position:
        """Get position for a specific symbol."""
        if symbol not in self.positions:
            self.positions[symbol] = Position(symbol=symbol)
        return self.positions[symbol]

    def update_balance(self, currency: str, available: Decimal, locked: Decimal = None) -> None:
        """Update balance for a currency."""
        balance = self.get_balance(currency)
        balance.available = available
        if locked is not None:
            balance.locked = locked
        self.updated_at = datetime.utcnow()

    def add_trade(self, trade: Trade) -> None:
        """Add a trade to the portfolio, updating positions and balances."""
        if not trade.is_complete:
            return
        
        # Update position
        position = self.get_position(trade.symbol)
        position.add_trade(trade)
        
        # Update balances
        base_asset, quote_asset = trade.symbol.split('/')
        trade_value = trade.filled_amount * trade.filled_price
        
        if trade.trade_type == TradeType.BUY:
            # Buying base asset with quote asset
            base_balance = self.get_balance(base_asset)
            quote_balance = self.get_balance(quote_asset)
            
            base_balance.available += trade.filled_amount
            quote_balance.available -= trade_value
            quote_balance.available -= trade.fee  # Assuming fee in quote currency
        else:
            # Selling base asset for quote asset
            base_balance = self.get_balance(base_asset)
            quote_balance = self.get_balance(quote_asset)
            
            base_balance.available -= trade.filled_amount
            quote_balance.available += trade_value
            quote_balance.available -= trade.fee  # Assuming fee in quote currency
        
        self.updated_at = datetime.utcnow()

    def update_prices(self, prices: Dict[str, Decimal]) -> None:
        """Update market prices for all positions."""
        for symbol, price in prices.items():
            if symbol in self.positions:
                self.positions[symbol].update_price(price)
        self.updated_at = datetime.utcnow()

    @property
    def total_value(self) -> Decimal:
        """Calculate total portfolio value in base currency."""
        total = Decimal('0')
        
        # Add base currency balance
        if self.base_currency in self.balances:
            total += self.balances[self.base_currency].total
        
        # Add position values (converted to base currency)
        for position in self.positions.values():
            if position.amount > 0:
                total += position.market_value  # Assumes market_value is in base currency
        
        return total

    @property
    def total_pnl(self) -> Decimal:
        """Calculate total realized + unrealized PnL."""
        total = Decimal('0')
        for position in self.positions.values():
            total += position.total_pnl
        return total

    @property
    def unrealized_pnl(self) -> Decimal:
        """Calculate total unrealized PnL."""
        total = Decimal('0')
        for position in self.positions.values():
            total += position.unrealized_pnl
        return total

    @property
    def realized_pnl(self) -> Decimal:
        """Calculate total realized PnL."""
        total = Decimal('0')
        for position in self.positions.values():
            total += position.realized_pnl
        return total

    @property
    def active_positions(self) -> List[Position]:
        """Get all positions with non-zero amounts."""
        return [pos for pos in self.positions.values() if pos.amount > 0]

    @property
    def position_count(self) -> int:
        """Get number of active positions."""
        return len(self.active_positions)

    def get_allocation_percentage(self, symbol: str) -> float:
        """Get allocation percentage for a specific symbol."""
        if self.total_value == 0:
            return 0.0
        
        position = self.positions.get(symbol)
        if not position or position.amount == 0:
            return 0.0
        
        return float((position.market_value / self.total_value) * 100)

    def to_dict(self) -> Dict[str, Any]:
        """Convert portfolio to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'base_currency': self.base_currency,
            'balances': {k: v.to_dict() for k, v in self.balances.items()},
            'positions': {k: v.to_dict() for k, v in self.positions.items()},
            'total_value': str(self.total_value),
            'total_pnl': str(self.total_pnl),
            'unrealized_pnl': str(self.unrealized_pnl),
            'realized_pnl': str(self.realized_pnl),
            'position_count': self.position_count,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Portfolio':
        """Create portfolio from dictionary."""
        portfolio = cls(
            id=data.get('id', str(uuid.uuid4())),
            name=data.get('name', 'Default Portfolio'),
            base_currency=data.get('base_currency', 'USDT'),
            metadata=data.get('metadata', {}),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else datetime.utcnow()
        )
        
        # Load balances
        for currency, balance_data in data.get('balances', {}).items():
            balance = Balance(
                currency=currency,
                available=Decimal(str(balance_data.get('available', '0'))),
                locked=Decimal(str(balance_data.get('locked', '0')))
            )
            portfolio.balances[currency] = balance
        
        # Load positions
        for symbol, position_data in data.get('positions', {}).items():
            position = Position(
                symbol=symbol,
                side=TradeSide(position_data.get('side', 'long')),
                amount=Decimal(str(position_data.get('amount', '0'))),
                avg_entry_price=Decimal(str(position_data.get('avg_entry_price', '0'))),
                unrealized_pnl=Decimal(str(position_data.get('unrealized_pnl', '0'))),
                realized_pnl=Decimal(str(position_data.get('realized_pnl', '0'))),
                last_price=Decimal(str(position_data.get('last_price', '0'))),
                created_at=datetime.fromisoformat(position_data['created_at']) if position_data.get('created_at') else datetime.utcnow(),
                updated_at=datetime.fromisoformat(position_data['updated_at']) if position_data.get('updated_at') else datetime.utcnow()
            )
            portfolio.positions[symbol] = position
        
        return portfolio

    def __str__(self) -> str:
        """String representation of portfolio."""
        return f"Portfolio({self.name}): {len(self.active_positions)} positions, {self.total_value} {self.base_currency}"

    def __repr__(self) -> str:
        """Detailed string representation of portfolio."""
        return (f"Portfolio(id='{self.id}', name='{self.name}', "
                f"positions={self.position_count}, value={self.total_value} {self.base_currency})")