import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { settingsFrom } from '../src/client.js';
import { bundledSkill, configPath, installSkill, readSaved, save } from '../src/setup.js';

const temp = () => mkdtemp(join(tmpdir(), 'sentworth-setup-'));

describe('AP-20: npx sentworth saves the key once', () => {
  it('keeps the key in ~/.config/sentworth, readable by this user only', async () => {
    const home = await temp();
    const path = configPath({}, home);
    expect(path).toBe(join(home, '.config', 'sentworth', 'config.json'));
    expect(configPath({ XDG_CONFIG_HOME: '/x' }, home)).toBe('/x/sentworth/config.json');

    await save(path, { key: 'sw_live_saved' });
    expect(await readSaved(path)).toEqual({ key: 'sw_live_saved' });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('reads nothing from a missing or broken file', async () => {
    const home = await temp();
    expect(await readSaved(join(home, 'none.json'))).toEqual({});
    await writeFile(join(home, 'bad.json'), '{not json');
    expect(await readSaved(join(home, 'bad.json'))).toEqual({});
  });

  it('uses the saved key last: a flag, then the environment, then the file', () => {
    const saved = { key: 'file', url: 'http://localhost:3000/' };
    expect(settingsFrom({}, {}, saved)).toEqual({ key: 'file', url: 'http://localhost:3000' });
    expect(settingsFrom({}, { SENTWORTH_KEY: 'env' }, saved).key).toBe('env');
    expect(settingsFrom({ key: 'flag' }, { SENTWORTH_KEY: 'env' }, saved).key).toBe('flag');
    expect(() => settingsFrom({}, {}, {})).toThrow(/npx sentworth/);
  });
});

describe('AP-20: the skill reaches Hermes and OpenClaw', () => {
  it('copies SKILL.md into each agent that is installed, and only those', async () => {
    const home = await temp();
    await mkdir(join(home, '.hermes'));
    const lines = await installSkill(home);
    const copied = await readFile(join(home, '.hermes', 'skills', 'sentworth', 'SKILL.md'), 'utf8');
    expect(copied).toBe(await readFile(bundledSkill(), 'utf8'));
    expect(copied).toMatch(/^---\nname: sentworth\n/);
    await expect(stat(join(home, '.openclaw'))).rejects.toThrow();
    expect(lines).toEqual([expect.stringMatching(/^Hermes: skill saved to .*Hermes finds it by itself\.$/)]);
  });

  it('copies it to OpenClaw too, and says what to do when neither is there', async () => {
    const home = await temp();
    await mkdir(join(home, '.openclaw'));
    expect(await installSkill(home)).toEqual([expect.stringMatching(/^OpenClaw: skill saved to .*openclaw skills list/)]);
    expect(await installSkill(await temp())).toEqual([expect.stringMatching(/^No Hermes or OpenClaw here\./)]);
  });
});
