---
name: dokploy-deploy-api-commit-metadata
description: When Dokploy shows "new changes" for every deployment instead of real commit messages — the webhook endpoint (/api/deploy/:token) doesn't accept metadata; use POST /api/application.deploy with title/description instead.
---

# Dokploy Deployment Labels: Passing Commit Metadata

## The insight
Dokploy has two ways to trigger a redeploy:
1. `GET /api/deploy/:refreshToken` — the webhook. Fire-and-forget. No metadata supported. Always labels deployments "new changes".
2. `POST /api/application.deploy` — the API endpoint. Accepts `title` and `description` fields that appear in the Dokploy deployments tab.

Switching to the API endpoint lets you pass the git commit subject as `title` and author/date/sha as `description`.

## The fix
In GitHub Actions, replace the webhook curl with:

```yaml
- name: Trigger Dokploy redeploy
  run: |
    COMMIT_MSG=$(git log -1 --pretty=format:"%s" ${{ github.sha }})
    COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an" ${{ github.sha }})
    COMMIT_DATE=$(git log -1 --pretty=format:"%ci" ${{ github.sha }})
    DESCRIPTION="${COMMIT_AUTHOR} · ${COMMIT_DATE}"$'\n\n'"${{ github.sha }}"

    RESPONSE=$(curl -s -o /tmp/dokploy_response.json -w "%{http_code}" \
      -X POST "https://dokploy.prochat.tools/api/application.deploy" \
      -H "x-api-key: ${{ secrets.DOKPLOY_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d "{
        \"applicationId\": \"${{ secrets.DOKPLOY_APP_ID }}\",
        \"title\": $(echo "$COMMIT_MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
        \"description\": $(echo "$DESCRIPTION" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')
      }")

    echo "HTTP status: $RESPONSE"
    cat /tmp/dokploy_response.json

    if [ "$RESPONSE" != "200" ]; then
      echo "Dokploy trigger failed with status $RESPONSE"
      exit 1
    fi
```

Required secrets: `DOKPLOY_API_KEY` (server API key from `~/.config/dokploy/.env`), `DOKPLOY_APP_ID` (application ID — find via `application.one` API or Dokploy dashboard URL).

## Gotchas
- The `python3 -c 'import json...'` wrapping is essential — raw bash strings injected into JSON break on quotes, apostrophes, or special characters in commit messages.
- `DOKPLOY_APP_ID` is per-app; set it as a repo secret in each GitHub repo individually.
- The old `DOKPLOY_WEBHOOK_TOKEN` and `DOKPLOY_URL` secrets are no longer needed once migrated.
- The API endpoint returns 200 on success; the webhook returns 200 too but carries no body — make sure to check the response body (`cat /tmp/dokploy_response.json`) for diagnostic info on failure.

## Context
Repo: all 8 Dokploy docker-source apps (prochattools + yeshuaacademy orgs)
Discovered: 2026-04-15
Area: .github/workflows/deploy.yml, Dokploy deployments tab
