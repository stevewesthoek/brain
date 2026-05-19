import { spawn } from 'node:child_process';
import process from 'node:process';

const steps = [
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'package']],
  ['npm', ['run', 'install:active-vault']],
  ['npm', ['run', 'find:installed']],
];

for (const [cmd, args] of steps) {
  await run(cmd, args);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`));
      }
    });
  });
}
