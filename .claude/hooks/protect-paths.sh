#!/usr/bin/env bash
# PreToolUse hook: block agent edits to secrets and lock files.
#   - .env / .env.local / .env.* hold the Supabase keys (anon is public, but
#     service-role must never leak; see CLAUDE.md). .env.example is allowed.
#   - lock files should change only via the package manager, not hand edits.
# Exit 2 blocks the tool call and surfaces the message to Claude.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')

[ -z "$file" ] && exit 0
base=$(basename "$file")

case "$base" in
	.env.example)
		exit 0
		;;
	.env | .env.* | bun.lock | bun.lockb | package-lock.json | pnpm-lock.yaml | yarn.lock)
		echo "BLOCKED: '$base' is a protected file (secrets or lockfile)." >&2
		echo "Edit it manually if this is truly intended — do not modify it through the agent." >&2
		exit 2
		;;
esac

exit 0
