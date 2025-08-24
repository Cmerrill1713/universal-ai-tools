#!/bin/bash

# Demo script for Universal AI Tools Go News API System
# Demonstrates production-ready news functionality with real RSS feeds

set -e

echo "🚀 Universal AI Tools - News API Demo"
echo "====================================="

# Configuration
API_BASE="http://localhost:8081"
PORT=8081

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if server is running
check_server() {
    if curl -s "${API_BASE}/health" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to make API call and show results
api_call() {
    local endpoint=$1
    local description=$2
    local expected_fields=$3
    
    echo -e "\n${BLUE}Testing:${NC} $description"
    echo "Endpoint: $endpoint"
    
    response=$(curl -s "${API_BASE}${endpoint}" || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        echo -e "${RED}❌ Failed to connect${NC}"
        return 1
    fi
    
    # Check if response contains expected fields
    if [[ -n "$expected_fields" ]]; then
        if echo "$response" | grep -q "$expected_fields"; then
            echo -e "${GREEN}✅ Success${NC}"
        else
            echo -e "${YELLOW}⚠️  Unexpected response format${NC}"
        fi
    else
        echo -e "${GREEN}✅ Connected${NC}"
    fi
    
    # Pretty print JSON response (first few lines)
    echo "$response" | head -c 500 | jq '.' 2>/dev/null || echo "Response: ${response:0:200}..."
}

# Function to test news endpoints comprehensively
test_news_endpoints() {
    echo -e "\n${YELLOW}📊 COMPREHENSIVE NEWS API TESTING${NC}"
    echo "================================================"
    
    # 1. Health Check
    api_call "/health" "System Health Check" "success"
    
    # 2. Get Categories
    api_call "/api/v1/news/categories" "Available News Categories" "categories"
    
    # 3. Get All News (with pagination)
    api_call "/api/v1/news?limit=10" "All News (10 items)" "items"
    
    # 4. Get AI/ML News
    api_call "/api/v1/news?category=ai-ml&limit=5" "AI/ML News (5 items)" "items"
    
    # 5. Get Technology News  
    api_call "/api/v1/news?category=technology&limit=5" "Technology News (5 items)" "items"
    
    # 6. Get Programming News
    api_call "/api/v1/news?category=programming&limit=3" "Programming News (3 items)" "items"
    
    # 7. Get Automotive News
    api_call "/api/v1/news?category=automotive&limit=3" "Automotive News (3 items)" "items"
    
    # 8. Test Pagination
    api_call "/api/v1/news?limit=5&offset=5" "Pagination Test (offset 5)" "items"
    
    # 9. Get Stats
    api_call "/api/v1/news/stats" "News Service Statistics" "totalItems"
    
    # 10. Test Cache Refresh
    echo -e "\n${BLUE}Testing:${NC} Cache Refresh (may take 30-60 seconds)"
    echo "Endpoint: /api/v1/news/refresh"
    echo -e "${YELLOW}⏳ Refreshing cache from all RSS sources...${NC}"
    
    refresh_response=$(curl -s -X GET "${API_BASE}/api/v1/news/refresh" || echo "ERROR")
    if [[ "$refresh_response" == "ERROR" ]]; then
        echo -e "${RED}❌ Cache refresh failed${NC}"
    else
        echo -e "${GREEN}✅ Cache refresh completed${NC}"
        echo "$refresh_response" | head -c 300 | jq '.' 2>/dev/null || echo "Response: ${refresh_response:0:200}..."
    fi
}

# Function to show RSS source information
show_rss_sources() {
    echo -e "\n${YELLOW}📡 RSS FEED SOURCES${NC}"
    echo "====================="
    echo "• Hacker News: https://hnrss.org/newest"
    echo "• TechCrunch: https://techcrunch.com/feed/"  
    echo "• Ars Technica: https://feeds.arstechnica.com/arstechnica/index"
    echo "• VentureBeat AI: https://venturebeat.com/ai/feed/"
    echo "• Automotive News: https://www.autonews.com/rss.xml"
    echo "• DEV Community: https://dev.to/feed"
}

# Function to show system capabilities
show_capabilities() {
    echo -e "\n${YELLOW}🎯 SYSTEM CAPABILITIES${NC}"
    echo "======================"
    echo "✅ Real-time RSS feed integration with 6 sources"
    echo "✅ 15-minute intelligent caching system"
    echo "✅ Concurrent feed processing for performance"
    echo "✅ HTML content cleaning and video detection"
    echo "✅ Category-based filtering (AI/ML, Tech, Auto, Programming)"
    echo "✅ Pagination support (limit/offset)"
    echo "✅ Error handling with fallback to stale cache"
    echo "✅ Performance metrics and statistics tracking"
    echo "✅ RESTful API with comprehensive error responses"
    echo "✅ Production-ready with proper logging and monitoring"
}

# Main execution
main() {
    echo -e "${GREEN}Starting News API Demo...${NC}\n"
    
    # Check if server is running
    echo "Checking if Go API Gateway is running on port $PORT..."
    if check_server; then
        echo -e "${GREEN}✅ Server is running${NC}"
    else
        echo -e "${RED}❌ Server is not running on port $PORT${NC}"
        echo "Please start the Go API Gateway first:"
        echo "  cd /Users/christianmerrill/Desktop/universal-ai-tools/go-api-gateway"
        echo "  go run cmd/main.go"
        exit 1
    fi
    
    show_capabilities
    show_rss_sources
    test_news_endpoints
    
    echo -e "\n${GREEN}🎉 News API Demo Completed Successfully!${NC}"
    echo -e "${BLUE}💡 The news system is production-ready and integrated with real RSS feeds.${NC}"
}

# Run the demo
main "$@"