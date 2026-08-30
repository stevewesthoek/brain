# Brain Scheduler n8n Backup Review — 2026-08-30

## Scope and safety boundary

This is a read-only security and disaster-recovery review of the single
`n8n-backup` NEEDS REVIEW job. The review did not run a backup, export
credentials, open or parse credential backup payloads, restore n8n, activate a
job, modify the Brain Scheduler LaunchAgent, mutate n8n, or review another
NEEDS REVIEW job.

The review source is a clean worktree at the accepted source SHA
`d55599da1729089bcce000b3e4eac451efe28f50`, which equals the fetched
`origin/main`. There was no source delta to inspect for this review. The
shared Brain checkout remains on `codex/cloudflare-tooling-normalization` at
`41e122dac70ada5757adb065b2b5895a1cd56d45` with 80 pre-existing dirty entries;
it was not changed. The clean `brain-runtime` checkout and the scheduler
LaunchAgent were not changed.

## 1. Source SHA

- Review source: `d55599da1729089bcce000b3e4eac451efe28f50`
- `origin/main`: `d55599da1729089bcce000b3e4eac451efe28f50`
- Registry: `operations/specs/typed-scheduler-jobs.json`, 17 jobs
- `n8n-backup` registry state: `lifecycle=disabled`, `mode=disabled`,
  `schedule=not scheduled`, `reviewCategory=NEEDS REVIEW`,
  `externalActivation=unknown`
- Registry dependency: `n8n-backup -> stb-pipeline-batch`

The typed registry and scheduler runbook correctly keep this credential-bearing
external-write-capable job disabled. The scheduler policy also says active jobs
must be local read-only report work and that credential-sensitive or
external-write jobs must remain disabled or policy-blocked.

Evidence: `operations/specs/typed-scheduler-jobs.json:7-8`,
`operations/runbooks/brain-scheduler.md:68-70,88-103,122-129`.

## 2. Current n8n architecture

The live service is healthy at the application health endpoint (`HTTP 200`,
`{"status":"ok"}`), but backup health is a separate question.

Sanitized metadata-only SSH/Docker inspection on 2026-08-30 found:

- Platform: AWS Linux host reached through SSH alias `dokploy`, with Dokploy
  Docker Compose deployment.
- Compose project: `apps-internal-n8n-cvjx2s`.
- n8n container: `apps-internal-n8n-cvjx2s-n8n-1`, running image
  `n8nio/n8n:2.4.7`.
- Database: PostgreSQL configuration is present; the documented architecture
  uses a compose-internal PostgreSQL service/network.
- Persistence: one read-write Docker volume is mounted at
  `/home/node/.n8n` (`apps-internal-n8n-cvjx2s_n8n_data`).
- Encryption: an `N8N_ENCRYPTION_KEY` environment entry is present. The key
  value was not read. Whether the Dokploy deployment configuration containing
  that key is backed up is not proven.
- Binary storage mode, execution-retention settings, and any separate binary
  storage are unknown from the sanitized probe.
- The documented live state is 43 workflows, 6 active, 17 encrypted
  credentials, 2 n8n API keys, and 6 webhook registrations, verified by older
  repository evidence on 2026-08-19. That is not current backup-artifact
  evidence.

Evidence: `operations/infrastructure/infra.md:303-340`; live sanitized probe;
`operations/runbooks/n8n.md:3-14`.

## 3. Existing backup mechanism

`tools/scripts/run-n8n-backup-schedule.sh` applies a Europe/Lisbon after-03:00
once-per-day guard and then invokes `tools/scripts/backup-n8n.sh`.

`tools/scripts/backup-n8n.sh` currently:

1. SSHes to `dokploy` and auto-detects an `n8nio/n8n` container.
2. Runs `n8n export:credentials --all --decrypted --pretty`.
3. Runs `n8n export:credentials --all --pretty`.
4. Runs `n8n export:workflow --all --pretty`.
5. Writes all three outputs and metadata below the local
   `operations/automations/n8n/n8n_backup/<timestamp>/` directory.
6. Applies mode 700 to directories, mode 600 to files, and updates a `latest`
   symlink.

The implementation has no retention deletion, maximum count/age/size, secure
deletion, encryption-envelope operation, checksum/signature, immutable
destination, off-machine copy, or restore-test gate. It also creates the
output directory before exports and has no cleanup trap for partial output.

