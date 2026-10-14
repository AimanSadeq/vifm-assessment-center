#!/usr/bin/env bash
# Claude Code PreToolUse hook for the Supabase MCP tool mcp__Supabase__execute_sql.
# A read-only query (one SELECT / WITH / EXPLAIN / SHOW / VALUES / TABLE
# statement with nothing that can write, lock or have side effects) runs
# without a permission prompt. Anything else prints nothing, so the normal
# permission prompt applies. Wired up in .claude/settings.json.
set -u
input=$(cat)
q=$(printf '%s' "$input" | jq -r '.tool_input.query // ""' 2>/dev/null) || exit 0
# Drop "--" comments and flatten whitespace so the checks see one line.
q=$(printf '%s\n' "$q" | sed -E 's/--.*$//' | tr '\n\r\t' '   ')
# Prompt when there is a block comment, a dollar-quoted body, a second
# statement, or any keyword that writes, locks, or calls something with side effects.
if printf '%s' "$q" | grep -Eiq '/\*|\$\$|;[[:space:]]*[^[:space:]]|\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|merge|call|do|vacuum|refresh|reindex|cluster|lock|comment|into|set|reset|share|nextval|setval|set_config|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|dblink|notify|listen|unlisten|execute|prepare|deallocate|declare|move|close|begin|commit|rollback|savepoint|abort|start|discard|load|import|checkpoint)\b'; then
  exit 0
fi
if printf '%s' "$q" | grep -Eiq '^[[:space:]]*(select|with|explain|show|values|table)\b'; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"Read-only SQL, allowed by .claude/hooks/supabase-readonly.sh"}}'
fi
exit 0
