#!/usr/bin/env bash
# PostToolUse hook: format any file Claude edits with the project's Prettier
# config (tabs, single quotes, printWidth 100, svelte + tailwind plugins).
# Keeps every edit compliant without a manual `bun run format`.
# Fast by design: formats only the single changed file, never the whole repo.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

# Only touch file types Prettier handles in this project.
case "$file" in
	*.ts | *.js | *.svelte | *.css | *.json | *.md | *.html) ;;
	*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# --ignore-unknown so an unexpected extension is a no-op, never an error.
# Prettier honours .prettierignore automatically.
bunx prettier --write --ignore-unknown "$file" >/dev/null 2>&1 || true
exit 0
