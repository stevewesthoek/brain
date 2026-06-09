# AWS Video Paths

**Status:** canonical

Brain Core is the API runtime for AWS Video dashboard/status calls. Brain Core does not own AWS Video job storage.

## Canonical Storage

Canonical local AWS Video jobs path:

```text
/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud/jobs
```

Repo-relative path:

```text
projects/video-orchestrator/cloud/jobs
```

Canonical remote AWS Video storage:

```text
s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/
```

Brain Console calls Brain Core.

## Resolver Rules

Brain Core resolves the Brain repo root from its own module/source location and then appends:

```text
projects/video-orchestrator/cloud/jobs
```

Never use `process.cwd()` to infer the jobs folder. Brain Core must work when launched from `projects/brain-core`, the Brain repo root, or any other cwd.

Never create AWS Video jobs under:

```text
projects/brain-core/jobs
projects/brain-console/jobs
```

## Diagnostics

If the dashboard shows 0 jobs, first check `/api/video-orchestrator/jobs/recent` diagnostics. A path or filesystem error must be visible as diagnostics, not rendered as a legitimate empty job list.

Development diagnostics include:

```text
jobsRoot
repoRoot
jobDirectoryExists
jobDirectoryReadable
localJobFolderCount
```

## Verification

```bash
cd /Users/Office/Repos/stevewesthoek/brain
ls -1 projects/video-orchestrator/cloud/jobs | head
curl -sS http://127.0.0.1:4877/api/video-orchestrator/jobs/recent | jq '.diagnostics, .jobs | length'
```
