# YouTube channel account split

The video orchestrator uses **one OAuth setup per YouTube channel**. Do not use the legacy shared `~/.config/youtube/.env` file for production uploads.

## Channel mapping

| Video channel ID | Google account to choose | Config file | Token file |
| --- | --- | --- | --- |
| `prochat` | ProChat Studio / `info@prochat.tools` | `~/.config/youtube/prochat.env` | `~/.youtube_tokens-prochat.json` |
| `says-the-bible` | Says the Bible YouTube account | `~/.config/youtube/says-the-bible.env` | `~/.youtube_tokens-says-the-bible.json` |

A `prochat-*` job automatically uses the `prochat` setup. A `says-the-bible-*` job automatically uses the `says-the-bible` setup.

## Config file format

`~/.config/youtube/prochat.env`:

```bash
YOUTUBE_CLIENT_SECRET_JSON=/Users/Office/.config/youtube/prochat_client_secret.json
YOUTUBE_TOKEN_FILE=/Users/Office/.youtube_tokens-prochat.json
YOUTUBE_EXPECTED_ACCOUNT=info@prochat.tools
YOUTUBE_EXPECTED_CHANNEL_LABEL="ProChat Studio"
```

`~/.config/youtube/says-the-bible.env`:

```bash
YOUTUBE_CLIENT_SECRET_JSON=/Users/Office/.config/youtube/says_the_bible_client_secret.json
YOUTUBE_TOKEN_FILE=/Users/Office/.youtube_tokens-says-the-bible.json
YOUTUBE_EXPECTED_ACCOUNT=<the Google account that owns Says the Bible>
YOUTUBE_EXPECTED_CHANNEL_LABEL="Says the Bible YouTube"
```

The scripts do not commit or create these local secret files. They only read them from the local machine.

## Auth setup

Authenticate one channel at a time:

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud

bash scripts/youtube-auth-local.sh prochat
bash scripts/youtube-auth-local.sh says-the-bible
```

When Google asks which account to use, choose the account listed in that channel's config. If the Google screen says the wrong product/account, stop and fix that channel config before authorizing.

## Upload dry-run

```bash
JOB_ID="prochat-prompt-1780433156680-make-a-video-of-a-dog"
bash scripts/youtube-upload-local.sh "$JOB_ID" --dry-run
```

For this job, the script infers `prochat`, loads `~/.config/youtube/prochat.env`, and uses `~/.youtube_tokens-prochat.json`.

## Why this split exists

The old shared config allowed a ProChat job to accidentally open a Says-the-Bible OAuth consent screen or reuse the wrong token. The channel-scoped setup prevents that class of mistake.
