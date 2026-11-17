import createClient from 'openapi-fetch';

import type { paths } from './api.js';
import { CliError, EXIT } from './errors.js';

export const DEFAULT_URL = 'https://sentworth.com';

export type Settings = { key: string; url: string };

export function settingsFrom(
  flags: { key?: string; url?: string },
  env: Record<string, string | undefined> = process.env,
): Settings {
  const key = (flags.key ?? env.SENTWORTH_KEY ?? '').trim();
  if (!key)
    throw new CliError(
      'No key. Make one in Sentworth under Settings, Keys, then give it as SENTWORTH_KEY or --key.',
      EXIT.key,
    );
  const url = (flags.url ?? env.SENTWORTH_URL ?? DEFAULT_URL)
    .trim()
    .replace(/\/+$/, '');
  return { key, url };
}

// A list goes as repeated plain keys (state=a&state=b), the way /openapi.json describes it.
export function querySerializer(query: Record<string, unknown>) {
  const out = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value))
      value.forEach((one) => out.append(name, String(one)));
    else out.append(name, String(value));
  }
  return out.toString();
}

export function makeClient({ key, url }: Settings, fetch?: typeof globalThis.fetch) {
  return createClient<paths>({
    baseUrl: url,
    headers: { authorization: `Bearer ${key}` },
    querySerializer,
    ...(fetch ? { fetch } : {}),
  });
}
export type Client = ReturnType<typeof makeClient>;

type Answer<T> = { data?: T; error?: unknown; response: Response };

type ErrorBody = { message?: unknown; code?: unknown; details?: unknown };

// Turns a refused or failed answer into words and an exit code; a good answer's data comes back typed.
export function unwrap<T>(answer: Answer<T>): T {
  if (answer.data !== undefined && !answer.error) return answer.data;
  const status = answer.response.status;
  const body = (
    answer.error && typeof answer.error === 'object' ? answer.error : {}
  ) as ErrorBody;
  const said = typeof body.message === 'string' ? body.message : '';
  if (status === 401 || status === 403)
    throw new CliError(
      said || 'This key was not accepted. Check it, or make a new one in Settings, under Keys.',
      EXIT.key,
    );
  if (status === 429) {
    const wait = answer.response.headers.get('retry-after');
    throw new CliError(
      `${said || 'Too many asks.'}${wait ? ` Try again in ${wait} seconds.` : ''}`,
      EXIT.slowDown,
    );
  }
  throw new CliError(
    said || `Sentworth answered ${String(status)} and did not say why.`,
    status >= 500 ? EXIT.unreachable : EXIT.refused,
  );
}

// A call that never got an answer: the address is wrong or there is no connection.
export async function reaching<T>(url: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      `Could not reach ${url}. Check the address and the connection, then try again.`,
      EXIT.unreachable,
    );
  }
}
