# Development and Build Guide

## Cache-Busting with Vite

This project now uses Vite for automatic cache-busting in production. Vite automatically adds hashes to filenames (e.g., `main-C-xt8lEo.js`) so browsers always get the latest version.

## Development Commands

### Local Development (with hot reload)
```bash
npm run dev
```
Opens at http://localhost:5173 with hot module replacement

### Run Production Server Locally
```bash
npm run build
npm start
```

### Run Development Server (API only)
```bash
npm run server
```

## Production Deployment (Docker)

The Dockerfile now:
1. Installs all dependencies
2. Builds optimized files with Vite (automatic cache-busting)
3. Removes dev dependencies
4. Serves pre-built files from `dist/` directory

Build and run:
```bash
docker compose up --build
```

## How Cache-Busting Works

- **Development**: Files served directly from `public/`, no caching issues
- **Production**: 
  - Vite builds files to `dist/` with content-based hashes
  - `main-C-xt8lEo.js` becomes `main-D8kL9mPq.js` when content changes
  - Browser automatically downloads new files
  - No more cache issues!

## Project Structure

```
chutes-models-enhanced/
├── public/           # Source files (development)
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── dist/            # Built files (production, git-ignored)
├── server.js        # Express API server
├── vite.config.js   # Vite configuration
└── Dockerfile       # Production build
```
