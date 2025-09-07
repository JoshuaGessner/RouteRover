#!/bin/bash

# Route Rover Health Check Script
# Use this to monitor your Route Rover application health

set -e

# Default configuration
HOST=${1:-"localhost"}
PORT=${2:-"5000"}
TIMEOUT=${3:-10}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🔍 Route Rover Health Check"
echo "=========================="
echo "Checking: http://$HOST:$PORT"
echo ""

# Check if application is responding
if command -v curl &> /dev/null; then
    # Test main health endpoint
    if curl -f -s --connect-timeout "$TIMEOUT" "http://$HOST:$PORT/api/health" > /dev/null; then
        print_status "Application is responding"
    else
        print_error "Application is not responding on port $PORT"
        exit 1
    fi
    
    # Test user endpoint (authentication)
    AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "http://$HOST:$PORT/api/user")
    if [ "$AUTH_STATUS" == "401" ]; then
        print_status "Authentication endpoint working (401 expected)"
    elif [ "$AUTH_STATUS" == "200" ]; then
        print_warning "User already logged in"
    else
        print_warning "Authentication endpoint returned status: $AUTH_STATUS"
    fi
    
    # Test static files
    STATIC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "http://$HOST:$PORT/")
    if [ "$STATIC_STATUS" == "200" ]; then
        print_status "Frontend is accessible"
    else
        print_error "Frontend not accessible (status: $STATIC_STATUS)"
    fi
    
elif command -v wget &> /dev/null; then
    # Fallback to wget
    if wget -q --timeout="$TIMEOUT" --spider "http://$HOST:$PORT/api/health"; then
        print_status "Application is responding"
    else
        print_error "Application is not responding on port $PORT"
        exit 1
    fi
else
    print_error "Neither curl nor wget found. Cannot perform health check."
    exit 1
fi

# Check database connection (if running locally)
if [ "$HOST" == "localhost" ] || [ "$HOST" == "127.0.0.1" ]; then
    if [ -f ".env" ]; then
        # Source environment variables
        export $(grep -v '^#' .env | xargs)
        
        if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
            if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
                print_status "Database connection successful"
            else
                print_error "Database connection failed"
                exit 1
            fi
        else
            print_warning "Cannot test database connection (psql not found or DATABASE_URL not set)"
        fi
    else
        print_warning "No .env file found, skipping database check"
    fi
fi

# Check disk space for uploads
if [ -d "uploads" ]; then
    DISK_USAGE=$(df uploads | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        print_error "Disk space critical: ${DISK_USAGE}% used"
        exit 1
    elif [ "$DISK_USAGE" -gt 80 ]; then
        print_warning "Disk space warning: ${DISK_USAGE}% used"
    else
        print_status "Disk space OK: ${DISK_USAGE}% used"
    fi
fi

# Check memory usage (if running on Linux)
if [ -f "/proc/meminfo" ]; then
    TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    AVAILABLE_MEM=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    MEM_USAGE=$((100 - (AVAILABLE_MEM * 100 / TOTAL_MEM)))
    
    if [ "$MEM_USAGE" -gt 90 ]; then
        print_error "Memory usage critical: ${MEM_USAGE}%"
        exit 1
    elif [ "$MEM_USAGE" -gt 80 ]; then
        print_warning "Memory usage high: ${MEM_USAGE}%"
    else
        print_status "Memory usage OK: ${MEM_USAGE}%"
    fi
fi

echo ""
print_status "All health checks passed!"

# Return appropriate exit code
exit 0