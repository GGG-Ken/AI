# Codex Archive

Tracked files in this folder are intended to be safe to push to GitHub:

- `config.redacted.toml`: Codex configuration with local runtime paths and
  sensitive values redacted.
- `AGENTS.md`: Global user instructions.
- `session_index.jsonl`: Thread index containing thread ids, names, and update
  timestamps.

Not tracked:

- raw `auth.json`
- `cap_sid`
- SQLite state/log databases
- raw full session JSONL files
- sandbox secrets
- caches, plugins, runtimes, and temporary files
