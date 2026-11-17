import { type MediaArg, isUuid, many, readPostFlags, type PostFlags } from './args.js';
import { type Client, unwrap } from './client.js';
import { EXIT, usage } from './errors.js';
import {
  type Post,
  printAccounts,
  printList,
  printPost,
  printRules,
  printSaved,
  printUpload,
} from './output.js';
import { uploadFile } from './upload.js';

export type Context = {
  client: Client;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  json: boolean;
  print: (text: string) => void;
};

const show = (ctx: Context, data: unknown, words: string) =>
  ctx.print(ctx.json ? JSON.stringify(data, null, 2) : words);

const notConfirmed = (post: Post) =>
  post.do_not_hand_over_again || post.lines.some((l) => l.state === 'not_confirmed');

export async function accounts(ctx: Context) {
  const data = unwrap(await ctx.client.GET('/v1/accounts'));
  show(ctx, data, printAccounts(data));
  return EXIT.ok;
}

// A name or handle works where an id does; the list says which account it means.
async function accountIds(ctx: Context, given: string[]) {
  if (given.every(isUuid)) return given;
  const { accounts: all } = unwrap(await ctx.client.GET('/v1/accounts'));
  return given.map((one) => {
    if (isUuid(one)) return one;
    const wanted = one.toLowerCase().replace(/^@/, '');
    const found = all.filter(
      (a) => a.name.toLowerCase() === wanted || a.name.toLowerCase().replace(/^@/, '') === wanted,
    );
    if (found.length !== 1)
      throw usage(
        found.length
          ? `“${one}” matches more than one account. Use an id from “sentworth accounts”.`
          : `No account is called “${one}”. See “sentworth accounts”.`,
      );
    return (found[0] as (typeof all)[number]).id;
  });
}

async function mediaIds(ctx: Context, media: MediaArg[]) {
  const out: (string | { url: string })[] = [];
  for (const one of media) {
    if (one.kind === 'id') out.push(one.id);
    else if (one.kind === 'url') out.push({ url: one.url });
    else out.push(await uploadFile(ctx, one.path));
  }
  return out;
}

export async function post(ctx: Context, flags: PostFlags) {
  const read = readPostFlags(flags);
  const account_ids = read.accounts.length ? await accountIds(ctx, read.accounts) : undefined;
  const media = await mediaIds(ctx, read.media);
  const words = read.parts.length
    ? {
        parts: read.parts.map((text, i) => ({
          text,
          ...(i === 0 && media.length ? { media } : {}),
        })),
      }
    : { text: read.text, ...(media.length ? { media } : {}) };
  const saved = unwrap(
    await ctx.client.POST('/v1/posts', {
      body: {
        ...words,
        ...(account_ids ? { account_ids } : {}),
        ...(read.networks.length ? { networks: read.networks as never } : {}),
        ...(read.group ? { group: read.group } : {}),
        ...read.time,
        ...(read.madeWithAi ? { made_with_ai: true } : {}),
        reference: read.reference,
      },
    }),
  );
  show(ctx, { reference: read.reference, ...saved }, printSaved(saved, read.reference, read.fresh));
  return notConfirmed(saved.post) ? EXIT.notConfirmed : EXIT.ok;
}

export async function get(ctx: Context, id: string | undefined) {
  if (!id) throw usage('Give the post’s id: sentworth get <id>.');
  const found = unwrap(await ctx.client.GET('/v1/posts/{id}', { params: { path: { id } } }));
  show(ctx, found, printPost(found));
  return notConfirmed(found) ? EXIT.notConfirmed : EXIT.ok;
}

export type ListFlags = {
  tab?: string;
  state?: unknown;
  network?: unknown;
  'made-by'?: unknown;
  words?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
};

const number = (name: string, value: string | undefined) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw usage(`--${name} must be a whole number.`);
  return n;
};

export async function list(ctx: Context, flags: ListFlags) {
  const state = many(flags.state);
  const network = many(flags.network);
  const madeBy = many(flags['made-by']);
  const data = unwrap(
    await ctx.client.GET('/v1/posts', {
      params: {
        query: {
          ...(flags.tab ? { tab: flags.tab as never } : {}),
          ...(state.length ? { state: state as never } : {}),
          ...(network.length ? { network: network as never } : {}),
          ...(madeBy.length ? { made_by: madeBy as never } : {}),
          ...(flags.words ? { words: flags.words } : {}),
          ...(flags.from ? { from: flags.from } : {}),
          ...(flags.to ? { to: flags.to } : {}),
          limit: number('limit', flags.limit),
          offset: number('offset', flags.offset),
        },
      },
    }),
  );
  show(ctx, data, printList(data));
  return EXIT.ok;
}

export async function upload(ctx: Context, file: string | undefined) {
  if (!file) {
    const link = unwrap(await ctx.client.POST('/v1/uploads'));
    show(ctx, link, printUpload(link));
    return EXIT.ok;
  }
  const mediaId = await uploadFile(ctx, file);
  show(ctx, { media_id: mediaId }, `Uploaded and checked. Use it in a post: --picture ${mediaId}`);
  return EXIT.ok;
}

export async function rules(ctx: Context, network: string | undefined) {
  if (!network) throw usage('Name a network: sentworth rules <network>.');
  const data = unwrap(
    await ctx.client.GET('/v1/networks/{network}/rules', {
      params: { path: { network: network.toLowerCase() as never } },
    }),
  );
  show(ctx, data, printRules(data));
  return EXIT.ok;
}

export async function cancel(ctx: Context, id: string | undefined) {
  if (!id) throw usage('Give the post’s id: sentworth cancel <id>.');
  unwrap(await ctx.client.DELETE('/v1/posts/{id}', { params: { path: { id } } }));
  show(ctx, { done: true }, `Cancelled post ${id}.`);
  return EXIT.ok;
}

