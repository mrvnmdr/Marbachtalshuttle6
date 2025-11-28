# Commute Cost Calculator

## Overview

This is a commute cost calculator application built as a frontend-only web application with Supabase backend. The app allows users to track and calculate costs for shared commutes among multiple people using different vehicles. Users can manage a fleet of cars (with associated owners and costs), track multiple people participating in commutes, and record individual commute trips with automatic cost splitting calculations.

The application is designed for German-speaking users and helps groups fairly split transportation costs based on who drives, which vehicles are used, and who participates in each trip.

**Data is stored in a shared Supabase database, and the frontend connects directly to Supabase.**

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend-Only Architecture

**Framework Choice: React 18 with TypeScript**
- Problem: Need for a type-safe, component-based UI with reactive state management
- Solution: React with TypeScript provides strong typing, component reusability, and efficient re-rendering
- Rationale: React's virtual DOM and hooks API simplify state management

**Build Tool: Vite**
- Problem: Fast development server and optimized production builds needed
- Solution: Vite as the build tool and dev server
- Development: Port 5000 with all hosts allowed
- Production: Builds to static `dist/` folder for deployment

**Styling: Tailwind CSS**
- Problem: Need for rapid UI development with consistent styling
- Solution: Utility-first CSS framework with PostCSS processing

### Database: Supabase (PostgreSQL)

**Direct Frontend Connection**
- Problem: Need shared, persistent database accessible by multiple users
- Solution: Frontend connects directly to Supabase via @supabase/supabase-js client library
- Simplified architecture with no backend server

### Data Model

**Core Entities**:
1. **persons**: id (serial), name (text)
2. **cars**: id (serial), name (text), owner_id (foreign key), roundtrip_cost (decimal)
3. **commutes**: id (serial), date (date), trip_type (text), selected_cars (int[]), selected_persons (int[]), drivers (int[]), price_per_person (decimal)

## Deployment

### GitHub Pages

This app is configured to deploy to GitHub Pages via GitHub Actions. To deploy:

1. **Push to GitHub**: Push your code to the `main` branch
2. **Set Secrets**: Add two secrets in GitHub repo settings:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
3. **Enable Pages**: In repo settings, go to Pages and select "Deploy from a branch" with the `gh-pages` branch
4. **Automatic Deployment**: Every push to `main` will trigger an automatic build and deploy

The app will be available at `https://username.github.io/repo-name/` (or `https://username.github.io/` if deploying from a user pages repo).

### Local Development

Run `npm run dev` to start the development server on port 5000.

### Local Build

Run `npm run build` to create an optimized production build in the `dist/` folder.

## Recent Changes

**November 28, 2025 - Backend Removal & GitHub Pages Setup**:
- Deleted Express backend server entirely
- Moved Supabase connection directly to frontend
- Configured Vite for static site generation
- Added GitHub Actions workflow for automatic deployment to GitHub Pages
- Simplified architecture with no backend complexity
- Static assets ready for any static hosting platform

## External Dependencies

### Core Framework Dependencies

**React Ecosystem**:
- `react` (^18.3.1): UI library
- `react-dom` (^18.3.1): DOM rendering

**Database**:
- `@supabase/supabase-js` (^2.45.0): Supabase client library

**Build Tools**:
- `vite` (^5.4.10): Build tool and dev server
- `@vitejs/plugin-react` (^4.3.3): React integration
- `typescript` (~5.6.2): Type checking

**Styling**:
- `tailwindcss` (^3.4.14): Utility-first CSS
- `postcss` (^8.4.47): CSS processing
- `autoprefixer` (^10.4.20): Browser prefix support

**UI**:
- `lucide-react` (^0.460.0): Icon library

## Environment Variables

Required environment variables for Supabase connection:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

For local development, create a `.env` file in the project root with these values.

## Database Setup

1. Create a new Supabase project
2. Run the SQL from `supabase-schema.sql` in your Supabase SQL Editor
3. Set your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables
4. The app is ready to use
