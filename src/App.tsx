import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogicalSize, getCurrentWindow } from "@tauri-apps/api/window";
import { load } from "@tauri-apps/plugin-store";
import ClarificationCard from "./components/ClarificationCard";
import CommandInput from "./components/CommandInput";
import CommandPreview from "./components/CommandPreview";
import Onboarding from "./components/Onboarding";
import OutputDisplay from "./components/OutputDisplay";
import { useCommandHistory } from "./hooks/useCommandHistory";
import { useFinderContext } from "./hooks/useFinderContext";
import { useGlobalShortcut } from "./hooks/useGlobalShortcut";
import { useGrok } from "./hooks/useGrok";
import { normalizeCommand } from "./lib/command-parser";
import { clarificationForAmbiguousRequest, findInstantAction } from "./lib/instant-actions";
import {
  createDefaultLlmSettings,
  getActiveProviderSettings,
  normalizeLlmSettings,
  type AutoRunCategory,
  type LlmSettings,
  type PersonalizationSettings,
} from "./lib/llm-settings";
import {
  applyRunToMemory,
  emptyStore,
  loadMemory,
  memoryPromptSection,
  migrateLearnedPreferences,
  saveMemory,
  type MemoryStore,
} from "./lib/memory";
import type { CommandResult, FinderContext, Prediction } from "./types";

type AppView = "command" | "onboarding";

async function openSettingsWindow() {
  try {
    await invoke("show_settings_window");
  } catch (error) {
    console.warn("Unable to open Settings window:", error);
  }
}

interface WindowFrame {
  dockBelowFinder: boolean;
  height: number;
  width: number;
}

interface ClarificationState {
  originalInput: string;
  question: string;
}

function windowFrameForState(
  view: AppView,
  hasCommand: boolean,
  hasOutput: boolean,
  hasError: boolean,
  hasClarification: boolean,
): WindowFrame {
  if (view === "onboarding") return { dockBelowFinder: false, height: 640, width: 900 };
  if (hasOutput) return { dockBelowFinder: true, height: 430, width: 860 };
  if (hasClarification) return { dockBelowFinder: true, height: 390, width: 860 };
  if (hasCommand) return { dockBelowFinder: true, height: 330, width: 860 };
  if (hasError) return { dockBelowFinder: true, height: 250, width: 860 };
  return { dockBelowFinder: true, height: 178, width: 860 };
}

async function resizeWindow({ dockBelowFinder, height, width }: WindowFrame) {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.setSize(new LogicalSize(width, height));
    await appWindow.show();
    if (dockBelowFinder) {
      await invoke("position_main_window");
    } else {
      await appWindow.center();
    }
    await appWindow.setFocus();
  } catch (error) {
    console.warn("Unable to resize Aro window:", error);
  }
}

async function executeGeneratedCommand(command: string, workingDir: string) {
  return invoke<CommandResult>("execute_command", {
    command,
    workingDir,
  });
}

async function hideWindow() {
  try {
    await invoke("hide_main_window");
  } catch (error) {
    console.warn("Unable to hide Aro window:", error);
    try {
      await getCurrentWindow().hide();
    } catch {
      // The native hide command is preferred because it also releases Escape capture.
    }
  }
}

function personalizationPrompt(
  settings: PersonalizationSettings,
  memory: MemoryStore,
  userPrompt: string,
) {
  return [
    `Command style: ${settings.commandStyle}.`,
    `Output naming: ${settings.outputNaming}.`,
    `Always ask before destructive actions: ${settings.alwaysAskBeforeDestructive ? "yes" : "no"}.`,
    `User instructions: ${settings.customInstructions || "None."}`,
    "What Aro has learned about this user (use it to make better choices):",
    memoryPromptSection(memory, userPrompt),
  ].join("\n");
}

