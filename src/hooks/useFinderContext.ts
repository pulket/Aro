import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FinderContext } from "../types";

export function useFinderContext() {
  const [finderContext, setFinderContext] = useState<FinderContext | null>(null);
  const [finderError, setFinderError] = useState("");

  const refreshFinderContext = useCallback(async () => {
    try {
      const context = await invoke<FinderContext>("get_finder_context");
      setFinderContext(context);
      setFinderError("");
      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFinderError(message);
      console.warn("Failed to get Finder context:", message);
      return null;
    }
  }, []);

  return { finderContext, finderError, refreshFinderContext };
}
