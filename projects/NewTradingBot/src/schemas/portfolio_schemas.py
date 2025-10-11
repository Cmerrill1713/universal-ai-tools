"""
Pydantic schemas for portfolio-related data validation and serialization.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class TradeSideSchema(str, Enum):
    """Trade side enumeration."""
    LONG = "long"
    SHORT = "short"


class PositionCreateSchema(BaseModel):
    """Schema for creating a new position."""

    symbol: str = Field(..., min_length=1, description="Trading pair symbol")
    side: TradeSideSchema = Field(...,
                                  description="Position side (long/short)")
    amount: Decimal = Field(..., gt=0, description="Position amount")
    entry_price: Decimal = Field(..., gt=0, description="Entry price")

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


class PositionUpdateSchema(BaseModel):
    """Schema for updating a position."""

    amount: Optional[Decimal] = Field(None, ge=0)
    avg_entry_price: Optional[Decimal] = Field(None, gt=0)
    last_price: Optional[Decimal] = Field(None, gt=0)
    unrealized_pnl: Optional[Decimal] = None
    realized_pnl: Optional[Decimal] = None

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class PositionResponseSchema(BaseModel):
    """Schema for position response data."""

    symbol: str
    side: TradeSideSchema
    amount: Decimal
    avg_entry_price: Decimal
    last_price: Decimal
    market_value: Decimal
    entry_value: Decimal
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    total_pnl: Decimal
    pnl_percentage: float
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class BalanceCreateSchema(BaseModel):
    """Schema for creating a balance entry."""

    currency: str = Field(..., min_length=1, description="Currency code")
    available: Decimal = Field(..., ge=0, description="Available balance")
    locked: Decimal = Field(
        default=Decimal('0'),
        ge=0,
        description="Locked balance")

    @validator('currency')
    def validate_currency(cls, v):
        """Validate currency format."""
        return v.upper()

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class BalanceUpdateSchema(BaseModel):
    """Schema for updating a balance."""

    available: Optional[Decimal] = Field(None, ge=0)
    locked: Optional[Decimal] = Field(None, ge=0)

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class BalanceResponseSchema(BaseModel):
    """Schema for balance response data."""

    currency: str
    available: Decimal
    locked: Decimal
    total: Decimal

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class PortfolioCreateSchema(BaseModel):
    """Schema for creating a new portfolio."""

    name: str = Field(..., min_length=1, max_length=100,
                      description="Portfolio name")
    base_currency: str = Field(
        default="USDT",
        min_length=1,
        description="Base currency for valuation")
    initial_balance: Optional[Decimal] = Field(
        None, gt=0, description="Initial balance")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata")

    @validator('base_currency')
    def validate_base_currency(cls, v):
        """Validate base currency format."""
        return v.upper()

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class PortfolioUpdateSchema(BaseModel):
    """Schema for updating a portfolio."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    base_currency: Optional[str] = Field(None, min_length=1)
    metadata: Optional[Dict[str, Any]] = None

    @validator('base_currency')
    def validate_base_currency(cls, v):
        """Validate base currency format."""
        if v is not None:
            return v.upper()
        return v

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class PortfolioResponseSchema(BaseModel):
    """Schema for portfolio response data."""

    id: str
    name: str
    base_currency: str
    total_value: Decimal
    total_pnl: Decimal
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    position_count: int
    balances: Dict[str, BalanceResponseSchema]
    positions: Dict[str, PositionResponseSchema]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class PortfolioSummarySchema(BaseModel):
    """Schema for portfolio summary data."""

    id: str
    name: str
    base_currency: str
    total_value: Decimal
    total_pnl: Decimal
    pnl_percentage: float
    position_count: int
    top_positions: List[PositionResponseSchema]
    updated_at: datetime

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class AllocationRequestSchema(BaseModel):
    """Schema for portfolio allocation requests."""

    symbol: str = Field(..., min_length=1)
    target_percentage: float = Field(...,
                                     ge=0,
                                     le=100,
                                     description="Target allocation percentage")
    max_slippage: float = Field(
        default=0.5,
        ge=0,
        le=10,
        description="Maximum allowed slippage %")

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


class AllocationResponseSchema(BaseModel):
    """Schema for allocation response."""

    symbol: str
    current_percentage: float
    target_percentage: float
    current_value: Decimal
    target_value: Decimal
    adjustment_needed: Decimal
    action_required: str  # "buy", "sell", "hold"

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }


class PortfolioAnalyticsSchema(BaseModel):
    """Schema for portfolio analytics data."""

    total_return: Decimal
    total_return_percentage: float
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None
    avg_win: Optional[Decimal] = None
    avg_loss: Optional[Decimal] = None
    total_trades: int
    winning_trades: int
    losing_trades: int
    largest_win: Optional[Decimal] = None
    largest_loss: Optional[Decimal] = None
    consecutive_wins: int
    consecutive_losses: int
    period_start: datetime
    period_end: datetime

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class RiskMetricsSchema(BaseModel):
    """Schema for portfolio risk metrics."""

    portfolio_id: str
    var_95: Optional[Decimal] = Field(None, description="95% Value at Risk")
    var_99: Optional[Decimal] = Field(None, description="99% Value at Risk")
    expected_shortfall: Optional[Decimal] = Field(
        None, description="Expected Shortfall (CVaR)")
    volatility: Optional[float] = Field(
        None, ge=0, description="Portfolio volatility")
    beta: Optional[float] = Field(None, description="Portfolio beta")
    correlation_to_market: Optional[float] = Field(None, ge=-1, le=1)
    concentration_risk: float = Field(...,
                                      ge=0,
                                      le=100,
                                      description="Concentration risk percentage")
    leverage_ratio: Optional[float] = Field(None, ge=0)
    margin_usage: Optional[float] = Field(None, ge=0, le=100)
    calculated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str,
            datetime: lambda dt: dt.isoformat()
        }


class PortfolioOptimizationRequestSchema(BaseModel):
    """Schema for portfolio optimization requests."""

    optimization_type: str = Field(
        ..., description="Type of optimization (mean_variance, risk_parity, etc.)")
    risk_tolerance: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="Risk tolerance (0=conservative, 1=aggressive)")
    target_return: Optional[float] = Field(
        None, gt=0, description="Target return percentage")
    max_weight_per_asset: float = Field(
        default=0.3, gt=0, le=1, description="Maximum weight per asset")
    min_weight_per_asset: float = Field(
        default=0.01, ge=0, lt=1, description="Minimum weight per asset")
    excluded_symbols: List[str] = Field(
        default_factory=list,
        description="Symbols to exclude")
    included_symbols: Optional[List[str]] = Field(
        None, description="Only consider these symbols")
    rebalance_frequency: str = Field(
        default="weekly",
        description="Rebalancing frequency")

    @validator('optimization_type')
    def validate_optimization_type(cls, v):
        """Validate optimization type."""
        valid_types = [
            'mean_variance',
            'risk_parity',
            'min_variance',
            'max_sharpe',
            'equal_weight']
        if v.lower() not in valid_types:
            raise ValueError(
                f'Optimization type must be one of: {valid_types}')
        return v.lower()

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            Decimal: str
        }
