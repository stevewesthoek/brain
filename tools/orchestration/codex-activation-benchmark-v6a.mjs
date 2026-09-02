import phase5 from './codex-pilot-corpus-v5.json' with { type: 'json' };

const codeTargets = ['authentication', 'routing', 'the API', 'the data adapter', 'the task parser', 'the context broker', 'the profile resolver', 'the data handler', 'the graph validator', 'the CLI entry'];
const designTargets = ['onboarding flow', 'pricing page', 'dashboard', 'settings screen', 'mobile layout', 'landing page', 'checkout UI', 'navigation system'];
const researchTargets = ['this company', 'the market', 'these vendors', 'customer demand', 'the competitors', 'this claim'];
const memoryTargets = ['the launch decision', 'our pricing decision', 'the onboarding plan', 'yesterday’s architecture choice'];

function rows(prefix, category, prompts, expected, count) {
  return Array.from({ length: count }, (_, index) => {
    const prompt = prompts[index % prompts.length].replaceAll('{n}', String(index + 1));
    return { id: `${prefix}-${String(index + 1).padStart(3, '0')}`, category, prompt, expected: { ...expected } };
  });
}

const supplemental = [
  ...rows('code', 'code', codeTargets.map((target) => `Analyze the code implementation of ${target} in this repo ({n}).`), { family: 'code', owner: 'skill.code', question: false }, 36),
  ...rows('code-plan', 'code-read-only-plan', codeTargets.map((target) => `Plan a read-only code change for ${target} in this repository ({n}).`), { family: 'code', owner: 'skill.code', question: false }, 24),
  ...rows('code-fix', 'code-substantial', codeTargets.map((target) => `Fix the ${target} issue in this repository ({n}).`), { family: 'code', owner: 'skill.code' }, 20),
  ...rows('design', 'design', designTargets.map((target) => `Design a coherent ${target} concept ({n}).`), { family: 'design', owner: 'skill.design' }, 12),
  ...rows('research', 'research', researchTargets.map((target) => `Research ${target} with authoritative sources ({n}).`), { family: 'research', owner: 'skill.research' }, 12),
  ...rows('bible', 'bible-research', ['Study Romans 8 and explain the context ({n}).', 'Trace this covenant theme through Scripture ({n}).'], { family: 'research', owner: 'skill.research' }, 8),
  ...rows('memory', 'memory', memoryTargets.map((target) => `Recall ${target} ({n}).`), { family: 'memory', owner: 'skill.memory' }, 8),
  ...rows('review', 'review', ['Review the current diff ({n}).', 'Audit this implementation ({n}).'], { family: 'review', owner: 'skill.review' }, 8),
  ...rows('qa', 'qa', ['Test the current behavior ({n}).'], { family: 'qa', owner: 'skill.qa' }, 8),
  ...rows('handoff', 'handoff', ['Prepare a handoff for the next agent ({n}).'], { family: 'handoff', owner: 'skill.handoff' }, 4),
  ...rows('web', 'web', ['Inspect this page in a browser ({n}).', 'Check the URL in a browser ({n}).'], { family: 'web', owner: 'skill.web', question: false }, 8),
  ...rows('video', 'video', ['Plan a short video episode ({n}).', 'Render this video package ({n}).'], { family: 'video', owner: 'skill.video' }, 4),
  ...rows('mixed-design', 'mixed', ['Build a premium landing page, then test it ({n}).'], { family: 'mixed', owner: 'skill.design' }, 4),
  ...rows('mixed-research', 'mixed', ['Research the market and build this feature ({n}).'], { family: 'research', owner: 'skill.research' }, 4),
];

export const activationBenchmark = Object.freeze([...phase5.cases, ...supplemental]);
export const benchmarkMetadata = Object.freeze({ minimumCases: 200, firstDomain: 'code', supplementalCases: supplemental.length, scenarioClasses: ['normal', 'vague', 'ambiguous', 'mixed', 'edge', 'stale', 'conflict', 'high-risk', 'dormant', 'continuation', 'tiny', 'large'], domainMinimums: { code: 60, design: 10, research: 10, bible: 6, memory: 6, review: 6, qa: 6, handoff: 4, web: 6, video: 4, mixed: 6 } });

export default activationBenchmark;
