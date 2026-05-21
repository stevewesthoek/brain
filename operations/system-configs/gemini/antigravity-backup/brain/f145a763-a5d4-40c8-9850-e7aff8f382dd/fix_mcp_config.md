# NotebookLM MCP Fix Plan

## Problem
The previous configuration pointed to `/Users/Office/.local/bin/notebooklm-mcp` but included unnecessary arguments (`--config ... server`) which caused the server to fail.

## Solution
1. **Simplify Command**: Correct the MCP configuration to use *only* the binary path: `/Users/Office/.local/bin/notebooklm-mcp`.
2. **Remove Config**: The tool uses environment variables or sensible defaults, so the `--config` flag is unnecessary for the basic start.
3. **Verify**: Ensure Antigravity can launch the server successfully this time.

## Verification
- List resources via `notebook_list` tool (if available after restart).
