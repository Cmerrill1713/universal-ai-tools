"""
Pydantic schemas for order-related data validation and serialization.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Optional, Any, List
from pydantic import BaseModel, Field, validator, root_validator
from enum import Enum


class OrderTypeSchema(str, Enum):
    """Order type enumeration."""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"
    ICEBERG = "iceberg"
    TWAP = "twap"
    VWAP = "vwap"


class OrderSideSchema(str, Enum):
    """Order side enumeration."""
    BUY = "buy"
    SELL = "sell"


class OrderStatusSchema(str, Enum):
    """Order status enumeration."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    OPEN = "open"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TimeInForceSchema(str, Enum):
    """Time in force enumeration."""
    GTC = "gtc"  # Good Till Cancelled
    IOC = "ioc"  # Immediate Or Cancel
    FOK = "fok"  # Fill Or Kill
    DAY = "day"  # Valid for the day
    GTD = "gtd"  # Good Till Date


class OrderCreateSchema(BaseModel):
    """Schema for creating a new order."""
    
    symbol: str = Field(..., min_length=1, description="Trading pair symbol")
    order_type: OrderTypeSchema = Field(..., description="Type of order")
    side: OrderSideSchema = Field(..., description="Buy or sell")
    amount: Decimal = Field(..., gt=0, description="Order amount")
    price: Optional[Decimal] = Field(None, gt=0, description="Order price (required for limit orders)")
    stop_price: Optional[Decimal] = Field(None, gt=0, description="Stop price (required for stop orders)")
    time_in_force: TimeInForceSchema = Field(default=TimeInForceSchema.GTC, description="Time in force")
    client_order_id: Optional[str] = Field(None, max_length=100, description="Client-provided order ID")
    strategy_id: Optional[str] = Field(None, description="Strategy that created this order")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional order metadata")
    expires_at: Optional[datetime] = Field(None, description="Order expiration time (for GTD orders)")
    
    @validator('symbol')
    def validate_symbol(cls, v):
        """Validate trading symbol format."""
        if '/' not in v:
            raise ValueError('Symbol must be in format BASE/QUOTE')
        return v.upper()
    
    @root_validator
    def validate_order_requirements(cls, values):
        """Validate order type-specific requirements."""
        order_type = values.get('order_type')
        price = values.get('price')
        stop_price = values.get('stop_price')
        time_in_force = values.get('time_in_force')
        expires_at = values.get('expires_at')
        
        # Price requirements
        if order_type in [OrderTypeSchema.LIMIT, OrderTypeSchema.STOP_LIMIT] and not price:
            raise ValueError(f'{order_type} orders require a price')
        
        if order_type in [OrderTypeSchema.STOP, OrderTypeSchema.STOP_LIMIT, OrderTypeSchema.TRAILING_STOP] and not stop_price:
            raise ValueError(f'{order_type} orders require a stop_price')
        
        # Time in force requirements
        if time_in_force == TimeInForceSchema.GTD and not expires_at:
            raise ValueError('GTD orders require an expiration time')
        
        if time_in_force != TimeInForceSchema.GTD and expires_at:
            raise ValueError('Only GTD orders can have an expiration time')
        
        # Validate expiration time is in the future
        if expires_at and expires_at <= datetime.utcnow():
            raise ValueError('Expiration time must be in the future')
        
        return values
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class OrderUpdateSchema(BaseModel):
    """Schema for updating an existing order."""
    
    price: Optional[Decimal] = Field(None, gt=0)
    stop_price: Optional[Decimal] = Field(None, gt=0)
    amount: Optional[Decimal] = Field(None, gt=0)
    time_in_force: Optional[TimeInForceSchema] = None
    expires_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('expires_at')
    def validate_expiration_time(cls, v):
        """Validate expiration time is in the future."""
        if v and v <= datetime.utcnow():
            raise ValueError('Expiration time must be in the future')
        return v
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class OrderFillSchema(BaseModel):
    """Schema for order fill data."""
    
    fill_id: str
    amount: Decimal
    price: Decimal
    fee: Decimal
    fee_currency: str
    timestamp: datetime
    trade_id: Optional[str] = None
    value: Decimal
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class OrderResponseSchema(BaseModel):
    """Schema for order response data."""
    
    id: str
    symbol: str
    order_type: OrderTypeSchema
    side: OrderSideSchema
    amount: Decimal
    price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    time_in_force: TimeInForceSchema
    status: OrderStatusSchema
    exchange_order_id: Optional[str] = None
    client_order_id: Optional[str] = None
    filled_amount: Decimal
    avg_fill_price: Decimal
    remaining_amount: Decimal
    fill_percentage: float
    total_fee: Decimal
    total_value: Decimal
    filled_value: Decimal
    fills: List[OrderFillSchema]
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    strategy_id: Optional[str] = None
    metadata: Dict[str, Any]
    is_filled: bool
    is_active: bool
    is_expired: bool
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class OrderFilterSchema(BaseModel):
    """Schema for filtering orders."""
    
    symbol: Optional[str] = None
    order_type: Optional[OrderTypeSchema] = None
    side: Optional[OrderSideSchema] = None
    status: Optional[OrderStatusSchema] = None
    strategy_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_amount: Optional[Decimal] = Field(None, ge=0)
    max_amount: Optional[Decimal] = Field(None, ge=0)
    min_price: Optional[Decimal] = Field(None, gt=0)
    max_price: Optional[Decimal] = Field(None, gt=0)
    active_only: bool = Field(default=False, description="Filter only active orders")
    
    @root_validator
    def validate_filters(cls, values):
        """Validate filter parameters."""
        start_date = values.get('start_date')
        end_date = values.get('end_date')
        if start_date and end_date and start_date > end_date:
            raise ValueError('start_date must be before end_date')
        
        min_amount = values.get('min_amount')
        max_amount = values.get('max_amount')
        if min_amount and max_amount and min_amount > max_amount:
            raise ValueError('min_amount must be less than max_amount')
        
        min_price = values.get('min_price')
        max_price = values.get('max_price')
        if min_price and max_price and min_price > max_price:
            raise ValueError('min_price must be less than max_price')
        
        return values
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class OrderBatchCreateSchema(BaseModel):
    """Schema for creating multiple orders."""
    
    orders: List[OrderCreateSchema] = Field(..., min_items=1, max_items=50)
    
    @validator('orders')
    def validate_order_count(cls, v):
        """Validate number of orders."""
        if len(v) > 50:
            raise ValueError('Cannot create more than 50 orders in a single batch')
        return v


