# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


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

