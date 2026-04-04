---
name: aws
description: "Use when the user asks to work with AWS via the CLI — especially to inspect or provision EC2 or Lightsail servers, compare machine options, or build AWS-backed infrastructure pipelines. This skill requires qualification first: it must ask workload, purpose, and surface questions before creating any server."
---

# AWS CLI

## What this skill is for
Help Claude and Codex use AWS CLI safely and consistently for AWS infrastructure work, especially:
- sizing and provisioning new EC2 or Lightsail servers
- comparing Lightsail vs EC2 for a workload
- inspecting existing AWS resources
- preparing machine-readable AWS steps for larger automation pipelines

This skill is not allowed to "just spin up a machine." It must qualify the workload first and recommend the right machine.

## Use this skill when
- The user wants a new VPS or server on AWS
- The user wants to use Lightsail from the CLI
- The user wants to use EC2 from the CLI
- The user wants AWS to become part of a larger deployment or provisioning pipeline
- The user wants help selecting instance size, memory, storage, or bandwidth
- The user wants to inspect existing AWS servers before planning changes

## Do not use this skill for
- Console-only AWS guidance when no CLI work is needed
- Making production mutations before qualification and confirmation
- Guessing instance size from vague requirements
- Installing CloudPanel immediately without first locking the server shape

## Safety rules
1. **Qualify before provisioning.** Never create an instance until the workload questionnaire is complete and summarized back to the user.
2. **Read-only discovery first.** Start with identity, region, and catalog commands before any mutation.
3. **Confirm the exact target.** Before any create, modify, attach, or delete action, state the service (`lightsail` or `ec2`), region, machine shape, storage, and public exposure plan.
4. **Do not expose account details or secrets.** Avoid printing account IDs, access keys, session tokens, or secret values unless the user explicitly needs them.
5. **Prefer machine-readable output.** Use `--output json` and `--query` in pipeline-oriented workflows.
6. **Treat public-IP decisions as high impact.** Public internet exposure, open ports, and static IP attachment require explicit confirmation.
7. **Provisioner is the default persona.** Discovery, sizing, create, update, start, stop, and bootstrap should run through `aws-provisioner`.
8. **Destroyer is opt-in only.** Deletion and teardown require both explicit user intent and the `aws-destroyer` wrapper.

## Stable local entrypoints

Use these command paths for both Claude and Codex:

```bash
~/.local/bin/aws-cli
~/.local/bin/aws-provisioner
~/.local/bin/aws-destroyer
```

Repo-managed wrapper source:

```bash
operations/system-configs/bin/aws-cli
operations/system-configs/bin/aws-provisioner
operations/system-configs/bin/aws-destroyer
```

Role-backed wrapper contract:
- `~/.local/bin/aws-provisioner` uses AWS profile `provisioner`
- `~/.local/bin/aws-destroyer` uses AWS profile `destroyer`
- `~/.local/bin/aws-cli` remains the generic base wrapper

Default operating rule:
- Use `~/.local/bin/aws-provisioner` for all read, sizing, planning, and provisioning work
- Use `~/.local/bin/aws-destroyer` only for explicit teardown, destructive cleanup, or deletion workflows
- Do not use the destroyer profile unless the user has clearly asked for destructive work

## Mandatory qualification workflow

Before recommending or creating a server, ask these questions in order.

### 1. Machine type
- Do you want **Lightsail** or **EC2**, or should I choose?
- Is this meant to be a simple VPS, or part of a larger programmable infra stack?
- Do you need custom networking, load balancers, Auto Scaling, or fine-grained disk tuning?

### 2. Purpose
- What is this server for: CloudPanel host, WordPress hosting, app hosting, worker node, database node, staging, preview, backup, or something else?
- Is this a production server, staging server, or disposable environment?
- What operating system do you want?

### 3. Surface
- What network surface will it expose: public websites, admin panel, API only, SSH only, internal-only, or mixed?
- Which ports must be public?
- Do you need a static public IP?
- Will DNS be pointed here immediately or later?

### 4. Capacity and load
- How many websites or apps will this host run?
- How many WordPress sites?
- How many domains?
- Are any of them WooCommerce, membership, LMS, or other heavy dynamic workloads?
- What is the expected traffic profile:
  - low: brochure / internal / low-concurrency
  - medium: normal business traffic
  - high: heavy concurrency, campaigns, ecommerce, spikes
