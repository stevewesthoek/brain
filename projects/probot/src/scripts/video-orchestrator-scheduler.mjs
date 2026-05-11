#!/usr/bin/env node
// Video Orchestrator scheduler CLI
// Manual entry point for scheduling and running video jobs
// Usage:
//   npm run probot:video:schedule-month -- [--dry-run=true] [--episode-count=3]
//   npm run probot:video:run-due -- [--dry-run=true] [--max-jobs=2]
//   npm run probot:video:jobs -- [--status=scheduled]

import {
  listVideoJobs,
  scheduleRestOfMonth,
  runDueVideoJobs,
  getVideoJobsStatus,
  resetQuota,
} from "../bot/video-orchestrator-jobs.ts";
import { parseSchedulerArgs } from "./video-orchestrator-scheduler-args.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";

const command = process.argv[2] || "list";

function parseArgs() {
  return parseSchedulerArgs(process.argv.slice(3));
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString();
}

async function main() {
  const args = parseArgs();

  try {
    switch (command) {
      case "schedule-month": {
        console.log("📅 Scheduling rest of month...");
        const result = scheduleRestOfMonth({
          dryRun: args["dry-run"] !== false,
          episodeCount: Number(args["episode-count"]) || 3,
        });
        console.log(`✅ Created: ${result.created}, Skipped (existing): ${result.existing}`);
        const jobs = listVideoJobs({ status: "scheduled" });
        console.log(`\nScheduled jobs for rest of month:`);
        for (const job of jobs) {
          console.log(`  - ${job.id.slice(0, 8)}: ${job.type} @ ${formatDate(job.scheduled_for)}`);
        }
        break;
      }

      case "run-due": {
        console.log("🚀 Running due jobs...");
        const result = await runDueVideoJobs({
          dryRun: args["dry-run"] !== false,
          maxJobs: Number(args["max-jobs"]) || 5,
          forDate: args["for-date"] ? new Date(args["for-date"]) : undefined,
        });
        console.log(`✅ Ran: ${result.ran}, Quota paused: ${result.quota_paused}, Failed: ${result.failed}`);
        break;
      }

      case "list": {
        const jobs = listVideoJobs({ status: args.status });
        console.log(`\n📋 Video Orchestrator Jobs (${jobs.length} total):`);
        for (const job of jobs) {
          const icon = { scheduled: "⏳", running: "🔄", completed: "✅", failed: "❌", paused_quota: "⏸", cancelled: "❌" }[job.status];
          console.log(
            `${icon} ${job.id.slice(0, 8)}: ${job.type} [${job.status}] @ ${formatDate(job.scheduled_for)} ${job.dry_run ? "(dry-run)" : "(real)"}`
          );
          if (job.error_message) {
            console.log(`   Error: ${job.error_message}`);
          }
        }
        break;
      }

      case "status": {
        const status = getVideoJobsStatus();
        console.log(`\n📊 Video Orchestrator Status:`);
        console.log(`  Total: ${status.total_jobs}`);
        console.log(`  Scheduled: ${status.scheduled}`);
        console.log(`  Running: ${status.running}`);
        console.log(`  Completed: ${status.completed}`);
        console.log(`  Failed: ${status.failed}`);
        console.log(`  Paused (quota): ${status.paused_quota}`);
        console.log(`  Dry-run mode: ${status.dry_run_mode ? "YES" : "NO"}`);
        console.log(`  Quota: ${status.quota_status.total_used}/${status.quota_status.limit} (resets ${formatDate(status.quota_status.reset_at)})`);
        break;
      }

      case "reset-quota": {
        console.log("🔄 Resetting quota...");
        resetQuota();
        const status = getVideoJobsStatus();
        console.log(`✅ Quota reset: ${status.quota_status.total_used}/${status.quota_status.limit}`);
        break;
      }

      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log(`\nUsage (via npm from projects/probot/ or repo root):`);
        console.log(`  npm run probot:video:jobs -- [--status=scheduled]`);
        console.log(`  npm run probot:video:status`);
        console.log(`  npm run probot:video:reset-quota`);
        console.log(`  npm run probot:video:schedule-month -- [--dry-run=true] [--episode-count=3]`);
        console.log(`  npm run probot:video:run-due -- [--dry-run=true] [--max-jobs=2]`);
    }
  } catch (err) {
    console.error(`❌ Error: ${String(err)}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const execArgv = process.argv[1];
const isDirectExecution = path.resolve(__filename) === path.resolve(execArgv);

if (isDirectExecution) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
