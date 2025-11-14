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


# Debug: Show what's in the bigtokens directory after copying
RUN echo "=== DEBUG: Contents of /app/bigtokens ===" && \
    ls -la /app/bigtokens && \
    echo "=== DEBUG: Contents of /app/bigtokens/generated_tokens ===" && \
    ls -la /app/bigtokens/generated_tokens && \
    echo "=== DEBUG: Contents of /app/bigtokens/ (recursive) ===" && \
    find /app/bigtokens -type f | head -20

# …
# Build with Vite
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 3444

# Set production environment
ENV NODE_ENV=production

# Start the application with logging
CMD ["sh", "-c", "echo '=== DEBUG: Starting server ===' && echo 'Current directory: $(pwd)' && echo 'Contents of /app:' && ls -la /app && echo 'Contents of /app/bigtokens:' && ls -la /app/bigtokens && echo 'Contents of /app/bigtokens/generated_tokens:' && ls -la /app/bigtokens/generated_tokens && node server.js"]
