import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as run from '../src/commands.js';
import { makeClient, settingsFrom } from '../src/client.js';
import { CliError, EXIT } from '../src/errors.js';

const BASE = 'https://sentworth.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const X = '3f8a2b3c-1111-4222-8333-444455556666';

function context(json = false) {
  const lines: string[] = [];
  const ctx: run.Context = {
    client: makeClient({ key: 'sw_live_test', url: BASE }),
    baseUrl: BASE,
    json,
    print: (text) => lines.push(text),
  };
  return { ctx, lines };
}

const post = (over: object = {}) => ({
  id: 'p1', state: 'draft', word: 'draft', made_by: { kind: 'program', name: 'cli' }, made_with_ai: false,
  created_at: '2026-11-13T08:00:00Z', time: null, time_zone: null,
  parts: [{ text: 'one', media: [] }, { text: 'two', media: [] }], accounts: [X], lines: [], link: null,
  do_not_hand_over_again: false, note: null, can_change: true, ...over,
});
const saved = (over: object = {}) => ({
  post: post(), post_ids: ['p1'], already_made: false, waiting_for_yes: false, saved_as_draft: false, note: null, ...over,
});

describe('settings', () => {
  it('reads the key and address from flags, then the environment, with a default address', () => {
    expect(settingsFrom({ key: 'a' }, { SENTWORTH_KEY: 'b' })).toEqual({ key: 'a', url: 'https://sentworth.com' });
    expect(settingsFrom({}, { SENTWORTH_KEY: 'b', SENTWORTH_URL: 'http://localhost:3000/' })).toEqual({ key: 'b', url: 'http://localhost:3000' });
    expect(() => settingsFrom({}, {})).toThrow(/No key/);
  });
});

describe('post', () => {
  it('hands a two-part thread in as a draft with the key and a reference', async () => {
    let body: Record<string, unknown> = {};
    let auth = '';
    server.use(
      http.post(`${BASE}/v1/posts`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        auth = request.headers.get('authorization') ?? '';
        return HttpResponse.json(saved());
      }),
    );
    const { ctx, lines } = context();
    const code = await run.post(ctx, { part: ['one', 'two'], account: [X], draft: true, reference: 'r-1' });
    expect(code).toBe(EXIT.ok);
    expect(auth).toBe('Bearer sw_live_test');
    expect(body).toEqual({ parts: [{ text: 'one' }, { text: 'two' }], account_ids: [X], draft: true, reference: 'r-1' });
    expect(lines.join('\n')).toContain('Reference: r-1.');
  });

  it('sends the same reference on a retry and a fresh one otherwise', async () => {
    const seen: string[] = [];
    server.use(
      http.post(`${BASE}/v1/posts`, async ({ request }) => {
        seen.push(((await request.json()) as { reference: string }).reference);
        return HttpResponse.json(saved());
      }),
    );
    const base = { text: 'hi', network: 'x', now: true };
    await run.post(context().ctx, { ...base, reference: 'same' });
    await run.post(context().ctx, { ...base, reference: 'same' });
    await run.post(context().ctx, base);
    await run.post(context().ctx, base);
    expect(seen[0]).toBe('same');
    expect(seen[1]).toBe('same');
    expect(seen[2]).not.toBe(seen[3]);
    expect(seen[2]).toMatch(/^cli-/);
  });

  it('sends nothing when the time rule is broken', async () => {
    const { ctx } = context();
    await expect(run.post(ctx, { text: 'hi', network: 'x' })).rejects.toMatchObject({ exit: EXIT.usage });
  });

  it('looks an account up by name, passes an https picture, and sets made_with_ai', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json({ accounts: [{ id: X, network: 'x', name: '@me', kind: 'profile', state: 'connected', groups: [], usual_times: [], posts_left_today: null, daily_limit: null, waits_for_yes: false }], groups: [], time_zone: 'Asia/Tbilisi', time_now: 'now', x_posts_left_today: 10, tiktok_posts_left_today: null }),
      ),
      http.post(`${BASE}/v1/posts`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(saved());
      }),
    );
    await run.post(context().ctx, { text: 'hi', account: '@me', picture: 'https://example.com/a.png', 'next-usual-time': true, 'made-with-ai': true });
    expect(body).toMatchObject({ account_ids: [X], media: [{ url: 'https://example.com/a.png' }], next_usual_time: true, made_with_ai: true });
  });

  it('exits 6 and says "Sent, not confirmed" for a post that may be live', async () => {
    server.use(http.get(`${BASE}/v1/posts/p1`, () => HttpResponse.json(post({ word: 'not_confirmed', do_not_hand_over_again: true }))));
    const { ctx, lines } = context();
    expect(await run.get(ctx, 'p1')).toBe(EXIT.notConfirmed);
    expect(lines.join('\n')).toContain('Sent, not confirmed');
  });

  it('prints the answer as JSON with the reference when asked', async () => {
    server.use(http.post(`${BASE}/v1/posts`, () => HttpResponse.json(saved())));
    const { ctx, lines } = context(true);
    await run.post(ctx, { text: 'hi', network: 'x', draft: true, reference: 'j-1' });
    expect(JSON.parse(lines[0]!)).toMatchObject({ reference: 'j-1', post: { id: 'p1' } });
  });
});

