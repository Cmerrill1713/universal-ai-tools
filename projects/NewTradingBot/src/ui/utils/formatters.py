"""
Data Formatting Utilities
Provides consistent formatting for various data types in the trading application
"""

from datetime import datetime, timedelta
from typing import Any, List, Optional, Union

import numpy as np
import pandas as pd


class DataFormatter:
    """Handles data formatting for display"""

    @staticmethod
    def format_currency(
            value: float,
            currency: str = 'USD',
            decimals: int = 2) -> str:
        """Format value as currency"""
        symbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'BTC': '₿',
            'ETH': 'Ξ',
        }

        symbol = symbols.get(currency, currency + ' ')

        if currency in ['BTC', 'ETH']:
            # Crypto currencies need more decimals
            decimals = max(decimals, 8)

        formatted = f"{value:,.{decimals}f}"
        return f"{symbol}{formatted}"

    @staticmethod
    def format_percentage(
            value: float,
            decimals: int = 2,
            show_sign: bool = True) -> str:
        """Format value as percentage"""
        formatted = f"{value:.{decimals}f}%"

        if show_sign and value > 0:
            formatted = f"+{formatted}"

        return formatted

    @staticmethod
    def format_number(
            value: float,
            decimals: int = 2,
            use_suffix: bool = True) -> str:
        """Format large numbers with K, M, B suffixes"""
        if not use_suffix:
            return f"{value:,.{decimals}f}"

        abs_value = abs(value)
        sign = '-' if value < 0 else ''

        if abs_value >= 1e9:
            return f"{sign}{abs_value / 1e9:.{decimals}f}B"
        elif abs_value >= 1e6:
            return f"{sign}{abs_value / 1e6:.{decimals}f}M"
        elif abs_value >= 1e3:
            return f"{sign}{abs_value / 1e3:.{decimals}f}K"
        else:
            return f"{sign}{abs_value:.{decimals}f}"

    @staticmethod
    def format_timestamp(timestamp: Union[datetime, str, int],
                         format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
        """Format timestamp for display"""
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp)
            except BaseException:
                return timestamp
        elif isinstance(timestamp, (int, float)):
            timestamp = datetime.fromtimestamp(timestamp)

        if isinstance(timestamp, datetime):
            return timestamp.strftime(format_str)

        return str(timestamp)

    @staticmethod
    def format_duration(seconds: Union[int, float]) -> str:
        """Format duration in human-readable format"""
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            secs = int(seconds % 60)
            return f"{minutes}m {secs}s"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}h {minutes}m"
        else:
            days = int(seconds / 86400)
            hours = int((seconds % 86400) / 3600)
            return f"{days}d {hours}h"

    @staticmethod
    def format_price(price: float, tick_size: float = 0.01) -> str:
        """Format price according to tick size"""
        # Calculate decimal places based on tick size
        if tick_size >= 1:
            decimals = 0
        else:
            decimals = len(str(tick_size).split('.')[-1])

        return f"{price:.{decimals}f}"

    @staticmethod
    def format_volume(volume: float, asset_type: str = 'stock') -> str:
        """Format trading volume"""
        if asset_type == 'crypto':
            if volume >= 1e6:
                return f"{volume / 1e6:.2f}M"
            elif volume >= 1e3:
                return f"{volume / 1e3:.2f}K"
            else:
                return f"{volume:.4f}"
        else:
            return DataFormatter.format_number(volume, decimals=0)

    @staticmethod
    def format_order_side(side: str) -> str:
        """Format order side with color coding"""
        if side.upper() == 'BUY':
            return '<span style="color: #4CAF50; font-weight: bold;">BUY</span>'
        elif side.upper() == 'SELL':
            return '<span style="color: #F44336; font-weight: bold;">SELL</span>'
        else:
            return side

    @staticmethod
    def format_risk_level(risk_score: float) -> str:
        """Format risk level with appropriate styling"""
        if risk_score < 0.3:
            level = 'LOW'
            color = '#4CAF50'
        elif risk_score < 0.7:
            level = 'MEDIUM'
            color = '#FF9800'
        else:
            level = 'HIGH'
            color = '#F44336'

        return f'<span style="background-color: {color}; color: white; padding: 2px 8px; border-radius: 4px;">{level}</span>'

    @staticmethod
    def format_dataframe(
            df: pd.DataFrame,
            column_formats: Optional[dict] = None) -> pd.DataFrame:
        """Apply formatting to dataframe columns"""
        if column_formats is None:
            return df

        formatted_df = df.copy()

        for column, format_type in column_formats.items():
            if column not in formatted_df.columns:
                continue

            if format_type == 'currency':
                formatted_df[column] = formatted_df[column].apply(
                    lambda x: DataFormatter.format_currency(x) if pd.notna(x) else '')
            elif format_type == 'percentage':
                formatted_df[column] = formatted_df[column].apply(
                    lambda x: DataFormatter.format_percentage(x) if pd.notna(x) else '')
            elif format_type == 'number':
                formatted_df[column] = formatted_df[column].apply(
                    lambda x: DataFormatter.format_number(x) if pd.notna(x) else '')
            elif format_type == 'timestamp':
                formatted_df[column] = formatted_df[column].apply(
                    lambda x: DataFormatter.format_timestamp(x) if pd.notna(x) else '')

        return formatted_df

    @staticmethod
    def color_negative_red(val):
        """Color negative values red for dataframe styling"""
        if isinstance(val, (int, float)):
            color = 'red' if val < 0 else 'green'
            return f'color: {color}'
        return ''

    @staticmethod
    def highlight_max(s):
        """Highlight maximum value in a series"""
        is_max = s == s.max()
        return [
            'background-color: rgba(76, 175, 80, 0.3)' if v else '' for v in is_max]

    @staticmethod
    def highlight_min(s):
        """Highlight minimum value in a series"""
        is_min = s == s.min()
        return [
            'background-color: rgba(244, 67, 54, 0.3)' if v else '' for v in is_min]


