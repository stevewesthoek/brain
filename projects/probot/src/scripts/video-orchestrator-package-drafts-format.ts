// CLI formatting helpers for safe output
// Side-effect-free functions for formatting package draft data

export function formatPackageId(id: unknown): string {
  // Handle non-string types
  if (typeof id !== "string") {
    return "[unsafe-package-id]";
  }

  // Handle empty string
  if (!id) {
    return "[unsafe-package-id]";
  }

  // Preserve fallback markers
  if (id.startsWith("[") && id.endsWith("]")) {
    return id;
  }

  // Truncate long IDs with ellipsis
  if (id.length > 12) {
    return id.slice(0, 12) + "...";
  }

  return id;
}

export function formatPackageDraftDate(value: unknown): string {
  // Preserve fallback marker
  if (typeof value === "string" && value === "[unsafe-scheduled-for]") {
    return "[unsafe-scheduled-for]";
  }

  // Handle non-string types
  if (typeof value !== "string") {
    return "[unsafe-scheduled-for]";
  }

  // Try to parse and format as date
  try {
    const date = new Date(value);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "[unsafe-scheduled-for]";
    }
    return date.toLocaleString();
  } catch {
    return "[unsafe-scheduled-for]";
  }
}
