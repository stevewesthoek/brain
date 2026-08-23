# Brain Console Brain Core Projection Runbook

## Start

Start the compiled Brain Core runtime first:

```bash
cd projects/brain-core
npm run build
npm start
```

Then start Brain Console:

```bash
cd projects/brain-console
npm run build
npm start
```

Open `http://localhost:4881`. The Infinite Brain Projections panel reads the Brain Core endpoints under `/projections/*` and refreshes every 30 seconds.

## Interpretation

`fresh` indicates the validated envelope was received and reports its freshness state. `loading` is an in-flight request. `unavailable` means Brain Core is offline, timed out, or returned a response that failed the projection contract schema. Retry after confirming Brain Core owns port 4877.

The Console does not approve proposals, promote knowledge, write Mind, execute actions, or change Brain state. Use the canonical Brain Core and human review workflows for those operations.

## Boundaries

The Console is a read-only consumer. It does not replace Obsidian as the human cockpit, create a second authority, or bypass Brain Core.
