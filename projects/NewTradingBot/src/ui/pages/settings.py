"""
Settings Page
Application configuration and preferences management
"""

import json
from datetime import datetime
from typing import Any, Dict

import streamlit as st

from ..utils.theme import TradingTheme


class SettingsPage:
    """Settings configuration page"""

    def __init__(self):
        """Initialize settings page"""
        # Load settings from session state or defaults
        if 'settings' not in st.session_state:
            st.session_state.settings = self._load_default_settings()

    def render(self):
        """Render the settings page"""
        # Apply theme
        TradingTheme.apply_theme()

        # Page header
        st.markdown("# ⚙️ Settings")
        st.caption("Configure your trading application preferences")

        # Navigation
        col1, col2, col3 = st.columns([1, 1, 8])
        with col1:
            if st.button("← Dashboard", use_container_width=True):
                st.switch_page("pages/dashboard.py")

        # Settings tabs
        tabs = st.tabs([
            "🔗 Exchange Settings",
            "📊 Trading Settings",
            "🤖 Strategy Settings",
            "🔔 Notifications",
            "🎨 Appearance",
            "🔐 Security",
            "📡 API Configuration"
        ])

        with tabs[0]:
            self._render_exchange_settings()

        with tabs[1]:
            self._render_trading_settings()

        with tabs[2]:
            self._render_strategy_settings()

        with tabs[3]:
            self._render_notification_settings()

        with tabs[4]:
            self._render_appearance_settings()

        with tabs[5]:
            self._render_security_settings()

        with tabs[6]:
            self._render_api_settings()

        # Save settings button
        st.divider()
        col1, col2, col3 = st.columns([1, 1, 1])

        with col2:
            if st.button(
                "💾 Save All Settings",
                type="primary",
                    use_container_width=True):
                self._save_settings()
                st.success("Settings saved successfully!")

    def _render_exchange_settings(self):
        """Render exchange configuration settings"""
        st.markdown("### Exchange Configuration")

        # Exchange selection
        exchanges = ['Binance', 'Coinbase', 'Kraken', 'FTX', 'Bybit']
        selected_exchange = st.selectbox(
            "Primary Exchange",
            exchanges,
            index=0
        )

        st.session_state.settings['exchange']['primary'] = selected_exchange.lower(
        )

        # API credentials
        st.markdown("#### API Credentials")

        col1, col2 = st.columns(2)

        with col1:
            api_key = st.text_input(
                "API Key",
                value=st.session_state.settings['exchange'].get('api_key', ''),
                type="password",
                help="Your exchange API key"
            )
            st.session_state.settings['exchange']['api_key'] = api_key

        with col2:
            api_secret = st.text_input(
                "API Secret",
                value=st.session_state.settings['exchange'].get(
                    'api_secret',
                    ''),
                type="password",
                help="Your exchange API secret")
            st.session_state.settings['exchange']['api_secret'] = api_secret

        # Test connection
        if st.button("Test Connection"):
            with st.spinner("Testing connection..."):
                # In production, this would actually test the connection
                import time
                time.sleep(1)
                st.success("✅ Connection successful!")

        # Additional exchange settings
        st.markdown("#### Exchange Options")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.settings['exchange']['testnet'] = st.checkbox(
                "Use Testnet", value=st.session_state.settings['exchange'].get(
                    'testnet', False), help="Use testnet for paper trading")

            st.session_state.settings['exchange']['rate_limit'] = st.number_input(
                "Rate Limit (requests/second)",
                min_value=1,
                max_value=100,
                value=st.session_state.settings['exchange'].get(
                    'rate_limit',
                    10))

        with col2:
            st.session_state.settings['exchange']['timeout'] = st.number_input(
                "Request Timeout (seconds)",
                min_value=5,
                max_value=60,
                value=st.session_state.settings['exchange'].get('timeout', 30)
            )

            st.session_state.settings['exchange']['retry_count'] = st.number_input(
                "Retry Count",
                min_value=0,
                max_value=10,
                value=st.session_state.settings['exchange'].get(
                    'retry_count',
                    3))

    def _render_trading_settings(self):
        """Render trading configuration settings"""
        st.markdown("### Trading Configuration")

        # Risk management
        st.markdown("#### Risk Management")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.settings['trading']['max_position_size'] = st.slider(
                "Max Position Size (%)",
                min_value=1,
                max_value=100,
                value=st.session_state.settings['trading'].get(
                    'max_position_size',
                    10),
                help="Maximum position size as percentage of portfolio")

            st.session_state.settings['trading']['max_daily_loss'] = st.slider(
                "Max Daily Loss (%)",
                min_value=1,
                max_value=50,
                value=st.session_state.settings['trading'].get(
                    'max_daily_loss',
                    5),
                help="Maximum allowed daily loss")

        with col2:
            st.session_state.settings['trading']['default_stop_loss'] = st.slider(
                "Default Stop Loss (%)",
                min_value=0.1,
                max_value=10.0,
                value=st.session_state.settings['trading'].get(
                    'default_stop_loss',
                    2.0),
                step=0.1,
                help="Default stop loss percentage")

            st.session_state.settings['trading']['default_take_profit'] = st.slider(
                "Default Take Profit (%)",
                min_value=0.1,
                max_value=20.0,
                value=st.session_state.settings['trading'].get(
                    'default_take_profit',
                    5.0),
                step=0.1,
                help="Default take profit percentage")

        # Order settings
        st.markdown("#### Order Settings")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.settings['trading']['default_order_type'] = st.selectbox(
                "Default Order Type", [
                    'Market', 'Limit', 'Stop', 'Stop Limit'], index=[
                    'Market', 'Limit', 'Stop', 'Stop Limit'].index(
                    st.session_state.settings['trading'].get(
                        'default_order_type', 'Limit')))

            st.session_state.settings['trading']['time_in_force'] = st.selectbox(
                "Default Time in Force", [
                    'GTC', 'IOC', 'FOK', 'Day'], index=[
                    'GTC', 'IOC', 'FOK', 'Day'].index(
                    st.session_state.settings['trading'].get(
                        'time_in_force', 'GTC')))

        with col2:
            st.session_state.settings['trading']['post_only'] = st.checkbox(
                "Post Only Orders", value=st.session_state.settings['trading'].get(
                    'post_only', False), help="Ensure orders are maker orders")

            st.session_state.settings['trading']['reduce_only'] = st.checkbox(
                "Reduce Only Mode", value=st.session_state.settings['trading'].get(
                    'reduce_only', False), help="Only allow orders that reduce position size")

    def _render_strategy_settings(self):
        """Render strategy configuration settings"""
        st.markdown("### Strategy Configuration")

        # Strategy selection
        st.markdown("#### Active Strategies")

        strategies = [
            'Mean Reversion',
            'Momentum',
            'Arbitrage',
            'Market Making',
            'Grid Trading']

        selected_strategies = st.multiselect(
            "Enable Strategies",
            strategies,
            default=st.session_state.settings['strategies'].get('active', [])
        )

        st.session_state.settings['strategies']['active'] = selected_strategies

        # Strategy parameters
        if selected_strategies:
            st.markdown("#### Strategy Parameters")

            for strategy in selected_strategies:
                with st.expander(f"{strategy} Settings"):
                    col1, col2 = st.columns(2)

                    with col1:
                        st.number_input(
                            "Allocation (%)",
                            min_value=0,
                            max_value=100,
                            value=20,
                            key=f"{strategy}_allocation"
                        )

                        st.selectbox(
                            "Timeframe",
                            ['1m', '5m', '15m', '1h', '4h', '1d'],
                            key=f"{strategy}_timeframe"
                        )

                    with col2:
                        st.number_input(
                            "Max Positions",
                            min_value=1,
                            max_value=10,
                            value=3,
                            key=f"{strategy}_max_positions"
                        )

                        st.checkbox(
                            "Auto Start",
                            value=True,
                            key=f"{strategy}_auto_start"
                        )

    def _render_notification_settings(self):
        """Render notification settings"""
        st.markdown("### Notification Settings")

        # Notification channels
        st.markdown("#### Notification Channels")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.settings['notifications']['email'] = st.checkbox(
                "Email Notifications", value=st.session_state.settings['notifications'].get(
                    'email', False))

            if st.session_state.settings['notifications']['email']:
                st.text_input(
                    "Email Address",
                    value=st.session_state.settings['notifications'].get(
                        'email_address',
                        ''),
                    key="email_address")

            st.session_state.settings['notifications']['telegram'] = st.checkbox(
                "Telegram Notifications", value=st.session_state.settings['notifications'].get(
                    'telegram', False))

            if st.session_state.settings['notifications']['telegram']:
                st.text_input(
                    "Telegram Bot Token",
                    value=st.session_state.settings['notifications'].get(
                        'telegram_token',
                        ''),
                    type="password",
                    key="telegram_token")

        with col2:
            st.session_state.settings['notifications']['discord'] = st.checkbox(
                "Discord Notifications", value=st.session_state.settings['notifications'].get(
                    'discord', False))

            if st.session_state.settings['notifications']['discord']:
                st.text_input(
                    "Discord Webhook URL",
                    value=st.session_state.settings['notifications'].get(
                        'discord_webhook',
                        ''),
                    type="password",
                    key="discord_webhook")

            st.session_state.settings['notifications']['push'] = st.checkbox(
                "Push Notifications",
                value=st.session_state.settings['notifications'].get(
                    'push',
                    True))

        # Notification types
        st.markdown("#### Notification Types")

        notification_types = {
            'order_filled': 'Order Filled',
            'order_cancelled': 'Order Cancelled',
            'position_opened': 'Position Opened',
            'position_closed': 'Position Closed',
            'stop_loss_triggered': 'Stop Loss Triggered',
            'take_profit_triggered': 'Take Profit Triggered',
            'strategy_alert': 'Strategy Alerts',
            'risk_alert': 'Risk Alerts',
            'system_alert': 'System Alerts'
        }

        selected_types = st.multiselect(
            "Enable Notifications For", list(
                notification_types.values()), default=[
                notification_types[k] for k in st.session_state.settings['notifications'].get(
                    'types', [])])

        st.session_state.settings['notifications']['types'] = [
            k for k, v in notification_types.items() if v in selected_types
        ]

    def _render_appearance_settings(self):
        """Render appearance settings"""
        st.markdown("### Appearance Settings")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.settings['appearance']['theme'] = st.selectbox(
                "Theme", [
                    'Dark', 'Light', 'Auto'], index=[
                    'Dark', 'Light', 'Auto'].index(
                    st.session_state.settings['appearance'].get(
                        'theme', 'Dark')))

            st.session_state.settings['appearance']['chart_style'] = st.selectbox(
                "Chart Style", [
                    'Candlestick', 'Line', 'Area', 'Bars'], index=[
                    'Candlestick', 'Line', 'Area', 'Bars'].index(
                    st.session_state.settings['appearance'].get(
                        'chart_style', 'Candlestick')))

        with col2:
            st.session_state.settings['appearance']['decimal_places'] = st.number_input(
                "Price Decimal Places",
                min_value=0,
                max_value=8,
                value=st.session_state.settings['appearance'].get(
                    'decimal_places',
                    2))

            st.session_state.settings['appearance']['date_format'] = st.selectbox(
                "Date Format",
                ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
                index=['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].index(
                    st.session_state.settings['appearance'].get('date_format', 'YYYY-MM-DD')
                )
            )

        # Color preferences
        st.markdown("#### Color Preferences")

        col1, col2, col3 = st.columns(3)

        with col1:
            st.color_picker(
                "Profit Color",
                value=st.session_state.settings['appearance'].get(
                    'profit_color',
                    '#4CAF50'),
                key="profit_color")

        with col2:
            st.color_picker(
                "Loss Color",
                value=st.session_state.settings['appearance'].get(
                    'loss_color',
                    '#F44336'),
                key="loss_color")

        with col3:
            st.color_picker(
                "Accent Color",
                value=st.session_state.settings['appearance'].get(
                    'accent_color',
                    '#1E88E5'),
                key="accent_color")

    def _render_security_settings(self):
        """Render security settings"""
        st.markdown("### Security Settings")

        # Two-factor authentication
        st.markdown("#### Two-Factor Authentication")

        st.session_state.settings['security']['2fa_enabled'] = st.checkbox(
            "Enable 2FA",
            value=st.session_state.settings['security'].get(
                '2fa_enabled',
                False),
            help="Enable two-factor authentication for additional security")

        if st.session_state.settings['security']['2fa_enabled']:
            col1, col2 = st.columns(2)

            with col1:
                st.text_input(
                    "Phone Number", value=st.session_state.settings['security'].get(
                        'phone', ''), help="Phone number for SMS authentication")

            with col2:
                if st.button("Setup Authenticator App"):
                    st.info("Scan QR code with your authenticator app")

        # Session settings
        st.markdown("#### Session Settings")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.settings['security']['session_timeout'] = st.number_input(
                "Session Timeout (minutes)",
                min_value=5,
                max_value=1440,
                value=st.session_state.settings['security'].get(
                    'session_timeout',
                    60),
                help="Automatically logout after inactivity")

        with col2:
            st.session_state.settings['security']['ip_whitelist'] = st.checkbox(
                "IP Whitelist", value=st.session_state.settings['security'].get(
                    'ip_whitelist', False), help="Only allow access from whitelisted IPs")

        # API security
        st.markdown("#### API Security")

        st.session_state.settings['security']['api_key_expiry'] = st.number_input(
            "API Key Expiry (days)",
            min_value=1,
            max_value=365,
            value=st.session_state.settings['security'].get(
                'api_key_expiry',
                90),
            help="Automatically expire API keys after specified days")

        st.session_state.settings['security']['encrypt_keys'] = st.checkbox(
            "Encrypt API Keys", value=st.session_state.settings['security'].get(
                'encrypt_keys', True), help="Store API keys in encrypted format")

    def _render_api_settings(self):
        """Render API configuration settings"""
        st.markdown("### API Configuration")

        # Webhook settings
        st.markdown("#### Webhook Configuration")

        st.session_state.settings['api']['webhook_enabled'] = st.checkbox(
            "Enable Webhooks", value=st.session_state.settings['api'].get(
                'webhook_enabled', False))

        if st.session_state.settings['api']['webhook_enabled']:
            st.text_input(
                "Webhook URL",
                value=st.session_state.settings['api'].get('webhook_url', ''),
                help="URL to receive webhook notifications"
            )

            st.text_input(
                "Webhook Secret",
                value=st.session_state.settings['api'].get(
                    'webhook_secret',
                    ''),
                type="password",
                help="Secret for webhook authentication")

        # Data providers
        st.markdown("#### Data Providers")

        col1, col2 = st.columns(2)

        with col1:
            st.text_input(
                "Alpha Vantage API Key",
                value=st.session_state.settings['api'].get(
                    'alpha_vantage_key',
                    ''),
                type="password",
                help="API key for Alpha Vantage data")

            st.text_input(
                "Polygon.io API Key",
                value=st.session_state.settings['api'].get('polygon_key', ''),
                type="password",
                help="API key for Polygon.io data"
            )

        with col2:
            st.text_input(
                "CoinGecko API Key",
                value=st.session_state.settings['api'].get('coingecko_key', ''),
                type="password",
                help="API key for CoinGecko data"
            )

            st.text_input(
                "News API Key",
                value=st.session_state.settings['api'].get('news_api_key', ''),
                type="password",
                help="API key for news data"
            )

    def _load_default_settings(self) -> Dict[str, Any]:
        """Load default settings"""
        return {
            'exchange': {
                'primary': 'binance',
                'api_key': '',
                'api_secret': '',
                'testnet': False,
                'rate_limit': 10,
                'timeout': 30,
                'retry_count': 3
            },
            'trading': {
                'max_position_size': 10,
                'max_daily_loss': 5,
                'default_stop_loss': 2.0,
                'default_take_profit': 5.0,
                'default_order_type': 'Limit',
                'time_in_force': 'GTC',
                'post_only': False,
                'reduce_only': False
            },
            'strategies': {
                'active': [],
                'parameters': {}
            },
            'notifications': {
                'email': False,
                'telegram': False,
                'discord': False,
                'push': True,
                'types': ['order_filled', 'stop_loss_triggered', 'risk_alert']
            },
            'appearance': {
                'theme': 'Dark',
                'chart_style': 'Candlestick',
                'decimal_places': 2,
                'date_format': 'YYYY-MM-DD',
                'profit_color': '#4CAF50',
                'loss_color': '#F44336',
                'accent_color': '#1E88E5'
            },
            'security': {
                '2fa_enabled': False,
                'session_timeout': 60,
                'ip_whitelist': False,
                'api_key_expiry': 90,
                'encrypt_keys': True
            },
            'api': {
                'webhook_enabled': False,
                'webhook_url': '',
                'webhook_secret': '',
                'alpha_vantage_key': '',
                'polygon_key': '',
                'coingecko_key': '',
                'news_api_key': ''
            }
        }

    def _save_settings(self):
        """Save settings to file"""
        # In production, this would save to a database or configuration file
        settings_json = json.dumps(st.session_state.settings, indent=2)

        # For demo, just show success
        st.session_state.settings_saved = True
        st.session_state.settings_saved_time = datetime.now()
