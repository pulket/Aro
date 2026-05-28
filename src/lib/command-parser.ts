export function normalizeCommand(command: string) {
  return command
    .trim()
    .replace(/^```(?:bash|sh)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/^\$\s*/, "")
    .trim();
}
