import { load } from "@tauri-apps/plugin-store";
import { emit } from "@tauri-apps/api/event";

export type MemoryKind =
  | "pattern"
  | "vocab"
  | "tool"
  | "destination"
  | "avoid"
  | "naming";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  text: string;
  evidence: string[];
  occurrences: number;
  createdAt: number;
  lastSeenAt: number;
  pinned: boolean;
  source: "auto" | "manual";
}

export interface MemoryStore {
  records: MemoryRecord[];
}

const STORE_FILE = "settings.json";
const MEMORY_KEY = "aro_memory";
const MAX_RECORDS = 60;
const MAX_PROMPT_RECORDS = 12;
const MAX_EVIDENCE = 5;

const HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 14;

const TOOL_NAMES = [
  "ffmpeg",
  "imagemagick",
  "magick",
  "convert",
  "sips",
  "ditto",
  "rsync",
  "zip",
  "unzip",
  "tar",
  "git",
  "curl",
  "wget",
  "pandoc",
  "qpdf",
  "gs",
  "yt-dlp",
  "exiftool",
  "jq",
  "node",
  "python",
  "python3",
  "open",
  "mdfind",
  "mdls",
  "stat",
  "find",
  "wc",
  "awk",
  "sed",
  "grep",
  "rg",
];

const DESTRUCTIVE_VERBS = ["rm", "rm -rf", "sudo", "shutdown", "kill -9"];

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function nowMs(): number {
  return Date.now();
}

export function scoreRecord(record: MemoryRecord, now = nowMs()): number {
  if (record.pinned) return Number.POSITIVE_INFINITY;
  const age = Math.max(0, now - record.lastSeenAt);
  const recency = Math.pow(0.5, age / HALF_LIFE_MS);
  return record.occurrences * (0.5 + recency);
}

export function emptyStore(): MemoryStore {
  return { records: [] };
}

export function normalizeStore(raw: unknown): MemoryStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const candidate = raw as Partial<MemoryStore>;
  const records = Array.isArray(candidate.records) ? candidate.records : [];
  return {
    records: records
      .filter((record): record is MemoryRecord => {
        return (
          !!record &&
          typeof record === "object" &&
          typeof record.id === "string" &&
          typeof record.text === "string" &&
          typeof record.kind === "string"
        );
      })
      .map((record) => ({
        id: record.id,
        kind: record.kind,
        text: record.text,
        evidence: Array.isArray(record.evidence) ? record.evidence.slice(0, MAX_EVIDENCE) : [],
        occurrences: Number.isFinite(record.occurrences) ? Math.max(1, record.occurrences) : 1,
        createdAt: Number.isFinite(record.createdAt) ? record.createdAt : nowMs(),
        lastSeenAt: Number.isFinite(record.lastSeenAt) ? record.lastSeenAt : nowMs(),
        pinned: Boolean(record.pinned),
        source: record.source === "manual" ? "manual" : "auto",
      })),
  };
}

export async function loadMemory(): Promise<MemoryStore> {
  const store = await load(STORE_FILE);
  const raw = await store.get<unknown>(MEMORY_KEY);
  return normalizeStore(raw);
}

export async function saveMemory(memory: MemoryStore): Promise<void> {
  const store = await load(STORE_FILE);
  await store.set(MEMORY_KEY, memory);
  await store.save();
  try {
    await emit("aro:memory-updated", memory);
  } catch {
    // emit is best-effort across windows
  }
}

interface CandidateMemory {
  kind: MemoryKind;
  text: string;
  evidence: string;
}

function firstToken(command: string): string {
  const trimmed = command.trim();
  if (trimmed.startsWith("sudo ")) {
    return trimmed.slice(5).trim().split(/\s+/)[0] ?? "";
  }
  return trimmed.split(/\s+/)[0] ?? "";
}

function detectToolMemory(input: string, command: string): CandidateMemory | null {
  const tokens = command
    .toLowerCase()
    .split(/[\s|;&]+/)
    .filter(Boolean);
  const tool = TOOL_NAMES.find((name) => tokens.includes(name));
  if (!tool) return null;

  const intentWord = input
    .toLowerCase()
    .split(/\s+/)
    .find((word) => /^[a-z]{4,}$/.test(word) && !STOP.has(word));
  if (!intentWord) return null;

  return {
    kind: "tool",
    text: `When the user asks to "${intentWord}", prefer ${tool}.`,
    evidence: `${input} → ${command}`,
  };
}

function detectVocabMemory(input: string, command: string): CandidateMemory | null {
  const compact = input.trim().toLowerCase();
  if (compact.length < 3 || compact.length > 40) return null;
  if (compact.split(/\s+/).length > 4) return null;
  return {
    kind: "vocab",
    text: `When the user says "${compact}", they mean: ${command.trim().slice(0, 140)}.`,
    evidence: `${input} → ${command}`,
  };
}

function detectDestinationMemory(input: string, command: string): CandidateMemory | null {
  const dirMatch = command.match(/(?:^|\s)(?:mv|cp|rsync)\s+[^|]*?\s+("?)((?:~|\/)[^"\s]+)\1\s*$/);
  const target = dirMatch?.[2];
  if (!target) return null;
  const intent = input.trim().toLowerCase().split(/\s+/).slice(0, 6).join(" ");
  return {
    kind: "destination",
    text: `For "${intent}" the user moves files to ${target}.`,
    evidence: `${input} → ${command}`,
  };
}

