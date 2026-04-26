import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const TOTAL_TIMEOUT_MS = 5 * 60 * 1000;
const RESTART_TOTAL_TIMEOUT_MS = 8 * 60 * 1000;
const STEP_TIMEOUT_MS = 2 * 60 * 1000;

export type BuildflowVerifyStepResult = {
  name: string;
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type BuildflowVerifyResult = {
  mode: "verify" | "restart-and-verify";
  ok: boolean;
  status: "passed" | "failed" | "running";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: BuildflowVerifyStepResult[];
  failedStep?: string;
  error?: string;
};

type StepSpec = {
  name: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
};

function redact(value: string, token: string): string {
  if (!token) return value;
  return value.replaceAll(token, "[REDACTED]");
}

function ensurePathExists(dirPath: string, label: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${label} not found: ${dirPath}`);
  }
}

function readBuildflowToken(buildflowRoot: string): string {
  const envPath = path.join(buildflowRoot, "apps", "web", ".env.local");
  ensurePathExists(envPath, "BuildFlow env file");
  const raw = fs.readFileSync(envPath, "utf-8");
  const match = raw.match(/^BUILDFLOW_ACTION_TOKEN="([^"]*)"$/m);
  const token = match?.[1]?.trim() ?? "";
  if (!token) {
    throw new Error("BUILDFLOW_ACTION_TOKEN is missing or empty in apps/web/.env.local");
  }
  return token;
}

async function runStep(buildflowRoot: string, step: StepSpec, token: string, deadlineAt: number): Promise<BuildflowVerifyStepResult> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const combinedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...(step.env ?? {}),
    BUILDFLOW_ACTION_TOKEN: token,
  };

  const timeoutMs = Math.max(1, Math.min(STEP_TIMEOUT_MS, deadlineAt - Date.now()));

  return await new Promise<BuildflowVerifyStepResult>((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: buildflowRoot,
      env: combinedEnv,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000);
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => stdoutChunks.push(String(chunk)));
    child.stderr?.on("data", (chunk) => stderrChunks.push(String(chunk)));

    child.on("error", (err) => {
      clearTimeout(timeout);
      stderrChunks.push(String(err));
      resolve({
        name: step.name,
        ok: false,
        exitCode: null,
        stdout: redact(stdoutChunks.join(""), token),
        stderr: redact(stderrChunks.join(""), token),
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      const stdout = redact(stdoutChunks.join(""), token);
      const stderrBase = stderrChunks.join("");
      const stderr = redact(
        timedOut ? `${stderrBase}${stderrBase ? "\n" : ""}Step timed out after ${timeoutMs}ms` : stderrBase,
        token,
      );
      resolve({
        name: step.name,
        ok: exitCode === 0 && !timedOut,
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}

function createFailedResult(mode: BuildflowVerifyResult["mode"], startedAt: Date, error: string, steps: BuildflowVerifyStepResult[] = [], failedStep?: string): BuildflowVerifyResult {
  const result: BuildflowVerifyResult = {
    mode,
    ok: false,
    status: "failed",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    error,
    steps,
  };
  if (failedStep) result.failedStep = failedStep;
  return result;
}

async function runSteps(mode: BuildflowVerifyResult["mode"], buildflowRoot: string, token: string, steps: StepSpec[], totalTimeoutMs = TOTAL_TIMEOUT_MS): Promise<BuildflowVerifyResult> {
  const startedAt = new Date();
  const deadlineAt = Date.now() + totalTimeoutMs;

  try {
    const results: BuildflowVerifyStepResult[] = [];
    for (const step of steps) {
      if (Date.now() >= deadlineAt) {
        throw new Error("BuildFlow verification timed out before completing all steps");
      }
      const result = await runStep(buildflowRoot, step, token, deadlineAt);
      results.push(result);
      if (!result.ok) {
        return {
          mode,
          ok: false,
          status: "failed",
          failedStep: result.name,
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          error: `BuildFlow verification failed at ${result.name} (exitCode=${result.exitCode ?? "null"})`,
          steps: results,
        };
      }
    }

    return {
      mode,
      ok: true,
      status: "passed",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      steps: results,
    };
  } catch (err) {
    return createFailedResult(mode, startedAt, String(err));
  }
}

function getBuildflowVerificationSteps(localOnly: boolean = false): StepSpec[] {
  const steps: StepSpec[] = [
    { name: "verify:dashboard", command: "pnpm", args: ["verify:dashboard"] },
    { name: "verify-write-contracts", command: "node", args: ["scripts/verify-write-contracts.mjs"] },
    {
      name: "verify:gpt-actions local",
      command: "pnpm",
      args: ["verify:gpt-actions"],
      env: { PUBLIC_BASE_URL: "http://127.0.0.1:3054" },
    },
  ];

  if (!localOnly) {
    steps.push({
      name: "verify:gpt-actions public",
      command: "pnpm",
      args: ["verify:gpt-actions"],
      env: { PUBLIC_BASE_URL: "https://buildflow.prochat.tools" },
    });
  }

  return steps;
}

async function ensureHealthy(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return true;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function killPorts(ports: number[]): Promise<BuildflowVerifyStepResult[]> {
  const results: BuildflowVerifyStepResult[] = [];
  for (const port of ports) {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const pids = await new Promise<string>((resolve, reject) => {
      const child = spawn("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk) => stdoutChunks.push(String(chunk)));
      child.stderr.on("data", (chunk) => stderrChunks.push(String(chunk)));
      child.on("error", reject);
      child.on("close", () => resolve(stdoutChunks.join("").trim()));
    });
    if (!pids) {
      results.push({ name: `stop:${port}`, ok: true, exitCode: 0, stdout: "", stderr: "" });
      continue;
    }
    const pidList = pids.split(/\s+/).filter(Boolean);
    for (const pid of pidList) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const remaining = await new Promise<string>((resolve) => {
      const child = spawn("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
      const remainingChunks: string[] = [];
      child.stdout.on("data", (chunk) => remainingChunks.push(String(chunk)));
      child.on("close", () => resolve(remainingChunks.join("").trim()));
    });
    if (remaining) {
      for (const pid of remaining.split(/\s+/).filter(Boolean)) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {}
      }
    }
    results.push({
      name: `stop:${port}`,
      ok: true,
      exitCode: 0,
      stdout: redact(stdoutChunks.join(""), ""),
      stderr: redact(stderrChunks.join(""), ""),
    });
  }
  return results;
}

function launchPersistentProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, logPath: string) {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const quotedCommand = [command, ...args].map((part) => `'${part.replaceAll("'", "'\"'\"'")}'`).join(" ");
  const script = `cd '${cwd.replaceAll("'", "'\"'\"'")}' && nohup ${quotedCommand} > '${logPath.replaceAll("'", "'\"'\"'")}' 2>&1 < /dev/null &`;
  const child = spawn("/bin/bash", ["-lc", script], {
    cwd,
    env,
    shell: false,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.unref();
  child.stdout?.on("data", (chunk) => stdoutChunks.push(String(chunk)));
  child.stderr?.on("data", (chunk) => stderrChunks.push(String(chunk)));
  return {
    pid: child.pid ?? null,
    stdout: () => stdoutChunks.join(""),
    stderr: () => stderrChunks.join(""),
    kill: () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch {}
    },
  };
}

