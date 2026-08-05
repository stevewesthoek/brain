import {explainContextCommand, healthContextCommand, renderContextGatewayOutput, resolveContextCommand} from '../core/gateway-commands.mjs';

function usage() {
  return [
    'Usage:',
    '  npm --prefix projects/mind-context run cli -- resolve --query "..." --root PATH --scope SCOPE [--scope SCOPE] [--format json|markdown] [--max-items N] [--max-tokens N] [--scope-subset SCOPE] [--authority-filter any|current] [--freshness-filter any|fresh]',
    '  npm --prefix projects/mind-context run cli -- explain --query "..." --root PATH --scope SCOPE [options]',
    '  npm --prefix projects/mind-context run cli -- health [--format json|markdown]',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {_: []};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    const key = token.slice(2, eq === -1 ? undefined : eq);
    const value = eq === -1 ? argv[++i] ?? true : token.slice(eq + 1);
    if (key === 'scope' || key === 'forbidden-scope' || key === 'scope-subset') {
      const listKey = key === 'scope' ? 'scopes' : key === 'forbidden-scope' ? 'forbiddenScopes' : 'scopeSubset';
      args[listKey] ??= [];
      args[listKey].push(String(value));
      continue;
    }
    args[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value === true ? true : String(value);
  }
  return args;
}

async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArgs(argv);
    const command = parsed._[0];
    if (!command || parsed.help) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    if (command === 'health') {
      const format = String(parsed.format ?? 'json').toLowerCase();
      process.stdout.write(`${renderContextGatewayOutput(healthContextCommand(), format)}\n`);
      return 0;
    }
    if (command !== 'resolve' && command !== 'explain') throw new Error('invalid_command');
    const payload = command === 'resolve' ? resolveContextCommand(parsed) : explainContextCommand(parsed);
    process.stdout.write(`${renderContextGatewayOutput(payload, payload.input.format)}\n`);
    return 0;
  } catch (error) {
    const code = String(error?.message ?? error);
    const status = code === 'missing_root' || code === 'missing_query' || code === 'missing_scope' || code === 'invalid_scope' || code === 'invalid_budget' || code === 'invalid_output_format' || code === 'invalid_command'
      ? 2
      : code === 'insufficient_evidence'
        ? 3
        : 4;
    process.stderr.write(`${code}\n`);
    return status;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await main();
  process.exitCode = exitCode;
}

export {main as runCli, parseArgs};
