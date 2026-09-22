#!/usr/bin/env bash
# Re-installs the Claude Code plugins this project uses.
# Plugin marketplaces + enablement live in .claude/settings.json and are picked
# up automatically. This script only covers the extra runtime that claude-mem
# needs, which is not part of the plugin manifest.
set -euo pipefail

echo "==> Verifying plugin marketplaces"
claude plugin marketplace update || true
claude plugin list

echo "==> Setting up claude-mem runtime (local provider, no cloud sync)"
if node "$HOME/.claude/plugins/cache/thedotmack/claude-mem"/*/scripts/version-check.js 2>&1 | grep -q "runtime not yet set up"; then
  npx -y claude-mem@latest install --provider claude
else
  echo "claude-mem runtime already set up, skipping."
fi

echo "==> Done."
