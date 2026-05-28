import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";
import Settings from "./Settings";
import {
  createDefaultLlmSettings,
  normalizeLlmSettings,
  type LlmSettings,
} from "../lib/llm-settings";

async function loadSettings(): Promise<LlmSettings> {
  const store = await load("settings.json");
  const stored = await store.get<unknown>("llm_settings");
  const legacyKey = await store.get<string>("grok_api_key");
  return normalizeLlmSettings(stored, legacyKey ?? "");
}

async function persistSettings(next: LlmSettings) {
  const normalized = normalizeLlmSettings(next);
  const store = await load("settings.json");
  await store.set("llm_settings", normalized);
  await store.set("grok_api_key", normalized.providers.grok.apiKey.trim());
  await store.set("grok_model", normalized.providers.grok.model);
  await store.save();
  await emit("aro:settings-updated", normalized);
  return normalized;
}

async function closeWindow() {
  try {
    await invoke("hide_settings_window");
  } catch {
    // ignore
  }
}

export default function SettingsWindow() {
  const [settings, setSettings] = useState<LlmSettings>(() => createDefaultLlmSettings());

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "w") {
        event.preventDefault();
        void closeWindow();
      } else if (event.key === "Escape") {
        event.preventDefault();
        void closeWindow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    let dispose: (() => void) | null = null;
    void listen<LlmSettings>("aro:settings-updated", (event) => {
      if (event.payload) setSettings(normalizeLlmSettings(event.payload));
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      dispose?.();
    };
  }, []);

  return (
    <Settings
      onBack={() => void closeWindow()}
      onOpenOnboarding={() => {
        // Onboarding lives in the main window; bring it forward.
        void invoke("show_main_window").catch(() => {});
        void closeWindow();
      }}
      onSave={async (next) => {
        const normalized = await persistSettings(next);
        setSettings(normalized);
        void closeWindow();
      }}
      settings={settings}
    />
  );
}
