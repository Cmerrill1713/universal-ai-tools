"""
Order Entry Form Component
Provides an intuitive interface for placing trading orders
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, Optional

import streamlit as st

from ..utils.formatters import DataFormatter
from ..utils.theme import TradingTheme


class OrderType(Enum):
    """Order types"""
    MARKET = "Market"
    LIMIT = "Limit"
    STOP = "Stop"
    STOP_LIMIT = "Stop Limit"
    TRAILING_STOP = "Trailing Stop"
    OCO = "OCO (One-Cancels-Other)"
    ICEBERG = "Iceberg"


class OrderSide(Enum):
    """Order sides"""
    BUY = "Buy"
    SELL = "Sell"


class TimeInForce(Enum):
    """Time in force options"""
    GTC = "GTC (Good Till Cancel)"
    IOC = "IOC (Immediate or Cancel)"
    FOK = "FOK (Fill or Kill)"
    GTD = "GTD (Good Till Date)"
    DAY = "Day"


class OrderForm:
    """Order entry form component"""

    def __init__(self, on_submit: Optional[Callable] = None):
        """
        Initialize order form

        Args:
            on_submit: Callback function when order is submitted
        """
        self.on_submit = on_submit
        self.formatter = DataFormatter()

        # Initialize session state
        if 'order_form' not in st.session_state:
            st.session_state.order_form = {
                'symbol': 'BTC/USDT',
                'side': OrderSide.BUY.value,
                'type': OrderType.LIMIT.value,
                'quantity': 0.0,
                'price': 0.0,
                'stop_price': 0.0,
                'time_in_force': TimeInForce.GTC.value,
                'reduce_only': False,
                'post_only': False,
                'advanced_settings': False
            }

        if 'order_validation' not in st.session_state:
            st.session_state.order_validation = {
                'is_valid': False,
                'errors': [],
                'warnings': []
            }

    def render(
            self,
            available_balance: float = 10000.0,
            current_price: float = 100.0):
        """
        Render the order form

        Args:
            available_balance: Available balance for trading
            current_price: Current market price
        """
        # Apply theme
        TradingTheme.apply_theme()

        # Order form container
        with st.container():
            st.markdown("### 📊 Place Order")

            # Quick trade buttons
            self._render_quick_trade_buttons(current_price)

            # Main order form
            col1, col2 = st.columns(2)

            with col1:
                self._render_order_side()
                self._render_order_type()
                self._render_quantity_input(available_balance, current_price)

            with col2:
                self._render_price_inputs(current_price)
                self._render_time_in_force()
                self._render_order_options()

            # Advanced settings
            if st.checkbox(
                "Advanced Settings",
                    value=st.session_state.order_form['advanced_settings']):
                self._render_advanced_settings()

            # Order summary
            self._render_order_summary(current_price, available_balance)

            # Validation messages
            self._render_validation_messages()

            # Submit buttons
            self._render_submit_buttons()

    def _render_quick_trade_buttons(self, current_price: float):
        """Render quick trade action buttons"""
        st.markdown("#### Quick Trade")

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            if st.button(
                "🟢 Market Buy",
                use_container_width=True,
                    key="quick_buy"):
                st.session_state.order_form['side'] = OrderSide.BUY.value
                st.session_state.order_form['type'] = OrderType.MARKET.value
                self._submit_order()

        with col2:
            if st.button(
                "🔴 Market Sell",
                use_container_width=True,
                    key="quick_sell"):
                st.session_state.order_form['side'] = OrderSide.SELL.value
                st.session_state.order_form['type'] = OrderType.MARKET.value
                self._submit_order()

        with col3:
            if st.button(
                "📈 Limit Buy -1%",
                use_container_width=True,
                    key="limit_buy"):
                st.session_state.order_form['side'] = OrderSide.BUY.value
                st.session_state.order_form['type'] = OrderType.LIMIT.value
                st.session_state.order_form['price'] = current_price * 0.99

        with col4:
            if st.button(
                "📉 Limit Sell +1%",
                use_container_width=True,
                    key="limit_sell"):
                st.session_state.order_form['side'] = OrderSide.SELL.value
                st.session_state.order_form['type'] = OrderType.LIMIT.value
                st.session_state.order_form['price'] = current_price * 1.01

        st.divider()

    def _render_order_side(self):
        """Render order side selection"""
        st.markdown("**Order Side**")

        col1, col2 = st.columns(2)

        with col1:
            if st.button(
                "🟢 BUY",
                use_container_width=True,
                key="side_buy",
                type="primary" if st.session_state.order_form['side'] == OrderSide.BUY.value else "secondary"
            ):
                st.session_state.order_form['side'] = OrderSide.BUY.value

        with col2:
            if st.button(
                "🔴 SELL",
                use_container_width=True,
                key="side_sell",
                type="primary" if st.session_state.order_form['side'] == OrderSide.SELL.value else "secondary"
            ):
                st.session_state.order_form['side'] = OrderSide.SELL.value

    def _render_order_type(self):
        """Render order type selection"""
        order_types = [t.value for t in OrderType]

        st.session_state.order_form['type'] = st.selectbox(
            "Order Type",
            order_types,
            index=order_types.index(st.session_state.order_form['type']),
            help="Select the type of order to place"
        )

    def _render_quantity_input(
            self,
            available_balance: float,
            current_price: float):
        """Render quantity input with percentage buttons"""
        st.markdown("**Quantity**")

        # Percentage buttons
        col1, col2, col3, col4 = st.columns(4)

        max_quantity = available_balance / current_price if current_price > 0 else 0

        with col1:
            if st.button("25%", use_container_width=True, key="qty_25"):
                st.session_state.order_form['quantity'] = max_quantity * 0.25

        with col2:
            if st.button("50%", use_container_width=True, key="qty_50"):
                st.session_state.order_form['quantity'] = max_quantity * 0.50

        with col3:
            if st.button("75%", use_container_width=True, key="qty_75"):
                st.session_state.order_form['quantity'] = max_quantity * 0.75

        with col4:
            if st.button("100%", use_container_width=True, key="qty_100"):
                st.session_state.order_form['quantity'] = max_quantity

        # Quantity input
        st.session_state.order_form['quantity'] = st.number_input(
            "Amount",
            min_value=0.0,
            max_value=max_quantity,
            value=st.session_state.order_form['quantity'],
            step=0.001,
            format="%.8f",
            label_visibility="collapsed"
        )

    def _render_price_inputs(self, current_price: float):
        """Render price input fields based on order type"""
        order_type = st.session_state.order_form['type']

        if order_type in [OrderType.LIMIT.value, OrderType.STOP_LIMIT.value]:
            st.session_state.order_form['price'] = st.number_input(
                "Limit Price",
                min_value=0.0,
                value=st.session_state.order_form['price'] or current_price,
                step=0.01,
                format="%.2f",
                help="The price at which to place the limit order"
            )

        if order_type in [
                OrderType.STOP.value,
                OrderType.STOP_LIMIT.value,
                OrderType.TRAILING_STOP.value]:
            st.session_state.order_form['stop_price'] = st.number_input(
                "Stop Price" if order_type != OrderType.TRAILING_STOP.value else "Trail Amount",
                min_value=0.0,
                value=st.session_state.order_form['stop_price'],
                step=0.01,
                format="%.2f",
                help="The trigger price for the stop order")

    def _render_time_in_force(self):
        """Render time in force selection"""
        tif_options = [t.value for t in TimeInForce]

        st.session_state.order_form['time_in_force'] = st.selectbox(
            "Time in Force",
            tif_options,
            index=tif_options.index(
                st.session_state.order_form['time_in_force']),
            help="How long the order remains active")

        # If GTD selected, show date picker
        if st.session_state.order_form['time_in_force'] == TimeInForce.GTD.value:
            st.date_input(
                "Expiry Date",
                value=datetime.now() + timedelta(days=1),
                min_value=datetime.now(),
                max_value=datetime.now() + timedelta(days=30)
            )

    def _render_order_options(self):
        """Render additional order options"""
        st.markdown("**Order Options**")

        col1, col2 = st.columns(2)

        with col1:
            st.session_state.order_form['reduce_only'] = st.checkbox(
                "Reduce Only",
                value=st.session_state.order_form['reduce_only'],
                help="Only reduce existing position"
            )

        with col2:
            st.session_state.order_form['post_only'] = st.checkbox(
                "Post Only",
                value=st.session_state.order_form['post_only'],
                help="Ensure order is added to order book"
            )

    def _render_advanced_settings(self):
        """Render advanced order settings"""
        with st.expander("⚙️ Advanced Settings", expanded=True):
            col1, col2 = st.columns(2)

            with col1:
                st.number_input(
                    "Take Profit Price",
                    min_value=0.0,
                    step=0.01,
                    format="%.2f",
                    help="Automatically close position at profit target"
                )

                st.number_input(
                    "Max Slippage (%)",
                    min_value=0.0,
                    max_value=10.0,
                    value=0.5,
                    step=0.1,
                    format="%.1f",
                    help="Maximum acceptable slippage"
                )

            with col2:
                st.number_input(
                    "Stop Loss Price",
                    min_value=0.0,
                    step=0.01,
                    format="%.2f",
                    help="Automatically close position at loss limit"
                )

                st.number_input(
                    "Iceberg Quantity",
                    min_value=0.0,
                    step=0.001,
                    format="%.3f",
                    help="Show only this quantity in order book",
                    disabled=st.session_state.order_form['type'] != OrderType.ICEBERG.value)

    def _render_order_summary(
            self,
            current_price: float,
            available_balance: float):
        """Render order summary"""
        st.markdown("### 📋 Order Summary")

        quantity = st.session_state.order_form['quantity']
        order_type = st.session_state.order_form['type']
        side = st.session_state.order_form['side']

        # Calculate order value
        if order_type == OrderType.MARKET.value:
            price = current_price
        else:
            price = st.session_state.order_form['price'] or current_price

        order_value = quantity * price

        # Calculate fees (example: 0.1% taker, 0.05% maker)
        is_maker = order_type == OrderType.LIMIT.value and st.session_state.order_form[
            'post_only']
        fee_rate = 0.0005 if is_maker else 0.001
        fees = order_value * fee_rate

        # Display summary
        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric(
                "Order Value",
                self.formatter.format_currency(order_value),
                delta=None
            )

        with col2:
            st.metric(
                "Est. Fees",
                self.formatter.format_currency(fees),
                delta=f"{fee_rate * 100:.2f}%"
            )

        with col3:
            remaining_balance = available_balance - order_value - \
                fees if side == OrderSide.BUY.value else available_balance
            st.metric(
                "Remaining Balance",
                self.formatter.format_currency(remaining_balance),
                delta=self.formatter.format_currency(
                    remaining_balance -
                    available_balance))

        # Risk metrics
        if quantity > 0:
            col1, col2 = st.columns(2)

            with col1:
                position_size_pct = (order_value / available_balance) * 100
                risk_color = "🟢" if position_size_pct < 10 else "🟡" if position_size_pct < 25 else "🔴"
                st.info(
                    f"{risk_color} Position Size: {
                        position_size_pct:.1f}% of balance")

            with col2:
                leverage = order_value / \
                    (available_balance * 0.1)  # Assuming 10% margin
                st.info(f"Leverage: {leverage:.1f}x")

    def _render_validation_messages(self):
        """Render validation messages"""
        self._validate_order()

        if st.session_state.order_validation['errors']:
            for error in st.session_state.order_validation['errors']:
                st.error(f"❌ {error}")

        if st.session_state.order_validation['warnings']:
            for warning in st.session_state.order_validation['warnings']:
                st.warning(f"⚠️ {warning}")

    def _render_submit_buttons(self):
        """Render submit buttons"""
        col1, col2, col3 = st.columns([2, 1, 1])

        with col1:
            side = st.session_state.order_form['side']
            button_label = f"{
                '🟢 BUY' if side == OrderSide.BUY.value else '🔴 SELL'} {
                st.session_state.order_form['symbol']}"

            if st.button(
                button_label,
                use_container_width=True,
                disabled=not st.session_state.order_validation['is_valid'],
                type="primary",
                key="submit_order"
            ):
                self._submit_order()

        with col2:
            if st.button("Clear", use_container_width=True, key="clear_form"):
                self._clear_form()

        with col3:
            if st.button(
                "Templates",
                use_container_width=True,
                    key="order_templates"):
                self._show_order_templates()

    def _validate_order(self):
        """Validate order form"""
        errors = []
        warnings = []

        # Check quantity
        if st.session_state.order_form['quantity'] <= 0:
            errors.append("Quantity must be greater than 0")

        # Check price for limit orders
        if st.session_state.order_form['type'] in [
                OrderType.LIMIT.value, OrderType.STOP_LIMIT.value]:
            if st.session_state.order_form['price'] <= 0:
                errors.append("Price must be greater than 0")

        # Check stop price for stop orders
        if st.session_state.order_form['type'] in [
                OrderType.STOP.value, OrderType.STOP_LIMIT.value]:
            if st.session_state.order_form['stop_price'] <= 0:
                errors.append("Stop price must be greater than 0")

        # Check for conflicting options
        if st.session_state.order_form['reduce_only'] and st.session_state.order_form['post_only']:
            warnings.append("Reduce Only and Post Only may conflict")

        # Update validation state
        st.session_state.order_validation['errors'] = errors
        st.session_state.order_validation['warnings'] = warnings
        st.session_state.order_validation['is_valid'] = len(errors) == 0

    def _submit_order(self):
        """Submit the order"""
        if self.on_submit and st.session_state.order_validation['is_valid']:
            order_data = {
                'symbol': st.session_state.order_form['symbol'],
                'side': st.session_state.order_form['side'],
                'type': st.session_state.order_form['type'],
                'quantity': st.session_state.order_form['quantity'],
                'price': st.session_state.order_form.get('price'),
                'stop_price': st.session_state.order_form.get('stop_price'),
                'time_in_force': st.session_state.order_form['time_in_force'],
                'reduce_only': st.session_state.order_form['reduce_only'],
                'post_only': st.session_state.order_form['post_only'],
                'timestamp': datetime.now()
            }

            # Call the callback
            self.on_submit(order_data)

            # Show success message
            st.success("✅ Order submitted successfully!")

            # Clear form after submission
            self._clear_form()

    def _clear_form(self):
        """Clear the order form"""
        st.session_state.order_form['quantity'] = 0.0
        st.session_state.order_form['price'] = 0.0
        st.session_state.order_form['stop_price'] = 0.0
        st.session_state.order_form['reduce_only'] = False
        st.session_state.order_form['post_only'] = False

    def _show_order_templates(self):
        """Show order templates modal"""
        with st.expander("📋 Order Templates", expanded=True):
            st.markdown("### Saved Order Templates")

            templates = [
                {"name": "Scalp Entry", "type": "Limit", "side": "Buy", "size": "25%"},
                {"name": "DCA Buy", "type": "Market", "side": "Buy", "size": "10%"},
                {"name": "Take Profit", "type": "Limit", "side": "Sell", "size": "50%"},
                {"name": "Stop Loss", "type": "Stop", "side": "Sell", "size": "100%"},
            ]

            for template in templates:
                col1, col2, col3, col4, col5 = st.columns([2, 1, 1, 1, 1])

                with col1:
                    st.text(template['name'])
                with col2:
                    st.text(template['type'])
                with col3:
                    st.text(template['side'])
                with col4:
                    st.text(template['size'])
                with col5:
                    if st.button("Load", key=f"load_{template['name']}"):
                        st.info(f"Loaded template: {template['name']}")
