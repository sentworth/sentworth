import type { operations } from './api.js';

type Ok<Name extends keyof operations> = operations[Name] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;

export type Accounts = Ok<'list_accounts'>;
export type Post = Ok<'get_post'>;
export type Saved = Ok<'create_post'>;
export type PostList = Ok<'list_posts'>;
export type Upload = Ok<'create_upload_link'>;
export type Rules = Ok<'network_rules'>;

export const NOT_CONFIRMED =
  'Sent, not confirmed: it may already be live. Don’t hand it over again.';

const WORDS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  arrived: 'Arrived',
  did_not_arrive: 'Did not arrive',
  not_confirmed: 'Sent, not confirmed',
  will_not_go_out: 'Will not go out',
  paused: 'Paused',
  reconnect: 'Needs the account reconnected',
  waiting_for_yes: 'Waiting for your yes in Sentworth',
};
export const word = (state: string) => WORDS[state] ?? state;

const when = (time: string | null, zone?: string | null) =>
  time ? `${time}${zone ? ` (${zone})` : ''}` : 'no time yet';

export function printPost(post: Post): string {
  const out = [
    `Post ${post.id}: ${word(post.word)}. ${post.time ? `Goes out ${when(post.time, post.time_zone)}.` : 'No time set.'}`,
  ];
  post.parts.forEach((part, index) => {
    const n = post.parts.length > 1 ? `Part ${String(index + 1)}: ` : 'Words: ';
    out.push(`${n}${part.text}${part.media.length ? ` (${String(part.media.length)} file${part.media.length === 1 ? '' : 's'})` : ''}`);
  });
  for (const line of post.lines) {
    const bits = [
      `${line.network}${line.handle ? ` @${line.handle.replace(/^@/, '')}` : ''}`,
      post.parts.length > 1 ? `part ${String(line.part + 1)}` : '',
      word(line.state),
    ].filter(Boolean);
    out.push(
      `  ${bits.join(', ')}${line.link ? `: ${line.link}` : ''}${line.reason ? ` (${line.reason})` : ''}`,
    );
  }
  if (post.note) out.push(post.note);
  if (post.do_not_hand_over_again) out.push(NOT_CONFIRMED);
  return out.join('\n');
}

export function printSaved(saved: Saved, reference: string, fresh: boolean): string {
  const out: string[] = [];
  if (saved.already_made)
    out.push('Already handed in with this reference. Nothing new was made; here is the first answer.');
  else if (saved.saved_as_draft) out.push('Saved as a draft.');
  else if (saved.waiting_for_yes)
    out.push('Handed in. It waits for your yes in Sentworth before it goes.');
  else out.push('Handed in.');
  out.push(printPost(saved.post));
  if (saved.note) out.push(saved.note);
  out.push(
    fresh
      ? `Reference: ${reference} (to retry this exact post, give --reference ${reference}).`
      : `Reference: ${reference}.`,
  );
  return out.join('\n');
}

export function printAccounts(data: Accounts): string {
  const out = [`Time zone: ${data.time_zone}. Time now: ${data.time_now}.`];
  if (!data.accounts.length) out.push('No accounts connected. Connect one under Accounts in Sentworth.');
  for (const a of data.accounts) {
    const extra = [
      a.state === 'broken' ? 'needs reconnecting' : '',
      a.waits_for_yes ? 'waits for your yes' : '',
      a.posts_left_today !== null ? `${String(a.posts_left_today)} posts left today` : '',
      a.groups.length ? `groups: ${a.groups.join(', ')}` : '',
      a.usual_times.length ? `usual times: ${a.usual_times.join(', ')}` : '',
    ].filter(Boolean);
    out.push(`${a.id}  ${a.network}  ${a.name}${extra.length ? `  (${extra.join('; ')})` : ''}`);
  }
  if (data.groups.length)
    out.push(`Groups: ${data.groups.map((g) => `${g.name} (${String(g.account_ids.length)})`).join(', ')}`);
  out.push(`X posts left today: ${String(data.x_posts_left_today)}.${data.tiktok_posts_left_today !== null ? ` TikTok posts left today: ${String(data.tiktok_posts_left_today)}.` : ''}`);
  return out.join('\n');
}

export function printList(data: PostList): string {
  if (!data.posts.length) return 'No posts match.';
  const out = data.posts.map((p) => {
    const where = p.accounts.map((a) => `${a.network}${a.handle ? ` @${a.handle.replace(/^@/, '')}` : ''}`).join(', ');
    const text = p.text.length > 60 ? `${p.text.slice(0, 57)}...` : p.text;
    return `${p.id}  ${word(p.word)}  ${p.time ?? 'no time'}  ${where}  “${text}”${p.do_not_hand_over_again ? '  [Sent, not confirmed: don’t hand it over again]' : ''}`;
  });
  out.push(
    data.next_offset === null
      ? `${String(data.total)} in all.`
      : `${String(data.total)} in all. More: --offset ${String(data.next_offset)}.`,
  );
  return out.join('\n');
}

const HOURS = (ms: number) => (ms >= 3_600_000 ? `${String(ms / 3_600_000)} h` : ms >= 60_000 ? `${String(ms / 60_000)} min` : `${String(ms / 1000)} s`);

export function printRules(data: Rules): string {
  return data.networks
    .map((n) => {
      const out = [`${n.name}`];
      out.push(`  Later parts: ${n.replies === 'thread' ? 'a thread of replies' : n.replies === 'first_comment' ? 'the second part is a first comment' : 'not supported (one part only)'}.`);
      if (n.part_gap_ms) out.push(`  Gap between parts: ${HOURS(n.part_gap_ms)}.`);
      if (n.daily_posts) out.push(`  Posts per account in 24 hours: ${String(n.daily_posts)}.`);
      if (n.account_gap_ms) out.push(`  Gap between this network's accounts: ${HOURS(n.account_gap_ms)}.`);
      if (n.always_asks_first) out.push('  A post from a key always waits for the person’s yes.');
      for (const [name, value] of Object.entries(n.rules))
        out.push(`  ${name}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      return out.join('\n');
    })
    .join('\n\n');
}

export function printUpload(link: Upload): string {
  const out = [`Drop page: ${link.url} (until ${link.expires_at}, up to ${String(Math.round(link.max_bytes / 1024 ** 2))} MB a file).`];
  for (const d of link.dropped)
    out.push(`  ${d.media_id}  ${d.file_name}  ${d.state}${d.refusal ? ` (${d.refusal})` : ''}`);
  return out.join('\n');
}
