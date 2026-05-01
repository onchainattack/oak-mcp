#!/usr/bin/env node
/**
 * fetch-data.mjs — pull canonical OAK content from onchainattack.org and embed
 * a snapshot under data/embedded.json. Runs at build time (npm run build).
 *
 * The MCP server reads from this snapshot at runtime, so the package works
 * fully offline once installed. Each oak-mcp release bundles the OAK data
 * snapshot from the moment of release.
 */

import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const BASE = process.env.OAK_BASE ?? "https://onchainattack.org";
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(ROOT, "..", "data");
const OUT_FILE = path.join(OUT_DIR, "embedded.json");

// Allow building from a local OAK clone for development:
//   OAK_LOCAL=/path/to/oak npm run build
const LOCAL = process.env.OAK_LOCAL;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.text();
}

async function readLocalText(rel) {
  return readFile(path.join(LOCAL, rel), "utf8");
}

async function listLocalDir(rel) {
  return (await readdir(path.join(LOCAL, rel))).filter((f) => f.endsWith(".md"));
}

async function loadOak() {
  if (LOCAL) {
    console.error(`[oak-mcp] using local OAK at ${LOCAL}`);
    const oak = JSON.parse(await readLocalText("tools/oak.json"));
    const dirs = ["tactics", "techniques", "examples", "actors", "data-sources", "mitigations", "software"];
    const docs = {};
    for (const d of dirs) {
      const files = await listLocalDir(d);
      for (const f of files) {
        const key = `${d}/${f}`;
        docs[key] = await readLocalText(key);
      }
    }
    const topLevel = ["README.md", "GLOSSARY.md", "TAXONOMY-GAPS.md", "CROSSWALK.md", "PRIOR-ART.md"];
    for (const f of topLevel) {
      try {
        docs[f] = await readLocalText(f);
      } catch {}
    }
    return { oak, docs, source: `local:${LOCAL}` };
  }

  console.error(`[oak-mcp] fetching from ${BASE}`);
  const oak = await fetchJson(`${BASE}/tools/oak.json`);
  const docs = {};

  // Determine document paths from oak.json source-paths + the static-content
  // copy contract from onchainattack.org.
  const docPaths = new Set();

  // Tactic source files use a fixed naming convention; reconstruct from oak.json
  for (const t of oak.tactics ?? []) {
    if (t.source_file) docPaths.add(t.source_file.replace(/^.*\/(tactics\/)/, "$1"));
  }
  for (const t of oak.techniques ?? []) {
    if (t.source_file) docPaths.add(t.source_file.replace(/^.*\/(techniques\/)/, "$1"));
  }
  for (const m of oak.mitigations ?? []) {
    if (m.source_file) docPaths.add(m.source_file.replace(/^.*\/(mitigations\/)/, "$1"));
  }
  for (const s of oak.software ?? []) {
    if (s.source_file) docPaths.add(s.source_file.replace(/^.*\/(software\/)/, "$1"));
  }

  // Top-level docs
  ["README.md", "GLOSSARY.md", "TAXONOMY-GAPS.md", "CROSSWALK.md", "PRIOR-ART.md"].forEach((p) =>
    docPaths.add(p),
  );

  // Examples + actors are listed only by id in oak.json relationship targets.
  // We resolve them later if present in the relationships list, but for the v0.1
  // embedded snapshot we don't need every body — search uses oak.json metadata.

  console.error(`[oak-mcp] fetching ${docPaths.size} markdown bodies…`);
  let fetched = 0;
  for (const p of docPaths) {
    try {
      docs[p] = await fetchText(`${BASE}/${p}`);
      fetched++;
    } catch (e) {
      console.error(`  skip ${p}: ${e.message}`);
    }
  }
  console.error(`[oak-mcp] fetched ${fetched} bodies`);

  return { oak, docs, source: BASE };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const data = await loadOak();
  data.fetchedAt = new Date().toISOString();

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2), "utf8");
  console.error(`[oak-mcp] wrote ${OUT_FILE} (${data.oak.tactics?.length ?? 0} tactics, ${data.oak.techniques?.length ?? 0} techniques, ${Object.keys(data.docs).length} bodies)`);
}

if (existsSync(OUT_FILE) && process.argv.includes("--skip-if-present")) {
  console.error(`[oak-mcp] ${OUT_FILE} exists, skipping fetch`);
} else {
  await main();
}
