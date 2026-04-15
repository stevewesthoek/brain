#!/bin/bash

# Firecrawl API Test Script — Port 3051
# Verifies the Firecrawl API is working on the new port

set -e

API_HOST="${FIRECRAWL_HOST:-localhost:3051}"
TIMEOUT=10

echo "🧪 Firecrawl API Test Suite (Port 3051)"
echo "======================================"
echo ""

# Test 1: API Connectivity
echo "Test 1: API Connectivity"
echo "  Endpoint: /"
response=$(curl -s --connect-timeout $TIMEOUT -w "\n%{http_code}" "http://$API_HOST/")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "200" ]; then
  echo "  ✓ API is responsive (HTTP 200)"
elif [ "$http_code" = "404" ] || [ "$http_code" = "405" ]; then
  echo "  ✓ API is running (HTTP $http_code is expected for this endpoint)"
else
  echo "  ✗ API connectivity failed (HTTP $http_code)"
  exit 1
fi

echo ""

# Test 2: Single URL Scrape
echo "Test 2: Single URL Scrape"
echo "  Endpoint: /v1/scrape"
response=$(curl -s --connect-timeout $TIMEOUT -X POST "http://$API_HOST/v1/scrape" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }')

success=$(echo "$response" | jq -r '.success // empty')
if [ "$success" = "true" ]; then
  echo "  ✓ Scrape test passed"
  echo "  Sample content:"
  echo "$response" | jq -r '.data.markdown // empty' | head -3 | sed 's/^/    /'
else
  echo "  ✗ Scrape test failed"
  echo "$response" | jq '.' | sed 's/^/  /'
  exit 1
fi

echo ""

# Test 3: Web Search
echo "Test 3: Web Search"
echo "  Endpoint: /v1/search"
response=$(curl -s --connect-timeout $TIMEOUT -X POST "http://$API_HOST/v1/search" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "React design systems",
    "limit": 2,
    "scrape": true
  }')

result_count=$(echo "$response" | jq 'length // 0')
if [ "$result_count" -gt 0 ]; then
  echo "  ✓ Search test passed ($result_count results)"
  echo "  First result:"
  echo "$response" | jq '.[0] | {title, url}' | sed 's/^/    /'
else
  echo "  ✗ Search test failed"
  echo "$response" | jq '.' | sed 's/^/  /'
  exit 1
fi

echo ""
echo "======================================"
echo "✓ All tests passed! Firecrawl is working on port 3051"
