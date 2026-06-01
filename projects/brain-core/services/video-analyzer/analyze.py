#!/Users/Office/.local/video-orchestrator/venv/bin/python3
"""
YouTube Video Analysis Pipeline — NotebookLM + Local AI Edition
================================================================

Usage: python3 analyze.py <youtube_url> [--focus "optional focus prompt"]
Output: JSON to stdout

Steps:
  1. Check NotebookLM authentication
  2. Create or reuse dedicated notebook (state persisted locally)
  3. Add YouTube URL to notebook → get source_id
  4. Wait for NotebookLM processing (~30s–2min for typical videos)
  5. Extract full transcript via `source fulltext`
  6. Clean up source
  7. Send transcript + context to local Ollama (via AI Model Selector)
  8. Ollama structures into title/channel/human_summary/ai_summary
  9. Return JSON with transcript + structured metadata

Why NotebookLM + Ollama:
  - NotebookLM handles YouTube natively (no download, no setup)
  - Ollama local (free, no API keys, full privacy)
  - Tight integration: transcript → structured analysis in one flow
"""

import argparse
import json
import os
import sys
import re
import subprocess
import requests
import tempfile
from pathlib import Path
from datetime import datetime

STATE_FILE = Path.home() / '.local' / 'brain' / 'state' / 'notebooklm-video-analyzer.json'
AI_SELECTOR_URL = os.environ.get('AI_SELECTOR_URL', 'http://127.0.0.1:4890')
NOTEBOOKLM_BIN = '/Users/Office/.local/bin/notebooklm'  # Full path to avoid PATH issues
MIND_INBOX = Path.home() / 'Repos' / 'stevewesthoek' / 'mind' / 'capture' / 'inbox'

def log(msg: str):
    """Log to stderr."""
    print(f"[analyze] {msg}", file=sys.stderr, flush=True)

def run_cmd(cmd, check=True):
    """Run command and return (returncode, stdout, stderr)."""
    result = subprocess.run(cmd, capture_output=True, text=True, shell=False)
    return result.returncode, result.stdout, result.stderr

def save_transcript_to_mind(youtube_url: str, title: str, transcript: str):
    """Save transcript to mind/capture/inbox as markdown file. Return file path or None."""
    try:
        MIND_INBOX.mkdir(parents=True, exist_ok=True)

        # Create filename from title + timestamp
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        safe_title = re.sub(r'[^a-z0-9]+', '-', title.lower())[:50].strip('-')
        filename = f"{timestamp}-{safe_title}.md"
        filepath = MIND_INBOX / filename

        # Build markdown content
        content = f"""# {title}

**Source:** {youtube_url}
**Extracted:** {datetime.now().isoformat()}
**Tool:** Brain Console → Research Orchestrator → NotebookLM

## Transcript

{transcript}
"""

        filepath.write_text(content, encoding='utf-8')
        log(f"Saved transcript to {filepath}")
        return str(filepath)
    except Exception as e:
        log(f"Failed to save transcript to mind: {e}")
        return None

def check_notebooklm_auth():
    """Verify NotebookLM auth is valid. Return (ok, error_message)."""
    code, out, err = run_cmd([NOTEBOOKLM_BIN, 'auth', 'check', '--test'])
    if code == 0:
        return True, None
    return False, "NotebookLM auth expired — run: notebooklm login"

