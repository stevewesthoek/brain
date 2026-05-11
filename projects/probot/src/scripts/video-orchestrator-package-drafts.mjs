#!/usr/bin/env node
// Video Orchestrator package drafts CLI
// Manages production package drafts for dry-run scheduling and validation
// Usage:
//   npm run probot:video:package-drafts -- create-from-jobs --dry-run=true --limit=10
//   npm run probot:video:package-drafts -- list [--project-id=<id>] [--platform=<platform>]
//   npm run probot:video:package-drafts -- validate --all
//   npm run probot:video:package-drafts -- validate --package-id=<id>
//   npm run probot:video:package-drafts -- status

import {
  createPackageDraftsForScheduledJobs,
  listProductionPackageDrafts,
  validateProductionPackageDraft,
  getProductionPackageReadinessReport,
  buildProductionPackageDraftSummary,
} from "../bot/video-orchestrator-jobs.ts";
import { parsePackageDraftsArgs } from "./video-orchestrator-package-drafts-args.ts";
import { formatPackageId, formatPackageDraftDate } from "./video-orchestrator-package-drafts-format.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";

const command = process.argv[2] || "status";

function parseArgs() {
  return parsePackageDraftsArgs(process.argv.slice(3));
}

async function main() {
  const args = parseArgs();

  try {
    switch (command) {
      case "create-from-jobs": {
        if (args["dry-run"] === false) {
          console.error("❌ dryRun=false is not supported in VO-2E. Use dryRun=true.");
          process.exit(1);
        }

        console.log("📦 Creating package drafts from scheduled jobs...");
        const result = createPackageDraftsForScheduledJobs({
          dryRun: true,
          status: args.status || "scheduled",
          limit: Number(args.limit) || 50,
        });

        console.log(`✅ Created: ${result.created}`);
        console.log(`⏭️  Existing: ${result.existing}`);
        console.log(`⏭️  Skipped: ${result.skipped}`);

        if (result.created > 0) {
          console.log(`\n📋 New package IDs:`);
          for (const draft of result.drafts) {
            const safe = buildProductionPackageDraftSummary(draft);
            console.log(`  - ${formatPackageId(safe.package_id)}`);
          }
        }
        break;
      }

      case "list": {
        const filters = {};
        if (args["project-id"]) filters.project_id = args["project-id"];
        if (args.platform) filters.platform = args.platform;
        if (args["package-state"]) filters.package_state = args["package-state"];

        const drafts = listProductionPackageDrafts(filters);
        console.log(`\n📋 Production Package Drafts (${drafts.length} total):`);

        if (drafts.length === 0) {
          console.log("  (no drafts)");
        } else {
          for (const draft of drafts) {
            const safe = buildProductionPackageDraftSummary(draft);
            const icon = safe.ready_to_post ? "📤" : "📦";
            console.log(
              `${icon} ${formatPackageId(safe.package_id)} | project: ${safe.project_id} | platform: ${safe.platform} | state: ${safe.package_state} | scheduled: ${formatPackageDraftDate(safe.scheduled_for)}`
            );
          }
        }
        break;
      }

      case "validate": {
        console.log("✅ Validating package drafts...");

        let draftsToValidate = [];
        if (args.all) {
          draftsToValidate = listProductionPackageDrafts();
        } else if (args["package-id"]) {
          const draft = listProductionPackageDrafts().find((d) => d.package_id === args["package-id"]);
          if (draft) {
            draftsToValidate = [draft];
          } else {
            console.error(`❌ Package not found: ${args["package-id"]}`);
            process.exit(1);
          }
        } else {
          console.error("❌ Use --all or --package-id=<id>");
          process.exit(1);
        }

        let validCount = 0;
        let blockedCount = 0;

        for (const draft of draftsToValidate) {
          const safe = buildProductionPackageDraftSummary(draft);
          if (safe.ready_to_post === false && safe.blocking_reasons_count === 0) {
            validCount++;
          } else {
            blockedCount++;
          }
          console.log(
            `  ${formatPackageId(safe.package_id)} | ${safe.blocking_reasons_count === 0 ? "✅" : "❌"} | ready_to_post=${safe.ready_to_post} | blocking=${safe.blocking_reasons_count} | warnings=${safe.warnings_count}`
          );
        }

        console.log(`\n📊 Summary: ${validCount} valid, ${blockedCount} blocked`);
        break;
      }

      case "status": {
        const report = getProductionPackageReadinessReport();
        console.log(`\n📊 Production Package Readiness Report:`);
        console.log(`  Total: ${report.total}`);
        console.log(`  Ready to post: ${report.ready_to_post}`);
        console.log(`  Blocked: ${report.blocked}`);
        console.log(`  With warnings: ${report.warnings}`);

        console.log(`\n📦 By state:`);
        for (const [state, count] of Object.entries(report.by_state)) {
          console.log(`  ${state}: ${count}`);
        }

        console.log(`\n🌐 By platform:`);
        for (const [platform, count] of Object.entries(report.by_platform)) {
          console.log(`  ${platform}: ${count}`);
        }

        if (report.total === 0) {
          console.log(`\n(no drafts)`);
        }
        break;
      }

      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log(`\nUsage (via npm from projects/probot/ or repo root):`);
        console.log(`  npm run probot:video:package-drafts -- create-from-jobs --dry-run=true --limit=10`);
        console.log(`  npm run probot:video:package-drafts -- list [--project-id=<id>] [--platform=<platform>]`);
        console.log(`  npm run probot:video:package-drafts -- validate --all`);
        console.log(`  npm run probot:video:package-drafts -- validate --package-id=<id>`);
        console.log(`  npm run probot:video:package-drafts -- status`);
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
