# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `oak_search` now also indexes the embedded markdown bodies (descriptions,
  indicators, detection signals, examples), so natural-language queries that
  hit content rather than metadata return results.
- `oak_search` accepts an optional `kind` parameter (`"tactic" | "technique" |
  "mitigation" | "software"` or an array of those) to scope results.
- `OAK_DATA_PATH` environment variable for pointing the server at an alternative
  embedded snapshot (used by tests; also useful for advanced operators).
- `vitest` integration test suite covering the JSON-RPC contract of every
  tool against a synthetic fixture (`tests/fixtures/embedded.json`).
- GitHub Actions CI workflow running typecheck + tests on Node 20 and 22.
- `data/embedded.json` and `package-lock.json` are now committed; `npm install`
  from a git source no longer requires network access.
- New `build:offline` / `fetch-data:skip-if-present` npm scripts. `prepare`
  now runs the offline build by default; use `npm run fetch-data` to refresh.
- Community scaffolding: `CONTRIBUTING.md`, `SECURITY.md`, `NOTICE`, issue and
  PR templates, Dependabot config.

### Fixed

- `scripts/fetch-data.mjs` no longer leaks the maintainer's local OAK clone
  path into the embedded snapshot. Every `source_file` is now stored as a
  portable relative path (e.g. `tactics/T1-token-genesis.md`) and `data.source`
  is a stable identifier (`"local"` or the BASE URL).

## [0.1.0] — 2026-05-01

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

[Unreleased]: https://github.com/onchainattack/oak-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/onchainattack/oak-mcp/releases/tag/v0.1.0