def get_or_create_notebook():
    """Get existing notebook ID or create new one. Return notebook_id or error."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Try to load existing
    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
            notebook_id = state.get('notebook_id')
            if notebook_id:
                # Verify it's still valid by trying to use it
                code, _, _ = run_cmd([NOTEBOOKLM_BIN, 'use', notebook_id])
                if code == 0:
                    log(f"Using existing notebook: {notebook_id}")
                    return notebook_id, None
        except:
            pass

    # Create new notebook
    log("Creating new NotebookLM notebook...")
    code, out, err = run_cmd([NOTEBOOKLM_BIN, 'create', 'Brain Video Analyzer', '--json'])
    if code != 0:
        return None, f"Failed to create notebook: {err}"

    try:
        data = json.loads(out)
        # Try nested structure first (notebook.id), then top-level (id)
        notebook_id = data.get('notebook', {}).get('id') or data.get('id')
        if not notebook_id:
            return None, f"No notebook ID in response: {out}"
    except:
        return None, f"Failed to parse notebook creation response: {out}"

    # Use it
    code, _, err = run_cmd([NOTEBOOKLM_BIN, 'use', notebook_id])
    if code != 0:
        return None, f"Failed to use notebook {notebook_id}: {err}"

    # Save state
    STATE_FILE.write_text(json.dumps({'notebook_id': notebook_id, 'created_at': datetime.now().isoformat()}))
    log(f"Created and using notebook: {notebook_id}")
    return notebook_id, None

def extract_transcript(youtube_url):
    """Extract transcript via NotebookLM. Return transcript_text or error."""
    # Add source
    log(f"Adding YouTube source: {youtube_url}")
    code, out, err = run_cmd([NOTEBOOKLM_BIN, 'source', 'add', youtube_url, '--json'])
    if code != 0:
        return None, f"Failed to add source: {err}"

    try:
        data = json.loads(out)
        # Try nested structure first (source.id), then top-level (id)
        source_id = data.get('source', {}).get('id') or data.get('id')
        if not source_id:
            return None, f"No source ID in response: {out}"
    except:
        return None, f"Failed to parse source add response: {out}"

    log(f"Source added: {source_id}. Waiting for processing...")

    # Wait for processing (timeout 300s = 5 min for most videos)
    code, out, err = run_cmd([NOTEBOOKLM_BIN, 'source', 'wait', source_id, '--timeout', '300'])
    if code == 1:
        return None, f"Source processing failed or not found: {err}"
    if code == 2:
        return None, f"Source processing timeout (>5 min)"
    if code != 0:
        return None, f"source wait error: {err}"

    log("Processing complete. Extracting fulltext...")

    # Extract fulltext to temp file (avoids truncation from stdout)
    with tempfile.NamedTemporaryFile(mode='w+', suffix='.txt', delete=False) as tmp:
        tmpfile = tmp.name

    try:
        code, _, err = run_cmd([NOTEBOOKLM_BIN, 'source', 'fulltext', source_id, '-o', tmpfile])
        if code != 0:
            return None, f"Failed to get fulltext: {err}"

        transcript = Path(tmpfile).read_text(encoding='utf-8').strip()
        if not transcript:
            return None, "Fulltext returned empty"

        log(f"Transcript extracted ({len(transcript)} chars)")
    finally:
        # Cleanup temp file
        try:
            Path(tmpfile).unlink()
        except:
            pass

    # Cleanup source (non-fatal if fails)
    subprocess.run([NOTEBOOKLM_BIN, 'source', 'remove', source_id], capture_output=True)

    return transcript, None

def structure_transcript(transcript, focus=None):
    """Send transcript to local Ollama (via AI Model Selector) for structuring. Return dict or None."""
    prompt = f"""Analyze this video transcript. Return ONLY valid JSON (no markdown fences) with exactly these keys:
{{
  "title": "video title (infer from content if not stated)",
  "channel": "speaker or channel name, or null",
  "human_summary": "3-5 sentence prose summary of main points",
  "ai_summary": {{
    "topic": "one-line topic description",
    "speaker": "string or null",
    "key_claims": ["up to 5 short claim strings"],
    "evidence_type": "anecdotal|empirical|opinion|tutorial|news|other",
    "confidence": "high|medium|low",
    "research_hooks": ["up to 4 short research angle strings"]
  }}
}}"""

    if focus:
        prompt += f"\n\n[FOCUS: {focus}]"

    # Truncate transcript for local model context (12k chars ≈ 3000 tokens)
    transcript_truncated = transcript[:12000]
    prompt += f"\n\nTRANSCRIPT:\n{transcript_truncated}"

    try:
        # Step 1: Get a local model from AI Model Selector
        log("Requesting local model from AI Model Selector...")
        sel_resp = requests.post(
            f"{AI_SELECTOR_URL}/select",
            json={
                "task_type": "transcript_summarization",
                "local_only": True,
                "input_token_count": len(prompt) // 4,
            },
            timeout=10,
        )
        if not sel_resp.ok:
            log(f"Selector error: {sel_resp.status_code}")
            return None

        sel_data = sel_resp.json()
        if sel_data.get("deferred"):
            log("Selector deferred — no local model available now")
            return None
        if "error" in sel_data:
            log(f"Selector error: {sel_data['error']}")
            return None

        base_url = sel_data.get("base_url")
        model = sel_data.get("model")
        if not base_url or not model:
            log(f"Invalid selector response: {sel_data}")
            return None

        log(f"Using {model} at {base_url}")

        # Step 2: Call the local model
        resp = requests.post(
            f"{base_url}/chat/completions",
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
            },
            timeout=120,
        )
        if not resp.ok:
            log(f"Model API error: {resp.status_code}")
            return None

        response_data = resp.json()
        if "error" in response_data:
            log(f"Model error: {response_data['error']}")
            return None

        if not response_data.get("choices"):
            log(f"No choices in response")
            return None

        message_text = response_data["choices"][0].get("message", {}).get("content", "").strip()
        if not message_text:
            log("Empty message from model")
            return None

        # Strip markdown fences
        if message_text.startswith("```"):
            message_text = message_text.split("```", 1)[1]
            if message_text.startswith("json"):
                message_text = message_text[4:]
            message_text = message_text.strip()
        if message_text.endswith("```"):
            message_text = message_text.rsplit("```", 1)[0].strip()

        # Parse JSON
        try:
            structured = json.loads(message_text)
            log("Transcript structured successfully")
            return structured
        except json.JSONDecodeError as e:
            log(f"Failed to parse JSON from model: {e}")
            return None

    except Exception as e:
        log(f"Structuring error: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Analyze a YouTube video via NotebookLM + local AI")
    parser.add_argument("url", nargs="?", help="YouTube URL to analyze")
    parser.add_argument("--focus", default="", help="Optional focus prompt for analysis")
    args = parser.parse_args()

    if not args.url:
        print(json.dumps({"ok": False, "error": "No URL provided", "step": "args"}))
        sys.exit(1)

    # Step 1: Auth check
    ok, err = check_notebooklm_auth()
    if not ok:
        print(json.dumps({"ok": False, "error": err, "step": "auth"}))
        sys.exit(0)

    # Step 2: Get/create notebook
    notebook_id, err = get_or_create_notebook()
    if not notebook_id:
        print(json.dumps({"ok": False, "error": err, "step": "notebook"}))
        sys.exit(0)

    # Step 3: Extract transcript
    transcript, err = extract_transcript(args.url)
    if not transcript:
        print(json.dumps({"ok": False, "error": err, "step": "transcript"}))
        sys.exit(0)

    # Step 4: Structure transcript (optional — if fails, still return raw transcript)
    structured = structure_transcript(transcript, args.focus or None)

    # Step 5: Save transcript to mind/capture/inbox
    title = (structured.get("title") if structured else None) or "Untitled Video"
    mind_path = save_transcript_to_mind(args.url, title, transcript)

    # Step 6: Return result
    result = {
        "ok": True,
        "transcript": transcript,
        "title": structured.get("title") if structured else None,
        "channel": structured.get("channel") if structured else None,
        "human_summary": structured.get("human_summary") if structured else None,
        "ai_summary": structured.get("ai_summary") if structured else None,
        "mind_path": mind_path,  # Path to transcript in mind/capture/inbox
    }

    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"Unexpected error: {e}")
        print(json.dumps({"ok": False, "error": str(e), "step": "unexpected"}))
        sys.exit(1)
