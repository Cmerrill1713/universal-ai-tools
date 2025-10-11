"""
Main Trading Dashboard Page
Central hub for trading operations and monitoring
"""

from datetime import datetime
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import streamlit as st

from ..components.order_form import OrderForm
from ..components.portfolio_view import PortfolioView
from ..components.trading_chart import MiniChart, TradingChart
from ..utils.formatters import DataFormatter, MetricsFormatter
from ..utils.theme import TradingTheme


class DashboardPage:
    """Main trading dashboard page"""

    def __init__(self):
        """Initialize dashboard page"""
        self.trading_chart = TradingChart()
        self.order_form = OrderForm(on_submit=self._handle_order_submission)
        self.portfolio_view = PortfolioView()
        self.formatter = DataFormatter()
        self.metrics_formatter = MetricsFormatter()

        # Initialize session state
        if 'dashboard' not in st.session_state:
            st.session_state.dashboard = {
                'selected_symbol': 'BTC/USDT',
                'selected_exchange': 'binance',
                'watchlist': ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
                'active_strategies': [],
                'notifications': [],
                'market_overview': {}
            }

    def render(self):
        """Render the dashboard page"""
        # Apply theme
        TradingTheme.apply_theme()

        # Page header
        self._render_header()

        # Market overview bar
        self._render_market_overview()

        # Main dashboard layout
        col1, col2 = st.columns([2, 1])

        with col1:
            # Trading chart
            self._render_trading_section()

            # Active orders and positions
            self._render_active_orders()

        with col2:
            # Order form
            self._render_order_section()

            # Watchlist
            self._render_watchlist()

            # Active strategies
            self._render_active_strategies()

        # Bottom section with tabs
        self._render_bottom_section()

        # Notifications
        self._render_notifications()

    def _render_header(self):
        """Render dashboard header"""
        col1, col2, col3 = st.columns([3, 1, 1])

        with col1:
            st.markdown("# 🚀 Trading Dashboard")
            st.caption(
                f"Connected to: {
                    st.session_state.dashboard['selected_exchange'].upper()} | " f"Last update: {
                    datetime.now().strftime('%H:%M:%S')}")

        with col2:
            # Connection status
            status = "🟢 Connected"
            st.markdown(f"### {status}")

        with col3:
            # Quick actions
            if st.button("⚙️ Settings", use_container_width=True):
                st.switch_page("pages/settings.py")

    def _render_market_overview(self):
        """Render market overview bar"""
        # Get market data (sample data for demo)
        market_data = self._get_market_overview_data()

        # Create columns for each market indicator
        cols = st.columns(len(market_data))

        for col, (symbol, data) in zip(cols, market_data.items()):
            with col:
                change = data['change']
                color = "green" if change >= 0 else "red"
                arrow = "↑" if change >= 0 else "↓"

                st.markdown(
                    f"""
                    <div style="text-align: center; padding: 10px;
                                background-color: rgba(26, 27, 33, 0.5);
                                border-radius: 5px;">
                        <small style="color: #B0B0B0;">{symbol}</small><br>
                        <strong style="color: {color};">
                            ${data['price']:,.2f} {arrow} {abs(change):.2f}%
                        </strong>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

        st.divider()

    def _render_trading_section(self):
        """Render main trading chart section"""
        with st.container():
            # Symbol selector
            col1, col2, col3 = st.columns([2, 1, 1])

            with col1:
                symbols = [
                    'BTC/USDT',
                    'ETH/USDT',
                    'SOL/USDT',
                    'BNB/USDT',
                    'ADA/USDT']
                st.session_state.dashboard['selected_symbol'] = st.selectbox(
                    "Symbol", symbols, index=symbols.index(
                        st.session_state.dashboard['selected_symbol']), label_visibility="collapsed")

            with col2:
                exchanges = ['binance', 'coinbase', 'kraken', 'ftx']
                st.session_state.dashboard['selected_exchange'] = st.selectbox(
                    "Exchange", exchanges, index=exchanges.index(
                        st.session_state.dashboard['selected_exchange']), label_visibility="collapsed")

            with col3:
                if st.button("🔍 Analysis", use_container_width=True):
                    st.switch_page("pages/analytics.py")

            # Trading chart
            self.trading_chart.render(
                st.session_state.dashboard['selected_symbol'],
                st.session_state.dashboard['selected_exchange']
            )

    def _render_order_section(self):
        """Render order entry section"""
        with st.container():
            # Get current market data
            current_price = self._get_current_price(
                st.session_state.dashboard['selected_symbol'])
            available_balance = self._get_available_balance()

            # Render order form
            self.order_form.render(
                available_balance=available_balance,
                current_price=current_price
            )

    def _render_watchlist(self):
        """Render watchlist section"""
        with st.expander("👁️ Watchlist", expanded=True):
            # Add symbol input
            col1, col2 = st.columns([3, 1])

            with col1:
                new_symbol = st.text_input(
                    "Add Symbol",
                    placeholder="Enter symbol...",
                    label_visibility="collapsed",
                    key="add_watchlist"
                )

            with col2:
                if st.button(
                    "Add",
                    use_container_width=True,
                        key="add_watchlist_btn"):
                    if new_symbol and new_symbol not in st.session_state.dashboard['watchlist']:
                        st.session_state.dashboard['watchlist'].append(
                            new_symbol)
                        st.success(f"Added {new_symbol} to watchlist")

            # Display watchlist
            for symbol in st.session_state.dashboard['watchlist']:
                col1, col2, col3, col4 = st.columns([2, 1, 1, 1])

                # Get sample data
                price = np.random.uniform(100, 50000)
                change = np.random.uniform(-5, 5)

                with col1:
                    st.markdown(f"**{symbol}**")

                with col2:
                    st.markdown(f"${price:.2f}")

                with col3:
                    color = "green" if change >= 0 else "red"
                    st.markdown(
                        f"<span style='color: {color}'>{
                            change:+.2f}%</span>",
                        unsafe_allow_html=True)

                with col4:
                    if st.button(
                        "Trade",
                        key=f"trade_{symbol}",
                            use_container_width=True):
                        st.session_state.dashboard['selected_symbol'] = symbol
                        st.rerun()

    def _render_active_orders(self):
        """Render active orders section"""
        with st.expander("📋 Active Orders", expanded=True):
            # Sample active orders
            orders = self._get_active_orders()

            if orders:
                df = pd.DataFrame(orders)

                # Format columns
                df['price'] = df['price'].apply(lambda x: f"${x:.2f}")
                df['quantity'] = df['quantity'].apply(lambda x: f"{x:.4f}")
                df['filled'] = df['filled'].apply(lambda x: f"{x:.1f}%")

                # Display table
                st.dataframe(
                    df[['symbol', 'side', 'type', 'price', 'quantity', 'filled', 'status']],
                    use_container_width=True,
                    hide_index=True
                )

                # Order management buttons
                col1, col2, col3 = st.columns(3)

                with col1:
                    if st.button("Cancel All", use_container_width=True):
                        st.warning("Cancelling all orders...")

                with col2:
                    if st.button("Modify", use_container_width=True):
                        st.info("Select order to modify")

                with col3:
                    if st.button(
                        "Refresh",
                        use_container_width=True,
                            key="refresh_orders"):
                        st.rerun()
            else:
                st.info("No active orders")

    def _render_active_strategies(self):
        """Render active strategies section"""
        with st.expander("🤖 Active Strategies", expanded=False):
            strategies = self._get_active_strategies()

            if strategies:
                for strategy in strategies:
                    col1, col2, col3 = st.columns([2, 1, 1])

                    with col1:
                        st.markdown(f"**{strategy['name']}**")
                        st.caption(
                            f"{strategy['symbol']} | {strategy['timeframe']}")

                    with col2:
                        pnl = strategy['pnl']
                        color = "green" if pnl >= 0 else "red"
                        st.markdown(
                            f"<span style='color: {color}'>{pnl:+.2f}%</span>",
                            unsafe_allow_html=True
                        )

                    with col3:
                        if strategy['status'] == 'Running':
                            if st.button(
                                    "Stop",
                                    key=f"stop_{
                                        strategy['name']}",
                                    use_container_width=True):
                                st.info(f"Stopping {strategy['name']}")
                        else:
                            if st.button(
                                    "Start",
                                    key=f"start_{
                                        strategy['name']}",
                                    use_container_width=True):
                                st.info(f"Starting {strategy['name']}")
            else:
                st.info("No active strategies")

                if st.button("Deploy Strategy", use_container_width=True):
                    st.info("Opening strategy deployment modal...")

    def _render_bottom_section(self):
        """Render bottom section with tabs"""
        tabs = st.tabs(["📊 Portfolio", "📈 Performance",
                       "📜 Recent Trades", "📰 News"])

        with tabs[0]:
            # Mini portfolio view
            portfolio_data = self._get_portfolio_summary()

            col1, col2, col3, col4 = st.columns(4)

            with col1:
                st.metric(
                    "Total Value",
                    f"${portfolio_data['total_value']:,.2f}",
                    delta=f"{portfolio_data['daily_change']:+.2f}%"
                )

            with col2:
                st.metric(
                    "Open P&L",
                    f"${portfolio_data['open_pnl']:,.2f}",
                    delta=f"{portfolio_data['open_pnl_pct']:+.2f}%"
                )

            with col3:
                st.metric(
                    "Today's P&L",
                    f"${portfolio_data['daily_pnl']:,.2f}",
                    delta="vs yesterday"
                )

            with col4:
                st.metric(
                    "Win Rate",
                    f"{portfolio_data['win_rate']:.1f}%",
                    delta=f"{portfolio_data['total_trades']} trades"
                )

        with tabs[1]:
            # Performance chart
            performance_data = [
                100 +
                i *
                0.5 +
                np.random.randn() *
                2 for i in range(30)]
            MiniChart.render_sparkline(
                performance_data, "30-Day Performance", "#1E88E5")

        with tabs[2]:
            # Recent trades
            trades = self._get_recent_trades()

            if trades:
                df = pd.DataFrame(trades)
                st.dataframe(
                    df[['time', 'symbol', 'side', 'price', 'quantity', 'pnl']],
                    use_container_width=True,
                    hide_index=True
                )
            else:
                st.info("No recent trades")

        with tabs[3]:
            # Market news
            news = self._get_market_news()

            for item in news:
                st.markdown(f"**{item['title']}**")
                st.caption(f"{item['source']} | {item['time']}")
                st.text(item['summary'])
                st.divider()

    def _render_notifications(self):
        """Render notifications"""
        if st.session_state.dashboard['notifications']:
            for notification in st.session_state.dashboard['notifications']:
                if notification['type'] == 'success':
                    st.success(notification['message'])
                elif notification['type'] == 'warning':
                    st.warning(notification['message'])
                elif notification['type'] == 'error':
                    st.error(notification['message'])
                else:
                    st.info(notification['message'])

            # Clear notifications after displaying
            st.session_state.dashboard['notifications'] = []

    def _handle_order_submission(self, order_data: Dict[str, Any]):
        """Handle order submission from order form"""
        # Add notification
        st.session_state.dashboard['notifications'].append(
            {
                'type': 'success',
                'message': f"Order placed: {
                    order_data['side']} {
                    order_data['quantity']} {
                    order_data['symbol']} at {
                        order_data['price']}"})

        # In production, this would submit to the actual trading engine
        st.rerun()

    def _get_market_overview_data(self) -> Dict[str, Dict[str, float]]:
        """Get market overview data"""
        return {
            'BTC': {'price': 47500, 'change': 2.5},
            'ETH': {'price': 3150, 'change': -1.2},
            'S&P500': {'price': 4750, 'change': 0.8},
            'GOLD': {'price': 2050, 'change': -0.3},
            'DXY': {'price': 104.5, 'change': 0.2},
        }

    def _get_current_price(self, symbol: str) -> float:
        """Get current price for symbol"""
        # In production, this would fetch from exchange
        prices = {
            'BTC/USDT': 47500,
            'ETH/USDT': 3150,
            'SOL/USDT': 145,
            'BNB/USDT': 320,
            'ADA/USDT': 0.65
        }
        return prices.get(symbol, 100)

    def _get_available_balance(self) -> float:
        """Get available balance"""
        # In production, this would fetch from account
        return 10000.0

    def _get_active_orders(self) -> List[Dict[str, Any]]:
        """Get active orders"""
        # Sample data for demo
        return [
            {
                'symbol': 'BTC/USDT',
                'side': 'BUY',
                'type': 'LIMIT',
                'price': 46000,
                'quantity': 0.1,
                'filled': 25,
                'status': 'ACTIVE'
            },
            {
                'symbol': 'ETH/USDT',
                'side': 'SELL',
                'type': 'LIMIT',
                'price': 3200,
                'quantity': 1.5,
                'filled': 0,
                'status': 'PENDING'
            }
        ]

    def _get_active_strategies(self) -> List[Dict[str, Any]]:
        """Get active trading strategies"""
        return [
            {
                'name': 'Mean Reversion',
                'symbol': 'BTC/USDT',
                'timeframe': '1h',
                'status': 'Running',
                'pnl': 2.5
            },
            {
                'name': 'Momentum',
                'symbol': 'ETH/USDT',
                'timeframe': '4h',
                'status': 'Paused',
                'pnl': -0.8
            }
        ]

    def _get_portfolio_summary(self) -> Dict[str, Any]:
        """Get portfolio summary"""
        return {
            'total_value': 105000,
            'daily_change': 1.5,
            'open_pnl': 2500,
            'open_pnl_pct': 2.4,
            'daily_pnl': 1500,
            'win_rate': 65,
            'total_trades': 45
        }

    def _get_recent_trades(self) -> List[Dict[str, Any]]:
        """Get recent trades"""
        return [
            {
                'time': '10:30:45',
                'symbol': 'BTC/USDT',
                'side': 'BUY',
                'price': 47000,
                'quantity': 0.05,
                'pnl': 125
            },
            {
                'time': '09:15:22',
                'symbol': 'ETH/USDT',
                'side': 'SELL',
                'price': 3180,
                'quantity': 0.8,
                'pnl': -45
            }
        ]

    def _get_market_news(self) -> List[Dict[str, Any]]:
        """Get market news"""
        return [{'title': 'Bitcoin Breaks $47,500 Resistance',
                 'source': 'CoinDesk',
                 'time': '1 hour ago',
                 'summary': 'Bitcoin surged past key resistance level amid institutional buying...'},
                {'title': 'Fed Minutes Signal Cautious Approach',
                 'source': 'Bloomberg',
                 'time': '3 hours ago',
                 'summary': 'Federal Reserve minutes indicate careful monitoring of inflation data...'}]
