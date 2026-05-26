# Stage 1: Build and dependency installation
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Stage 2: Production release
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy package definition files
COPY package*.json ./

# Install only production dependencies and clean cache
RUN npm ci --only=production && npm cache clean --force

# Copy source code and static assets from builder
COPY --from=builder /usr/src/app/src ./src

# Create a non-root system user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /usr/src/app

USER appuser

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
