# Aro

Aro is a macOS command bar for Finder. It reads the current Finder folder and selected files, turns natural language into a shell command through your chosen model, predicts side effects, and asks before running risky actions.

## What It Does

- Summons below the active Finder window with `Control + Space`.
- Understands selected Finder files and visible items in the current folder.
- Asks clarification instead of inventing file paths such as `the file` or `the image`.
- Shows a command preview and side-effect category before execution.
- Supports Grok, OpenAI, Gemini, DeepSeek, local OpenAI-compatible servers, and custom providers.
- Supports local models through Ollama or LM Studio-compatible endpoints.
- Stores provider settings locally on your Mac.
- Keeps a local memory of successful commands that can be reviewed and deleted.

## Safety Model

Aro is designed for file actions, not system administration.

- API keys are not stored in source files.
- Release archives should not include `.env`, local settings, `node_modules`, build targets, DMGs, or ZIPs.
- Commands with ambiguous file targets are converted into clarification questions.
- Commands using tools such as `sudo`, `diskutil`, `launchctl`, `pmset`, `osascript`, `dd`, and downloaded scripts piped into a shell are refused by the Rust preflight layer.
- `mv` commands are preflighted for missing sources, missing destination parents, and moving folders into themselves.

This is still a local command runner. Review generated commands before running them.

## Development

Prerequisites:

- macOS 13 or later
- Rust
- Node.js
- pnpm
- Tauri CLI

Install dependencies:

```bash
pnpm install
```

Run web build:

```bash
pnpm build
```

Run Tauri development app:

```bash
pnpm tauri dev
```

Build the macOS app:

```bash
pnpm tauri build
```

## Privacy

Finder context is read locally through macOS Automation. Your prompts, file paths, and relevant memory may be sent to the AI provider you select. Use Local mode if you do not want to use hosted API providers.

## License

MIT. See [LICENSE](./LICENSE).
