# B1.0a Guarded Live Completion — 2026-07-22

**Task:** `B1.0a — Deploy and verify Save-to-Mind target paths`  
**Verdict:** complete for the approved MRP-6 guarded deployment/readback scope  
**Workflow:** `FwP5INe9qoo1OwGC`

## Runtime and admission

- authenticated Workbench status: pass;
- admitted and live Workbench revision: `be780050a68d4ec95a7f07a1a180881582c57fc0`;
- admitted MCP tools: `getWorkbenchStatus`, `readWorkbenchContext`, and `runWorkbenchCommand`;
- admitted mutation command: `n8n_workflow_migration` only;
- provider admission: `mcp-provider-admissions-valid admissions=1 providers_verified=1`;
- Infinite Brain conformance: `conformance=pass`, with only the pre-existing `MS0.9` status-drift warning.

## Repairs required to complete the operation

The MRP-6 runtime was repaired without broadening its admitted command scope:

1. The controlled-migration capability now distinguishes a dispatch that was
   consumed from one that remained reserved, so an executor rejection cannot
   create a false dispatch-outcome conflict or strand the operation.
2. The command adapter removes the host-only `consumeMutationDispatch`
   callback before strict executor invocation. The callback remains installed
   on the executor host and is no longer rejected as an invocation field.
3. `tools/n8n-api.sh` continues to validate the complete approved workflow
   artifact, including workflow identity and credential-reference safety, but
   transmits only the public update fields: `name`, `nodes`, `connections`,
   `settings`, and `staticData`.
4. Runtime Authorization headers are accepted only when their value is a
   bounded n8n expression referencing an uppercase `$env` variable with the
   approved `Bearer` or `token` scheme. Literal authorization material remains
   rejected before transmission.

The wrapper hash admitted by the owner-local grant is:

```text
b52a69d1101e495d95731df16847335a634987fa5d4b300f72f23bd4ff089527
```

## Final guarded operation

Exactly one fresh final operation was prepared and executed:

```text
operationId=cap-op-6820cf388c5d7d6206f764fee94c5573
mode=apply
status=completed
reasonCode=READBACK_CANDIDATE_CONFIRMED
mutationResult=succeeded
candidateUpdate=1
rollbackUpdate=0
readback=2
protectedDomains=unchanged
```

Approved artifacts:

```text
candidateSha256=194ff9b6799709e3c7f649e9fcf875dcb067229973b42560fd1ad3a3060f82e1
rollbackSha256=703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd
manifestSha256=2b85c397a8130a86b5c65c28369d717a458cd3fe54a5f42097e2edf930c39bc4
expectedLiveCanonical=6223cd6e7ff2454e1b82d9b3413015834759af0c3b0d854d92f5e315c89d7dac
candidateCanonical=8f4f53ce729596b3a6aa66228db0b9c865d58bcfb9ec79348f456f4a7b86a346
observedCanonical=8f4f53ce729596b3a6aa66228db0b9c865d58bcfb9ec79348f456f4a7b86a346
```

The precondition read matched the approved rollback baseline. The candidate
update was sent once. The post-update readback matched the approved candidate
canonical hash exactly. No rollback update was needed.

## Route and consumer evidence

Repository route validation passed after the live readback:

```text
inbox/new=4
inbox/failed=4
capture/inbox=0
capture/failed=0
result=pass
```

The Mind Steward typecheck/build and 62 tests passed. The focused Save-to-Mind
and sync suite passed 53 tests, including controlled topology, route proof,
rollback safety, downstream `inbox/new` / `inbox/failed` consumers, and the
fixture-adapter contract. The wrapper request-normalization test also passed
without network access.

The accepted MRP-6 completion evidence is the exact canonical live readback of
the approved candidate plus deterministic route/consumer proofs. No webhook
fixture was invoked and no fixture file was written to Mind. This report does
not claim an end-to-end capture invocation, schedule change, activation change,
or environment-variable value inspection.

## Safety and repository state

- confirmation material was not recorded;
- no historical operation or confirmation was reused;
- no retry was issued for the successful final mutation;
- no direct n8n, legacy MCP, shell mutation, or HTTP fallback was used;
- Mind was not edited;
- no file was staged, committed, or pushed;
- unrelated dirty and untracked paths were preserved.
