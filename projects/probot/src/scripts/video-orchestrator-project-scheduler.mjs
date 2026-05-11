#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSchedulerArgs } from "./video-orchestrator-scheduler-args.ts";
import { scheduleProjectDistributionPlan } from "../bot/video-orchestrator-jobs.ts";

const __filename = fileURLToPath(import.meta.url);

function usage() {
  console.log(`
Usage: video-orchestrator-project-scheduler [OPTIONS]

Options:
  --dry-run=true|false    Enable/disable dry-run mode (required)
  --file <path>           Path to project distribution JSON file (required)
  --weeks <number>        Number of weeks to schedule (default: 1)
  --start-date <iso>      ISO 8601 start date (default: today)

Examples:
  npx tsx video-orchestrator-project-scheduler.mjs \\
    --dry-run=true \\
    --file ../../operations/specs/video-orchestrator/examples/project-distribution.example.json \\
    --weeks=1

  npx tsx video-orchestrator-project-scheduler.mjs \\
    --dry-run=true \\
    --file ./projects.json \\
    --start-date=2026-05-15 \\
    --weeks=4

Note: dryRun=false is blocked by VO-2B (not yet implemented for real publishing).
  `);
}

async function main() {
  const args = parseSchedulerArgs(process.argv.slice(2));

  // Validate required arguments
  if (args["dry-run"] === undefined) {
    console.error("Error: --dry-run is required (true|false)");
    usage();
    process.exit(1);
  }

  const dryRunStr = String(args["dry-run"]).toLowerCase();
  const dryRun = dryRunStr === "true";

  if (dryRunStr !== "true" && dryRunStr !== "false") {
    console.error("Error: --dry-run must be 'true' or 'false'");
    process.exit(1);
  }

  if (!args.file) {
    console.error("Error: --file is required");
    usage();
    process.exit(1);
  }

  const filePath = String(args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Parse project distribution file
  let projects;
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContent);
    if (!data.projects || !Array.isArray(data.projects)) {
      throw new Error("File must contain a 'projects' array");
    }
    projects = data.projects;
  } catch (err) {
    console.error(`Error reading/parsing file: ${err}`);
    process.exit(1);
  }

  // Parse optional arguments
  const weeks = args.weeks ? Number(args.weeks) : 1;
  let startDate;
  if (args["start-date"]) {
    startDate = new Date(String(args["start-date"]));
    if (isNaN(startDate.getTime())) {
      console.error(`Error: Invalid start-date: ${args["start-date"]}`);
      process.exit(1);
    }
  }

  // Schedule projects
  try {
    const result = scheduleProjectDistributionPlan({
      projects,
      dryRun,
      startDate,
      weeks,
    });

    // Print summary
    console.log("\n✓ Project distribution scheduling completed");
    console.log(`  Created:       ${result.created}`);
    console.log(`  Existing:      ${result.existing}`);
    console.log(`  Skipped:       ${result.skipped}`);
    console.log(`  Projects:      ${result.planned.length}`);
    console.log(`  Weekly slots:  ${result.planned.reduce((sum, p) => sum + p.planned_weekly_slots, 0)}`);
    console.log();

    for (const plan of result.planned) {
      console.log(`  Project: ${plan.project_id}`);
      console.log(`    Platforms:     ${plan.planned_platforms}`);
      console.log(`    Weekly slots:  ${plan.planned_weekly_slots}`);
    }

    console.log();
  } catch (err) {
    console.error(`Error: ${err}`);
    process.exit(1);
  }
}

const isDirectExecution = path.resolve(__filename) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
