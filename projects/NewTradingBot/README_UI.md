# NewTradingBot Streamlit UI
A complete Streamlit-based user interface for the NewTradingBot trading platform.
## 🚀 Quick Start
### Prerequisites

- Python 3.8+

- pip package manager
### Installation & Launch
1. **Install Dependencies**

   ```bash

   pip install -r requirements.txt

   ```
2. **Launch the Application**

   ```bash

   # Option 1: Using the launch script (recommended)

   python launch.py

   

   # Option 2: Direct Streamlit command

   streamlit run src/run.py

   

   # Option 3: Python module execution

   cd src && python run.py

   ```
3. **Access the Interface**

   - Open your browser to `http://localhost:8501`

   - The application will automatically open in your default browser
## 📊 Features
### Main Dashboard

- **Real-time Trading Charts** - Interactive candlestick charts with technical indicators

- **Order Entry Form** - Professional order placement with validation

- **Portfolio Overview** - Live portfolio metrics and performance

- **Market Watchlist** - Track multiple symbols with price alerts

- **Active Orders & Positions** - Monitor open trades and orders
### Portfolio Management

- **Position Tracking** - Detailed view of all open positions

- **P&L Analysis** - Real-time profit/loss calculations

- **Performance Metrics** - Sharpe ratio, win rate, drawdown analysis

- **Risk Management** - Portfolio exposure and risk metrics
### Advanced Analytics

- **Performance Analysis** - Comprehensive trading statistics

- **Strategy Performance** - Compare multiple trading strategies

- **Risk Analytics** - VaR, correlation, and risk contribution analysis

- **Trade History** - Detailed trade log with filters and exports
### Settings & Configuration

- **Exchange Settings** - Configure API keys and exchange preferences

- **Trading Parameters** - Set risk limits and default order settings

- **Strategy Configuration** - Enable and configure automated strategies

- **Notifications** - Email, Telegram, and Discord alerts

- **UI Customization** - Themes, colors, and display preferences
## 🎨 User Interface Components
### Charts & Visualization

- Interactive candlestick charts with Plotly

- Technical indicators (SMA, EMA, Bollinger Bands, RSI, MACD)

- Portfolio allocation pie charts

- Performance equity curves

- Risk heatmaps and correlation matrices
### Forms & Controls

- Professional order entry forms with validation

- Real-time price updates and calculations

- Position sizing calculators

- Risk management controls

- Quick trade buttons for market orders
### Data Tables

- Sortable and filterable position tables

- Order history with status tracking

- Trade log with P&L calculations

- Performance metrics tables
## 🔧 Configuration
### Environment Setup

Create a `.env` file in the project root:
```bash
# Development/Production Mode

ENVIRONMENT=development

# Exchange API Keys (store in Supabase Vault for production)

BINANCE_API_KEY=your_binance_key

BINANCE_API_SECRET=your_binance_secret

BINANCE_TESTNET=true

# Database (optional - uses sample data if not configured)

DATABASE_URL=postgresql://user:pass@localhost/tradingbot

# Cache (optional)

REDIS_URL=redis://localhost:6379

```
### Application Settings

The application uses a layered configuration system:
1. **Default Settings** - Built-in defaults in `config/settings.py`

2. **Environment Variables** - Override via `.env` file

3. **User Preferences** - Saved in session state

4. **Exchange Configuration** - Defined in `config/exchanges.json`
## 🏗️ Architecture
### Directory Structure

```

src/

├── ui/

│   ├── components/          # Reusable UI components

│   │   ├── trading_chart.py # Interactive charts

│   │   ├── order_form.py    # Order entry forms

│   │   └── portfolio_view.py # Portfolio displays

│   ├── pages/              # Main application pages

│   │   ├── dashboard.py    # Main trading dashboard

│   │   ├── portfolio.py    # Portfolio management

│   │   ├── analytics.py    # Performance analytics

│   │   └── settings.py     # Configuration settings

│   └── utils/              # UI utilities

│       ├── theme.py        # Styling and theming

│       ├── formatters.py   # Data formatting

│       └── chart_utils.py  # Chart helpers

├── run.py                  # Main application entry point

└── [backend modules...]    # Trading logic (optional)
config/

├── settings.py            # Application configuration

├── logging.yaml          # Logging configuration

└── exchanges.json        # Exchange configurations

```
### Component Architecture

