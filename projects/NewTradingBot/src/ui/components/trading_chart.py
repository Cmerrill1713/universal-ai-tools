"""
Interactive Trading Chart Component
Provides real-time candlestick charts with technical indicators
"""

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import asyncio

from ..utils.chart_utils import ChartBuilder, ChartDataProcessor
from ..utils.theme import TradingTheme
from ..utils.formatters import DataFormatter


class TradingChart:
    """Interactive trading chart component"""
    
    def __init__(self, container=None):
        """Initialize trading chart component"""
        self.container = container or st
        self.chart_builder = ChartBuilder()
        self.data_processor = ChartDataProcessor()
        self.formatter = DataFormatter()
        
        # Initialize session state
        if 'chart_settings' not in st.session_state:
            st.session_state.chart_settings = {
                'timeframe': '1h',
                'chart_type': 'candlestick',
                'indicators': [],
                'show_volume': True,
                'theme': 'dark',
                'auto_refresh': False,
                'refresh_interval': 5
            }
        
        if 'price_data' not in st.session_state:
            st.session_state.price_data = pd.DataFrame()
    
    def render(self, symbol: str, exchange: str = 'binance'):
        """Render the trading chart component"""
        # Chart header with controls
        self._render_chart_header(symbol, exchange)
        
        # Main chart area
        chart_container = self.container.container()
        
        with chart_container:
            if st.session_state.price_data.empty:
                self._render_loading_state()
            else:
                self._render_chart()
        
        # Chart footer with info
        self._render_chart_footer()
        
        # Auto-refresh logic
        if st.session_state.chart_settings['auto_refresh']:
            self._setup_auto_refresh(symbol, exchange)
    
    def _render_chart_header(self, symbol: str, exchange: str):
        """Render chart header with controls"""
        col1, col2, col3, col4, col5 = self.container.columns([2, 1, 1, 1, 1])
        
        with col1:
            st.markdown(f"### {symbol} - {exchange.upper()}")
            if not st.session_state.price_data.empty:
                current_price = st.session_state.price_data['close'].iloc[-1]
                prev_price = st.session_state.price_data['close'].iloc[-2] if len(st.session_state.price_data) > 1 else current_price
                change = current_price - prev_price
                change_pct = (change / prev_price) * 100 if prev_price != 0 else 0
                
                color = "green" if change >= 0 else "red"
                arrow = "↑" if change >= 0 else "↓"
                
                st.markdown(
                    f"<h2 style='color: {color};'>${current_price:.2f} "
                    f"<small>{arrow} ${abs(change):.2f} ({change_pct:+.2f}%)</small></h2>",
                    unsafe_allow_html=True
                )
        
        with col2:
            timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']
            st.session_state.chart_settings['timeframe'] = st.selectbox(
                "Timeframe",
                timeframes,
                index=timeframes.index(st.session_state.chart_settings['timeframe'])
            )
        
        with col3:
            chart_types = ['candlestick', 'line', 'area', 'bars']
            st.session_state.chart_settings['chart_type'] = st.selectbox(
                "Chart Type",
                chart_types,
                index=chart_types.index(st.session_state.chart_settings['chart_type'])
            )
        
        with col4:
            st.session_state.chart_settings['show_volume'] = st.checkbox(
                "Volume",
                value=st.session_state.chart_settings['show_volume']
            )
        
        with col5:
            st.session_state.chart_settings['auto_refresh'] = st.checkbox(
                "Auto Refresh",
                value=st.session_state.chart_settings['auto_refresh']
            )
    
    def _render_chart(self):
        """Render the main chart"""
        df = st.session_state.price_data
        
        # Create chart based on type
        if st.session_state.chart_settings['chart_type'] == 'candlestick':
            fig = self.chart_builder.create_candlestick_chart(
                df,
                title="",
                volume=st.session_state.chart_settings['show_volume'],
                indicators=st.session_state.chart_settings['indicators'],
                theme=st.session_state.chart_settings['theme']
            )
        elif st.session_state.chart_settings['chart_type'] == 'line':
            fig = self._create_line_chart(df)
        elif st.session_state.chart_settings['chart_type'] == 'area':
            fig = self._create_area_chart(df)
        else:
            fig = self._create_bar_chart(df)
        
        # Add trading annotations
        self._add_trading_annotations(fig)
        
        # Display chart
        st.plotly_chart(fig, use_container_width=True, key="main_chart")
    
    def _render_chart_footer(self):
        """Render chart footer with technical indicators"""
        with st.expander("Technical Indicators", expanded=False):
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.subheader("Moving Averages")
                sma_periods = st.multiselect(
                    "SMA Periods",
                    [5, 10, 20, 50, 100, 200],
                    default=[20, 50]
                )
                ema_periods = st.multiselect(
                    "EMA Periods",
                    [5, 10, 20, 50, 100, 200],
                    default=[]
                )
            
            with col2:
                st.subheader("Oscillators")
                show_rsi = st.checkbox("RSI (14)", value=False)
                show_macd = st.checkbox("MACD", value=False)
                show_stoch = st.checkbox("Stochastic", value=False)
            
            with col3:
                st.subheader("Other")
                show_bb = st.checkbox("Bollinger Bands", value=False)
                show_vwap = st.checkbox("VWAP", value=False)
                show_pivot = st.checkbox("Pivot Points", value=False)
            
            # Update indicators
            self._update_indicators(
                sma_periods, ema_periods, show_rsi, show_macd,
                show_stoch, show_bb, show_vwap, show_pivot
            )
    
    def _render_loading_state(self):
        """Render loading state"""
        with st.spinner("Loading chart data..."):
            # Simulate loading
            progress_bar = st.progress(0)
            for i in range(100):
                progress_bar.progress(i + 1)
                asyncio.sleep(0.01)
            
            # Load sample data for demo
            self._load_sample_data()
    
    def _create_line_chart(self, df: pd.DataFrame) -> go.Figure:
        """Create line chart"""
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=df['time'],
            y=df['close'],
            mode='lines',
            name='Price',
            line=dict(color='#1E88E5', width=2)
        ))
        
        if st.session_state.chart_settings['show_volume']:
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                vertical_spacing=0.03,
                row_heights=[0.7, 0.3]
            )
            
            fig.add_trace(
                go.Scatter(
                    x=df['time'],
                    y=df['close'],
                    mode='lines',
                    name='Price',
                    line=dict(color='#1E88E5', width=2)
                ),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Bar(
                    x=df['time'],
                    y=df['volume'],
                    name='Volume',
                    marker_color='#42A5F5',
                    opacity=0.5
                ),
                row=2, col=1
            )
        
        self.chart_builder._apply_theme(fig, st.session_state.chart_settings['theme'])
        return fig
    
    def _create_area_chart(self, df: pd.DataFrame) -> go.Figure:
        """Create area chart"""
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=df['time'],
            y=df['close'],
            mode='lines',
            name='Price',
            line=dict(color='#1E88E5', width=2),
            fill='tozeroy',
            fillcolor='rgba(30, 136, 229, 0.2)'
        ))
        
        self.chart_builder._apply_theme(fig, st.session_state.chart_settings['theme'])
        return fig
    
    def _create_bar_chart(self, df: pd.DataFrame) -> go.Figure:
        """Create bar chart"""
        colors = ['#4CAF50' if close >= open else '#F44336' 
                 for close, open in zip(df['close'], df['open'])]
        
        fig = go.Figure()
        
        fig.add_trace(go.Bar(
            x=df['time'],
            y=df['close'] - df['open'],
            name='Price Change',
            marker_color=colors,
            base=df['open']
        ))
        
        self.chart_builder._apply_theme(fig, st.session_state.chart_settings['theme'])
        return fig
    
    def _add_trading_annotations(self, fig: go.Figure):
        """Add trading annotations to chart"""
        # Add support/resistance lines
        if not st.session_state.price_data.empty:
            df = st.session_state.price_data
            
            # Calculate support and resistance
            high = df['high'].max()
            low = df['low'].min()
            
            # Add horizontal lines
            fig.add_hline(
                y=high,
                line_dash="dash",
                line_color="red",
                annotation_text=f"Resistance: ${high:.2f}"
            )
            
            fig.add_hline(
                y=low,
                line_dash="dash",
                line_color="green",
                annotation_text=f"Support: ${low:.2f}"
            )
    
    def _update_indicators(self, sma_periods, ema_periods, show_rsi, 
                          show_macd, show_stoch, show_bb, show_vwap, show_pivot):
        """Update chart indicators"""
        indicators = []
        
        for period in sma_periods:
            indicators.append({'type': 'sma', 'period': period})
        
        for period in ema_periods:
            indicators.append({'type': 'ema', 'period': period})
        
        if show_bb:
            indicators.append({'type': 'bollinger', 'period': 20, 'std_dev': 2})
        
        st.session_state.chart_settings['indicators'] = indicators
    
    def _setup_auto_refresh(self, symbol: str, exchange: str):
        """Setup auto refresh for chart"""
        refresh_interval = st.session_state.chart_settings['refresh_interval']
        
        # Use Streamlit's native rerun for refresh
        if 'last_refresh' not in st.session_state:
            st.session_state.last_refresh = datetime.now()
        
        if (datetime.now() - st.session_state.last_refresh).seconds >= refresh_interval:
            self._refresh_data(symbol, exchange)
            st.session_state.last_refresh = datetime.now()
            st.rerun()
    
    def _refresh_data(self, symbol: str, exchange: str):
        """Refresh chart data"""
        # In production, this would fetch real data from exchange
        # For now, we'll update the sample data
        if not st.session_state.price_data.empty:
            df = st.session_state.price_data
            
            # Simulate price movement
            last_price = df['close'].iloc[-1]
            change = np.random.normal(0, last_price * 0.001)
            new_price = last_price + change
            
            new_row = {
                'time': datetime.now(),
                'open': last_price,
                'high': max(last_price, new_price) * 1.001,
                'low': min(last_price, new_price) * 0.999,
                'close': new_price,
                'volume': np.random.uniform(100, 1000)
            }
            
            st.session_state.price_data = pd.concat([
                df.iloc[-999:],  # Keep last 1000 points
                pd.DataFrame([new_row])
            ], ignore_index=True)
    
    def _load_sample_data(self):
        """Load sample data for demonstration"""
        # Generate sample OHLCV data
        periods = 1000
        start_time = datetime.now() - timedelta(hours=periods)
        
        times = pd.date_range(start=start_time, periods=periods, freq='1h')
        prices = 100 + np.cumsum(np.random.randn(periods) * 0.5)
        
        data = []
        for i, (time, price) in enumerate(zip(times, prices)):
            high = price * np.random.uniform(1.001, 1.01)
            low = price * np.random.uniform(0.99, 0.999)
            close = np.random.uniform(low, high)
            open_price = prices[i-1] if i > 0 else price
            
            data.append({
                'time': time,
                'open': open_price,
                'high': high,
                'low': low,
                'close': close,
                'volume': np.random.uniform(1000, 10000)
            })
        
        st.session_state.price_data = pd.DataFrame(data)


class MiniChart:
    """Compact chart for sidebar or small spaces"""
    
    @staticmethod
    def render_sparkline(data: List[float], title: str = "", color: str = "#1E88E5"):
        """Render a sparkline chart"""
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            y=data,
            mode='lines',
            line=dict(color=color, width=1),
            fill='tozeroy',
            fillcolor=f'rgba({int(color[1:3], 16)}, {int(color[3:5], 16)}, {int(color[5:7], 16)}, 0.1)',
            showlegend=False
        ))
        
        fig.update_layout(
            height=60,
            margin=dict(l=0, r=0, t=0, b=0),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis=dict(visible=False),
            yaxis=dict(visible=False),
            hovermode=False
        )
        
        if title:
            st.markdown(f"**{title}**")
        
        st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})