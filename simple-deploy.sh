#!/bin/bash

# Route Rover - Simple Self-Hosting Deployment Script
# This script handles common deployment issues automatically

set -e

echo "🚗 Route Rover - Simple Self-Hosting Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

echo "This script will set up Route Rover with minimal configuration requirements."
echo "All environment variables have sensible defaults for local deployment."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current version: $(node --version)"
    exit 1
fi
print_success "Node.js $(node --version) detected"

# Install dependencies
print_info "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Create minimal .env file
print_info "Creating minimal environment configuration..."
cat > .env << 'EOF'
# Route Rover - Minimal Configuration
# The application will work with these defaults for local deployment

# Database (will use default PostgreSQL if not specified)
# DATABASE_URL="postgresql://postgres:password@localhost:5432/routerover"

# Session security (will auto-generate if not specified)
# SESSION_SECRET="your-secure-secret-here"

# Application settings
NODE_ENV="development"
PORT="5000"

# API keys are configured through the application Settings UI
# (not as server environment variables)

# CORS (will allow all origins in development)
# ALLOWED_ORIGINS="http://localhost:5000,https://yourdomain.com"
EOF

print_success "Created .env with sensible defaults"

# Check for PostgreSQL
if command -v psql &> /dev/null; then
    print_success "PostgreSQL client detected"
    
    # Try to create database
    print_info "Attempting to create database..."
    if createdb routerover 2>/dev/null; then
        print_success "Created database 'routerover'"
    else
        print_warning "Database 'routerover' may already exist (this is fine)"
    fi
else
    print_warning "PostgreSQL client not found"
    print_info "You can either:"
    echo "  1. Install PostgreSQL locally"
    echo "  2. Use Docker: docker run -d -p 5432:5432 -e POSTGRES_DB=routerover -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password postgres:15"
    echo "  3. Set DATABASE_URL in .env to point to your existing database"
fi

# Build application
print_info "Building application..."
npm run build
print_success "Application built"

# Setup database schema
print_info "Setting up database schema..."
if npm run db:push 2>/dev/null; then
    print_success "Database schema created"
else
    print_warning "Database schema setup failed - you may need to set up your database first"
    echo "After setting up your database, run: npm run db:push"
fi

echo ""
print_success "Setup complete!"
echo ""
echo "🎯 Quick Start Options:"
echo ""
echo "1. 🚀 Start in development mode:"
echo "   npm run dev"
echo ""
echo "2. 🏭 Start in production mode:"
echo "   npm start"
echo ""
echo "3. 🐳 Use Docker (if you have Docker installed):"
echo "   docker-compose up -d"
echo ""
echo "4. ⚙️  Customize your setup:"
echo "   Edit the .env file to configure database, API keys, etc."
echo ""
echo "📖 The application will work with default settings for local use."
echo "   Visit: http://localhost:5000 after starting"
echo ""
print_info "For production deployment, remember to:"
echo "  • Set a secure SESSION_SECRET"
echo "  • Configure DATABASE_URL for your production database"
echo "  • Set NODE_ENV=production"
echo "  • Configure ALLOWED_ORIGINS for your domain"
echo ""
echo "🆘 If you encounter issues:"
echo "  • Check logs: npm run dev"
echo "  • Verify database: psql postgresql://postgres:password@localhost:5432/routerover"
echo "  • Reset database: npm run db:push --force"
echo ""
print_success "Happy expense tracking! 📊"