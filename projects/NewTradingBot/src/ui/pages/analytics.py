"""
Analytics Page
Advanced trading analytics and performance metrics
"""

from datetime import datetime
from typing import Dict, List

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from ..utils.chart_utils import ChartBuilder
from ..utils.formatters import DataFormatter, MetricsFormatter
from ..utils.theme import TradingTheme


class AnalyticsPage:
    """Analytics and performance analysis page"""

    def __init__(self):
        """Initialize analytics page"""
        self.chart_builder = ChartBuilder()
        self.formatter = DataFormatter()
        self.metrics_formatter = MetricsFormatter()

        if 'analytics' not in st.session_state:
            st.session_state.analytics = {
                'selected_period': '1M',
                'selected_metrics': ['returns', 'sharpe', 'drawdown'],
                'comparison_enabled': False
            }

    def render(self):
        """Render the analytics page"""
        # Apply theme
        TradingTheme.apply_theme()

        # Page header
        st.markdown("# 📈 Trading Analytics")
        st.caption("Comprehensive performance analysis and insights")

        # Navigation
        col1, col2, col3, col4 = st.columns([1, 1, 1, 7])
        with col1:
            if st.button("← Dashboard", use_container_width=True):
                st.switch_page("pages/dashboard.py")

        with col2:
            periods = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL']
            st.session_state.analytics['selected_period'] = st.selectbox(
                "Period",
                periods,
                index=periods.index(st.session_state.analytics['selected_period']),
                label_visibility="collapsed"
            )

        with col3:
            if st.button("📊 Export", use_container_width=True):
                self._export_analytics()

        # Main analytics sections
        self._render_performance_overview()
        self._render_detailed_metrics()
        self._render_trade_analysis()
        self._render_risk_analysis()
        self._render_strategy_performance()
        self._render_market_correlation()

    def _render_performance_overview(self):
        """Render performance overview section"""
        st.markdown("## 📊 Performance Overview")

        # Key metrics cards
        col1, col2, col3, col4, col5 = st.columns(5)

        metrics = self._get_performance_metrics()

        with col1:
            st.metric(
                "Total Return",
                f"{metrics['total_return']:.2f}%",
                delta=f"{metrics['monthly_return']:.2f}% this month",
                delta_color="normal" if metrics['monthly_return'] >= 0 else "inverse"
            )

        with col2:
            st.metric(
                "Sharpe Ratio",
                f"{metrics['sharpe_ratio']:.2f}",
                delta=f"{metrics['sharpe_change']:.2f} vs last period"
            )

        with col3:
            st.metric(
                "Win Rate",
                f"{metrics['win_rate']:.1f}%",
                delta=f"{metrics['total_trades']} trades"
            )

        with col4:
            st.metric(
                "Profit Factor",
                f"{metrics['profit_factor']:.2f}",
                delta="Good" if metrics['profit_factor'] > 1.5 else "Needs improvement"
            )

        with col5:
            st.metric(
                "Max Drawdown",
                f"{metrics['max_drawdown']:.1f}%",
                delta="Within limits" if abs(metrics['max_drawdown']) < 20 else "High risk",
                delta_color="normal" if abs(metrics['max_drawdown']) < 20 else "inverse"
            )

        # Equity curve
        st.markdown("### Equity Curve")
        fig = self._create_equity_curve()
        st.plotly_chart(fig, use_container_width=True)

    def _render_detailed_metrics(self):
        """Render detailed performance metrics"""
        st.markdown("## 📊 Detailed Metrics")

        tabs = st.tabs(["Returns", "Risk Metrics", "Efficiency", "Statistics"])

        with tabs[0]:
            self._render_returns_analysis()

        with tabs[1]:
            self._render_risk_metrics()

        with tabs[2]:
            self._render_efficiency_metrics()

        with tabs[3]:
            self._render_statistics()

    def _render_returns_analysis(self):
        """Render returns analysis"""
        col1, col2 = st.columns(2)

        with col1:
            # Returns distribution
            fig = self._create_returns_distribution()
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            # Monthly returns heatmap
            fig = self._create_monthly_returns_heatmap()
            st.plotly_chart(fig, use_container_width=True)

        # Returns table
        st.markdown("#### Period Returns")
        returns_data = self._get_period_returns()
        df = pd.DataFrame(returns_data)
        st.dataframe(df, use_container_width=True, hide_index=True)

    def _render_risk_metrics(self):
        """Render risk metrics"""
        col1, col2, col3, col4 = st.columns(4)

        risk_metrics = self._get_risk_metrics()

        with col1:
            st.metric("Value at Risk (95%)", f"${risk_metrics['var_95']:,.0f}")
            st.metric("CVaR (95%)", f"${risk_metrics['cvar_95']:,.0f}")

        with col2:
            st.metric("Sortino Ratio", f"{risk_metrics['sortino']:.2f}")
            st.metric("Calmar Ratio", f"{risk_metrics['calmar']:.2f}")

        with col3:
            st.metric("Beta", f"{risk_metrics['beta']:.2f}")
            st.metric("Alpha", f"{risk_metrics['alpha']:.2f}%")

        with col4:
            st.metric("Volatility", f"{risk_metrics['volatility']:.1f}%")
            st.metric("Downside Deviation",
                      f"{risk_metrics['downside_dev']:.1f}%")

        # Drawdown chart
        st.markdown("#### Drawdown Analysis")
        fig = self._create_drawdown_chart()
        st.plotly_chart(fig, use_container_width=True)

    def _render_efficiency_metrics(self):
        """Render efficiency metrics"""
        col1, col2 = st.columns(2)

        with col1:
            st.markdown("#### Trading Efficiency")

            efficiency_metrics = {
                "Average Win": "$2,500",
                "Average Loss": "$-850",
                "Win/Loss Ratio": "2.94",
                "Expectancy": "$425",
                "Kelly Criterion": "18.5%",
                "Average Hold Time": "4.2 days"
            }

            for metric, value in efficiency_metrics.items():
                col_metric, col_value = st.columns([2, 1])
                with col_metric:
                    st.text(metric)
                with col_value:
                    st.markdown(f"**{value}**")

        with col2:
            # Efficiency gauge
            fig = self._create_efficiency_gauge()
            st.plotly_chart(fig, use_container_width=True)

    def _render_statistics(self):
        """Render statistical analysis"""
        # Performance statistics table
        stats_data = {
            'Metric': [
                'Mean Return',
                'Median Return',
                'Std Deviation',
                'Skewness',
                'Kurtosis',
                'Best Day',
                'Worst Day',
                'Positive Days'],
            'Value': [
                '0.25%',
                '0.18%',
                '1.85%',
                '-0.32',
                '3.45',
                '5.82%',
                '-4.21%',
                '58.3%']}

        df = pd.DataFrame(stats_data)
        st.dataframe(df, use_container_width=True, hide_index=True)

        # Q-Q plot for normality test
        st.markdown("#### Returns Normality Test")
        fig = self._create_qq_plot()
        st.plotly_chart(fig, use_container_width=True)

    def _render_trade_analysis(self):
        """Render trade analysis section"""
        st.markdown("## 🔍 Trade Analysis")

        col1, col2 = st.columns(2)

        with col1:
            # Trade distribution by hour
            fig = self._create_trade_distribution_chart()
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            # Win/Loss by asset
            fig = self._create_win_loss_by_asset()
            st.plotly_chart(fig, use_container_width=True)

        # Trade details table
        st.markdown("### Recent Trades Performance")
        trades_df = self._get_recent_trades_analysis()
        st.dataframe(trades_df, use_container_width=True, hide_index=True)

    def _render_risk_analysis(self):
        """Render risk analysis section"""
        st.markdown("## ⚠️ Risk Analysis")

        col1, col2, col3 = st.columns(3)

        with col1:
            # Risk score gauge
            fig = self.chart_builder.create_risk_gauge(
                0.65, "Portfolio Risk Score")
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            # Correlation matrix
            fig = self._create_correlation_matrix()
            st.plotly_chart(fig, use_container_width=True)

        with col3:
            # Risk contribution
            fig = self._create_risk_contribution_chart()
            st.plotly_chart(fig, use_container_width=True)

    def _render_strategy_performance(self):
        """Render strategy performance comparison"""
        st.markdown("## 🤖 Strategy Performance")

        # Strategy comparison table
        strategy_data = {
            'Strategy': [
                'Mean Reversion', 'Momentum', 'Arbitrage', 'Market Making'], 'Return': [
                '15.2%', '22.8%', '8.5%', '12.1%'], 'Sharpe': [
                1.85, 2.15, 3.20, 1.65], 'Win Rate': [
                    '62%', '45%', '78%', '55%'], 'Trades': [
                        145, 89, 234, 567], 'Status': [
                            'Active', 'Active', 'Paused', 'Active']}

        df = pd.DataFrame(strategy_data)
        st.dataframe(df, use_container_width=True, hide_index=True)

        # Strategy performance chart
        fig = self._create_strategy_comparison_chart()
        st.plotly_chart(fig, use_container_width=True)

    def _render_market_correlation(self):
        """Render market correlation analysis"""
        st.markdown("## 📊 Market Correlation")

        col1, col2 = st.columns(2)

        with col1:
            # Rolling correlation chart
            fig = self._create_rolling_correlation_chart()
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            # Beta analysis
            fig = self._create_beta_analysis_chart()
            st.plotly_chart(fig, use_container_width=True)

    # Chart creation methods
    def _create_equity_curve(self) -> go.Figure:
        """Create equity curve chart"""
        # Generate sample data
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        equity = 100000 * (1 + np.cumsum(np.random.randn(len(dates)) * 0.01))
        benchmark = 100000 * \
            (1 + np.cumsum(np.random.randn(len(dates)) * 0.008))

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=dates,
            y=equity,
            mode='lines',
            name='Portfolio',
            line=dict(color='#1E88E5', width=2)
        ))

        fig.add_trace(go.Scatter(
            x=dates,
            y=benchmark,
            mode='lines',
            name='Benchmark',
            line=dict(color='#FFC107', width=1, dash='dash')
        ))

        fig.update_layout(
            title="Portfolio Equity Curve",
            xaxis_title="Date",
            yaxis_title="Portfolio Value ($)",
            hovermode='x unified',
            height=400
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_returns_distribution(self) -> go.Figure:
        """Create returns distribution histogram"""
        returns = np.random.normal(0.2, 2, 1000)

        fig = go.Figure()

        fig.add_trace(go.Histogram(
            x=returns,
            nbinsx=30,
            name='Returns',
            marker_color='#1E88E5',
            opacity=0.7
        ))

        fig.update_layout(
            title="Returns Distribution",
            xaxis_title="Daily Returns (%)",
            yaxis_title="Frequency",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_monthly_returns_heatmap(self) -> go.Figure:
        """Create monthly returns heatmap"""
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        years = ['2023', '2024']

        # Generate sample returns
        z = np.random.randn(2, 12) * 5

        fig = go.Figure(data=go.Heatmap(
            z=z,
            x=months,
            y=years,
            colorscale='RdYlGn',
            zmid=0,
            text=[[f'{val:.1f}%' for val in row] for row in z],
            texttemplate='%{text}',
            colorbar=dict(title="Return (%)")
        ))

        fig.update_layout(
            title="Monthly Returns",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_drawdown_chart(self) -> go.Figure:
        """Create drawdown chart"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        cumulative_returns = np.cumsum(np.random.randn(len(dates)) * 0.01)
        running_max = pd.Series(cumulative_returns).expanding().max()
        drawdown = (cumulative_returns - running_max) / running_max * 100

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=dates,
            y=drawdown,
            mode='lines',
            name='Drawdown',
            line=dict(color='#F44336', width=1),
            fill='tozeroy',
            fillcolor='rgba(244, 67, 54, 0.2)'
        ))

        fig.update_layout(
            title="Drawdown Analysis",
            xaxis_title="Date",
            yaxis_title="Drawdown (%)",
            height=300
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_efficiency_gauge(self) -> go.Figure:
        """Create trading efficiency gauge"""
        efficiency_score = 72  # Example score

        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=efficiency_score,
            title={'text': "Trading Efficiency"},
            domain={'x': [0, 1], 'y': [0, 1]},
            gauge={
                'axis': {'range': [None, 100]},
                'bar': {'color': "#1E88E5"},
                'steps': [
                    {'range': [0, 50], 'color': "rgba(244, 67, 54, 0.1)"},
                    {'range': [50, 75], 'color': "rgba(255, 193, 7, 0.1)"},
                    {'range': [75, 100], 'color': "rgba(76, 175, 80, 0.1)"}
                ],
                'threshold': {
                    'line': {'color': "red", 'width': 4},
                    'thickness': 0.75,
                    'value': 90
                }
            }
        ))

        fig.update_layout(height=300)
        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_qq_plot(self) -> go.Figure:
        """Create Q-Q plot for normality test"""
        returns = np.random.normal(0, 1, 100)
        returns.sort()

        theoretical_quantiles = np.random.normal(0, 1, 100)
        theoretical_quantiles.sort()

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=theoretical_quantiles,
            y=returns,
            mode='markers',
            name='Returns',
            marker=dict(color='#1E88E5')
        ))

        # Add reference line
        fig.add_trace(go.Scatter(
            x=[-3, 3],
            y=[-3, 3],
            mode='lines',
            name='Normal',
            line=dict(color='red', dash='dash')
        ))

        fig.update_layout(
            title="Q-Q Plot",
            xaxis_title="Theoretical Quantiles",
            yaxis_title="Sample Quantiles",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_trade_distribution_chart(self) -> go.Figure:
        """Create trade distribution by hour chart"""
        hours = list(range(24))
        trades = [np.random.randint(5, 50) for _ in hours]

        fig = go.Figure()

        fig.add_trace(go.Bar(
            x=hours,
            y=trades,
            name='Trades',
            marker_color='#1E88E5'
        ))

        fig.update_layout(
            title="Trade Distribution by Hour",
            xaxis_title="Hour of Day",
            yaxis_title="Number of Trades",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_win_loss_by_asset(self) -> go.Figure:
        """Create win/loss by asset chart"""
        assets = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']
        wins = [45, 38, 52, 31, 28]
        losses = [25, 32, 18, 29, 22]

        fig = go.Figure()

        fig.add_trace(go.Bar(
            x=assets,
            y=wins,
            name='Wins',
            marker_color='#4CAF50'
        ))

        fig.add_trace(go.Bar(
            x=assets,
            y=losses,
            name='Losses',
            marker_color='#F44336'
        ))

        fig.update_layout(
            title="Win/Loss by Asset",
            xaxis_title="Asset",
            yaxis_title="Number of Trades",
            barmode='group',
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_correlation_matrix(self) -> go.Figure:
        """Create correlation matrix heatmap"""
        assets = ['BTC', 'ETH', 'SOL', 'SPY']
        corr_matrix = np.random.rand(4, 4)
        np.fill_diagonal(corr_matrix, 1)

        fig = go.Figure(data=go.Heatmap(
            z=corr_matrix,
            x=assets,
            y=assets,
            colorscale='RdBu',
            zmid=0,
            text=corr_matrix,
            texttemplate='%{text:.2f}',
            colorbar=dict(title="Correlation")
        ))

        fig.update_layout(
            title="Asset Correlation Matrix",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_risk_contribution_chart(self) -> go.Figure:
        """Create risk contribution chart"""
        assets = ['BTC', 'ETH', 'SOL', 'BNB', 'Other']
        contributions = [35, 25, 20, 15, 5]

        fig = go.Figure(data=[go.Pie(
            labels=assets,
            values=contributions,
            hole=0.3
        )])

        fig.update_layout(
            title="Risk Contribution by Asset",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_strategy_comparison_chart(self) -> go.Figure:
        """Create strategy comparison chart"""
        strategies = [
            'Mean Reversion',
            'Momentum',
            'Arbitrage',
            'Market Making']
        returns = [15.2, 22.8, 8.5, 12.1]
        sharpe = [1.85, 2.15, 3.20, 1.65]

        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=('Returns (%)', 'Sharpe Ratio')
        )

        fig.add_trace(
            go.Bar(x=strategies, y=returns, marker_color='#1E88E5'),
            row=1, col=1
        )

        fig.add_trace(
            go.Bar(x=strategies, y=sharpe, marker_color='#FFC107'),
            row=1, col=2
        )

        fig.update_layout(
            title="Strategy Performance Comparison",
            height=350,
            showlegend=False
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_rolling_correlation_chart(self) -> go.Figure:
        """Create rolling correlation chart"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        correlation = np.random.rand(len(dates)) * 0.6 + 0.2

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=dates,
            y=correlation,
            mode='lines',
            name='30-Day Rolling Correlation',
            line=dict(color='#1E88E5', width=2)
        ))

        fig.add_hline(y=0.5, line_dash="dash", line_color="gray")

        fig.update_layout(
            title="Rolling Correlation with Market",
            xaxis_title="Date",
            yaxis_title="Correlation",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    def _create_beta_analysis_chart(self) -> go.Figure:
        """Create beta analysis chart"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        beta = 1 + np.cumsum(np.random.randn(len(dates)) * 0.01)

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=dates,
            y=beta,
            mode='lines',
            name='Rolling Beta',
            line=dict(color='#FFC107', width=2)
        ))

        fig.add_hline(y=1, line_dash="dash", line_color="gray")

        fig.update_layout(
            title="Portfolio Beta Analysis",
            xaxis_title="Date",
            yaxis_title="Beta",
            height=350
        )

        self.chart_builder._apply_theme(fig, 'dark')
        return fig

    # Data methods
    def _get_performance_metrics(self) -> Dict[str, float]:
        """Get performance metrics"""
        return {
            'total_return': 45.2,
            'monthly_return': 3.8,
            'sharpe_ratio': 1.85,
            'sharpe_change': 0.12,
            'win_rate': 62.5,
            'total_trades': 234,
            'profit_factor': 1.78,
            'max_drawdown': -15.3
        }

    def _get_risk_metrics(self) -> Dict[str, float]:
        """Get risk metrics"""
        return {
            'var_95': -5000,
            'cvar_95': -7500,
            'sortino': 2.1,
            'calmar': 1.5,
            'beta': 1.15,
            'alpha': 8.5,
            'volatility': 18.2,
            'downside_dev': 12.3
        }

    def _get_period_returns(self) -> Dict[str, List]:
        """Get period returns data"""
        return {
            'Period': [
                '1 Day', '1 Week', '1 Month', '3 Months', '6 Months', '1 Year'], 'Return': [
                '0.85%', '2.3%', '5.2%', '12.8%', '28.5%', '45.2%'], 'Benchmark': [
                '0.45%', '1.8%', '3.9%', '9.2%', '18.3%', '32.1%'], 'Alpha': [
                    '0.40%', '0.5%', '1.3%', '3.6%', '10.2%', '13.1%']}

    def _get_recent_trades_analysis(self) -> pd.DataFrame:
        """Get recent trades analysis"""
        trades = []
        for i in range(10):
            trades.append({
                'Time': f"{9 + i}:30",
                'Symbol': ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][i % 3],
                'Side': ['Buy', 'Sell'][i % 2],
                'Entry': f"${45000 + np.random.randint(-1000, 1000)}",
                'Exit': f"${46000 + np.random.randint(-1000, 1000)}",
                'P&L': f"${np.random.randint(-500, 1500)}",
                'Return': f"{np.random.uniform(-2, 5):.2f}%",
                'Duration': f"{np.random.randint(1, 48)}h"
            })

        return pd.DataFrame(trades)

    def _export_analytics(self):
        """Export analytics report"""
        st.info("Generating analytics report...")

        # In production, this would generate a comprehensive report
        st.download_button(
            label="Download Analytics Report (PDF)",
            data=b"Analytics Report Content",
            file_name=f"analytics_report_{
                datetime.now().strftime('%Y%m%d')}.pdf",
            mime="application/pdf")
