// Video Orchestrator scheduler CLI argument parser
// Pure parsing logic, no side effects
// Safe to import without triggering CLI execution

export type SchedulerArgValue = string | boolean;
export type SchedulerArgs = Record<string, SchedulerArgValue>;

export function parseSchedulerArgs(argv: string[]): SchedulerArgs {
  const args: SchedulerArgs = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx > 0) {
        // --key=value format
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        args[key] = value === "true" ? true : value === "false" ? false : value;
        i++;
      } else {
        // --key value format (space-separated)
        const key = arg.slice(2);
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith("--")) {
          const value = nextArg;
          args[key] = value === "true" ? true : value === "false" ? false : value;
          i += 2;
        } else {
          // Flag without value
          args[key] = true;
          i++;
        }
      }
    } else {
      i++;
    }
  }
  return args;
}
