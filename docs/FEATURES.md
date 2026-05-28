# Features

Aro is designed around one simple idea: Finder already knows what you are working on, so the command bar should know too.

## Finder-Aware Actions

Aro reads:

- selected files
- current Finder directory
- visible items in the current Finder folder

This lets you use natural prompts without manually copying absolute paths.

## Clarification Instead of Guessing

If a prompt is ambiguous, Aro should ask a question.

Example:

```text
rename the image to animal.jpg
```

If the folder contains `dolphin.jpg` and `panda.jpg`, Aro should ask which image you mean instead of inventing a path.

## Command Preview

Before running a command, Aro shows the raw command. This keeps the shell visible and inspectable.

## Side-Effect Prediction

Aro classifies commands before execution:

- read-only
- creates files
- modifies files
- deletes files
- network
- system
- unknown

This helps users make a faster decision without hiding risk.

## Provider Choice

Aro supports:

- Grok
- OpenAI
- Gemini
- DeepSeek
- Local models
- Custom OpenAI-compatible endpoints

DeepSeek defaults to `deepseek-v4-flash`.

## Local Model Mode

Local mode is for users who do not want hosted API calls. It works with local OpenAI-compatible servers such as:

- Ollama
- LM Studio
- other local `/v1/chat/completions` servers

## Personalization Memory

Aro stores successful patterns locally and can use them as context later. The goal is for the product to become more aligned with the user's naming style, caution level, and common workflows over time.

## Auto-Run Settings

Users can choose whether lower-risk categories should run more seamlessly.

High-risk and unknown actions still need review.

## Native macOS Feel

Aro is intentionally compact:

- appears near Finder
- uses rounded macOS-style controls
- keeps settings readable
- exposes a visible Hide control
- supports Escape to hide while visible
