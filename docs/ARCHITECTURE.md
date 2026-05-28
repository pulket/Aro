# Architecture

Aro is a Tauri 2 desktop app with a React frontend and Rust backend.

For the full step-by-step runtime flow, see [End-to-End Architecture](END_TO_END_ARCHITECTURE.md).

## Runtime Flow

1. The user opens Aro with `Control + Space`.
2. Rust positions the command window below the front Finder window.
3. React asks Rust for Finder context.
4. Rust uses AppleScript to read selected files, current directory, and visible directory items.
5. React checks for instant actions and local clarification cases.
6. If needed, Rust sends the prompt and Finder context to the selected AI provider.
7. The model returns either `CLARIFY: ...` or one raw shell command.
8. React previews the command and asks Rust for side-effect prediction.
9. If the user confirms, Rust preflights and runs the command with `bash -c`.
10. React displays stdout, stderr, and exit status.

## Frontend

Important files:

- `src/App.tsx` owns the command flow, window sizing, clarification state, preview state, execution state, and memory updates.
- `src/components/CommandInput.tsx` is the main bar UI.
- `src/components/CommandPreview.tsx` shows the generated command and prediction.
- `src/components/ClarificationCard.tsx` collects missing information when Aro cannot safely infer the target.
- `src/components/Settings.tsx` owns provider, safety, personalization, memory, and permission settings.
- `src/lib/instant-actions.ts` handles deterministic shortcuts that do not need an AI call.
- `src/lib/llm-settings.ts` defines provider metadata and default settings.
- `src/lib/memory.ts` stores successful-command patterns locally.

## Backend

Important files:

- `src-tauri/src/lib.rs` registers plugins, global shortcuts, tray behavior, and Tauri commands.
- `src-tauri/src/commands/finder.rs` reads Finder context through AppleScript.
- `src-tauri/src/commands/grok.rs` calls OpenAI-compatible chat completion endpoints.
- `src-tauri/src/commands/predict.rs` classifies likely side effects.
- `src-tauri/src/commands/shell.rs` preflights and executes commands.
- `src-tauri/src/commands/window.rs` positions and hides/shows windows.

## State

Aro stores local settings through `tauri-plugin-store`.

Typical local state includes:

- provider choice
- API keys
- model names
- auto-run preferences
- command history
- local personalization memory

This data is not part of the repository and must not be committed.

## Provider Contract

Most providers use an OpenAI-compatible `/chat/completions` endpoint. Aro sends:

- provider id
- API key if needed
- model
- base URL
- user prompt
- selected files
- current Finder directory
- visible directory items
- personalization prompt

The model must return either:

```text
CLARIFY: one short question
```

or:

```text
one shell command
```

No markdown, no explanation, no leading `$`.

## Security Layers

Aro has multiple safety layers:

- prompt rules that prefer clarification over guessing
- deterministic instant-action checks
- command preview
- side-effect prediction
- Rust preflight before shell execution
- local-only settings storage

The Rust preflight is the final local boundary. UI warnings are useful, but backend refusal is the stronger control.
