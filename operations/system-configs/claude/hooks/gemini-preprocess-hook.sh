#!/usr/bin/env bash

# Gemini Flash Auto-Preprocessing Hook
# Automatically compresses large, noisy input with Gemini Flash (free)
# to reduce downstream context size and improve reasoning quality.
#
# Triggers on: Read, WebFetch, Glob output
# Decision logic:
#   - Skip: <5k tokens (latency cost > benefit)
#   - Check: 5-20k tokens (compress if URL/prose, skip if code)
#   - Always: >20k tokens (compression always wins)
#
# Stores result in CLAUDE_PREPROCESSED_CONTENT env var for Claude to use

set -e

# Get the content and metadata from the tool result
CONTENT="$1"
TOOL_NAME="$2"
SOURCE_URL="$3"  # optional, for WebFetch

# Rough token estimate: ~4 chars per token (conservative)
CONTENT_LENGTH=${#CONTENT}
ESTIMATED_TOKENS=$((CONTENT_LENGTH / 4))

# Decision thresholds
SKIP_THRESHOLD=5000      # Don't preprocess tiny inputs
SMART_CHECK_THRESHOLD=20000  # Smart check for medium inputs
ALWAYS_COMPRESS_THRESHOLD=20000  # Always compress large inputs

# Determine if this is likely code or prose
is_code_like() {
    local content="$1"
    # Check for code indicators: braces, semicolons, imports, function defs, etc.
    if echo "$content" | grep -qE '(^|\n)\s*(import|from|function|def|class|interface|const|let|var|fn|pub|async|await|=>|{|}|;)'; then
        return 0  # It's code
    fi
    return 1  # It's prose
}

# Determine preprocessing strategy
should_preprocess() {
    local tokens=$1
    local is_code=$2
    local is_url=$3

    # Never preprocess tiny inputs
    if [[ $tokens -lt $SKIP_THRESHOLD ]]; then
        return 1
    fi

    # Medium inputs: only preprocess if URL (prose) or non-code
    if [[ $tokens -lt $ALWAYS_COMPRESS_THRESHOLD ]]; then
        # If it's a URL fetch (not a local file read), preprocess (likely prose)
        if [[ $is_url == "true" ]]; then
            return 0
        fi
        # If it's clearly code, skip
        if [[ $is_code == "true" ]]; then
            return 1
        fi
        # Otherwise, preprocess (likely prose/text)
        return 0
    fi

    # Large inputs: always preprocess
    return 0
}

# Determine if this is a URL fetch
IS_URL="false"
if [[ "$TOOL_NAME" == "WebFetch" ]] || [[ -n "$SOURCE_URL" ]]; then
    IS_URL="true"
fi

# Determine if content looks like code
IS_CODE="false"
if is_code_like "$CONTENT"; then
    IS_CODE="true"
fi

# Make preprocessing decision
if should_preprocess "$ESTIMATED_TOKENS" "$IS_CODE" "$IS_URL"; then
    echo "[Gemini Preprocess] Tokens: ~$ESTIMATED_TOKENS | Type: $([ "$IS_CODE" = "true" ] && echo "CODE" || echo "PROSE") | Action: COMPRESS"

    # Call gemini flash to compress
    # Note: This assumes `gemini` CLI is available and configured
    # The summary is piped back for Claude to use

    COMPRESSED=$(echo "$CONTENT" | gemini-review.sh "Summarize this into 1/4 the length. Keep all technical details. Remove filler, repetition, meta-text. Be terse." flash 2>/dev/null || echo "$CONTENT")

    # Store in env for Claude to see
    export CLAUDE_PREPROCESSED_CONTENT="$COMPRESSED"
    export CLAUDE_PREPROCESSING_APPLIED="true"

    COMPRESSED_LENGTH=${#COMPRESSED}
    COMPRESSED_TOKENS=$((COMPRESSED_LENGTH / 4))
    SAVINGS=$((100 * (ESTIMATED_TOKENS - COMPRESSED_TOKENS) / ESTIMATED_TOKENS))

    echo "[Gemini Preprocess] Result: ~$COMPRESSED_TOKENS tokens (saved $SAVINGS%)"
else
    echo "[Gemini Preprocess] Tokens: ~$ESTIMATED_TOKENS | Type: $([ "$IS_CODE" = "true" ] && echo "CODE" || echo "PROSE") | Action: SKIP (not worth compressing)"
    export CLAUDE_PREPROCESSED_CONTENT="$CONTENT"
    export CLAUDE_PREPROCESSING_APPLIED="false"
fi

exit 0