The current live SSH user cannot access Docker through the bare Docker socket:
the metadata-only command matching the script’s `docker ps` form returned
Docker-socket permission denied. A sanitized passwordless-sudo probe could
inspect the container, but the backup script does not use sudo. Thus the
current script is operationally blocked against the observed live host even
before its recovery and security gaps are considered.

Evidence: `tools/scripts/backup-n8n.sh:4-61`,
`tools/scripts/run-n8n-backup-schedule.sh:4-27`,
`operations/runbooks/n8n.md:16-74,118-140`.

## 4. Secret exposure assessment

The decrypted export is credential-equivalent plaintext. The runbook states
that existing OAuth credentials are included; the export design can therefore
contain stored OAuth tokens, API keys, passwords, or equivalent credential
material. No credential names or values were displayed.

The encrypted export remains sensitive and depends on the n8n encryption key.
The script does not export or escrow that key. Local mode 700/600 settings and
the gitignore rule reduce accidental access, but they do not turn routine
plaintext persistence into a safe backup boundary. A compromise of the Office
user account or any copied plaintext artifact would expose the credential
material.

Security findings:

| Control | Result | Evidence or gap |
| --- | --- | --- |
| Decrypted credential export | YES | Explicit `--decrypted` export in `backup-n8n.sh:40`; documented payload in `n8n.md:18-22`. |
| Encrypted credential export | YES | Explicit encrypted export in `backup-n8n.sh:41`. |
| Local plaintext persistence | YES | Decrypted JSON is written under the Office checkout. |
| Filesystem permissions | PARTIAL | Intended directory mode 700 and file mode 600; redirection occurs before final chmod and partial files are not cleaned. |
| Directory ownership | UNKNOWN | Approved root is absent; no ownership evidence for a retained artifact. |
| Gitignore protection | YES | `operations/automations/n8n/n8n_backup/` is ignored and no tracked credential backup payload was found. This is not encryption or offsite protection. |
| Encryption at rest | PARTIAL | Encrypted export is present by design, but the decrypted export is not encrypted at rest and no envelope is implemented. |
| Retention | NO | No age/count/size policy or deletion path exists. |
| Rotation | NO | No credential/key rotation or backup-key lifecycle is implemented. |
| Backup age | UNKNOWN | No current artifact exists in the approved root; older documentation is not a current artifact receipt. |
| Off-machine redundancy | UNKNOWN | Catalog destination and retention are unknown; no off-machine artifact was proven. |
| Integrity verification | NO | No checksum, signature, manifest hash, or verification step. |
| Restore testing | NO | Runbook has a procedure outline but no successful restore-drill evidence. |
| Access-control boundary | PARTIAL | Local Unix permissions exist, but the job uses the user SSH identity and writes secrets into a user-local checkout without a dedicated backup boundary. |

## 5. Existing-backup metadata

Metadata-only inspection was limited to the configured backup roots. Contents
were not inspected, opened, parsed, or displayed.

| Field | Observation |
| --- | --- |
| Approved canonical root | `/Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/n8n_backup` does not exist. |
| Clean runtime mirror | The corresponding root under `brain-runtime` does not exist. |
| Backup generation count | 0 observed in the approved roots. |
| Oldest/newest backup | Not applicable; no generation directory observed. |
| Approximate total size | 0 bytes observed in the approved roots. |
| `latest` symlink | Not present because the root is absent. |
| Decrypted backups present | NO in the inspected approved roots. This does not prove that no unapproved copy exists elsewhere. |
| Individual expected files | Not present in the inspected `latest` path because the root is absent. |
| Contents inspected | NO. |

Older repository documentation records a verified 2026-04-03 export of 4
credentials and 40 workflows, but no corresponding current artifact was found.
The infrastructure catalog marks n8n retention and destination as unknown and
does not provide a current restore-verification cadence.

Evidence: `operations/infrastructure/infra.md:330-340`,
`operations/infrastructure/catalog/backup-policies.v1.json:4-22`.

## 6. Recovery coverage matrix

This matrix describes the existing script, not a proposed replacement.

