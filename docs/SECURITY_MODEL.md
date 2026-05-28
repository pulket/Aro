# Security Model

Aro turns natural-language requests into shell commands. That makes security and predictability core product requirements.

## Trust Boundaries

### Trusted

- Local app source code.
- Rust preflight checks.
- User confirmation.
- macOS privacy prompts and permissions.

### Partially Trusted

- AI provider output.
- Finder context returned by AppleScript.
- Local personalization memory.

### Untrusted

- Model-generated shell commands.
- User-provided prompt text copied from elsewhere.
- File names that may contain spaces, quotes, shell-like text, or confusing names.

## Current Controls

### Prompt Contract

The provider prompt requires either:

- `CLARIFY: one short question`
- one raw shell command

The prompt tells the provider not to invent paths and to ask when targets are vague.

### UI Review

Generated commands are shown before execution unless the user explicitly opts into auto-run for a low-risk category.

### Side-Effect Prediction

Aro classifies commands into broad categories:

- `safe`
- `creates_files`
- `modifies_files`
- `deletes_files`
- `network`
- `system`
- `unknown`

This is a UX layer, not the final security boundary.

### Rust Preflight

The Rust executor refuses known high-risk patterns before running a command.

Examples:

- `sudo`
- `diskutil`
- `launchctl`
- `pmset`
- `osascript`
- `dd`
- `mkfs`
- downloaded scripts piped into a shell
- broad recursive deletion such as `rm -rf /`

The `mv` preflight also checks:

- source exists
- destination parent exists
- destination does not move a folder into itself

## API Keys

API keys are stored in the local Tauri app store. They must never be placed in:

- `.env`
- source files
- docs
- test fixtures
- release archives
- GitHub issues

## Known Limitations

- Shell parsing is conservative, not a complete shell safety proof.
- The model can still generate wrong-but-plausible commands.
- Hosted providers receive prompt context and file paths.
- Unsigned macOS builds will show Gatekeeper warnings.

## Future Hardening

- Parse command AST instead of relying on string-level checks.
- Execute a narrower allowlist for common file actions.
- Add dry-run mode for supported commands.
- Add test coverage for command preflight cases.
- Add signed and notarized releases.
