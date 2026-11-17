# Sentworth for assistants and programs

[Sentworth](https://sentworth.com) schedules posts to the social accounts you connected: X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn and Bluesky. This repository has what lets an assistant or a program hand posts to it:

- `npx sentworth`, a small command-line tool (this package on npm);
- `skills/sentworth/SKILL.md`, a skill that teaches an assistant the tool and each network's rules;
- the Claude Code plugin and its marketplace file, a Cursor `mcp.json` and the Codex line, for the assistant address `https://sentworth.com/mcp`.

Nothing here connects accounts, approves posts or touches billing: you do that in Sentworth.

## The command line

You need a key. In Sentworth, open Settings, then Keys, and make one. Give it to the tool as `SENTWORTH_KEY` (or `--key`):

```sh
export SENTWORTH_KEY=sw_live_…
npx sentworth accounts
```

`SENTWORTH_URL` changes the address (default `https://sentworth.com`). Node 22 or newer.

```sh
# Who can I post to, and when are my usual times?
npx sentworth accounts

# A two-part thread to two accounts, at 9:30 in your time zone
npx sentworth post --part "We shipped the new editor." --part "Here is what changed:" \
  --account @sentworth --network bluesky --at 2026-11-20T09:30

# One post with a picture (a file path, an https address or a media id), at your next usual time
npx sentworth post --text "New screenshots" --picture ./shot.png --network x --next-usual-time

# A draft, to look at in Sentworth first
npx sentworth post --text "Not yet" --network linkedin --draft

# What happened to it
npx sentworth get <id>
npx sentworth list --state did_not_arrive --network x
npx sentworth rules instagram
npx sentworth upload ./clip.mp4
npx sentworth cancel <id>
```

Say where it goes with `--account` (an id or a name), `--network` or `--group`, and when with exactly one of `--at <time>`, `--next-usual-time`, `--now` or `--draft`. With none, or more than one, the tool refuses and sends nothing.

**Retrying.** Every `post` carries a reference. Give `--reference <text>` and run the same command again after a failure: one post is made, not two, and the second answer says "Already handed in". With no `--reference` a fresh one is made and printed, so you can reuse it.

**Sent, not confirmed.** When a network didn't confirm that a post arrived, the tool says so and adds "Don’t hand it over again": it may already be live. Check the network before you retry it.

`--json` prints JSON for a program. Exit codes: 0 done, 1 refused, 2 wrong arguments, 3 key not accepted, 4 slow down, 5 could not reach Sentworth, 6 a post is "Sent, not confirmed".

The calls are typed from [`openapi.json`](openapi.json), the same document Sentworth serves at `https://sentworth.com/openapi.json`.

## Assistants

Assistants that sign in (Claude Code, Cursor, Codex) need no key: you press Allow once in Sentworth.

### Claude Code

```
/plugin marketplace add tsotnebukiya/sentworth
/plugin install sentworth@sentworth
```

The plugin brings the skill and the connector to `https://sentworth.com/mcp`. Run `/mcp`, choose sentworth and sign in. Or only the connector: `claude mcp add --transport http sentworth https://sentworth.com/mcp`.

To use only the skill and a key (no connector), copy `skills/sentworth` to `~/.claude/skills/sentworth` and set `SENTWORTH_KEY`.

### Cursor

Put [`mcp.json`](mcp.json) in your project as `.cursor/mcp.json`, or merge its `sentworth` entry into `~/.cursor/mcp.json`, then sign in when Cursor asks:

```json
{ "mcpServers": { "sentworth": { "url": "https://sentworth.com/mcp" } } }
```

### Codex

```sh
codex mcp add sentworth --url https://sentworth.com/mcp
codex mcp login sentworth
```

## Developing

```sh
pnpm install
pnpm generate    # types from openapi.json, and skills/sentworth/SKILL.md
pnpm check-types && pnpm test && pnpm build
```

`SKILL.md` is generated: the rules come from Sentworth's instructions to assistants and each network's rules, copied into `data/`. Edit `scripts/skill-template.md` or refresh `data/` and `openapi.json` from Sentworth, then run `pnpm generate`. `pnpm check-skill` fails when it is out of date.

Releasing: bump `version` in `package.json` and `.claude-plugin/plugin.json`, tag `vX.Y.Z` and push the tag. The publish job runs `npm publish --provenance` with the `NPM_TOKEN` secret.

MIT licensed.
