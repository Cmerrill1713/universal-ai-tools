#!/bin/bash

# Universal AI Tools - Docker Cleanup Script
# Safely clean up Docker containers and free up resources

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🧹 Universal AI Tools - Docker Cleanup${NC}"
echo -e "========================================"
echo ""

# Function to show current docker usage
show_docker_status() {
    echo -e "${CYAN}📊 Current Docker Status:${NC}"
    echo "Running containers: $(docker ps | wc -l | tr -d ' ')"
    echo "Total containers: $(docker ps -a | wc -l | tr -d ' ')"
    echo "Images: $(docker images | wc -l | tr -d ' ')"
    echo ""
    docker system df
    echo ""
}

# Function to clean up stopped containers
cleanup_stopped_containers() {
    echo -e "${YELLOW}🗑️ Cleaning up stopped containers...${NC}"
    
    stopped_containers=$(docker ps -a --filter "status=exited" --format "{{.Names}}")
    
    if [ -n "$stopped_containers" ]; then
        echo "Found stopped containers:"
        docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
        echo ""
        
        read -p "Remove all stopped containers? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker container prune -f
            echo -e "${GREEN}✓ Stopped containers removed${NC}"
        else
            echo -e "${YELLOW}⏭️ Skipped stopped container cleanup${NC}"
        fi
    else
        echo -e "${GREEN}✓ No stopped containers to clean${NC}"
    fi
    echo ""
}

# Function to identify and manage service groups
manage_service_groups() {
    echo -e "${CYAN}🔧 Service Group Management${NC}"
    echo "=========================================="
    
    # Universal AI Tools Monitoring Stack (UAT)
    uat_containers=$(docker ps --filter "name=uat-" --format "{{.Names}}")
    if [ -n "$uat_containers" ]; then
        echo -e "${BLUE}📊 UAT Monitoring Stack:${NC}"
        docker ps --filter "name=uat-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        read -p "Stop UAT monitoring stack (Prometheus, Grafana, Jaeger, Qdrant)? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker stop uat-prometheus uat-grafana uat-jaeger uat-qdrant 2>/dev/null || true
            echo -e "${GREEN}✓ UAT monitoring stack stopped${NC}"
        else
            echo -e "${YELLOW}⏭️ UAT monitoring stack left running${NC}"
        fi
        echo ""
    fi
    
    # Supabase Stack
    supabase_containers=$(docker ps --filter "name=supabase_" --format "{{.Names}}")
    if [ -n "$supabase_containers" ]; then
        echo -e "${BLUE}🗄️ Supabase Stack:${NC}"
        docker ps --filter "name=supabase_" --format "table {{.Names}}\t{{.Status}}" | head -10
        echo "... and $(echo "$supabase_containers" | wc -l | tr -d ' ') total containers"
        echo ""
        read -p "Stop Supabase stack (Database, Auth, Storage, etc.)? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Use supabase stop if available
            if command -v supabase >/dev/null 2>&1; then
                echo "Using supabase stop command..."
                supabase stop || true
            else
                echo "Stopping Supabase containers manually..."
                echo "$supabase_containers" | xargs docker stop 2>/dev/null || true
            fi
            echo -e "${GREEN}✓ Supabase stack stopped${NC}"
        else
            echo -e "${YELLOW}⏭️ Supabase stack left running${NC}"
        fi
        echo ""
    fi
    
    # Other service containers
    other_containers=$(docker ps --filter "name=local-" --format "{{.Names}}")
    if [ -n "$other_containers" ]; then
        echo -e "${BLUE}🔧 Other Services:${NC}"
        docker ps --filter "name=local-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        read -p "Stop other services (Redis, Neo4j, etc.)? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$other_containers" | xargs docker stop 2>/dev/null || true
            echo -e "${GREEN}✓ Other services stopped${NC}"
        else
            echo -e "${YELLOW}⏭️ Other services left running${NC}"
        fi
        echo ""
    fi
}

# Function to clean up unused resources
cleanup_unused_resources() {
    echo -e "${YELLOW}🧹 Cleaning up unused Docker resources...${NC}"
    echo ""
    
    # Show what will be cleaned
    echo "Unused images:"
    docker images --filter "dangling=true" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || echo "None"
    echo ""
    
    echo "Unused volumes:"
    docker volume ls --filter "dangling=true" --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || echo "None"
    echo ""
    
    echo "Unused networks:"
    docker network ls --filter "dangling=true" --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || echo "None"
    echo ""
    
    read -p "Clean up unused images, volumes, and networks? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Clean up unused images
        docker image prune -f
        
        # Clean up unused volumes
        docker volume prune -f
        
        # Clean up unused networks
        docker network prune -f
        
        # Clean up build cache
        docker builder prune -f
        
        echo -e "${GREEN}✓ Unused resources cleaned${NC}"
    else
        echo -e "${YELLOW}⏭️ Skipped resource cleanup${NC}"
    fi
    echo ""
}

