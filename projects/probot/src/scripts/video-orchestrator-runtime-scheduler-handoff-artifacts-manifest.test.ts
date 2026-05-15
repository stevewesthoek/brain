import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerHandoffArtifactsManifest, renderRuntimeSchedulerHandoffArtifactsManifest } from "./video-orchestrator-runtime-scheduler-handoff-artifacts-manifest.js";

test("VO-7FX-RUNTIME-SCHEDULER-HANDOFF-ARTIFACTS-MANIFEST-1: lists primary handoff modules without side effects", () => {
  const manifest = createRuntimeSchedulerHandoffArtifactsManifest();

  assert.equal(manifest.schema_version, "1.0");
  assert.equal(manifest.manifest_only, true);
  assert.equal(manifest.validation.complete, true);
  assert.equal(manifest.validation.handoff_artifacts_ready, true);
  assert.equal(manifest.primary_artifact_paths.includes("projects/probot/src/scripts/video-orchestrator-runtime-scheduler-release-handoff.ts"), true);
  assert.equal(manifest.primary_artifact_paths.includes("projects/probot/src/scripts/video-orchestrator-runtime-scheduler-package-script-edit-execution-handoff.ts"), true);
  assert.equal(manifest.primary_artifact_paths.includes("projects/probot/src/scripts/video-orchestrator-runtime-scheduler-package-script-edit-terminal-handoff.ts"), true);
  assert.equal(manifest.artifacts.some((artifact) => artifact.id === "release-handoff"), true);
  assert.equal(manifest.artifacts.some((artifact) => artifact.id === "package-script-edit-execution-handoff"), true);
  assert.equal(manifest.artifacts.some((artifact) => artifact.id === "package-script-edit-terminal-handoff"), true);
  assert.equal(manifest.artifacts.every((artifact) => artifact.handoff_only === true), true);
  assert.equal(manifest.artifacts.every((artifact) => artifact.side_effects_enabled === false), true);
});

test("VO-7FX-RUNTIME-SCHEDULER-HANDOFF-ARTIFACTS-MANIFEST-2: keeps runtime and git behavior disabled", () => {
  const manifest = createRuntimeSchedulerHandoffArtifactsManifest();

  assert.equal(manifest.safety.package_json_edited_by_manifest, false);
  assert.equal(manifest.safety.live_scheduler_enabled, false);
  assert.equal(manifest.safety.upload_execution_enabled, false);
  assert.equal(manifest.safety.network_enabled, false);
  assert.equal(manifest.safety.credential_access_enabled, false);
  assert.equal(manifest.safety.media_read_enabled, false);
  assert.equal(manifest.safety.file_write_enabled, false);
  assert.equal(manifest.safety.git_add_executed, false);
  assert.equal(manifest.safety.committed_now, false);
  assert.equal(manifest.safety.pushed_now, false);
  assert.equal(manifest.manual_boundaries.some((item) => item.includes("separately approved operator action")), true);
});

test("VO-7FY-RUNTIME-SCHEDULER-HANDOFF-ARTIFACTS-MANIFEST-REVIEW-1: renderer is safe and explicit", () => {
  const rendered = renderRuntimeSchedulerHandoffArtifactsManifest(createRuntimeSchedulerHandoffArtifactsManifest());

  assert.equal(rendered.includes("runtime scheduler handoff artifacts manifest"), true);
  assert.equal(rendered.includes("video-orchestrator-runtime-scheduler-release-handoff.ts"), true);
  assert.equal(rendered.includes("video-orchestrator-runtime-scheduler-package-script-edit-execution-handoff.ts"), true);
  assert.equal(rendered.includes("video-orchestrator-runtime-scheduler-package-script-edit-terminal-handoff.ts"), true);
  assert.equal(rendered.includes("package.json edited by manifest: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
});
