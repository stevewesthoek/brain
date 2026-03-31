import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { esc, skillMenuButtons } from '../format/telegram';

interface Skill {
  name: string;
  description: string;
  command: string;
}

function readSkillDescription(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, 15);
    for (const line of lines) {
      // First heading or comment that looks like a description
      const m =
        line.match(/^#\s+(.+)/) ||
        line.match(/^\/\/\s+(.+)/) ||
        line.match(/^description:\s*(.+)/i);
      if (m && m[1].length > 3) return m[1].trim().slice(0, 100);
    }
    return '';
  } catch {
    return '';
  }
}

function loadSkills(): Skill[] {
  const dir = config.skills.activeDir;
  const skills: Skill[] = [];

  try {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files
      if (entry.startsWith('.')) continue;

      const fullPath = path.join(dir, entry);
      try {
        // Resolve symlinks
        const realPath = fs.realpathSync(fullPath);
        const stat = fs.statSync(realPath);

        let descFile = realPath;
        if (stat.isDirectory()) {
          const candidates = ['README.md', 'skill.md', 'index.md', 'main.md'];
          for (const c of candidates) {
            const candidate = path.join(realPath, c);
            if (fs.existsSync(candidate)) {
              descFile = candidate;
              break;
            }
          }
        }

        skills.push({
          name: entry,
          description: readSkillDescription(descFile),
          command: `/${entry}`,
        });
      } catch {
        // Skip unreadable entries
      }
    }
  } catch (err: unknown) {
    throw new Error(
      `Cannot read skills dir ${dir}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function skillsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/skills', async (_req, reply) => {
    let skills: Skill[];
    try {
      skills = loadSkills();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, error: message });
    }

    const textLines = skills.map(s => {
      const desc = s.description ? ` — ${esc(s.description)}` : '';
      return `• <code>${esc(s.command)}</code>${desc}`;
    });

    const text =
      skills.length === 0
        ? `<i>No skills found.</i>`
        : `<b>🛠 Available skills (${skills.length})</b>\n\n${textLines.join('\n')}`;

    return reply.send({
      ok: true,
      action: 'list_skills',
      count: skills.length,
      skills,
      telegram: {
        text,
        parse_mode: 'HTML',
        // Inline keyboard so user can tap a skill directly in Telegram
        buttons: skillMenuButtons(skills),
      },
    });
  });
}