- Do you expect bursty traffic or steady traffic?
- What storage profile do you need: mostly code, media-heavy, backups, or database-heavy?

### 5. Constraints
- Preferred AWS region?
- Monthly budget target?
- Need backups or snapshots from day one?
- Need room to grow without migration soon?
- Is this single-server acceptable, or do you need a path to separate DB / app / cache later?

If the purpose includes **CloudPanel** or multi-site hosting, do not proceed until the hosting-density questions are answered.

## Decision rules

Read [provider-selection.md](references/provider-selection.md) when choosing between Lightsail and EC2.

Read [sizing.md](references/sizing.md) when mapping answers to a starting machine shape.

Default posture:
- Prefer **Lightsail** for simple, low-ops, fixed-bundle VPS use cases with predictable traffic.
- Prefer **EC2** for CloudPanel, multi-site hosting, growth headroom, custom networking, EBS tuning, and pipeline-heavy automation.
- If the user asks for "the right machine" and requirements are non-trivial, bias toward **EC2** unless the user explicitly prefers Lightsail simplicity.

## Required summary before any create command

Before provisioning, summarize:
- service: `lightsail` or `ec2`
- environment: prod / staging / disposable
- region
- operating system image
- instance type or Lightsail bundle
- root disk size and type
- public exposure plan
- expected workload
- growth expectation
- whether this is intended for future CloudPanel installation

Only after the user confirms that summary may the skill create anything.

## Read-only discovery commands

```bash
~/.local/bin/aws-provisioner --version
~/.local/bin/aws-provisioner sts get-caller-identity
~/.local/bin/aws-provisioner configure list

~/.local/bin/aws-provisioner ec2 describe-regions --output json
~/.local/bin/aws-provisioner ec2 describe-instance-types --instance-types t3.small t3.medium t3.large --output json

~/.local/bin/aws-provisioner lightsail get-regions --output json
~/.local/bin/aws-provisioner lightsail get-bundles --include-inactive --output json
~/.local/bin/aws-provisioner lightsail get-blueprints --output json
~/.local/bin/aws-provisioner lightsail get-instances --output json
```

## Provisioning command families

### Lightsail
```bash
~/.local/bin/aws-provisioner lightsail create-instances ...
~/.local/bin/aws-provisioner lightsail allocate-static-ip ...
~/.local/bin/aws-provisioner lightsail attach-static-ip ...
```

### EC2
```bash
~/.local/bin/aws-provisioner ec2 run-instances ...
~/.local/bin/aws-provisioner ec2 create-tags ...
~/.local/bin/aws-provisioner ec2 allocate-address ...
~/.local/bin/aws-provisioner ec2 associate-address ...
```

## Destructive command family

Use only after explicit user confirmation:

```bash
~/.local/bin/aws-destroyer ec2 terminate-instances ...
~/.local/bin/aws-destroyer ec2 delete-volume ...
~/.local/bin/aws-destroyer ec2 release-address ...
~/.local/bin/aws-destroyer lightsail delete-instance ...
~/.local/bin/aws-destroyer lightsail release-static-ip ...
```

## Pipeline guidance

For larger automation pipelines:
- use `--output json`
- prefer `--query` to extract IDs cleanly
- persist instance metadata, region, IP, and tags as structured outputs
- separate **discovery**, **qualification**, **plan**, and **mutation** steps
- keep provisioning logic separate from post-provision app setup such as CloudPanel installation

## Notes
- Verified on 2026-04-03 that AWS CLI is installed locally and reachable through `/usr/local/bin/aws`
- Stable local entrypoint: `~/.local/bin/aws-cli`
- Role-backed default wrapper: `~/.local/bin/aws-provisioner`
- Role-backed destructive wrapper: `~/.local/bin/aws-destroyer`
- Verified on 2026-04-03 that `aws sts get-caller-identity` succeeds on this machine
- Verified on 2026-04-03 that the local `provisioner` and `destroyer` AWS profiles can assume `ClaudeCodexProvisioner` and `ClaudeCodexDestroyer`
- Do not print the account ID in normal chat responses unless it is necessary for the task
- Official docs:
  - Install/update AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  - AWS CLI getting started: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html
  - EC2 `run-instances`: https://docs.aws.amazon.com/cli/latest/reference/ec2/run-instances.html
  - Lightsail CLI reference: https://docs.aws.amazon.com/cli/latest/reference/lightsail/
