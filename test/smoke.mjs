// Spawns the built server over stdio and exercises every tool without an API key.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const env = { ...process.env };
delete env.ZEROUTER_API_KEY;
const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"], env, stderr: "pipe" });
const client = new Client({ name: "zerouter-smoke", version: "0.0.0" });
await client.connect(transport);

let failures = 0;
const check = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) failures++; };
const text = (r) => r.content?.map((c) => c.text).join("\n") ?? "";

const info = client.getServerVersion();
check(info?.name === "zerouter-mcp", `server info: ${info?.name} ${info?.version}`);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
check(JSON.stringify(names) === JSON.stringify(["chat", "compare_models", "get_pricing", "list_models"]), `tools/list -> ${names.join(", ")}`);

const pricing = await client.callTool({ name: "get_pricing", arguments: {} });
const pt = text(pricing);
check(!pricing.isError && /claude-opus-5-5/.test(pt) && /\$\d/.test(pt), `get_pricing (all) -> ${pt.split("\n").filter((l) => l.startsWith("| `")).length} rows`);
console.log(pt.split("\n").slice(0, 6).join("\n"));

const filtered = await client.callTool({ name: "get_pricing", arguments: { model: "gemini" } });
check(!filtered.isError && !/claude/.test(text(filtered)) && /gemini/.test(text(filtered)), "get_pricing filter=gemini");

const models = await client.callTool({ name: "list_models", arguments: {} });
check(!models.isError && /\/v1\/messages/.test(text(models)) && /\/v1\/responses/.test(text(models)) && /\/v1\/chat\/completions/.test(text(models)), "list_models (no key, public catalog)");
console.log(text(models).split("\n").slice(0, 4).join("\n"));

const c = await client.callTool({ name: "chat", arguments: { model: "claude-sonnet-5-5", prompt: "ping" } });
check(c.isError === true && /ZEROUTER_API_KEY is not set/.test(text(c)), `chat without key -> ${text(c).slice(0, 90)}...`);

const cmp = await client.callTool({ name: "compare_models", arguments: { models: ["gpt-6-sol", "gemini-3.8-flash"], prompt: "ping" } });
check(cmp.isError === true && /ZEROUTER_API_KEY is not set/.test(text(cmp)), "compare_models without key -> clear error");

await client.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
