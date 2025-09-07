# Route Rover - Self-Hosting Deployment Guide

## Overview

Route Rover is a comprehensive expense and mileage tracking application that can be self-hosted. This guide will help you deploy the application on your own server.

## Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Git
- PM2 (recommended for production)

## Quick Start

### 1. Environment Setup

```bash
# Clone or extract the application
cd route-rover

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb route_rover

# Update .env with your database URL
DATABASE_URL="postgresql://user:password@localhost:5432/route_rover"

# Push database schema
npm run db:push
```

### 3. Configuration

Edit `.env` file with your settings:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/route_rover"
SESSION_SECRET="your-very-secure-session-secret-minimum-32-characters"

# Optional but recommended
OPENAI_API_KEY="sk-your-openai-api-key-for-enhanced-ocr"
GOOGLE_MAPS_API_KEY="your-google-maps-api-key-for-routes"

# Production settings
NODE_ENV="production"
PORT="5000"
ALLOWED_ORIGINS="https://yourdomain.com"
```

### 4. Build and Start

```bash
# Build the application
npm run build

# Start in production
npm start

# Or use PM2 for production (recommended)
pm2 start dist/index.js --name route-rover
```

## Features

### Core Features
- ✅ Expense tracking with receipt OCR
- ✅ Mileage tracking with GPS
- ✅ Schedule import (CSV/Excel)
- ✅ IRS-compliant reporting
- ✅ Mobile-responsive design
- ✅ Dark/light theme support

### Security Features
- ✅ Rate limiting on all endpoints
- ✅ Helmet security headers
- ✅ Input sanitization
- ✅ CORS protection
- ✅ Session-based authentication
- ✅ Password hashing with bcrypt
- ✅ File upload validation

### Optional Integrations
- **OpenAI API**: Enhanced OCR for receipt processing
- **Google Maps API**: Route calculation for mileage tracking

## Authentication

The application uses session-based authentication with username/password. 

### Creating Your First User

1. Start the application
2. Navigate to the registration page
3. Create your admin account
4. Login with your credentials

### Default Development User
In development mode, you can login with:
- Username: `demo`
- Password: `password123`

## Production Considerations

### Security
- Use a strong `SESSION_SECRET` (32+ random characters)
- Set `NODE_ENV=production`
- Configure `ALLOWED_ORIGINS` for your domain
- Use HTTPS in production
- Regularly update dependencies
- Monitor logs for security issues

### Performance
- Use PM2 or similar process manager
- Configure PostgreSQL for your workload
- Set up log rotation
- Monitor resource usage
- Consider Redis for session storage in high-traffic scenarios

### Backup
- Regular PostgreSQL backups
- Backup uploaded files in `uploads/` directory
- Export data using built-in export features

## File Structure

```
route-rover/
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
├── dist/            # Built application
├── uploads/         # File uploads (receipts)
├── .env             # Environment configuration
└── package.json     # Dependencies
```

## Troubleshooting

### Database Issues
```bash
# Reset database schema
npm run db:push --force

# Check database connection
psql $DATABASE_URL -c "SELECT version();"
```

### Permission Issues
```bash
# Ensure proper file permissions
chmod 755 uploads/
chown -R app:app route-rover/
```

### Port Issues
```bash
# Check if port is in use
netstat -tlnp | grep :5000

# Kill process using port
sudo kill $(sudo lsof -t -i:5000)
```

### Log Analysis
```bash
# PM2 logs
pm2 logs route-rover

# Check application logs
tail -f logs/app.log
```

## API Documentation

### Authentication Endpoints
- `POST /api/register` - Create new user
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Core Endpoints
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `GET /api/trips` - List trips
- `POST /api/trips` - Create trip
- `POST /api/receipts/upload` - Upload receipt

## Support

For issues and questions:
1. Check the logs first
2. Verify environment configuration
3. Ensure database connectivity
4. Check file permissions

## License

MIT License - See LICENSE file for details.