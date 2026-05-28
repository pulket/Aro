import type { ProviderId } from "./lib/llm-settings";

export interface FinderContext {
  selected_files: string[];
  current_directory: string;
  directory_items: FinderDirectoryItem[];
}

export interface FinderDirectoryItem {
  name: string;
  path: string;
  kind: "file" | "folder";
}

export interface Prediction {
  category:
    | "safe"
    | "creates_files"
    | "modifies_files"
    | "deletes_files"
    | "network"
    | "system"
    | "unknown";
  description: string;
  risk_level: "low" | "medium" | "high";
  files_affected: string[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
  undo_command?: string | null;
}

export interface AskGrokInput {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  userPrompt: string;
  personalization: string;
  selectedFiles: string[];
  currentDirectory: string;
  directoryItems: FinderDirectoryItem[];
}

export interface LocalModelStatus {
  base_url: string;
  running: boolean;
  model_available: boolean;
  models: string[];
  message: string;
}
