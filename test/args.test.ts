import { describe, expect, it } from 'vitest';

import { many, mediaArg, readPostFlags, referenceFor, timeChoice } from '../src/args.js';
import { EXIT } from '../src/errors.js';

const usageError = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error as Error & { exit: number };
  }
  throw new Error('did not throw');
};

describe('the one-of-four time rule', () => {
  it('takes exactly one', () => {
    expect(timeChoice({ at: '2026-11-20T09:30' })).toEqual({ time: '2026-11-20T09:30' });
    expect(timeChoice({ at: '2026-11-20T09:30', 'time-zone': 'Asia/Tbilisi' })).toEqual({
      time: '2026-11-20T09:30',
      time_zone: 'Asia/Tbilisi',
    });
    expect(timeChoice({ 'next-usual-time': true })).toEqual({ next_usual_time: true });
    expect(timeChoice({ now: true })).toEqual({ now: true });
    expect(timeChoice({ draft: true })).toEqual({ draft: true });
  });

  it('refuses none, naming the four', () => {
    const error = usageError(() => timeChoice({}));
    expect(error.exit).toBe(EXIT.usage);
    expect(error.message).toContain('--at <time>, --next-usual-time, --now or --draft');
  });

  it('refuses two, and every pair', () => {
    const all = [{ at: 'x' }, { 'next-usual-time': true }, { now: true }, { draft: true }];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        expect(usageError(() => timeChoice({ ...all[i], ...all[j] })).exit).toBe(EXIT.usage);
  });

  it('refuses a time zone with no --at', () => {
    expect(usageError(() => timeChoice({ now: true, 'time-zone': 'Asia/Tbilisi' })).message).toContain('--at');
  });
});

describe('reference', () => {
  it('reuses the one given', () => {
    expect(referenceFor('retry-1')).toEqual({ reference: 'retry-1', fresh: false });
  });
  it('makes a fresh one each time when none is given', () => {
    const a = referenceFor(undefined);
    const b = referenceFor(undefined);
    expect(a.fresh).toBe(true);
    expect(a.reference).toMatch(/^cli-[0-9a-f-]{36}$/);
    expect(a.reference).not.toBe(b.reference);
  });
  it('refuses an empty one', () => {
    expect(usageError(() => referenceFor('  ')).exit).toBe(EXIT.usage);
  });
});

describe('arguments', () => {
  it('reads a flag given once or more than once', () => {
    expect(many(undefined)).toEqual([]);
    expect(many('a')).toEqual(['a']);
    expect(many(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('tells a media id, an https address and a file apart', () => {
    expect(mediaArg('3f8a2b3c-1111-4222-8333-444455556666').kind).toBe('id');
    expect(mediaArg('https://example.com/a.png')).toEqual({ kind: 'url', url: 'https://example.com/a.png' });
    expect(mediaArg('./pics/a.png')).toEqual({ kind: 'file', path: './pics/a.png' });
    expect(usageError(() => mediaArg('http://example.com/a.png')).exit).toBe(EXIT.usage);
  });

  it('reads a thread, where it goes and when', () => {
    const read = readPostFlags({ part: ['one', 'two'], network: ['X', 'bluesky'], draft: true });
    expect(read.parts).toEqual(['one', 'two']);
    expect(read.networks).toEqual(['x', 'bluesky']);
    expect(read.time).toEqual({ draft: true });
    expect(read.madeWithAi).toBe(false);
  });

  it('refuses text with parts, no words, no place and an unknown network', () => {
    expect(usageError(() => readPostFlags({ text: 'a', part: ['b'], network: 'x', draft: true })).message).toContain('not both');
    expect(usageError(() => readPostFlags({ network: 'x', draft: true })).message).toContain('--text');
    expect(usageError(() => readPostFlags({ text: 'a', draft: true })).message).toContain('--account');
    expect(usageError(() => readPostFlags({ text: 'a', network: 'myspace', draft: true })).message).toContain('myspace');
  });
});
