// Small, dependency-free client for the Zerouter gateway (https://www.zerouter.ai).

export const VERSION = "0.1.0";
export const SITE_URL = "https://www.zerouter.ai";
const USER_AGENT = `zerouter-mcp/${VERSION} (+https://github.com/ZerouterAI/zerouter-mcp)`;

export function baseUrl(): string {
  return (process.env.ZEROUTER_BASE_URL || "https://api.zerouter.ai").replace(/\/+$/, "").replace(/\/v1$/, "");
}

function timeoutMs(): number {
  const n = Number(process.env.ZEROUTER_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

export class ZerouterError extends Error {}

/** The configured key, ignoring blanks and unexpanded template placeholders like "${user_config.x}". */
export function apiKey(): string {
  const key = (process.env.ZEROUTER_API_KEY || "").trim();
  return key.startsWith("${") ? "" : key;
}

export function requireKey(): string {
  const key = apiKey();
  if (!key) {
    throw new ZerouterError(
      "ZEROUTER_API_KEY is not set. Create a key at https://www.zerouter.ai (Dashboard -> API keys, keys start with sk-) " +
        "and add it to the env block of this MCP server in your client config. " +
        "get_pricing and list_models work without a key."
    );
  }
  return key;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = timeoutMs()): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new ZerouterError(`Request to ${url} timed out after ${ms} ms.`);
    throw new ZerouterError(`Network error calling ${url}: ${e?.message || e}`);
  } finally {
    clearTimeout(t);
  }
}

async function apiJson(path: string, init: RequestInit & { body?: string } = {}): Promise<any> {
  const key = requireKey();
  const res = await fetchWithTimeout(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || data?.raw?.slice?.(0, 300) || res.statusText;
    let hint = "";
    if (res.status === 401) hint = " Check that ZEROUTER_API_KEY is a valid key from https://www.zerouter.ai.";
    if (res.status === 402) hint = " Your Zerouter balance may be empty; top up at https://www.zerouter.ai.";
    if (res.status === 404) hint = " Check the model ID with list_models.";
    throw new ZerouterError(`Zerouter API ${res.status} on ${path}: ${msg}.${hint}`);
  }
  return data;
}

// ---------- routing ----------

export type Endpoint = "messages" | "responses" | "chat_completions";

export const ENDPOINT_PATH: Record<Endpoint, string> = {
  messages: "/v1/messages",
  responses: "/v1/responses",
  chat_completions: "/v1/chat/completions",
};

/** Pick the gateway endpoint for a model ID, following https://www.zerouter.ai/docs/quickstart */
export function routeFor(model: string): Endpoint {
  const m = model.toLowerCase().replace(/^[a-z-]+\//, "");
  if (/(^|[-_])(claude|kimi)|^moonshot/.test(m)) return "messages"; // Anthropic, Moonshot AI
  if (/^(gpt|o\d|codex|grok|chatgpt)/.test(m) || m.includes("codex")) return "responses"; // OpenAI, xAI
  return "chat_completions"; // Gemini and compatible channels (Qwen/Dashscope, DeepSeek, GLM, ...)
}

export function providerFor(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("claude")) return "anthropic";
  if (m.includes("kimi") || m.includes("moonshot")) return "kimi";
  if (/^(gpt|o\d|codex|chatgpt)/.test(m)) return "openai";
  if (m.startsWith("grok")) return "grok";
  if (m.startsWith("gemini")) return "gemini";
  return "api_channel";
}

// ---------- chat ----------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  model: string;
  endpoint: Endpoint;
  text: string;
  usage: { input_tokens: number | null; output_tokens: number | null; total_tokens: number | null };
  latency_ms: number;
  stop_reason?: string | null;
}

export interface ChatParams {
  model: string;
  messages?: ChatMessage[];
  prompt?: string;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  endpoint?: Endpoint | "auto";
}

