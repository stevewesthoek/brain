export function renderPasteIntoEvermindHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Paste into Evermind</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0b0c; color: #f5f5f7; padding: 24px; }
    main { width: min(680px, 100%); }
    .eyebrow { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #8e8e93; margin-bottom: 12px; }
    h1 { font-size: clamp(32px, 6vw, 52px); font-weight: 500; letter-spacing: -.04em; margin: 0 0 12px; }
    p { color: #b7b7bd; line-height: 1.55; margin: 0 0 24px; }
    form { display: grid; gap: 12px; }
    textarea { width: 100%; min-height: 220px; resize: vertical; border-radius: 18px; border: 1px solid #2e2e32; background: #151517; color: #fff; padding: 18px; font: inherit; line-height: 1.5; outline: none; }
    textarea:focus { border-color: #606067; box-shadow: 0 0 0 3px rgba(255,255,255,.06); }
    .row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    button { appearance: none; border: 0; border-radius: 999px; background: #f5f5f7; color: #0b0b0c; padding: 12px 18px; font: inherit; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    #status { min-height: 24px; color: #a8a8ae; font-size: 14px; }
    code { color: #d4d4d8; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Evermind intake</div>
    <h1>Paste into Evermind</h1>
    <p>Paste a URL or free text. Evermind stores it as raw, unreviewed input. Processing and approval happen later.</p>
    <form id="capture-form">
      <textarea id="content" name="content" autofocus placeholder="Paste a URL, note, idea, quote, or anything worth reviewing…"></textarea>
      <div class="row">
        <div id="status" role="status" aria-live="polite"></div>
        <button id="submit" type="submit">Add to Evermind</button>
      </div>
    </form>
  </main>
  <script>
    const form = document.getElementById('capture-form');
    const content = document.getElementById('content');
    const status = document.getElementById('status');
    const button = document.getElementById('submit');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = content.value.trim();
      if (!value) return;
      button.disabled = true;
      status.textContent = 'Adding…';
      try {
        const isUrl = /^https?:\\/\\/\\S+$/i.test(value);
        const response = await fetch('/capture', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            content: value,
            sourceType: isUrl ? 'url' : 'paste',
            provenance: 'paste-ui'
          })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.code || 'capture_failed');
        content.value = '';
        status.textContent = 'Added to review inbox.';
        content.focus();
      } catch (error) {
        status.textContent = 'Could not add: ' + error.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
