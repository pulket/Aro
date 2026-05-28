# Development Guide

## Requirements

- macOS 13 or later
- Rust stable
- Node.js
- pnpm
- Tauri CLI

## Install

```bash
pnpm install
```

## Common Commands

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri dev
pnpm tauri build
```

## Running Aro Locally

Development mode:

```bash
pnpm tauri dev
```

Production build:

```bash
pnpm tauri build
```

Install the local production app:

```bash
rm -rf /Applications/Aro.app
ditto src-tauri/target/release/bundle/macos/Aro.app /Applications/Aro.app
open -a /Applications/Aro.app
```

## Safe Manual Test

Create a harmless test folder:

```bash
mkdir -p "$HOME/Desktop/Aro Test Files"
printf "alpha\nbeta\n" > "$HOME/Desktop/Aro Test Files/list.txt"
printf "notes\n" > "$HOME/Desktop/Aro Test Files/alpha notes.txt"
```

Then in Finder:

1. Open `~/Desktop/Aro Test Files`.
2. Select `alpha notes.txt`.
3. Open Aro with `Control + Space`.
4. Ask: `rename this selected file to alpha-renamed.txt`.
5. Confirm only if the preview is a simple `mv` from the selected file to the new name.

Ambiguity test:

1. Deselect all files.
2. Ask: `rename the image to animal.jpg`.
3. Aro should ask which image, not invent a path.

## Provider Testing

Use a minimal request to confirm the configured provider:

```text
count lines in the selected file
```

For hosted providers, avoid sending private file contents. Aro sends paths and prompt context, not file contents, unless the generated command later reads a file and you choose to run it.

## UI Guidelines

- Keep the command bar compact.
- Prefer native macOS material feel over heavy gradients.
- Use clear controls for risky actions.
- Keep settings readable at narrower window sizes.
- Do not hide primary actions behind hover-only UI.

## Release Build Checks

Before a release:

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

Run a secret scan:

```bash
rg -n "xai-|sk-|AIza|api_key|apiKey|Bearer" . \
  --glob '!node_modules/**' \
  --glob '!src-tauri/target/**' \
  --glob '!dist/**' \
  --glob '!release/**' \
  --glob '!.git/**'
```
