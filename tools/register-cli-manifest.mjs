#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'operations/CLI-MANIFEST.md');
const BEGIN = '<!-- BEGIN REGISTERED CLI ENTRIES -->';
const END = '<!-- END REGISTERED CLI ENTRIES -->';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] ?? '';
}

function fail(message) {
  process.stderr.write(`register-cli-manifest: ${message}\n`);
  process.exitCode = 1;
}

const name = option('--name');
const cliPath = option('--path');
const type = option('--type') || 'managed';
const description = option('--description') || `${name} command`;

if (!name || !cliPath) {
  fail('usage: node tools/register-cli-manifest.mjs --name <name> --path <path> [--type <type>] [--description <description>]');
} else {
  const content = fs.readFileSync(MANIFEST, 'utf8');
  const escapedName = name.replaceAll('`', '\\`');
  const existing = new RegExp(`^\\| \`${escapedName}\` \\|`, 'm');

  if (existing.test(content)) {
    process.stdout.write(`cli-already-registered ${name}\n`);
  } else {
    const beginIndex = content.indexOf(BEGIN);
    const endIndex = content.indexOf(END);
    if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
      fail(`manifest registration markers missing: ${MANIFEST}`);
    } else {
      const safeDescription = description.replace(/[\r\n|]/g, ' ').trim();
      const row = `| \`${name}\` | \`${cliPath}\` | ${type} | ${safeDescription} |\n`;
      const next = `${content.slice(0, endIndex)}${row}${content.slice(endIndex)}`;
      fs.writeFileSync(MANIFEST, next, 'utf8');
      process.stdout.write(`cli-registered ${name}\n`);
    }
  }
}
