---
name: sentworth
description: Schedule, draft, look up and cancel social posts (X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky) through Sentworth with the `sentworth` command-line tool. Use when the person asks to post, schedule or draft something to their social accounts, to post a thread, to attach pictures or a video, or to check how a post went.
---

# Sentworth

Sentworth hands posts to the social accounts a person connected. You use it with the `sentworth` command (`npx sentworth`) and the person's key. You never connect accounts, approve posts or touch billing: the person does that in Sentworth.

## Set up

1. The person makes a key in Sentworth under Settings, Keys, and gives it to you as the environment variable `SENTWORTH_KEY` (or you pass `--key`). Never print or store the key, and never type it into a file.
2. Nothing to install: run `npx sentworth <command>`. The address is `https://sentworth.com`; `SENTWORTH_URL` changes it.
3. Check it works with `npx sentworth accounts`.

## Commands

Every command takes `--json` for a program to read, and `--key` / `--url`.

- `sentworth accounts` lists the accounts (ids, network, state, groups, usual times), the person's time zone and the time now. Run it first.
- `sentworth post` hands in a post.
  - Words: `--text "…"`, or a thread with `--part "one" --part "two"` (in order).
  - Where: `--account <id or name>`, `--network <x|instagram|…>`, `--group <name>`, each repeatable.
  - Pictures or video: `--picture <file path | https address | media id>`, repeatable for a carousel; they go with the first part. A file path is uploaded for you.
  - When: exactly one of `--at "2026-11-20T09:30"` (with `--time-zone` if not the person's), `--next-usual-time`, `--now` or `--draft`. With none or more than one the command refuses.
  - `--reference <text>`: if the command fails or times out, run it again with the same reference and one post is made, not two. When you give none, a fresh one is made and printed.
  - `--made-with-ai`: only when the person says the post is made with AI.
- `sentworth get <id>` shows a post's state and each account's result.
- `sentworth list` lists posts, newest first (`--tab`, `--state`, `--network`, `--made-by`, `--words`, `--from`, `--to`, `--limit`, `--offset`).
- `sentworth upload <file>` uploads a picture or video and prints its media id.
- `sentworth rules <network>` prints one network's rules.
- `sentworth cancel <id>` cancels a post that has not gone out (only ones made through a key or an assistant).

Exit codes: 0 done, 1 refused (the words say why), 2 wrong arguments, 3 key not accepted, 4 slow down (wait the seconds it says), 5 could not reach Sentworth, 6 a post is "Sent, not confirmed".

## Rules you follow

<!-- RULES -->

## Example

Two-part thread to two accounts, as a draft first:

```
npx sentworth accounts
npx sentworth post --part "We shipped the new editor." --part "Here is what changed:" \
  --account @sentworth_x --account sentworth.bsky.social --at "2026-11-20T09:30"
npx sentworth get <id from the answer>
```

## Each network's rules

Read these before you write for a network. They are generated from Sentworth's own rules; `sentworth rules <network>` prints the same live.

<!-- NETWORKS -->
