import { randomUUID } from 'node:crypto';

import { usage } from './errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

// A flag given once comes as a string, given again as an array, left out as undefined.
export function many(value: unknown): string[] {
  if (value === undefined || value === null || value === false) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

export type TimeFlags = {
  at?: string;
  'next-usual-time'?: boolean;
  now?: boolean;
  draft?: boolean;
  'time-zone'?: string;
};

export const TIME_WORDS = '--at <time>, --next-usual-time, --now or --draft';

// Exactly one of the four, so a post never goes out at a time nobody chose.
export function timeChoice(flags: TimeFlags) {
  const chosen = [
    flags.at !== undefined && flags.at !== '' ? 'at' : null,
    flags['next-usual-time'] ? 'next' : null,
    flags.now ? 'now' : null,
    flags.draft ? 'draft' : null,
  ].filter((one) => one !== null);
  if (chosen.length !== 1) {
    throw usage(
      chosen.length === 0
        ? `Say when it goes: give exactly one of ${TIME_WORDS}.`
        : `Give only one of ${TIME_WORDS}; you gave ${String(chosen.length)}.`,
    );
  }
  if (flags['time-zone'] && chosen[0] !== 'at') {
    throw usage('--time-zone only goes with --at.');
  }
  switch (chosen[0]) {
    case 'at':
      return {
        time: flags.at,
        ...(flags['time-zone'] ? { time_zone: flags['time-zone'] } : {}),
      };
    case 'next':
      return { next_usual_time: true };
    case 'now':
      return { now: true };
    default:
      return { draft: true };
  }
}

// A retry with the same reference makes one post, so a fresh one is made and printed when none is given.
export function referenceFor(given: string | undefined) {
  if (given !== undefined && given.trim() === '')
    throw usage('--reference can’t be empty.');
  return given?.trim()
    ? { reference: given.trim(), fresh: false }
    : { reference: `cli-${randomUUID()}`, fresh: true };
}

export type MediaArg =
  | { kind: 'id'; id: string }
  | { kind: 'url'; url: string }
  | { kind: 'file'; path: string };

export function mediaArg(value: string): MediaArg {
  if (isUuid(value)) return { kind: 'id', id: value };
  if (/^https:\/\//i.test(value)) return { kind: 'url', url: value };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value))
    throw usage(`“${value}” must be a file on this computer or an https address.`);
  return { kind: 'file', path: value };
}

export type PostFlags = TimeFlags & {
  text?: string;
  part?: unknown;
  picture?: unknown;
  account?: unknown;
  network?: unknown;
  group?: string;
  reference?: string;
  'made-with-ai'?: boolean;
};

export const NETWORKS = [
  'x',
  'instagram',
  'tiktok',
  'facebook',
  'threads',
  'youtube',
  'linkedin',
  'bluesky',
] as const;

// What the flags say, before any file is uploaded or name looked up.
export function readPostFlags(flags: PostFlags) {
  const parts = many(flags.part);
  if (flags.text !== undefined && parts.length)
    throw usage('Use --text for one post or --part (more than once) for a thread, not both.');
  const media = many(flags.picture).map(mediaArg);
  if (flags.text === undefined && !parts.length && !media.length)
    throw usage('Give the words with --text, or a thread with --part for each part.');
  const networks = many(flags.network).map((one) => one.toLowerCase());
  for (const one of networks)
    if (!(NETWORKS as readonly string[]).includes(one))
      throw usage(`“${one}” is not a network here. Use one of: ${NETWORKS.join(', ')}.`);
  const accounts = many(flags.account);
  if (!accounts.length && !networks.length && !flags.group)
    throw usage('Say where it goes: --account, --network or --group.');
  return {
    time: timeChoice(flags),
    parts,
    text: flags.text,
    media,
    accounts,
    networks,
    group: flags.group,
    madeWithAi: flags['made-with-ai'] === true,
    ...referenceFor(flags.reference),
  };
}