function num(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function chat(p: ChatParams): Promise<ChatResult> {
  requireKey();
  const msgs: ChatMessage[] = [...(p.messages || [])];
  if (p.prompt) msgs.push({ role: "user", content: p.prompt });
  if (!msgs.length) throw new ZerouterError("Provide either `prompt` or a non-empty `messages` array.");

  const systemParts = [p.system, ...msgs.filter((m) => m.role === "system").map((m) => m.content)].filter(
    (s): s is string => !!s && s.trim().length > 0
  );
  const system = systemParts.join("\n\n") || undefined;
  const turns = msgs.filter((m) => m.role !== "system");
  if (!turns.length) throw new ZerouterError("At least one user message is required.");

  const endpoint: Endpoint = !p.endpoint || p.endpoint === "auto" ? routeFor(p.model) : p.endpoint;
  const started = Date.now();
  let data: any;
  const result = (text: string, inTok: any, outTok: any, total: any, stop: any): ChatResult => {
    const i = num(inTok), o = num(outTok);
    return {
      model: data?.model || p.model,
      endpoint,
      text,
      usage: { input_tokens: i, output_tokens: o, total_tokens: num(total) ?? (i !== null && o !== null ? i + o : null) },
      latency_ms: Date.now() - started,
      stop_reason: stop ?? null,
    };
  };

  if (endpoint === "messages") {
    const body: any = { model: p.model, max_tokens: p.max_tokens ?? 1024, messages: turns };
    if (system) body.system = system;
    if (p.temperature !== undefined) body.temperature = p.temperature;
    data = await apiJson(ENDPOINT_PATH.messages, { method: "POST", body: JSON.stringify(body) });
    const text = (data.content || [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("");
    return result(text, data.usage?.input_tokens, data.usage?.output_tokens, undefined, data.stop_reason);
  }

  if (endpoint === "responses") {
    const body: any = { model: p.model, input: turns.map((m) => ({ role: m.role, content: m.content })) };
    if (system) body.instructions = system;
    if (p.max_tokens !== undefined) body.max_output_tokens = Math.max(16, p.max_tokens);
    if (p.temperature !== undefined) body.temperature = p.temperature;
    data = await apiJson(ENDPOINT_PATH.responses, { method: "POST", body: JSON.stringify(body) });
    let text: string = typeof data.output_text === "string" ? data.output_text : "";
    if (!text && Array.isArray(data.output)) {
      text = data.output
        .flatMap((o: any) => (Array.isArray(o?.content) ? o.content : []))
        .filter((c: any) => c?.type === "output_text" || c?.type === "text")
        .map((c: any) => c.text)
        .join("");
    }
    return result(text, data.usage?.input_tokens, data.usage?.output_tokens, data.usage?.total_tokens, data.status);
  }

  const body: any = {
    model: p.model,
    messages: [...(system ? [{ role: "system", content: system }] : []), ...turns],
  };
  if (p.max_tokens !== undefined) body.max_tokens = p.max_tokens;
  if (p.temperature !== undefined) body.temperature = p.temperature;
  data = await apiJson(ENDPOINT_PATH.chat_completions, { method: "POST", body: JSON.stringify(body) });
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c: any) => c?.text || "").join("") : "";
  return result(text, data.usage?.prompt_tokens, data.usage?.completion_tokens, data.usage?.total_tokens, choice?.finish_reason);
}

// ---------- models ----------

export async function listModelsFromApi(): Promise<string[]> {
  const data = await apiJson("/v1/models", { method: "GET" });
  const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  return arr.map((m: any) => (typeof m === "string" ? m : m?.id || m?.name)).filter(Boolean);
}

// ---------- public pricing (no key) ----------

export interface PriceRow {
  model: string;
  name: string;
  provider: string;
  input_usd_per_1m: number;
  output_usd_per_1m: number;
  list_input_usd_per_1m?: number;
  list_output_usd_per_1m?: number;
  endpoint: string;
  url: string;
}

let priceCache: { at: number; rows: PriceRow[]; source: string } | null = null;
const PRICE_TTL_MS = 60 * 60 * 1000;

function parseLlmsTxt(txt: string): PriceRow[] {
  const rows: PriceRow[] = [];
  const re =
    /^- \[([^\]]+)\]\((https?:\/\/[^)]*\/models\/([^/]+)\/[^)]+)\): model ID `([^`]+)`\. \$([\d.]+) input \/ \$([\d.]+) output per 1M tokens\.(?: Official list price \$([\d.]+) \/ \$([\d.]+))?/gm;
  for (const m of txt.matchAll(re)) {
    const row: PriceRow = {
      model: m[4],
      name: m[1].replace(/ API$/, ""),
      provider: m[3],
      input_usd_per_1m: Number(m[5]),
      output_usd_per_1m: Number(m[6]),
      endpoint: ENDPOINT_PATH[routeFor(m[4])],
      url: m[2],
    };
    if (m[7]) row.list_input_usd_per_1m = Number(m[7]);
    if (m[8]) row.list_output_usd_per_1m = Number(m[8]);
    rows.push(row);
  }
  return rows;
}

function parsePricingHtml(html: string): PriceRow[] {
  const rows: PriceRow[] = [];
  const blocks = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const b of blocks) {
    let json: any;
    try {
      json = JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    } catch {
      continue;
    }
    const graph = Array.isArray(json?.["@graph"]) ? json["@graph"] : [json];
    for (const node of graph) {
      if (node?.["@type"] !== "OfferCatalog") continue;
      for (const offer of node.itemListElement || []) {
        const url: string = offer?.url || "";
        const mm = url.match(/\/models\/([^/]+)\/([^/?#]+)/);
        if (!mm) continue;
        const specs: any[] = offer.priceSpecification || [];
        const find = (k: string) => Number(specs.find((s) => String(s?.unitText || "").includes(k))?.price);
        const input = find("input"), output = find("output");
        if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
        rows.push({
          model: decodeURIComponent(mm[2]),
          name: String(offer.name || mm[2]).replace(/ API$/, ""),
          provider: mm[1],
          input_usd_per_1m: input,
          output_usd_per_1m: output,
          endpoint: ENDPOINT_PATH[routeFor(mm[2])],
          url,
        });
      }
    }
  }
  return rows;
}

export async function getPublicPricing(): Promise<{ rows: PriceRow[]; source: string; cached: boolean }> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return { ...priceCache, cached: true };
  const errors: string[] = [];
  const sources: Array<[string, (t: string) => PriceRow[]]> = [
    [`${SITE_URL}/llms.txt`, parseLlmsTxt],
    [`${SITE_URL}/pricing`, parsePricingHtml],
  ];
  for (const [url, parse] of sources) {
    try {
      const res = await fetchWithTimeout(url, { headers: { Accept: "text/plain, text/html" } }, 20_000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parse(await res.text());
      if (rows.length) {
        priceCache = { at: Date.now(), rows, source: url };
        return { rows, source: url, cached: false };
      }
      errors.push(`${url}: no prices found`);
    } catch (e: any) {
      errors.push(`${url}: ${e?.message || e}`);
    }
  }
  if (priceCache) return { ...priceCache, cached: true };
  throw new ZerouterError(`Could not load public pricing from zerouter.ai (${errors.join("; ")}). See ${SITE_URL}/pricing`);
}
