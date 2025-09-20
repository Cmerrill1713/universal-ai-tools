"""
Application Settings Configuration
Central configuration management for the NewTradingBot application
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class ExchangeConfig:
    """Exchange configuration settings"""
    name: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    api_passphrase: Optional[str] = None
    testnet: bool = True
    rate_limit: int = 10
    timeout: int = 30
    retry_count: int = 3
    fees: Dict[str, float] = field(default_factory=lambda: {
                                   'maker': 0.001, 'taker': 0.001})


@dataclass
class TradingConfig:
    """Trading configuration settings"""
    max_position_size: float = 0.1  # 10% of portfolio
    max_daily_loss: float = 0.05  # 5% daily loss limit
    default_stop_loss: float = 0.02  # 2% stop loss
    default_take_profit: float = 0.05  # 5% take profit
    default_order_type: str = 'limit'
    default_time_in_force: str = 'GTC'
    post_only: bool = False
    reduce_only: bool = False
    slippage_tolerance: float = 0.005  # 0.5%
    min_order_size: float = 10.0  # Minimum order size in USD


@dataclass
class StrategyConfig:
    """Strategy configuration settings"""
    active_strategies: List[str] = field(default_factory=list)
    strategy_allocation: Dict[str, float] = field(default_factory=dict)
    rebalance_frequency: str = 'daily'
    max_strategies: int = 5
    auto_start: bool = False
    backtest_period: int = 30  # days


@dataclass
class RiskConfig:
    """Risk management configuration"""
    max_drawdown: float = 0.20  # 20% maximum drawdown
    var_confidence: float = 0.95  # 95% VaR confidence
    position_sizing_method: str = 'kelly'  # kelly, fixed, volatility
    correlation_limit: float = 0.7  # Maximum correlation between positions
    leverage_limit: float = 3.0  # Maximum leverage
    exposure_limit: float = 0.8  # Maximum portfolio exposure


@dataclass
class NotificationConfig:
    """Notification settings"""
    email_enabled: bool = False
    email_address: Optional[str] = None
    telegram_enabled: bool = False
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    discord_enabled: bool = False
    discord_webhook_url: Optional[str] = None
    push_enabled: bool = True
    notification_types: List[str] = field(
        default_factory=lambda: ['order_filled', 'stop_loss', 'risk_alert']
    )


@dataclass
class UIConfig:
    """UI configuration settings"""
    theme: str = 'dark'
    chart_style: str = 'candlestick'
    auto_refresh: bool = False
    refresh_interval: int = 5  # seconds
    decimal_places: int = 2
    date_format: str = 'YYYY-MM-DD'
    timezone: str = 'UTC'
    sound_alerts: bool = False


@dataclass
class DatabaseConfig:
    """Database configuration"""
    url: Optional[str] = None
    host: str = 'localhost'
    port: int = 5432
    database: str = 'tradingbot'
    username: Optional[str] = None
    password: Optional[str] = None
    pool_size: int = 10
    max_overflow: int = 20


@dataclass
class LoggingConfig:
    """Logging configuration"""
    level: str = 'INFO'
    format: str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    file_path: str = 'logs/trading_bot.log'
    max_file_size: str = '10MB'
    backup_count: int = 5
    console_logging: bool = True


@dataclass
class SecurityConfig:
    """Security configuration"""
    encryption_key: Optional[str] = None
    jwt_secret: Optional[str] = None
    session_timeout: int = 3600  # 1 hour in seconds
    two_factor_enabled: bool = False
    api_key_expiry: int = 90  # days
    ip_whitelist: List[str] = field(default_factory=list)
    max_login_attempts: int = 3


class AppSettings:
    """Main application settings class"""

    def __init__(self, config_file: Optional[str] = None):
        """Initialize settings"""
        self.config_file = config_file or 'config/app_config.json'

        # Initialize configuration sections
        self.exchange = self._load_exchange_config()
        self.trading = TradingConfig()
        self.strategy = StrategyConfig()
        self.risk = RiskConfig()
        self.notifications = NotificationConfig()
        self.ui = UIConfig()
        self.database = self._load_database_config()
        self.logging = LoggingConfig()
        self.security = self._load_security_config()

        # Load custom settings if config file exists
        self._load_config_file()

    def _load_exchange_config(self) -> Dict[str, ExchangeConfig]:
        """Load exchange configurations"""
        exchanges = {}

        # Binance configuration
        exchanges['binance'] = ExchangeConfig(
            name='binance',
            api_key=os.getenv('BINANCE_API_KEY'),
            api_secret=os.getenv('BINANCE_API_SECRET'),
            testnet=os.getenv('BINANCE_TESTNET', 'true').lower() == 'true',
            rate_limit=1200,  # Binance rate limit
            fees={'maker': 0.001, 'taker': 0.001}
        )

        # Coinbase Pro configuration
        exchanges['coinbase'] = ExchangeConfig(
            name='coinbase',
            api_key=os.getenv('COINBASE_API_KEY'),
            api_secret=os.getenv('COINBASE_API_SECRET'),
            api_passphrase=os.getenv('COINBASE_PASSPHRASE'),
            testnet=os.getenv('COINBASE_TESTNET', 'true').lower() == 'true',
            rate_limit=10,  # Coinbase rate limit
            fees={'maker': 0.005, 'taker': 0.005}
        )

        # Kraken configuration
        exchanges['kraken'] = ExchangeConfig(
            name='kraken',
            api_key=os.getenv('KRAKEN_API_KEY'),
            api_secret=os.getenv('KRAKEN_API_SECRET'),
            testnet=False,  # Kraken doesn't have testnet
            rate_limit=1,  # Kraken rate limit
            fees={'maker': 0.0016, 'taker': 0.0026}
        )

        return exchanges

    def _load_database_config(self) -> DatabaseConfig:
        """Load database configuration"""
        return DatabaseConfig(
            url=os.getenv('DATABASE_URL'),
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', '5432')),
            database=os.getenv('DB_NAME', 'tradingbot'),
            username=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD')
        )

    def _load_security_config(self) -> SecurityConfig:
        """Load security configuration"""
        return SecurityConfig(
            encryption_key=os.getenv('ENCRYPTION_KEY'),
            jwt_secret=os.getenv('JWT_SECRET'),
            session_timeout=int(
                os.getenv(
                    'SESSION_TIMEOUT',
                    '3600')),
            two_factor_enabled=os.getenv(
                'TWO_FACTOR_ENABLED',
                'false').lower() == 'true')

    def _load_config_file(self):
        """Load settings from JSON config file"""
        config_path = Path(self.config_file)

        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    config_data = json.load(f)

                self._update_from_dict(config_data)

            except Exception as e:
                print(
                    f"Warning: Failed to load config file {config_path}: {e}")

    def _update_from_dict(self, config_data: Dict[str, Any]):
        """Update settings from dictionary"""
        # Update trading config
        if 'trading' in config_data:
            trading_data = config_data['trading']
            for key, value in trading_data.items():
                if hasattr(self.trading, key):
                    setattr(self.trading, key, value)

        # Update strategy config
        if 'strategy' in config_data:
            strategy_data = config_data['strategy']
            for key, value in strategy_data.items():
                if hasattr(self.strategy, key):
                    setattr(self.strategy, key, value)

        # Update risk config
        if 'risk' in config_data:
            risk_data = config_data['risk']
            for key, value in risk_data.items():
                if hasattr(self.risk, key):
                    setattr(self.risk, key, value)

        # Update notification config
        if 'notifications' in config_data:
            notif_data = config_data['notifications']
            for key, value in notif_data.items():
                if hasattr(self.notifications, key):
                    setattr(self.notifications, key, value)

        # Update UI config
        if 'ui' in config_data:
            ui_data = config_data['ui']
            for key, value in ui_data.items():
                if hasattr(self.ui, key):
                    setattr(self.ui, key, value)

    def save_config(self):
        """Save current settings to config file"""
        config_data = {
            'trading': {
                'max_position_size': self.trading.max_position_size,
                'max_daily_loss': self.trading.max_daily_loss,
                'default_stop_loss': self.trading.default_stop_loss,
                'default_take_profit': self.trading.default_take_profit,
                'default_order_type': self.trading.default_order_type,
                'default_time_in_force': self.trading.default_time_in_force,
                'post_only': self.trading.post_only,
                'reduce_only': self.trading.reduce_only,
                'slippage_tolerance': self.trading.slippage_tolerance,
                'min_order_size': self.trading.min_order_size
            },
            'strategy': {
                'active_strategies': self.strategy.active_strategies,
                'strategy_allocation': self.strategy.strategy_allocation,
                'rebalance_frequency': self.strategy.rebalance_frequency,
                'max_strategies': self.strategy.max_strategies,
                'auto_start': self.strategy.auto_start,
                'backtest_period': self.strategy.backtest_period
            },
            'risk': {
                'max_drawdown': self.risk.max_drawdown,
                'var_confidence': self.risk.var_confidence,
                'position_sizing_method': self.risk.position_sizing_method,
                'correlation_limit': self.risk.correlation_limit,
                'leverage_limit': self.risk.leverage_limit,
                'exposure_limit': self.risk.exposure_limit
            },
            'notifications': {
                'email_enabled': self.notifications.email_enabled,
                'email_address': self.notifications.email_address,
                'telegram_enabled': self.notifications.telegram_enabled,
                'discord_enabled': self.notifications.discord_enabled,
                'push_enabled': self.notifications.push_enabled,
                'notification_types': self.notifications.notification_types
            },
            'ui': {
                'theme': self.ui.theme,
                'chart_style': self.ui.chart_style,
                'auto_refresh': self.ui.auto_refresh,
                'refresh_interval': self.ui.refresh_interval,
                'decimal_places': self.ui.decimal_places,
                'date_format': self.ui.date_format,
                'timezone': self.ui.timezone,
                'sound_alerts': self.ui.sound_alerts
            }
        }

        # Create config directory if it doesn't exist
        config_path = Path(self.config_file)
        config_path.parent.mkdir(parents=True, exist_ok=True)

        # Save to file
        with open(config_path, 'w') as f:
            json.dump(config_data, f, indent=2)

    def get_exchange_config(
            self,
            exchange_name: str) -> Optional[ExchangeConfig]:
        """Get configuration for specific exchange"""
        return self.exchange.get(exchange_name.lower())

    def validate_config(self) -> List[str]:
        """Validate configuration and return list of issues"""
        issues = []

        # Validate trading config
        if self.trading.max_position_size <= 0 or self.trading.max_position_size > 1:
            issues.append("Max position size must be between 0 and 1")

        if self.trading.max_daily_loss <= 0 or self.trading.max_daily_loss > 1:
            issues.append("Max daily loss must be between 0 and 1")

        # Validate risk config
        if self.risk.max_drawdown <= 0 or self.risk.max_drawdown > 1:
            issues.append("Max drawdown must be between 0 and 1")

        if self.risk.leverage_limit < 1:
            issues.append("Leverage limit must be at least 1")

        # Validate exchange API keys for active exchanges
        for exchange_name, exchange_config in self.exchange.items():
            if not exchange_config.testnet:
                if not exchange_config.api_key or not exchange_config.api_secret:
                    issues.append(
                        f"Missing API credentials for {exchange_name}")

        return issues

    def to_dict(self) -> Dict[str, Any]:
        """Convert settings to dictionary"""
        return {
            'trading': self.trading.__dict__,
            'strategy': self.strategy.__dict__,
            'risk': self.risk.__dict__,
            'notifications': self.notifications.__dict__,
            'ui': self.ui.__dict__,
            'database': self.database.__dict__,
            'logging': self.logging.__dict__,
            'security': self.security.__dict__
        }


# Global settings instance
settings = AppSettings()

# Environment-specific settings
DEVELOPMENT = os.getenv('ENVIRONMENT', 'development') == 'development'
TESTING = os.getenv('ENVIRONMENT') == 'testing'
PRODUCTION = os.getenv('ENVIRONMENT') == 'production'

# API endpoints
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')
WEBSOCKET_URL = os.getenv('WEBSOCKET_URL', 'ws://localhost:8000/ws')

# Feature flags
FEATURES = {
    'paper_trading': True,
    'live_trading': PRODUCTION,
    'backtesting': True,
    'strategy_optimization': True,
    'risk_management': True,
    'notifications': True,
    'analytics': True,
    'portfolio_management': True
}

# Market data providers
MARKET_DATA_PROVIDERS = {
    'primary': os.getenv('PRIMARY_DATA_PROVIDER', 'binance'),
    'backup': os.getenv('BACKUP_DATA_PROVIDER', 'coinbase'),
    'news': os.getenv('NEWS_PROVIDER', 'polygon'),
    'fundamental': os.getenv('FUNDAMENTAL_PROVIDER', 'alpha_vantage')
}

# Cache settings
CACHE_SETTINGS = {
    'redis_url': os.getenv('REDIS_URL', 'redis://localhost:6379'),
    'default_timeout': 300,  # 5 minutes
    'market_data_timeout': 60,  # 1 minute
    'portfolio_timeout': 30  # 30 seconds
}
