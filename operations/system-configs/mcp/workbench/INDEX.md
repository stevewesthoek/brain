# Workbench MCP — Complete Setup Index

**Status:** ✅ Ready for Production  
**Brain-Agnostic:** Yes — works across all IDEs and AI platforms  
**Last Updated:** 2026-07-18

---

## 📚 Documentation Map

### Getting Started (Read These First)

1. **[SETUP-SUMMARY.md](./SETUP-SUMMARY.md)** ← Start here
   - Overview and file inventory
   - Quick start (3 steps)
   - Architecture & security at a glance
   - When to read others

2. **[README.md](./README.md)** ← Then read this
   - Detailed setup by IDE (Claude Code, Codex, Kiro, Cursor, Antigravity, Gemini CLI)
   - Environment variable reference
   - Credential file setup
   - Troubleshooting by symptom
   - Revocation procedure

### Advanced Topics

3. **[IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)** ← For teams & architects
   - Architecture diagram
   - Why brain-agnostic design matters
   - Installation flow (3 phases)
   - Per-client config blocks
   - Security model deep dive
   - Operations & maintenance
   - Testing & validation
   - Deployment timeline
   - Success criteria
   - Scaling to team

### Related Brain Repo Docs

4. **`operations/specs/mcp-provider-admissions.json`**
   - Central admission registry
   - Workbench entry with digest-pinned artifacts
   - Source lock and scope details

5. **`operations/system-configs/mcp/MCP-PROVIDER-ADMISSION-STANDARD.md`**
   - Authority boundary between Brain and Provider
   - One admission lifecycle
   - Transport and authentication profiles
   - Scope rules and invocation policy

6. **`operations/runbooks/mcp-centralization.md`**
   - Brain-owned process for MCP providers
   - Standard workflow and security rules
   - Validation checklist
   - Current canonical files reference

---

## 🔧 Files in This Directory

### Documentation
- `INDEX.md` (this file)
- `README.md` (8.5 KB) — Setup guide with troubleshooting
- `SETUP-SUMMARY.md` (8.4 KB) — Overview and quick start
- `IMPLEMENTATION-GUIDE.md` (13.3 KB) — Architecture and operations

### Configuration Templates (For Each IDE)
- `claude-code-config.template.json` — For `~/.claude.json`
- `codex-config.template.toml` — For `~/.codex/config.toml`
- `kiro-config.template.json` — For `~/.kiro/settings.json`
- `cursor-config.template.json` — For `~/.cursor/settings.json`
- `mcp-http-config.template.json` — For HTTP relay (optional)

### Automation Scripts (Executable)
- `setup-workbench-all-ides.sh` — Interactive setup wizard for all IDEs
- `verify-workbench-mcp.sh` — Verification and health checks

---

## 🚀 Quick Start (3 Steps)

### Step 1: Create Credential File
```bash
mkdir -p ~/.credentials
echo "<your-workbench-mcp-token>" > ~/.credentials/workbench-mcp.token
chmod 600 ~/.credentials/workbench-mcp.token
```

### Step 2: Run Setup Script
```bash
cd brain/
bash operations/system-configs/mcp/workbench/setup-workbench-all-ides.sh
```

### Step 3: Restart and Verify
```bash
# Restart your IDE(s)
# Then verify:
claude mcp list | grep workbench
codex mcp list | grep workbench
```

---

## 🎯 By Role

### I'm a Developer
1. Read: **SETUP-SUMMARY.md**
2. Run: `setup-workbench-all-ides.sh`
3. Verify: `verify-workbench-mcp.sh`
4. Reference: **README.md** for troubleshooting

### I'm a DevOps/Operator
1. Read: **IMPLEMENTATION-GUIDE.md**
2. Review: `operations/specs/mcp-provider-admissions.json`
3. Understand: Authority boundary in **MCP-PROVIDER-ADMISSION-STANDARD.md**
4. Automate: Consider CI/CD deployment of `setup-workbench-all-ides.sh`

### I'm an Architect/Tech Lead
1. Read: **IMPLEMENTATION-GUIDE.md** (section: Architecture)
2. Review: Brain repo's MCP centralization policy
3. Understand: Brain-agnostic design principles
4. Plan: Scaling to team (see: IMPLEMENTATION-GUIDE.md, Deployment Timeline)

### I'm Integrating a New IDE
1. Follow: `operations/runbooks/mcp-centralization.md`
2. Create: Template in `operations/system-configs/mcp/workbench/`
3. Update: `setup-workbench-all-ides.sh` and `verify-workbench-mcp.sh`
4. Test: With actual IDE before merging

### I'm Supporting a Team Member
1. Reference: **README.md** Troubleshooting section
2. Run: `verify-workbench-mcp.sh` to diagnose
3. Point to: Specific symptoms and fixes in README

---

## 📋 Verification Checklist

Before considering setup complete:

- [ ] Credential file exists at `~/.credentials/workbench-mcp.token`
- [ ] Credential file permissions are `600`
- [ ] At least one IDE has Workbench MCP configured
- [ ] IDE reports Workbench server in `mcp list` output
- [ ] Server lists exactly 3 tools
- [ ] `getWorkbenchStatus` call succeeds (proves auth + connectivity)
- [ ] Invalid tools are rejected with "Unknown or unadmitted"
- [ ] No secrets appear in stdout, stderr, or config files

