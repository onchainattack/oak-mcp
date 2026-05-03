# Security Policy

## Reporting a vulnerability

If you've found a security issue in `oak-mcp` itself — the MCP server code, the
build pipeline, or anything that ships in the npm package — please **do not
open a public GitHub issue**.

Instead, report it privately via GitHub's
[private vulnerability reporting](https://github.com/onchainattack/oak-mcp/security/advisories/new)
flow. We aim to respond within **5 business days** with an acknowledgement and
a triage timeline.

When reporting, please include:

- A description of the issue and its security impact.
- Steps to reproduce, ideally a minimal proof-of-concept (`tools/call` payload,
  manipulated `data/embedded.json`, dependency / supply-chain vector, etc.).
- The affected version of `@onchainattack/oak-mcp` and Node.js.
- Whether the issue has been disclosed elsewhere.

We'll credit reporters in the release notes for the fix unless you'd prefer
to remain anonymous.

## Scope

In scope:

- The MCP server in this repo (`src/`, `dist/`).
- The build-time data fetcher (`scripts/fetch-data.mjs`).
- The published npm package (`@onchainattack/oak-mcp`).
- The bundled snapshot pipeline (anything that could let an attacker inject
  content into `data/embedded.json` during build / install).
- CI configuration (`.github/workflows/`).

Out of scope (report to the appropriate upstream):

- Issues in the OAK content itself (claims, attribution, references) →
  [`onchainattack/oak`](https://github.com/onchainattack/oak/issues)
  or [corrections](https://onchainattack.org/CORRECTIONS.md).
- Issues in the Model Context Protocol SDK →
  [`modelcontextprotocol/typescript-sdk`](https://github.com/modelcontextprotocol/typescript-sdk).
- Vulnerabilities in the AI client (Claude Desktop, Cursor, Cline, Zed, …) that
  consumes this server → respective vendor.

## Supported versions

Only the latest minor version published to npm receives security fixes.
`oak-mcp` is currently pre-1.0; expect occasional breaking changes between
minor versions and pin accordingly if you need stability.

## Hardening notes for operators

- The server reads only `data/embedded.json` (or `OAK_DATA_PATH` if set) and
  performs no network I/O at runtime. There is no user-controlled file or URL
  read path.
- All tool inputs are coerced to strings or numbers before use; no `eval`,
  no template-string code paths, no shell-outs.
- The package ships a fixed snapshot per release. If you need fresher content,
  upgrade the package — do not edit `data/embedded.json` in place at the
  consumer.
