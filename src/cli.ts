import { Command, CommanderError } from 'commander';

import { makeClient, reaching, settingsFrom } from './client.js';
import * as run from './commands.js';
import { CliError, EXIT } from './errors.js';

const collect = (value: string, before: string[] = []) => [...before, value];

type Common = { key?: string; url?: string; json?: boolean };

// Plain words on stdout, problems on stderr, and an exit code a program can branch on.
async function go(common: Common, work: (ctx: run.Context) => Promise<number>) {
  try {
    const settings = settingsFrom(common);
    process.exitCode = await reaching(settings.url, () =>
      work({
        client: makeClient(settings),
        baseUrl: settings.url,
        json: Boolean(common.json),
        print: (text) => console.log(text),
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof CliError ? error.exit : EXIT.refused;
  }
}

const withCommon = (command: Command) =>
  command
    .option('--key <key>', 'your key (or set SENTWORTH_KEY)')
    .option('--url <address>', 'Sentworth’s address (or set SENTWORTH_URL; default https://sentworth.com)')
    .option('--json', 'print JSON for a program to read');

const program = new Command('sentworth')
  .description('Schedule posts to your social accounts through Sentworth.')
  .version('0.1.0')
  .addHelpText(
    'after',
    `
Key: SENTWORTH_KEY or --key. Make one in Sentworth under Settings, Keys.
Exit codes: 0 done, 1 refused, 2 wrong arguments, 3 key not accepted, 4 slow down,
5 could not reach Sentworth, 6 a post is "Sent, not confirmed" (don’t hand it over again).`,
  )
  .showHelpAfterError()
  .exitOverride();

withCommon(program.command('accounts').description('List accounts, groups, usual times and your time zone')).action(
  (options: Common) => go(options, (ctx) => run.accounts(ctx)),
);

withCommon(
  program
    .command('post')
    .description('Hand in a post or a thread; say where to and exactly one of --at, --next-usual-time, --now, --draft')
    .option('--text <words>', 'the words of a single post')
    .option('--part <words>', 'one part of a thread; give it more than once, in order', collect)
    .option('--picture <file|https address|media id>', 'a picture or video; more than once for a carousel; goes with the first part', collect)
    .option('--account <id|name>', 'an account; more than once for several', collect)
    .option('--network <network>', 'every account on this network; more than once for several', collect)
    .option('--group <name>', 'a group of accounts')
    .option('--at <time>', 'a time: 2026-11-20T09:30 (in your time zone) or with an offset')
    .option('--time-zone <zone>', 'the zone for --at, such as Asia/Tbilisi')
    .option('--next-usual-time', 'the next of your usual times')
    .option('--now', 'send now')
    .option('--draft', 'save as a draft')
    .option('--reference <text>', 'reuse it to retry safely; one is made and printed when you give none')
    .option('--made-with-ai', 'mark it "made with AI" on the networks that have the label'),
).action((options: Common & Record<string, unknown>) =>
  go(options, (ctx) =>
    run.post(ctx, {
      ...options,
      'next-usual-time': options.nextUsualTime === true,
      'time-zone': options.timeZone as string | undefined,
      'made-with-ai': options.madeWithAi === true,
    }),
  ),
);

withCommon(program.command('get').description('Look up a post').argument('<id>', 'the post’s id')).action(
  (id: string, options: Common) => go(options, (ctx) => run.get(ctx, id)),
);

withCommon(
  program
    .command('list')
    .description('List posts, newest first')
    .option('--tab <tab>', 'all, drafts, attention or sent')
    .option('--state <state>', 'scheduled, arrived, did_not_arrive, not_confirmed, ...; more than once', collect)
    .option('--network <network>', 'only this network; more than once', collect)
    .option('--made-by <who>', 'person, assistant or program; more than once', collect)
    .option('--words <words>', 'words in the text')
    .option('--from <day>', 'first day')
    .option('--to <day>', 'last day')
    .option('--limit <n>', 'posts a page (1 to 100)')
    .option('--offset <n>', 'where the page starts'),
).action((options: Common & Record<string, unknown>) =>
  go(options, (ctx) => run.list(ctx, { ...options, 'made-by': options.madeBy })),
);

withCommon(
  program
    .command('upload')
    .description('Upload a picture or video and print its media id; with no file, show the drop page and what is on it')
    .argument('[file]', 'a picture or video'),
).action((file: string | undefined, options: Common) => go(options, (ctx) => run.upload(ctx, file)));

withCommon(
  program
    .command('rules')
    .description('Print a network’s rules: lengths, files, replies, gaps, daily posts')
    .argument('<network>', 'x, instagram, tiktok, facebook, threads, youtube, linkedin or bluesky'),
).action((network: string, options: Common) => go(options, (ctx) => run.rules(ctx, network)));

withCommon(
  program.command('cancel').description('Cancel a post that has not gone out').argument('<id>', 'the post’s id'),
).action((id: string, options: Common) => go(options, (ctx) => run.cancel(ctx, id)));

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? 0 : EXIT.usage;
  } else throw error;
}