| Recovery state | Script coverage | Assessment |
| --- | --- | --- |
| Workflow definitions | YES | Exports all workflows through the n8n CLI. |
| Credential definitions | YES | Exports all credentials in encrypted and decrypted forms. |
| Decrypted secret material | YES | Explicit plaintext credential export. |
| n8n database state | NO | No PostgreSQL dump or database snapshot. |
| n8n encryption key | NO | The key is not exported or included. |
| Binary data | NO | No binary-data export or volume snapshot. |
| Execution history | NO | No execution database/table export or retention capture. |
| User/project configuration | NO | No complete database or project/user configuration export. |
| Webhook/runtime configuration | PARTIAL | Workflow definitions may contain workflow-level webhook data; proxy, domain, runtime, deployment, and global n8n configuration are not captured. |
| Other persistent volumes | NO | No volume or host snapshot. |

The export is therefore a partial application-state extraction, not a complete
disaster-recovery solution.

## 7. Retention and offsite resilience

Retention is not defined in the script or n8n runbook beyond a `latest`
symlink. No old-generation cleanup is present. There is no maximum count, age,
size, secure deletion, encryption-key rotation, or operator cleanup procedure.

The canonical infrastructure catalog records the n8n destination and retention
as unknown. Current AWS Dokploy recovery cadence is separately recorded as
unknown, and no n8n-specific off-machine artifact or restore verification was
proven. A local Office Mac export would not survive loss of that Mac. A
credential/workflow export alone would not reconstruct the full n8n volume,
database, key, or runtime. No evidence proves survival of simultaneous loss of
the n8n host and Office Mac.

Evidence: `operations/infrastructure/catalog/backup-policies.v1.json:4-34`,
`operations/infrastructure/health/backup-runtime-state.v1.json:1-29`.

## 8. Restore-readiness evidence

The runbook documents a broad order: recreate n8n, reuse the same encryption
key if possible, import workflows, import credentials, validate credentials and
workflows, reactivate required workflows, and test triggers/webhooks. That is
useful operator guidance but does not establish a tested restore.

Readiness gaps:

- The live image is `2.4.7`, while the separate n8n access runbook documents
  CLI version `2.22.5` and an expectation of `2.22.5 or higher`; no compatible
  restore target has been proven.
- The encryption key is not part of the backup set and its recoverability is
  not evidenced.
- There is no PostgreSQL/database restore procedure for the n8n application
  state, no volume restore procedure, and no binary-data recovery procedure.
- Import ordering is described only for workflows and credentials; no tested
  database/key/deployment sequence is recorded.
- Webhook reactivation, external endpoint/proxy configuration, and runtime
  environment restoration are validation bullets, not verified evidence.
- No disposable-environment restore drill, checksum validation, or
  application-level acceptance receipt was found.

Conclusion: restore readiness is LOW.

Evidence: `operations/runbooks/n8n.md:76-116`,
`operations/runbooks/n8n-access-setup.md:144-157,189-197`,
`operations/infrastructure/infra.md:305-328`.

## 9. STB dependency assessment

Classification: HISTORICAL.

The typed registry declares `n8n-backup` after `stb-pipeline-batch`, but the
n8n backup script does not call the STB pipeline and the nightly wrapper has no
direct n8n reference. The runner handles disabled lifecycle state before
checking failed dependencies, so the current disabled n8n job does not cause a
runtime chain. `claude-session-cleanup` retains a reverse historical dependency
on `n8n-backup`, but it is also disabled and destructive.

This is a legacy ordering/dependency graph, not a real technical requirement
for n8n recovery. A future replacement must have an independent infrastructure
backup owner and must not wait on an external-write STB lane.

Evidence: `operations/specs/typed-scheduler-jobs.json:6-8`,
`tools/scripts/brain-scheduler-runner.mjs:297-324`,
`tools/scripts/office-nightly-scheduler.sh` (no n8n reference).

## 10. Recommended modern architecture

Use Option 5 below: Git plus infrastructure backup, with Option 3 and Option 4
as the recovery mechanisms and Option 6 as break-glass support.

Recommended responsibility split:

- Infrastructure owns encrypted, application-consistent n8n recovery: the
  PostgreSQL database, persistent n8n volume/binary data, deployment/runtime
  configuration, and a separately protected encryption-key recovery path.
- Use an off-machine, access-controlled destination with explicit retention,
  rotation, immutable or append-only protection where available, integrity
  manifests/checksums, and regular disposable-environment restore drills.
- Keep curated workflow definitions in Git as a reproducible source artifact,
  while treating live database state and credential material as infrastructure
  recovery data rather than Brain source files.
- Brain Scheduler owns backup-health/reporting only: latest verified backup age,
  mechanism state, coverage class, integrity result, and last restore-test
  evidence. Receipts must contain metadata only and no credential material.
