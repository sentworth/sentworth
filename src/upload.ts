import { open, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import { type Client, unwrap } from './client.js';
import { CliError, EXIT } from './errors.js';

const PART_BYTES = 50 * 1024 ** 2;
const CHECK_EVERY_MS = 2000;
const CHECK_FOR_MS = 120_000;

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

export const typeOf = (path: string) => TYPES[extname(path).toLowerCase()];

type Deps = { client: Client; baseUrl: string; fetch?: typeof globalThis.fetch };

// The drop page's own requests: the token from the link's address is the whole key.
async function drop<T>(deps: Deps, name: string, body: object): Promise<T> {
  const call = deps.fetch ?? fetch;
  const response = await call(`${deps.baseUrl}/api/drop/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: { message?: string; data?: { message?: string } } = {};
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON; the status says enough.
  }
  if (!response.ok)
    throw new CliError(
      json.data?.message ?? json.message ?? `The upload page answered ${String(response.status)}.`,
      EXIT.refused,
    );
  return json as T;
}

async function toStorage(url: string, init: RequestInit, call: typeof fetch) {
  const response = await call(url, init);
  if (!response.ok)
    throw new CliError(`The file’s storage refused part of the upload (${String(response.status)}). Try again.`, EXIT.refused);
  return response;
}

// Puts one file on the person's drop page in 50 MB parts, waits for Sentworth's check, and returns the media id for `post`.
export async function uploadFile(deps: Deps, path: string): Promise<string> {
  const call = deps.fetch ?? fetch;
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) throw new CliError(`There is no file at ${path}.`, EXIT.usage);
  const type = typeOf(path);
  if (!type)
    throw new CliError(`${basename(path)} is not a picture or video type Sentworth takes (png, jpg, gif, webp, mp4, mov, webm).`, EXIT.usage);

  const link = unwrap(await deps.client.POST('/v1/uploads'));
  const token = link.url.split('/').filter(Boolean).pop() ?? '';
  if (info.size > link.max_bytes)
    throw new CliError(`${basename(path)} is bigger than the ${String(Math.round(link.max_bytes / 1024 ** 2))} MB a file can be.`, EXIT.usage);

  const { mediaId, key } = await drop<{ mediaId: string; key: string }>(deps, 'start', {
    token,
    fileName: basename(path),
    type,
    bytes: info.size,
  });
  const sign = async (request: object) =>
    (await drop<{ url: string }>(deps, 'sign', { token, request })).url;

  const started = await toStorage(await sign({ op: 'start', key }), { method: 'POST' }, call);
  const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await started.text())?.[1];
  if (!uploadId) throw new CliError('The file’s storage did not start the upload. Try again.', EXIT.refused);

  const etags: string[] = [];
  const handle = await open(path, 'r');
  try {
    for (let offset = 0, n = 1; offset < info.size || n === 1; offset += PART_BYTES, n += 1) {
      const length = Math.min(PART_BYTES, info.size - offset);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, offset);
      const done = await toStorage(
        await sign({ op: 'part', key, uploadId, partNumber: n }),
        { method: 'PUT', body: buffer },
        call,
      );
      etags.push(done.headers.get('etag') ?? '');
    }
  } finally {
    await handle.close();
  }
  const xml = `<CompleteMultipartUpload>${etags
    .map((tag, i) => `<Part><PartNumber>${String(i + 1)}</PartNumber><ETag>${tag}</ETag></Part>`)
    .join('')}</CompleteMultipartUpload>`;
  await toStorage(await sign({ op: 'finish', key, uploadId }), { method: 'POST', body: xml, headers: { 'content-type': 'application/xml' } }, call);
  await drop(deps, 'finish', { token, mediaId });

  const began = Date.now();
  for (;;) {
    const now = unwrap(await deps.client.POST('/v1/uploads'));
    const file = now.dropped.find((d) => d.media_id === mediaId);
    if (file?.state === 'ready') return mediaId;
    if (file?.state === 'refused')
      throw new CliError(`${basename(path)} was refused: ${file.refusal ?? 'it can’t be used.'}`, EXIT.refused);
    if (Date.now() - began > CHECK_FOR_MS)
      throw new CliError(`Sentworth is still checking ${basename(path)}. Run “sentworth upload” again later to see its state.`, EXIT.refused);
    await new Promise((done) => setTimeout(done, deps.fetch ? 10 : CHECK_EVERY_MS));
  }
}