- **Modular Design** - Each page and component is self-contained

- **State Management** - Uses Streamlit session state for persistence

- **Theme System** - Consistent dark/light theme throughout

- **Data Formatting** - Unified formatting for currencies, percentages, dates

- **Error Handling** - Comprehensive error handling and user feedback
## 📱 Mobile Responsiveness
The interface is optimized for desktop trading but includes responsive design elements:

- Collapsible sidebar for smaller screens

- Mobile-friendly charts and tables

- Touch-optimized controls

- Adaptive layouts
## 🔒 Security Features
- **API Key Protection** - Keys stored securely, never displayed in logs

- **Input Validation** - All user inputs are validated and sanitized

- **Session Management** - Secure session handling with timeouts

- **Error Masking** - Sensitive information masked in error messages
## 🚧 Development Mode
The application includes several development features:
### Sample Data Mode

When backend services are not available, the UI uses sample data:

- Realistic market data simulation

- Sample portfolio positions and trades

- Mock order execution for testing
### Debug Features

- Detailed error logging

- Performance monitoring

- Component state inspection

- Development-specific UI controls
## 🔄 Data Flow
### Real-time Updates

- **Market Data** - Real-time price feeds via WebSocket

- **Portfolio Updates** - Live position and P&L updates

- **Order Status** - Real-time order execution updates

- **Auto-refresh** - Configurable auto-refresh intervals
### Backend Integration

The UI integrates with backend services when available:

- **Market Data Service** - Real-time and historical data

- **Trading Engine** - Order execution and management

- **Portfolio Service** - Position tracking and analytics

- **Risk Manager** - Real-time risk monitoring
## 🧪 Testing
### UI Testing

```bash
# Run unit tests

pytest tests/ui/

# Run integration tests

pytest tests/integration/

# Run with coverage

pytest --cov=src/ui tests/

```
### Manual Testing

- Use the built-in sample data mode

- Test all user interactions and forms

- Verify responsive design on different screen sizes

- Test error handling and edge cases
## 🚀 Deployment
### Local Development

```bash
# Install dependencies

pip install -r requirements.txt

# Run with development settings

ENVIRONMENT=development python launch.py

```
### Production Deployment

```bash
# Install production dependencies

pip install -r requirements.txt

# Set production environment

ENVIRONMENT=production

# Run with production settings

streamlit run src/run.py --server.port 8501 --server.address 0.0.0.0

```
### Docker Deployment

```dockerfile

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

EXPOSE 8501

CMD ["streamlit", "run", "src/run.py", "--server.address", "0.0.0.0"]

```
## 📊 Performance
### Optimization Features

- **Lazy Loading** - Components load data only when needed

- **Caching** - Intelligent caching of market data and calculations

- **Streaming Updates** - Efficient real-time data streaming

- **Memory Management** - Optimized for long-running sessions
### Performance Monitoring

- Built-in performance metrics

- Memory usage tracking

- Response time monitoring

- Error rate tracking
## 🤝 Contributing
1. Fork the repository

2. Create a feature branch: `git checkout -b feature/new-feature`

3. Make your changes and test thoroughly

4. Commit your changes: `git commit -am 'Add new feature'`

5. Push to the branch: `git push origin feature/new-feature`

6. Submit a pull request
## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
## 🆘 Support
If you encounter any issues:
1. Check the logs in the `logs/` directory

2. Verify your configuration in `config/settings.py`

3. Ensure all dependencies are installed correctly

4. Check the console for any error messages
For additional support, please open an issue in the repository.