"""
Pydantic schemas for trade-related data validation and serialization.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, model_validator, validator


class TradeTypeSchema(str, Enum):
    """Trade type enumeration for schema validation."""
    BUY = "buy"
    SELL = "sell"


class TradeSideSchema(str, Enum):
    """Trade side enumeration for schema validation."""
    LONG = "long"
    SHORT = "short"


class TradeStatusSchema(str, Enum):
    """Trade status enumeration for schema validation."""
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TradeCreateSchema(BaseModel):
    """Schema for creating a new trade."""

    symbol: str = Field(..., min_length=1, description="Trading pair symbol")
    trade_type: TradeTypeSchema = Field(...,
                                        description="Type of trade (buy/sell)")
    side: TradeSideSchema = Field(...,
                                  description="Position side (long/short)")
    amount: Decimal = Field(..., gt=0, description="Trade amount")
    price: Decimal = Field(..., gt=0, description="Trade price")
    strategy_id: Optional[str] = Field(
        None, description="Strategy that generated this trade")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional trade metadata")

    @validator('symbol')
    def validate_symbol(cls, v):
        """Validate trading symbol format."""
        if '/' not in v:
            raise ValueError(
                'Symbol must be in format BASE/QUOTE (e.g., BTC/USDT)')
        base, quote = v.split('/')
        if not base or not quote:
            raise ValueError(
                'Both base and quote currencies must be specified')
        return v.upper()

    @validator('amount', 'price')
    def validate_positive_decimals(cls, v):
        """Ensure amounts and prices are positive."""
        if v <= 0:
            raise ValueError('Amount and price must be positive')
        return v

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class TradeUpdateSchema(BaseModel):
    """Schema for updating an existing trade."""

    status: Optional[TradeStatusSchema] = None
    exchange_order_id: Optional[str] = None
    filled_amount: Optional[Decimal] = Field(None, ge=0)
    filled_price: Optional[Decimal] = Field(None, gt=0)
    fee: Optional[Decimal] = Field(None, ge=0)
    fee_currency: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    @validator('filled_amount', 'filled_price', 'fee')
    def validate_non_negative_decimals(cls, v):
        """Ensure filled amounts and fees are non-negative."""
        if v is not None and v < 0:
            raise ValueError('Filled amounts and fees must be non-negative')
        return v

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class TradeResponseSchema(BaseModel):
    """Schema for trade response data."""

    id: str
    symbol: str
    trade_type: TradeTypeSchema
    side: TradeSideSchema
    amount: Decimal
    price: Decimal
    status: TradeStatusSchema
    exchange_order_id: Optional[str] = None
    filled_amount: Decimal
    filled_price: Decimal
    remaining_amount: Decimal
    fill_percentage: float
    fee: Decimal
    fee_currency: str
    strategy_id: Optional[str] = None
    metadata: Dict[str, Any]
    timestamp: datetime
    created_at: datetime
    updated_at: datetime
    total_value: Decimal
    filled_value: Decimal
    is_complete: bool
    is_active: bool

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class TradeFilterSchema(BaseModel):
    """Schema for filtering trades."""

    symbol: Optional[str] = None
    trade_type: Optional[TradeTypeSchema] = None
    side: Optional[TradeSideSchema] = None
    status: Optional[TradeStatusSchema] = None
    strategy_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_amount: Optional[Decimal] = Field(None, ge=0)
    max_amount: Optional[Decimal] = Field(None, ge=0)
    min_price: Optional[Decimal] = Field(None, gt=0)
    max_price: Optional[Decimal] = Field(None, gt=0)

    @model_validator(mode='after')
    def validate_date_range(self):
        """Validate date range."""
        start_date = self.start_date
        end_date = self.end_date
        if start_date and end_date and start_date > end_date:
            raise ValueError('start_date must be before end_date')
        return self

    @model_validator(mode='after')
    def validate_amount_range(self):
        """Validate amount range."""
        min_amount = self.min_amount
        max_amount = self.max_amount
        if min_amount and max_amount and min_amount > max_amount:
            raise ValueError('min_amount must be less than max_amount')
        return self

    @model_validator(mode='after')
    def validate_price_range(self):
        """Validate price range."""
        min_price = self.min_price
        max_price = self.max_price
        if min_price and max_price and min_price > max_price:
            raise ValueError('min_price must be less than max_price')
        return self

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class TradeBatchCreateSchema(BaseModel):
    """Schema for creating multiple trades."""

    trades: list[TradeCreateSchema] = Field(..., min_items=1, max_items=100)

    @validator('trades')
    def validate_trades_limit(cls, v):
        """Validate number of trades."""
        if len(v) > 100:
            raise ValueError(
                'Cannot create more than 100 trades in a single batch')
        return v


class TradeStatsSchema(BaseModel):
    """Schema for trade statistics."""

    total_trades: int = Field(ge=0)
    completed_trades: int = Field(ge=0)
    pending_trades: int = Field(ge=0)
    cancelled_trades: int = Field(ge=0)
    total_volume: Decimal = Field(ge=0)
    total_fees: Decimal = Field(ge=0)
    avg_trade_size: Decimal = Field(ge=0)
    success_rate: float = Field(ge=0, le=100)
    most_traded_symbol: Optional[str] = None
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class TradeExecutionSchema(BaseModel):
    """Schema for trade execution parameters."""

    symbol: str = Field(..., min_length=1)
    trade_type: TradeTypeSchema
    amount: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = Field(None, gt=0)  # None for market orders
    order_type: str = Field(default="market",
                            description="Order type (market, limit, etc.)")
    time_in_force: str = Field(default="gtc", description="Time in force")
    strategy_id: Optional[str] = None
    risk_params: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('symbol')
    def validate_symbol(cls, v):
        """Validate trading symbol format."""
        if '/' not in v:
            raise ValueError('Symbol must be in format BASE/QUOTE')
        return v.upper()

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class TradeSignalSchema(BaseModel):
    """Schema for trading signals from strategies."""

    symbol: str = Field(..., min_length=1)
    signal_type: str = Field(..., description="Signal type (buy, sell, hold)")
    strength: float = Field(..., ge=0, le=1,
                            description="Signal strength (0-1)")
    price_target: Optional[Decimal] = Field(None, gt=0)
    stop_loss: Optional[Decimal] = Field(None, gt=0)
    take_profit: Optional[Decimal] = Field(None, gt=0)
    confidence: float = Field(..., ge=0, le=1,
                              description="Signal confidence (0-1)")
    strategy_id: str = Field(..., min_length=1)
    indicators: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @validator('signal_type')
    def validate_signal_type(cls, v):
        """Validate signal type."""
        valid_signals = ['buy', 'sell', 'hold', 'strong_buy', 'strong_sell']
        if v.lower() not in valid_signals:
            raise ValueError(f'Signal type must be one of: {valid_signals}')
        return v.lower()

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }
