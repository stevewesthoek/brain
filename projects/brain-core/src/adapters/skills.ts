import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreSkillSummary } from '../types/api.js';

const DEFAULT_SKILLS_DIR = '../../operations/system-configs/codex/skills';

export function listSkills(skillsDir = getSkillsDir()): BrainCoreSkillSummary[] {
  if (!fs.existsSync(skillsDir)) {
    return [
      {
        id: 'skills-index-unavailable',
        name: 'Skills index unavailable',
        sourcePath: skillsDir,
        status: 'placeholder',
      },
    ];
  }

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillPath = path.join(skillsDir, entry.name);
      const skillFilePath = path.join(skillPath, 'SKILL.md');
      const hasSkillFile = fs.existsSync(skillFilePath);

      return {
        id: entry.name,
        name: toDisplayName(entry.name),
        sourcePath: path.relative(process.cwd(), skillPath),
        status: hasSkillFile ? 'indexed' : 'placeholder',
      } satisfies BrainCoreSkillSummary;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getSkillsDir(): string {
  const configured = process.env.BRAIN_CORE_SKILLS_DIR;
  return path.resolve(process.cwd(), configured || DEFAULT_SKILLS_DIR);
}

function toDisplayName(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
