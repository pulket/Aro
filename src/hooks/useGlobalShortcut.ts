import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export function useGlobalShortcut(onShown: () => void) {
  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | null = null;

    void listen("aro:shown", () => {
      onShown();
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }

      dispose = unlisten;
    });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [onShown]);
}
