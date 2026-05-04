# oak-mcp

Model Context Protocol server exposing the [OAK (OnChain Attack Knowledge)](https://onchainattack.org) framework as queryable tools for AI coding agents.

Plug it into Claude Desktop, Cursor, Cline, Zed, or any other MCP-aware AI environment, and your agent gains structured access to:

- 14 Tactics × 62 Techniques covering crypto attack patterns (token launches, smart-contract exploits, bridge compromises, custody breaches, NFT attacks, account abstraction, validator attacks, plus the full laundering pipeline)
- 40 Mitigations with class / audience / Technique-mapping
- 40 Software entries (drainer kits, DPRK malware families, ransomware binaries, commodity infostealers, crypto-specific tooling)
- 142 worked incident examples spanning 2011–2025 with attribution-strength labels
- 416 machine-readable relationships across the corpus

## Use cases

- **During an audit** — agent asks "is this contract pattern OAK-T1.001 (Modifiable Tax)?" and gets the full Technique definition with detection signals
- **During incident response** — agent looks up which Mitigations apply to a freshly-observed attack class
- **During detection-engineering** — agent enumerates observed indicators for a Technique and emits Forta-/Dune-shaped queries
- **During threat-intel** — agent cross-references a software family against the Technique surface it has been observed using

## Install

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "oak": {
      "command": "npx",
      "args": ["-y", "@onchainattack/oak-mcp"]
    }
  }
}
```

### Cursor

Settings → Features → Model Context Protocol → Add server:

```json
{
  "oak": {
    "command": "npx",
    "args": ["-y", "@onchainattack/oak-mcp"]
  }
}
```

### Cline (VS Code)

Settings → Cline → MCP Servers:

```json
{
  "mcpServers": {
    "oak": {
      "command": "npx",
      "args": ["-y", "@onchainattack/oak-mcp"]
    }
  }
}
```

### Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "oak": {
      "command": {
        "path": "npx",
        "args": ["-y", "@onchainattack/oak-mcp"]
      }
    }
  }
}
```

### From source (development)

```bash
git clone git@github.com:onchainattack/oak-mcp.git
cd oak-mcp
npm install              # runs `prepare` → just tsc, no network
node dist/server.js      # fetches snapshot on first run, caches it
```

To run against a local OAK clone (skip network entirely):

```bash
# from the OAK repo, build a local snapshot:
cd /path/to/oak && npm run site:data

# point oak-mcp at it:
cd /path/to/oak-mcp
OAK_MCP_OFFLINE_DATA=/path/to/oak/tools/embedded.json node dist/server.js
```

## Tools exposed

| Tool | Purpose |
|---|---|
| `oak_search` | Full-text search across Tactics / Techniques / Mitigations / Software (ranked) |
| `oak_get_technique` | Full Technique entry by `OAK-Tn.NNN` |
| `oak_get_tactic` | Full Tactic entry by `OAK-Tn` |
| `oak_get_mitigation` | Full Mitigation entry by `OAK-MNN` |
| `oak_get_software` | Full Software entry by `OAK-SNN` |
| `oak_find_mitigations_for_technique` | All Mitigations mapped to a Technique |
| `oak_find_software_for_technique` | All Software observed using a Technique |
| `oak_find_relationships` | Full relationship neighborhood for any OAK entity |
| `oak_list_techniques` | Enumerate Techniques with optional tactic / chain / maturity filter |
| `oak_dataset_info` | Embedded-snapshot metadata: counts, source, fetch timestamp |

## Data freshness

`@onchainattack/oak-mcp` fetches the OAK content snapshot at runtime from
`https://onchainattack.org/tools/embedded.json` and caches it in your
platform cache directory. The cache TTL is 24h by default, so every day
you get fresh corpus without re-installing the package.

Cache locations:

| Platform | Path |
|---|---|
| macOS | `~/Library/Caches/oak-mcp/snapshot.json` |
| Linux | `${XDG_CACHE_HOME:-~/.cache}/oak-mcp/snapshot.json` |
| Windows | `%LOCALAPPDATA%\oak-mcp\Cache\snapshot.json` |

If the network is down and the cache is stale, the server still starts
and serves the stale snapshot with a warning on stderr. If there is no
cache and the network is down, the server fails to start with a hint to
set `OAK_MCP_OFFLINE_DATA`.

### Environment overrides

| Variable | Effect |
|---|---|
| `OAK_MCP_OFFLINE_DATA` | Absolute path to a local `embedded.json`. Skips network and cache. |
| `OAK_MCP_DATA_URL` | Override the fetch URL (default `https://onchainattack.org/tools/embedded.json`). |
| `OAK_MCP_CACHE_TTL` | Cache TTL in seconds (default `86400` = 24h). |
| `OAK_MCP_NO_CACHE=1` | Bypass the cache for the first load; force re-fetch. |
| `OAK_MCP_CACHE_DIR` | Override the cache directory entirely. |

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for development setup, coding
conventions, and where different kinds of contributions belong (this repo vs.
upstream OAK). Security issues: see [`SECURITY.md`](./SECURITY.md).

## License

The MCP server code is MIT — see `LICENSE`. The bundled OAK content is
licensed CC-BY-SA 4.0 by the OAK project — see [`NOTICE`](./NOTICE) for
attribution requirements and [DISCLAIMER.md](https://onchainattack.org/DISCLAIMER.md).

## Links

- OAK website: <https://onchainattack.org>
- OAK framework repo: <https://github.com/onchainattack/oak>
- This repo: <https://github.com/onchainattack/oak-mcp>
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
- Corrections / takedowns: <https://onchainattack.org/CORRECTIONS.md>
