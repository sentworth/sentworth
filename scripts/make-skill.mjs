// Builds skills/sentworth/SKILL.md from scripts/skill-template.md, the server's instructions and the networks' rules
// (data/*.json, copied from Sentworth's contract). Run `node scripts/make-skill.mjs --check` to see whether it is current.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const rules = JSON.parse(read('data/network-rules.json'));
const { instructions } = JSON.parse(read('data/instructions.json'));

// The server's words name its tools; this tool's commands do the same jobs.
const COMMANDS = {
  list_accounts: '`sentworth accounts`',
  create_post: '`sentworth post`',
  create_upload_link: '`sentworth upload`',
  do_not_hand_over_again: 'a post that says so',
};
const rulesBlock = instructions
  .split(/(?<=\.)\s+/)
  .map((sentence) =>
    sentence
      .replace(/\(do_not_hand_over_again\)/g, '')
      .replace(/\b(list_accounts|create_post|create_upload_link)\b/g, (name) => COMMANDS[name])
      .replace(/\s+/g, ' ')
      .replace(/ ([.:])/g, '$1'),
  )
  .map((sentence) => `- ${sentence}`)
  .join('\n');

const LABELS = {
  limit: 'Most characters',
  shortLimit: 'Most characters',
  longLimit: 'Most characters for a long post (accounts that have long posts)',
  videoLimit: 'Most characters with a video',
  photoLimit: 'Most characters with photos',
  titleLimit: 'Most characters in the title',
  descriptionBytes: 'Longest description',
  textBytes: 'Most bytes of text',
  hashtags: 'Most hashtags',
  links: 'Most links',
  maxParts: 'Most parts in a thread',
  maxFiles: 'Most files in a post',
  maxPictures: 'Most pictures',
  maxPhotos: 'Most photos',
  imageBytes: 'Biggest picture',
  gifBytes: 'Biggest GIF',
  photoBytes: 'Biggest photo',
  pictureBytes: 'Biggest picture',
  videoBytes: 'Biggest video',
  bytes: 'Biggest file',
  shortestMs: 'Shortest video',
  longestMs: 'Longest video',
  shortLongestMs: 'Longest video that counts as a Short',
  tallest: 'Tallest picture (width over height)',
  widest: 'Widest picture (width over height)',
  dailyPosts: 'Posts per account in any 24 hours',
  gapMs: 'Gap between one video’s accounts',
  sameTextMs: 'Wait before the same text again',
  types: 'Picture types',
  reel: 'Reel',
  story: 'Story',
};

const split = (key) => key.replace(/([A-Z])/g, ' $1').toLowerCase();
const label = (key) => LABELS[key] ?? split(key).replace(/^./, (c) => c.toUpperCase());

function size(bytes) {
  const mb = bytes / 1024 ** 2;
  return mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${+mb.toFixed(1)} MB`;
}
function span(ms) {
  if (ms >= 3_600_000) return `${+(ms / 3_600_000).toFixed(1)} hours`;
  if (ms >= 120_000) return `${+(ms / 60_000).toFixed(1)} minutes`;
  return `${+(ms / 1000).toFixed(1)} seconds`;
}
function value(key, v) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') {
    if (/Ms$/.test(key)) return span(v);
    if (/Bytes$/.test(key) || key === 'bytes') {
      return /^(descriptionBytes|textBytes)$/.test(key) ? `${v} bytes` : size(v);
    }
  }
  return String(v);
}
function lines(object, indent = '') {
  return Object.entries(object).flatMap(([key, v]) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? [`${indent}- ${label(key)}:`, ...lines(v, `${indent}  `)]
      : [`${indent}- ${label(key)}: ${value(key, v)}`],
  );
}

const REPLIES = {
  thread: 'Later parts of a thread go as replies, one after another.',
  first_comment: 'The second part goes as a first comment; later parts are not sent.',
  none: 'One part only: no thread and no first comment.',
};

const networks = Object.entries(rules)
  .map(([id, n]) => {
    const out = [`### ${n.name} (\`${id}\`)`, '', `- ${REPLIES[n.replies]}`];
    if (n.partGapMs) out.push(`- Gap between parts: ${span(n.partGapMs)}.`);
    if (n.accountGapMs) out.push(`- This network's accounts for one post go ${span(n.accountGapMs)} apart.`);
    if (n.alwaysAsksFirst) out.push('- A post handed in through a key or an assistant always waits for the person’s yes before it goes.');
    return [...out, ...lines(n.rules)].join('\n');
  })
  .join('\n\n');

const text = read('scripts/skill-template.md')
  .replace('<!-- RULES -->', rulesBlock)
  .replace('<!-- NETWORKS -->', networks);

const target = join(root, 'skills/sentworth/SKILL.md');
if (process.argv.includes('--check')) {
  let have = '';
  try {
    have = readFileSync(target, 'utf8');
  } catch {
    // Missing counts as out of date.
  }
  if (have !== text) {
    console.error('skills/sentworth/SKILL.md is out of date: run `pnpm generate`.');
    process.exit(1);
  }
  console.log('skills/sentworth/SKILL.md is current.');
} else {
  writeFileSync(target, text);
  console.log('Wrote skills/sentworth/SKILL.md');
}
