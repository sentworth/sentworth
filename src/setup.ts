import { chmod, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { DEFAULT_URL } from './client.js';

export type Saved = { key?: string; url?: string };

// Where `npx sentworth` keeps the key between runs: ~/.config/sentworth/config.json, readable by this user only.
export function configPath(env: Record<string, string | undefined> = process.env, home = homedir()) {
  return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'sentworth', 'config.json');
}

export async function readSaved(path = configPath()): Promise<Saved> {
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as Saved;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function save(path: string, saved: Saved) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

// The agents that read a skill from a folder in the home directory, and that folder.
export const SKILL_HOMES = [
  { name: 'Hermes', dir: '.hermes', after: 'Hermes finds it by itself.' },
  { name: 'OpenClaw', dir: '.openclaw', after: 'Turn it on in OpenClaw (`openclaw skills list` shows it).' },
] as const;

// The skill ships next to dist/ in the package.
export const bundledSkill = () => fileURLToPath(new URL('../skills/sentworth/SKILL.md', import.meta.url));

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

// Copies SKILL.md into each agent that is installed here; an agent that isn't is left alone.
export async function installSkill(home = homedir(), skill = bundledSkill()) {
  const lines: string[] = [];
  for (const agent of SKILL_HOMES) {
    if (!(await exists(join(home, agent.dir)))) continue;
    const target = join(home, agent.dir, 'skills', 'sentworth', 'SKILL.md');
    await mkdir(dirname(target), { recursive: true });
    await copyFile(skill, target);
    lines.push(`${agent.name}: skill saved to ${target}. ${agent.after}`);
  }
  if (!lines.length)
    lines.push(
      'No Hermes or OpenClaw here. For another agent, copy skills/sentworth/SKILL.md from github.com/sentworth/sentworth into its skills folder.',
    );
  return lines;
}

// Asks for the key without showing it as it is typed or pasted.
export function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const muted = rl as unknown as { _writeToOutput: (text: string) => void };
    let asked = false;
    muted._writeToOutput = (text: string) => {
      if (!asked) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    asked = true;
  });
}

export const KEY_HELP = 'Make a key in Sentworth under Assistants and programs, then Skill and command line.';

export const setupUrl = (saved: Saved, flagUrl?: string, env: Record<string, string | undefined> = process.env) =>
  (flagUrl ?? env.SENTWORTH_URL ?? saved.url ?? DEFAULT_URL).trim().replace(/\/+$/, '');