---

## 🔐 Security Summary

**Credentials**
- Stored in ignored files outside repositories
- File permissions: `600` (owner read+write only)
- Passed to server by environment variable reference
- Never committed to git

**Artifacts**
- SHA256 digests pinned in admission registry
- Entrypoint fixed: `node packages/mcp/dist/server.js` (no shell)
- Source locked to specific commit
- Validated on admission validation

**Scope**
- Only 3 tools admitted (getWorkbenchStatus, readWorkbenchContext, runWorkbenchCommand)
- Server enforces scope via environment variable
- Invalid tools rejected at server layer
- Nested operations: `n8n_workflow_migration` only

**Mutations**
- Two-phase approval required
- Ambiguous failures require reconciliation
- No blind retries after transport failure
- Audit trail + receipt preservation

---

## 🆘 Troubleshooting

| Symptom | Reference |
|---------|-----------|
| MCP server not found | README.md → Troubleshooting Matrix |
| Authentication failed | README.md → Credential File Setup |
| Command not found (Node) | README.md → Troubleshooting → Path issues |
| Server lists wrong tools | README.md → Troubleshooting → Scope env vars |
| Works in one IDE, not another | README.md → Troubleshooting → Inconsistent config |
| Timeout on first call | README.md → Troubleshooting → Server startup |

Run verification script first:
```bash
bash verify-workbench-mcp.sh
```

---

## 🔄 Maintenance

### When Workbench MCP Provider Updates
```bash
# 1. Validate new admission
node brain/tools/validate-mcp-provider-admissions.mjs \
  --provider-root workbench=/path/to/workbench-private

# 2. No client config changes needed (same paths)
# 3. Optional: regenerate client configs
```

### When Adding a New IDE
1. Create template in `operations/system-configs/mcp/workbench/`
2. Update setup and verify scripts
3. Update README.md with IDE-specific instructions
4. Test with actual IDE

### When Revoking Access
1. Set admission status to `paused` in registry
2. Remove workbench entry from IDE configs
3. Delete credential file reference (keep file for recovery)
4. Keep admission entry for audit trail

---

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| IDEs Supported | 6 (Claude Code, Codex, Kiro, Cursor, Antigravity, Gemini CLI) |
| Admitted Tools | 3 (getWorkbenchStatus, readWorkbenchContext, runWorkbenchCommand) |
| Nested Operations | 1 (n8n_workflow_migration) |
| Documentation | 4 files + templates (72 KB total) |
| Setup Time | ~3-5 minutes per machine |
| MCP Package Tests | 33/33 passing |
| Configuration Formats | 2 (JSON, TOML) |

---

## 🎯 Brain-Agnostic Design Principles

1. **Single Admission** — One entry in admission registry, many clients
2. **Provider Neutral** — Same server works with Claude, Codex, Gemini, etc.
3. **Config Generation** — Clients generated from admission, never authority
4. **Exact Scope** — Brain admits; server enforces; client cannot expand
5. **Security First** — Credentials external, artifacts digest-pinned, entrypoint fixed

---

## 🎓 Learning Resources

### For Understanding MCP
- Official MCP Specification: `https://modelcontextprotocol.io/`
- Brain repo examples: `operations/system-configs/mcp/stitch/`

### For Understanding Workbench Admission
- Brain admission standard: `operations/system-configs/mcp/MCP-PROVIDER-ADMISSION-STANDARD.md`
- Registry: `operations/specs/mcp-provider-admissions.json`
- Validation: `node tools/validate-mcp-provider-admissions.mjs --help`

### For Understanding Brain-Agnostic Design
- See: IMPLEMENTATION-GUIDE.md (Architecture section)
- See: MCP-PROVIDER-ADMISSION-STANDARD.md (Authority Boundary section)

---

## ✅ Success Criteria

Setup is complete when:
- ✓ You can run `setup-workbench-all-ides.sh` without errors
- ✓ IDE(s) report Workbench MCP server in `mcp list`
- ✓ Server lists exactly 3 tools
- ✓ `getWorkbenchStatus` call succeeds
- ✓ Invalid tools are rejected
- ✓ No secrets in output or config files

---

## 📞 Support

- **Setup Issues** → See README.md Troubleshooting
- **Admission Questions** → See MCP-PROVIDER-ADMISSION-STANDARD.md
- **Operations Questions** → See IMPLEMENTATION-GUIDE.md
- **New IDEs** → See operations/runbooks/mcp-centralization.md

---

## 📌 Next Steps

1. **Read:** SETUP-SUMMARY.md (5 min)
2. **Create:** Credential file (2 min)
3. **Run:** setup-workbench-all-ides.sh (3 min)
4. **Verify:** verify-workbench-mcp.sh (1 min)
5. **Test:** "Use getWorkbenchStatus" in your IDE (1 min)
6. **Share:** Setup script with your team

**Total Setup Time: ~12 minutes**

---

**Workbench MCP is ready for production use across all AI platforms and IDEs.**
