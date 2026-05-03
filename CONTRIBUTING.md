# Contributing to oak-mcp

Thanks for considering a contribution. `oak-mcp` is the
[Model Context Protocol](https://modelcontextprotocol.io) server that exposes
the [OAK (OnChain Attack Knowledge)](https://onchainattack.org) framework as
queryable tools for AI coding agents.

This document covers contributions to **the MCP server in this repo**.
Contributions to the OAK content itself (Tactics, Techniques, Mitigations,
Software, worked examples) belong in the upstream
[`onchainattack/oak`](https://github.com/onchainattack/oak) repo — see
[Where contributions go](#where-contributions-go) below.

## Where contributions go

| Change | Where it belongs |
|---|---|
| Bug in an MCP tool, missing tool, schema change, new MCP capability (`resources`, `prompts`, …) | This repo (`onchainattack/oak-mcp`) |
| Build, packaging, CI, tests | This repo |
| New / corrected Tactic, Technique, Mitigation, Software, worked example | Upstream `onchainattack/oak` |
| Edits to `data/embedded.json` directly | **Don't.** It's a generated snapshot. Fix upstream and re-run `npm run fetch-data`. |
| Typos in `README.md`, `CONTRIBUTING.md`, etc. | This repo |
| Vulnerability disclosures | See [`SECURITY.md`](./SECURITY.md) |

## Quick start

```bash
git clone git@github.com:onchainattack/oak-mcp.git
cd oak-mcp
npm install        # offline; uses bundled data/embedded.json
npm test           # 12 integration tests via stdio JSON-RPC
npm run dev        # tsx-driven dev loop
```

The MCP server is a single TypeScript file (`src/server.ts`) plus a build-time
data fetcher (`scripts/fetch-data.mjs`). The bundled OAK snapshot lives at
`data/embedded.json` and is committed; you do not need network access to build
or test.

## Refreshing the OAK snapshot

```bash
npm run fetch-data                              # pulls from onchainattack.org
OAK_LOCAL=/path/to/oak npm run fetch-data       # builds against a local OAK clone
```

Always commit the regenerated `data/embedded.json` in the same PR as any change
that depends on new upstream OAK content.

## Coding conventions

- TypeScript strict mode is on. Keep it that way.
- No new runtime dependencies without discussion. The runtime surface is
  intentionally one MCP SDK dep so the package stays small and supply-chain
  exposure stays low.
- Devtime deps (`vitest`, `tsx`, `typescript`, `@types/node`) are fine to bump
  via Dependabot.
- New tools must:
  1. be added to `TOOLS` with a precise `inputSchema`,
  2. have a handler in the `CallToolRequestSchema` switch,
  3. be covered by an integration test in `tests/server.test.ts`,
  4. be documented in the README's tool table.
- Avoid noisy comments. Comments should explain *why*, not *what*.
- Use `console.error` for log output; `stdout` is reserved for MCP framing.

## Testing

`npm test` runs `vitest` against the compiled server with a synthetic snapshot
under `tests/fixtures/embedded.json`. Tests are deterministic and don't depend
on the live OAK content. Add tests under `tests/` for any new tool or non-trivial
helper. Prefer integration tests through the stdio interface — they catch
schema, dispatch, and serialisation regressions in one shot.

## Pull requests

- Branch off `main`, keep PRs small and focused.
- Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- One logical change per PR. If you find yourself writing "and also…" in the
  description, split.
- CI must be green (typecheck + tests on Node 20 and 22) before review.
- Commit messages: `<type>(<scope>): <subject>` (e.g. `feat(search): …`,
  `fix(fetch-data): …`, `chore: …`, `test: …`, `docs: …`).
- Squash-merge is the default; keep the squashed commit message coherent.

## Releases

Releases are tagged and published to npm by maintainers from `main`. Don't bump
`version` in PRs.

## License

Code contributions are licensed under MIT (see `LICENSE`). The bundled OAK
content is licensed CC-BY-SA 4.0 by the OAK project (see `NOTICE`).
