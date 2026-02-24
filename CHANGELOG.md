# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]










## [0.8.0] - 2026-02-24

### Added

- add manualreviewtimeout subcommand
- add manual review reminder and expiry sweep phases
- add kick and ban actions to manual review
- add manual_review_timeout and review_reminded fields
- add verificationkick subcommand to config
- add verification sweep service for auto-kick
- add verification_kick_timeout column and stale verification query
- add VERIFY_KICK color, action type, and default timeout
- add verification_kick_timeout to GuildConfig
- add on-join role management functionality
- add on-join role management functionality

### Changed

- wire up verification sweep on ready and shutdown
- enhance role assignment logic on member join

## [0.7.0] - 2026-02-22

### Added

- add messageCreate event handler for direct message responses
- add @wgtechlabs/log-engine dependency
- add @wgtechlabs/log-engine dependency
- add new challenge button to captcha prompt
- conditionally register commands via REGISTER_COMMANDS env var
- add CAPTCHA preview script for generating images
- add preview captcha script to package.json
- add graceful shutdown on SIGTERM and SIGINT
- add shared typescript interfaces
- add TypeScript types to verification service
- export BOT_VERSION from package.json
- add image captcha and two-phase identity check
- add GitHub Actions workflow for container build

### Changed

- clear stale global commands to avoid shadowing guild commands
- add fontconfig and ttf-dejavu to release stage
- bump release-build-flow-action to v1.1.4
- replace console logging with LogEngine methods
- enhance captcha rendering and response handling
- enhance rendering styles for better readability
- fix randomInt off-by-one in captcha generation
- improve null safety and return errors on escalation
- reply with error when used outside a guild
- add error handling and handle unrecognized interactions
- use pathToFileURL and add error handling in loaders
- handle null targetUser and zero-ms duration edge case
- make canModerate async to safely resolve GuildMember
- use || operator for env var fallbacks
- consolidate column-check logic and add getDatabase helper
- enhance CAPTCHA generation and validation logic
- add scripts/captcha-preview to ignore list
- fix null checks, sync db calls, and remove local formatMs
- add channel type guard and null safety
- use required options and truncate reason string
- remove await from synchronous db calls
- normalize file paths for Windows compatibility
- sync db calls and clean up config on guild leave
- add null safety to sqlite query results
- add insert statement for guild configuration
- harden BOT_VERSION and fix interactionCreate early return
- deduplicate FOOTER and extract paintCanvasNoise helper
- serialize resolution and detect one-time invites
- update dockerfile to use typescript entry point
- migrate entry points to typescript
- migrate commands to typescript
- migrate services to typescript
- migrate handlers and events to typescript
- migrate config, utils, and db layers to typescript
- add typescript config and update tooling
- add bun test script
- refine minimum account age description and validation
- add version footer to verification embeds
- add version footer to config command embeds
- add version footer to shared embed helpers
- change minage option to string format for duration input
- specify exact versions for checkout and release action
- specify exact version for release build action

### Removed

- eliminate user notification on kick command
- eliminate user notification on ban command

### Fixed

- improve readability after Discord image compression

### Security

- add rate limit between verification attempts

## [0.6.0] - 2026-02-22

### Added

- remove on-join role on verify and reject
- auto-assign on-join role when member joins
- add optional on-join role to verification config
- add on_join_role_id to guild config persistence layer
- add on_join_role_id column and bump schema to v4
- add on_join_role_id field to GuildConfig interface

### Changed

- add .claude/ to .gitignore

## [0.5.0] - 2026-02-22

### Added

- add /approve slash command for manual member verification

## [0.4.1] - 2026-02-22

### Changed

- add subcommand detail logs on load and register
- update release-build-flow-action to v1.5.0

## [0.4.0] - 2026-02-22

### Added

- add disabledms and disableinvites config subcommands
- add incident actions service for DM and invite control
- add dm_disabled and invites_disabled fields to guild config

### Changed

- silently ignore DMs instead of replying
- wire incident actions refresh on startup and shutdown

## [0.3.2] - 2026-02-20

### Changed

- change GitHub token to use GH_PAT secret

## [0.3.1] - 2026-02-20

### Changed

- upgrade release-build-flow-action to v1.2.1

## [0.3.0] - 2026-02-20

### Added

- add layered member verification flow
- auto-register slash commands on bot startup

### Changed

- update release build flow version (#2)
- format files for biome lint compliance
- use clientReady event name for discord.js v15 compat

### Fixed

- resolve SQLite strict mode parameter error and deprecation warnings
- ensure database directory exists at runtime before opening SQLite
- remove non-root user to fix volume write permissions on Railway
- use absolute path for SQLite database in container

