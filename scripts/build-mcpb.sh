#!/usr/bin/env bash
# Builds zerouter-mcp.mcpb (MCPB bundle used by Smithery and Claude Desktop one-click install).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rm -rf .mcpb-build && mkdir .mcpb-build
cp -r dist manifest.json package.json package-lock.json README.md LICENSE .mcpb-build/
(cd .mcpb-build && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)
npx -y @anthropic-ai/mcpb@2 validate .mcpb-build/manifest.json
npx -y @anthropic-ai/mcpb@2 pack .mcpb-build zerouter-mcp.mcpb
rm -rf .mcpb-build
echo "Built $(pwd)/zerouter-mcp.mcpb"
