# Save-to-Mind Bedrock Haiku Transport v2 Audit — 2026-08-29

## Result

The Save-to-Mind workflow was migrated once through the first-party n8n
Amazon Bedrock Chat Model path and validated successfully with execution
1032. The workflow remains active, the webhook identity is unchanged, and
the protected post-classification topology has zero drift.

## Capability discovery

Live runtime evidence:

- n8n version: 2.4.7
- image: n8nio/n8n:2.4.7
- first-party package: @n8n/n8n-nodes-langchain@2.4.6
- AWS SDK package: @aws-sdk/client-bedrock-runtime
- LangChain AWS package: @langchain/aws@1.0.3

| Option | Supported | Existing AWS IAM credential | Claude Haiku 4.5 | Suitable |
| --- | --- | --- | --- | --- |
| Native AWS Bedrock Chat Model | yes | yes, credential type aws | yes, inference profile | yes |
| HTTP Request + AWS IAM SigV4 | no for the tested Bedrock Runtime URL path | yes | request body only | no |
| First-party LangChain chain plus native Bedrock model | yes | yes | yes | yes; chosen |

The native node type is
@n8n/n8n-nodes-langchain.lmChatAwsBedrock, paired with
@n8n/n8n-nodes-langchain.chainLlm. The implementation constructs an AWS
BedrockRuntimeClient and ChatBedrockConverse, taking region and temporary
session-token fields from the existing aws credential. The model is
us.anthropic.claude-haiku-4-5-20251001-v1:0, selected as an inference
profile, using region us-east-1 through the credential-backed native client.
The credential display name is AWS Bedrock - Brain; no credential values are
stored here.

The generic HTTP Request AWS credential implementation derives the SigV4
service from the URL when a URL is supplied. That produced bedrock-runtime
for execution 1030, while Bedrock Runtime requires signing name bedrock.
The attempted Code Node repair for execution 1031 used
helpers.httpRequestWithAuthentication, which n8n 2.4.7 rejected as
unsupported. No Code Node authentication workaround remains in the v2
candidate.

## Candidate

Candidate:

    operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-transport-v2-2026-08-29.json

SHA-256:
880c11ca854069320a22d71ba91464f430a03c371bfef134c804db47f6d13061

The candidate preserves the workflow identity, active-state intent, webhook
path, response behavior, settings, GitHub repository/path logic, create/update
branch, inbox/new, inbox/failed, and all unrelated nodes. It adds only the
native model sub-node and replaces the failed classifier transport with the
native chain boundary. The parser accepts the native chain's text envelope and
continues to fail closed on malformed classification output.

## Fresh rollback export

Fresh export before migration:

    operations/reports/artifacts/save-to-mind-live-pre-transport-v2-2026-08-29.json

SHA-256:
526a63910c1f2e57717c20f711f17fe6fb3cabe39dbe568c2b6adbc7dc3e8b9c

Readback:

- workflow ID: FwP5INe9qoo1OwGC
- active: true
- version ID: 3398e289-19ba-4684-978f-fd2bd3cb4474
- node count: 10
- webhook node ID: webhook-trigger
- webhook path: mind-inbox
- comparison with the restored rollback: only expected version/timestamp metadata differed

## Validation

Passed:

    node --test tools/n8n-save-to-mind-bedrock-candidate.test.mjs tools/n8n-save-to-mind-route-proof.test.mjs tools/n8n-save-to-mind-bedrock-transport-v2.test.mjs
    node tools/validate-save-to-mind-bedrock-transport-v2.mjs
    PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s ai/skills/vendors/taoufik123-collab/claude-watch/scripts/tests -p 'test_*.py' -v
    JSON.parse validation for all 7 migration/workflow/rollback artifacts
    Python AST validation for the custom watch-video script and 9 vendored scripts
    git diff --check

Result: 20/20 Save-to-Mind tests passed, 7/7 vendored claude-watch tests passed,
all 7 JSON artifacts parsed successfully, all 10 changed Python scripts passed
AST validation, candidate validation passed, route proof passed, and
protectedTopologyPreserved=true.

The wrapper initially rejected an incomplete update payload before transmission
with PAYLOAD_WORKFLOW_ID_MISMATCH. The one bounded local payload repair added
the required identity/activation fields; the retry returned HTTP 200 with
classification=succeeded. No failed live update was left applied.

## Live deployment and test

Deployment:

- attempted: yes, once after fresh rollback export
- mechanism: documented ~/.local/bin/n8n-api update-workflow
- readback version: 52568ad1-7f14-472e-bab3-0d9de609e279
- active: true
- native Bedrock node present: yes
- Gemini endpoint/key/helper present: no
- post-deploy protected drift: none

Harmless smoke test:

- execution ID: 1032
- execution status: success
- node statuses: Webhook, Build Classification Prompt, AWS Bedrock Chat Model,
  Bedrock Classify, Build Processed Note, GitHub existence check, file routing,
  GitHub create, and Respond all succeeded
- parsed classification: para_type=project, confidence=0.75,
  signal_quality=0.6
- resulting path: inbox/new/2026-08-29-save-to-mind-bedrock-transport-v2-verification-save-to-mind-bedrock-transport-v2.md
- GitHub commit: 28fc95b375ec8dbf551c69b8803af31259678326
- webhook response: {"status":"saved","result":"file_committed","queued_for_classification":true,"classifier":"Mind Steward"}

Bedrock classification succeeded: yes. inbox/new succeeded: yes. A single
clearly marked verification capture was created in Mind as the authorized live
test artifact.

## Rollback

Rollback needed: no. The fresh rollback artifact remains available at
operations/reports/artifacts/save-to-mind-live-pre-transport-v2-2026-08-29.json.
The post-deploy protected comparison reports zero drift. The earlier failed
Bedrock attempt remains historical evidence in the prior audit and was not
overwritten.
