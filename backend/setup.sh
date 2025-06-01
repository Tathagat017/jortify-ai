#!/bin/bash

# Install dependencies
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env file from .env.example"
  echo "Please update the .env file with your Supabase credentials"
fi

# Create necessary directories
mkdir -p src/{routes,middleware,utils,types}

# Build TypeScript
npm run build

echo "Backend setup complete!" 