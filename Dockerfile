# Use official Node.js LTS image (supports ARM64)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 3888

# Start the application
CMD ["node", "server.js"]
