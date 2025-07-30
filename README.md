# VK Gambling Room

## Description
This project provides a backend service and static frontend for a VK-based gambling room prototype targeting Central Asian migrants. The backend is built with Node.js, Express, and TypeScript. The frontend consists of static HTML pages for authentication and lobby.

## Features
- VK OAuth2 authentication
- Session management with HTTP-only cookies
- Protected lobby route
- Static pages: login, callback, lobby

## Setup
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd repo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Run in development:
   ```bash
   npm run dev
   ```

5. Build and start:
   ```bash
   npm run build
   npm start
   ```

## Deployment

### Backend
Deploy the backend to a Node.js-compatible platform (Heroku, DigitalOcean, AWS, etc). Ensure environment variables are set.

### Frontend
Deploy the `public` folder to Netlify:
1. Connect your GitHub repository in Netlify.
2. Set the publish directory to `public`.
3. Configure environment variables and redirect rules if needed.
