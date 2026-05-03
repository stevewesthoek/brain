#!/bin/bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot

# Build TypeScript
npm run build || exit 1

# Rebuild native modules (best effort)
npm rebuild 2>/dev/null || npm install --prefer-offline 2>/dev/null || true

# Start ProBot
npm start