class TableFormatter:
    """Specialized formatter for tables"""

    @staticmethod
    def format_trades_table(trades: List[dict]) -> pd.DataFrame:
        """Format trades data for display"""
        df = pd.DataFrame(trades)

        if df.empty:
            return df

        # Apply column formatting
        format_mapping = {
            'price': 'currency',
            'quantity': 'number',
            'value': 'currency',
            'pnl': 'currency',
            'pnl_percentage': 'percentage',
            'timestamp': 'timestamp',
        }

        return DataFormatter.format_dataframe(df, format_mapping)

    @staticmethod
    def format_positions_table(positions: List[dict]) -> pd.DataFrame:
        """Format positions data for display"""
        df = pd.DataFrame(positions)

        if df.empty:
            return df

        # Calculate additional metrics
        if 'current_price' in df.columns and 'entry_price' in df.columns:
            df['pnl'] = (df['current_price'] - df['entry_price']
                         ) * df.get('quantity', 1)
            df['pnl_percentage'] = (
                (df['current_price'] / df['entry_price']) - 1) * 100

        # Apply column formatting
        format_mapping = {
            'entry_price': 'currency',
            'current_price': 'currency',
            'quantity': 'number',
            'value': 'currency',
            'pnl': 'currency',
            'pnl_percentage': 'percentage',
        }

        return DataFormatter.format_dataframe(df, format_mapping)

    @staticmethod
    def format_orders_table(orders: List[dict]) -> pd.DataFrame:
        """Format orders data for display"""
        df = pd.DataFrame(orders)

        if df.empty:
            return df

        # Apply column formatting
        format_mapping = {
            'price': 'currency',
            'quantity': 'number',
            'filled_quantity': 'number',
            'remaining_quantity': 'number',
            'timestamp': 'timestamp',
        }

        return DataFormatter.format_dataframe(df, format_mapping)


class MetricsFormatter:
    """Format metrics for display"""

    @staticmethod
    def format_portfolio_metrics(metrics: dict) -> dict:
        """Format portfolio metrics"""
        formatted = {}

        # Format currency values
        currency_fields = [
            'total_value',
            'cash_balance',
            'positions_value',
            'daily_pnl',
            'total_pnl',
            'realized_pnl',
            'unrealized_pnl']

        for field in currency_fields:
            if field in metrics:
                formatted[field] = DataFormatter.format_currency(
                    metrics[field])

        # Format percentage values
        percentage_fields = [
            'daily_return',
            'total_return',
            'win_rate',
            'sharpe_ratio']

        for field in percentage_fields:
            if field in metrics:
                formatted[field] = DataFormatter.format_percentage(
                    metrics[field])

        # Format number values
        number_fields = [
            'total_trades',
            'winning_trades',
            'losing_trades',
            'open_positions']

        for field in number_fields:
            if field in metrics:
                formatted[field] = DataFormatter.format_number(
                    metrics[field], decimals=0, use_suffix=False)

        return formatted

    @staticmethod
    def format_risk_metrics(metrics: dict) -> dict:
        """Format risk metrics"""
        formatted = {}

        # Format currency values
        if 'value_at_risk' in metrics:
            formatted['value_at_risk'] = DataFormatter.format_currency(
                metrics['value_at_risk'])

        if 'max_drawdown' in metrics:
            formatted['max_drawdown'] = DataFormatter.format_percentage(
                metrics['max_drawdown'])

        if 'exposure' in metrics:
            formatted['exposure'] = DataFormatter.format_percentage(
                metrics['exposure'])

        if 'leverage' in metrics:
            formatted['leverage'] = f"{metrics['leverage']:.2f}x"

        return formatted