describe('answers that are not good', () => {
  const failing = async (status: number, body: object, headers: Record<string, string> = {}) => {
    server.use(http.get(`${BASE}/v1/accounts`, () => HttpResponse.json(body, { status, headers })));
    return run.accounts(context().ctx).then(() => null, (error: CliError) => error);
  };

  it('maps a refused key, a slow-down and a refusal to words and exit codes', async () => {
    expect(await failing(401, { code: 'unauthorized', message: 'No such key.', details: {} })).toMatchObject({ exit: EXIT.key, message: 'No such key.' });
    const slow = await failing(429, { code: 'too_many_requests', message: 'Too many asks.', details: {} }, { 'retry-after': '12' });
    expect(slow).toMatchObject({ exit: EXIT.slowDown });
    expect(slow?.message).toContain('12 seconds');
    expect(await failing(409, { code: 'refused', message: 'This was refused: no.', details: {} })).toMatchObject({ exit: EXIT.refused, message: 'This was refused: no.' });
  });
});

describe('list, rules, cancel', () => {
  it('sends the filters as query words', async () => {
    let url = new URL(BASE);
    server.use(http.get(`${BASE}/v1/posts`, ({ request }) => {
      url = new URL(request.url);
      return HttpResponse.json({ posts: [], total: 0, next_offset: null });
    }));
    const { ctx, lines } = context();
    await run.list(ctx, { network: ['x', 'bluesky'], words: 'launch', limit: '5' });
    expect(url.searchParams.get('network[0]')).toBe('x');
    expect(url.searchParams.get('network[1]')).toBe('bluesky');
    expect(url.searchParams.get('words')).toBe('launch');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(lines[0]).toBe('No posts match.');
  });

  it('prints a network’s rules and cancels a post', async () => {
    server.use(
      http.get(`${BASE}/v1/networks/x/rules`, () => HttpResponse.json({ networks: [{ network: 'x', name: 'X', replies: 'thread', part_gap_ms: 60000, daily_posts: null, account_gap_ms: null, rules: { shortLimit: 280 }, always_asks_first: false }] })),
      http.delete(`${BASE}/v1/posts/p1`, () => HttpResponse.json({ done: true })),
    );
    const { ctx, lines } = context();
    await run.rules(ctx, 'X');
    await run.cancel(ctx, 'p1');
    expect(lines[0]).toContain('shortLimit: 280');
    expect(lines[1]).toBe('Cancelled post p1.');
  });
});

describe('upload', () => {
  it('puts a file on the drop page and waits for the check', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sw-'));
    const file = join(dir, 'a.png');
    await writeFile(file, Buffer.from('not really a picture'));
    const calls: string[] = [];
    let checks = 0;
    server.use(
      http.post(`${BASE}/v1/uploads`, () => {
        checks += 1;
        return HttpResponse.json({
          url: `${BASE}/drop/tok-123456789012345678901`,
          expires_at: 'later',
          max_bytes: 500 * 1024 ** 2,
          dropped: checks < 2 ? [] : [{ media_id: 'm1', file_name: 'a.png', state: checks < 3 ? 'checking' : 'ready', refusal: null }],
        });
      }),
      http.post(`${BASE}/api/drop/start`, async ({ request }) => {
        calls.push('start');
        expect(await request.json()).toMatchObject({ token: 'tok-123456789012345678901', fileName: 'a.png', type: 'image/png' });
        return HttpResponse.json({ mediaId: 'm1', key: 'k1' });
      }),
      http.post(`${BASE}/api/drop/sign`, async ({ request }) => {
        const { request: r } = (await request.json()) as { request: { op: string } };
        calls.push(`sign:${r.op}`);
        return HttpResponse.json({ url: `https://r2.test/${r.op}` });
      }),
      http.post('https://r2.test/start', () => new HttpResponse('<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>')),
      http.put('https://r2.test/part', () => new HttpResponse(null, { headers: { etag: '"e1"' } })),
      http.post('https://r2.test/finish', async ({ request }) => {
        expect(await request.text()).toContain('<ETag>"e1"</ETag>');
        return new HttpResponse('<ok/>');
      }),
      http.post(`${BASE}/api/drop/finish`, () => {
        calls.push('finish');
        return HttpResponse.json({});
      }),
    );
    const { ctx, lines } = context();
    expect(await run.upload({ ...ctx, fetch: (...a) => fetch(...a) }, file)).toBe(EXIT.ok);
    expect(calls).toEqual(['start', 'sign:start', 'sign:part', 'sign:finish', 'finish']);
    expect(lines[0]).toContain('--picture m1');
  });

  it('refuses a file type it does not take', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sw-'));
    const file = join(dir, 'a.txt');
    await writeFile(file, 'x');
    await expect(run.upload(context().ctx, file)).rejects.toMatchObject({ exit: EXIT.usage });
  });
});
