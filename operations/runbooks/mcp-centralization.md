# MCP Centralization Runbook

Brain-owned process for admitting and configuring any MCP provider.

## Scope
Use this runbook whenever adding or updating MCP servers (Codex, Antigravity, etc.).

## Standard workflow
1. Apply `ai/policy/capability-discovery.md`; reuse an existing provider/capability when possible.
2. Read the official MCP and provider documentation; identify transport, authentication, audience, tool/resource scope, side effects, and revocation.
3. Review `operations/system-configs/mcp/MCP-PROVIDER-ADMISSION-STANDARD.md`.
4. Create/update `operations/system-configs/mcp/<server>/`:
   - `README.md`
   - `codex-config.template.toml`
   - client templates as needed
5. Register the provider in `operations/specs/mcp-provider-admissions.json` with exact artifact hashes, project/global scope, tool/suboperation allowlists, credential reference, limits, verification, and revocation.
6. Validate registry and installation artifacts. Any issue fails closed.
7. Generate a project-scoped client registration. Global registration requires a separately justified admission.
8. Keep secrets out of templates and committed files; use owner-only ignored storage.
9. Verify initialization, exact exposed scope, authentication rejection/acceptance, and a read-only real call before any mutation gate.
10. Record capability state separately from repository configuration, deployment, observation, and verification.

## Command templates

### Validate and generate a project-scoped Codex registration
```bash
node tools/validate-mcp-provider-admissions.mjs \
  --provider-root <provider-id>=/absolute/provider/root

node tools/generate-mcp-project-registration.mjs \
  --admission <admission-id> \
  --provider-root /absolute/provider/root \
  --credential-file /absolute/owner-only/credential-file \
  --node /absolute/node \
  --output /absolute/consumer/.codex/config.toml
```

The consumer `.codex/config.toml` is generated and ignored. The admission JSON
is canonical. Do not treat a locally edited TOML block as authority.

### Create MCP docs/template folder
```bash
mkdir -p operations/system-configs/mcp/<server-name>
```

Required files:
- `README.md`
- `codex-config.template.toml`
- optional client templates (for example `mcp-http-config.template.json`)

### Centralize Antigravity MCP runtime file
```bash
mkdir -p "operations/system-configs/antigravity/User"
mkdir -p "$HOME/Library/Application Support/Antigravity/User"
ln -sfn \
  "/path/to/brain/operations/system-configs/antigravity/User/mcp.json" \
  "$HOME/Library/Application Support/Antigravity/User/mcp.json"
```

Template (safe, tracked):
`operations/system-configs/antigravity/mcp.template.json`

Runtime file (ignored, token-bearing):
`operations/system-configs/antigravity/User/mcp.json`

## Security rules
- Never commit API keys, bearer tokens, cookies, or auth sessions.
- Do not accept localhost, Origin, or caller-supplied identity headers as authentication.
- For stdio, use fixed shell-free entrypoints and environment credential references.
- For remote HTTP, use OAuth protected-resource discovery and audience-bound resource indicators; never pass through client tokens.
- Tool and nested-operation scopes must be enforced by the provider, not merely hidden by the client.
- Reject the whole grant/admission set if any entry is malformed or duplicated.
- Do not retry mutation-capable calls after ambiguous transport; require durable reconciliation.
- If temporary tokens are required (for example direct HTTP mode), store only in ignored runtime files.

## Current canonical files
- Codex config: `operations/system-configs/codex/config.toml`
- MCP docs/templates: `operations/system-configs/mcp/`
- Provider admission registry: `operations/specs/mcp-provider-admissions.json`
- Admission validator: `tools/validate-mcp-provider-admissions.mjs`
- Project registration generator: `tools/generate-mcp-project-registration.mjs`
- Antigravity runtime MCP config:
  `operations/system-configs/antigravity/User/mcp.json` (ignored)
- Antigravity tracked template:
  `operations/system-configs/antigravity/mcp.template.json`

## Validation checklist
- `codex mcp list` shows server enabled.
- Admission validator passes against the exact provider root.
- Generated project registration passes `--check`.
- Listed tools and nested suboperations equal the admitted scope.
- Server has docs + templates under `operations/system-configs/mcp/<server>/`.
- Any runtime secret file is ignored by git (`git check-ignore -v <path>`).
- Client can load MCP config from symlinked path.