class OrderCancelSchema(BaseModel):
    """Schema for cancelling an order."""
    
    reason: Optional[str] = Field(None, max_length=200, description="Cancellation reason")


class OrderStatsSchema(BaseModel):
    """Schema for order statistics."""
    
    total_orders: int = Field(ge=0)
    active_orders: int = Field(ge=0)
    filled_orders: int = Field(ge=0)
    cancelled_orders: int = Field(ge=0)
    rejected_orders: int = Field(ge=0)
    total_volume: Decimal = Field(ge=0)
    total_fees: Decimal = Field(ge=0)
    avg_order_size: Decimal = Field(ge=0)
    avg_fill_time_seconds: Optional[float] = Field(None, ge=0)
    fill_rate: float = Field(ge=0, le=100)
    most_used_order_type: Optional[str] = None
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class BracketOrderSchema(BaseModel):
    """Schema for bracket orders (parent + take profit + stop loss)."""
    
    symbol: str = Field(..., min_length=1)
    side: OrderSideSchema
    amount: Decimal = Field(..., gt=0)
    entry_price: Optional[Decimal] = Field(None, gt=0)  # None for market entry
    take_profit_price: Decimal = Field(..., gt=0)
    stop_loss_price: Decimal = Field(..., gt=0)
    time_in_force: TimeInForceSchema = Field(default=TimeInForceSchema.GTC)
    strategy_id: Optional[str] = None
    
    @validator('symbol')
    def validate_symbol(cls, v):
        """Validate trading symbol format."""
        if '/' not in v:
            raise ValueError('Symbol must be in format BASE/QUOTE')
        return v.upper()
    
    @root_validator
    def validate_prices(cls, values):
        """Validate price relationships."""
        entry_price = values.get('entry_price')
        take_profit_price = values.get('take_profit_price')
        stop_loss_price = values.get('stop_loss_price')
        side = values.get('side')
        
        if entry_price and take_profit_price and stop_loss_price:
            if side == OrderSideSchema.BUY:
                if take_profit_price <= entry_price:
                    raise ValueError('Take profit price must be higher than entry price for buy orders')
                if stop_loss_price >= entry_price:
                    raise ValueError('Stop loss price must be lower than entry price for buy orders')
            else:  # SELL
                if take_profit_price >= entry_price:
                    raise ValueError('Take profit price must be lower than entry price for sell orders')
                if stop_loss_price <= entry_price:
                    raise ValueError('Stop loss price must be higher than entry price for sell orders')
        
        return values
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class AlgoOrderSchema(BaseModel):
    """Schema for algorithmic orders (TWAP, VWAP, etc.)."""
    
    symbol: str = Field(..., min_length=1)
    order_type: OrderTypeSchema = Field(..., description="Must be TWAP or VWAP")
    side: OrderSideSchema
    amount: Decimal = Field(..., gt=0)
    duration_minutes: int = Field(..., gt=0, le=1440, description="Execution duration in minutes")
    slice_count: int = Field(default=10, ge=2, le=100, description="Number of order slices")
    max_participation_rate: float = Field(default=0.1, gt=0, le=1, description="Max % of volume to consume")
    start_time: Optional[datetime] = Field(None, description="When to start execution")
    price_limit: Optional[Decimal] = Field(None, gt=0, description="Maximum price limit")
    strategy_id: Optional[str] = None
    
    @validator('symbol')
    def validate_symbol(cls, v):
        """Validate trading symbol format."""
        if '/' not in v:
            raise ValueError('Symbol must be in format BASE/QUOTE')
        return v.upper()
    
    @validator('order_type')
    def validate_order_type(cls, v):
        """Validate order type is algorithmic."""
        if v not in [OrderTypeSchema.TWAP, OrderTypeSchema.VWAP]:
            raise ValueError('Algorithmic orders must be TWAP or VWAP type')
        return v
    
    @validator('start_time')
    def validate_start_time(cls, v):
        """Validate start time is in the future."""
        if v and v <= datetime.utcnow():
            raise ValueError('Start time must be in the future')
        return v
    
    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }