# Installing zerouter-mcp (for AI agents such as Cline)

zerouter-mcp is a local stdio MCP server. It is **not** on npm, so install it from GitHub.

## Requirements
- Node.js 18+ with npm 10+
- Optional: a Zerouter API key (`sk-...`) from https://www.zerouter.ai. Ask the user for it. Without a key, `get_pricing` and `list_models` still work; `chat` and `compare_models` need the key.

## Option A: npx from GitHub (recommended)
Add this to the MCP settings file (for Cline: `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "zerouter": {
      "command": "npx",
      "args": ["-y", "github:ZerouterAI/zerouter-mcp"],
      "env": {
        "ZEROUTER_API_KEY": "sk-xxxx"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

The first start downloads and builds the server (up to about a minute). If the client times out on that first start, run `npx -y github:ZerouterAI/zerouter-mcp < /dev/null` once in a terminal to warm the cache, then reconnect.

## Option B: clone and build
```bash
git clone https://github.com/ZerouterAI/zerouter-mcp.git
cd zerouter-mcp
npm install   # the prepare script builds dist/
```
Then use `"command": "node"` and `"args": ["<absolute path>/zerouter-mcp/dist/index.js"]` with the same `env` block.

## Verify
Call the `get_pricing` tool (no key needed). It should return per-model prices in USD per 1M tokens.
