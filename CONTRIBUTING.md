# Contributing

Thanks for improving Aro. This project is early, so the best contributions are focused, easy to review, and explicit about safety impact.

## Local Setup

```bash
pnpm install
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

For desktop testing:

```bash
pnpm tauri dev
```

## Contribution Rules

- Do not commit API keys, local settings, build output, DMGs, ZIPs, or `node_modules`.
- Keep file-operation safety explicit. If a change expands what commands Aro can run, document the risk and add preflight coverage where practical.
- Prefer clarification over guessing when a file target is vague.
- Keep UI changes consistent with the native macOS-style design system in `src/styles/globals.css`.
- Keep provider integrations OpenAI-compatible unless there is a strong reason to add a provider-specific path.

## Before Opening a PR

Run:

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
rg -n "xai-|sk-|AIza|api_key|apiKey|Bearer" . \
  --glob '!node_modules/**' \
  --glob '!src-tauri/target/**' \
  --glob '!dist/**' \
  --glob '!release/**' \
  --glob '!.git/**'
```

If the secret scan prints real credentials, remove them before committing.

## Pull Request Checklist

- Explain the user-facing change.
- Explain command-execution or privacy impact.
- Include screenshots for UI changes.
- Mention which checks passed locally.
- Avoid unrelated refactors.
