#!/usr/bin/env node
/**
 * oak-mcp — Model Context Protocol server exposing the OAK
 * (OnChain Attack Knowledge) framework as queryable tools for AI coding agents.
 *
 * Embedded data snapshot is fetched at build time from onchainattack.org.
 * The server reads data/embedded.json at startup; no network access at runtime.
 *
 * Usage (Claude Desktop / Cursor / Cline / Zed config):
 *   {
 *     "mcpServers": {
 *       "oak": {
 *         "command": "npx",
 *         "args": ["-y", "@onchainattack/oak-mcp"]
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ----------------------------------------------------------------------------
// Data loading
// ----------------------------------------------------------------------------

type OakTactic = {
  id: string;
  name: string;
  phase?: string;
  techniques: string[];
  source_file?: string;
};

type OakTechnique = {
  id: string;
  name: string;
  parent_tactics: string[];
  maturity?: string;
  chains?: string[];
  first_documented?: string;
  aliases?: string[];
  source_file?: string;
};

type OakMitigation = {
  id: string;
  name: string;
  class?: string;
  audience?: string[];
  maps_to_techniques?: string[];
  source_file?: string;
};

type OakSoftware = {
  id: string;
  name: string;
  type?: string;
  aliases?: string[];
  used_by_groups?: string[];
  observed_techniques?: string[];
  source_file?: string;
};

type OakRelationship = { type: string; source: string; target: string };

type OakBundle = {
  tactics: OakTactic[];
  techniques: OakTechnique[];
  mitigations: OakMitigation[];
  software: OakSoftware[];
  relationships: OakRelationship[];
};

type EmbeddedData = {
  oak: OakBundle;
  docs: Record<string, string>;
  source: string;
  fetchedAt: string;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(here, "..", "data", "embedded.json");

let DATA: EmbeddedData | null = null;

async function loadData(): Promise<EmbeddedData> {
  if (DATA) return DATA;
  const raw = await readFile(DATA_PATH, "utf8");
  DATA = JSON.parse(raw) as EmbeddedData;
  return DATA;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function findDocBody(d: EmbeddedData, sourceFile: string | undefined): string | null {
  if (!sourceFile) return null;
  // source_file may be absolute path from oak.json — strip to relative
  const rel = sourceFile.replace(/^.*\/(tactics|techniques|mitigations|software|actors|data-sources|examples)\//, "$1/");
  return d.docs[rel] ?? d.docs[sourceFile] ?? null;
}

function summarize(text: string, maxChars = 800): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + "\n\n[truncated — call oak_get_* for full content]";
}

function ok(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function err(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

// ----------------------------------------------------------------------------
// Tool definitions
// ----------------------------------------------------------------------------

const TOOLS = [
  {
    name: "oak_search",
    description:
      "Full-text search across OAK Techniques, Mitigations, Software, and Tactics. Returns up to 12 ranked matches with id, name, kind, and one-line summary. Use for 'is there an OAK entry for X?' queries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords (technique name, alias, attacker behaviour, mitigation, software name, threat-actor name, OAK ID)" },
        limit: { type: "number", description: "Max results (default 12, max 30)" },
      },
      required: ["query"],
    },
  },
  {
    name: "oak_get_technique",
    description:
      "Return full Technique entry by OAK-Tn.NNN ID, including parent Tactics, indicators, detection signals, real-world examples, mitigations, citations, and discussion. Use after oak_search confirms a Technique ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "OAK Technique ID, e.g. OAK-T9.001" },
      },
      required: ["id"],
    },
  },
  {
    name: "oak_get_tactic",
    description:
      "Return full Tactic entry by OAK-Tn ID, including all child Techniques and tactic-level framing.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "OAK Tactic ID, e.g. OAK-T9" },
      },
      required: ["id"],
    },
  },
  {
    name: "oak_get_mitigation",
    description:
      "Return full Mitigation entry by OAK-MNN ID, including class (detection / architecture / operational / venue / wallet-UX), target audience, mapped Techniques, and how-it-applies notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "OAK Mitigation ID, e.g. OAK-M07" },
      },
      required: ["id"],
    },
  },
  {
    name: "oak_get_software",
    description:
      "Return full Software entry by OAK-SNN ID. Software covers named tools, kits, and malware families (drainer kits, DPRK malware, ransomware binaries, commodity infostealers, crypto-specific tooling).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "OAK Software ID, e.g. OAK-S01" },
      },
      required: ["id"],
    },
  },
  {
    name: "oak_find_mitigations_for_technique",
    description:
      "Given a Technique ID, return all Mitigations that map to it. Each mitigation includes class, audience, and a one-line summary of how it applies.",
    inputSchema: {
      type: "object",
      properties: {
        technique_id: { type: "string", description: "OAK Technique ID, e.g. OAK-T9.001" },
      },
      required: ["technique_id"],
    },
  },
  {
    name: "oak_find_software_for_technique",
    description:
      "Given a Technique ID, return all Software entries observed to use it. Returns id, name, type, and the threat actors using it.",
    inputSchema: {
      type: "object",
      properties: {
        technique_id: { type: "string", description: "OAK Technique ID, e.g. OAK-T7.001" },
      },
      required: ["technique_id"],
    },
  },
  {
    name: "oak_find_relationships",
    description:
      "Return the full relationship neighborhood of an OAK entity: incoming Mitigations, related Software, related Threat Actors, and child Techniques (for Tactics).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Any OAK ID: OAK-Tn, OAK-Tn.NNN, OAK-MNN, OAK-SNN, OAK-Gnn" },
      },
      required: ["id"],
    },
  },
  {
    name: "oak_list_techniques",
    description:
      "List all OAK Techniques with id, name, parent tactics, maturity, chains. Use for full corpus enumeration. Optional filters: tactic, chain, maturity.",
    inputSchema: {
      type: "object",
      properties: {
        tactic: { type: "string", description: "Filter by parent Tactic ID, e.g. OAK-T9" },
        chain: { type: "string", description: "Filter by chain coverage, e.g. EVM, Solana, cross-chain" },
        maturity: { type: "string", description: "Filter by maturity, e.g. stable, observed, emerging" },
      },
    },
  },
  {
    name: "oak_dataset_info",
    description:
      "Return metadata about the embedded OAK snapshot: counts, source URL, fetch timestamp.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ----------------------------------------------------------------------------
// Tool handlers
// ----------------------------------------------------------------------------

function searchAll(d: EmbeddedData, q: string, limit: number) {
  const needle = q.toLowerCase();
  const results: Array<{ kind: string; id: string; name: string; summary: string; score: number }> = [];

  const score = (s: string) => {
    const lower = s.toLowerCase();
    if (lower === needle) return 100;
    if (lower.startsWith(needle)) return 50;
    if (lower.includes(needle)) return 10;
    return 0;
  };

  for (const t of d.oak.tactics) {
    const sc = score(t.id) + score(t.name) + score(t.phase ?? "");
    if (sc > 0) results.push({ kind: "tactic", id: t.id, name: t.name, summary: t.phase ?? "", score: sc });
  }
  for (const t of d.oak.techniques) {
    let sc = score(t.id) + score(t.name);
    for (const a of t.aliases ?? []) sc += score(a) * 0.8;
    for (const c of t.chains ?? []) sc += score(c) * 0.5;
    if (sc > 0) {
      const aliases = t.aliases?.length ? ` (aliases: ${t.aliases.slice(0, 3).join(", ")})` : "";
      results.push({
        kind: "technique",
        id: t.id,
        name: t.name,
        summary: `${t.maturity ?? "documented"} · ${(t.chains ?? []).join("/")}${aliases}`,
        score: sc,
      });
    }
  }
  for (const m of d.oak.mitigations) {
    const sc = score(m.id) + score(m.name) + score(m.class ?? "");
    if (sc > 0) {
      results.push({
        kind: "mitigation",
        id: m.id,
        name: m.name,
        summary: `${m.class ?? "—"} · maps to ${m.maps_to_techniques?.length ?? 0} techniques`,
        score: sc,
      });
    }
  }
  for (const s of d.oak.software) {
    let sc = score(s.id) + score(s.name) + score(s.type ?? "");
    for (const a of s.aliases ?? []) sc += score(a) * 0.8;
    if (sc > 0) {
      results.push({
        kind: "software",
        id: s.id,
        name: s.name,
        summary: `${s.type ?? "—"}${(s.used_by_groups ?? []).length ? ` · used by ${s.used_by_groups!.join(", ")}` : ""}`,
        score: sc,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score, ...r }) => r);
}

function getEntity(d: EmbeddedData, id: string) {
  if (id.startsWith("OAK-T") && !id.includes(".")) {
    const t = d.oak.tactics.find((x) => x.id === id);
    if (!t) return null;
    return { kind: "tactic", entity: t, body: findDocBody(d, t.source_file) };
  }
  if (id.startsWith("OAK-T") && id.includes(".")) {
    const t = d.oak.techniques.find((x) => x.id === id);
    if (!t) return null;
    return { kind: "technique", entity: t, body: findDocBody(d, t.source_file) };
  }
  if (id.startsWith("OAK-M")) {
    const m = d.oak.mitigations.find((x) => x.id === id);
    if (!m) return null;
    return { kind: "mitigation", entity: m, body: findDocBody(d, m.source_file) };
  }
  if (id.startsWith("OAK-S")) {
    const s = d.oak.software.find((x) => x.id === id);
    if (!s) return null;
    return { kind: "software", entity: s, body: findDocBody(d, s.source_file) };
  }
  return null;
}

function findRelationships(d: EmbeddedData, id: string) {
  const out = {
    id,
    incoming_mitigations: [] as Array<{ id: string; name: string; class?: string }>,
    using_software: [] as Array<{ id: string; name: string; type?: string }>,
    parent_tactics: [] as Array<{ id: string; name: string }>,
    child_techniques: [] as Array<{ id: string; name: string }>,
  };

  if (id.startsWith("OAK-T") && id.includes(".")) {
    const t = d.oak.techniques.find((x) => x.id === id);
    if (!t) return null;
    for (const ptId of t.parent_tactics ?? []) {
      const pt = d.oak.tactics.find((x) => x.id === ptId);
      if (pt) out.parent_tactics.push({ id: pt.id, name: pt.name });
    }
    for (const m of d.oak.mitigations) {
      if ((m.maps_to_techniques ?? []).includes(id)) {
        out.incoming_mitigations.push({ id: m.id, name: m.name, class: m.class });
      }
    }
    for (const s of d.oak.software) {
      if ((s.observed_techniques ?? []).includes(id)) {
        out.using_software.push({ id: s.id, name: s.name, type: s.type });
      }
    }
    return out;
  }

  if (id.startsWith("OAK-T")) {
    const t = d.oak.tactics.find((x) => x.id === id);
    if (!t) return null;
    for (const childId of t.techniques) {
      const tech = d.oak.techniques.find((x) => x.id === childId);
      if (tech) out.child_techniques.push({ id: tech.id, name: tech.name });
    }
    return out;
  }

  if (id.startsWith("OAK-M")) {
    const m = d.oak.mitigations.find((x) => x.id === id);
    if (!m) return null;
    for (const tid of m.maps_to_techniques ?? []) {
      const tech = d.oak.techniques.find((x) => x.id === tid);
      if (tech) out.child_techniques.push({ id: tech.id, name: tech.name });
    }
    return out;
  }

  if (id.startsWith("OAK-S")) {
    const s = d.oak.software.find((x) => x.id === id);
    if (!s) return null;
    for (const tid of s.observed_techniques ?? []) {
      const tech = d.oak.techniques.find((x) => x.id === tid);
      if (tech) out.child_techniques.push({ id: tech.id, name: tech.name });
    }
    return out;
  }

  return null;
}

// ----------------------------------------------------------------------------
// Server setup
// ----------------------------------------------------------------------------

const server = new Server(
  {
    name: "oak-mcp",
    version: "0.1.0",
  },
  {
    capabilities: { tools: {} },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const d = await loadData();
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "oak_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return err("query is required");
        const limit = Math.min(30, Math.max(1, Number(args.limit ?? 12)));
        return ok(searchAll(d, q, limit));
      }

      case "oak_get_technique":
      case "oak_get_tactic":
      case "oak_get_mitigation":
      case "oak_get_software": {
        const id = String(args.id ?? "");
        if (!id) return err("id is required");
        const found = getEntity(d, id);
        if (!found) return err(`No entry for id ${id}`);
        const expectedKind = name.replace("oak_get_", "");
        if (found.kind !== expectedKind) {
          return err(`${id} is a ${found.kind}, not a ${expectedKind} — try oak_get_${found.kind}`);
        }
        return ok({
          kind: found.kind,
          ...found.entity,
          body: found.body ? summarize(found.body, 4000) : "[markdown body not embedded in this snapshot]",
        });
      }

      case "oak_find_mitigations_for_technique": {
        const tid = String(args.technique_id ?? "");
        if (!tid) return err("technique_id is required");
        const matches = d.oak.mitigations
          .filter((m) => (m.maps_to_techniques ?? []).includes(tid))
          .map((m) => ({ id: m.id, name: m.name, class: m.class, audience: m.audience }));
        return ok({ technique_id: tid, count: matches.length, mitigations: matches });
      }

      case "oak_find_software_for_technique": {
        const tid = String(args.technique_id ?? "");
        if (!tid) return err("technique_id is required");
        const matches = d.oak.software
          .filter((s) => (s.observed_techniques ?? []).includes(tid))
          .map((s) => ({ id: s.id, name: s.name, type: s.type, used_by_groups: s.used_by_groups }));
        return ok({ technique_id: tid, count: matches.length, software: matches });
      }

      case "oak_find_relationships": {
        const id = String(args.id ?? "");
        if (!id) return err("id is required");
        const rel = findRelationships(d, id);
        if (!rel) return err(`No entry for id ${id}`);
        return ok(rel);
      }

      case "oak_list_techniques": {
        const tactic = (args.tactic as string | undefined)?.toUpperCase();
        const chain = (args.chain as string | undefined)?.toLowerCase();
        const maturity = (args.maturity as string | undefined)?.toLowerCase();
        const list = d.oak.techniques.filter((t) => {
          if (tactic && !(t.parent_tactics ?? []).some((p) => p.toUpperCase() === tactic)) return false;
          if (chain && !(t.chains ?? []).some((c) => c.toLowerCase().includes(chain))) return false;
          if (maturity && (t.maturity ?? "").toLowerCase() !== maturity) return false;
          return true;
        });
        return ok({
          count: list.length,
          techniques: list.map((t) => ({
            id: t.id,
            name: t.name,
            parent_tactics: t.parent_tactics,
            maturity: t.maturity,
            chains: t.chains,
            aliases: t.aliases,
          })),
        });
      }

      case "oak_dataset_info": {
        return ok({
          source: d.source,
          fetched_at: d.fetchedAt,
          counts: {
            tactics: d.oak.tactics.length,
            techniques: d.oak.techniques.length,
            mitigations: d.oak.mitigations.length,
            software: d.oak.software.length,
            relationships: d.oak.relationships?.length ?? 0,
            embedded_bodies: Object.keys(d.docs).length,
          },
        });
      }

      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e: unknown) {
    return err(`tool ${name} failed: ${(e as Error).message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[oak-mcp] ready · stdio transport · oak v0.1");