export async function runBuildflowVerification(): Promise<BuildflowVerifyResult> {
  const buildflowRoot = path.join(os.homedir(), "Repos", "stevewesthoek", "buildflow");
  ensurePathExists(buildflowRoot, "BuildFlow repo");
  ensurePathExists(path.join(buildflowRoot, "package.json"), "BuildFlow package.json");
  const token = readBuildflowToken(buildflowRoot);
  return runSteps("verify", buildflowRoot, token, getBuildflowVerificationSteps(), TOTAL_TIMEOUT_MS);
}

export async function runBuildflowRestartAndVerification(): Promise<BuildflowVerifyResult> {
  const buildflowRoot = path.join(os.homedir(), "Repos", "stevewesthoek", "buildflow");
  const startedAt = new Date();
  const deadlineAt = startedAt.getTime() + RESTART_TOTAL_TIMEOUT_MS;
  ensurePathExists(buildflowRoot, "BuildFlow repo");
  ensurePathExists(path.join(buildflowRoot, "package.json"), "BuildFlow package.json");
  const token = readBuildflowToken(buildflowRoot);

  const restartStepResults: BuildflowVerifyStepResult[] = [];
  try {
    restartStepResults.push(...await killPorts([3052, 3053, 3054]));

    const buildSteps: StepSpec[] = [
      { name: "build:packages/cli", command: "pnpm", args: ["--dir", "packages/cli", "build"] },
      { name: "build:apps/web", command: "pnpm", args: ["--dir", "apps/web", "build"] },
      { name: "build:all", command: "pnpm", args: ["-r", "build"] },
    ];
    const buildResult = await runSteps("restart-and-verify", buildflowRoot, token, buildSteps, RESTART_TOTAL_TIMEOUT_MS);
    restartStepResults.push(...buildResult.steps);
    if (!buildResult.ok) {
      return {
        ...buildResult,
        steps: restartStepResults,
      };
    }

    const startEnv = {
      ...process.env,
      BUILDFLOW_ACTION_TOKEN: token,
    };
    const cli = launchPersistentProcess("pnpm", ["--dir", "packages/cli", "dev"], buildflowRoot, startEnv, "/tmp/buildflow-cli.log");
    const web = launchPersistentProcess("pnpm", ["--dir", "apps/web", "dev"], buildflowRoot, startEnv, "/tmp/buildflow-web.log");

    const healthTimeoutMs = Math.min(60 * 1000, Math.max(1, deadlineAt - Date.now()));
    const agentHealthy = await ensureHealthy("http://127.0.0.1:3052/health", healthTimeoutMs);
    const webHealthy = await ensureHealthy("http://127.0.0.1:3054/api/openapi", healthTimeoutMs);
    restartStepResults.push({
      name: "start:packages/cli",
      ok: agentHealthy,
      exitCode: agentHealthy ? 0 : 1,
      stdout: redact(cli.stdout(), token),
      stderr: redact(cli.stderr(), token),
    });
    restartStepResults.push({
      name: "start:apps/web",
      ok: webHealthy,
      exitCode: webHealthy ? 0 : 1,
      stdout: redact(web.stdout(), token),
      stderr: redact(web.stderr(), token),
    });
    if (!agentHealthy || !webHealthy) {
      cli.kill();
      web.kill();
      return createFailedResult(
        "restart-and-verify",
        startedAt,
        !agentHealthy ? "BuildFlow agent did not become healthy on port 3052" : "BuildFlow web app did not become healthy on port 3054",
        restartStepResults,
        !agentHealthy ? "start:packages/cli" : "start:apps/web",
      );
    }

    const verifyResult = await runSteps("restart-and-verify", buildflowRoot, token, getBuildflowVerificationSteps(true), Math.max(1, deadlineAt - Date.now()));
    restartStepResults.push(...verifyResult.steps);
    if (!verifyResult.ok) {
      return {
        ...verifyResult,
        mode: "restart-and-verify",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        steps: restartStepResults,
      };
    }

    return {
      ...verifyResult,
      mode: "restart-and-verify",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      steps: restartStepResults,
    };
  } catch (err) {
    return createFailedResult("restart-and-verify", startedAt, String(err), restartStepResults);
  }
}
