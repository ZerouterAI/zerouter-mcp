# Publishing zerouter-mcp

Everything below runs from this folder (`/workspace/zerouter-mcp`). Nothing has been published yet.

- Repo: https://github.com/ZerouterAI/zerouter-mcp
- npm package: `zerouter-mcp` (the name was free on 2026-10-17)
- Registry name (mcpName): `io.github.ZerouterAI/zerouter-mcp`

The order matters. The official registry checks that the npm package exists and that its `package.json` `mcpName` matches. Most directories crawl GitHub, npm or the official registry. So do steps 1 → 2 → 3 first, then submit to the directories.

---

## Listing copy (reuse everywhere)

**Name:** Zerouter MCP

**One-line (≤80 chars):**
AI API gateway MCP for Claude, GPT, Gemini, Grok and Kimi via Zerouter

**Short description / ~160-char blurb:**
One API key for Claude, GPT, Gemini, Grok and Kimi. OpenAI-compatible AI API gateway for Claude Code, Codex and Cursor. Look up API pricing, chat, and compare models through Zerouter.

**Long description (Smithery, Glama, mcp.so, PulseMCP, MCP Market, official registry):**
Zerouter MCP connects Claude Desktop, Cursor, Claude Code and other MCP clients to [Zerouter](https://www.zerouter.ai), an OpenAI-compatible AI API gateway. One API key routes to Claude, GPT, Gemini, Grok and Kimi. Look up API pricing, chat with any model, or compare up to four models side by side with token usage and estimated cost. Claude Opus 5.5 API pricing on Zerouter is $1.16 / $5.81 per 1M tokens (Anthropic list $4 / $20). Works with Claude Code, Codex and Cursor. Tools: `chat`, `compare_models`, `list_models`, and `get_pricing` (pricing works without a key). Owners of official AI accounts can host unused quota through the Zerouter provider program.

**Chinese blurb (Hvoy / 中转站 directories):**
一个 API Key 接入 Claude、GPT、Gemini、Grok、Kimi 等模型。OpenAI 兼容的 AI API 中转站，支持 Claude Code、Codex、Cursor。可查 API 定价、对话与多模型对比，通过 Zerouter 统一接入。

**Chinese title (optional):**
Zerouter | AI API 中转站：Claude、GPT、Gemini 统一接入

**Tags / categories:** AI API, AI API Gateway, API gateway, AI gateway, one API key, API pricing, Claude, GPT, Gemini, Codex, OpenAI, routing, Aggregators, Developer Tools
**Website:** https://www.zerouter.ai
**Install:** `npx -y zerouter-mcp` with env `ZEROUTER_API_KEY=sk-...`
**Icon:** https://www.zerouter.ai/icon.svg

---

## 1. Create the GitHub repo

Use the GitHub CLI, logged in as a member of the ZerouterAI org who can create repos:

```bash
cd /workspace/zerouter-mcp
gh auth login                      # if not already logged in
git init -b main
git add .
git commit -m "zerouter-mcp 0.1.0"
gh repo create ZerouterAI/zerouter-mcp --public \
  --description "AI API gateway MCP for Claude, GPT, Gemini, Grok and Kimi via Zerouter" \
  --homepage "https://www.zerouter.ai" --source . --push
gh repo edit ZerouterAI/zerouter-mcp --add-topic mcp,mcp-server,model-context-protocol,ai-api,ai-gateway,api-gateway,claude,openai,gemini,codex,grok,kimi
```

**glama.json:** this repo belongs to an org, so Glama only lets you claim the listing through `glama.json`. Before you push, change `"ZerouterAI"` in `glama.json` to your **personal** GitHub username, the one you'll sign in to Glama with.

## 2. Publish to npm

```bash
npm login                          # npm account that will own "zerouter-mcp"
npm install
npm run build && npm test          # smoke test: spawns the server, calls every tool
npm publish --access public
npm view zerouter-mcp version      # should print 0.1.0
npx -y zerouter-mcp < /dev/null    # quick sanity check; prints "running on stdio" to stderr
```

## 3. Official MCP Registry: https://registry.modelcontextprotocol.io

```bash
# install mcp-publisher (macOS: brew install mcp-publisher)
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
sudo mv mcp-publisher /usr/local/bin/

mcp-publisher validate             # already passes (checked with v1.8.1)
mcp-publisher login github         # device flow; the account must be a PUBLIC member of the ZerouterAI org
mcp-publisher publish
curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.ZerouterAI/zerouter-mcp"
```

If login gets a permission error for `io.github.ZerouterAI/*`, make your ZerouterAI org membership public at https://github.com/orgs/ZerouterAI/people and log in again.

For later releases, bump `version` in `package.json`, `server.json` (both places), `manifest.json` and `src/zerouter.ts` (`VERSION`). Then run `npm publish` followed by `mcp-publisher publish`.

## 4. Smithery: https://smithery.ai/new

Smithery publishes local stdio servers as an MCPB bundle:

```bash
npm run bundle                     # builds ./zerouter-mcp.mcpb (already tested; 3.1 MB)
npx -y @smithery/cli@latest auth login
npx -y @smithery/cli@latest mcp publish ./zerouter-mcp.mcpb -n zerouterai/zerouter-mcp
```

You can also sign in at https://smithery.ai/new with GitHub, choose the ZerouterAI/zerouter-mcp repo or upload `zerouter-mcp.mcpb`, and paste the listing copy. `smithery.yaml` is in the repo for the GitHub-based flow. Don't put `tools` in `manifest.json`, because Smithery currently rejects bundles that list them.

## 5. Glama: https://glama.ai/mcp/servers

1. Sign in with GitHub at https://glama.ai.
2. On https://glama.ai/mcp/servers, click **Add Server** and enter `https://github.com/ZerouterAI/zerouter-mcp`.
3. When it's indexed (https://glama.ai/mcp/servers/ZerouterAI/zerouter-mcp), click **Claim ownership**. This works only if `glama.json` lists your username (see step 1).
4. In the dashboard, check the Docker settings. The repo includes a `Dockerfile`, and the build arg isn't needed. Glama runs `node dist/index.js`. Without a key, `tools/list`, `get_pricing` and `list_models` all respond, so the server passes Glama's checks and gets a score badge.

## 6. mcp.so: https://mcp.so/submit

Sign in with GitHub or Google. Choose type **MCP Server**. Name: `Zerouter MCP`. URL: `https://github.com/ZerouterAI/zerouter-mcp`. Paste the long description. As server config, paste the Claude Desktop JSON from the README.

## 7. PulseMCP: https://www.pulsemcp.com/submit

PulseMCP picks up the official registry automatically, so it may show up on its own within about a week of step 3. To speed that up, submit `https://github.com/ZerouterAI/zerouter-mcp` on the form above with your email address.

## 8. MCP Market: https://mcpmarket.com/submit

Submit the GitHub URL `https://github.com/ZerouterAI/zerouter-mcp`. Choose the categories Developer Tools and AI/LLM, and paste the short and long descriptions.

## 9. awesome-mcp-servers: https://github.com/punkpeye/awesome-mcp-servers

Wait until the Glama listing exists, because the PR bot checks for the Glama badge. Then:

```bash
gh repo fork punkpeye/awesome-mcp-servers --clone && cd awesome-mcp-servers
git checkout -b add-zerouter-mcp
# Add the line below under "### 🔗 Aggregators", in alphabetical order (Z goes near the end)
git commit -am "Add Zerouter MCP server"
git push -u origin add-zerouter-mcp
gh pr create --repo punkpeye/awesome-mcp-servers --title "Add Zerouter MCP server" \
  --body "Adds ZerouterAI/zerouter-mcp: AI API gateway MCP for Claude, GPT, Gemini, Grok and Kimi via Zerouter. TypeScript, stdio, npx -y zerouter-mcp."
```

Line to add:

```markdown
- [ZerouterAI/zerouter-mcp](https://github.com/ZerouterAI/zerouter-mcp) [![ZerouterAI/zerouter-mcp MCP server](https://glama.ai/mcp/servers/ZerouterAI/zerouter-mcp/badges/score.svg)](https://glama.ai/mcp/servers/ZerouterAI/zerouter-mcp) 📇 ☁️ 🍎 🪟 🐧 - AI API gateway MCP for Claude, GPT, Gemini, Grok and Kimi via [Zerouter](https://www.zerouter.ai): one API key to chat, compare models, and look up API pricing. Works with Claude Code, Codex and Cursor.
```

---

## Checklist

- [ ] `glama.json` maintainer changed to your personal GitHub username
- [ ] GitHub repo created and pushed
- [ ] `npm publish` done
- [ ] `mcp-publisher publish` done
- [ ] Smithery, Glama (claimed), mcp.so, PulseMCP, MCP Market submitted
- [ ] awesome-mcp-servers PR opened