function inventedGenericPath(command: string) {
  const match = command.match(/\/(the\s+(?:file|files|image|images|item|items))(?=['"\s;]|$)/i);
  return match?.[1] ?? "";
}

export default function App() {
  const [view, setView] = useState<AppView>("onboarding");
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() => createDefaultLlmSettings());
  const [generatedCommand, setGeneratedCommand] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [output, setOutput] = useState<CommandResult | null>(null);
  const [clarification, setClarification] = useState<ClarificationState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [activeContext, setActiveContext] = useState<FinderContext | null>(null);
  const [pendingInput, setPendingInput] = useState("");
  const [memory, setMemory] = useState<MemoryStore>(() => emptyStore());

  const { finderContext, finderError, refreshFinderContext } = useFinderContext();
  const commandHistory = useCommandHistory();
  const { askGrok, predictSideEffects } = useGrok();

  const effectiveContext = useMemo(
    () => activeContext ?? finderContext,
    [activeContext, finderContext],
  );

  useEffect(() => {
    void (async () => {
      const store = await load("settings.json");
      const storedKey = await store.get<string>("grok_api_key");
      const storedSettings = await store.get<unknown>("llm_settings");
      const completed = Boolean(await store.get<boolean>("onboarding_completed"));
      const normalizedSettings = normalizeLlmSettings(storedSettings, storedKey);

      setLlmSettings(normalizedSettings);
      setOnboardingCompleted(completed);
      setView(completed && normalizedSettings.providerChosen ? "command" : "onboarding");
      await store.set("llm_settings", normalizedSettings);
      await store.set("grok_model", normalizedSettings.providers.grok.model);
      await store.save();

      const loadedMemory = await loadMemory();
      const migrated = migrateLearnedPreferences(
        loadedMemory,
        normalizedSettings.personalization.learnedPreferences,
      );
      setMemory(migrated);
      if (migrated.records.length !== loadedMemory.records.length) {
        await saveMemory(migrated);
      }
    })();
  }, []);

  useEffect(() => {
    let dispose: (() => void) | null = null;
    void listen<LlmSettings>("aro:settings-updated", (event) => {
      if (event.payload) setLlmSettings(normalizeLlmSettings(event.payload));
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      dispose?.();
    };
  }, []);

  useEffect(() => {
    let dispose: (() => void) | null = null;
    void listen<MemoryStore>("aro:memory-updated", (event) => {
      if (event.payload) setMemory(event.payload);
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      dispose?.();
    };
  }, []);

  useEffect(() => {
    const frame = windowFrameForState(
      view,
      Boolean(generatedCommand),
      Boolean(output),
      Boolean(error),
      Boolean(clarification),
    );
    void resizeWindow(frame);
  }, [clarification, error, generatedCommand, output, view]);

  useGlobalShortcut(
    useCallback(() => {
      setView(onboardingCompleted ? "command" : "onboarding");
      setError("");
      setFocusSignal((value) => value + 1);
      void refreshFinderContext();
    }, [onboardingCompleted, refreshFinderContext]),
  );

  const persistSettings = async (nextSettings: LlmSettings) => {
    const normalizedSettings = normalizeLlmSettings(nextSettings);
    setLlmSettings(normalizedSettings);

    const store = await load("settings.json");
    await store.set("llm_settings", normalizedSettings);
    await store.set("grok_api_key", normalizedSettings.providers.grok.apiKey.trim());
    await store.set("grok_model", normalizedSettings.providers.grok.model);
    await store.save();

    return normalizedSettings;
  };

  const completeOnboarding = async (nextSettings: LlmSettings) => {
    await persistSettings(nextSettings);

    const store = await load("settings.json");
    await store.set("onboarding_completed", true);
    await store.save();

    setOnboardingCompleted(true);
    setView("command");
    setFocusSignal((value) => value + 1);
    void refreshFinderContext();
  };

  const resetTransientState = useCallback(() => {
    setGeneratedCommand("");
    setPrediction(null);
    setOutput(null);
    setClarification(null);
    setError("");
    setPendingInput("");
  }, []);

  const rememberSuccessfulRun = useCallback(
    async (input: string, command: string) => {
      if (!input.trim() || !command.trim()) return;
      const next = applyRunToMemory(memory, input, command);
      if (next === memory) return;
      setMemory(next);
      await saveMemory(next);
    },
    [memory],
  );

  const handleEscape = useCallback(() => {
    if (view === "onboarding") {
      void hideWindow();
      return;
    }

    if (generatedCommand || output || clarification || error) {
      resetTransientState();
      setFocusSignal((value) => value + 1);
      return;
    }

    void hideWindow();
  }, [clarification, error, generatedCommand, output, resetTransientState, view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleEscape();
        return;
      }

      const accel = event.metaKey || event.ctrlKey;
      if (!accel) return;

      switch (event.key) {
        case ",":
          event.preventDefault();
          void openSettingsWindow();
          return;
        case ".":
          event.preventDefault();
          handleEscape();
          return;
        case "n":
        case "N":
          event.preventDefault();
          resetTransientState();
          setFocusSignal((value) => value + 1);
          return;
        case "w":
        case "W":
          event.preventDefault();
          void hideWindow();
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleEscape, resetTransientState]);

  const handleSubmit = async (rawInput: string) => {
    const input = rawInput.trim();
    if (!input || loading) return;

    setLoading(true);
    resetTransientState();
    setPendingInput(input);
    commandHistory.push(input);

    try {
      const context = await refreshFinderContext();
      setActiveContext(context);

      const selectedFiles = context?.selected_files ?? [];
      const currentDirectory = context?.current_directory ?? "~";
      const directoryItems = context?.directory_items ?? [];
      const hasClarificationAnswer = /clarification from user:/i.test(input);
      const localClarification = hasClarificationAnswer
        ? ""
        : clarificationForAmbiguousRequest(input, selectedFiles, directoryItems);

      if (localClarification) {
        setClarification({
          originalInput: input,
          question: localClarification,
        });
        return;
      }

      const instantAction = hasClarificationAnswer
        ? null
        : findInstantAction(input, selectedFiles, currentDirectory, directoryItems);
      const { provider, credentials } = getActiveProviderSettings(llmSettings);

      if (!instantAction && provider.requiresApiKey && !credentials.apiKey.trim()) {
        void openSettingsWindow();
        return;
      }

      const command = instantAction
        ? instantAction.getCommand(input, selectedFiles, currentDirectory, directoryItems)
        : await askGrok({
            provider: provider.id,
            apiKey: credentials.apiKey,
            model: credentials.model,
            baseUrl: credentials.baseUrl,
            userPrompt: input,
            personalization: personalizationPrompt(
              llmSettings.personalization,
              memory,
              input,
            ),
            selectedFiles,
            currentDirectory,
            directoryItems,
          });

      const normalizedCommand = normalizeCommand(command);
      if (normalizedCommand.toLowerCase().startsWith("clarify:")) {
        const question = normalizedCommand.replace(/^clarify:\s*/i, "").trim();
        setClarification({
          originalInput: input,
          question: question || "What exactly should I change?",
        });
        return;
      }

      setGeneratedCommand(normalizedCommand);

      const inventedPath = inventedGenericPath(normalizedCommand);
      if (inventedPath) {
        setGeneratedCommand("");
        setClarification({
          originalInput: input,
          question: `Which exact file or folder did you mean by "${inventedPath}"?`,
        });
        return;
      }

      const nextPrediction = await predictSideEffects(normalizedCommand);
      const shouldAutoRun = llmSettings.autoRunCategories.includes(
        nextPrediction.category as AutoRunCategory,
      );

      setPrediction(
        instantAction
          ? { ...nextPrediction, description: instantAction.description }
          : nextPrediction,
      );

      if (shouldAutoRun) {
        try {
          const result = await executeGeneratedCommand(normalizedCommand, currentDirectory);
          setOutput(result);
          if (result.success) {
            void rememberSuccessfulRun(input, normalizedCommand);
          }
        } catch (executeError) {
          setOutput({
            stdout: "",
            stderr: `Execution error: ${String(executeError)}`,
            exit_code: -1,
            success: false,
            undo_command: null,
          });
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setLoading(false);
    }
  };

  const handleClarificationSubmit = (answer: string) => {
    if (!clarification) return;

    const nextPrompt = [
      clarification.originalInput,
      "",
      `Clarification from user: ${answer}`,
    ].join("\n");

    setClarification(null);
    void handleSubmit(nextPrompt);
  };

  const handleConfirm = async () => {
    if (!generatedCommand || !effectiveContext) return;

    setLoading(true);
    setError("");

    try {
      const result = await executeGeneratedCommand(
        generatedCommand,
        effectiveContext.current_directory || "~",
      );

      setOutput(result);
      if (result.success) {
        void rememberSuccessfulRun(pendingInput, generatedCommand);
      }
    } catch (executeError) {
      setOutput({
        stdout: "",
        stderr: `Execution error: ${String(executeError)}`,
        exit_code: -1,
        success: false,
        undo_command: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (undoCommand: string) => {
    if (!effectiveContext) return;

    setLoading(true);
    setError("");

    try {
      const result = await executeGeneratedCommand(
        undoCommand,
        effectiveContext.current_directory || "~",
      );

      setOutput({
        ...result,
        stdout: result.stdout || (result.success ? "Undo completed." : result.stdout),
        undo_command: null,
      });
    } catch (undoError) {
      setOutput({
        stdout: "",
        stderr: `Undo error: ${String(undoError)}`,
        exit_code: -1,
        success: false,
        undo_command: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetTransientState();
    setFocusSignal((value) => value + 1);
  };

  if (view === "onboarding") {
    return (
      <Onboarding
        finderContext={finderContext}
        finderError={finderError}
        onCheckFinder={refreshFinderContext}
        onComplete={completeOnboarding}
        settings={llmSettings}
      />
    );
  }

  return (
    <main className="app-shell h-screen overflow-hidden rounded-[28px] border border-[var(--rule)] text-[var(--ink)] shadow-[var(--shadow-window)] backdrop-blur-2xl">
      <CommandInput
        finderContext={finderContext}
        finderError={finderError}
        focusSignal={focusSignal}
        history={commandHistory.history}
        historyIndex={commandHistory.historyIndex}
        loading={loading}
        onRefreshContext={refreshFinderContext}
        onRequestHide={handleEscape}
        onSettingsClick={() => void openSettingsWindow()}
        onSubmit={handleSubmit}
        setHistoryIndex={commandHistory.setHistoryIndex}
      />

      {error && (
        <div className="border-t border-[var(--rule)] px-4 py-3 text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      {generatedCommand && !output && (
        <CommandPreview
          command={generatedCommand}
          loading={loading}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          prediction={prediction}
        />
      )}

      {clarification && (
        <ClarificationCard
          loading={loading}
          onCancel={handleCancel}
          onSubmit={handleClarificationSubmit}
          question={clarification.question}
        />
      )}

      {output && (
        <OutputDisplay
          loading={loading}
          onDismiss={handleCancel}
          onUndo={handleUndo}
          result={output}
        />
      )}
    </main>
  );
}
