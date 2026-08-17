# Use lightweight official Node.js runtime
FROM node:20-slim

# Install dependencies required for chromium / native modules if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first to cache dependency install layer
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --production

# Copy application source code
COPY . .

# Expose web dashboard port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Start application (launches bot + web dashboard)
CMD ["node", "index.js"]
