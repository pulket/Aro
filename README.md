# Aro

Aro is a Finder-aware command bar for macOS. It sits below your active Finder window, understands the selected files and visible folder items, converts plain English into a shell command through your chosen AI provider, shows the predicted side effects, and asks before risky actions.

Made by Pulkit in India, with love.

![Aro end-to-end architecture](docs/assets/aro-end-to-end-architecture.png)

## Download

The latest macOS build is available from GitHub Releases:

- [Aro v0.2.0](https://github.com/pulket/Aro/releases/tag/v0.2.0)
- Apple Silicon DMG: `Aro_0.2.0_aarch64.dmg`

macOS may show the usual Gatekeeper warning for unsigned open-source builds. Open the app from Finder with right-click, then choose Open.

## Features That Make It Useful

- **Finder-native command bar**: open Aro with `Control + Space` and it appears below the front Finder window, right where the work is happening.
- **Selected-file awareness**: select files in Finder and ask for actions like rename, zip, convert, inspect, count, or organize.
- **Visible-folder awareness**: even when nothing is selected, Aro can see the current Finder folder and ask clarification instead of guessing.
- **Clarification-first AI**: vague prompts like “rename the image” become a question, not a broken command.
- **Command preview**: see the exact shell command before it runs.
- **Side-effect labels**: Aro tells you whether the command is read-only, creates files, modifies files, deletes files, uses network, changes system state, or is unknown.
- **Safety preflight**: risky patterns such as `sudo`, `diskutil`, downloaded shell scripts, broad recursive deletes, and bad `mv` paths are blocked in Rust.
- **Multiple AI providers**: Grok, OpenAI, Gemini, DeepSeek, Local, and Custom providers are available from Settings.
- **DeepSeek v4 flash ready**: DeepSeek defaults to `deepseek-v4-flash`.
- **Local model mode**: use Ollama, LM Studio, or another local OpenAI-compatible server if you do not want API tokens.
- **Personal memory**: Aro learns from successful runs locally, so repeated workflows can become more personalized over time.
- **Auto-run controls**: choose which low-risk categories can run with less friction.
- **Modern macOS UI**: compact glass command bar, focused settings, rounded controls, and clear confirmation states.

## Example Workflows

- `rename this selected file to invoice-final.pdf`
- `zip this folder`
- `convert these images to jpg`
- `count words in this text file`
- `show file type and dimensions`
- `compress these screenshots`
- `rename dolphin.jpg to ocean-reference.jpg`
- `make a folder for these PDFs`

## Why It Exists

Finder is visual, but file operations often become repetitive terminal work: rename this, convert these, zip this folder, count lines, inspect metadata, batch rename a selected set. Aro keeps that workflow near Finder instead of forcing you into a terminal and manual path handling.

The product goal is not to make the shell invisible. The goal is to make shell actions inspectable, contextual, and harder to mess up.

## Who Should Try It

- Mac users who live in Finder and do repeated file cleanup.
- Designers, students, developers, and creators who handle many files every day.
- People who want AI help without handing full control to a black-box agent.
- Local-model users who prefer Ollama or LM Studio over hosted APIs.

## Safety Boundary

Aro is a local command runner. It can change files when you approve a generated command.

Current guardrails:

- Ambiguous targets become clarification questions.
- Commands are previewed before execution unless you opt into safe auto-run categories.
- API keys are stored in the local Tauri app store, not in source files.
- Known high-risk tools and patterns are refused, including `sudo`, `diskutil`, `launchctl`, `pmset`, `osascript`, `dd`, `mkfs`, downloaded scripts piped into a shell, and broad recursive deletion.
- `mv` commands are preflighted for missing sources, missing destination parents, and moving folders into themselves.

Review generated commands before running them, especially commands that modify files.

## Project Structure

```text
Aro/
├── src/                  # React frontend
│   ├── components/       # Command bar, settings, previews, onboarding
│   ├── hooks/            # Finder context, history, provider calls
│   ├── lib/              # LLM settings, instant actions, memory, parsing
│   └── styles/           # Tailwind/global app styling
├── src-tauri/            # Rust/Tauri backend
│   ├── src/commands/     # Finder, shell, LLM, prediction, window commands
│   ├── capabilities/     # Tauri permissions
│   └── icons/            # App icons
├── docs/                 # Architecture, development, release, security notes
├── .github/              # Issues, PR template, CI
├── LICENSE               # MIT
└── SECURITY.md           # Reporting and safety boundary
```

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

Run the frontend build:

```bash
pnpm build
```

Run Rust checks:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Run the desktop app in development:

```bash
pnpm tauri dev
```

Build the macOS app:

```bash
pnpm tauri build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [End-to-End Architecture](docs/END_TO_END_ARCHITECTURE.md)
- [Feature Guide](docs/FEATURES.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Release Process](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## Privacy

Finder context is read locally through macOS Automation. Your prompts, selected file paths, visible folder items, and relevant local memory may be sent to the AI provider you choose. Use Local mode with Ollama or another local OpenAI-compatible server if you do not want hosted API calls.

## License

MIT. See [LICENSE](LICENSE).
