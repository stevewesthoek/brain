export type RuntimeSchedulerHandoffArtifactState = "implemented_side_effect_free" | "manual_boundary";

export interface RuntimeSchedulerHandoffArtifact {
  id: string;
  label: string;
  module_path: string;
  state: RuntimeSchedulerHandoffArtifactState;
  handoff_only: true;
  side_effects_enabled: false;
}

export interface RuntimeSchedulerHandoffArtifactsManifest {
  schema_version: "1.0";
  manifest_only: true;
  artifacts: RuntimeSchedulerHandoffArtifact[];
  primary_artifact_paths: string[];
  manual_boundaries: string[];
  safety: {
    package_json_edited_by_manifest: false;
    live_scheduler_enabled: false;
    upload_execution_enabled: false;
    network_enabled: false;
    credential_access_enabled: false;
    media_read_enabled: false;
    file_write_enabled: false;
    git_add_executed: false;
    committed_now: false;
    pushed_now: false;
  };
  validation: { complete: boolean; handoff_artifacts_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function artifact(id: string, label: string, module_path: string, state: RuntimeSchedulerHandoffArtifactState = "implemented_side_effect_free"): RuntimeSchedulerHandoffArtifact {
  return { id, label, module_path, state, handoff_only: true, side_effects_enabled: false };
}

const PRIMARY_ARTIFACT_PATHS = [
  "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-release-handoff.ts",
  "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-package-script-edit-execution-handoff.ts",
  "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-package-script-edit-terminal-handoff.ts",
] as const;

export function createRuntimeSchedulerHandoffArtifactsManifest(): RuntimeSchedulerHandoffArtifactsManifest {
  const artifacts = [
    artifact("release-handoff", "Runtime scheduler release handoff", PRIMARY_ARTIFACT_PATHS[0], "manual_boundary"),
    artifact("package-script-edit-execution-handoff", "Package script edit execution handoff", PRIMARY_ARTIFACT_PATHS[1], "manual_boundary"),
    artifact("package-script-edit-terminal-handoff", "Package script edit terminal handoff", PRIMARY_ARTIFACT_PATHS[2], "manual_boundary"),
    artifact("package-script-edit-readiness-receipt", "Package script edit readiness receipt", "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-package-script-edit-readiness-receipt.ts", "manual_boundary"),
    artifact("package-script-edit-readiness-archive", "Package script edit readiness archive", "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive.ts", "manual_boundary"),
    artifact("runtime-terminal-summary", "Runtime scheduler terminal summary", "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-terminal-summary.ts", "manual_boundary"),
    artifact("runtime-next-step-advisory", "Runtime scheduler next-step advisory", "projects/probot/src/scripts/video-orchestrator-runtime-scheduler-next-step-advisory.ts", "manual_boundary"),
  ];

  return {
    schema_version: "1.0",
    manifest_only: true,
    artifacts,
    primary_artifact_paths: [...PRIMARY_ARTIFACT_PATHS],
    manual_boundaries: [
      "Handoff artifacts are informational only and do not edit package.json.",
      "Package script edit execution remains a separately approved operator action.",
      "Live scheduler activation, uploads, network calls, credential access, media reads, persistent writes, git add, commits, and pushes remain disabled by these artifacts.",
    ],
    safety: {
      package_json_edited_by_manifest: false,
      live_scheduler_enabled: false,
      upload_execution_enabled: false,
      network_enabled: false,
      credential_access_enabled: false,
      media_read_enabled: false,
      file_write_enabled: false,
      git_add_executed: false,
      committed_now: false,
      pushed_now: false,
    },
    validation: { complete: true, handoff_artifacts_ready: true, blocking_reasons: [], warnings: ["Manifest only; no runtime, file-write, or git behavior is enabled."] },
  };
}

export function renderRuntimeSchedulerHandoffArtifactsManifest(manifest: RuntimeSchedulerHandoffArtifactsManifest): string {
  const artifacts = manifest.artifacts.map((item, index) => `${index + 1}. ${item.label} [${item.state}] -> ${item.module_path}`).join("\n");
  const boundaries = manifest.manual_boundaries.map((item) => `- ${item}`).join("\n");
  return [
    "Video Orchestrator runtime scheduler handoff artifacts manifest",
    artifacts,
    "Primary artifacts:",
    ...manifest.primary_artifact_paths.map((item) => `- ${item}`),
    "Manual boundaries:",
    boundaries,
    `package.json edited by manifest: ${manifest.safety.package_json_edited_by_manifest}`,
    `Live scheduler enabled: ${manifest.safety.live_scheduler_enabled}`,
    `Committed now: ${manifest.safety.committed_now}`,
    `Pushed now: ${manifest.safety.pushed_now}`,
  ].join("\n");
}
