# Changelog

All notable changes to Aro are tracked here.

## v0.2.0

### Added

- Multi-provider settings for Grok, OpenAI, Gemini, DeepSeek, Local, and Custom providers.
- DeepSeek `deepseek-v4-flash` support.
- Local model mode for OpenAI-compatible servers such as Ollama and LM Studio.
- Finder context that includes selected files and visible current-folder items.
- Clarification flow for vague file targets.
- Personalization memory for successful commands.
- Native Escape handling while Aro is visible.
- macOS-style light glass UI for the command bar and settings.

### Changed

- Provider tabs wrap instead of clipping in Settings.
- The command bar file chip now distinguishes selected files from visible folder items.
- Prompt examples now avoid ambiguous rename language.

### Security

- Added Rust command preflight refusal for high-risk system and shell patterns.
- Added `mv` preflight for missing sources, invalid destination parents, and folder self-moves.
- Added source secret scanning to the release checklist.

## v0.1.2

### Added

- Initial Aro command bar prototype.
- Finder AppleScript integration.
- AI command generation.
- Command preview, side-effect prediction, and shell execution.
