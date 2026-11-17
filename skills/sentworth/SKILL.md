---
name: sentworth
description: Schedule, draft, look up and cancel social posts (X, Instagram, TikTok, Facebook, Threads, YouTube, LinkedIn, Bluesky) through Sentworth with the `sentworth` command-line tool. Use when the person asks to post, schedule or draft something to their social accounts, to post a thread, to attach pictures or a video, or to check how a post went.
---

# Sentworth

Sentworth hands posts to the social accounts a person connected. You use it with the `sentworth` command (`npx sentworth`) and the person's key. You never connect accounts, approve posts or touch billing: the person does that in Sentworth.

## Set up

1. The person makes a key in Sentworth under Assistants and programs, then Skill and command line, and runs `npx sentworth` once in their own terminal to paste it. It is saved for every later command. `SENTWORTH_KEY` or `--key` also work. Never ask the person to paste the key to you, and never print or store it yourself.
2. Nothing else to install: run `npx sentworth <command>`. The address is `https://sentworth.com`; `SENTWORTH_URL` changes it.
3. Check it works with `npx sentworth accounts`. "No key" means the person hasn't run `npx sentworth` yet.

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
- `sentworth cancel <id>` cancels a post that has not started sending, the person's own included.

Exit codes: 0 done, 1 refused (the words say why), 2 wrong arguments, 3 key not accepted, 4 slow down (wait the seconds it says), 5 could not reach Sentworth, 6 a post is "Sent, not confirmed".

## Rules you follow

- Sentworth schedules posts to the social accounts a person connected.
- Call `sentworth accounts` first and use its account ids, the person's time zone and the time now.
- Sentworth adds the person's own signatures; never add one.
- If a picture or video is missing, ask the person for it with `sentworth upload`.
- Never hand over again a post that is "Sent, not confirmed": it may already be live.
- A post goes out as handed in.
- Any TikTok or YouTube choice left out takes its default.
- To connect or reconnect an account, the person opens Accounts in Sentworth.
- To learn how a post went, ask at most once a minute.

## Example

A two-part thread to two accounts at 9:30 in the person's time zone:

```
npx sentworth accounts
npx sentworth post --part "We shipped the new editor." --part "Here is what changed:" \
  --account @sentworth_x --account sentworth.bsky.social --at "2026-11-20T09:30"
npx sentworth get <id from the answer>
```

## Each network's rules

Read these before you write for a network. They are generated from Sentworth's own rules; `sentworth rules <network>` prints the same live.

### X (`x`)

- Later parts of a thread go as replies, one after another.
- Gap between parts: 60 seconds.
- Most characters: 280
- Most characters for a long post (accounts that have long posts): 25000
- Most parts in a thread: 25
- Most pictures: 4
- Biggest picture: 5 MB
- Biggest GIF: 15 MB
- Picture types: image/jpeg, image/png, image/webp, image/gif

### Instagram (`instagram`)

- The second part goes as a first comment; later parts are not sent.
- Gap between parts: 60 seconds.
- Most characters: 2200
- Most hashtags: 30
- Most files in a post: 10
- Tallest picture (width over height): 0.8
- Widest picture (width over height): 1.91
- Reel:
  - Shortest video: 3 seconds
  - Longest video: 15 minutes
  - Biggest file: 300 MB
- Story:
  - Longest video: 60 seconds
  - Biggest file: 100 MB
- Posts per account in any 24 hours: 100

### TikTok (`tiktok`)

- One part only: no thread and no first comment.
- This network's accounts for one post go 10 minutes apart.
- Most characters with a video: 2200
- Most characters with photos: 4000
- Most photos: 35
- Shortest video: 3 seconds
- Longest video: 10 minutes
- Posts per account in any 24 hours: 10
- Gap between one video’s accounts: 10 minutes

### Facebook (`facebook`)

- The second part goes as a first comment; later parts are not sent.
- Gap between parts: 60 seconds.
- Most characters: 63206
- Most photos: 10
- Biggest photo: 10 MB
- Biggest video: 1 GB
- Reel:
  - Shortest video: 3 seconds
  - Longest video: 90 seconds

### Threads (`threads`)

- Later parts of a thread go as replies, one after another.
- Gap between parts: 60 seconds.
- Most characters: 500
- Most links: 5
- Most parts in a thread: 25
- Most files in a post: 20
- Biggest picture: 8 MB
- Biggest video: 1 GB
- Longest video: 5 minutes
- Posts per account in any 24 hours: 250

### YouTube (`youtube`)

- One part only: no thread and no first comment.
- Most characters in the title: 100
- Longest description: 5000 bytes
- Biggest video: 1 GB
- Longest video that counts as a Short: 3 minutes

### LinkedIn (`linkedin`)

- The second part goes as a first comment; later parts are not sent.
- Gap between parts: 60 seconds.
- Most characters: 3000
- Most pictures: 20
- Wait before the same text again: 10 minutes

### Bluesky (`bluesky`)

- Later parts of a thread go as replies, one after another.
- Gap between parts: 60 seconds.
- Most characters: 300
- Most bytes of text: 3000 bytes
- Most pictures: 4
- Biggest picture: 2 MB
- Most parts in a thread: 25
