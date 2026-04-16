#!/bin/bash
# Redirect wrapper for backward compatibility during transition
# This script redirects ~/tools/firecrawl calls to brain/tools/firecrawl

BRAIN_FIRECRAWL_WRAPPER="/Users/Office/Repos/stevewesthoek/brain/tools/firecrawl/firecrawl-wrapper.sh"

if [[ ! -f "$BRAIN_FIRECRAWL_WRAPPER" ]]; then
  echo "[ERROR] Brain firecrawl wrapper not found: $BRAIN_FIRECRAWL_WRAPPER" >&2
  exit 1
fi

# Forward all arguments to brain wrapper
exec "$BRAIN_FIRECRAWL_WRAPPER" "$@"
