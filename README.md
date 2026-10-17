# zerouter-mcp

[![npm](https://img.shields.io/npm/v/zerouter-mcp.svg)](https://www.npmjs.com/package/zerouter-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**AI API gateway MCP for Claude, GPT, Gemini, Grok and Kimi via [Zerouter](https://www.zerouter.ai).**

`zerouter-mcp` connects Claude Desktop, Cursor, Claude Code and other MCP clients to Zerouter, an OpenAI-compatible AI API gateway. With one API key you can chat with any supported model, compare answers side by side, or look up API pricing per 1M tokens, without leaving your editor.

## Why Zerouter

- **One API key for Claude, GPT, Gemini, Grok and Kimi.** The same `sk-` key routes to every model. Zerouter exposes Anthropic-compatible and OpenAI-compatible endpoints, so it works with Claude Code, Codex and Cursor—change the base URL and keep your existing clients.
- **API pricing you can check in chat.** Claude Opus 5.5 on Zerouter is $1.16 input / $5.81 output per 1M tokens (Anthropic list price $4 / $20). Live rates for GPT, Gemini, Grok and Kimi are on the [Zerouter pricing page](https://www.zerouter.ai/pricing).
- **Compare models before you commit.** Send one prompt to 2–4 models in parallel and get each answer with token usage, latency and estimated cost.
- **Stable routing, real models.** The model ID you send is the model that runs and the one you're billed for. Prompts aren't rewritten and models aren't swapped.
- **Host unused subscription quota.** If you have an official AI account with capacity you don't use, the [Zerouter provider program](https://provider.zerouter.ai/docs) routes paid traffic to it and pays you the larger share of each request, currently about 80%, in USDC.

## What it does

| Tool | What it's for | Needs a key? |
|---|---|---|
| `get_pricing` | Current Zerouter API pricing per 1M input/output tokens, next to each vendor's official list price. Filter by model or provider. | No |
| `list_models` | AI model IDs you can call, and which endpoint each one uses. | No (uses `/v1/models` when a key is set) |
| `chat` | Send a prompt or a message list to any model, with optional `system`, `max_tokens` and `temperature`. | Yes |
| `compare_models` | Send the same prompt to 2–4 models in parallel. You get each answer back with token usage, latency and an estimated cost. | Yes |

You don't have to think about API formats. `chat` sends each request to the right Zerouter endpoint for you:

- Claude and Kimi go to `POST /v1/messages` (Anthropic format)
- GPT, Codex and Grok go to `POST /v1/responses` (OpenAI Responses)
- Gemini and the compatible channels (Qwen/Dashscope and others) go to `POST /v1/chat/completions`

If you need to, you can override this with the `endpoint` argument.

## Get a key

1. Sign in at [zerouter.ai](https://www.zerouter.ai) and open the dashboard.
2. Create an API key. Keys start with `sk-` and work for every model.
3. Put it in the `ZEROUTER_API_KEY` environment variable, as in the configs below.

See the [pricing page](https://www.zerouter.ai/pricing) for current API pricing and the [quickstart](https://www.zerouter.ai/docs/quickstart) for setup details.

## Setup

You need Node.js 18 or newer. `npx` downloads and runs the server for you.

### Claude Desktop

Edit `claude_desktop_config.json`. On macOS it's in `~/Library/Application Support/Claude/` and on Windows in `%APPDATA%\Claude\`:

```json
{
  "mcpServers": {
    "zerouter": {
      "command": "npx",
      "args": ["-y", "zerouter-mcp"],
      "env": {
        "ZEROUTER_API_KEY": "sk-xxxx"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

### Cursor

Add this to `~/.cursor/mcp.json` for all projects, or to `.cursor/mcp.json` in a single project:

```json
{
  "mcpServers": {
    "zerouter": {
      "command": "npx",
      "args": ["-y", "zerouter-mcp"],
      "env": {
        "ZEROUTER_API_KEY": "sk-xxxx"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add zerouter --env ZEROUTER_API_KEY=sk-xxxx -- npx -y zerouter-mcp
```

Add `--scope user` to make it available in every project.

### Docker

```bash
docker build -t zerouter-mcp .
docker run -i --rm -e ZEROUTER_API_KEY=sk-xxxx zerouter-mcp
```

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ZEROUTER_API_KEY` | For `chat` and `compare_models` | none | Your key from [zerouter.ai](https://www.zerouter.ai) |
| `ZEROUTER_BASE_URL` | No | `https://api.zerouter.ai` | Change it only if you route through a proxy |
| `ZEROUTER_TIMEOUT_MS` | No | `120000` | Timeout for each request |

If no key is set, `get_pricing` and `list_models` still work. `chat` and `compare_models` return a clear error that tells you where to get a key.

## Example prompts

- "What does Claude Opus 5.5 cost on Zerouter compared with the official API pricing?"
- "Ask gemini-3.8-flash to summarise this file."
- "Compare claude-sonnet-5-5, gpt-6-sol and grok-4.6 on this regex question and tell me which answer is right."
- "Which models on Zerouter cost less than $0.50 per million input tokens?"

## Development

```bash
git clone https://github.com/ZerouterAI/zerouter-mcp.git
cd zerouter-mcp
npm install
npm run build
npm test          # spawns the server over stdio and calls every tool (no key needed)
npx @modelcontextprotocol/inspector node dist/index.js
```

## Links

- Start here: [zerouter.ai](https://www.zerouter.ai) — get a key and see how it works
- Model list: [zerouter.ai/models](https://www.zerouter.ai/models)
- API pricing: [zerouter.ai/pricing](https://www.zerouter.ai/pricing)
- Docs: [zerouter.ai/docs](https://www.zerouter.ai/docs)
- Provider program: [provider.zerouter.ai/docs](https://provider.zerouter.ai/docs)
- Issues: [github.com/ZerouterAI/zerouter-mcp/issues](https://github.com/ZerouterAI/zerouter-mcp/issues)

<!-- mcp-name: io.github.ZerouterAI/zerouter-mcp -->

## License

MIT. Built by the [Zerouter](https://www.zerouter.ai) team.
