import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ----------------------------------------------------------------------------
// Test harness: spawn the compiled MCP server with a synthetic data fixture
// and drive it over stdio using the JSON-RPC framing the protocol uses.
// ----------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const serverPath = path.join(repoRoot, "dist", "server.js");
const fixturePath = path.join(here, "fixtures", "embedded.json");

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

class McpHarness {
  private proc!: ChildProcessWithoutNullStreams;
  private buf = "";
  private nextId = 1;
  private pending = new Map<number, (msg: JsonRpcResponse) => void>();

  async start(): Promise<void> {
    this.proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, OAK_DATA_PATH: fixturePath },
    });
    this.proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk.toString("utf8")));
    this.proc.stderr.on("data", () => {
      /* swallow startup banner */
    });
    await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "oak-mcp-tests", version: "0" },
    });
  }

  async stop(): Promise<void> {
    this.proc.kill();
    await new Promise<void>((resolve) => this.proc.once("exit", () => resolve()));
  }

  call(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      this.pending.set(id, resolve);
      this.proc.stdin.write(req, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP call ${method} (id ${id}) timed out after 5s`));
        }
      }, 5000);
    });
  }

  async toolCall(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const res = await this.call("tools/call", { name, arguments: args });
    if (res.error) throw new Error(`${name} → ${res.error.message}`);
    const content = (res.result as { content: Array<{ type: string; text: string }> }).content;
    const text = content[0]?.text ?? "";
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        const cb = this.pending.get(msg.id);
        if (cb) {
          this.pending.delete(msg.id);
          cb(msg);
        }
      } catch {
        // non-JSON lines are protocol noise; ignore
      }
    }
  }
}

let harness: McpHarness;

beforeAll(async () => {
  harness = new McpHarness();
  await harness.start();
}, 10000);

afterAll(async () => {
  if (harness) await harness.stop();
});

describe("oak-mcp server (stdio JSON-RPC)", () => {
  it("advertises the documented tool surface", async () => {
    const res = await harness.call("tools/list");
    const tools = (res.result as { tools: Array<{ name: string }> }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "oak_dataset_info",
      "oak_find_mitigations_for_technique",
      "oak_find_relationships",
      "oak_find_software_for_technique",
      "oak_get_mitigation",
      "oak_get_software",
      "oak_get_tactic",
      "oak_get_technique",
      "oak_list_techniques",
      "oak_search",
    ]);
  });

  it("returns dataset metadata with non-zero counts", async () => {
    const info = (await harness.toolCall("oak_dataset_info")) as {
      counts: Record<string, number>;
      source: string;
    };
    expect(info.source).toBe("test-fixture");
    expect(info.counts.tactics).toBeGreaterThan(0);
    expect(info.counts.techniques).toBeGreaterThan(0);
    expect(info.counts.mitigations).toBeGreaterThan(0);
    expect(info.counts.software).toBeGreaterThan(0);
  });

  it("retrieves a known technique by id with its markdown body", async () => {
    const t = (await harness.toolCall("oak_get_technique", { id: "OAK-T9.005" })) as {
      kind: string;
      id: string;
      name: string;
      body: string;
    };
    expect(t.kind).toBe("technique");
    expect(t.id).toBe("OAK-T9.005");
    expect(t.name).toBe("Reentrancy");
    expect(t.body).toContain("Reentrancy is a class of vulnerability");
  });

  it("rejects oak_get_technique when id is actually a mitigation", async () => {
    const res = await harness.call("tools/call", {
      name: "oak_get_technique",
      arguments: { id: "OAK-M01" },
    });
    const result = res.result as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/mitigation/);
  });

  it("oak_search finds a technique by exact OAK id", async () => {
    const hits = (await harness.toolCall("oak_search", {
      query: "OAK-T9.005",
      limit: 5,
    })) as Array<{ kind: string; id: string }>;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe("technique");
    expect(hits[0].id).toBe("OAK-T9.005");
  });

  it("oak_search finds a technique by alias", async () => {
    const hits = (await harness.toolCall("oak_search", {
      query: "recursive call attack",
      limit: 5,
    })) as Array<{ kind: string; id: string }>;
    expect(hits.some((h) => h.id === "OAK-T9.005")).toBe(true);
  });

  it("oak_find_mitigations_for_technique returns mapped mitigations", async () => {
    const res = (await harness.toolCall("oak_find_mitigations_for_technique", {
      technique_id: "OAK-T9.005",
    })) as { count: number; mitigations: Array<{ id: string; name: string }> };
    expect(res.count).toBe(1);
    expect(res.mitigations[0].id).toBe("OAK-M01");
  });

  it("oak_find_software_for_technique returns observed software", async () => {
    const res = (await harness.toolCall("oak_find_software_for_technique", {
      technique_id: "OAK-T9.005",
    })) as { count: number; software: Array<{ id: string }> };
    expect(res.count).toBe(1);
    expect(res.software[0].id).toBe("OAK-S01");
  });

  it("oak_find_relationships returns the full neighborhood for a technique", async () => {
    const rel = (await harness.toolCall("oak_find_relationships", {
      id: "OAK-T9.005",
    })) as {
      parent_tactics: Array<{ id: string }>;
      incoming_mitigations: Array<{ id: string }>;
      using_software: Array<{ id: string }>;
    };
    expect(rel.parent_tactics.map((t) => t.id)).toContain("OAK-T9");
    expect(rel.incoming_mitigations.map((m) => m.id)).toContain("OAK-M01");
    expect(rel.using_software.map((s) => s.id)).toContain("OAK-S01");
  });

  it("oak_list_techniques honours the tactic filter", async () => {
    const res = (await harness.toolCall("oak_list_techniques", {
      tactic: "OAK-T9",
    })) as { count: number; techniques: Array<{ id: string }> };
    expect(res.count).toBe(1);
    expect(res.techniques[0].id).toBe("OAK-T9.005");
  });

  it("oak_list_techniques returns an empty list for an unknown tactic", async () => {
    const res = (await harness.toolCall("oak_list_techniques", {
      tactic: "OAK-T99",
    })) as { count: number };
    expect(res.count).toBe(0);
  });

  it("returns an MCP error response for an unknown id", async () => {
    const res = await harness.call("tools/call", {
      name: "oak_get_technique",
      arguments: { id: "OAK-T99.999" },
    });
    const result = res.result as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No entry for id/);
  });
});
