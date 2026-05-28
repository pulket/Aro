import { useCallback, useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";

const HISTORY_LIMIT = 50;

async function saveHistory(history: string[]) {
  const store = await load("settings.json");
  await store.set("command_history", history);
  await store.save();
}

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    void (async () => {
      const store = await load("settings.json");
      const storedHistory = await store.get<string[]>("command_history");
      if (storedHistory) setHistory(storedHistory);
    })();
  }, []);

  const push = useCallback(
    (input: string) => {
      const nextHistory = [input, ...history.filter((item) => item !== input)].slice(
        0,
        HISTORY_LIMIT,
      );

      setHistory(nextHistory);
      setHistoryIndex(-1);
      void saveHistory(nextHistory);
    },
    [history],
  );

  return { history, historyIndex, push, setHistoryIndex };
}