function detectAvoidMemory(input: string, command: string): CandidateMemory | null {
  if (!/never|don'?t|do not|avoid/.test(input.toLowerCase())) return null;
  return {
    kind: "avoid",
    text: `User instruction to honor: ${input.trim().slice(0, 160)}.`,
    evidence: `${input} → ${command}`,
  };
}

function detectNamingMemory(input: string, command: string): CandidateMemory | null {
  const namedTarget = command.match(/(?:-o|>|"?)\s+["']?([\w.\-]+\.[a-z0-9]{2,5})["']?\s*$/i);
  const name = namedTarget?.[1];
  if (!name) return null;
  return {
    kind: "naming",
    text: `User often names outputs like ${name}.`,
    evidence: `${input} → ${command}`,
  };
}

function detectPatternMemory(input: string, command: string): CandidateMemory {
  return {
    kind: "pattern",
    text: `Successful pattern: "${input.trim().slice(0, 90)}" → ${command
      .trim()
      .slice(0, 140)}.`,
    evidence: `${input} → ${command}`,
  };
}

const STOP = new Set([
  "the",
  "this",
  "that",
  "these",
  "those",
  "and",
  "with",
  "into",
  "from",
  "make",
  "please",
  "could",
  "would",
  "should",
  "files",
  "file",
  "folder",
  "selected",
  "current",
]);

function extractCandidates(input: string, command: string): CandidateMemory[] {
  const candidates: CandidateMemory[] = [];
  const tool = detectToolMemory(input, command);
  if (tool) candidates.push(tool);
  const vocab = detectVocabMemory(input, command);
  if (vocab) candidates.push(vocab);
  const dest = detectDestinationMemory(input, command);
  if (dest) candidates.push(dest);
  const avoid = detectAvoidMemory(input, command);
  if (avoid) candidates.push(avoid);
  const naming = detectNamingMemory(input, command);
  if (naming) candidates.push(naming);
  if (candidates.length === 0) {
    candidates.push(detectPatternMemory(input, command));
  }
  return candidates;
}

function commandIsTrivial(command: string): boolean {
  const first = firstToken(command).toLowerCase();
  if (!first) return true;
  if (DESTRUCTIVE_VERBS.includes(first)) return false;
  return false;
}

function dedupeKey(candidate: CandidateMemory): string {
  return `${candidate.kind}:${hash(normalize(candidate.text))}`;
}

export function applyRunToMemory(
  memory: MemoryStore,
  input: string,
  command: string,
): MemoryStore {
  if (!input.trim() || !command.trim()) return memory;
  if (commandIsTrivial(command)) return memory;

  const now = nowMs();
  const candidates = extractCandidates(input, command);
  const byId = new Map(memory.records.map((record) => [record.id, record]));

  for (const candidate of candidates) {
    const id = dedupeKey(candidate);
    const existing = byId.get(id);
    if (existing) {
      existing.occurrences += 1;
      existing.lastSeenAt = now;
      existing.evidence = [
        candidate.evidence,
        ...existing.evidence.filter((entry) => entry !== candidate.evidence),
      ].slice(0, MAX_EVIDENCE);
    } else {
      byId.set(id, {
        id,
        kind: candidate.kind,
        text: candidate.text,
        evidence: [candidate.evidence],
        occurrences: 1,
        createdAt: now,
        lastSeenAt: now,
        pinned: false,
        source: "auto",
      });
    }
  }

  let records = Array.from(byId.values());
  records.sort((a, b) => scoreRecord(b, now) - scoreRecord(a, now));
  if (records.length > MAX_RECORDS) {
    const pinned = records.filter((record) => record.pinned);
    const unpinned = records.filter((record) => !record.pinned);
    records = pinned.concat(unpinned).slice(0, MAX_RECORDS);
  }

  return { records };
}

export function topMemoriesForPrompt(
  memory: MemoryStore,
  prompt: string,
  limit = MAX_PROMPT_RECORDS,
): MemoryRecord[] {
  if (memory.records.length === 0) return [];
  const now = nowMs();
  const promptTokens = new Set(
    normalize(prompt)
      .split(/\W+/)
      .filter((token) => token.length > 2 && !STOP.has(token)),
  );

  const ranked = memory.records
    .map((record) => {
      const recordTokens = normalize(record.text + " " + record.evidence.join(" "))
        .split(/\W+/)
        .filter((token) => token.length > 2);
      const overlap = recordTokens.reduce(
        (count, token) => count + (promptTokens.has(token) ? 1 : 0),
        0,
      );
      const base = scoreRecord(record, now);
      return { record, score: base + overlap * 2 };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit).map((entry) => entry.record);
}

export function memoryPromptSection(memory: MemoryStore, prompt: string): string {
  const top = topMemoriesForPrompt(memory, prompt);
  if (top.length === 0) return "- Aro has no learned memory yet.";
  return top.map((record) => `- (${record.kind} ×${record.occurrences}) ${record.text}`).join("\n");
}

export function forgetMemory(memory: MemoryStore, id: string): MemoryStore {
  return { records: memory.records.filter((record) => record.id !== id) };
}

export function pinMemory(
  memory: MemoryStore,
  id: string,
  pinned: boolean,
): MemoryStore {
  return {
    records: memory.records.map((record) =>
      record.id === id ? { ...record, pinned } : record,
    ),
  };
}

export function migrateLearnedPreferences(
  memory: MemoryStore,
  learned: string[],
): MemoryStore {
  if (learned.length === 0) return memory;
  const now = nowMs();
  const byId = new Map(memory.records.map((record) => [record.id, record]));

  for (const entry of learned) {
    const text = entry.trim();
    if (!text) continue;
    const candidate: CandidateMemory = {
      kind: "pattern",
      text,
      evidence: text,
    };
    const id = dedupeKey(candidate);
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      kind: "pattern",
      text,
      evidence: [text],
      occurrences: 1,
      createdAt: now,
      lastSeenAt: now,
      pinned: false,
      source: "auto",
    });
  }

  return { records: Array.from(byId.values()) };
}
