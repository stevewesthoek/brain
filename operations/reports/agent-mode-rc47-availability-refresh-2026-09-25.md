# RC47 Account-Bound Bedrock Availability Refresh — 2026-09-25

## Result

The approved read-only Bedrock availability check passed for both production
candidate model IDs in `us-east-1`. The check used the existing
`aws-provisioner` wrapper and its `provisioner` profile. Caller identity was
verified as the friendly role name `ClaudeCodexProvisioner`; no account ID or
credential material was retained here.

The two metadata reads were performed immediately after the local clock sample
at `2026-09-25 13:02:25 UTC`:

| Model ID | Authorization | Agreement | Entitlement | Region |
|---|---|---|---|---|
| `zai.glm-5` | `AUTHORIZED` | `AVAILABLE` | `AVAILABLE` | `AVAILABLE` |
| `minimax.minimax-m2.5` | `AUTHORIZED` | `AVAILABLE` | `AVAILABLE` | `AVAILABLE` |

The command was `bedrock get-foundation-model-availability` with an explicit
`--region us-east-1`. This was an availability metadata read only: no model
inference, provider probe, identity switch, or IAM change occurred.

## Production binding and freshness boundary

The canonical install metadata and read-only service doctor identify production
as RC47:

- Version: `1.0.0-rc.47`
- Source revision: `8f4ad9683a28007888a758ea0713f8d5288f8e79`
- Package: `brain-runtime-package:sha256:0401f3ccf6f983b1b82478282c95361f918cb1234b32ebffff85dcc0cf95f2f7`
- Service doctor: **PASS, 22/22**; package/source identity, launchd ownership and
  bindings, and schema-11 StateStore integrity all passed.

This fresh account-bound availability result is not a production mutation. It
did not rewrite the RC47 Core descriptor, change its embedded access evidence,
or extend that evidence's `freshUntil`; the descriptor remains governed by its
existing freshness boundary. Production remains RC47, with the retained RC27
rollback target unchanged.

## Read-only recheck — 2026-09-25 13:14:36 UTC

The check was repeated through the same `aws-provisioner` wrapper with
`AWS_PROFILE=provisioner`. STS identity was reduced locally to the friendly
role name `ClaudeCodexProvisioner` before reporting. Both metadata responses
again returned `authorizationStatus=AUTHORIZED`, agreement and entitlement
`AVAILABLE`, and `regionAvailability=AVAILABLE` in `us-east-1`:

| Model ID | Authorization | Agreement | Entitlement | Region |
|---|---|---|---|---|
| `zai.glm-5` | `AUTHORIZED` | `AVAILABLE` | `AVAILABLE` | `AVAILABLE` |
| `minimax.minimax-m2.5` | `AUTHORIZED` | `AVAILABLE` | `AVAILABLE` | `AVAILABLE` |

No inference, identity switch, IAM change, or production mutation occurred.
