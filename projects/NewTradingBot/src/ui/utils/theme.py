"""
UI Theme and Styling Configuration
Provides consistent theming, colors, and styling for the trading application
"""

import streamlit as st
from typing import Dict, Any


class TradingTheme:
    """Manages UI theme and styling configuration"""
    
    # Color Palette
    COLORS = {
        # Primary colors
        'primary': '#1E88E5',
        'primary_dark': '#1565C0',
        'primary_light': '#42A5F5',
        
        # Status colors
        'success': '#4CAF50',
        'warning': '#FF9800',
        'danger': '#F44336',
        'info': '#2196F3',
        
        # Trading specific
        'buy': '#4CAF50',
        'sell': '#F44336',
        'profit': '#4CAF50',
        'loss': '#F44336',
        
        # Chart colors
        'chart_bg': '#1E1E1E',
        'chart_grid': '#2D2D2D',
        'chart_text': '#E0E0E0',
        'candle_up': '#26A69A',
        'candle_down': '#EF5350',
        
        # Background colors
        'bg_primary': '#0E1117',
        'bg_secondary': '#262730',
        'bg_card': '#1A1B21',
        
        # Text colors
        'text_primary': '#FFFFFF',
        'text_secondary': '#B0B0B0',
        'text_muted': '#808080',
    }
    
    # Chart themes
    CHART_THEMES = {
        'dark': {
            'layout': {
                'paper_bgcolor': '#0E1117',
                'plot_bgcolor': '#1A1B21',
                'font': {'color': '#E0E0E0'},
                'xaxis': {
                    'gridcolor': '#2D2D2D',
                    'showgrid': True,
                    'zeroline': False,
                },
                'yaxis': {
                    'gridcolor': '#2D2D2D',
                    'showgrid': True,
                    'zeroline': False,
                },
                'margin': {'l': 10, 'r': 10, 't': 30, 'b': 10},
                'hovermode': 'x unified',
            },
            'config': {
                'displayModeBar': True,
                'displaylogo': False,
                'modeBarButtonsToRemove': ['pan2d', 'lasso2d'],
            }
        },
        'light': {
            'layout': {
                'paper_bgcolor': '#FFFFFF',
                'plot_bgcolor': '#F5F5F5',
                'font': {'color': '#333333'},
                'xaxis': {
                    'gridcolor': '#E0E0E0',
                    'showgrid': True,
                    'zeroline': False,
                },
                'yaxis': {
                    'gridcolor': '#E0E0E0',
                    'showgrid': True,
                    'zeroline': False,
                },
                'margin': {'l': 10, 'r': 10, 't': 30, 'b': 10},
                'hovermode': 'x unified',
            },
            'config': {
                'displayModeBar': True,
                'displaylogo': False,
                'modeBarButtonsToRemove': ['pan2d', 'lasso2d'],
            }
        }
    }
    
    @classmethod
    def apply_theme(cls):
        """Apply custom CSS theme to Streamlit app"""
        st.markdown(f"""
        <style>
            /* Main app styling */
            .stApp {{
                background-color: {cls.COLORS['bg_primary']};
            }}
            
            /* Sidebar styling */
            section[data-testid="stSidebar"] {{
                background-color: {cls.COLORS['bg_secondary']};
            }}
            
            /* Card styling */
            .css-1r6slb0 {{
                background-color: {cls.COLORS['bg_card']};
                border-radius: 10px;
                padding: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            
            /* Metric styling */
            [data-testid="metric-container"] {{
                background-color: {cls.COLORS['bg_card']};
                border: 1px solid {cls.COLORS['chart_grid']};
                padding: 1rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            
            /* Button styling */
            .stButton > button {{
                background-color: {cls.COLORS['primary']};
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                font-weight: 500;
                transition: all 0.3s;
            }}
            
            .stButton > button:hover {{
                background-color: {cls.COLORS['primary_dark']};
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }}
            
            /* Success button */
            .buy-button > button {{
                background-color: {cls.COLORS['buy']} !important;
            }}
            
            /* Danger button */
            .sell-button > button {{
                background-color: {cls.COLORS['sell']} !important;
            }}
            
            /* Tab styling */
            .stTabs [data-baseweb="tab-list"] {{
                background-color: {cls.COLORS['bg_secondary']};
                border-radius: 8px;
            }}
            
            .stTabs [data-baseweb="tab"] {{
                color: {cls.COLORS['text_secondary']};
                font-weight: 500;
            }}
            
            .stTabs [aria-selected="true"] {{
                background-color: {cls.COLORS['primary']};
                color: white !important;
            }}
            
            /* Dataframe styling */
            .dataframe {{
                background-color: {cls.COLORS['bg_card']};
                border: 1px solid {cls.COLORS['chart_grid']};
            }}
            
            /* Profit/Loss coloring */
            .profit {{
                color: {cls.COLORS['profit']};
                font-weight: bold;
            }}
            
            .loss {{
                color: {cls.COLORS['loss']};
                font-weight: bold;
            }}
            
            /* Alert boxes */
            .success-box {{
                background-color: rgba(76, 175, 80, 0.1);
                border-left: 4px solid {cls.COLORS['success']};
                padding: 1rem;
                border-radius: 5px;
                margin: 1rem 0;
            }}
            
            .warning-box {{
                background-color: rgba(255, 152, 0, 0.1);
                border-left: 4px solid {cls.COLORS['warning']};
                padding: 1rem;
                border-radius: 5px;
                margin: 1rem 0;
            }}
            
            .error-box {{
                background-color: rgba(244, 67, 54, 0.1);
                border-left: 4px solid {cls.COLORS['danger']};
                padding: 1rem;
                border-radius: 5px;
                margin: 1rem 0;
            }}
            
            /* Loading spinner */
            .stSpinner > div {{
                border-color: {cls.COLORS['primary']} !important;
            }}
            
            /* Progress bar */
            .stProgress > div > div > div > div {{
                background-color: {cls.COLORS['primary']};
            }}
            
            /* Custom scrollbar */
            ::-webkit-scrollbar {{
                width: 10px;
                height: 10px;
            }}
            
            ::-webkit-scrollbar-track {{
                background: {cls.COLORS['bg_secondary']};
            }}
            
            ::-webkit-scrollbar-thumb {{
                background: {cls.COLORS['primary']};
                border-radius: 5px;
            }}
            
            ::-webkit-scrollbar-thumb:hover {{
                background: {cls.COLORS['primary_dark']};
            }}
        </style>
        """, unsafe_allow_html=True)
    
    @classmethod
    def get_chart_theme(cls, theme: str = 'dark') -> Dict[str, Any]:
        """Get chart theme configuration"""
        return cls.CHART_THEMES.get(theme, cls.CHART_THEMES['dark'])
    
    @classmethod
    def format_pnl(cls, value: float, show_percentage: bool = True) -> str:
        """Format P&L value with appropriate color"""
        if value >= 0:
            color = cls.COLORS['profit']
            prefix = '+'
        else:
            color = cls.COLORS['loss']
            prefix = ''
        
        if show_percentage:
            text = f"{prefix}{value:.2f}%"
        else:
            text = f"${prefix}{value:,.2f}"
        
        return f'<span style="color: {color}; font-weight: bold;">{text}</span>'
    
    @classmethod
    def format_status(cls, status: str) -> str:
        """Format status badge with appropriate color"""
        status_colors = {
            'active': cls.COLORS['success'],
            'pending': cls.COLORS['warning'],
            'cancelled': cls.COLORS['text_muted'],
            'filled': cls.COLORS['info'],
            'error': cls.COLORS['danger'],
        }
        
        color = status_colors.get(status.lower(), cls.COLORS['text_secondary'])
        return f'<span style="background-color: {color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">{status.upper()}</span>'
    
    @classmethod
    def create_gradient_background(cls, start_color: str, end_color: str, direction: str = 'to right') -> str:
        """Create CSS gradient background"""
        return f"linear-gradient({direction}, {start_color}, {end_color})"