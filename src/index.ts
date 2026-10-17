#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  VERSION,
  SITE_URL,
  ENDPOINT_PATH,
  chat,
  getPublicPricing,
  listModelsFromApi,
  providerFor,
  requireKey,
  apiKey,
  routeFor,
  type ChatResult,
  type PriceRow,
} from "./zerouter.js";

const server = new McpServer(
  { name: "zerouter-mcp", title: "Zerouter", version: VERSION, websiteUrl: SITE_URL },
  {
    instructions:
      "Zerouter (https://www.zerouter.ai) is an AI API gateway: one key for Claude, GPT, Gemini, Grok and Kimi. " +
      "Use list_models or get_pricing to find model IDs, chat to call one model, compare_models to run one prompt on several.",
  }
);

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const fail = (e: unknown): ToolResult => ({
  content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

const usd = (n: number | undefined) => (n === undefined ? "—" : `$${n}`);

function priceTable(rows: PriceRow[]): string {
  const lines = [
    "| Model ID | Name | Provider | Input / 1M | Output / 1M | Official list (in / out) | Endpoint |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const list = r.list_input_usd_per_1m !== undefined ? `${usd(r.list_input_usd_per_1m)} / ${usd(r.list_output_usd_per_1m)}` : "—";
    lines.push(`| \`${r.model}\` | [${r.name}](${r.url}) | ${r.provider} | ${usd(r.input_usd_per_1m)} | ${usd(r.output_usd_per_1m)} | ${list} | ${r.endpoint} |`);
  }
  return lines.join("\n");
}

function estimateCost(r: ChatResult, rows: PriceRow[] | null): number | null {
  const p = rows?.find((x) => x.model === r.model) || rows?.find((x) => r.model.startsWith(x.model));
  if (!p || r.usage.input_tokens === null || r.usage.output_tokens === null) return null;
  return (r.usage.input_tokens * p.input_usd_per_1m + r.usage.output_tokens * p.output_usd_per_1m) / 1_000_000;
}

// ---- get_pricing ----
server.registerTool(
  "get_pricing",
  {
    title: "Get Zerouter pricing",
    description:
      "Public per-model prices on Zerouter in USD per 1M tokens (input/output), next to the official list price. No API key needed. Data comes from https://www.zerouter.ai/pricing.",
    inputSchema: {
      model: z.string().optional().describe("Filter by model ID or name substring, e.g. 'claude' or 'gpt-6'"),
      provider: z
        .string()
        .optional()
        .describe("Filter by provider: anthropic, openai, gemini, grok, kimi"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ model, provider }) => {
    try {
      const { rows, source } = await getPublicPricing();
      let out = rows;
      if (model) {
        const q = model.toLowerCase();
        out = out.filter((r) => r.model.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
      }
      if (provider) out = out.filter((r) => r.provider.toLowerCase().includes(provider.toLowerCase()));
      if (!out.length) return ok(`No models match. ${rows.length} models are listed at ${SITE_URL}/pricing`);
      return ok(
        `Zerouter prices, USD per 1M tokens (source: ${source}). Full table with cache-read rates: ${SITE_URL}/pricing\n\n` +
          priceTable(out)
      );
    } catch (e) {
      return fail(e);
    }
  }
);

// ---- list_models ----
server.registerTool(
  "list_models",
  {
    title: "List Zerouter models",
    description:
      "List model IDs available on Zerouter and the endpoint each one uses. Uses GET /v1/models when ZEROUTER_API_KEY is set, otherwise the public catalog at https://www.zerouter.ai/models.",
    inputSchema: {
      filter: z.string().optional().describe("Optional substring filter, e.g. 'gemini'"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ filter }) => {
    let ids: string[] = [];
    let source = "";
    let note = "";
    if (apiKey()) {
      try {
        ids = await listModelsFromApi();
        source = "GET /v1/models";
      } catch (e) {
        note = `(/v1/models failed: ${e instanceof Error ? e.message : e}; showing public catalog instead)\n`;
      }
    }
    try {
      if (!ids.length) {
        const { rows } = await getPublicPricing();
        ids = rows.map((r) => r.model);
        source = `public catalog, ${SITE_URL}/models`;
      }
      if (filter) ids = ids.filter((id) => id.toLowerCase().includes(filter.toLowerCase()));
      const lines = ids.map((id) => `- \`${id}\` (${providerFor(id)}) -> POST ${ENDPOINT_PATH[routeFor(id)]}`);
      return ok(`${note}${ids.length} models (source: ${source}):\n${lines.join("\n")}`);
    } catch (e) {
      return fail(e);
    }
  }
);

// ---- chat ----
const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

server.registerTool(
  "chat",
  {
    title: "Chat with a model via Zerouter",
    description:
      "Send a prompt or a message list to any Zerouter model (Claude, GPT, Gemini, Grok, Kimi, ...). The request is routed automatically: Claude/Kimi -> /v1/messages, GPT/Grok/Codex -> /v1/responses, Gemini and other models -> /v1/chat/completions. Requires ZEROUTER_API_KEY.",
    inputSchema: {
      model: z.string().min(1).describe("Model ID, e.g. claude-sonnet-5-5, gpt-6-sol, gemini-3.8-flash, grok-4.6, kimi-k3"),
      prompt: z.string().optional().describe("User prompt. Appended after `messages` if both are given."),
      messages: z.array(messageSchema).optional().describe("Conversation history as {role, content} items"),
      system: z.string().optional().describe("Optional system prompt"),
      max_tokens: z.number().int().positive().max(200_000).optional().describe("Max output tokens (default 1024 for Claude/Kimi)"),
      temperature: z.number().min(0).max(2).optional(),
      endpoint: z
        .enum(["auto", "messages", "responses", "chat_completions"])
        .optional()
        .describe("Override routing. Default auto."),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const r = await chat(args);
      const u = r.usage;
      return ok(
        `${r.text || "(empty response)"}\n\n---\nmodel: ${r.model} | endpoint: ${ENDPOINT_PATH[r.endpoint]} | tokens in/out: ${u.input_tokens ?? "?"}/${u.output_tokens ?? "?"} | ${r.latency_ms} ms`
      );
    } catch (e) {
      return fail(e);
    }
  }
);

// ---- compare_models ----
server.registerTool(
  "compare_models",
  {
    title: "Compare models side by side",
    description:
      "Send the same prompt to 2-4 Zerouter models in parallel and return each answer with token usage, latency and estimated cost. Requires ZEROUTER_API_KEY.",
    inputSchema: {
      models: z.array(z.string().min(1)).min(2).max(4).describe("2 to 4 model IDs"),
      prompt: z.string().min(1),
      system: z.string().optional(),
      max_tokens: z.number().int().positive().max(200_000).optional(),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async ({ models, prompt, system, max_tokens }) => {
    try {
      // Fail fast (and only once) when the key is missing.
      requireKey();
      const prices = await getPublicPricing().then((p) => p.rows).catch(() => null);
      const settled = await Promise.allSettled(models.map((model) => chat({ model, prompt, system, max_tokens })));
      const parts = settled.map((s, i) => {
        if (s.status === "rejected") return `## ${models[i]}\nError: ${s.reason instanceof Error ? s.reason.message : s.reason}`;
        const r = s.value;
        const cost = estimateCost(r, prices);
        return (
          `## ${models[i]}\n${r.text || "(empty response)"}\n\n` +
          `tokens in/out: ${r.usage.input_tokens ?? "?"}/${r.usage.output_tokens ?? "?"} | ${r.latency_ms} ms` +
          (cost !== null ? ` | est. cost $${cost.toFixed(6)}` : "")
        );
      });
      const allFailed = settled.every((s) => s.status === "rejected");
      return { content: [{ type: "text", text: parts.join("\n\n") }], ...(allFailed ? { isError: true } : {}) };
    } catch (e) {
      return fail(e);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`zerouter-mcp ${VERSION} running on stdio (${SITE_URL})`);
}

main().catch((e) => {
  console.error("zerouter-mcp failed to start:", e);
  process.exit(1);
});
