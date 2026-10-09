FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire repository
COPY . .

# Install Firebase Functions dependencies
WORKDIR /app/functions
RUN npm install --ignore-scripts

# Back to root — no build step needed (vanilla JS, no bundler required for scanning)
WORKDIR /app

# Install any root-level dev tools if present
RUN if [ -f package.json ]; then npm install --ignore-scripts; fi
