import { describe, expect, it } from 'vitest';

import { NOT_CONFIRMED, printList, printPost, printSaved, type Post, type Saved } from '../src/output.js';

const post = (over: Partial<Post> = {}): Post => ({
  id: 'p1',
  state: 'active',
  word: 'scheduled',
  made_by: { kind: 'program', name: 'sentworth cli' },
  made_with_ai: false,
  created_at: '2026-11-13T08:00:00Z',
  time: '2026-11-20T09:30:00+04:00',
  time_zone: 'Asia/Tbilisi',
  parts: [{ text: 'one', media: [] }, { text: 'two', media: [] }],
  accounts: ['a1'],
  lines: [
    { account_id: 'a1', network: 'x', handle: 'me', part: 0, state: 'scheduled', words: 'one', reason: null, link: null, due_at: null, ended_at: null, try_number: 0 },
  ],
  link: null,
  do_not_hand_over_again: false,
  note: null,
  can_change: true,
  ...over,
});

const saved = (over: Partial<Saved> = {}): Saved => ({
  post: post(),
  post_ids: ['p1'],
  already_made: false,
  waiting_for_yes: false,
  saved_as_draft: false,
  note: null,
  ...over,
});

describe('plain words', () => {
  it('says what was handed in and prints the reference for a retry', () => {
    const text = printSaved(saved(), 'cli-1', true);
    expect(text).toContain('Handed in.');
    expect(text).toContain('Part 2: two');
    expect(text).toContain('--reference cli-1');
  });

  it('says when it waits for a yes and when the reference was already used', () => {
    expect(printSaved(saved({ waiting_for_yes: true }), 'r', false)).toContain('waits for your yes');
    expect(printSaved(saved({ already_made: true }), 'r', false)).toContain('Already handed in');
  });

  it('prints "Sent, not confirmed" with "don’t hand it over again"', () => {
    const text = printPost(
      post({
        word: 'not_confirmed',
        do_not_hand_over_again: true,
        lines: [{ ...post().lines[0]!, state: 'not_confirmed' }],
      }),
    );
    expect(text).toContain(NOT_CONFIRMED);
    expect(text).toContain('Sent, not confirmed');
    expect(text).toContain('Don’t hand it over again');
  });

  it('lists posts and marks one not confirmed', () => {
    const text = printList({
      total: 2,
      next_offset: null,
      posts: [
        { id: 'p1', state: 'active', word: 'arrived', made_by: { kind: 'person', name: null }, made_with_ai: false, time: null, text: 'hi', parts: 1, accounts: [], do_not_hand_over_again: false },
        { id: 'p2', state: 'active', word: 'not_confirmed', made_by: { kind: 'person', name: null }, made_with_ai: false, time: null, text: 'yo', parts: 1, accounts: [], do_not_hand_over_again: true },
      ],
    });
    expect(text).toContain('p2');
    expect(text).toContain('don’t hand it over again');
  });
});
