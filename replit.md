# Route Rover

## Overview

Route Rover is a comprehensive expense and mileage tracking application designed for business professionals and freelancers. The application provides automated trip tracking, expense management, receipt processing with OCR capabilities, and schedule-based trip planning. Built as a progressive web app with a mobile-first design, it features real-time GPS tracking, Google Maps integration for route calculation, and intelligent expense categorization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite build system
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state and local React state for UI
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First Design**: Progressive Web App with responsive layout and bottom navigation

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Handling**: Multer for multipart/form-data uploads
- **Session Management**: Connect-pg-simple for PostgreSQL session storage

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless driver
- **Schema Design**: 
  - Users, trips, expenses, receipts, schedule entries, app settings, and error logs
  - JSON fields for location data and extracted receipt information
  - Foreign key relationships for data integrity
- **File Storage**: Local filesystem for uploaded receipt images
- **Migration System**: Drizzle Kit for database schema management

### Authentication and Authorization
- **Session-based Authentication**: Express sessions stored in PostgreSQL
- **User Management**: Username/password authentication with bcrypt hashing
- **API Security**: Session validation middleware for protected routes

### External Dependencies
- **Google Maps API**: Route calculation and distance measurement for trip tracking
- **Tesseract.js**: Client-side OCR for receipt text extraction
- **Geolocation API**: Browser-based GPS tracking for automatic trip detection
- **Camera API**: Progressive enhancement for receipt photo capture

### Key Features and Design Patterns
- **Progressive Enhancement**: Core functionality works without JavaScript, enhanced with client-side features
- **Offline-First Considerations**: Service worker ready architecture with local state management
- **Real-Time Tracking**: WebAPI-based geolocation with configurable sensitivity settings
- **Intelligent Data Processing**: OCR text parsing for automatic expense categorization
- **Bulk Import**: CSV/Excel file parsing for schedule import with column mapping
- **Export Functionality**: Data export capabilities for reporting and backup