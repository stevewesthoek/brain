import { test } from "node:test";
import assert from "node:assert";
import { parsePackageDraftsArgs } from "./video-orchestrator-package-drafts-args.js";
import { formatPackageId, formatPackageDraftDate } from "./video-orchestrator-package-drafts-format.js";

test("Package drafts CLI parser: --key=value format", () => {
  const args = parsePackageDraftsArgs(["--dry-run=true", "--limit=10"]);
  assert.strictEqual(args["dry-run"], true);
  assert.strictEqual(args.limit, "10");
});

test("Package drafts CLI parser: --key value format", () => {
  const args = parsePackageDraftsArgs(["--dry-run", "true", "--limit", "5"]);
  assert.strictEqual(args["dry-run"], true);
  assert.strictEqual(args.limit, "5");
});

test("Package drafts CLI parser: mixed formats", () => {
  const args = parsePackageDraftsArgs(["--dry-run=false", "--limit", "20", "--platform=youtube"]);
  assert.strictEqual(args["dry-run"], false);
  assert.strictEqual(args.limit, "20");
  assert.strictEqual(args.platform, "youtube");
});

test("Package drafts CLI parser: flag without value", () => {
  const args = parsePackageDraftsArgs(["--all", "--verbose"]);
  assert.strictEqual(args.all, true);
  assert.strictEqual(args.verbose, true);
});

test("Package drafts CLI parser: string values", () => {
  const args = parsePackageDraftsArgs(["--package-id=pkg-abc-123", "--project-id", "proj-test"]);
  assert.strictEqual(args["package-id"], "pkg-abc-123");
  assert.strictEqual(args["project-id"], "proj-test");
});

// ─── CLI Formatting Helpers Tests ──────────────────────────────────────────

test("CLI: formatPackageId(null) returns fallback", () => {
  assert.strictEqual(formatPackageId(null), "[unsafe-package-id]");
});

test("CLI: formatPackageId(undefined) returns fallback", () => {
  assert.strictEqual(formatPackageId(undefined), "[unsafe-package-id]");
});

test("CLI: formatPackageId('') returns fallback", () => {
  assert.strictEqual(formatPackageId(""), "[unsafe-package-id]");
});

test("CLI: formatPackageId preserves fallback marker", () => {
  assert.strictEqual(formatPackageId("[unsafe-package-id]"), "[unsafe-package-id]");
});

test("CLI: formatPackageId truncates long IDs", () => {
  const longId = "pkg-123456789012345";
  const formatted = formatPackageId(longId);
  assert.ok(formatted.includes("..."), "Should truncate with ellipsis");
  assert.strictEqual(formatted, "pkg-12345678...");
});

test("CLI: formatPackageDraftDate preserves fallback", () => {
  assert.strictEqual(formatPackageDraftDate("[unsafe-scheduled-for]"), "[unsafe-scheduled-for]");
});

test("CLI: formatPackageDraftDate rejects invalid date string", () => {
  assert.strictEqual(formatPackageDraftDate("not-a-date"), "[unsafe-scheduled-for]");
});

test("CLI: formatPackageDraftDate(null) returns fallback", () => {
  assert.strictEqual(formatPackageDraftDate(null), "[unsafe-scheduled-for]");
});

test("CLI: formatPackageDraftDate formats valid ISO string", () => {
  const isoString = "2026-05-11T10:00:00Z";
  const formatted = formatPackageDraftDate(isoString);
  assert.ok(formatted.length > 0, "Should return non-empty string");
  assert.notStrictEqual(formatted, "[unsafe-scheduled-for]", "Should format valid date");
  assert.ok(formatted.includes("2026") || formatted.includes("5"), "Should contain date parts");
});
