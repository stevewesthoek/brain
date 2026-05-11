#!/usr/bin/env node
// Video Orchestrator scheduler CLI
// Manual entry point for scheduling and running video jobs
// Usage:
//   node video-orchestrator-scheduler.mjs schedule-month [--dry-run=true] [--episode-count=3]
//   node video-orchestrator-scheduler.mjs run-due [--dry-run=true] [--max-jobs=2]
//   node video-orchestrator-scheduler.mjs list [--status=scheduled]

import {
  listVideoJobs,
  scheduleRestOfMonth,
  runDueVideoJobs,
  getVideoJobsStatus,
  resetQuota,
} from "../bot/video-orchestrator-jobs.ts";

const command = process.argv[2] || "list";

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(3)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args[key] = value === "true" ? true : value === "false" ? false : value;
  }
  return args;
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
        console.log(`\nUsage:`);
        console.log(`  schedule-month [--dry-run=true] [--episode-count=3]`);
        console.log(`  run-due [--dry-run=true] [--max-jobs=2] [--for-date=2026-05-15]`);
        console.log(`  list [--status=scheduled]`);
        console.log(`  status`);
        console.log(`  reset-quota`);
    }
  } catch (err) {
    console.error(`❌ Error: ${String(err)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
