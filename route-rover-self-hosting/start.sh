#!/bin/bash

echo "Starting Route Rover Self-Hosting Setup..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env file with your configuration before continuing!"
    echo "Required: DATABASE_URL, SESSION_SECRET"
    echo "Optional: OPENAI_API_KEY, GOOGLE_MAPS_API_KEY"
    read -p "Press Enter when you've configured .env file..."
fi

# Install dependencies
echo "Installing dependencies..."
npm ci --only=production

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "Or with Docker:"
echo "  docker-compose up -d"
echo ""
echo "The application will be available at http://localhost:5000"