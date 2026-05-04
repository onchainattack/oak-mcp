# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-05-04

### Changed

- **Runtime fetch with local cache** instead of build-time bundle. The OAK
  content snapshot is now fetched from
  `https://onchainattack.org/tools/embedded.json` on first use and cached
  in the platform cache directory (`~/Library/Caches/oak-mcp` on macOS,
  `${XDG_CACHE_HOME:-~/.cache}/oak-mcp` on Linux,
  `%LOCALAPPDATA%\oak-mcp\Cache` on Windows). Default TTL is 24h, so every
  day you get fresh corpus without re-installing.
- **Stale-cache fallback.** If the upstream is unreachable but a local
  cache exists, the server still starts and serves the stale snapshot
  with a stderr warning. No more brick-on-network-flap.
- **Smaller install.** `data/embedded.json` is no longer bundled. Drops
  the on-disk install size by ~7 MB.
- The `OAK_DATA_PATH` env var is renamed to `OAK_MCP_OFFLINE_DATA` (the
  old name is still honoured as an alias).

### Added

- New env-var surface for runtime control:
  `OAK_MCP_OFFLINE_DATA`, `OAK_MCP_DATA_URL`, `OAK_MCP_CACHE_TTL`,
  `OAK_MCP_NO_CACHE`, `OAK_MCP_CACHE_DIR`. See README "Data freshness".

### Removed

- `npm run fetch-data` and `npm run fetch-data:skip-if-present` — superseded
  by the runtime loader. To run against a local OAK clone, build the
  snapshot in OAK (`npm run site:data`) and point oak-mcp at it via
  `OAK_MCP_OFFLINE_DATA=/path/to/oak/tools/embedded.json`.

## [0.1.0] — 2026-05-01

### Added

- `oak_search` indexes the embedded markdown bodies (descriptions,
  indicators, detection signals, examples), so natural-language queries
  that hit content rather than metadata return results.
- `oak_search` accepts an optional `kind` parameter (`"tactic" | "technique" |
  "mitigation" | "software"` or an array of those) to scope results.
- `OAK_DATA_PATH` environment variable for pointing the server at an alternative
  embedded snapshot (used by tests; also useful for advanced operators).
- `vitest` integration test suite covering the JSON-RPC contract of every
  tool against a synthetic fixture (`tests/fixtures/embedded.json`).
- GitHub Actions CI workflow running typecheck + tests on Node 20 and 22.
- Community scaffolding: `CONTRIBUTING.md`, `SECURITY.md`, `NOTICE`, issue and
  PR templates, Dependabot config.

### Added

- Initial public release.
- 10 MCP tools: `oak_search`, `oak_get_technique`, `oak_get_tactic`,
  `oak_get_mitigation`, `oak_get_software`, `oak_find_mitigations_for_technique`,
  `oak_find_software_for_technique`, `oak_find_relationships`,
  `oak_list_techniques`, `oak_dataset_info`.
- Embedded snapshot of OAK content (Tactics, Techniques, Mitigations,
  Software, relationships, markdown bodies) fetched at build time.
- stdio transport, suitable for Claude Desktop, Cursor, Cline, Zed, and any
  other MCP-aware client.

[Unreleased]: https://github.com/onchainattack/oak-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/onchainattack/oak-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/onchainattack/oak-mcp/releases/tag/v0.1.0
