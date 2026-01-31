---
name: notebooklm
description: Use when the user asks to do research, deep dives, or analysis via NotebookLM (create a notebook, gather sources, run research_start/research_import, and produce a concise bullet report). Examples: "Please do a deep dive of <subject>", "I want you to research about <subject>", "Please analyze this topic about <subject>", "Use NotebookLM to research <subject>", "Create a NotebookLM notebook about <subject>", "Deep research via NotebookLM on <subject>".
---

# NotebookLM

## Tool list
See `TOOLS.md` in this folder for the full MCP tool list.

## Scope
- Use NotebookLM MCP for all research work.
- Include all NotebookLM MCP tools (see tool list).
- Do not do the research yourself.

## Required inputs
Ask for:
- Subject/topic
- Sources (if any). If none, ask: "Do you want to continue without sources?"

## Naming
Auto-name the notebook as: "{topic} - {YYYY-MM-DD}". Do not ask for confirmation.

## Workflow
1. Create a notebook (auto-name).
2. If sources provided, add them.
3. If sources are missing or limited, run research_start and research_import to gather sources until near cap (~50).
4. Use notebook_query to produce a concise bullet report.

## Output format (return to user)
Return a short bullet report that includes:
- 1–2 sentence summary
- Key conclusions
- Source count and source types
- Confidence / reliability note

## Auth recovery
If auth fails, instruct the user to run:
  /Users/Office/.local/bin/notebooklm-mcp-auth

## Confirm-required tools
Some tools require confirm=True (reports, studio artifacts, destructive actions). Ask for explicit user approval before using those tools.
