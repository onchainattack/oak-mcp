/**
 * data-loader.ts — runtime snapshot loading with platform-cache + TTL.
 *
 * The OAK content snapshot is published at
 * https://onchainattack.org/tools/embedded.json and fetched on demand the
 * first time the server starts up (or after the local cache goes stale).
 * The snapshot is ~7 MB so we cache aggressively:
 *
 *   - First call:           network → write cache → return.
 *   - Within TTL:           cache hit → return immediately.
 *   - After TTL:            re-fetch → write cache → return.
 *   - Network failure +
 *     stale cache present:  serve stale, log warning. Better to ship slightly
 *                           old guidance than to brick the agent.
 *   - Network failure +
 *     no cache:             throw with OAK_MCP_OFFLINE_DATA hint.
 *
 * Environment overrides:
 *   OAK_MCP_OFFLINE_DATA   absolute path to a local embedded.json. If set, no
 *                          network and no cache touch — just read this file.
 *                          Used by tests and air-gapped installs.
 *   OAK_MCP_DATA_URL       override the fetch URL (default
 *                          https://onchainattack.org/tools/embedded.json).
 *   OAK_MCP_CACHE_TTL      cache TTL in seconds (default 86400 = 24h).
 *   OAK_MCP_NO_CACHE=1     bypass the cache for the first load this process.
 *   OAK_MCP_CACHE_DIR      override cache directory.
 *
 * Backwards-compat: the v0.1 OAK_DATA_PATH env var is honoured as an alias
 * for OAK_MCP_OFFLINE_DATA.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import path from "node:path";

export type OakTactic = {
  id: string;
  name: string;
  phase?: string;
  techniques: string[];
  source_file?: string;
};

export type OakTechnique = {
  id: string;
  name: string;
  parent_tactics: string[];
  maturity?: string;
  chains?: string[];
  first_documented?: string;
  aliases?: string[];
  source_file?: string;
};

export type OakMitigation = {
  id: string;
  name: string;
  class?: string;
  audience?: string[];
  maps_to_techniques?: string[];
  source_file?: string;
};

export type OakSoftware = {
  id: string;
  name: string;
  type?: string;
  aliases?: string[];
  used_by_groups?: string[];
  observed_techniques?: string[];
  source_file?: string;
};

export type OakRelationship = { type: string; source: string; target: string };

export type OakBundle = {
  schema_version?: string | number;
  tactics: OakTactic[];
  techniques: OakTechnique[];
  mitigations: OakMitigation[];
  software: OakSoftware[];
  relationships: OakRelationship[];
};

export type EmbeddedData = {
  oak: OakBundle;
  docs: Record<string, string>;
  source: string;
  fetchedAt: string;
};

const DEFAULT_URL = "https://onchainattack.org/tools/embedded.json";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

// Schema versions this server understands. The OAK JSON schema has not bumped
// since the public draft; if the upstream snapshot reports something we don't
// recognise we still serve it but log a warning so the operator notices.
const SUPPORTED_SCHEMA_VERSIONS = new Set(["2"]);

function defaultCacheDir(): string {
  if (process.env.OAK_MCP_CACHE_DIR) return process.env.OAK_MCP_CACHE_DIR;
  const plat = platform();
  if (plat === "win32") {
    const local = process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
    return path.join(local, "oak-mcp", "Cache");
  }
  if (plat === "darwin") {
    return path.join(homedir(), "Library", "Caches", "oak-mcp");
  }
  const xdg = process.env.XDG_CACHE_HOME;
  return xdg ? path.join(xdg, "oak-mcp") : path.join(homedir(), ".cache", "oak-mcp");
}

async function readSnapshotFile(p: string): Promise<EmbeddedData | null> {
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as EmbeddedData;
  } catch {
    return null;
  }
}

async function fetchSnapshot(url: string): Promise<EmbeddedData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status} ${res.statusText}`);
  return (await res.json()) as EmbeddedData;
}

function ageSeconds(d: EmbeddedData): number {
  if (!d.fetchedAt) return Infinity;
  const t = Date.parse(d.fetchedAt);
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, (Date.now() - t) / 1000);
}

function reportSchemaCompatibility(d: EmbeddedData): void {
  const v = d.oak?.schema_version;
  if (v === undefined) {
    console.error("[oak-mcp] warning: snapshot has no schema_version field");
    return;
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.has(String(v))) {
    console.error(
      `[oak-mcp] warning: snapshot schema_version=${v} not in supported set ` +
        `(${[...SUPPORTED_SCHEMA_VERSIONS].join(", ")}). ` +
        `Continuing with best-effort compatibility — consider upgrading oak-mcp.`,
    );
  }
}

let CACHED: EmbeddedData | null = null;

export async function loadData(): Promise<EmbeddedData> {
  if (CACHED) return CACHED;

  // 1. Explicit local file (tests, air-gapped, OAK contributor running locally).
  const offline =
    process.env.OAK_MCP_OFFLINE_DATA ?? process.env.OAK_DATA_PATH;
  if (offline) {
    const data = await readSnapshotFile(path.resolve(offline));
    if (!data) {
      throw new Error(
        `OAK_MCP_OFFLINE_DATA points to ${offline} but the file is missing or not valid JSON.`,
      );
    }
    reportSchemaCompatibility(data);
    CACHED = data;
    return data;
  }

  const url = process.env.OAK_MCP_DATA_URL ?? DEFAULT_URL;
  const ttl = Number(process.env.OAK_MCP_CACHE_TTL ?? DEFAULT_TTL_SECONDS);
  const noCache = process.env.OAK_MCP_NO_CACHE === "1";
  const cacheDir = defaultCacheDir();
  const cachePath = path.join(cacheDir, "snapshot.json");

  // 2. Cache hit + fresh? Use it.
  const cached = noCache ? null : await readSnapshotFile(cachePath);
  if (cached && ageSeconds(cached) < ttl) {
    reportSchemaCompatibility(cached);
    CACHED = cached;
    return cached;
  }

  // 3. Stale or missing — fetch.
  try {
    console.error(`[oak-mcp] fetching ${url}`);
    const fresh = await fetchSnapshot(url);
    fresh.fetchedAt = fresh.fetchedAt ?? new Date().toISOString();
    fresh.source = url;
    reportSchemaCompatibility(fresh);
    try {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cachePath, JSON.stringify(fresh), "utf8");
    } catch (e) {
      console.error(`[oak-mcp] cache write failed (${cachePath}): ${(e as Error).message}`);
    }
    CACHED = fresh;
    return fresh;
  } catch (fetchErr) {
    const fetchMsg = (fetchErr as Error).message;
    // 4. Fetch failed but we have stale cache — serve stale rather than die.
    if (cached) {
      const ageHours = Math.round(ageSeconds(cached) / 3600);
      console.error(
        `[oak-mcp] fetch failed (${fetchMsg}); serving stale cache from ${cachePath} (${ageHours}h old)`,
      );
      CACHED = cached;
      return cached;
    }
    // 5. No cache, no network — give the operator something actionable.
    throw new Error(
      `Failed to load OAK snapshot from ${url}: ${fetchMsg}. ` +
        `No cached snapshot at ${cachePath}. ` +
        `Either restore network access or set OAK_MCP_OFFLINE_DATA=/path/to/embedded.json.`,
    );
  }
}

// Test-only: reset the in-process cache so subsequent loadData() calls
// re-evaluate env vars + filesystem state.
export function _resetForTests(): void {
  CACHED = null;
}
