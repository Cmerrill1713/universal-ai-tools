"""
Chart Utilities for Trading Visualization
Provides helper functions for creating interactive trading charts
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots


class ChartBuilder:
    """Builder class for creating trading charts"""

    @staticmethod
    def create_candlestick_chart(
        df: pd.DataFrame,
        title: str = "Price Chart",
        volume: bool = True,
        indicators: Optional[List[Dict[str, Any]]] = None,
        theme: str = 'dark'
    ) -> go.Figure:
        """
        Create a candlestick chart with optional volume and indicators

        Args:
            df: DataFrame with columns: time, open, high, low, close, volume
            title: Chart title
            volume: Whether to show volume subplot
            indicators: List of indicators to add
            theme: Chart theme ('dark' or 'light')
        """
        # Create subplots
        rows = 2 if volume else 1
        row_heights = [0.7, 0.3] if volume else [1.0]

        fig = make_subplots(
            rows=rows, cols=1,
            shared_xaxes=True,
            vertical_spacing=0.03,
            row_heights=row_heights,
            subplot_titles=(title, "Volume") if volume else (title,)
        )

        # Add candlestick chart
        fig.add_trace(
            go.Candlestick(
                x=df['time'],
                open=df['open'],
                high=df['high'],
                low=df['low'],
                close=df['close'],
                name='Price',
                increasing=dict(line=dict(color='#26A69A')),
                decreasing=dict(line=dict(color='#EF5350'))
            ),
            row=1, col=1
        )

        # Add volume bars if requested
        if volume and 'volume' in df.columns:
            colors = ['#26A69A' if close >= open else '#EF5350'
                      for close, open in zip(df['close'], df['open'])]

            fig.add_trace(
                go.Bar(
                    x=df['time'],
                    y=df['volume'],
                    name='Volume',
                    marker_color=colors,
                    opacity=0.5
                ),
                row=2, col=1
            )

        # Add indicators
        if indicators:
            for indicator in indicators:
                ChartBuilder._add_indicator(fig, df, indicator)

        # Update layout
        ChartBuilder._apply_theme(fig, theme)

        # Update axes
        fig.update_xaxes(rangeslider_visible=False)
        fig.update_yaxes(title_text="Price", row=1, col=1)
        if volume:
            fig.update_yaxes(title_text="Volume", row=2, col=1)

        return fig

    @staticmethod
    def create_line_chart(
        data: Dict[str, List],
        title: str = "Line Chart",
        x_label: str = "Time",
        y_label: str = "Value",
        theme: str = 'dark'
    ) -> go.Figure:
        """Create a multi-line chart"""
        fig = go.Figure()

        colors = [
            '#1E88E5',
            '#FFC107',
            '#4CAF50',
            '#F44336',
            '#9C27B0',
            '#00BCD4']

        for i, (name, values) in enumerate(data.items()):
            color = colors[i % len(colors)]
            fig.add_trace(
                go.Scatter(
                    y=values,
                    mode='lines',
                    name=name,
                    line=dict(color=color, width=2)
                )
            )

        fig.update_layout(
            title=title,
            xaxis_title=x_label,
            yaxis_title=y_label,
            hovermode='x unified'
        )

        ChartBuilder._apply_theme(fig, theme)
        return fig

    @staticmethod
    def create_portfolio_pie_chart(
        positions: List[Dict[str, Any]],
        theme: str = 'dark'
    ) -> go.Figure:
        """Create portfolio allocation pie chart"""
        if not positions:
            return ChartBuilder._create_empty_chart("No positions to display")

        labels = [pos['symbol'] for pos in positions]
        values = [abs(pos['value']) for pos in positions]

        fig = go.Figure(data=[
            go.Pie(
                labels=labels,
                values=values,
                hole=0.3,
                marker=dict(
                    colors=['#1E88E5', '#FFC107', '#4CAF50', '#F44336',
                            '#9C27B0', '#00BCD4', '#FF5722', '#795548']
                ),
                textinfo='label+percent',
                textposition='auto'
            )
        ])

        fig.update_layout(
            title="Portfolio Allocation",
            showlegend=True
        )

        ChartBuilder._apply_theme(fig, theme)
        return fig

    @staticmethod
    def create_pnl_chart(
        pnl_data: pd.DataFrame,
        title: str = "P&L Over Time",
        theme: str = 'dark'
    ) -> go.Figure:
        """Create P&L chart with cumulative and daily views"""
        fig = make_subplots(
            rows=2, cols=1,
            shared_xaxes=True,
            vertical_spacing=0.03,
            row_heights=[0.7, 0.3],
            subplot_titles=("Cumulative P&L", "Daily P&L")
        )

        # Cumulative P&L
        fig.add_trace(
            go.Scatter(
                x=pnl_data.index,
                y=pnl_data['cumulative_pnl'],
                mode='lines',
                name='Cumulative P&L',
                line=dict(color='#1E88E5', width=2),
                fill='tozeroy',
                fillcolor='rgba(30, 136, 229, 0.1)'
            ),
            row=1, col=1
        )

        # Daily P&L bars
        colors = ['#4CAF50' if val >= 0 else '#F44336'
                  for val in pnl_data['daily_pnl']]

        fig.add_trace(
            go.Bar(
                x=pnl_data.index,
                y=pnl_data['daily_pnl'],
                name='Daily P&L',
                marker_color=colors
            ),
            row=2, col=1
        )

        fig.update_layout(title=title, showlegend=True)
        ChartBuilder._apply_theme(fig, theme)

        return fig

    @staticmethod
    def create_heatmap(
        data: pd.DataFrame,
        title: str = "Correlation Heatmap",
        theme: str = 'dark'
    ) -> go.Figure:
        """Create a correlation heatmap"""
        fig = go.Figure(data=go.Heatmap(
            z=data.values,
            x=data.columns,
            y=data.index,
            colorscale='RdBu',
            zmid=0,
            text=data.values,
            texttemplate='%{text:.2f}',
            textfont={"size": 10},
            colorbar=dict(title="Correlation")
        ))

        fig.update_layout(
            title=title,
            xaxis=dict(side="bottom"),
            yaxis=dict(side="left")
        )

        ChartBuilder._apply_theme(fig, theme)
        return fig

    @staticmethod
    def create_risk_gauge(
        risk_score: float,
        title: str = "Risk Level",
        theme: str = 'dark'
    ) -> go.Figure:
        """Create a risk gauge chart"""
        # Determine color based on risk level
        if risk_score < 0.3:
            color = '#4CAF50'
        elif risk_score < 0.7:
            color = '#FFC107'
        else:
            color = '#F44336'

        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=risk_score * 100,
            title={'text': title},
            domain={'x': [0, 1], 'y': [0, 1]},
            gauge={
                'axis': {'range': [None, 100]},
                'bar': {'color': color},
                'steps': [
                    {'range': [0, 30], 'color': "rgba(76, 175, 80, 0.1)"},
                    {'range': [30, 70], 'color': "rgba(255, 193, 7, 0.1)"},
                    {'range': [70, 100], 'color': "rgba(244, 67, 54, 0.1)"}
                ],
                'threshold': {
                    'line': {'color': "red", 'width': 4},
                    'thickness': 0.75,
                    'value': 90
                }
            }
        ))

        ChartBuilder._apply_theme(fig, theme)
        return fig

    @staticmethod
    def _add_indicator(fig: go.Figure, df: pd.DataFrame,
                       indicator: Dict[str, Any]):
        """Add technical indicator to chart"""
        indicator_type = indicator.get('type')

        if indicator_type == 'sma':
            period = indicator.get('period', 20)
            if len(df) >= period:
                sma = df['close'].rolling(window=period).mean()
                fig.add_trace(
                    go.Scatter(
                        x=df['time'],
                        y=sma,
                        mode='lines',
                        name=f'SMA({period})',
                        line=dict(color='#FFC107', width=1)
                    ),
                    row=1, col=1
                )

        elif indicator_type == 'ema':
            period = indicator.get('period', 20)
            if len(df) >= period:
                ema = df['close'].ewm(span=period, adjust=False).mean()
                fig.add_trace(
                    go.Scatter(
                        x=df['time'],
                        y=ema,
                        mode='lines',
                        name=f'EMA({period})',
                        line=dict(color='#9C27B0', width=1)
                    ),
                    row=1, col=1
                )

        elif indicator_type == 'bollinger':
            period = indicator.get('period', 20)
            std_dev = indicator.get('std_dev', 2)
            if len(df) >= period:
                sma = df['close'].rolling(window=period).mean()
                std = df['close'].rolling(window=period).std()
                upper = sma + (std * std_dev)
                lower = sma - (std * std_dev)

                fig.add_trace(
                    go.Scatter(
                        x=df['time'],
                        y=upper,
                        mode='lines',
                        name=f'BB Upper',
                        line=dict(color='rgba(128, 128, 128, 0.5)', width=1)
                    ),
                    row=1, col=1
                )

                fig.add_trace(
                    go.Scatter(
                        x=df['time'],
                        y=lower,
                        mode='lines',
                        name=f'BB Lower',
                        line=dict(color='rgba(128, 128, 128, 0.5)', width=1),
                        fill='tonexty',
                        fillcolor='rgba(128, 128, 128, 0.1)'
                    ),
                    row=1, col=1
                )

    @staticmethod
    def _apply_theme(fig: go.Figure, theme: str):
        """Apply theme to figure"""
        if theme == 'dark':
            fig.update_layout(
                paper_bgcolor='#0E1117',
                plot_bgcolor='#1A1B21',
                font=dict(color='#E0E0E0'),
                xaxis=dict(gridcolor='#2D2D2D', showgrid=True),
                yaxis=dict(gridcolor='#2D2D2D', showgrid=True),
                hovermode='x unified'
            )
        else:
            fig.update_layout(
                paper_bgcolor='#FFFFFF',
                plot_bgcolor='#F5F5F5',
                font=dict(color='#333333'),
                xaxis=dict(gridcolor='#E0E0E0', showgrid=True),
                yaxis=dict(gridcolor='#E0E0E0', showgrid=True),
                hovermode='x unified'
            )

        fig.update_layout(
            margin=dict(l=10, r=10, t=50, b=10),
            height=500
        )

    @staticmethod
    def _create_empty_chart(message: str, theme: str = 'dark') -> go.Figure:
        """Create an empty chart with a message"""
        fig = go.Figure()
        fig.add_annotation(
            text=message,
            xref="paper",
            yref="paper",
            x=0.5,
            y=0.5,
            showarrow=False,
            font=dict(size=20, color='#808080')
        )
        ChartBuilder._apply_theme(fig, theme)
        return fig


class ChartDataProcessor:
    """Process data for charting"""

    @staticmethod
    def prepare_ohlcv_data(raw_data: List[Dict]) -> pd.DataFrame:
        """Prepare OHLCV data for charting"""
        df = pd.DataFrame(raw_data)

        # Ensure required columns
        required_columns = ['time', 'open', 'high', 'low', 'close', 'volume']
        for col in required_columns:
            if col not in df.columns:
                if col == 'time':
                    df['time'] = pd.date_range(
                        start='now', periods=len(df), freq='1min')
                else:
                    df[col] = 0

        # Convert time to datetime if needed
        if not pd.api.types.is_datetime64_any_dtype(df['time']):
            df['time'] = pd.to_datetime(df['time'])

        # Sort by time
        df = df.sort_values('time')

        return df

    @staticmethod
    def calculate_returns(prices: pd.Series) -> pd.Series:
        """Calculate returns from price series"""
        return prices.pct_change()

    @staticmethod
    def calculate_cumulative_returns(returns: pd.Series) -> pd.Series:
        """Calculate cumulative returns"""
        return (1 + returns).cumprod() - 1

    @staticmethod
    def resample_ohlcv(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
        """Resample OHLCV data to different timeframe"""
        df = df.set_index('time')

        resampled = df.resample(timeframe).agg({
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        })

        return resampled.dropna().reset_index()