# Function to show space saved
show_cleanup_summary() {
    echo -e "${GREEN}📈 Cleanup Summary${NC}"
    echo "=================="
    echo ""
    
    echo -e "${CYAN}📊 Updated Docker Status:${NC}"
    show_docker_status
    
    echo -e "${GREEN}✅ Docker cleanup completed!${NC}"
    echo ""
    
    # Show essential services that should remain running
    echo -e "${BLUE}🔧 Essential Services Still Running:${NC}"
    essential_services=""
    
    # Check if Go API Gateway is running (not in Docker)
    if curl -s "http://localhost:8082/health" >/dev/null 2>&1; then
        essential_services="$essential_services✓ Go API Gateway (localhost:8082)\n"
    fi
    
    # Check for any remaining containers that are actually needed
    running_containers=$(docker ps --format "{{.Names}}")
    if [ -n "$running_containers" ]; then
        echo "Docker containers still running:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -10
    else
        echo "No Docker containers running"
    fi
    
    if [ -n "$essential_services" ]; then
        echo -e "$essential_services"
    fi
    
    echo ""
    echo -e "${CYAN}💡 To restart services when needed:${NC}"
    echo "  • Supabase: supabase start"
    echo "  • Monitoring: docker-compose -f docker-compose.monitoring.yml up -d"
    echo "  • Redis: docker run -d --name local-redis -p 6379:6379 redis:7-alpine"
    echo "  • Neo4j: docker run -d --name local-neo4j -p 7474:7474 -p 7687:7687 neo4j:5-community"
}

# Quick cleanup mode
quick_cleanup() {
    echo -e "${YELLOW}⚡ Quick Cleanup Mode${NC}"
    echo "===================="
    echo ""
    
    # Stop and remove all stopped containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    # Clean build cache
    docker builder prune -f
    
    echo -e "${GREEN}✓ Quick cleanup completed${NC}"
    echo ""
}

# Aggressive cleanup mode
aggressive_cleanup() {
    echo -e "${RED}🚨 AGGRESSIVE Cleanup Mode${NC}"
    echo "=========================="
    echo -e "${YELLOW}WARNING: This will stop ALL containers and remove unused resources${NC}"
    echo ""
    
    read -p "Are you sure you want to stop ALL containers? (type 'yes' to confirm): " -r
    if [[ $REPLY == "yes" ]]; then
        # Stop all running containers
        running=$(docker ps -q)
        if [ -n "$running" ]; then
            docker stop $running
            echo -e "${YELLOW}✓ All containers stopped${NC}"
        fi
        
        # Remove all stopped containers
        docker container prune -f
        
        # Remove unused images (not all images)
        docker image prune -f
        
        # Remove unused volumes
        docker volume prune -f
        
        # Remove unused networks
        docker network prune -f
        
        # Clean build cache
        docker builder prune -f
        
        echo -e "${GREEN}✅ Aggressive cleanup completed${NC}"
    else
        echo -e "${YELLOW}⏭️ Aggressive cleanup cancelled${NC}"
    fi
    echo ""
}

# Main menu
main_menu() {
    echo -e "${BLUE}🛠️ Docker Cleanup Options:${NC}"
    echo "1. Show current status"
    echo "2. Interactive cleanup (recommended)"
    echo "3. Quick cleanup (remove stopped/unused)"
    echo "4. Aggressive cleanup (stop all + clean)"
    echo "5. Exit"
    echo ""
    
    read -p "Choose an option (1-5): " -n 1 -r
    echo ""
    echo ""
    
    case $REPLY in
        1)
            show_docker_status
            main_menu
            ;;
        2)
            show_docker_status
            cleanup_stopped_containers
            manage_service_groups
            cleanup_unused_resources
            show_cleanup_summary
            ;;
        3)
            show_docker_status
            quick_cleanup
            show_cleanup_summary
            ;;
        4)
            show_docker_status
            aggressive_cleanup
            show_cleanup_summary
            ;;
        5)
            echo -e "${GREEN}👋 Cleanup cancelled${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            main_menu
            ;;
    esac
}

# Parse command line arguments
case "${1:-menu}" in
    status)
        show_docker_status
        ;;
    quick)
        quick_cleanup
        show_cleanup_summary
        ;;
    aggressive)
        aggressive_cleanup
        show_cleanup_summary
        ;;
    interactive)
        show_docker_status
        cleanup_stopped_containers
        manage_service_groups
        cleanup_unused_resources
        show_cleanup_summary
        ;;
    menu)
        main_menu
        ;;
    *)
        echo "Usage: $0 {status|quick|aggressive|interactive|menu}"
        echo ""
        echo "  status      - Show current Docker status"
        echo "  quick       - Quick cleanup (remove stopped/unused)"
        echo "  aggressive  - Stop all containers and clean up"
        echo "  interactive - Interactive cleanup (recommended)"
        echo "  menu        - Show interactive menu (default)"
        ;;
esac