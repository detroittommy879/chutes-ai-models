# Use official Node.js LTS image (supports ARM64)
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy application files
COPY . .

# Build with Vite
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 3888

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "server.js"]
