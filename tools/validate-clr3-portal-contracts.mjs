import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const files = {
  decisionLog: read('operations/decision-log.md'),
  webReadme: read('projects/brain-console/README.md'),
  obsidianReadme: read('projects/brain-console-obsidian/README.md'),
  obsidianMain: read('projects/brain-console-obsidian/main.js'),
  routes: read('projects/brain-core/src/api/routes.ts'),
  store: read('projects/brain-core/src/adapters/infinite-brain-proposal-approval-store.ts'),
  decisionCore: read('projects/brain-core/src/adapters/infinite-brain-decision-core.ts'),
  notifications: read('projects/brain-core/src/adapters/infinite-brain-decision-notifications.ts'),
};

const errors = [];
const requireText = (name, content, pattern, message) => {
  if (!pattern.test(content)) errors.push(`${name}: ${message}`);
};

requireText(
  'decision-log',
  files.decisionLog,
  /Obsidian is the only (?:target )?primary human dashboard/i,
  'canonical Obsidian-first cockpit decision is missing',
);
requireText(
  'web-console-readme',
  files.webReadme,
  /optional browser diagnostics\/operations surface; \*\*not\*\* the primary human cockpit/i,
  'port-4881 web app must be explicitly non-primary',
);
requireText(
  'web-console-readme',
  files.webReadme,
  /Do not add a second Decision Center to this web app/i,
  'port-4881 web app must explicitly reject a duplicate Decision Center',
);
requireText(
  'obsidian-readme',
  files.obsidianReadme,
  /primary human cockpit for Brain \+ Mind/i,
  'Obsidian adapter must be documented as the primary cockpit',
);
requireText(
  'obsidian-readme',
  files.obsidianReadme,
  /does not maintain a second decision store/i,
  'Obsidian adapter must use the single Brain Core Decision Core',
);
requireText(
  'obsidian-main',
  files.obsidianMain,
  /DEFAULT_BRAIN_CORE_URL/,
  'Obsidian adapter must use configurable Brain Core transport',
);
requireText(
  'obsidian-main',
  files.obsidianMain,
  /\/api\/infinite-brain\/decisions/,
  'Obsidian adapter must read Decision Core through Brain Core',
);
requireText(
  'obsidian-main',
  files.obsidianMain,
  /decision.*notifications\/poll/i,
  'Obsidian adapter must poll bounded decision attention through Brain Core',
);

if (files.obsidianMain.includes('4881')) {
  errors.push('obsidian-main: Decision Center must not depend on the port-4881 web app');
}

requireText(
  'routes',
  files.routes,
  /case '\/api\/infinite-brain\/decisions'/,
  'Brain Core GET Decision Core endpoint is missing',
);
requireText(
  'routes',
  files.routes,
  /stale_proposal_hash/,
  'Brain Core decision action must reject stale proposal hashes',
);
requireText(
  'routes',
  files.routes,
  /decision_idempotent|result\.code/,
  'Brain Core decision action must preserve idempotent result codes',
);
requireText(
  'routes',
  files.routes,
  /executionBlocked:\s*true/,
  'Decision action response must keep execution blocked',
);
requireText(
  'routes',
  files.routes,
  /writesToMind:\s*false/,
  'CLR3 decision actions must not write Mind',
);

requireText(
  'approval-store',
  files.store,
  /proposal-approvals\.json/,
  'Decision Core must extend the existing proposal approval ledger',
);
requireText(
  'approval-store',
  files.store,
  /schemaVersion:\s*'1\.0\.0'/,
  'Decision Core proposal-approval store must be explicitly versioned',
);
requireText(
  'approval-store',
  files.store,
  /stale_proposal_hash/,
  'approval ledger must expose stale hash rejection',
);
requireText(
  'approval-store',
  files.store,
  /decision_idempotent/,
  'approval ledger must expose idempotent decision results',
);
requireText(
  'decision-core',
  files.decisionCore,
  /readInfiniteBrainProposalReport/,
  'Decision Core must project the existing proposal report',
);
requireText(
  'decision-core',
  files.decisionCore,
  /findInfiniteBrainProposalApproval/,
  'Decision Core must project the existing approval ledger',
);
requireText(
  'decision-core',
  files.decisionCore,
  /singleLogicalQueue:\s*true/,
  'Decision Core must declare one logical queue',
);
requireText(
  'decision-core',
  files.decisionCore,
  /freshnessDeadline/,
  'Decision Core cards must expose proposal freshness/review deadlines when present',
);

requireText(
  'notifications',
  files.notifications,
  /decision-notification-state\.json/,
  'notification cursor state must be separate from the approval ledger',
);
requireText(
  'notifications',
  files.notifications,
  /computeDecisionNotificationPlan/,
  'notification adapter must use the bounded shared plan',
);

const webAppRoot = path.join(root, 'projects/brain-console/app');
if (fs.existsSync(webAppRoot)) {
  const stack = [webAppRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(absolute, 'utf8');
        if (/\/api\/infinite-brain\/decisions/.test(content) || /Decision Center/.test(content)) {
          errors.push(`port-4881-overlap: ${path.relative(root, absolute)} contains CLR Decision Center wiring`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('clr3-portal-contracts-valid primary=obsidian backend=brain-core web4881=optional decisionStores=1 decisionCenterWebDuplicates=0');
