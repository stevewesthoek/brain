# Video Orchestrator Phase 3A - Manual Upload Adapter

## Purpose

Phase 3A adds a safe publishing-layer adapter that exports a complete local upload package for a human to upload manually. It does not post to any platform API.

## What It Does

- Loads the latest production package manifest for a video
- Finds the requested `platform` and `package_target`
- Exports a package folder with copied media, metadata, instructions, package manifest, and checksums
- Emits an audit event for the export
- Marks the post job succeeded with the package folder as the output path

## What It Does Not Do

- No YouTube, TikTok, Instagram, Facebook, LinkedIn, Bluesky, or X API posting
- No OAuth, tokens, cookies, app passwords, browser automation, or credential checks
- No network upload

## Prerequisites

- Phase 2B and Phase 2C artifacts already exist
- A schema-valid production package manifest exists for the video
- The target package is upload-ready unless `allow_incomplete_manual_package` is explicitly enabled
- Local source files referenced by the manifest are available

## Sample Post Job

```json
{
  "job_type": "post",
  "video_id": "00000000-0000-4000-8000-000000000001",
  "task_config": {
    "video_id": "00000000-0000-4000-8000-000000000001",
    "platform": "youtube",
    "package_target": "long-form",
    "adapter_mode": "manual",
    "manual_export_root": "/Users/Office/projects/video-orchestrator/upload-packages"
  }
}
```

## Output Folder

Default root:

`/Users/Office/projects/video-orchestrator/upload-packages`

Suggested export path:

`<manual_export_root>/<video_id>/<platform>__<package_target>/`

Example files:

```text
video.mp4
thumbnail.jpg
captions/en.srt
captions/en.vtt
metadata.json
instructions.md
package-manifest.json
checksums.sha256
```

## Validation Steps

1. Run a `post` job with `adapter_mode: manual`.
2. Confirm the package folder exists.
3. Confirm `metadata.json`, `instructions.md`, `package-manifest.json`, and `checksums.sha256` are valid.
4. Confirm copied files exist.
5. Confirm the worker emitted a `manual_package_exported` event.

## Incomplete Packages

- Incomplete exports fail safely unless `allow_incomplete_manual_package` is explicitly set to `true`.
- When incomplete exports are allowed, the package includes warning text and remains clearly non-automatic.
- Source manifest warnings are copied into `metadata.json`, `instructions.md`, and `package-manifest.json`.
- Human uploaders must review warnings before posting.
- Placeholder captions, invalid thumbnails, and other caveats remain visible in the exported package.

## Later Phases

Phase 3B and later can add real API adapters on top of this export/audit/idempotency layer without changing the manual export contract.
