#!/bin/bash

# Route Rover Self-Hosting Setup Script
# This script helps you set up Route Rover for self-hosting

set -e

echo "🚗 Route Rover Self-Hosting Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

# Check prerequisites
echo "Checking prerequisites..."

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
print_success "Node.js $(node --version) is installed"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm $(npm --version) is installed"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL client not found. Please install PostgreSQL or make sure it's in your PATH"
    echo "On Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "On macOS: brew install postgresql"
    echo "On RHEL/CentOS: sudo yum install postgresql postgresql-server"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
if [ -f "package.json" ]; then
    npm install
    print_success "Dependencies installed"
else
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Copy environment file
echo ""
echo "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env file from template"
    else
        # Create basic .env file
        cat > .env << 'EOF'
# Route Rover Environment Configuration
DATABASE_URL="postgresql://routerover:password@localhost:5432/routerover"
SESSION_SECRET="$(openssl rand -hex 32)"
NODE_ENV="production"
PORT="5000"
EOF
        print_success "Created basic .env file"
    fi
    print_warning "Please edit .env file with your configuration before starting the application"
else
    print_success ".env file already exists"
fi

# Generate session secret if needed
echo ""
echo "Generating secure session secret..."
if command -v openssl &> /dev/null; then
    SESSION_SECRET=$(openssl rand -hex 32)
    if grep -q "your-very-secure-session-secret" .env 2>/dev/null; then
        sed -i.bak "s/your-very-secure-session-secret.*/$SESSION_SECRET/" .env
        print_success "Generated secure session secret"
    fi
else
    print_warning "OpenSSL not found. Please manually set a secure SESSION_SECRET in .env"
fi

# Build application
echo ""
echo "Building application..."
npm run build
print_success "Application built successfully"

# Database setup
echo ""
echo "Setting up database..."
print_warning "Please ensure PostgreSQL is running and create the database manually:"
echo "createdb routerover"
echo ""
echo "Then run the database schema setup:"
echo "npm run db:push"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Create PostgreSQL database: createdb routerover"
echo "3. Setup database schema: npm run db:push"
echo "4. Start the application: npm start"
echo ""
echo "For production deployment with Docker:"
echo "docker-compose up -d"
echo ""
echo "For more information, see README-DEPLOYMENT.md"