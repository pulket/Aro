import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AskGrokInput, Prediction } from "../types";

export function useGrok() {
  const askGrok = useCallback((input: AskGrokInput) => {
    return invoke<string>("ask_grok", {
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      baseUrl: input.baseUrl,
      userPrompt: input.userPrompt,
      personalization: input.personalization,
      selectedFiles: input.selectedFiles,
      currentDirectory: input.currentDirectory,
      directoryItems: input.directoryItems,
    });
  }, []);

  const predictSideEffects = useCallback((command: string) => {
    return invoke<Prediction>("predict_side_effects", { command });
  }, []);

  return { askGrok, predictSideEffects };
}
