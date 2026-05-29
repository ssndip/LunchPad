# Build stage
FROM node:20-alpine AS build-stage

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate dynamic build version timestamp
RUN echo "export const APP_VERSION = 'v$(date +'%Y.%m.%d-%H%M')';" > src/version.ts

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the built frontend and modular server files
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/server.ts ./
COPY --from=build-stage /app/server ./server
COPY --from=build-stage /app/src/types.ts ./src/types.ts

# Create a directory for the database and set permissions
RUN mkdir -p /app/data && chown node:node /app/data

# Expose the application port
EXPOSE 3400

# Start the application
CMD ["npm", "start"]