- Preserve a manual, operator-approved emergency export path only for a
  migration or recovery event. It must use an explicitly secured temporary
  destination and must not become a nightly plaintext export.

## 11. n8n-backup decision card

```text
JOB: n8n-backup
Original purpose: Nightly SSH/CLI extraction of n8n workflows and credentials.
Current implementation: Local workflow + encrypted credential + decrypted
  credential JSON export from the Dokploy n8n container.
Current human category: NEEDS REVIEW
Currently runnable: NO (registry-disabled; observed bare Docker access also fails)
Secret exposure: HIGH
Recovery completeness: LOW
Existing backups: No current approved-root artifact; contents not inspected.
Current retention: Undefined; no cleanup or rotation implementation.
Offsite resilience: Not proven; catalog destination is UNKNOWN.
Restore evidence: No successful restore drill found.
STB dependency: HISTORICAL
Modern replacement: Option 5, infrastructure-owned encrypted recovery plus
  Git workflow definitions and scheduler health/reporting.
Final disposition: BLOCKED — REPLACE
```

The final disposition is exactly `BLOCKED — REPLACE`: disaster recovery is
still necessary because the live service has a persistent database/volume and
credential-bearing workflows, but the current secret-bearing local export is
not an acceptable automated mechanism and is operationally blocked against the
observed SSH user. In a future implementation goal, after this review is
accepted, the operator-facing category should move from `NEEDS REVIEW` to
`BLOCKED` until the replacement evidence gates pass. This review does not
change that category.

## 12. Live Console

The live Brain Core endpoint was queried read-only and returned a valid 17-job
manifest plus the n8n row:

- Visible in backing scheduler data: YES
- Current category: `NEEDS REVIEW`
- Runnable: NO; lifecycle/mode are `disabled`, schedule is `not scheduled`
- Reason: backup and credential behavior require explicit infrastructure
  approval
- Next human action: keep disabled and verify destination, credentials,
  retention, and rollback before any proposal

The Console source renders those fields and has no `Run`, `Backup Now`,
`Export Credentials`, or `Restore` action. It has only read-only refresh and
job-detail interaction. The local Console process was not listening on port
4881 during this review, so a fresh live visual `/scheduler` check is
`UNKNOWN`; no claim of live Console rendering is made. The live Core health was
`failed` because its runtime source and installed LaunchAgent did not match,
which is a separate scheduler deployment-identity issue and was not changed in
this n8n review.

Evidence: live `http://127.0.0.1:4877/infra/scheduler` metadata-only response;
`projects/brain-console/components/scheduler-dashboard.tsx:27-94`.

## 13. Safety

- Backup executed: **NO**
- Credential exports executed: **NO**
- Credential backup contents opened or parsed: **NO**
- Secrets displayed: **NO**
- n8n mutated: **NO**
- Restore/import performed: **NO**
- Scheduler LaunchAgent modified: **NO**
- Other NEEDS REVIEW jobs inspected: **NO**
- Cloudflare tooling or production infrastructure changed: **NO**

## 14. Git

- Review branch: `codex/n8n-backup-review-20260830`
- Review commit: `9d42be8d` introduced this report; the final metadata
  follow-up is recorded in the branch history.
- Pushed: yes, after the final metadata follow-up on the dedicated review
  branch.
- Review worktree: expected clean after commit
- Shared dirty Brain checkout: preserved and untouched

Validation performed before commit: shell syntax checks for both n8n backup
scripts, exact-source inspection, registry parsing, sanitized live metadata
probes, and metadata-only backup-root inspection. The exact-source validator
passed for 17 jobs and the scheduler runner test passed all 4 tests when run
from the clean `brain-runtime` checkout with the required Node 20.20.2
runtime. The isolated review worktree has no installed `ajv`; no dependency was
installed and no package or lockfile was changed. No backup or export command
was run.

## 15. Next operator decision

Accept or reject the `BLOCKED — REPLACE` disposition. If accepted, create a
separate implementation packet for infrastructure-owned encrypted database /
volume recovery, key recovery, retention and rotation, off-machine integrity,
restore drills, and metadata-only scheduler observability. Do not activate
`n8n-backup`, do not change the scheduler category in this report, and do not
reuse the STB dependency as a recovery gate.

n8n backup review is complete; no backup, credential export, restore, or scheduler activation was performed.
