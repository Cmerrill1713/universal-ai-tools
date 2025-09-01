"""
Main Streamlit Application Entry Point
Initializes and runs the NewTradingBot Streamlit UI
"""

import streamlit as st
import sys
import os
from pathlib import Path
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional

# Add src directory to path for imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Import UI pages
from ui.pages.dashboard import DashboardPage
from ui.pages.portfolio import PortfolioPage
from ui.pages.settings import SettingsPage
from ui.pages.analytics import AnalyticsPage
from ui.utils.theme import TradingTheme

# Import backend services (when available)
try:
    from core.strategy.strategy_base import StrategyBase
    from data.market_data import MarketDataManager
    from domain.portfolio import Portfolio
    BACKEND_AVAILABLE = True
except ImportError:
    BACKEND_AVAILABLE = False


class TradingBotApp:
    """Main Streamlit trading bot application"""
    
    def __init__(self):
        """Initialize the trading bot application"""
        self.setup_page_config()
        self.initialize_session_state()
        self.setup_logging()
        
        # Initialize pages
        self.dashboard_page = DashboardPage()
        self.portfolio_page = PortfolioPage()
        self.settings_page = SettingsPage()
        self.analytics_page = AnalyticsPage()
        
        # Initialize backend services if available
        if BACKEND_AVAILABLE:
            self.initialize_backend_services()
    
    def setup_page_config(self):
        """Configure Streamlit page settings"""
        st.set_page_config(
            page_title="NewTradingBot",
            page_icon="🚀",
            layout="wide",
            initial_sidebar_state="expanded",
            menu_items={
                'Get Help': 'https://github.com/your-repo/NewTradingBot',
                'Report a bug': 'https://github.com/your-repo/NewTradingBot/issues',
                'About': """
                # NewTradingBot
                
                Advanced AI-powered trading platform with:
                - Real-time market data and charts
                - Automated trading strategies
                - Portfolio management and analytics
                - Risk management and position sizing
                - Multi-exchange support
                
                Built with Streamlit, Python, and modern trading APIs.
                """
            }
        )
    
    def initialize_session_state(self):
        """Initialize session state variables"""
        # Application state
        if 'app_initialized' not in st.session_state:
            st.session_state.app_initialized = True
            st.session_state.start_time = datetime.now()
        
        # Navigation state
        if 'current_page' not in st.session_state:
            st.session_state.current_page = 'Dashboard'
        
        # User preferences
        if 'user_preferences' not in st.session_state:
            st.session_state.user_preferences = {
                'theme': 'dark',
                'auto_refresh': False,
                'notifications_enabled': True,
                'sound_alerts': False
            }
        
        # Trading state
        if 'trading_state' not in st.session_state:
            st.session_state.trading_state = {
                'connected': False,
                'paper_trading': True,
                'active_strategies': [],
                'last_update': None
            }
        
        # Portfolio state
        if 'portfolio_state' not in st.session_state:
            st.session_state.portfolio_state = {
                'total_value': 100000.0,
                'available_balance': 50000.0,
                'positions': [],
                'orders': [],
                'trades': []
            }
    
    def setup_logging(self):
        """Setup application logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('logs/trading_bot.log'),
                logging.StreamHandler()
            ]
        )
        
        self.logger = logging.getLogger(__name__)
        self.logger.info("NewTradingBot application initialized")
    
    def initialize_backend_services(self):
        """Initialize backend trading services"""
        try:
            # Initialize market data manager
            if 'market_data_manager' not in st.session_state:
                st.session_state.market_data_manager = MarketDataManager()
            
            # Initialize portfolio
            if 'portfolio' not in st.session_state:
                st.session_state.portfolio = Portfolio(
                    initial_balance=st.session_state.portfolio_state['total_value']
                )
            
            self.logger.info("Backend services initialized successfully")
            st.session_state.trading_state['connected'] = True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize backend services: {e}")
            st.session_state.trading_state['connected'] = False
    
    def render_sidebar(self):
        """Render the application sidebar"""
        with st.sidebar:
            # App header
            st.markdown("# 🚀 NewTradingBot")
            st.caption(f"v1.0 | {st.session_state.start_time.strftime('%Y-%m-%d')}")
            
            # Connection status
            status_color = "🟢" if st.session_state.trading_state['connected'] else "🔴"
            mode = "Paper Trading" if st.session_state.trading_state['paper_trading'] else "Live Trading"
            st.info(f"{status_color} {mode}")
            
            # Navigation
            st.markdown("## Navigation")
            
            pages = {
                'Dashboard': '📊',
                'Portfolio': '💼',
                'Analytics': '📈',
                'Settings': '⚙️'
            }
            
            for page_name, icon in pages.items():
                if st.button(f"{icon} {page_name}", use_container_width=True,
                           type="primary" if st.session_state.current_page == page_name else "secondary"):
                    st.session_state.current_page = page_name
                    st.rerun()
            
            st.divider()
            
            # Quick stats
            st.markdown("## Quick Stats")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.metric(
                    "Portfolio",
                    f"${st.session_state.portfolio_state['total_value']:,.0f}",
                    delta="1.2%",
                    delta_color="normal"
                )
            
            with col2:
                st.metric(
                    "Available",
                    f"${st.session_state.portfolio_state['available_balance']:,.0f}",
                    delta=None
                )
            
            # Active positions count
            positions_count = len(st.session_state.portfolio_state['positions'])
            orders_count = len(st.session_state.portfolio_state['orders'])
            
            st.metric("Positions", positions_count)
            st.metric("Orders", orders_count)
            
            st.divider()
            
            # System controls
            st.markdown("## System")
            
            if st.button("🔄 Refresh Data", use_container_width=True):
                self.refresh_data()
            
            if st.button("🛑 Emergency Stop", use_container_width=True, type="secondary"):
                self.emergency_stop()
            
            # Settings toggle
            col1, col2 = st.columns(2)
            
            with col1:
                st.session_state.user_preferences['auto_refresh'] = st.checkbox(
                    "Auto Refresh",
                    value=st.session_state.user_preferences['auto_refresh']
                )
            
            with col2:
                st.session_state.user_preferences['notifications_enabled'] = st.checkbox(
                    "Notifications",
                    value=st.session_state.user_preferences['notifications_enabled']
                )
            
            # Footer
            st.markdown("---")
            st.caption(f"Uptime: {self.get_uptime()}")
            st.caption("© 2024 NewTradingBot")
    
    def render_main_content(self):
        """Render main application content based on current page"""
        # Apply global theme
        TradingTheme.apply_theme()
        
        # Route to appropriate page
        if st.session_state.current_page == 'Dashboard':
            self.dashboard_page.render()
        
        elif st.session_state.current_page == 'Portfolio':
            self.portfolio_page.render()
        
        elif st.session_state.current_page == 'Analytics':
            self.analytics_page.render()
        
        elif st.session_state.current_page == 'Settings':
            self.settings_page.render()
        
        else:
            st.error(f"Unknown page: {st.session_state.current_page}")
    
    def render_footer(self):
        """Render application footer"""
        st.markdown("---")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.caption(f"Last Update: {datetime.now().strftime('%H:%M:%S')}")
        
        with col2:
            latency = self.get_system_latency()
            st.caption(f"Latency: {latency}ms")
        
        with col3:
            memory_usage = self.get_memory_usage()
            st.caption(f"Memory: {memory_usage}%")
        
        with col4:
            if st.session_state.user_preferences['notifications_enabled']:
                notifications_count = self.get_notifications_count()
                if notifications_count > 0:
                    st.caption(f"🔔 {notifications_count} new alerts")
    
    def refresh_data(self):
        """Refresh application data"""
        with st.spinner("Refreshing data..."):
            try:
                # Update trading state
                st.session_state.trading_state['last_update'] = datetime.now()
                
                # Refresh market data if backend available
                if BACKEND_AVAILABLE and 'market_data_manager' in st.session_state:
                    # In production, this would fetch real market data
                    pass
                
                # Refresh portfolio data
                if BACKEND_AVAILABLE and 'portfolio' in st.session_state:
                    # In production, this would update portfolio positions
                    pass
                
                st.success("Data refreshed successfully!")
                self.logger.info("Data refresh completed")
                
            except Exception as e:
                st.error(f"Failed to refresh data: {e}")
                self.logger.error(f"Data refresh failed: {e}")
    
    def emergency_stop(self):
        """Emergency stop all trading activities"""
        with st.spinner("Executing emergency stop..."):
            try:
                # Cancel all orders
                st.session_state.portfolio_state['orders'] = []
                
                # Stop all strategies
                st.session_state.trading_state['active_strategies'] = []
                
                # Close all positions (in paper trading mode)
                if st.session_state.trading_state['paper_trading']:
                    st.session_state.portfolio_state['positions'] = []
                
                st.warning("🛑 Emergency stop executed - All activities halted")
                self.logger.warning("Emergency stop executed by user")
                
            except Exception as e:
                st.error(f"Emergency stop failed: {e}")
                self.logger.error(f"Emergency stop failed: {e}")
    
    def get_uptime(self) -> str:
        """Get application uptime"""
        uptime = datetime.now() - st.session_state.start_time
        
        days = uptime.days
        hours, remainder = divmod(uptime.seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    
    def get_system_latency(self) -> int:
        """Get system latency (simulated)"""
        import random
        return random.randint(15, 45)
    
    def get_memory_usage(self) -> int:
        """Get memory usage percentage (simulated)"""
        import random
        return random.randint(25, 75)
    
    def get_notifications_count(self) -> int:
        """Get count of unread notifications"""
        # In production, this would check for real notifications
        return 0
    
    def run(self):
        """Run the main application"""
        try:
            # Render sidebar
            self.render_sidebar()
            
            # Render main content
            self.render_main_content()
            
            # Render footer
            self.render_footer()
            
            # Auto-refresh logic
            if st.session_state.user_preferences['auto_refresh']:
                # Use Streamlit's native rerun with a delay
                import time
                time.sleep(5)
                st.rerun()
                
        except Exception as e:
            st.error(f"Application error: {e}")
            self.logger.error(f"Application error: {e}")
            
            # Show error details in expander for debugging
            with st.expander("Error Details"):
                import traceback
                st.code(traceback.format_exc())


def main():
    """Main entry point"""
    try:
        # Initialize and run the trading bot app
        app = TradingBotApp()
        app.run()
        
    except Exception as e:
        st.error(f"Failed to start NewTradingBot: {e}")
        
        # Show startup error details
        with st.expander("Startup Error Details"):
            import traceback
            st.code(traceback.format_exc())


if __name__ == "__main__":
    main()