# Zentrynel

![GitHub Repo Banner](https://ghrb.waren.build/banner?header=zentrynel+%F0%9F%9B%A1%EF%B8%8F%F0%9F%A4%96&subheader=discord+moderation+bot&bg=5865F2&color=FFFFFF&headerfont=Google+Sans+Code&subheaderfont=Inter&watermarkpos=bottom-right)
<!-- Created with GitHub Repo Banner by Waren Gonzaga: https://ghrb.waren.build -->

A sharding-ready Discord moderation bot with an escalating strike system, built with Bun and discord.js v14. Protect your community with slash commands, automatic escalation, and per-server configuration out of the box.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/PPM7mm?referralCode=dTwT-i&utm_medium=integration&utm_source=template&utm_campaign=generic)

[**Invite Zentrynel to your server**](https://discord.com/oauth2/authorize?client_id=1473211927437119611&permissions=1101659203590&integration_type=0&scope=bot+applications.commands)

## Features

- **Slash commands** — `/warn`, `/mute`, `/kick`, `/ban`, `/purge`, `/warnings`, `/config`.
- **Escalating strike system** — Configurable per-server thresholds that auto-mute, kick, or ban.
- **Sharding-ready** — Separate shard manager and client entry points, scales to thousands of servers.
- **Swappable database** — Abstracted DB layer on `bun:sqlite`, swap to PostgreSQL with one import change.
- **Per-server config** — Each server gets independent settings, log channels, and strike history.

## Setup

```bash
bun install
cp .env.example .env
```

Fill in your `.env`:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
DEV_GUILD_ID=your_test_guild_id  # optional, for instant command registration
```

## Usage

```bash
# Register slash commands (guild-scoped if DEV_GUILD_ID is set)
bun run register

# Start the bot with sharding
bun run start

# Development mode (single shard, hot reload)
bun run dev
```

## Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/warn <user> [reason]` | Moderate Members | Issue a warning |
| `/mute <user> [duration] [reason]` | Moderate Members | Timeout a user |
| `/kick <user> [reason]` | Kick Members | Kick a user |
| `/ban <user> [reason] [delete_messages]` | Ban Members | Ban a user |
| `/purge <amount> [user]` | Manage Messages | Bulk delete messages |
| `/warnings <user>` | Moderate Members | View active warnings |
| `/config view` | Administrator | View server settings |
| `/config logchannel <channel>` | Administrator | Set mod log channel |
| `/config thresholds [mute] [kick] [ban]` | Administrator | Set strike thresholds |
| `/config muteduration <duration>` | Administrator | Set default mute duration |
| `/config reset` | Administrator | Reset to defaults |

## Escalation

Warnings automatically escalate based on per-server thresholds:

| Threshold | Default | Action |
|-----------|---------|--------|
| Mute | 3 warnings | Auto-timeout |
| Kick | 5 warnings | Auto-kick |
| Ban | 7 warnings | Auto-ban |

Server admins can customize these via `/config thresholds`.

## Architecture

```
src/
├── index.js            # ShardingManager entry point
├── bot.js              # Per-shard client
├── commands/           # Slash commands (auto-discovered)
├── events/             # Event handlers (auto-discovered)
├── handlers/           # Command/event loaders, command registrar
├── services/           # Moderation logic, mod log
├── db/                 # Abstracted database layer
├── config/             # Environment, constants
└── utils/              # Logger, embeds, permissions, time parsing
```

## Development

```bash
bun install
bun run dev
bun run lint
bun run format
```

## License

[GPLv3](LICENSE) — WG Tech Labs
