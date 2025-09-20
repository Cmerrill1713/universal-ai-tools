"""
Portfolio View Component
Displays portfolio positions, P&L, and performance metrics
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from ..utils.chart_utils import ChartBuilder
from ..utils.formatters import DataFormatter, MetricsFormatter, TableFormatter
from ..utils.theme import TradingTheme


class PortfolioView:
    """Portfolio view component for displaying positions and performance"""

    def __init__(self):
        """Initialize portfolio view component"""
        self.formatter = DataFormatter()
        self.table_formatter = TableFormatter()
        self.metrics_formatter = MetricsFormatter()
        self.chart_builder = ChartBuilder()

        # Initialize session state
        if 'portfolio_view' not in st.session_state:
            st.session_state.portfolio_view = {
                'selected_position': None,
                'view_mode': 'grid',  # 'grid' or 'table'
                'show_closed': False,
                'time_range': '1D'
            }

    def render(self, portfolio_data: Optional[Dict[str, Any]] = None):
        """
        Render the portfolio view

        Args:
            portfolio_data: Portfolio data including positions, metrics, and history
        """
        # Use sample data if none provided
        if portfolio_data is None:
            portfolio_data = self._get_sample_portfolio_data()

        # Apply theme
        TradingTheme.apply_theme()

        # Portfolio header
        self._render_portfolio_header(portfolio_data)

        # Portfolio metrics
        self._render_portfolio_metrics(portfolio_data['metrics'])

        # Tab view for different sections
        tabs = st.tabs(
            ["📊 Positions", "📈 Performance", "📜 History", "⚠️ Risk"])

        with tabs[0]:
            self._render_positions_tab(portfolio_data['positions'])

        with tabs[1]:
            self._render_performance_tab(portfolio_data['performance'])

        with tabs[2]:
            self._render_history_tab(portfolio_data['history'])

        with tabs[3]:
            self._render_risk_tab(portfolio_data['risk'])

    def _render_portfolio_header(self, portfolio_data: Dict[str, Any]):
        """Render portfolio header with account info"""
        col1, col2, col3, col4 = st.columns([2, 1, 1, 1])

        with col1:
            st.markdown("## 💼 Portfolio Overview")
            st.caption(
                f"Last updated: {
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        with col2:
            # View mode toggle
            view_modes = ['Grid View', 'Table View']
            selected_mode = st.radio(
                "View Mode",
                view_modes,
                horizontal=True,
                label_visibility="collapsed"
            )
            st.session_state.portfolio_view['view_mode'] = 'grid' if selected_mode == 'Grid View' else 'table'

        with col3:
            # Time range selector
            time_ranges = ['1D', '1W', '1M', '3M', '1Y', 'ALL']
            st.session_state.portfolio_view['time_range'] = st.selectbox(
                "Time Range", time_ranges, index=time_ranges.index(
                    st.session_state.portfolio_view['time_range']), label_visibility="collapsed")

        with col4:
            # Refresh button
            if st.button("🔄 Refresh", use_container_width=True):
                st.rerun()

    def _render_portfolio_metrics(self, metrics: Dict[str, Any]):
        """Render key portfolio metrics"""
        st.markdown("### 📊 Portfolio Metrics")

        formatted_metrics = self.metrics_formatter.format_portfolio_metrics(
            metrics)

        # First row of metrics
        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            total_value = metrics.get('total_value', 0)
            daily_change = metrics.get('daily_change', 0)
            daily_change_pct = metrics.get('daily_change_pct', 0)

            delta_color = "normal" if daily_change >= 0 else "inverse"
            st.metric(
                "Total Value",
                formatted_metrics.get('total_value', '$0.00'),
                delta=f"{daily_change_pct:+.2f}% ({self.formatter.format_currency(daily_change)})",
                delta_color=delta_color
            )

        with col2:
            st.metric(
                "Cash Balance",
                formatted_metrics.get('cash_balance', '$0.00'),
                delta=None
            )

        with col3:
            unrealized_pnl = metrics.get('unrealized_pnl', 0)
            delta_color = "normal" if unrealized_pnl >= 0 else "inverse"
            st.metric(
                "Unrealized P&L",
                formatted_metrics.get('unrealized_pnl', '$0.00'),
                delta=f"{metrics.get('unrealized_pnl_pct', 0):+.2f}%",
                delta_color=delta_color
            )

        with col4:
            realized_pnl = metrics.get('realized_pnl', 0)
            delta_color = "normal" if realized_pnl >= 0 else "inverse"
            st.metric(
                "Realized P&L",
                formatted_metrics.get('realized_pnl', '$0.00'),
                delta="Today",
                delta_color=delta_color
            )

        with col5:
            win_rate = metrics.get('win_rate', 0)
            st.metric(
                "Win Rate",
                f"{win_rate:.1f}%",
                delta=f"{metrics.get('total_trades', 0)} trades"
            )

    def _render_positions_tab(self, positions: List[Dict[str, Any]]):
        """Render positions tab"""
        st.markdown("### 📈 Open Positions")

        # Position filters
        col1, col2, col3 = st.columns([1, 1, 2])

        with col1:
            position_filter = st.selectbox(
                "Filter",
                ["All", "Profitable", "Losing", "Today's"],
                label_visibility="collapsed"
            )

        with col2:
            sort_by = st.selectbox(
                "Sort by",
                ["Value", "P&L", "Symbol", "Time"],
                label_visibility="collapsed"
            )

        with col3:
            search = st.text_input(
                "Search",
                placeholder="Search positions...",
                label_visibility="collapsed"
            )

        # Apply filters
        filtered_positions = self._filter_positions(
            positions, position_filter, search)

        # Display positions
        if st.session_state.portfolio_view['view_mode'] == 'grid':
            self._render_positions_grid(filtered_positions)
        else:
            self._render_positions_table(filtered_positions)

        # Position details modal
        if st.session_state.portfolio_view['selected_position']:
            self._render_position_details(
                st.session_state.portfolio_view['selected_position'])

    def _render_positions_grid(self, positions: List[Dict[str, Any]]):
        """Render positions in grid view"""
        if not positions:
            st.info("No open positions")
            return

        # Create grid layout
        cols_per_row = 3
        for i in range(0, len(positions), cols_per_row):
            cols = st.columns(cols_per_row)

            for j, col in enumerate(cols):
                if i + j < len(positions):
                    position = positions[i + j]

                    with col:
                        self._render_position_card(position)

    def _render_position_card(self, position: Dict[str, Any]):
        """Render individual position card"""
        # Calculate P&L
        pnl = position.get('unrealized_pnl', 0)
        pnl_pct = position.get('unrealized_pnl_pct', 0)

        # Determine card color based on P&L
        if pnl >= 0:
            border_color = "#4CAF50"
            pnl_emoji = "📈"
        else:
            border_color = "#F44336"
            pnl_emoji = "📉"

        # Create card with custom styling
        with st.container():
            st.markdown(
                f"""
                <div style="
                    border: 2px solid {border_color};
                    border-radius: 10px;
                    padding: 15px;
                    background-color: rgba(26, 27, 33, 0.5);
                    margin-bottom: 10px;
                ">
                    <h4>{position['symbol']} {pnl_emoji}</h4>
                    <p style="color: #B0B0B0;">
                        Qty: {position['quantity']:.4f} |
                        Avg: ${position['entry_price']:.2f}
                    </p>
                    <h3 style="color: {border_color};">
                        {self.formatter.format_currency(pnl)} ({pnl_pct:+.2f}%)
                    </h3>
                    <p style="color: #B0B0B0;">
                        Value: {self.formatter.format_currency(position['current_value'])}
                    </p>
                </div>
                """,
                unsafe_allow_html=True
            )

            # Action buttons
            col1, col2, col3 = st.columns(3)

            with col1:
                if st.button(
                        "Details",
                        key=f"details_{
                            position['symbol']}",
                        use_container_width=True):
                    st.session_state.portfolio_view['selected_position'] = position

            with col2:
                if st.button(
                        "Add",
                        key=f"add_{
                            position['symbol']}",
                        use_container_width=True):
                    st.info(f"Add to {position['symbol']} position")

            with col3:
                if st.button(
                        "Close",
                        key=f"close_{
                            position['symbol']}",
                        use_container_width=True):
                    st.warning(f"Close {position['symbol']} position")

    def _render_positions_table(self, positions: List[Dict[str, Any]]):
        """Render positions in table view"""
        if not positions:
            st.info("No open positions")
            return

        # Prepare dataframe
        df = pd.DataFrame(positions)

        # Format columns
        display_columns = [
            'symbol', 'side', 'quantity', 'entry_price', 'current_price',
            'current_value', 'unrealized_pnl', 'unrealized_pnl_pct'
        ]

        df = df[display_columns]

        # Apply formatting
        df['unrealized_pnl'] = df['unrealized_pnl'].apply(
            lambda x: self.formatter.format_currency(x)
        )
        df['unrealized_pnl_pct'] = df['unrealized_pnl_pct'].apply(
            lambda x: self.formatter.format_percentage(x)
        )
        df['current_value'] = df['current_value'].apply(
            lambda x: self.formatter.format_currency(x)
        )

        # Style the dataframe
        styled_df = df.style.applymap(
            self.formatter.color_negative_red,
            subset=['unrealized_pnl_pct']
        )

        # Display table
        st.dataframe(
            styled_df,
            use_container_width=True,
            hide_index=True
        )

    def _render_performance_tab(self, performance: Dict[str, Any]):
        """Render performance tab"""
        st.markdown("### 📊 Performance Analytics")

        # Performance metrics
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric(
                "Sharpe Ratio", f"{
                    performance.get(
                        'sharpe_ratio', 0):.2f}")

        with col2:
            st.metric(
                "Sortino Ratio", f"{
                    performance.get(
                        'sortino_ratio', 0):.2f}")

        with col3:
            st.metric("Max Drawdown",
                      f"{performance.get('max_drawdown', 0):.1f}%")

        with col4:
            st.metric(
                "Calmar Ratio", f"{
                    performance.get(
                        'calmar_ratio', 0):.2f}")

        # Performance charts
        col1, col2 = st.columns(2)

        with col1:
            # Equity curve
            st.plotly_chart(
                self._create_equity_curve(performance['equity_curve']),
                use_container_width=True
            )

        with col2:
            # Returns distribution
            st.plotly_chart(
                self._create_returns_distribution(performance['returns']),
                use_container_width=True
            )

        # Monthly returns heatmap
        st.plotly_chart(
            self._create_monthly_returns_heatmap(
                performance['monthly_returns']),
            use_container_width=True)

    def _render_history_tab(self, history: List[Dict[str, Any]]):
        """Render trade history tab"""
        st.markdown("### 📜 Trade History")

        # History filters
        col1, col2, col3 = st.columns(3)

        with col1:
            date_range = st.date_input(
                "Date Range",
                value=(datetime.now() - timedelta(days=30), datetime.now()),
                label_visibility="collapsed"
            )

        with col2:
            trade_type = st.selectbox(
                "Type",
                ["All", "Buy", "Sell"],
                label_visibility="collapsed"
            )

        with col3:
            symbol_filter = st.text_input(
                "Symbol",
                placeholder="Filter by symbol...",
                label_visibility="collapsed"
            )

        # Display trade history
        if history:
            df = self.table_formatter.format_trades_table(history)
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.info("No trade history available")

    def _render_risk_tab(self, risk: Dict[str, Any]):
        """Render risk management tab"""
        st.markdown("### ⚠️ Risk Management")

        # Risk metrics
        col1, col2, col3 = st.columns(3)

        with col1:
            # Risk gauge
            st.plotly_chart(
                self.chart_builder.create_risk_gauge(
                    risk.get('risk_score', 0.5),
                    title="Overall Risk Score"
                ),
                use_container_width=True
            )

        with col2:
            st.metric(
                "Value at Risk (95%)",
                self.formatter.format_currency(risk.get('var_95', 0)),
                help="Maximum expected loss at 95% confidence"
            )

            st.metric(
                "Expected Shortfall",
                self.formatter.format_currency(
                    risk.get(
                        'expected_shortfall',
                        0)),
                help="Average loss beyond VaR")

        with col3:
            st.metric(
                "Portfolio Beta",
                f"{risk.get('beta', 1.0):.2f}",
                help="Systematic risk relative to market"
            )

            st.metric(
                "Correlation",
                f"{risk.get('correlation', 0):.2f}",
                help="Average correlation between positions"
            )

        # Risk breakdown
        st.markdown("#### Risk Breakdown by Position")

        if risk.get('position_risks'):
            df = pd.DataFrame(risk['position_risks'])

            # Create risk heatmap
            fig = go.Figure(data=go.Bar(
                x=df['symbol'],
                y=df['risk_contribution'],
                marker_color=df['risk_contribution'],
                marker_colorscale='RdYlGn_r',
                text=df['risk_contribution'].apply(lambda x: f'{x:.1f}%'),
                textposition='auto',
            ))

            fig.update_layout(
                title="Risk Contribution by Position",
                xaxis_title="Symbol",
                yaxis_title="Risk Contribution (%)",
                height=400
            )

            st.plotly_chart(fig, use_container_width=True)

    def _render_position_details(self, position: Dict[str, Any]):
        """Render detailed position modal"""
        with st.expander(f"📊 Position Details: {position['symbol']}", expanded=True):
            col1, col2 = st.columns(2)

            with col1:
                st.markdown("##### Position Info")
                st.text(f"Symbol: {position['symbol']}")
                st.text(f"Side: {position['side']}")
                st.text(f"Quantity: {position['quantity']:.4f}")
                st.text(f"Entry Price: ${position['entry_price']:.2f}")
                st.text(f"Current Price: ${position['current_price']:.2f}")
                st.text(f"Entry Time: {position['entry_time']}")

            with col2:
                st.markdown("##### P&L Analysis")
                pnl = position.get('unrealized_pnl', 0)
                pnl_pct = position.get('unrealized_pnl_pct', 0)

                color = "green" if pnl >= 0 else "red"
                st.markdown(
                    f"<h3 style='color: {color};'>{
                        self.formatter.format_currency(pnl)}</h3>",
                    unsafe_allow_html=True)
                st.markdown(
                    f"<h4 style='color: {color};'>{pnl_pct:+.2f}%</h4>",
                    unsafe_allow_html=True
                )

                st.text(
                    f"Position Value: {
                        self.formatter.format_currency(
                            position['current_value'])}")
                st.text(
                    f"Daily Change: {
                        self.formatter.format_currency(
                            position.get(
                                'daily_change',
                                0))}")

            # Position actions
            st.markdown("##### Quick Actions")
            col1, col2, col3, col4 = st.columns(4)

            with col1:
                if st.button("Add to Position", use_container_width=True):
                    st.info("Opening order form to add to position")

            with col2:
                if st.button("Reduce Position", use_container_width=True):
                    st.info("Opening order form to reduce position")

            with col3:
                if st.button("Set Stop Loss", use_container_width=True):
                    st.info("Opening stop loss configuration")

            with col4:
                if st.button("Close Position", use_container_width=True):
                    st.warning("Confirm position closure")

    def _filter_positions(self,
                          positions: List[Dict[str,
                                               Any]],
                          filter_type: str,
                          search: str) -> List[Dict[str,
                                                    Any]]:
        """Filter positions based on criteria"""
        filtered = positions.copy()

        # Apply filter type
        if filter_type == "Profitable":
            filtered = [p for p in filtered if p.get('unrealized_pnl', 0) > 0]
        elif filter_type == "Losing":
            filtered = [p for p in filtered if p.get('unrealized_pnl', 0) < 0]
        elif filter_type == "Today's":
            today = datetime.now().date()
            filtered = [
                p for p in filtered if datetime.fromisoformat(
                    p['entry_time']).date() == today]

        # Apply search
        if search:
            search_lower = search.lower()
            filtered = [p for p in filtered
                        if search_lower in p['symbol'].lower()]

        return filtered

    def _create_equity_curve(self, equity_data: List[float]) -> go.Figure:
        """Create equity curve chart"""
        fig = go.Figure()

        fig.add_trace(go.Scatter(
            y=equity_data,
            mode='lines',
            name='Equity',
            line=dict(color='#1E88E5', width=2),
            fill='tozeroy',
            fillcolor='rgba(30, 136, 229, 0.1)'
        ))

        fig.update_layout(
            title="Equity Curve",
            xaxis_title="Time",
            yaxis_title="Portfolio Value ($)",
            height=400
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_returns_distribution(self, returns: List[float]) -> go.Figure:
        """Create returns distribution histogram"""
        fig = go.Figure()

        fig.add_trace(go.Histogram(
            x=returns,
            nbinsx=30,
            name='Returns',
            marker_color='#1E88E5',
            opacity=0.7
        ))

        # Add normal distribution overlay
        import scipy.stats as stats
        x = np.linspace(min(returns), max(returns), 100)
        y = stats.norm.pdf(x, np.mean(returns), np.std(returns))
        y = y * len(returns) * (max(returns) - min(returns)) / \
            30  # Scale to histogram

        fig.add_trace(go.Scatter(
            x=x,
            y=y,
            mode='lines',
            name='Normal Distribution',
            line=dict(color='red', width=2)
        ))

        fig.update_layout(
            title="Returns Distribution",
            xaxis_title="Returns (%)",
            yaxis_title="Frequency",
            height=400
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_monthly_returns_heatmap(
            self, monthly_returns: Dict[str, List[float]]) -> go.Figure:
        """Create monthly returns heatmap"""
        # Prepare data
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        years = list(monthly_returns.keys())

        z = [monthly_returns[year] for year in years]

        fig = go.Figure(data=go.Heatmap(
            z=z,
            x=months,
            y=years,
            colorscale='RdYlGn',
            zmid=0,
            text=[[f'{val:.1f}%' for val in row] for row in z],
            texttemplate='%{text}',
            textfont={"size": 10},
            colorbar=dict(title="Return (%)")
        ))

        fig.update_layout(
            title="Monthly Returns Heatmap",
            xaxis_title="Month",
            yaxis_title="Year",
            height=300
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _get_sample_portfolio_data(self) -> Dict[str, Any]:
        """Get sample portfolio data for demonstration"""
        return {
            'metrics': {
                'total_value': 100000,
                'cash_balance': 25000,
                'positions_value': 75000,
                'daily_change': 1500,
                'daily_change_pct': 1.5,
                'unrealized_pnl': 5000,
                'unrealized_pnl_pct': 6.67,
                'realized_pnl': 2000,
                'total_trades': 45,
                'win_rate': 62.2
            },
            'positions': [
                {
                    'symbol': 'BTC/USDT',
                    'side': 'Long',
                    'quantity': 0.5,
                    'entry_price': 45000,
                    'current_price': 47500,
                    'current_value': 23750,
                    'unrealized_pnl': 1250,
                    'unrealized_pnl_pct': 5.56,
                    'entry_time': datetime.now().isoformat(),
                    'daily_change': 500
                },
                {
                    'symbol': 'ETH/USDT',
                    'side': 'Long',
                    'quantity': 10,
                    'entry_price': 3000,
                    'current_price': 3150,
                    'current_value': 31500,
                    'unrealized_pnl': 1500,
                    'unrealized_pnl_pct': 5.0,
                    'entry_time': datetime.now().isoformat(),
                    'daily_change': 300
                },
                {
                    'symbol': 'SOL/USDT',
                    'side': 'Short',
                    'quantity': 100,
                    'entry_price': 150,
                    'current_price': 145,
                    'current_value': 14500,
                    'unrealized_pnl': 500,
                    'unrealized_pnl_pct': 3.33,
                    'entry_time': datetime.now().isoformat(),
                    'daily_change': -200
                }
            ],
            'performance': {
                'sharpe_ratio': 1.8,
                'sortino_ratio': 2.1,
                'max_drawdown': -12.5,
                'calmar_ratio': 1.5,
                'equity_curve': [90000 + i * 100 + np.random.randn() * 500 for i in range(100)],
                'returns': np.random.normal(0.5, 2, 1000).tolist(),
                'monthly_returns': {
                    '2024': [2.1, 1.5, -0.8, 3.2, 1.1, -1.5, 2.8, 0.5, 1.9, -0.3, 2.5, 3.1],
                    '2023': [1.2, -0.5, 2.1, 1.8, -1.2, 3.5, 0.8, 1.5, -0.9, 2.3, 1.7, 2.9]
                }
            },
            'history': [
                {
                    'timestamp': datetime.now() - timedelta(hours=i),
                    'symbol': ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][i % 3],
                    'side': ['Buy', 'Sell'][i % 2],
                    'price': 45000 + np.random.randn() * 1000,
                    'quantity': 0.1 + np.random.random() * 0.5,
                    'value': 5000 + np.random.randn() * 500,
                    'pnl': np.random.randn() * 100,
                    'pnl_percentage': np.random.randn() * 5
                } for i in range(20)
            ],
            'risk': {
                'risk_score': 0.65,
                'var_95': -5000,
                'expected_shortfall': -7500,
                'beta': 1.15,
                'correlation': 0.45,
                'position_risks': [
                    {'symbol': 'BTC/USDT', 'risk_contribution': 45},
                    {'symbol': 'ETH/USDT', 'risk_contribution': 35},
                    {'symbol': 'SOL/USDT', 'risk_contribution': 20}
                ]
            }
        }
