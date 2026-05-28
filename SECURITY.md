# Security

Aro executes local shell commands after generating them from natural-language prompts. Treat it as a local automation tool with meaningful permissions.

## API Keys

Do not commit API keys. Aro stores provider credentials in the local Tauri store, not in the repository.

Before publishing, verify:

```bash
rg -n "xai-|sk-|AIza|api_key|apiKey|Bearer" . --glob '!node_modules/**' --glob '!src-tauri/target/**'
```

## Command Execution Boundary

Aro is intended for Finder file operations. The Rust command runner refuses known system-administration and high-risk patterns, including:

- `sudo`
- `diskutil`
- `launchctl`
- `pmset`
- `osascript`
- `dd`
- `mkfs`
- downloaded scripts piped into `sh`, `bash`, or `zsh`
- broad recursive deletion such as `rm -rf /`

The preflight also checks simple `mv` commands for missing source paths, invalid destinations, and folder self-moves.

## Reporting

Open a GitHub issue with a minimal reproduction, the generated command, and the expected behavior. Do not include real API keys, private file paths, or sensitive command output.
